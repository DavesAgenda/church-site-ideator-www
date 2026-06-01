// lib/parking/solver.ts
// Pure parking solver. Takes axis-aligned bounds in metres and returns a
// `ParkingLayout` with bays, aisles, an access lane, and a summary.
//
// Algorithm (per parity-phase plan §3.2, the corrected bay-count formula):
//   w = max(widthM, lengthM)   // aisle direction
//   l = min(widthM, lengthM)   // row depth
//   effectiveL = l * (1 - f)  // f = landscapingFraction (clamped [0, 1])
//   if w < BAY.width:                       → 0 bays, warning
//   elif effectiveL >= 2*BAY.length + AISLE.width:
//       baysPerRow   = floor(w / BAY.width)
//       sideDepth    = (effectiveL - AISLE.width) / 2
//       rowsPerSide  = min(2, floor(sideDepth / BAY.length))
//       totalBays    = baysPerRow * rowsPerSide * 2
//       One central aisle along the width axis, bays stacked on both sides.
//   elif effectiveL >= BAY.length:          → single-row layout (no aisle)
//       baysPerRow   = floor(w / BAY.width)
//       totalBays    = baysPerRow
//   else:                                   → 0 bays, "too shallow"
//
// Reference: a 36m × 18m rectangle at f=0.10 returns exactly 28 bays.

import type {
  Access,
  Aisle,
  AisleOrientation,
  Bay,
  BayType,
  ParkingLayout,
  SolverBounds,
  SolverOptions,
  SolverSummary,
} from "./types";

export const BAY = { width: 2.5, length: 5 } as const;
export const AISLE = { width: 6 } as const;
export const ACCESS = { width: 3.5 } as const;
export const DEFAULT_LANDSCAPING = 0.10;

const DEFAULT_OPTIONS: Required<SolverOptions> = {
  landscapingFraction: DEFAULT_LANDSCAPING,
};

export function solveParking(
  bounds: SolverBounds,
  options: SolverOptions = {}
): ParkingLayout {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const f = clamp(opts.landscapingFraction, 0, 1);

  const rawW = Number.isFinite(bounds.widthM) ? bounds.widthM : 0;
  const rawL = Number.isFinite(bounds.lengthM) ? bounds.lengthM : 0;
  const w = Math.max(rawW, rawL); // aisle direction
  const l = Math.min(rawW, rawL); // row depth direction

  const bays: Bay[] = [];
  const aisles: Aisle[] = [];
  const access: Access[] = [];
  const warnings: string[] = [];

  // 1. Bail early if the rectangle is narrower than a single bay.
  if (w < BAY.width) {
    warnings.push(
      `Rectangle is ${w.toFixed(2)}m wide on the long side — no standard bay fits.`
    );
    return summarise(bays, aisles, access, warnings, w, l, "none");
  }

  const effectiveL = l * (1 - f);

  // 2. Two-row layout: two sides, each up to 2 rows, flanking a central aisle.
  if (effectiveL >= BAY.length * 2 + AISLE.width) {
    const baysPerRow = Math.floor(w / BAY.width);
    const sideDepth = (effectiveL - AISLE.width) / 2;
    const rowsPerSide = Math.min(2, Math.floor(sideDepth / BAY.length));

    // Aisle is centred along the length, full width of baysPerRow
    const aisleY0 = (l - AISLE.width) / 2;
    const aisleLength = baysPerRow * BAY.width;
    const aisle: Aisle = {
      x: 0,
      y: aisleY0,
      w: aisleLength,
      h: AISLE.width,
      orientation: "h" as AisleOrientation,
    };
    aisles.push(aisle);

    // Bays NORTH of the aisle (y decreases as we go north), stacked row by row.
    for (let r = 0; r < rowsPerSide; r++) {
      for (let c = 0; c < baysPerRow; c++) {
        const bay: Bay = {
          x: c * BAY.width,
          y: aisleY0 - (r + 1) * BAY.length,
          w: BAY.width,
          h: BAY.length,
          type: "standard" as BayType,
        };
        bays.push(bay);
      }
    }

    // Bays SOUTH of the aisle, stacked row by row.
    for (let r = 0; r < rowsPerSide; r++) {
      for (let c = 0; c < baysPerRow; c++) {
        const bay: Bay = {
          x: c * BAY.width,
          y: aisleY0 + AISLE.width + r * BAY.length,
          w: BAY.width,
          h: BAY.length,
          type: "standard" as BayType,
        };
        bays.push(bay);
      }
    }

    // Access lane at the NORTH short edge, length 2*ACCESS.width centred at x=0.
    // Coordinates are LOCAL to the placement SW corner. y is negative because
    // the access lane sits outside the south-north rectangle (i.e. the row of
    // bays closest to the building is north of y=0). The renderer can clip
    // access to the parcel if needed.
    const ac: Access = {
      x: 0,
      y: -ACCESS.width,
      w: ACCESS.width * 2,
      h: ACCESS.width,
    };
    access.push(ac);

    return summarise(bays, aisles, access, warnings, w, l, "two-row");
  }

  // 3. Single-row fallback for shallow rectangles: no aisle, bays against the
  //    south edge.
  if (effectiveL >= BAY.length) {
    const baysPerRow = Math.floor(w / BAY.width);
    for (let c = 0; c < baysPerRow; c++) {
      const bay: Bay = {
        x: c * BAY.width,
        y: 0,
        w: BAY.width,
        h: BAY.length,
        type: "standard" as BayType,
      };
      bays.push(bay);
    }
    warnings.push(
      "Single-row fallback — rectangle too shallow for a two-row layout, no aisle."
    );
    return summarise(bays, aisles, access, warnings, w, l, "single-row");
  }

  // 4. Too shallow for any bay.
  warnings.push(
    `Rectangle is ${l.toFixed(2)}m on the short side — too shallow for any standard bay.`
  );
  return summarise(bays, aisles, access, warnings, w, l, "none");
}

function summarise(
  bays: Bay[],
  aisles: Aisle[],
  access: Access[],
  warnings: string[],
  w: number,
  l: number,
  style: ParkingLayout["style"]
): ParkingLayout {
  const grossAreaM2 = Math.max(0, w) * Math.max(0, l);
  const totalBays = bays.length;
  const standardBays = bays.filter((b) => b.type === "standard").length;
  const accessibleBays = bays.filter((b) => b.type === "accessible").length;
  // efficiency: bays per 100 m^2. 0 when grossAreaM2 is 0 to avoid NaN.
  const efficiency = grossAreaM2 > 0 ? (totalBays / grossAreaM2) * 100 : 0;
  const summary: SolverSummary = {
    totalBays,
    standardBays,
    accessibleBays,
    grossAreaM2,
    efficiency,
  };
  return { bays, aisles, access, summary, warnings, style };
}

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}
