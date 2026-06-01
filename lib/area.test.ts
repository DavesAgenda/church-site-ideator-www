import { describe, it, expect } from "vitest";
import { ringAreaSquareMetres } from "./area";

describe("ringAreaSquareMetres", () => {
  it("returns a small positive area for a tiny square in Sydney", () => {
    const ring: [number, number][] = [
      [151.2093, -33.8688],
      [151.2103, -33.8688],
      [151.2103, -33.8698],
      [151.2093, -33.8698],
      [151.2093, -33.8688],
    ];
    const a = ringAreaSquareMetres(ring);
    // ~92m x ~111m ~= 10,200 m^2 (we just want positive and in a sensible range)
    expect(a).toBeGreaterThan(9_000);
    expect(a).toBeLessThan(13_000);
  });
  it("returns 0 for a degenerate ring", () => {
    const ring: [number, number][] = [[1, 1], [1, 1], [1, 1]];
    expect(ringAreaSquareMetres(ring)).toBe(0);
  });
});
