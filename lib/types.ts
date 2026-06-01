export type LonLat = [number, number]; // [longitude, latitude]
export type LinearRing = LonLat[];

export interface Parcel {
  id: string;
  name: string;
  ring: LinearRing; // closed ring, first point repeated at end
}

export function isParcel(value: unknown): value is Parcel {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== "string" || typeof v.name !== "string") return false;
  if (!Array.isArray(v.ring)) return false;
  if (v.ring.length < 4) return false; // closed ring needs >= 4 points
  return v.ring.every(
    (p) => Array.isArray(p) && p.length === 2 &&
      p.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}
