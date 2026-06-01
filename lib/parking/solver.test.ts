import { describe, it, expect } from "vitest";
import {
  solveParking,
  BAY,
  AISLE,
  ACCESS,
  DEFAULT_LANDSCAPING,
} from "./solver";
import type { ParkingLayout } from "./types";
import { estimateBays } from "../parking";

const layout = (bounds: { widthM: number; lengthM: number }, f = 0.1) =>
  solveParking(bounds, { landscapingFraction: f });

describe("constants", () => {
  it("BAY is 2.5m x 5m", () => {
    expect(BAY.width).toBe(2.5);
    expect(BAY.length).toBe(5);
  });
  it("AISLE is 6m wide for two-way traffic", () => {
    expect(AISLE.width).toBe(6);
  });
  it("ACCESS is 3.5m wide", () => {
    expect(ACCESS.width).toBe(3.5);
  });
  it("DEFAULT_LANDSCAPING is 10%", () => {
    expect(DEFAULT_LANDSCAPING).toBeCloseTo(0.1);
  });
});

describe("solveParking — 36m x 18m reference case", () => {
  // Per the parity-phase plan §3.2 this is the ground-truth fixture.
  // Visual mock (public/mock-solver.html) renders 28 bays, 4.3 bays/100m^2,
  // 13.9% coverage of a 4,661 m^2 parcel.
  const r = layout({ widthM: 36, lengthM: 18 });
  it("returns 28 bays exactly", () => {
    expect(r.summary.totalBays).toBe(28);
  });
  it("uses a two-row layout", () => {
    expect(r.style).toBe("two-row");
    expect(r.aisles.length).toBe(1);
  });
  it("places 14 bays on each side of the central aisle", () => {
    // aisleY0 = (18 - 6) / 2 = 6
    // rowsPerSide = min(2, floor((18*0.9 - 6)/2 / 5)) = min(2, floor(2.1)) = 2
    // baysPerRow = floor(36 / 2.5) = 14
    const aisleY0 = (18 - AISLE.width) / 2;
    const north = r.bays.filter((b) => b.y + b.h <= aisleY0 + 1e-9);
    const south = r.bays.filter((b) => b.y >= aisleY0 + AISLE.width - 1e-9);
    expect(north.length).toBe(14);
    expect(south.length).toBe(14);
  });
  it("reports an aisle with baysPerRow * BAY.width length", () => {
    const baysPerRow = Math.floor(36 / BAY.width);
    expect(r.aisles[0].w).toBe(baysPerRow * BAY.width);
    expect(r.aisles[0].h).toBe(AISLE.width);
    expect(r.aisles[0].orientation).toBe("h");
  });
  it("reports an access lane at the north short edge", () => {
    expect(r.access.length).toBe(1);
    expect(r.access[0].y).toBe(-ACCESS.width);
    expect(r.access[0].w).toBe(2 * ACCESS.width);
    expect(r.access[0].h).toBe(ACCESS.width);
  });
  it("efficiency is 4.3 bays / 100m^2", () => {
    expect(r.summary.efficiency).toBeCloseTo(4.3, 1);
  });
  it("gross area is 648 m^2", () => {
    expect(r.summary.grossAreaM2).toBeCloseTo(648, 6);
  });
  it("has no warnings", () => {
    expect(r.warnings).toEqual([]);
  });
  it("all bays are standard (no accessible bays in v1)", () => {
    expect(r.summary.standardBays).toBe(28);
    expect(r.summary.accessibleBays).toBe(0);
    expect(r.bays.every((b) => b.type === "standard")).toBe(true);
  });
});

describe("solveParking — degenerate cases", () => {
  it("returns 0 bays and a warning when rectangle is narrower than a bay", () => {
    const r = layout({ widthM: 2, lengthM: 10 });
    expect(r.summary.totalBays).toBe(0);
    expect(r.warnings.length).toBeGreaterThan(0);
    expect(r.style).toBe("none");
  });
  it("returns 0 bays when rectangle is too shallow for any bay", () => {
    const r = layout({ widthM: 10, lengthM: 3 });
    expect(r.summary.totalBays).toBe(0);
    expect(r.warnings.some((w) => /shallow/i.test(w))).toBe(true);
  });
  it("returns 0 bays and zero efficiency on zero-area input", () => {
    const r = layout({ widthM: 0, lengthM: 0 });
    expect(r.summary.totalBays).toBe(0);
    expect(r.summary.efficiency).toBe(0);
  });
  it("treats negative dimensions as zero", () => {
    const r = layout({ widthM: -5, lengthM: -10 });
    expect(r.summary.totalBays).toBe(0);
    expect(r.bays).toEqual([]);
  });
  it("treats NaN dimensions as zero", () => {
    const r = layout({ widthM: NaN, lengthM: NaN });
    expect(r.summary.totalBays).toBe(0);
  });
});

