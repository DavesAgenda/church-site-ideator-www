export type PlacementKind = "carpark" | "building" | "greenspace";

export interface PlacementBounds {
  south: number; west: number; north: number; east: number;
}

export interface Placement {
  id: string;
  kind: PlacementKind;
  name: string;
  bounds: PlacementBounds;
  /**
   * Rotation in degrees applied to the rendered parking layout (and, in
   * pass 2, the placement rect itself). Bounds stay in unrotated
   * lat/lng space; the renderer applies theta. Defaults to 0.
   */
  thetaDeg: number;
}

const KINDS: PlacementKind[] = ["carpark", "building", "greenspace"];

/**
 * Type guard for Placement. Treats a missing `thetaDeg` as 0. If
 * `thetaDeg` IS present, it must be a finite number (rejects strings,
 * NaN, +/-Infinity). Callers wanting a guaranteed-defaulted value
 * should use `migratePlacement` instead.
 */
export function isPlacement(value: unknown): value is Placement {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== "string" || typeof v.name !== "string") return false;
  if (!KINDS.includes(v.kind as PlacementKind)) return false;
  if (!v.bounds || typeof v.bounds !== "object") return false;
  const b = v.bounds as Record<string, unknown>;
  const boundsOk = ["south", "west", "north", "east"].every(
    (k) => typeof b[k] === "number" && Number.isFinite(b[k] as number)
  );
  if (!boundsOk) return false;
  // thetaDeg is optional. If present, it must be a finite number.
  if (v.thetaDeg !== undefined) {
    if (typeof v.thetaDeg !== "number" || !Number.isFinite(v.thetaDeg)) {
      return false;
    }
  }
  return true;
}

/**
 * Take an unknown value, validate it as a Placement, and return a
 * fully-defaulted Placement (thetaDeg filled in to 0 if missing or
 * non-finite). Throws if the value is not a valid Placement.
 *
 * Use this on read paths (localStorage hydration, URL params, etc.)
 * where we want to be lenient about missing thetaDeg but strict about
 * the rest of the shape.
 */
export function migratePlacement(value: unknown): Placement {
  if (!value || typeof value !== "object") {
    throw new Error("migratePlacement: value is not an object");
  }
  const v = value as Record<string, unknown>;
  if (typeof v.id !== "string") throw new Error("migratePlacement: id missing");
  if (typeof v.name !== "string") throw new Error("migratePlacement: name missing");
  if (!KINDS.includes(v.kind as PlacementKind)) {
    throw new Error("migratePlacement: invalid kind");
  }
  if (!v.bounds || typeof v.bounds !== "object") {
    throw new Error("migratePlacement: bounds missing");
  }
  const b = v.bounds as Record<string, unknown>;
  for (const k of ["south", "west", "north", "east"]) {
    if (typeof b[k] !== "number" || !Number.isFinite(b[k] as number)) {
      throw new Error(`migratePlacement: bounds.${k} not finite`);
    }
  }
  const theta =
    typeof v.thetaDeg === "number" && Number.isFinite(v.thetaDeg)
      ? v.thetaDeg
      : 0;
  return {
    id: v.id,
    kind: v.kind as PlacementKind,
    name: v.name,
    bounds: {
      south: b.south as number,
      west: b.west as number,
      north: b.north as number,
      east: b.east as number,
    },
    thetaDeg: theta,
  };
}

export function typePlacementColour(kind: PlacementKind): string {
  switch (kind) {
    case "carpark": return "#2563eb"; // blue-600
    case "building": return "#475569"; // slate-600
    case "greenspace": return "#16a34a"; // green-600
  }
}

export function kindLabel(kind: PlacementKind): string {
  switch (kind) {
    case "carpark": return "Car park";
    case "building": return "Building";
    case "greenspace": return "Green space";
  }
}

/**
 * Distance in metres between two lat/lng points on the WGS-84 sphere.
 * Uses the haversine formula. Central-angle approximation is fine for
 * the small distances we deal with in a church block.
 */
function haversineMetres(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Given two points of known metres-distance apart on the same
 * parallel, return the longitude delta. Used to convert metre
 * offsets to lat/lng offsets at a given latitude.
 */
function metresToLngDelta(metres: number, atLat: number): number {
  // 1 degree of longitude = 111_320 * cos(lat) metres
  return metres / (111_320 * Math.cos((atLat * Math.PI) / 180));
}

function metresToLatDelta(metres: number): number {
  // 1 degree of latitude ≈ 111_320 metres (constant enough for our scale)
  return metres / 111_320;
}

/**
 * Compute the axis-aligned bounding box of a placement after rotating
 * it by thetaDeg about its centre. The returned bounds is in WGS-84
 * lat/lng.
 *
 * Concept: a placement's "real" footprint is the rotated rectangle.
 * We store the AABB of that footprint so downstream consumers
 * (containment checks, solver, area display) don't need to know about
 * rotation. The renderer (BayGrid, placement rect) can still read
 * thetaDeg to know how the bays are oriented within the AABB.
 *
 * At thetaDeg=0 the result is the original bounds unchanged.
 * At thetaDeg=45 a 24×37m rectangle's AABB grows to ~43×43m, so the
 * solver has more area to lay out bays in.
 */
export function rotateBounds(
  b: PlacementBounds,
  thetaDeg: number
): PlacementBounds {
  if (!Number.isFinite(thetaDeg) || Math.abs(thetaDeg % 360) < 1e-9) {
    return b;
  }
  // Step 1: convert bounds to a local metre frame centred on the
  // bounds centre.
  const cLat = (b.north + b.south) / 2;
  const cLng = (b.east + b.west) / 2;
  const widthM = haversineMetres(cLat, b.west, cLat, b.east);
  const lengthM = haversineMetres(b.south, cLng, b.north, cLng);
  const halfW = widthM / 2;
  const halfL = lengthM / 2;

  // Step 2: rotate the 4 corners about the centre in metre space.
  const theta = (thetaDeg * Math.PI) / 180;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const corners = [
    { x: -halfW, y: -halfL },
    { x: halfW, y: -halfL },
    { x: halfW, y: halfL },
    { x: -halfW, y: halfL },
  ].map(({ x, y }) => ({
    x: x * cos - y * sin,
    y: x * sin + y * cos,
  }));

  // Step 3: convert rotated metre offsets back to lat/lng deltas.
  // East axis: positive x → east. South axis: positive y → south
  // (matching the placement's local convention where length grows
  // southward).
  const lngs = corners.map((c) => cLng + metresToLngDelta(c.x, cLat));
  const lats = corners.map((c) => cLat - metresToLatDelta(c.y));

  return {
    north: Math.max(...lats),
    south: Math.min(...lats),
    east: Math.max(...lngs),
    west: Math.min(...lngs),
  };
}
