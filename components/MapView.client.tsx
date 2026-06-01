"use client";
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "@geoman-io/leaflet-geoman-free";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import type { Parcel } from "@/lib/types";

export default function MapView() {
  const ref = useRef<HTMLDivElement>(null);
  const [parcel, setParcel] = useState<Parcel | null>(null);
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

    return () => { map.remove(); };
  }, []);
  return <div ref={ref} className="h-full w-full" data-parcel={parcel?.id ?? ""} />;
}
