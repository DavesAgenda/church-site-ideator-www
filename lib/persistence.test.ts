import { describe, it, expect } from "vitest";
import { serialise, deserialise, isValidState, migrateV1toV2 } from "./persistence";

const v2state = {
  version: 2 as const,
  parcel: {
    id: "p1",
    name: "Block",
    ring: [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]] as [number, number][],
  },
  placements: [
    {
      id: "pl1",
      kind: "carpark" as const,
      name: "CP1",
      bounds: { south: 0, west: 0, north: 1, east: 1 },
    },
  ],
  viewport: { center: [-33.6736, 150.8699] as [number, number], zoom: 18 },
};

describe("persistence v2", () => {
  it("round-trips a v2 state through serialise/deserialise", () => {
    const json = serialise(v2state);
    const back = deserialise(json);
    expect(back).toEqual(v2state);
  });

  it("accepts a v2 state with viewport null (parcel drawn, no view saved yet)", () => {
    const s = { ...v2state, viewport: null };
    const json = serialise(s);
    const back = deserialise(json);
    expect(back).toEqual(s);
  });

  it("returns null for invalid JSON", () => {
    expect(deserialise("not json")).toBeNull();
  });

  it("returns null for v1 (unversioned) state — caller must migrate explicitly", () => {
    const v1 = {
      parcel: v2state.parcel,
      placements: v2state.placements,
    };
    expect(deserialise(JSON.stringify(v1))).toBeNull();
  });

  it("returns null for missing fields", () => {
    expect(deserialise(JSON.stringify({ version: 2, parcel: null, placements: "x" }))).toBeNull();
  });

  it("isValidState accepts a valid v2 state", () => {
    expect(isValidState(v2state)).toBe(true);
  });

  it("isValidState rejects v1 (no version field)", () => {
    expect(isValidState({ parcel: null, placements: [] })).toBe(false);
  });

  it("isValidState rejects bad viewport shape", () => {
    expect(
      isValidState({ ...v2state, viewport: { center: [0, 0], zoom: "x" } })
    ).toBe(false);
  });
});

describe("migrateV1toV2", () => {
  it("adds the version field and a default viewport", () => {
    const v1 = { parcel: null, placements: [] };
    const v2 = migrateV1toV2(v1);
    expect(v2.version).toBe(2);
    expect(v2.viewport).toEqual({
      center: [-33.6736, 150.8699],
      zoom: 18,
    });
  });

  it("respects an explicit viewport argument", () => {
    const v1 = { parcel: null, placements: [] };
    const v2 = migrateV1toV2(v1, { center: [-33.8, 151.0], zoom: 19 });
    expect(v2.viewport).toEqual({ center: [-33.8, 151.0], zoom: 19 });
  });
});
