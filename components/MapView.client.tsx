"use client";
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "@geoman-io/leaflet-geoman-free";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import type { Parcel } from "@/lib/types";
import type { Placement, PlacementKind } from "@/lib/placements";
import { typePlacementColour, kindLabel } from "@/lib/placements";
import { deserialise, isValidState, serialise, STORAGE_KEY, type PersistedState } from "@/lib/persistence";
import Sidebar from "./Sidebar";
import PlacementList from "./PlacementList";

export default function MapView() {
  const ref = useRef<HTMLDivElement>(null);
  const [parcel, setParcel] = useState<Parcel | null>(null);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [activeKind, setActiveKind] = useState<PlacementKind>("carpark");
  const mapRef = useRef<L.Map | null>(null);
  const parcelLayerRef = useRef<L.Polygon | null>(null);
  const rectLayerMapRef = useRef<Map<string, L.Rectangle>>(new Map());
  const hydratedRef = useRef(false);

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
    mapRef.current = map;

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
      const next: Parcel = { id: crypto.randomUUID(), name: "Church block", ring: latlngs };
      parcelLayerRef.current = drawnLayer;
      setParcel(next);
    });

    map.on("pm:remove", () => {
      drawnLayer = null;
      parcelLayerRef.current = null;
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
      const rect = L.rectangle(
        [
          [south, west],
          [north, east],
        ],
        { color: typePlacementColour(activeKind), weight: 2, fillOpacity: 0.3 }
      ).bindTooltip(name).addTo(map);
      rectLayerMapRef.current.set(id, rect);
      setPlacements((prev) => [...prev, placement]);
    });

    // One-time hydration from localStorage, AFTER the map is ready.
    // This is the visual-restore fix: the map is fully created before we read
    // localStorage, so we can immediately redraw the parcel polygon and
    // placement rectangles on the map (not just restore React state).
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      if (typeof window !== "undefined") {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const s = deserialise(raw);
          if (s) {
            // Restore parcel: draw polygon + set state
            // isValidState guarantees parcel is non-null when it returns true
            const restoredParcel = s.parcel!;
            const latlngs = restoredParcel.ring.map(([lng, lat]) => L.latLng(lat, lng));
            parcelLayerRef.current = L.polygon(latlngs, {
              color: "#0ea5e9", weight: 3, fillOpacity: 0.1,
            }).bindTooltip(restoredParcel.name).addTo(map);
            setParcel(restoredParcel);
            // Restore placements: draw rectangles + set state
            s.placements.forEach((p) => {
              const rect = L.rectangle(
                [[p.bounds.south, p.bounds.west], [p.bounds.north, p.bounds.east]],
                { color: typePlacementColour(p.kind), weight: 2, fillOpacity: 0.3 }
              ).bindTooltip(p.name).addTo(map);
              rectLayerMapRef.current.set(p.id, rect);
            });
            setPlacements(s.placements);
          }
        }
      }
    }

    return () => {
      map.remove();
      mapRef.current = null;
      parcelLayerRef.current = null;
      rectLayerMapRef.current.clear();
      hydratedRef.current = false; // reset for next mount
    };
    // placements is intentionally NOT in deps; the closure reads the latest via setPlacements functional update
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKind]);

  // Autosave: write to localStorage whenever parcel or placements change
  useEffect(() => {
    if (typeof window === "undefined") return;
    const s: PersistedState = { parcel, placements };
    if (!isValidState(s)) return;
    window.localStorage.setItem(STORAGE_KEY, serialise(s));
  }, [parcel, placements]);

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
        onDeletePlacement={(id) => {
          // Remove the rectangle from the map so the visual matches React state
          const rect = rectLayerMapRef.current.get(id);
          if (rect && mapRef.current) {
            mapRef.current.removeLayer(rect);
          }
          rectLayerMapRef.current.delete(id);
          setPlacements((prev) => prev.filter((p) => p.id !== id));
        }}
      />
    </>
  );
}
