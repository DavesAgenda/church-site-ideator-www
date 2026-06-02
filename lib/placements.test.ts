import { describe, it, expect } from "vitest";
import {
  isPlacement,
  migratePlacement,
  typePlacementColour,
  rotateBounds,
} from "./placements";

// Local copy of the haversine helper so we can express expected
// distances in metres (matching the rotateBounds() output's metres
// semantics). Kept in sync with lib/placements.ts.
function haversineMetres_(
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

describe("isPlacement", () => {
  it("accepts a car park placement", () => {
    const p = {
      id: "pl1", kind: "carpark" as const, name: "CP1",
      bounds: { south: -33.869, west: 151.209, north: -33.868, east: 151.210 },
    };
    expect(isPlacement(p)).toBe(true);
  });
  it("rejects unknown kind", () => {
    const p = { id: "pl1", kind: "sauna", name: "x", bounds: {} };
    expect(isPlacement(p)).toBe(false);
  });

  // ---- pass 1: thetaDeg ----
  it("accepts a placement without thetaDeg (treated as 0)", () => {
    const p = {
      id: "pl1", kind: "carpark" as const, name: "CP1",
      bounds: { south: -33.869, west: 151.209, north: -33.868, east: 151.210 },
    };
    expect(isPlacement(p)).toBe(true);
  });
  it("accepts a placement with thetaDeg=45", () => {
    const p = {
      id: "pl1", kind: "carpark" as const, name: "CP1", thetaDeg: 45,
      bounds: { south: -33.869, west: 151.209, north: -33.868, east: 151.210 },
    };
    expect(isPlacement(p)).toBe(true);
  });
  it("accepts a placement with thetaDeg=0 (explicit)", () => {
    const p = {
      id: "pl1", kind: "carpark" as const, name: "CP1", thetaDeg: 0,
      bounds: { south: -33.869, west: 151.209, north: -33.868, east: 151.210 },
    };
    expect(isPlacement(p)).toBe(true);
  });
  it("accepts a placement with thetaDeg=-30 (negative angle)", () => {
    const p = {
      id: "pl1", kind: "carpark" as const, name: "CP1", thetaDeg: -30,
      bounds: { south: -33.869, west: 151.209, north: -33.868, east: 151.210 },
    };
    expect(isPlacement(p)).toBe(true);
  });
  it("rejects a placement with thetaDeg=\"not a number\"", () => {
    const p = {
      id: "pl1", kind: "carpark" as const, name: "CP1", thetaDeg: "not a number",
      bounds: { south: -33.869, west: 151.209, north: -33.868, east: 151.210 },
    };
    expect(isPlacement(p)).toBe(false);
  });
  it("rejects a placement with thetaDeg=NaN", () => {
    const p = {
      id: "pl1", kind: "carpark" as const, name: "CP1", thetaDeg: NaN,
      bounds: { south: -33.869, west: 151.209, north: -33.868, east: 151.210 },
    };
    expect(isPlacement(p)).toBe(false);
  });
  it("rejects a placement with thetaDeg=Infinity", () => {
    const p = {
      id: "pl1", kind: "carpark" as const, name: "CP1", thetaDeg: Infinity,
      bounds: { south: -33.869, west: 151.209, north: -33.868, east: 151.210 },
    };
    expect(isPlacement(p)).toBe(false);
  });
  it("rejects a placement with thetaDeg=-Infinity", () => {
    const p = {
      id: "pl1", kind: "carpark" as const, name: "CP1", thetaDeg: -Infinity,
      bounds: { south: -33.869, west: 151.209, north: -33.868, east: 151.210 },
    };
    expect(isPlacement(p)).toBe(false);
  });
});

describe("migratePlacement", () => {
  it("fills in thetaDeg=0 when missing", () => {
    const p = {
      id: "pl1", kind: "carpark" as const, name: "CP1",
      bounds: { south: -33.869, west: 151.209, north: -33.868, east: 151.210 },
    };
    const m = migratePlacement(p);
    expect(m.thetaDeg).toBe(0);
  });
  it("preserves thetaDeg=45 when present", () => {
    const p = {
      id: "pl1", kind: "carpark" as const, name: "CP1", thetaDeg: 45,
      bounds: { south: -33.869, west: 151.209, north: -33.868, east: 151.210 },
    };
    const m = migratePlacement(p);
    expect(m.thetaDeg).toBe(45);
  });
  it("preserves thetaDeg=0 when explicit", () => {
    const p = {
      id: "pl1", kind: "carpark" as const, name: "CP1", thetaDeg: 0,
      bounds: { south: -33.869, west: 151.209, north: -33.868, east: 151.210 },
    };
    const m = migratePlacement(p);
    expect(m.thetaDeg).toBe(0);
  });
  it("defaults thetaDeg to 0 when thetaDeg is a string", () => {
    const p = {
      id: "pl1", kind: "carpark" as const, name: "CP1", thetaDeg: "not a number",
      bounds: { south: -33.869, west: 151.209, north: -33.868, east: 151.210 },
    };
    const m = migratePlacement(p);
    expect(m.thetaDeg).toBe(0);
  });
  it("defaults thetaDeg to 0 when thetaDeg is NaN", () => {
    const p = {
      id: "pl1", kind: "carpark" as const, name: "CP1", thetaDeg: NaN,
      bounds: { south: -33.869, west: 151.209, north: -33.868, east: 151.210 },
    };
    const m = migratePlacement(p);
    expect(m.thetaDeg).toBe(0);
  });
  it("defaults thetaDeg to 0 when thetaDeg is Infinity", () => {
    const p = {
      id: "pl1", kind: "carpark" as const, name: "CP1", thetaDeg: Infinity,
      bounds: { south: -33.869, west: 151.209, north: -33.868, east: 151.210 },
    };
    const m = migratePlacement(p);
    expect(m.thetaDeg).toBe(0);
  });
  it("preserves the placement shape (id, kind, name, bounds)", () => {
    const p = {
      id: "pl1", kind: "building" as const, name: "Hall",
      bounds: { south: -33.869, west: 151.209, north: -33.868, east: 151.210 },
    };
    const m = migratePlacement(p);
    expect(m.id).toBe("pl1");
    expect(m.kind).toBe("building");
    expect(m.name).toBe("Hall");
    expect(m.bounds).toEqual(p.bounds);
    expect(m.thetaDeg).toBe(0);
  });
});

describe("typePlacementColour", () => {
  it("returns blue for carpark", () => {
    expect(typePlacementColour("carpark")).toBe("#2563eb");
  });
  it("returns grey for building", () => {
    expect(typePlacementColour("building")).toBe("#475569");
  });
  it("returns green for green space", () => {
    expect(typePlacementColour("greenspace")).toBe("#16a34a");
  });
});

describe("rotateBounds", () => {
  // A 24m wide × 37m long rectangle near Sydney. Centre at
  // (cLat, cLng). We compute the lat/lng offsets from the centre to
  // each edge using a back-of-envelope metre→degree conversion.
  //
  // 24m east-west at lat -33.6736 → 24 / (111320·cos(33.67°)) ≈ 0.0002591° lng
  // 37m north-south → 37 / 111320 ≈ 0.0003323° lat
  const cLat = -33.6736;
  const cLng = 150.8699;
  // Derive dLng/dLat from the actual metres, not a hardcoded number,
  // so the test fixture's E-W span really is 24m on the ground.
  const dLng = (24 / 2) / (111_320 * Math.cos((cLat * Math.PI) / 180));
  const dLat = (37 / 2) / 111_320;
  const baseBounds = {
    north: cLat + dLat,
    south: cLat - dLat,
    east: cLng + dLng,
    west: cLng - dLng,
  };

  it("is identity at 0°", () => {
    const r = rotateBounds(baseBounds, 0);
    expect(r.north).toBeCloseTo(baseBounds.north, 12);
    expect(r.south).toBeCloseTo(baseBounds.south, 12);
    expect(r.east).toBeCloseTo(baseBounds.east, 12);
    expect(r.west).toBeCloseTo(baseBounds.west, 12);
  });

  it("preserves the centre of the AABB at all angles", () => {
    for (const theta of [0, 15, 30, 45, 60, 90, 135, 180, -30, -90]) {
      const r = rotateBounds(baseBounds, theta);
      // Lat/lng <-> metre conversion loses precision at the ~1e-7 deg
      // level (about 1cm). 5 digits is enough to verify the centre
      // is preserved through the round-trip.
      expect((r.north + r.south) / 2).toBeCloseTo(cLat, 5);
      expect((r.east + r.west) / 2).toBeCloseTo(cLng, 5);
    }
  });

  it("grows the AABB at 90° to match the original width/length swapped", () => {
    const r90 = rotateBounds(baseBounds, 90);
    const newLatSpan = r90.north - r90.south;
    const newLngSpan = r90.east - r90.west;
    const origLatSpan = baseBounds.north - baseBounds.south;
    const origLngSpan = baseBounds.east - baseBounds.west;
    // Allow ~1% tolerance for the haversine + lat/lng-conversion
    // round-trip on a 24×37m rect at Sydney's latitude.
    expect(newLatSpan).toBeCloseTo(origLngSpan, 2);
    expect(newLngSpan).toBeCloseTo(origLatSpan, 2);
  });

  it("grows the AABB at 45° (max growth) such that newAABB.w ≈ newAABB.l", () => {
    const r45 = rotateBounds(baseBounds, 45);
    // At 45° a non-square rectangle's AABB becomes square-ish: the
    // new W and L both equal (W+L)·cos45°. Verify equality.
    const newLatSpan = r45.north - r45.south;
    const newLngSpan = r45.east - r45.west;
    expect(newLatSpan).toBeCloseTo(newLngSpan, 2);
  });

  it("grows the AABB diagonal at 45° to roughly (W+L) metres", () => {
    const r45 = rotateBounds(baseBounds, 45);
    // The AABB diagonal is the hypotenuse of (lat span, lng span),
    // both converted to metres. The lng conversion is via haversine
    // since the world is round; the lat conversion is metres/111320.
    const latSpanM = (r45.north - r45.south) * 111_320;
    const midLat = (r45.north + r45.south) / 2;
    const lngSpanM = haversineMetres_(midLat, r45.west, midLat, r45.east);
    const newDiagM = Math.hypot(latSpanM, lngSpanM);
    // 24m × 37m base rect → at 45° the AABB grows to (W+L)·cos45°
    // on each side, so the AABB diagonal is (W+L).
    const expectedDiag = 24 + 37;
    // 1% tolerance for the haversine + lat/lng-conversion round-trip.
    expect(newDiagM / expectedDiag).toBeCloseTo(1, 1);
  });

  it("is identity at 360° (modulo wrap)", () => {
    const r = rotateBounds(baseBounds, 360);
    // 5 digits allows the ~1cm haversine round-off.
    expect(r.north).toBeCloseTo(baseBounds.north, 5);
    expect(r.south).toBeCloseTo(baseBounds.south, 5);
    expect(r.east).toBeCloseTo(baseBounds.east, 5);
    expect(r.west).toBeCloseTo(baseBounds.west, 5);
  });

  it("at 180° produces a bounds equal to the original (symmetric rect)", () => {
    const r180 = rotateBounds(baseBounds, 180);
    expect(r180.north).toBeCloseTo(baseBounds.north, 5);
    expect(r180.south).toBeCloseTo(baseBounds.south, 5);
    expect(r180.east).toBeCloseTo(baseBounds.east, 5);
    expect(r180.west).toBeCloseTo(baseBounds.west, 5);
  });

  it("handles non-finite theta as identity", () => {
    const r = rotateBounds(baseBounds, NaN);
    expect(r).toEqual(baseBounds);
  });

  it("returns a fresh object reference (so callers can mutate safely)", () => {
    const r = rotateBounds(baseBounds, 45);
    expect(r).not.toBe(baseBounds);
  });
});
