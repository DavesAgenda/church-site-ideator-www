"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "@geoman-io/leaflet-geoman-free";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import type { Parcel } from "@/lib/types";
import type { Placement, PlacementKind, PlacementBounds } from "@/lib/placements";
import { typePlacementColour, kindLabel } from "@/lib/placements";
import Sidebar from "./Sidebar";
import SearchBar from "./SearchBar";
import BayGrid from "./BayGrid";
import { loadViewport, saveViewport, saveParcelAndPlacements } from "@/lib/viewport/persistence";
import { isValidState } from "@/lib/persistence";
import type { GeocodeResult } from "@/lib/geocode/nominatim";

const STORAGE_KEY_V2 = "church-site-ideator:v2";

/**
 * Main map view. Mounts Leaflet, geoman, search bar, parking layout
 * overlay, and the sidebar. Hydrates from the v2 localStorage state.
 *
 * Refactor notes (parity phase):
 *   - activeKindRef: lets the shift-drag handler read the current kind
 *     without re-binding the entire effect on every toolbar click. The
 *     earlier [activeKind] dep caused a 1-frame map flicker on every
 *     toolbar selection. Now zero re-binds.
 *   - placements ref: the shift-drag mouseup reads the latest placements
 *     array via a ref, not the closure. Same reason.
 *   - viewport: loaded from localStorage on mount, saved on moveend.
 *   - BayGrid: one per carpark placement, mounted as a child so React
 *     tracks the children array and re-renders only when a placement
 *     changes.
 */
