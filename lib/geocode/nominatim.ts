// lib/geocode/nominatim.ts
// Wrapper around the Nominatim OpenStreetMap search API. Free, no API key,
// CORS-enabled. Usage policy: 1 req/s absolute max, descriptive User-Agent
// required, attribution required (we surface "Search by OpenStreetMap
// Nominatim" in the SearchBar footer).
//
// Spec (parity-phase plan §4.1):
//   searchAddress(query, signal?) -> GeocodeResult | null
//   Endpoint: https://nominatim.openstreetmap.org/search?format=json&limit=1&q=...
//   Throttle: callers must implement (we don't throttle here, since the
//     SearchBar owns the debounce + throttle policy).
//   0 results -> null
//   Network / non-OK -> throw
//
// Abort: the caller's AbortSignal is wired directly to fetch. A request
// cancelled mid-flight throws DOMException("Aborted").

export interface GeocodeResult {
  lat: number;
  lon: number;
  displayName: string;
  /** Original query that produced this result, for caching. */
  query: string;
}

const ENDPOINT = "https://nominatim.openstreetmap.org/search";
const USER_AGENT =
  "church-site-ideator/1.0 (https://church-site-ideator-www.vercel.app)";

interface NominatimItem {
  lat: string;
  lon: string;
  display_name: string;
}

/**
 * Geocode a free-text address. Returns the top result, or null if Nominatim
 * has no match. Throws on network failure, non-2xx, or abort.
 */
export async function searchAddress(
  query: string,
  signal?: AbortSignal
): Promise<GeocodeResult | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const url =
    `${ENDPOINT}?format=json&limit=1&q=${encodeURIComponent(trimmed)}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
    signal,
  });
  if (res.status === 429) {
    const err = new Error("Rate limited by Nominatim");
    (err as Error & { code?: string }).code = "RATE_LIMITED";
    throw err;
  }
  if (!res.ok) {
    throw new Error(`Nominatim HTTP ${res.status}`);
  }
  const body = (await res.json()) as NominatimItem[];
  if (!Array.isArray(body) || body.length === 0) {
    return null;
  }
  const top = body[0];
  const lat = Number.parseFloat(top.lat);
  const lon = Number.parseFloat(top.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }
  return {
    lat,
    lon,
    displayName: top.display_name,
    query: trimmed,
  };
}
