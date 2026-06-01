"use client";
import type { Placement } from "@/lib/placements";
import { kindLabel } from "@/lib/placements";

interface Props {
  placements: Placement[];
  onDelete: (id: string) => void;
}

export default function PlacementList({ placements, onDelete }: Props) {
  if (placements.length === 0) return null;
  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold">Placements</h3>
      <ul className="mt-1 space-y-1 text-sm">
        {placements.map((p) => (
          <li key={p.id} className="flex items-center justify-between">
            <span>{p.name} <span className="text-slate-400">({kindLabel(p.kind)})</span></span>
            <button
              onClick={() => onDelete(p.id)}
              className="text-xs text-red-600 hover:underline"
            >
              delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
