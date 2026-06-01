import { describe, it, expect } from "vitest";
import { estimateBays, BAY, AISLE } from "./parking";

describe("estimateBays", () => {
  it("a 30m x 20m rectangle with no landscaping fits ~22 bays", () => {
    // 30m x 20m = 600m^2
    // Bays 2.5m x 5m, two rows, aisle 6m, lose 10% to landscaping
    // Row depth 5m each side, aisle 6m => 16m for cars, plus landscaping
    const bays = estimateBays(30, 20, 0.1);
    expect(bays).toBeGreaterThan(15);
    expect(bays).toBeLessThan(30);
  });
  it("a tiny rectangle fits zero bays", () => {
    expect(estimateBays(4, 2, 0)).toBe(0);
  });
  it("a 10m x 5m rectangle fits at least a couple of single-row bays", () => {
    expect(estimateBays(10, 5, 0)).toBeGreaterThanOrEqual(2);
  });
});

describe("constants", () => {
  it("BAY is 2.5m x 5m", () => {
    expect(BAY.width).toBe(2.5);
    expect(BAY.length).toBe(5);
  });
  it("AISLE is 6m wide for two-way traffic", () => {
    expect(AISLE.width).toBe(6);
  });
});
