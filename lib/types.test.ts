import { describe, it, expect } from "vitest";
import { isParcel } from "./types";

describe("isParcel", () => {
  it("accepts a valid parcel polygon", () => {
    const p = {
      id: "p1",
      name: "Church block",
      ring: [
        [151.2093, -33.8688],
        [151.2095, -33.8688],
        [151.2095, -33.8690],
        [151.2093, -33.8690],
        [151.2093, -33.8688],
      ],
    };
    expect(isParcel(p)).toBe(true);
  });
  it("rejects a parcel with fewer than 3 unique points", () => {
    const p = { id: "p1", name: "x", ring: [[1, 2], [1, 2], [1, 2]] };
    expect(isParcel(p)).toBe(false);
  });
});
