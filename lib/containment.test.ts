import { describe, it, expect } from "vitest";
import { rectFullyInsideRing, rectOutsideRing } from "./containment";

const square: [number, number][] = [
  [0, 0], [10, 0], [10, 10], [0, 10], [0, 0],
];

describe("rectFullyInsideRing", () => {
  it("inside rectangle is fully inside", () => {
    expect(rectFullyInsideRing({ south: 2, west: 2, north: 4, east: 4 }, square)).toBe(true);
  });
  it("rectangle straddling boundary is not fully inside", () => {
    expect(rectFullyInsideRing({ south: -1, west: 2, north: 4, east: 4 }, square)).toBe(false);
  });
});

describe("rectOutsideRing", () => {
  it("rectangle fully inside is not outside", () => {
    expect(rectOutsideRing({ south: 2, west: 2, north: 4, east: 4 }, square)).toBe(false);
  });
  it("rectangle far away is outside", () => {
    expect(rectOutsideRing({ south: 20, west: 20, north: 22, east: 22 }, square)).toBe(true);
  });
});
