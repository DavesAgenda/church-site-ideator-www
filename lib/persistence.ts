import type { Parcel } from "./types";
import { isParcel } from "./types";
import { isPlacement, type Placement } from "./placements";

export interface PersistedState {
  parcel: Parcel | null;
  placements: Placement[];
}

export function serialise(s: PersistedState): string {
  return JSON.stringify(s);
}

export function deserialise(raw: string): PersistedState | null {
  try {
    const parsed = JSON.parse(raw);
    if (!isValidState(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function isValidState(value: unknown): value is PersistedState {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (v.parcel === null || v.parcel === undefined) return false;
  if (!isParcel(v.parcel)) return false;
  if (!Array.isArray(v.placements)) return false;
  return v.placements.every(isPlacement);
}

export const STORAGE_KEY = "church-site-ideator:v1";
