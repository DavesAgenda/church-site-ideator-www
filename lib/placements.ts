export type PlacementKind = "carpark" | "building" | "greenspace";

export interface PlacementBounds {
  south: number; west: number; north: number; east: number;
}

export interface Placement {
  id: string;
  kind: PlacementKind;
  name: string;
  bounds: PlacementBounds;
}

const KINDS: PlacementKind[] = ["carpark", "building", "greenspace"];

export function isPlacement(value: unknown): value is Placement {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== "string" || typeof v.name !== "string") return false;
  if (!KINDS.includes(v.kind as PlacementKind)) return false;
  if (!v.bounds || typeof v.bounds !== "object") return false;
  const b = v.bounds as Record<string, unknown>;
  return ["south", "west", "north", "east"].every(
    (k) => typeof b[k] === "number" && Number.isFinite(b[k] as number)
  );
}

export function typePlacementColour(kind: PlacementKind): string {
  switch (kind) {
    case "carpark": return "#2563eb"; // blue-600
    case "building": return "#475569"; // slate-600
    case "greenspace": return "#16a34a"; // green-600
  }
}

export function kindLabel(kind: PlacementKind): string {
  switch (kind) {
    case "carpark": return "Car park";
    case "building": return "Building";
    case "greenspace": return "Green space";
  }
}
