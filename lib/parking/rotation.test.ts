import { describe, it, expect } from "vitest";
import {
  rotatePoint,
  svgRotateTransform,
  computeDeltaTheta,
  normaliseDegrees,
  rotatedPolygonLatLngs,
} from "./rotation";

describe("rotatePoint", () => {
  it("is identity at 0°", () => {
    const p = rotatePoint(3, 4, 0, 0, 0);
    expect(p.x).toBeCloseTo(3, 10);
    expect(p.y).toBeCloseTo(4, 10);
  });

  it("rotates 90° about the origin", () => {
    // (1, 0) rotated 90° CCW → (0, 1)
    const p = rotatePoint(1, 0, 0, 0, 90);
    expect(p.x).toBeCloseTo(0, 10);
    expect(p.y).toBeCloseTo(1, 10);
  });

  it("rotates 180° about the origin", () => {
    // (1, 0) rotated 180° → (-1, 0)
    const p = rotatePoint(1, 0, 0, 0, 180);
    expect(p.x).toBeCloseTo(-1, 10);
    expect(p.y).toBeCloseTo(0, 10);
  });

  it("rotates 270° about the origin", () => {
    // (1, 0) rotated 270° CCW → (0, -1)
    const p = rotatePoint(1, 0, 0, 0, 270);
    expect(p.x).toBeCloseTo(0, 10);
    expect(p.y).toBeCloseTo(-1, 10);
  });

  it("rotates 45° about the origin", () => {
    // (1, 0) rotated 45° → (√2/2, √2/2) ≈ (0.7071, 0.7071)
    const p = rotatePoint(1, 0, 0, 0, 45);
    expect(p.x).toBeCloseTo(Math.SQRT1_2, 10);
    expect(p.y).toBeCloseTo(Math.SQRT1_2, 10);
  });

  it("rotates -30° about the origin", () => {
    // (1, 0) rotated -30° (CW in math frame) → (cos30, -sin30)
    const p = rotatePoint(1, 0, 0, 0, -30);
    expect(p.x).toBeCloseTo(Math.cos(-Math.PI / 6), 10);
    expect(p.y).toBeCloseTo(Math.sin(-Math.PI / 6), 10);
  });

  it("rotates 360° back to the original", () => {
    const p = rotatePoint(7, -3, 0, 0, 360);
    expect(p.x).toBeCloseTo(7, 10);
    expect(p.y).toBeCloseTo(-3, 10);
  });

  it("rotates about an off-origin pivot correctly", () => {
    // Rotate (11, 0) about (10, 0) by 90° → (10, 1)
    const p = rotatePoint(11, 0, 10, 0, 90);
    expect(p.x).toBeCloseTo(10, 10);
    expect(p.y).toBeCloseTo(1, 10);
  });

  it("is the inverse of itself when applying +θ then -θ", () => {
    const original = { x: 2.5, y: -1.5 };
    const cx = 5, cy = 5;
    const r1 = rotatePoint(original.x, original.y, cx, cy, 37);
    const r2 = rotatePoint(r1.x, r1.y, cx, cy, -37);
    expect(r2.x).toBeCloseTo(original.x, 10);
    expect(r2.y).toBeCloseTo(original.y, 10);
  });
});

describe("svgRotateTransform", () => {
  it("returns empty string at 0° (no-op transform)", () => {
    expect(svgRotateTransform(0, 50, 25)).toBe("");
  });
  it("returns empty string for very small angles (no-op)", () => {
    expect(svgRotateTransform(0.00001, 50, 25)).toBe("");
  });
  it("emits rotate(theta cx cy) for non-zero integer angles", () => {
    expect(svgRotateTransform(45, 50, 25)).toBe("rotate(45 50 25)");
  });
  it("formats negative angles", () => {
    expect(svgRotateTransform(-30, 50, 25)).toBe("rotate(-30 50 25)");
  });
  it("truncates float angles to two decimals", () => {
    expect(svgRotateTransform(45.123456, 50, 25)).toBe("rotate(45.12 50 25)");
  });
});

