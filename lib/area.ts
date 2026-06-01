import * as turf from "@turf/turf";
import type { LinearRing } from "./types";

export function ringAreaSquareMetres(ring: LinearRing): number {
  if (ring.length < 4) return 0;
  const poly = turf.polygon([ring]);
  return turf.area(poly); // returns m^2
}
