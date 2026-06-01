import type { Placement } from "./placements";
import { solveParking } from "./parking/solver";

/**
 * @deprecated Use `solveParking` from `./solver`. This MVP shim is kept so
 * existing imports of `estimateBays` keep working during the parity phase.
 * The solver returns a layout AND a count; this shim unwraps the count.
 */
export const BAY = { width: 2.5, length: 5 } as const;
export const AISLE = { width: 6 } as const;

export function estimateBays(
  widthM: number,
  lengthM: number,
  landscapingFraction: number
): number {
  return solveParking({ widthM, lengthM }, { landscapingFraction }).summary
    .totalBays;
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
