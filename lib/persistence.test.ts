import { describe, it, expect } from "vitest";
import { serialise, deserialise, isValidState } from "./persistence";

const state = {
  parcel: {
    id: "p1", name: "Block",
    ring: [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]] as [number, number][],
  },
  placements: [
    { id: "pl1", kind: "carpark" as const, name: "CP1",
      bounds: { south: 0, west: 0, north: 1, east: 1 } },
  ],
};

describe("persistence", () => {
  it("round-trips a state through serialise/deserialise", () => {
    const json = serialise(state);
    const back = deserialise(json);
    expect(back).toEqual(state);
  });
  it("returns null for invalid JSON", () => {
    expect(deserialise("not json")).toBeNull();
  });
  it("returns null for missing fields", () => {
    expect(deserialise(JSON.stringify({ parcel: null, placements: "x" }))).toBeNull();
  });
  it("isValidState accepts a valid state", () => {
    expect(isValidState(state)).toBe(true);
  });
  it("isValidState rejects bad shape", () => {
    expect(isValidState({ parcel: null, placements: [] })).toBe(false);
  });
});
