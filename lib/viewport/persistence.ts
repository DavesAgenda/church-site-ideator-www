// lib/viewport/persistence.ts
// Browser-side helpers for loading and saving the map viewport.
// Reads V2 first; falls back to V1 (and migrates) if V2 is absent.
// The MapView component calls save() on moveend and load() on mount.

import {
  deserialise,
  isValidState,
  migrateV1toV2,
  serialise,
  STORAGE_KEY,
  STORAGE_KEY_V2,
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  type PersistedState,
  type PersistedViewport,
} from "../persistence";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

/**
 * Load the persisted viewport. Falls back to the default centre if nothing
 * is stored, or if the stored state is invalid. Also performs a one-time
 * migration from v1 to v2: if v2 is absent but v1 is present, the v1 state
 * is migrated (with a default viewport) and written back to v2.
 */
export function loadViewport(): PersistedViewport {
  if (!isBrowser()) {
    return { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM };
  }
  try {
    const v2 = window.localStorage.getItem(STORAGE_KEY_V2);
    if (v2) {
      const parsed = JSON.parse(v2);
      if (isValidState(parsed) && parsed.viewport) {
        return parsed.viewport;
      }
    }
    // One-time v1 -> v2 migration.
    const v1 = window.localStorage.getItem(STORAGE_KEY);
    if (v1) {
      const parsed = JSON.parse(v1);
      if (parsed && typeof parsed === "object") {
        const v1state = parsed as { parcel: unknown; placements: unknown[] };
        // Trust the v1 shape if it has parcel and placements arrays; migration
        // creates a fresh v2 wrapper.
        const migrated = migrateV1toV2(
          {
            parcel: (v1state.parcel as PersistedState["parcel"]) ?? null,
            placements: (v1state.placements as PersistedState["placements"]) ?? [],
          },
          { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM }
        );
        window.localStorage.setItem(STORAGE_KEY_V2, serialise(migrated));
        window.localStorage.removeItem(STORAGE_KEY);
        return migrated.viewport!;
      }
    }
  } catch {
    // Fall through to default.
  }
  return { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM };
}

/**
 * Save the current viewport alongside the rest of the persisted state.
 * Reads existing v2 state, updates the viewport field, writes back.
 * If no v2 state exists yet (e.g. nothing has been drawn), it creates a
 * minimal v2 with empty parcel/placements.
 */
export function saveViewport(v: PersistedViewport): void {
  if (!isBrowser()) return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_V2);
    let next: PersistedState;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (isValidState(parsed)) {
        next = { ...parsed, viewport: v };
      } else {
        next = {
          version: 2,
          parcel: null,
          placements: [],
          viewport: v,
        };
      }
    } else {
      next = {
        version: 2,
        parcel: null,
        placements: [],
        viewport: v,
      };
    }
    window.localStorage.setItem(STORAGE_KEY_V2, serialise(next));
  } catch {
    // localStorage full or disabled — silently drop.
  }
}

/**
 * Update the parcel/placements portion of the persisted v2 state without
 * overwriting the viewport. Called by the MapView autosave.
 */
export function saveParcelAndPlacements(
  parcel: PersistedState["parcel"],
  placements: PersistedState["placements"]
): void {
  if (!isBrowser()) return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_V2);
    let next: PersistedState;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (isValidState(parsed)) {
        next = { ...parsed, parcel, placements };
      } else {
        next = {
          version: 2,
          parcel,
          placements,
          viewport: { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM },
        };
      }
    } else {
      next = {
        version: 2,
        parcel,
        placements,
        viewport: { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM },
      };
    }
    window.localStorage.setItem(STORAGE_KEY_V2, serialise(next));
  } catch {
    // localStorage full or disabled — silently drop.
  }
}
