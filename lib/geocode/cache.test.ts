// @vitest-environment node
// lib/geocode/cache.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getCached, getRecent, put, clear } from "./cache";

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

describe("geocode cache", () => {
  beforeEach(() => {
    // vitest is running in node env, so we stub `window` with a minimal
    // localStorage-bearing shim. The cache module checks `typeof window`
    // before touching localStorage.
    (globalThis as unknown as { window: unknown }).window = {
      localStorage: fakeLocalStorage(),
    };
  });
  afterEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window;
    vi.unstubAllGlobals();
  });

  it("returns empty array when nothing is stored", () => {
    expect(getRecent()).toEqual([]);
  });

  it("stores and retrieves by exact query", () => {
    put({
      lat: -33.67,
      lon: 150.87,
      displayName: "x",
      query: "33 Hamilton St",
    });
    const c = getCached("33 Hamilton St");
    expect(c?.lat).toBe(-33.67);
  });

  it("is case-insensitive", () => {
    put({ lat: 1, lon: 2, displayName: "x", query: "Foo" });
    expect(getCached("foo")?.lat).toBe(1);
  });

  it("falls back to substring match", () => {
    put({ lat: 1, lon: 2, displayName: "x", query: "Hamilton" });
    expect(getCached("33 Hamilton St")?.lat).toBe(1);
  });

  it("moves the most-recently-put entry to the head", () => {
    put({ lat: 1, lon: 2, displayName: "a", query: "alpha" });
    put({ lat: 3, lon: 4, displayName: "b", query: "beta" });
    const all = getRecent();
    expect(all[0].query).toBe("beta");
    expect(all[1].query).toBe("alpha");
  });

  it("deduplicates by query on re-put", () => {
    put({ lat: 1, lon: 2, displayName: "a", query: "alpha" });
    put({ lat: 1, lon: 2, displayName: "a2", query: "ALPHA" });
    expect(getRecent()).toHaveLength(1);
    expect(getRecent()[0].displayName).toBe("a2");
  });

  it("caps at 10 entries (FIFO)", () => {
    for (let i = 0; i < 12; i++) {
      put({ lat: i, lon: i, displayName: `d${i}`, query: `q${i}` });
    }
    expect(getRecent()).toHaveLength(10);
    expect(getRecent()[0].query).toBe("q11");
    // q0, q1 evicted
    expect(getRecent().find((c) => c.query === "q0")).toBeUndefined();
  });

  it("returns null on empty / whitespace query", () => {
    put({ lat: 1, lon: 2, displayName: "x", query: "alpha" });
    expect(getCached("   ")).toBeNull();
    expect(getCached("")).toBeNull();
  });

  it("clear() wipes the cache", () => {
    put({ lat: 1, lon: 2, displayName: "x", query: "alpha" });
    clear();
    expect(getRecent()).toEqual([]);
  });
});
