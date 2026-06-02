"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import type { Placement } from "@/lib/placements";
import { solveParking, DEFAULT_LANDSCAPING } from "@/lib/parking/solver";
import { rectangleSideLengthsMetres } from "@/lib/parking";
import { rotatePoint } from "@/lib/parking/rotation";
import type { ParkingLayout, Bay, Aisle, Access } from "@/lib/parking/types";

/**
 * BayGrid renders the parking layout for one placement as a Leaflet
 * layer group. Pure DOM/SVG manipulation — React just hands the props
 * to a useEffect that syncs the rectangles.
 *
 * Coordinate transform: solver output is in LOCAL metres from the
 * placement's SW corner. We rotate each local point about the
 * placement's local centroid by `placement.thetaDeg` to get the
 * *visual* position. Then we project the rotated local point to a
 * Leaflet layer point by adding east-axis and south-axis pixel
 * vectors from the placement's NW corner.
 *
 * Bounds (in lat/lng) stay unrotated; only the rendered rects
 * rotate. This keeps the data model simple: `bounds` is the
 * unrotated enclosing rectangle, `thetaDeg` is a visual transform.
 */
interface Props {
  map: L.Map | null;
  placement: Placement;
}

const COLOURS = {
  bay: "#ffffff",
  bayStroke: "#1d4ed8", // blue-700
  aisle: "#1e3a8a", // blue-900
  aisleStroke: "#0f172a", // slate-900
  access: "#fbbf24", // amber-400
  accessStroke: "#a16207", // amber-700
} as const;

