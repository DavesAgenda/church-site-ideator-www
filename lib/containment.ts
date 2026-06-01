import * as turf from "@turf/turf";
import type { LinearRing } from "./types";
import type { PlacementBounds } from "./placements";

function ringToPolygon(ring: LinearRing) {
  return turf.polygon([ring]);
}

export function rectFullyInsideRing(b: PlacementBounds, ring: LinearRing): boolean {
  if (ring.length < 4) return false;
  const poly = ringToPolygon(ring);
  const corners: [number, number][] = [
    [b.west, b.south], [b.east, b.south],
    [b.east, b.north], [b.west, b.north],
  ];
  return corners.every((c) => turf.booleanPointInPolygon(turf.point(c), poly));
}

export function rectOutsideRing(b: PlacementBounds, ring: LinearRing): boolean {
  if (ring.length < 4) return true; // no ring => treat as "outside" to avoid false negative
  const poly = ringToPolygon(ring);
  const corners: [number, number][] = [
    [b.west, b.south], [b.east, b.south],
    [b.east, b.north], [b.west, b.north],
  ];
  return corners.every((c) => !turf.booleanPointInPolygon(turf.point(c), poly));
}
