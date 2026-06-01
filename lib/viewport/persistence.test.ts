// lib/viewport/persistence.test.ts
// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  loadViewport,
  saveViewport,
  saveParcelAndPlacements,
} from "./persistence";

function fakeLocalStorage(): Storage {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
    key: () => null,
    get length() {
      return data.size;
    },
  } as unknown as Storage;
}

describe("viewport persistence", () => {
  beforeEach(() => {
    (globalThis as unknown as { window: unknown }).window = {
      localStorage: fakeLocalStorage(),
    };
  });
  afterEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window;
    vi.unstubAllGlobals();
  });

  it("returns the default viewport when nothing is stored", () => {
    const v = loadViewport();
    expect(v.center).toEqual([-33.6736, 150.8699]);
    expect(v.zoom).toBe(18);
  });

  it("round-trips a saved viewport", () => {
    saveViewport({ center: [-33.8, 151.0], zoom: 19 });
    const v = loadViewport();
    expect(v.center).toEqual([-33.8, 151.0]);
    expect(v.zoom).toBe(19);
  });

  it("preserves the viewport when saving parcel and placements", () => {
    saveViewport({ center: [-33.8, 151.0], zoom: 19 });
    saveParcelAndPlacements(null, []);
    const v = loadViewport();
    expect(v.center).toEqual([-33.8, 151.0]);
    expect(v.zoom).toBe(19);
  });

  it("migrates v1 state to v2 with a default viewport", () => {
    const ls = (globalThis as unknown as { window: { localStorage: Storage } })
      .window.localStorage;
    const v1 = {
      parcel: null,
      placements: [
        {
          id: "abc",
          kind: "carpark",
          name: "Car park 1",
          bounds: { south: -33.68, west: 150.86, north: -33.67, east: 150.87 },
        },
      ],
    };
    ls.setItem("church-site-ideator:v1", JSON.stringify(v1));
    const v = loadViewport();
    // v1 is migrated, v2 written back with a default viewport.
    expect(v.center).toEqual([-33.6736, 150.8699]);
    expect(ls.getItem("church-site-ideator:v1")).toBeNull();
    // v2 now contains the migrated state.
    const v2raw = ls.getItem("church-site-ideator:v2");
    expect(v2raw).not.toBeNull();
    const v2 = JSON.parse(v2raw!);
    expect(v2.version).toBe(2);
    expect(v2.placements).toHaveLength(1);
    expect(v2.placements[0].name).toBe("Car park 1");
  });

  it("prefers v2 over v1 when both are present", () => {
    const ls = (globalThis as unknown as { window: { localStorage: Storage } })
      .window.localStorage;
    ls.setItem(
      "church-site-ideator:v1",
      JSON.stringify({ parcel: null, placements: [] })
    );
    saveViewport({ center: [-33.8, 151.0], zoom: 19 });
    const v = loadViewport();
    expect(v.zoom).toBe(19);
  });

  it("returns default on corrupted v2", () => {
    const ls = (globalThis as unknown as { window: { localStorage: Storage } })
      .window.localStorage;
    ls.setItem("church-site-ideator:v2", "not json");
    const v = loadViewport();
    expect(v.zoom).toBe(18);
  });

  it("survives a fresh saveViewport with no prior state", () => {
    saveViewport({ center: [-33.7, 150.9], zoom: 17 });
    const v = loadViewport();
    expect(v.zoom).toBe(17);
  });
});
