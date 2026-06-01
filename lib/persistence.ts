import type { Parcel } from "./types";
import { isParcel } from "./types";
import { isPlacement, type Placement } from "./placements";

/** A persisted map viewport (centre + zoom). */
export interface PersistedViewport {
  center: [number, number]; // [lat, lon]
  zoom: number;
}

/** V2 state shape: parcel + placements + viewport, with a version field. */
export interface PersistedState {
  version: 2;
  parcel: Parcel | null;
  placements: Placement[];
  viewport: PersistedViewport | null;
}

/** V1 state shape (pre-viewport). Read for one-time migration only. */
interface V1State {
  parcel: Parcel | null;
  placements: Placement[];
}

/** Default centre: 33 Hamilton St, Grantham Farm NSW 2765. */
export const DEFAULT_CENTER: [number, number] = [-33.6736, 150.8699];
export const DEFAULT_ZOOM = 18;

export const STORAGE_KEY = "church-site-ideator:v1";
export const STORAGE_KEY_V2 = "church-site-ideator:v2";

export function serialise(s: PersistedState): string {
  return JSON.stringify(s);
}

export function deserialise(raw: string): PersistedState | null {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const v = parsed as Record<string, unknown>;
    if (v.version === 2 && isV2State(v)) {
      return v as unknown as PersistedState;
    }
    if (!v.version && isV1State(v)) {
      // Caller should treat as v1 and migrate via load().
      return null;
    }
    return null;
  } catch {
    return null;
  }
}

export function isValidState(value: unknown): value is PersistedState {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (v.version !== 2) return false;
  return isV2State(v);
}

function isV2State(v: Record<string, unknown>): boolean {
  if (v.parcel !== null && v.parcel !== undefined && !isParcel(v.parcel)) return false;
  if (!Array.isArray(v.placements)) return false;
  if (!v.placements.every(isPlacement)) return false;
  if (v.viewport !== null && v.viewport !== undefined && !isViewport(v.viewport)) return false;
  return true;
}

function isV1State(v: Record<string, unknown>): boolean {
  if (v.parcel !== null && v.parcel !== undefined && !isParcel(v.parcel)) return false;
  if (!Array.isArray(v.placements)) return false;
  return v.placements.every(isPlacement);
}

function isViewport(v: unknown): v is PersistedViewport {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  if (!Array.isArray(o.center) || o.center.length !== 2) return false;
  if (!o.center.every((n) => typeof n === "number" && Number.isFinite(n))) return false;
  if (typeof o.zoom !== "number" || !Number.isFinite(o.zoom)) return false;
  return true;
}

/**
 * Migrate a v1 state (no viewport) to v2 with a default viewport.
 * Public so the persistence layer can hand-migrate from the old key.
 */
export function migrateV1toV2(v1: V1State, viewport?: PersistedViewport | null): PersistedState {
  return {
    version: 2,
    parcel: v1.parcel,
    placements: v1.placements,
    viewport: viewport ?? { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM },
  };
}