export default function MapView() {
  const ref = useRef<HTMLDivElement>(null);
  const [parcel, setParcel] = useState<Parcel | null>(null);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [activeKind, setActiveKind] = useState<PlacementKind>("carpark");
  const [dismissedWarnings, setDismissedWarnings] = useState<Set<string>>(new Set());
  const [map, setMap] = useState<L.Map | null>(null);

  const parcelLayerRef = useRef<L.Polygon | null>(null);
  const rectLayerMapRef = useRef<Map<string, L.Rectangle>>(new Map());
  const placementsRef = useRef<Placement[]>([]);
  const activeKindRef = useRef<PlacementKind>("carpark");
  const hydratedRef = useRef(false);

  // Keep refs in sync with state.
  useEffect(() => { placementsRef.current = placements; }, [placements]);
  useEffect(() => { activeKindRef.current = activeKind; }, [activeKind]);

  // ---- Map mount (runs once) ----
  useEffect(() => {
    if (!ref.current) return;

    // Load viewport before creating the map so the initial view is correct.
    const initial = loadViewport();
    const map = L.map(ref.current, {
      center: initial.center,
      zoom: initial.zoom,
    });
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 20, attribution: "Tiles &copy; Esri" }
    ).addTo(map);
    setMap(map);

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

    let drawnLayer: L.Polygon | null = null;

    map.on("pm:create", (e: { layer: L.Layer }) => {
      if (drawnLayer) map.removeLayer(drawnLayer);
      drawnLayer = e.layer as L.Polygon;
      const latlngs = (drawnLayer.getLatLngs()[0] as L.LatLng[])
        .map((p) => [p.lng, p.lat] as [number, number]);
      latlngs.push(latlngs[0]);
      const next: Parcel = {
        id: crypto.randomUUID(),
        name: "Church block",
        ring: latlngs,
      };
      parcelLayerRef.current = drawnLayer;
      setParcel(next);
    });

    map.on("pm:remove", () => {
      drawnLayer = null;
      parcelLayerRef.current = null;
      setParcel(null);
    });

    // ---- Shift-drag placement drawing ----
    // Reads activeKind from activeKindRef (not closure) so toolbar clicks
    // don't require re-binding the entire handler set.
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
          color: typePlacementColour(activeKindRef.current),
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
      const kind = activeKindRef.current;
      const count = placementsRef.current.filter((p) => p.kind === kind).length + 1;
      const id = crypto.randomUUID();
      const name = `${kindLabel(kind)} ${count}`;
      const placement: Placement = {
        id, kind, name,
        bounds: { south, west, north, east },
        thetaDeg: 0,
      };
      const rect = L.rectangle(
        [[south, west], [north, east]],
        { color: typePlacementColour(kind), weight: 2, fillOpacity: 0.3 }
      ).bindTooltip(name).addTo(map);
      rectLayerMapRef.current.set(id, rect);
      setPlacements((prev) => [...prev, placement]);
    });

    // ---- Drag-to-move on existing rectangles ----
    let dragId: string | null = null;
    let dragStart: L.LatLng | null = null;
    let dragStartBounds: PlacementBounds | null = null;

    map.on("mousedown", (e: L.LeafletMouseEvent) => {
      if (e.originalEvent.shiftKey) return; // drawing mode
      const target = e.originalEvent.target as HTMLElement | null;
      if (!target) return;
      // Walk up looking for a leaflet-interactive rectangle bound to a placement.
      let el: HTMLElement | null = target;
      while (el && !el.classList?.contains("leaflet-interactive")) {
        el = el.parentElement;
      }
      if (!el) return;
      // Find the matching rect layer by its internal _leaflet_id mapping.
      // (Leaflet exposes this via the renderer; the simplest reliable match
      // is to test each rect's getElement() === el.)
      for (const [id, rect] of rectLayerMapRef.current.entries()) {
        if (rect.getElement() === el) {
          dragId = id;
          dragStart = e.latlng;
          const p = placementsRef.current.find((x) => x.id === id);
          if (p) dragStartBounds = { ...p.bounds };
          map.dragging.disable();
          map.boxZoom.disable();
          return;
        }
      }
    });
    map.on("mousemove", (e: L.LeafletMouseEvent) => {
      if (!dragId || !dragStart || !dragStartBounds) return;
      const dLat = e.latlng.lat - dragStart.lat;
      const dLng = e.latlng.lng - dragStart.lng;
      const nb: PlacementBounds = {
        south: dragStartBounds.south + dLat,
        north: dragStartBounds.north + dLat,
        west: dragStartBounds.west + dLng,
        east: dragStartBounds.east + dLng,
      };
      const rect = rectLayerMapRef.current.get(dragId);
      if (rect) rect.setBounds([[nb.south, nb.west], [nb.north, nb.east]]);
    });
    map.on("mouseup", () => {
      if (!dragId || !dragStartBounds) return;
      const rect = rectLayerMapRef.current.get(dragId);
      if (rect) {
        const b = rect.getBounds();
        const nb: PlacementBounds = {
          south: b.getSouth(),
          west: b.getWest(),
          north: b.getNorth(),
          east: b.getEast(),
        };
        setPlacements((prev) =>
          prev.map((p) => (p.id === dragId ? { ...p, bounds: nb } : p))
        );
      }
      dragId = null;
      dragStart = null;
      dragStartBounds = null;
      map.dragging.enable();
      map.boxZoom.enable();
    });

    // ---- Viewport autosave ----
    const onMoveEnd = () => {
      const c = map.getCenter();
      saveViewport({ center: [c.lat, c.lng], zoom: map.getZoom() });
    };
    map.on("moveend", onMoveEnd);

    // ---- One-time hydration from v2 localStorage ----
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY_V2);
        if (raw) {
          const s = JSON.parse(raw);
          if (isValidState(s)) {
            if (s.parcel) {
              const latlngs = s.parcel.ring.map(([lng, lat]) =>
                L.latLng(lat, lng)
              );
              parcelLayerRef.current = L.polygon(latlngs, {
                color: "#0ea5e9",
                weight: 3,
                fillOpacity: 0.1,
              })
                .bindTooltip(s.parcel.name)
                .addTo(map);
              setParcel(s.parcel);
            }
            s.placements.forEach((p) => {
              const rect = L.rectangle(
                [
                  [p.bounds.south, p.bounds.west],
                  [p.bounds.north, p.bounds.east],
                ],
                {
                  color: typePlacementColour(p.kind),
                  weight: 2,
                  fillOpacity: 0.3,
                }
              )
                .bindTooltip(p.name)
                .addTo(map);
              rectLayerMapRef.current.set(p.id, rect);
            });
            setPlacements(s.placements);
          }
        }
      } catch {
        // Ignore hydration errors.
      }
    }

    return () => {
      map.off("moveend", onMoveEnd);
      map.remove();
      setMap(null);
      parcelLayerRef.current = null;
      rectLayerMapRef.current.clear();
      hydratedRef.current = false;
    };
    // Mount-once effect. No deps so the map is never torn down.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave: when parcel or placements change, write them through the
  // viewport-aware helper so the viewport field is preserved.
  useEffect(() => {
    saveParcelAndPlacements(parcel, placements);
  }, [parcel, placements]);

  // Pan-to-placement handler for the sidebar.
  const handlePanToPlacement = useCallback((b: PlacementBounds) => {
    if (!map) return;
    map.fitBounds(
      [
        [b.south, b.west],
        [b.north, b.east],
      ],
      { padding: [40, 40], maxZoom: 20 }
    );
  }, [map]);

  // Search-result handler: pan and zoom to the geocoded point.
  const handleSearchSelect = useCallback((r: GeocodeResult) => {
    if (!map) return;
    map.setView([r.lat, r.lon], 19, { animate: true });
  }, [map]);

  // Delete handler: drop the rectangle from the map and update state.
  const handleDelete = useCallback((id: string) => {
    const rect = rectLayerMapRef.current.get(id);
    if (rect && map) map.removeLayer(rect);
    rectLayerMapRef.current.delete(id);
    setPlacements((prev) => prev.filter((p) => p.id !== id));
  }, [map]);

  const handleDismissWarning = useCallback((key: string) => {
    setDismissedWarnings((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }, []);

  return (
    <>
      <div ref={ref} className="h-full w-full" data-parcel={parcel?.id ?? ""} />
      <SearchBar onSelect={handleSearchSelect} />
      <Toolbar activeKind={activeKind} onChange={setActiveKind} />
      <Sidebar
        parcel={parcel}
        placements={placements}
        onDeletePlacement={handleDelete}
        onPanToPlacement={handlePanToPlacement}
        onDismissWarning={handleDismissWarning}
        dismissedWarnings={dismissedWarnings}
      />
      {/* BayGrid overlay: one per carpark placement. */}
      {map &&
        placements
          .filter((p) => p.kind === "carpark")
          .map((p) => <BayGrid key={p.id} map={map} placement={p} />)}
    </>
  );
}

interface ToolbarProps {
  activeKind: PlacementKind;
  onChange: (k: PlacementKind) => void;
}

function Toolbar({ activeKind, onChange }: ToolbarProps) {
  return (
    <div className="absolute left-1/2 top-2 z-[1000] flex -translate-x-1/2 gap-1 rounded bg-white p-1 shadow">
      {(["carpark", "building", "greenspace"] as PlacementKind[]).map((k) => (
        <button
          key={k}
          onClick={() => onChange(k)}
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
}