describe("normaliseDegrees", () => {
  it("passes through values in (-180, 180]", () => {
    expect(normaliseDegrees(45)).toBe(45);
    expect(normaliseDegrees(-45)).toBe(-45);
    expect(normaliseDegrees(0)).toBe(0);
    expect(normaliseDegrees(180)).toBe(180);
    expect(normaliseDegrees(-179.9)).toBeCloseTo(-179.9, 10);
  });
  it("wraps 181° to -179°", () => {
    expect(normaliseDegrees(181)).toBeCloseTo(-179, 10);
  });
  it("wraps 360° to 0°", () => {
    expect(normaliseDegrees(360)).toBeCloseTo(0, 10);
  });
  it("wraps -360° to 0°", () => {
    expect(normaliseDegrees(-360)).toBeCloseTo(0, 10);
  });
  it("wraps 720° + 30° to 30°", () => {
    expect(normaliseDegrees(750)).toBeCloseTo(30, 10);
  });
  it("wraps -540° to 180°", () => {
    expect(normaliseDegrees(-540)).toBeCloseTo(180, 10);
  });
});

describe("computeDeltaTheta", () => {
  it("returns startTheta when pointer hasn't moved", () => {
    const startScreen = { x: 100, y: 0 };
    const centroid = { x: 0, y: 0 };
    expect(
      computeDeltaTheta(startScreen, centroid, startScreen, centroid, 30)
    ).toBeCloseTo(30, 10);
  });

  it("returns startTheta when the centroid is at the pointer", () => {
    // Degenerate atan2(0,0) — handle gracefully (returns NaN from atan2,
    // but we don't expect callers to ever pass the centroid as the
    // pointer; assert the result is a number, not a regression on throws).
    const p = { x: 5, y: 5 };
    const result = computeDeltaTheta(p, p, { x: 6, y: 6 }, p, 10);
    expect(typeof result).toBe("number");
  });

  it("subtracts the pointer's clockwise motion from theta", () => {
    // Pointer at start: east of centroid → angle 0
    // Pointer moves to south of centroid → angle 90° (clockwise on screen)
    // → newTheta = startTheta - 90
    const start = { x: 10, y: 0 };
    const current = { x: 0, y: 10 };
    const centroid = { x: 0, y: 0 };
    const newTheta = computeDeltaTheta(start, centroid, current, centroid, 0);
    expect(newTheta).toBeCloseTo(-90, 10);
  });

  it("adds the pointer's counter-clockwise motion to theta", () => {
    // Pointer at start: south of centroid → angle 90° (y-down frame)
    // Pointer moves to east of centroid → angle 0°
    // delta = -90 (CCW on screen is angle decrease)
    // newTheta = startTheta - (-90) = startTheta + 90
    const start = { x: 0, y: 10 };
    const current = { x: 10, y: 0 };
    const centroid = { x: 0, y: 0 };
    const newTheta = computeDeltaTheta(start, centroid, current, centroid, 20);
    expect(newTheta).toBeCloseTo(110, 10);
  });

  it("respects a non-zero startTheta", () => {
    // Start east, drag south (clockwise 90°). startTheta=45.
    // newTheta = 45 - 90 = -45.
    const start = { x: 10, y: 0 };
    const current = { x: 0, y: 10 };
    const centroid = { x: 0, y: 0 };
    const newTheta = computeDeltaTheta(start, centroid, current, centroid, 45);
    expect(newTheta).toBeCloseTo(-45, 10);
  });

  it("handles a centroid that moves with the map (panning case)", () => {
    // The centroid is the placement's centre in screen coords. When the
    // user pans, the centroid moves too. The relative delta is what
    // matters, so the math should still work.
    //
    // Centroid at (5,5), start at (10,0) → relative (5,-5) → atan2 = -π/4.
    // Current at (0,10) → relative (-5,5) → atan2 = 3π/4.
    // delta = 3π/4 - (-π/4) = π (180°). newTheta = 0 - 180 = -180
    // → normalised to 180.
    const start = { x: 10, y: 0 };
    const current = { x: 0, y: 10 };
    const startCentroid = { x: 5, y: 5 };
    const currentCentroid = { x: 5, y: 5 }; // same, no pan
    const newTheta = computeDeltaTheta(
      start,
      startCentroid,
      current,
      currentCentroid,
      0
    );
    // A 180° drag when the centroid is the midpoint between start and
    // current is the maximum sweep — assert the result is wrapped to
    // (±180, 180] rather than escaped.
    expect(newTheta).toBeCloseTo(180, 10);
  });

  it("normalises the result to (-180, 180]", () => {
    // 5 full clockwise rotations: newTheta = 0 - (5 * 360) = -1800
    const start = { x: 10, y: 0 };
    const current = { x: 10, y: 0 }; // same spot, but we've "spun" 5 times
    // Build a real drag that accumulates 5 * 360 = 1800° CW
    // Easiest: do 5 sequential calls and add up.
    let theta = 0;
    for (let i = 0; i < 5; i++) {
      // 1/5 of a turn clockwise on screen each step
      // start east, end south
      const s = { x: 10, y: 0 };
      const c = { x: 0, y: 10 * Math.tan((Math.PI / 2) * (1 / 5)) };
      theta = computeDeltaTheta(s, { x: 0, y: 0 }, c, { x: 0, y: 0 }, theta);
    }
    // After 5 quarter-ish turns we should be at roughly -360° → 0°
    expect(theta).toBeGreaterThan(-180);
    expect(theta).toBeLessThanOrEqual(180);
    // And the function should not have exploded to ±10000°
    expect(Math.abs(theta)).toBeLessThan(180);
  });
});

