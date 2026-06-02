/**
 * Pure 2D rotation helpers. Used by the BayGrid renderer (which applies
 * theta to the placement's local coordinate system before projecting to
 * leaflet layer points) and the RotationHandle (which computes a new
 * theta from a screen-space drag).
 *
 * Convention: theta is in DEGREES, positive = counter-clockwise in a
 * standard math y-up frame. The renderer's screen y goes DOWN, so the
 * visual rotation feels "flipped" relative to a CAD program — that's
 * expected and matches SVG's `rotate()` semantics (positive y-down is
 * clockwise visually). Tests assert math-frame behaviour, not visual.
 */

export interface Point {
  x: number;
  y: number;
}

/**
 * Rotate point (x, y) about the pivot (cx, cy) by thetaDeg degrees.
 *
 *   dx' = dx * cosθ - dy * sinθ
 *   dy' = dx * sinθ + dy * cosθ
 *
 *   x' = cx + dx'
 *   y' = cy + dy'
 */
export function rotatePoint(
  x: number,
  y: number,
  cx: number,
  cy: number,
  thetaDeg: number
): Point {
  const theta = (thetaDeg * Math.PI) / 180;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const dx = x - cx;
  const dy = y - cy;
  return {
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos,
  };
}

/**
 * Build an SVG `transform="rotate(theta cx cy)"` attribute string.
 * Handles the 0° case as an empty string so the renderer can use the
 * attribute unconditionally without paying the cost of a no-op rotate.
 */
export function svgRotateTransform(thetaDeg: number, cx: number, cy: number): string {
  // Treat "essentially zero" as identity to avoid floating-point noise
  // in the rendered transform attribute. ±0.0001° is well below visual
  // perception for bay grids.
  if (Math.abs(thetaDeg) < 1e-4) return "";
  // SVG accepts floats; keep two decimals to keep the DOM tidy.
  const theta = Number.isInteger(thetaDeg) ? thetaDeg.toString() : thetaDeg.toFixed(2);
  return `rotate(${theta} ${cx} ${cy})`;
}

/**
 * Given a drag in screen space, return the new theta in degrees.
 *
 * The user grabbed a handle at startScreen and is dragging the pointer
 * (or finger) to currentScreen. The placement centroid is at
 * startCentroid in screen space. We compute the angle from centroid to
 * the pointer at both moments, and return:
 *
 *   newTheta = startTheta + (currentAngle - startAngle)
 *
 * Result is normalised to the (-180, 180] range so we don't drift to
 * 1000° after a few full spins.
 *
 * The function is symmetric: passing the same start/current should give
 * back startTheta. Passing a 90° clockwise drag gives newTheta =
 * startTheta - 90 (because screen-y is positive-down, atan2 returns
 * clockwise-positive, and we subtract).
 */
export function computeDeltaTheta(
  startScreen: Point,
  startCentroid: Point,
  currentScreen: Point,
  currentCentroid: Point,
  startTheta: number
): number {
  const startAngle = Math.atan2(
    startScreen.y - startCentroid.y,
    startScreen.x - startCentroid.x
  );
  const currentAngle = Math.atan2(
    currentScreen.y - currentCentroid.y,
    currentScreen.x - currentCentroid.x
  );
  // The pointer moves clockwise on screen, which atan2 reports as a
  // DECREASING angle (because y is positive-down). So a clockwise drag
  // should DECREASE the placement's theta. We therefore subtract.
  const newTheta = startTheta - (currentAngle - startAngle) * (180 / Math.PI);
  return normaliseDegrees(newTheta);
}

/**
 * Wrap an angle in degrees into the (-180, 180] range.
 */
export function normaliseDegrees(deg: number): number {
  // Use remainder to wrap, then shift into the desired range.
  const wrapped = ((deg + 180) % 360 + 360) % 360 - 180;
  return wrapped === -180 ? 180 : wrapped;
}

/**
 * Result of converting a (lat, lng) AABB into the four corners of its
 * rotated rectangle, in `[lat, lng]` pairs suitable for `L.polygon()`.
 *
 * Layout of the four corners (looking down at the page, north up):
 *
 *   [0] NW   [1] NE
 *   [2] SW   [3] SE
 */
export type RotatedCorners = [[number, number], [number, number], [number, number], [number, number]];

/**
 * Given a PlacementBounds (AABB in lat/lng) and a rotation in degrees,
 * return the four lat/lng corners of the rectangle after rotation
 * about its centre.
 *
 * The rectangle's local axes are aligned to true north/east:
 *   - "width" runs along the east axis (cosine-of-lat scaled)
 *   - "length" runs along the north axis
 * After rotation by thetaDeg, each of the four corners is
 * `rotatePoint`d about the AABB centre, then converted back to lat/lng
 * using the same flat-earth conversion factor.
 */
export function rotatedPolygonLatLngs(
  bounds: { south: number; west: number; north: number; east: number },
  thetaDeg: number
): RotatedCorners {
  if (!Number.isFinite(thetaDeg) || Math.abs(thetaDeg % 360) < 1e-4) {
    // Identity: rectangle is axis-aligned; return corners in NW, NE,
    // SW, SE order so consumers can assume rotation always produces 4
    // points in the same layout.
    return [
      [bounds.north, bounds.west],
      [bounds.north, bounds.east],
      [bounds.south, bounds.west],
      [bounds.south, bounds.east],
    ];
  }
  // 1. Compute the AABB centre in lat/lng.
  const cLat = (bounds.north + bounds.south) / 2;
  const cLng = (bounds.east + bounds.west) / 2;
  // 2. Compute the half-width in metres (along the east axis) and the
  // half-length in metres (along the north axis).
  const halfWM = haversineMetres(cLat, cLng, cLat, bounds.east);
  const halfLM = haversineMetres(cLat, cLng, bounds.north, cLng);
  // 3. Local metre-frame corners (NW, NE, SW, SE) about the centre.
  //    Local axes: x = east, y = north (so y-up in metres).
  const localCorners: [number, number][] = [
    [-halfWM, halfLM],  // NW
    [ halfWM, halfLM],  // NE
    [-halfWM, -halfLM], // SW
    [ halfWM, -halfLM], // SE
  ];
  // 4. Rotate each corner in metre-frame.
  const rotated = localCorners.map(([x, y]) =>
    rotatePoint(x, y, 0, 0, thetaDeg)
  );
  // 5. Convert each rotated metre delta back to lat/lng.
  //    delta_lat = -delta_y_metres / 111320   (y-up in metres is north-up)
  //    delta_lng = delta_x_metres / (111320 · cos(cLat))
  const cosLat = Math.cos((cLat * Math.PI) / 180);
  const toLng = (xM: number) => cLng + xM / (111_320 * cosLat);
  const toLat = (yM: number) => cLat - yM / 111_320;
  return rotated.map((p) => [toLat(p.y), toLng(p.x)]) as RotatedCorners;
}

/**
 * Local haversine in metres between two lat/lng points. Mirrors the
 * helper in lib/placements.ts so this file stays self-contained.
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
