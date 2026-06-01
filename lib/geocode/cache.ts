// lib/geocode/cache.ts
// localStorage-backed LRU of recent geocode results. Keeps the last 10
// successful queries so the SearchBar can show a recents dropdown on
// return visits without hitting the network.

import type { GeocodeResult } from "./nominatim";

const STORAGE_KEY = "STORAGE_GEOCODE_CACHE";
const MAX_ENTRIES = 10;

export interface CachedGeocode extends GeocodeResult {
  ts: number;
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getRecent(): CachedGeocode[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isCached);
  } catch {
    return [];
  }
}

export function getCached(query: string): CachedGeocode | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const all = getRecent();
  for (const c of all) {
    if (c.query.toLowerCase() === q) return c;
  }
  // Substring match fallback
  for (const c of all) {
    if (c.query.toLowerCase().includes(q) || q.includes(c.query.toLowerCase())) {
      return c;
    }
  }
  return null;
}

export function put(result: GeocodeResult): void {
  if (!isBrowser()) return;
  const all = getRecent().filter((c) => c.query.toLowerCase() !== result.query.toLowerCase());
  all.unshift({ ...result, ts: Date.now() });
  const trimmed = all.slice(0, MAX_ENTRIES);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage full or disabled — silently drop.
  }
}

export function clear(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

function isCached(x: unknown): x is CachedGeocode {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.lat === "number" &&
    typeof o.lon === "number" &&
    typeof o.displayName === "string" &&
    typeof o.query === "string" &&
    typeof o.ts === "number"
  );
}
