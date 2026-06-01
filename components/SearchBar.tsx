"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { searchAddress, type GeocodeResult } from "@/lib/geocode/nominatim";
import { getRecent, put as putCache } from "@/lib/geocode/cache";

interface Props {
  onSelect: (result: GeocodeResult) => void;
}

/**
 * Address search bar. Debounces user input (300ms) and throttles network
 * calls (1 req/s, per Nominatim's absolute policy), shows a recents
 * dropdown on focus, and surfaces a small error / rate-limit banner.
 *
 * The recents dropdown is driven by the localStorage cache. Successful
 * geocodes are written back to the cache.
 */
export default function SearchBar({ onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [recents, setRecents] = useState<GeocodeResult[]>([]);
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
  const [showRecents, setShowRecents] = useState(false);
  const [busy, setBusy] = useState(false);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCallTime = useRef<number>(0);
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortCtrl = useRef<AbortController | null>(null);

  // Load recents on mount.
  useEffect(() => {
    setRecents(getRecent());
  }, []);

  // Debounce the live search. Throttle is layered on top of the actual
  // network call.
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setResults([]);
      setError(null);
      return;
    }
    debounceTimer.current = setTimeout(() => {
      doSearch(trimmed);
    }, 300);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [query]);

  const doSearch = useCallback(async (q: string) => {
    // Cancel any in-flight request.
    abortCtrl.current?.abort();
    const ctrl = new AbortController();
    abortCtrl.current = ctrl;

    // Throttle: if we called <1000ms ago, queue. Otherwise fire now.
    const now = Date.now();
    const sinceLast = now - lastCallTime.current;
    if (sinceLast < 1000) {
      if (pendingTimer.current) clearTimeout(pendingTimer.current);
      const wait = 1000 - sinceLast;
      pendingTimer.current = setTimeout(() => {
        doSearch(q);
      }, wait);
      return;
    }
    lastCallTime.current = Date.now();
    setBusy(true);
    setError(null);
    setRateLimited(false);
    try {
      const r = await searchAddress(q, ctrl.signal);
      if (ctrl.signal.aborted) return;
      if (r) {
        setResults([r]);
        // Don't write to cache until the user picks it; we want recents
        // to be things they actually navigated to, not half-typed
        // suggestions. Cache write happens onSelect.
      } else {
        setResults([]);
        setError("No matches.");
      }
    } catch (e) {
      if (ctrl.signal.aborted) return;
      const err = e as Error & { code?: string };
      if (err.code === "RATE_LIMITED") {
        setRateLimited(true);
        setError("Rate-limited by Nominatim (1 req/s). Try again in a moment.");
      } else {
        setError(err.message ?? "Search failed.");
      }
    } finally {
      if (!ctrl.signal.aborted) setBusy(false);
    }
  }, []);

  const pickResult = (r: GeocodeResult) => {
    putCache(r);
    setRecents(getRecent());
    setShowRecents(false);
    setQuery(r.displayName.split(",")[0]);
    onSelect(r);
  };

  return (
    <div
      className="absolute left-1/2 top-4 z-[1100] w-96 -translate-x-1/2"
      onFocus={() => setShowRecents(true)}
      onBlur={(e) => {
        // Delay so a click on a recents item registers before collapse.
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setShowRecents(false);
        }
      }}
    >
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search address (e.g. 33 Hamilton St, Grantham Farm)"
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 pr-9 text-sm shadow focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          aria-label="Address search"
        />
        {busy && (
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-500" />
          </div>
        )}
      </div>

      {/* Recents / results dropdown */}
      {showRecents && (recents.length > 0 || results.length > 0 || error) && (
        <div className="mt-1 max-h-60 overflow-y-auto rounded-md border border-slate-200 bg-white text-sm shadow-lg">
          {results.length > 0 && (
            <>
              <div className="px-3 py-1 text-xs font-semibold text-slate-500">
                Result
              </div>
              {results.map((r, i) => (
                <button
                  key={`r-${i}`}
                  onMouseDown={() => pickResult(r)}
                  className="block w-full truncate px-3 py-1.5 text-left hover:bg-blue-50"
                >
                  {r.displayName}
                </button>
              ))}
            </>
          )}
          {recents.length > 0 && (
            <>
              <div className="border-t border-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                Recent
              </div>
              {recents.slice(0, 5).map((r, i) => (
                <button
                  key={`p-${i}`}
                  onMouseDown={() => pickResult(r)}
                  className="block w-full truncate px-3 py-1.5 text-left hover:bg-slate-50"
                >
                  {r.displayName}
                </button>
              ))}
            </>
          )}
          {error && (
            <div
              className={`px-3 py-2 text-xs ${
                rateLimited ? "bg-amber-50 text-amber-800" : "text-slate-600"
              }`}
            >
              {error}
            </div>
          )}
        </div>
      )}

      <div className="mt-1 text-center text-[10px] text-slate-500">
        Search by OpenStreetMap Nominatim
      </div>
    </div>
  );
}
