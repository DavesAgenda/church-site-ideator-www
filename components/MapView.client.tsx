"use client";
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "@geoman-io/leaflet-geoman-free";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import type { Parcel } from "@/lib/types";
import type { Placement, PlacementKind } from "@/lib/placements";
import { typePlacementColour, kindLabel } from "@/lib/placements";
import Sidebar from "./Sidebar";
import PlacementList from "./PlacementList";

export default function MapView() {
  const ref = useRef<HTMLDivElement>(null);
  const [parcel, setParcel] = useState<Parcel | null>(null);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [activeKind, setActiveKind] = useState<PlacementKind>("carpark");
  useEffect(() => {
    if (!ref.current) return;
    const map = L.map(ref.current, {
      center: [-33.8688, 151.2093],
      zoom: 17,
    });
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 20, attribution: "Tiles &copy; Esri" }
    ).addTo(map);

    let drawnLayer: L.Polygon | null = null;
    map.pm.addControls({
      position: "topleft",
      drawCircle: false,
      drawCircleMarker: false,
      drawMarker: false,
      drawPolyline: false,
      drawRectangle: false,
      drawText: false,
      drawPolygon: true,
      editMode: true,
      dragMode: false,
      cutPolygon: false,
      removalMode: true,
      rotateMode: false,
    });

    map.on("pm:create", (e: { layer: L.Layer }) => {
      if (drawnLayer) map.removeLayer(drawnLayer);
      drawnLayer = e.layer as L.Polygon;
      const latlngs = (drawnLayer.getLatLngs()[0] as L.LatLng[])
        .map((p) => [p.lng, p.lat] as [number, number]);
      latlngs.push(latlngs[0]); // close ring
      setParcel({ id: crypto.randomUUID(), name: "Church block", ring: latlngs });
    });

    map.on("pm:remove", () => {
      drawnLayer = null;
      setParcel(null);
    });

    // Shift-drag placement drawing (for activeKind)
    let drawOrigin: L.LatLng | null = null;
    let drawRect: L.Rectangle | null = null;
    map.on("mousedown", (e: L.LeafletMouseEvent) => {
      if (e.originalEvent.shiftKey) {
        drawOrigin = e.latlng;
      }
    });
    map.on("mousemove", (e: L.LeafletMouseEvent) => {
      if (!drawOrigin) return;
      if (drawRect) map.removeLayer(drawRect);
      drawRect = L.rectangle(
        [
          [drawOrigin.lat, drawOrigin.lng],
          [e.latlng.lat, e.latlng.lng],
        ],
        {
          color: typePlacementColour(activeKind),
          weight: 2,
          fillOpacity: 0.3,
        }
      ).addTo(map);
    });
    map.on("mouseup", (e: L.LeafletMouseEvent) => {
      if (!drawOrigin) return;
      const a = drawOrigin;
      const b = e.latlng;
      drawOrigin = null;
      if (drawRect) {
        map.removeLayer(drawRect);
        drawRect = null;
      }
      const south = Math.min(a.lat, b.lat);
      const west = Math.min(a.lng, b.lng);
      const north = Math.max(a.lat, b.lat);
      const east = Math.max(a.lng, b.lng);
      const count = placements.filter((p) => p.kind === activeKind).length + 1;
      const id = crypto.randomUUID();
      const name = `${kindLabel(activeKind)} ${count}`;
      const placement: Placement = {
        id, kind: activeKind, name,
        bounds: { south, west, north, east },
      };
      // Persist a visible rectangle for the new placement (the drag-preview was removed above)
      L.rectangle(
        [
          [south, west],
          [north, east],
        ],
        { color: typePlacementColour(activeKind), weight: 2, fillOpacity: 0.3 }
      ).bindTooltip(name).addTo(map);
      setPlacements((prev) => [...prev, placement]);
    });

    return () => { map.remove(); };
    // placements is intentionally NOT in deps; the closure reads the latest via setPlacements functional update
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKind]);

  const Toolbar = () => (
    <div className="absolute left-1/2 top-2 z-[1000] flex -translate-x-1/2 gap-1 rounded bg-white p-1 shadow">
      {(["carpark", "building", "greenspace"] as PlacementKind[]).map((k) => (
        <button
          key={k}
          onClick={() => setActiveKind(k)}
          className={`rounded px-3 py-1 text-sm ${
            activeKind === k ? "bg-slate-900 text-white" : "text-slate-700"
          }`}
          style={{ borderLeft: `4px solid ${typePlacementColour(k)}` }}
        >
          {kindLabel(k)}
        </button>
      ))}
    </div>
  );

  return (
    <>
      <div ref={ref} className="h-full w-full" data-parcel={parcel?.id ?? ""} />
      <Toolbar />
      <Sidebar
        parcel={parcel}
        placements={placements}
        onDeletePlacement={(id) =>
          setPlacements((prev) => prev.filter((p) => p.id !== id))
        }
      />
    </>
  );
}