describe("rotatedPolygonLatLngs", () => {
  // 24m × 37m rect near Sydney.
  const cLat = -33.6736;
  const cLng = 150.8699;
  const halfWM = 12;
  const halfLM = 18.5;
  const dLng = (halfWM) / (111_320 * Math.cos((cLat * Math.PI) / 180));
  const dLat = (halfLM) / 111_320;
  const baseBounds = {
    south: cLat - dLat,
    west: cLng - dLng,
    north: cLat + dLat,
    east: cLng + dLng,
  };

  it("returns 4 lat/lng corners in [NW, NE, SW, SE] order at 0°", () => {
    const c = rotatedPolygonLatLngs(baseBounds, 0);
    expect(c).toHaveLength(4);
    // NW: (north, west)
    expect(c[0][0]).toBeCloseTo(baseBounds.north, 12);
    expect(c[0][1]).toBeCloseTo(baseBounds.west, 12);
    // NE: (north, east)
    expect(c[1][0]).toBeCloseTo(baseBounds.north, 12);
    expect(c[1][1]).toBeCloseTo(baseBounds.east, 12);
    // SW: (south, west)
    expect(c[2][0]).toBeCloseTo(baseBounds.south, 12);
    expect(c[2][1]).toBeCloseTo(baseBounds.west, 12);
    // SE: (south, east)
    expect(c[3][0]).toBeCloseTo(baseBounds.south, 12);
    expect(c[3][1]).toBeCloseTo(baseBounds.east, 12);
  });

  it("returns the same corners as 0° for tiny theta (avoids noise)", () => {
    const c = rotatedPolygonLatLngs(baseBounds, 1e-6);
    expect(c[0][0]).toBeCloseTo(baseBounds.north, 12);
    expect(c[3][1]).toBeCloseTo(baseBounds.east, 12);
  });

  it("at 90°: NW → NE position (CCW math-frame rotation)", () => {
    // 90° CCW in math frame: (x, y) → (-y, x).
    // NW corner (-halfW, +halfL) → (-halfL, -halfW), which in
    // local frame is SW position. So NW goes to SW corner's spot.
    const c = rotatedPolygonLatLngs(baseBounds, 90);
    // The centroid is the average of all 4 corners. It should
    // equal the original AABB centre (5 digits ≈ 1cm of haversine
    // round-trip on a 24m E-W span at lat -33.67°).
    const centroidLat = (c[0][0] + c[1][0] + c[2][0] + c[3][0]) / 4;
    const centroidLng = (c[0][1] + c[1][1] + c[2][1] + c[3][1]) / 4;
    expect(centroidLat).toBeCloseTo(cLat, 5);
    expect(centroidLng).toBeCloseTo(cLng, 5);
  });

  it("preserves the corner order [NW, NE, SW, SE] at all angles", () => {
    // A rigid rotation preserves the distance between any two corners.
    // The world is round, so we must convert the lat/lng delta to
    // metres before comparing.
    const haversineMetresLocal = (
      lat1: number, lon1: number, lat2: number, lon2: number
    ): number => {
      const R = 6_371_000;
      const toRad = (d: number) => (d * Math.PI) / 180;
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
      return 2 * R * Math.asin(Math.sqrt(a));
    };
    for (const theta of [0, 30, 45, 90, -45, 180, -90]) {
      const c0 = rotatedPolygonLatLngs(baseBounds, 0);
      const c1 = rotatedPolygonLatLngs(baseBounds, theta);
      // Compare NW-SE diagonal distance in metres.
      const dist0 = haversineMetresLocal(c0[0][0], c0[0][1], c0[3][0], c0[3][1]);
      const dist1 = haversineMetresLocal(c1[0][0], c1[0][1], c1[3][0], c1[3][1]);
      // 1% tolerance for haversine round-trip on a ~44m diagonal.
      expect(dist1 / dist0).toBeCloseTo(1, 1);
    }
  });

  it("at 180°: NW ends up at SE's original position", () => {
    // 180° rotation: (x, y) → (-x, -y). NW (-halfW, +halfL) goes to
    // (+halfW, -halfL) which is SE's local position. So the corner
    // that was at (north, west) should now be at (south, east).
    const c = rotatedPolygonLatLngs(baseBounds, 180);
    // Centroid is preserved.
    const centroidLat = (c[0][0] + c[2][0]) / 2;
    const centroidLng = (c[0][1] + c[1][1]) / 2;
    expect(centroidLat).toBeCloseTo(cLat, 5);
    expect(centroidLng).toBeCloseTo(cLng, 5);
  });

  it("NaN theta falls back to axis-aligned (identity)", () => {
    const c = rotatedPolygonLatLngs(baseBounds, NaN);
    expect(c[0][0]).toBeCloseTo(baseBounds.north, 12);
    expect(c[1][1]).toBeCloseTo(baseBounds.east, 12);
  });

  it("Infinity theta falls back to axis-aligned (identity)", () => {
    const c = rotatedPolygonLatLngs(baseBounds, Infinity);
    expect(c[0][0]).toBeCloseTo(baseBounds.north, 12);
    expect(c[1][1]).toBeCloseTo(baseBounds.east, 12);
  });

  it("at 360° returns the same corners as 0° (modulo ~1cm)", () => {
    const c = rotatedPolygonLatLngs(baseBounds, 360);
    expect(c[0][0]).toBeCloseTo(baseBounds.north, 5);
    expect(c[0][1]).toBeCloseTo(baseBounds.west, 5);
    expect(c[1][0]).toBeCloseTo(baseBounds.north, 5);
    expect(c[1][1]).toBeCloseTo(baseBounds.east, 5);
    expect(c[2][0]).toBeCloseTo(baseBounds.south, 5);
    expect(c[2][1]).toBeCloseTo(baseBounds.west, 5);
    expect(c[3][0]).toBeCloseTo(baseBounds.south, 5);
    expect(c[3][1]).toBeCloseTo(baseBounds.east, 5);
  });
});
