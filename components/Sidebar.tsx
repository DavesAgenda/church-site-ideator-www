"use client";
import { useMemo } from "react";
import type { Parcel } from "@/lib/types";
import { ringAreaSquareMetres } from "@/lib/area";
import type { Placement } from "@/lib/placements";
import { estimateBays, rectangleSideLengthsMetres } from "@/lib/parking";
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

  const carparkPlacements = placements.filter((p) => p.kind === "carpark");
  const totalBays = carparkPlacements.reduce((sum, p) => {
    const { width, length } = rectangleSideLengthsMetres(p);
    return sum + estimateBays(width, length, 0.1);
  }, 0);

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
      {carparkPlacements.length > 0 && (
        <div className="mt-3 rounded bg-blue-50 p-2 text-sm">
          <div className="font-semibold">Parking estimate</div>
          <div>{totalBays} bays total</div>
          <div className="text-xs text-slate-600">~10% landscaping, two-way aisles</div>
        </div>
      )}
      <PlacementList placements={placements} onDelete={onDeletePlacement} />
      <p className="mt-4 text-xs text-slate-500">
        Hold <kbd className="rounded bg-slate-100 px-1">Shift</kbd> and drag on the map
        to place a rectangle using the selected type.
      </p>
    </aside>
  );
}
