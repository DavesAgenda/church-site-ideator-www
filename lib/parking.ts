import type { Placement } from "./placements";

export const BAY = { width: 2.5, length: 5 } as const;
export const AISLE = { width: 6 } as const;

/**
 * Approximate parking bay count for a rectangle of given width/length in metres.
 * Strategy:
 *   - Treat the longer side as the aisle direction, the shorter side as the row depth.
 *   - If the rectangle is deep enough for two rows of bays flanking a central aisle,
 *     use the standard two-row layout. Otherwise fall back to a single row of bays
 *     (one bay deep, no aisle) so narrow rectangles still get a small estimate.
 *   - Landscaping is modelled as a proportional reduction of the row-depth dimension.
 */
export function estimateBays(
  widthM: number,
  lengthM: number,
  landscapingFraction: number
): number {
  const w = Math.max(widthM, lengthM); // aisle direction (longer)
  const l = Math.min(widthM, lengthM); // row depth direction (shorter)
  const f = Math.max(0, Math.min(1, landscapingFraction));

  if (w < BAY.width) return 0;

  const effectiveL = l * (1 - f);

  // Two-row layout: two rows of bays with a central aisle between them.
  if (effectiveL >= BAY.length * 2 + AISLE.width) {
    const baysPerRow = Math.floor(w / BAY.width);
    const rows = Math.floor((effectiveL - AISLE.width) / BAY.length);
    return baysPerRow * Math.min(rows, 2);
  }

  // Single-row fallback for narrow rectangles: one row of bays, no aisle.
  if (effectiveL >= BAY.length) {
    const baysPerRow = Math.floor(w / BAY.width);
    return baysPerRow;
  }

  return 0;
}

/**
 * Compute the two perpendicular side lengths (in metres) of a placement's bounds
 * rectangle. The width/length labels are arbitrary; consumers should treat them
 * as the dimensions of an axis-aligned rectangle in projected space.
 */
export function rectangleSideLengthsMetres(p: Placement): { width: number; length: number } {
  const dx = haversineM(p.bounds.west, p.bounds.south, p.bounds.east, p.bounds.south);
  const dy = haversineM(p.bounds.west, p.bounds.south, p.bounds.west, p.bounds.north);
  return { width: dx, length: dy };
}

function haversineM(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