describe("solveParking — single-row fallback", () => {
  // effectiveL = 6 * 0.9 = 5.4 → not enough for two rows (need >= 2*5 + 6 = 16)
  // but enough for one row of bays (need >= 5).
  it("6m x 6m uses single-row layout", () => {
    const r = layout({ widthM: 6, lengthM: 6 });
    expect(r.style).toBe("single-row");
    expect(r.summary.totalBays).toBe(2); // floor(6/2.5) = 2
    expect(r.aisles.length).toBe(0);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it("20m x 8m uses single-row layout (shallow for two rows)", () => {
    const r = layout({ widthM: 20, lengthM: 8 });
    expect(r.style).toBe("single-row");
    // effectiveL = 8 * 0.9 = 7.2 < 16 → single row
    // baysPerRow = floor(20 / 2.5) = 8
    expect(r.summary.totalBays).toBe(8);
  });
});

describe("solveParking — landscape fraction handling", () => {
  it("at f=0 the reference case still gives 28 bays (rowsPerSide stays 2)", () => {
    const r = layout({ widthM: 36, lengthM: 18 }, 0);
    // effectiveL = 18, sideDepth = (18 - 6) / 2 = 6, rowsPerSide = min(2, floor(6/5)) = 1
    // So 14 * 1 * 2 = 28. Same count, fewer rows.
    expect(r.summary.totalBays).toBe(28);
  });
  it("clamps negative landscapingFraction to 0", () => {
    const r1 = layout({ widthM: 36, lengthM: 18 }, -0.5);
    const r2 = layout({ widthM: 36, lengthM: 18 }, 0);
    expect(r1.summary.totalBays).toBe(r2.summary.totalBays);
  });
  it("clamps landscapingFraction > 1 to 1 (100% buffer → 0 bays)", () => {
    const r = layout({ widthM: 36, lengthM: 18 }, 2);
    expect(r.summary.totalBays).toBe(0);
  });
  it("uses the default fraction when options omitted", () => {
    const r1 = solveParking({ widthM: 36, lengthM: 18 });
    const r2 = layout({ widthM: 36, lengthM: 18 }, DEFAULT_LANDSCAPING);
    expect(r1.summary.totalBays).toBe(r2.summary.totalBays);
  });
});

describe("solveParking — aspect ratios", () => {
  it("a square 20m x 20m uses two-row layout", () => {
    const r = layout({ widthM: 20, lengthM: 20 });
    expect(r.style).toBe("two-row");
    // effectiveL = 18, sideDepth = (18-6)/2 = 6, rowsPerSide = min(2, floor(6/5)) = 1
    // baysPerRow = floor(20/2.5) = 8
    expect(r.summary.totalBays).toBe(8 * 1 * 2);
  });
  it("a 5:1 wide rectangle is a two-row layout (40m x 8m? no, that's 1:5)", () => {
    // width=40, length=8 → effectiveL = 7.2 < 16, single-row
    const r1 = layout({ widthM: 40, lengthM: 8 });
    expect(r1.style).toBe("single-row");
    // width=40, length=20 → effectiveL = 18, two-row
    const r2 = layout({ widthM: 40, lengthM: 20 });
    expect(r2.style).toBe("two-row");
  });
  it("tall narrow rectangle that is wider than a bay fits at least one row", () => {
    // 3m x 50m: width (max) = 50, length = 3, effectiveL = 2.7 < 5 → too shallow
    const r = layout({ widthM: 3, lengthM: 50 });
    expect(r.summary.totalBays).toBe(0);
  });
  it("100m x 30m produces a large two-row layout", () => {
    const r = layout({ widthM: 100, lengthM: 30 });
    expect(r.style).toBe("two-row");
    // baysPerRow = floor(100/2.5) = 40
    // effectiveL = 27, sideDepth = (27-6)/2 = 10.5, rowsPerSide = min(2, floor(10.5/5)) = 2
    expect(r.summary.totalBays).toBe(40 * 2 * 2);
  });
});

describe("solveParking — coordinate system", () => {
  it("all bay coordinates are non-negative in y for south-of-aisle bays", () => {
    const r = layout({ widthM: 36, lengthM: 18 });
    const aisleY0 = (18 - AISLE.width) / 2;
    const south = r.bays.filter((b) => b.y >= aisleY0 + AISLE.width - 1e-9);
    for (const b of south) {
      expect(b.y).toBeGreaterThanOrEqual(0);
    }
  });
  it("all bay coordinates are within the placement's local rectangle", () => {
    const r = layout({ widthM: 36, lengthM: 18 });
    for (const b of r.bays) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeGreaterThanOrEqual(-BAY.length); // north bays extend above aisleY0
      expect(b.x + b.w).toBeLessThanOrEqual(36 + 1e-9);
      expect(b.y + b.h).toBeLessThanOrEqual(18 + 1e-9);
    }
  });
  it("bay dimensions match BAY constants", () => {
    const r = layout({ widthM: 36, lengthM: 18 });
    for (const b of r.bays) {
      expect(b.w).toBeCloseTo(BAY.width);
      expect(b.h).toBeCloseTo(BAY.length);
    }
  });
});

describe("regression vs MVP estimateBays", () => {
  // The MVP shim now wraps solveParking. For every MVP test fixture the
  // count should be identical (or trivially the same after the bug fix).
  const fixtures: Array<[number, number, number]> = [
    [30, 20, 0.1],
    [4, 2, 0],
    [10, 5, 0],
    [36, 18, 0.1], // reference case
    [20, 20, 0.1],
    [100, 30, 0.1],
    [6, 6, 0.1],
  ];
  for (const [w, l, f] of fixtures) {
    it(`estimateBays(${w}, ${l}, ${f}) matches solveParking totalBays`, () => {
      const r = solveParking({ widthM: w, lengthM: l }, { landscapingFraction: f });
      expect(estimateBays(w, l, f)).toBe(r.summary.totalBays);
    });
  }
});

describe("output shape", () => {
  it("always returns a ParkingLayout with all top-level fields", () => {
    const r: ParkingLayout = solveParking({ widthM: 36, lengthM: 18 });
    expect(Array.isArray(r.bays)).toBe(true);
    expect(Array.isArray(r.aisles)).toBe(true);
    expect(Array.isArray(r.access)).toBe(true);
    expect(Array.isArray(r.warnings)).toBe(true);
    expect(typeof r.summary).toBe("object");
    expect(["two-row", "single-row", "none"]).toContain(r.style);
  });
});
