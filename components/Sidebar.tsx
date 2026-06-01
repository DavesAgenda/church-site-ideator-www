"use client";
import { useMemo } from "react";
import type { Parcel } from "@/lib/types";
import { ringAreaSquareMetres } from "@/lib/area";

interface Props {
  parcel: Parcel | null;
}

export default function Sidebar({ parcel }: Props) {
  const area = useMemo(
    () => (parcel ? ringAreaSquareMetres(parcel.ring) : 0),
    [parcel]
  );
  return (
    <aside className="absolute right-0 top-0 z-[1000] h-full w-72 bg-white p-4 shadow-lg">
      <h2 className="text-lg font-semibold">Site</h2>
      {parcel ? (
        <div className="mt-2 space-y-2 text-sm">
          <div>
            <span className="text-slate-500">Name:</span> {parcel.name}
          </div>
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
    </aside>
  );
}
