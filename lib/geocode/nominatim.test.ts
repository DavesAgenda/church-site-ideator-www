// lib/geocode/nominatim.test.ts
// Unit tests for the Nominatim wrapper. We mock global.fetch and the
// AbortController signal to avoid network calls.

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { searchAddress } from "./nominatim";

const SAMPLE_RESULT = {
  lat: -33.6736,
  lon: 150.8699,
  displayName: "Hamilton Street, Grantham Farm, Sydney, NSW 2765, Australia",
  query: "33 Hamilton St, Grantham Farm NSW 2765",
};

function mockFetchResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

function mockFetchRejects(reason: Error): ReturnType<typeof vi.fn> {
  return vi.fn().mockImplementation((_url: unknown, init?: RequestInit) => {
    // Honour the caller's AbortSignal: if it's already aborted, throw DOMException.
    if (init?.signal?.aborted) {
      return Promise.reject(reason);
    }
    // Otherwise, attach a listener so it rejects if aborted later.
    return new Promise((_resolve, reject) => {
      if (init?.signal) {
        init.signal.addEventListener(
          "abort",
          () => reject(reason),
          { once: true }
        );
      } else {
        reject(reason);
      }
    });
  });
}

describe("searchAddress", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null on empty query without making a request", async () => {
    const r = await searchAddress("   ");
    expect(r).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns the top result for a successful query", async () => {
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse([
        {
          lat: "-33.6736",
          lon: "150.8699",
          display_name: SAMPLE_RESULT.displayName,
        },
      ])
    );
    const r = await searchAddress("33 Hamilton St, Grantham Farm NSW 2765");
    expect(r).toEqual(SAMPLE_RESULT);
  });

  it("returns null when Nominatim returns no matches", async () => {
    fetchMock.mockResolvedValueOnce(mockFetchResponse([]));
    const r = await searchAddress("zzz nowhereville");
    expect(r).toBeNull();
  });

  it("builds the correct URL with encoded query", async () => {
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse([{ lat: "1", lon: "2", display_name: "x" }])
    );
    await searchAddress("hello world & friends?");
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("nominatim.openstreetmap.org/search");
    expect(url).toContain("format=json");
    expect(url).toContain("limit=1");
    expect(url).toContain("hello%20world%20%26%20friends%3F");
  });

  it("sets the User-Agent header per Nominatim policy", async () => {
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse([{ lat: "1", lon: "2", display_name: "x" }])
    );
    await searchAddress("test");
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers["User-Agent"]).toMatch(/church-site-ideator/i);
  });

  it("throws a friendly error on HTTP 429 rate-limit", async () => {
    fetchMock.mockResolvedValueOnce(mockFetchResponse({}, 429));
    await expect(searchAddress("burst")).rejects.toThrow(/rate limit/i);
  });

  it("throws on non-2xx responses", async () => {
    fetchMock.mockResolvedValueOnce(mockFetchResponse({}, 500));
    await expect(searchAddress("anything")).rejects.toThrow(/HTTP 500/);
  });

  it("returns null when the top result has invalid lat/lon", async () => {
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse([{ lat: "NaN", lon: "NaN", display_name: "weird" }])
    );
    const r = await searchAddress("weird");
    expect(r).toBeNull();
  });

  it("rejects with AbortError when an already-aborted signal is passed", async () => {
    vi.unstubAllGlobals();
    const abortErr = new DOMException("Aborted", "AbortError");
    vi.stubGlobal("fetch", mockFetchRejects(abortErr));
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(searchAddress("test", ctrl.signal)).rejects.toThrow(/abort/i);
  });

  it("passes the signal to fetch so callers can cancel in-flight requests", async () => {
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse([{ lat: "1", lon: "2", display_name: "x" }])
    );
    const ctrl = new AbortController();
    await searchAddress("test", ctrl.signal);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBe(ctrl.signal);
  });
});
