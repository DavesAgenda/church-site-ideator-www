import { describe, it, expect } from "vitest";
import { isPlacement, typePlacementColour } from "./placements";

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
