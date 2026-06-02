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
