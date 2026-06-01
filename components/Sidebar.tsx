"use client";
import { useMemo } from "react";
import type { Parcel } from "@/lib/types";
import { ringAreaSquareMetres } from "@/lib/area";
import type { Placement, PlacementBounds } from "@/lib/placements";
import { typePlacementColour, kindLabel } from "@/lib/placements";
import { rectangleSideLengthsMetres } from "@/lib/parking";
import { solveParking, DEFAULT_LANDSCAPING } from "@/lib/parking/solver";
import type { ParkingLayout } from "@/lib/parking/types";
import { rectOutsideRing } from "@/lib/containment";

interface Props {
  parcel: Parcel | null;
  placements: Placement[];
  onDeletePlacement: (id: string) => void;
  onPanToPlacement: (b: PlacementBounds) => void;
  onDismissWarning?: (key: string) => void;
  dismissedWarnings?: Set<string>;
}

interface PlacementCard {
  p: Placement;
  areaM2: number;
  layout: ParkingLayout;
  outside: boolean;
}

export default function Sidebar({
  parcel,
  placements,
  onDeletePlacement,
  onPanToPlacement,
  onDismissWarning,
  dismissedWarnings,
}: Props) {
  const parcelArea = useMemo(
    () => (parcel ? ringAreaSquareMetres(parcel.ring) : 0),
    [parcel]
  );

  // Per-placement card data, computed once per parcel/placements change.
  const cards: PlacementCard[] = useMemo(() => {
    return placements.map((p) => {
      const { width, length } = rectangleSideLengthsMetres(p);
      const areaM2 = width * length;
      const layout =
        p.kind === "carpark"
          ? solveParking({ widthM: width, lengthM: length }, {
              landscapingFraction: DEFAULT_LANDSCAPING,
            })
          : {
              bays: [],
              aisles: [],
              access: [],
              warnings: [],
              style: "none" as const,
              summary: {
                totalBays: 0,
                standardBays: 0,
                accessibleBays: 0,
                grossAreaM2: areaM2,
                efficiency: 0,
              },
            };
      const outside = parcel ? rectOutsideRing(p.bounds, parcel.ring) : false;
      return { p, areaM2, layout, outside };
    });
  }, [parcel, placements]);

  const totalBays = cards.reduce((s, c) => s + c.layout.summary.totalBays, 0);
  const carparkArea = cards
    .filter((c) => c.p.kind === "carpark")
    .reduce((s, c) => s + c.areaM2, 0);
  const buildingArea = cards
    .filter((c) => c.p.kind === "building")
    .reduce((s, c) => s + c.areaM2, 0);
  const greenspaceArea = cards
    .filter((c) => c.p.kind === "greenspace")
    .reduce((s, c) => s + c.areaM2, 0);
  const developedArea = carparkArea + buildingArea + greenspaceArea;
  const undevelopedArea = Math.max(0, parcelArea - developedArea);
  const coverage = parcelArea > 0 ? (developedArea / parcelArea) * 100 : 0;

  // All warnings, deduped, dismissable.
  const warningEntries: { key: string; placementName: string; text: string }[] = [];
  for (const c of cards) {
    c.layout.warnings.forEach((w, i) => {
      const key = `${c.p.id}:${i}:${w}`;
      if (dismissedWarnings?.has(key)) return;
      warningEntries.push({ key, placementName: c.p.name, text: w });
    });
  }

  return (
    <aside className="absolute right-0 top-0 z-[1000] h-full w-80 overflow-y-auto bg-white p-4 shadow-lg">
      <h2 className="text-lg font-semibold">Site</h2>
      {parcel ? (
        <div className="mt-2 space-y-1 text-sm">
          <div>
            <span className="text-slate-500">Name:</span> {parcel.name}
          </div>
          <div>
            <span className="text-slate-500">Area:</span>{" "}
            {parcelArea.toLocaleString(undefined, { maximumFractionDigits: 0 })} m&sup2;
          </div>
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-500">
          Use the polygon tool (top-left) to draw the church block outline.
        </p>
      )}

      {/* Per-placement cards */}
      {cards.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold">Placements</h3>
          <ul className="mt-1 space-y-2">
            {cards.map(({ p, areaM2, layout, outside }) => (
              <li
                key={p.id}
                className="rounded border p-2 text-sm hover:bg-slate-50"
                style={{ borderLeftColor: typePlacementColour(p.kind), borderLeftWidth: 4 }}
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onPanToPlacement(p.bounds)}
                    className="text-left font-medium hover:underline"
                  >
                    {p.name}
                  </button>
                  <button
                    onClick={() => onDeletePlacement(p.id)}
                    className="text-xs text-red-600 hover:underline"
                    aria-label={`Delete ${p.name}`}
                  >
                    delete
                  </button>
                </div>
                <div className="text-xs text-slate-500">
                  {kindLabel(p.kind)} &middot;{" "}
                  {areaM2.toLocaleString(undefined, { maximumFractionDigits: 0 })} m&sup2;
                </div>
                {p.kind === "carpark" && (
                  <div className="mt-1 text-xs">
                    <span className="font-semibold">
                      {layout.summary.totalBays} bays
                    </span>{" "}
                    <span className="text-slate-500">
                      &middot; {layout.summary.efficiency.toFixed(1)} bays/100m&sup2;
                    </span>
                    {layout.style !== "two-row" && (
                      <span className="ml-1 rounded bg-amber-100 px-1 text-amber-800">
                        {layout.style}
                      </span>
                    )}
                  </div>
                )}
                {outside && (
                  <div className="mt-1 text-xs text-amber-700">Outside block</div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Site totals */}
      {parcel && (
        <div className="mt-4 rounded bg-slate-50 p-2 text-sm">
          <h3 className="text-sm font-semibold">Site totals</h3>
          <div className="mt-1 space-y-0.5 text-xs">
            <div className="flex justify-between">
              <span>Gross parcel</span>
              <span>{parcelArea.toLocaleString(undefined, { maximumFractionDigits: 0 })} m&sup2;</span>
            </div>
            <div className="flex justify-between">
              <span>Developed</span>
              <span>{developedArea.toLocaleString(undefined, { maximumFractionDigits: 0 })} m&sup2;</span>
            </div>
            <div className="flex justify-between">
              <span>Undeveloped</span>
              <span>{undevelopedArea.toLocaleString(undefined, { maximumFractionDigits: 0 })} m&sup2;</span>
            </div>
            <div className="flex justify-between">
              <span>Coverage</span>
              <span>{coverage.toFixed(1)}%</span>
            </div>
            {carparkArea > 0 && (
              <div className="flex justify-between border-t border-slate-200 pt-1 font-semibold">
                <span>Total bays</span>
                <span>{totalBays}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Warnings */}
      {warningEntries.length > 0 && (
        <div className="mt-4 rounded bg-amber-50 p-2 text-sm">
          <h3 className="text-sm font-semibold text-amber-800">Solver warnings</h3>
          <ul className="mt-1 space-y-1 text-xs text-amber-800">
            {warningEntries.map(({ key, placementName, text }) => (
              <li key={key} className="flex items-start justify-between gap-2">
                <span>
                  <span className="font-semibold">{placementName}:</span> {text}
                </span>
                {onDismissWarning && (
                  <button
                    onClick={() => onDismissWarning(key)}
                    className="text-amber-600 hover:underline"
                    aria-label="Dismiss"
                  >
                    &times;
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-4 text-xs text-slate-500">
        Hold <kbd className="rounded bg-slate-100 px-1">Shift</kbd> and drag on the map
        to place a rectangle using the selected type. Drag a rectangle to move it.
        Drag the corner handles to resize.
      </p>
    </aside>
  );
}