export default function BayGrid({ map, placement }: Props) {
  // SVG node refs so re-renders can update attributes in place, no churn.
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const bayRefs = useRef<L.Rectangle[]>([]);
  const aisleRefs = useRef<L.Rectangle[]>([]);
  const accessRefs = useRef<L.Rectangle[]>([]);

  useEffect(() => {
    if (!map) return;

    const isCarpark = placement.kind === "carpark";
    const { width, length } = rectangleSideLengthsMetres(placement);
    const layout: ParkingLayout = isCarpark
      ? solveParking({ widthM: width, lengthM: length }, {
          landscapingFraction: DEFAULT_LANDSCAPING,
        })
      : { bays: [], aisles: [], access: [], warnings: [], style: "none", summary: { totalBays: 0, standardBays: 0, accessibleBays: 0, grossAreaM2: 0, efficiency: 0 } };

    // Local centroid (in placement-local metres) is the rotation pivot.
    const cx = width / 2;
    const cy = length / 2;
    const theta = placement.thetaDeg ?? 0;

    // Build the layer group + initial rectangles.
    const group = L.layerGroup();
    const newBayRects: L.Rectangle[] = [];
    const newAisleRects: L.Rectangle[] = [];
    const newAccessRects: L.Rectangle[] = [];

    const corners = cornersOf(placement);
    for (const b of layout.bays) {
      const r = makeRectAt(map, corners, b, cx, cy, theta);
      r.setStyle({
        color: COLOURS.bayStroke,
        weight: 0.5,
        fillColor: COLOURS.bay,
        fillOpacity: 1,
      });
      group.addLayer(r);
      newBayRects.push(r);
    }
    for (const a of layout.aisles) {
      const r = makeRectAt(map, corners, a, cx, cy, theta);
      r.setStyle({
        color: COLOURS.aisleStroke,
        weight: 0.5,
        fillColor: COLOURS.aisle,
        fillOpacity: 0.55,
      });
      group.addLayer(r);
      newAisleRects.push(r);
    }
    for (const a of layout.access) {
      const r = makeRectAt(map, corners, a, cx, cy, theta);
      r.setStyle({
        color: COLOURS.accessStroke,
        weight: 0.5,
        fillColor: COLOURS.access,
        fillOpacity: 0.85,
      });
      group.addLayer(r);
      newAccessRects.push(r);
    }

    group.addTo(map);
    layerGroupRef.current = group;
    bayRefs.current = newBayRects;
    aisleRefs.current = newAisleRects;
    accessRefs.current = newAccessRects;

    // Re-position every time the map view changes (zoom, pan, etc.)
    // because the local→leaflet transform depends on the current view.
    const reposition = () => {
      const c = cornersOf(placement);
      for (let i = 0; i < layout.bays.length; i++) {
        const newBounds = boundsForRect(map, c, layout.bays[i], cx, cy, theta);
        if (newBounds) bayRefs.current[i]?.setBounds(newBounds);
      }
      for (let i = 0; i < layout.aisles.length; i++) {
        const newBounds = boundsForRect(map, c, layout.aisles[i], cx, cy, theta);
        if (newBounds) aisleRefs.current[i]?.setBounds(newBounds);
      }
      for (let i = 0; i < layout.access.length; i++) {
        const newBounds = boundsForRect(map, c, layout.access[i], cx, cy, theta);
        if (newBounds) accessRefs.current[i]?.setBounds(newBounds);
      }
    };
    map.on("move zoom zoomend viewreset moveend resize", reposition);

    return () => {
      map.off("move zoom zoomend viewreset moveend resize", reposition);
      map.removeLayer(group);
      layerGroupRef.current = null;
      bayRefs.current = [];
      aisleRefs.current = [];
      accessRefs.current = [];
    };
    // We intentionally depend on placement (rebuild on change) and the map
    // identity. The map object's identity is stable for the map's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, placement.id, placement.kind, placement.thetaDeg, placement.bounds.north, placement.bounds.south, placement.bounds.east, placement.bounds.west]);

  return null;
}

interface Corners {
  nw: L.LatLng;
  ne: L.LatLng;
  sw: L.LatLng;
  se: L.LatLng;
  /** Pixel position of nw. */
  nwPx: L.Point;
  /** Pixel vector from nw to ne (east axis, 1m). */
  eastPerMetre: L.Point;
  /** Pixel vector from nw to sw (south axis, 1m). */
  southPerMetre: L.Point;
}

function cornersOf(p: Placement): Corners {
  const { north, south, east, west } = p.bounds;
  const nw = L.latLng(north, west);
  const ne = L.latLng(north, east);
  const sw = L.latLng(south, west);
  const se = L.latLng(south, east);
  return { nw, ne, sw, se, nwPx: L.point(0, 0), eastPerMetre: L.point(0, 0), southPerMetre: L.point(0, 0) };
}

function makeRectAt(
  map: L.Map,
  c: Corners,
  rect: Bay | Aisle | Access,
  cx: number,
  cy: number,
  thetaDeg: number
): L.Rectangle {
  const bounds = boundsForRect(map, c, rect, cx, cy, thetaDeg);
  if (!bounds) {
    return L.rectangle([[0, 0], [0, 0]], { interactive: false });
  }
  return L.rectangle(bounds, { interactive: false });
}

function boundsForRect(
  map: L.Map,
  c: Corners,
  rect: Bay | Aisle | Access,
  cx: number,
  cy: number,
  thetaDeg: number
): L.LatLngBoundsExpression | null {
  if (!map) return null;
  const nwPx = map.latLngToLayerPoint(c.nw);
  const nePx = map.latLngToLayerPoint(c.ne);
  const swPx = map.latLngToLayerPoint(c.sw);
  const widthM = Math.max(
    haversineMetres(c.nw.lat, c.nw.lng, c.ne.lat, c.ne.lng),
    1e-6
  );
  const lengthM = Math.max(
    haversineMetres(c.nw.lat, c.nw.lng, c.sw.lat, c.sw.lng),
    1e-6
  );
  const eastPerPxX = (nePx.x - nwPx.x) / widthM; // pixels per metre, east
  const eastPerPxY = (nePx.y - nwPx.y) / widthM;
  const southPerPxX = (swPx.x - nwPx.x) / lengthM;
  const southPerPxY = (swPx.y - nwPx.y) / lengthM;

  // Rotate the rect's local (x, y) about the placement's local centroid
  // (cx, cy) by thetaDeg. The rotated point is still expressed in
  // placement-local metres; the projection step is unchanged.
  const p0Local = rotatePoint(rect.x, rect.y, cx, cy, thetaDeg);
  const p1Local = rotatePoint(rect.x + rect.w, rect.y + rect.h, cx, cy, thetaDeg);

  // South bay y starts at 0; north bay y is negative (above the aisle).
  const x0 = nwPx.x + p0Local.x * eastPerPxX + p0Local.y * southPerPxX;
  const y0 = nwPx.y + p0Local.x * eastPerPxY + p0Local.y * southPerPxY;
  const x1 = nwPx.x + p1Local.x * eastPerPxX + p1Local.y * southPerPxX;
  const y1 = nwPx.y + p1Local.x * eastPerPxY + p1Local.y * southPerPxY;

  const p0 = map.layerPointToLatLng(L.point(x0, y0));
  const p1 = map.layerPointToLatLng(L.point(x1, y1));
  return [
    [Math.min(p0.lat, p1.lat), Math.min(p0.lng, p1.lng)],
    [Math.max(p0.lat, p1.lat), Math.max(p0.lng, p1.lng)],
  ];
}

function haversineMetres(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
