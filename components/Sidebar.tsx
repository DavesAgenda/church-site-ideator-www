"use client";
import { useMemo } from "react";
import type { Parcel } from "@/lib/types";
import { ringAreaSquareMetres } from "@/lib/area";
import type { Placement } from "@/lib/placements";
import PlacementList from "./PlacementList";

interface Props {
  parcel: Parcel | null;
  placements: Placement[];
  onDeletePlacement: (id: string) => void;
}

export default function Sidebar({ parcel, placements, onDeletePlacement }: Props) {
  const area = useMemo(
    () => (parcel ? ringAreaSquareMetres(parcel.ring) : 0),
    [parcel]
  );
  return (
    <aside className="absolute right-0 top-0 z-[1000] h-full w-72 bg-white p-4 shadow-lg">
      <h2 className="text-lg font-semibold">Site</h2>
      {parcel ? (
        <div className="mt-2 space-y-1 text-sm">
          <div><span className="text-slate-500">Name:</span> {parcel.name}</div>
          <div>
            <span className="text-slate-500">Area:</span>{" "}
            {area.toLocaleString(undefined, { maximumFractionDigits: 0 })} m&sup2;
          </div>
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-500">
          Use the polygon tool (top-left) to draw the church block outline.
        </p>
      )}
      <PlacementList placements={placements} onDelete={onDeletePlacement} />
      <p className="mt-4 text-xs text-slate-500">
        Hold <kbd className="rounded bg-slate-100 px-1">Shift</kbd> and drag on the map
        to place a rectangle using the selected type.
      </p>
    </aside>
  );
}
