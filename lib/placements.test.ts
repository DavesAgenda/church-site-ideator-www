import { describe, it, expect } from "vitest";
import { isPlacement, migratePlacement, typePlacementColour } from "./placements";

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
