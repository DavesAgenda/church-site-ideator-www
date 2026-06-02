"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import type { Placement } from "@/lib/placements";
import {
  computeDeltaTheta,
  normaliseDegrees,
  type Point,
} from "@/lib/parking/rotation";

/**
 * RotationHandle is a small draggable circle rendered as an absolutely
 * positioned <div> overlay on the Leaflet map (NOT inside the leaflet
 * pane, so it can receive raw pointer events without leaflet stealing
 * them). The handle sits ~20px outside the placement's NE corner,
 * which moves with the map as the user pans/zooms.
 *
 * Drag math is pure (`computeDeltaTheta` in lib/parking/rotation) and
 * is covered by 22 unit tests. This component wires that math to DOM
 * events and re-projects the handle on every map view change.
 *
 * Touch and mouse are both supported. The drag is started on
 * mousedown/touchstart, updated on mousemove/touchmove (rAF-throttled),
 * and committed on mouseup/touchend. We listen on the document for
 * the move/end events so a fast drag that leaves the handle's element
 * still updates the rotation.
 *
 * The placement rectangle itself is NOT rendered here; that's still
 * MapView's job. This handle just emits new theta values via
 * onRotate, and chunk 2 will wire that into MapView's placement
 * state.
 */
interface Props {
  map: L.Map | null;
  placement: Placement;
  onRotate: (thetaDeg: number) => void;
}

const HANDLE_OFFSET_PX = 28; // distance from NE corner to handle centre
const HANDLE_RADIUS_PX = 10;
const LEADER_LENGTH_PX = 18;
const COLOUR = "#2563eb"; // blue-600, matches placement rect stroke

export default function RotationHandle({
  map,
  placement,
  onRotate,
}: Props) {
  const handleRef = useRef<HTMLDivElement | null>(null);
  const leaderRef = useRef<HTMLDivElement | null>(null);

  // Refs for the in-flight drag so the listeners on document can read
  // the latest values without re-binding.
  const dragRef = useRef<{
    startScreen: Point;
    startCentroid: Point;
    startTheta: number;
    pointerId: number | null;
  } | null>(null);

  const thetaRef = useRef(placement.thetaDeg);
  const onRotateRef = useRef(onRotate);

  useEffect(() => {
    thetaRef.current = placement.thetaDeg;
  }, [placement.thetaDeg]);

  useEffect(() => {
    onRotateRef.current = onRotate;
  }, [onRotate]);

  // 1. Re-position the handle on every map view change. We project the
  //    placement's NE corner to container space, then offset by the
  //    leader length in the direction perpendicular to the placement
  //    rectangle's north edge. The perpendicular vector is derived
  //    from the NW→NE pixel vector.
  useEffect(() => {
    if (!map) return;
    const handle = handleRef.current;
    const leader = leaderRef.current;
    if (!handle || !leader) return;

    const reposition = () => {
      const ne = L.latLng(placement.bounds.north, placement.bounds.east);
      const nw = L.latLng(placement.bounds.north, placement.bounds.west);
      const neContainer = map.latLngToContainerPoint(ne);
      const nwContainer = map.latLngToContainerPoint(nw);
      // Direction "outside" the placement (perpendicular to north edge,
      // pointing north on screen). If the north edge is rotated, this
      // follows the rotation.
      const dx = neContainer.x - nwContainer.x;
      const dy = neContainer.y - nwContainer.y;
      const len = Math.hypot(dx, dy) || 1;
      // Perpendicular to (dx, dy), 90° CCW in screen y-down = (dy, -dx).
      // That points to the side where lat > nw.lat, i.e. "north" of the
      // edge. We want "above" the edge in screen y, which on a normal
      // (unrotated) map is dy > 0 actually ... let me think again.
      // On a y-down screen, "above" means y decreases. The perpendicular
      // to (dx, dy) that points to decreasing-y is (dy, -dx) when dy>0.
      // But on a Leaflet map the perpendicular to the north edge that
      // points OUTSIDE the rect (further from the centroid) is whichever
      // way leads to a smaller y. We pick that by sign of the dot
      // product with the centroid→NE vector.
      const centroid = L.latLng(
        (placement.bounds.north + placement.bounds.south) / 2,
        (placement.bounds.east + placement.bounds.west) / 2
      );
      const centroidContainer = map.latLngToContainerPoint(centroid);
      const outsideX = neContainer.x - centroidContainer.x;
      const outsideY = neContainer.y - centroidContainer.y;
      // Perpendicular candidate 1: (-dy, dx). Candidate 2: (dy, -dx).
      const perp1x = -dy / len;
      const perp1y = dx / len;
      const perp2x = dy / len;
      const perp2y = -dx / len;
      // Pick the one with positive dot product to (outsideX, outsideY).
      const dot1 = perp1x * outsideX + perp1y * outsideY;
      const dot2 = perp2x * outsideX + perp2y * outsideY;
      const px = dot2 > dot1 ? perp2x : perp1x;
      const py = dot2 > dot1 ? perp2y : perp1y;
      const offsetX = px * HANDLE_OFFSET_PX;
      const offsetY = py * HANDLE_OFFSET_PX;
      handle.style.transform = `translate(${neContainer.x + offsetX - HANDLE_RADIUS_PX}px, ${neContainer.y + offsetY - HANDLE_RADIUS_PX}px)`;
      // Leader: from NE corner toward handle centre.
      leader.style.transform = `translate(${neContainer.x}px, ${neContainer.y}px) rotate(${(Math.atan2(py, px) * 180) / Math.PI}deg)`;
      leader.style.width = `${HANDLE_OFFSET_PX}px`;
    };

    reposition();
    map.on("move zoom zoomend viewreset moveend resize", reposition);
    return () => {
      map.off("move zoom zoomend viewreset moveend resize", reposition);
    };
  }, [map, placement.bounds.north, placement.bounds.south, placement.bounds.east, placement.bounds.west]);

  // 2. Drag handlers. Pointer down on the handle starts a drag; we
  //    listen on document for the move/end so a fast drag that leaves
  //    the handle still updates.
  useEffect(() => {
    const handle = handleRef.current;
    if (!handle) return;

    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // L.Map might steal the event if we don't disable it. The
      // handle has CSS pointer-events:auto, the rest of the map
      // is OK because we stopped propagation here.
      const map = (handle as any)._map as L.Map | undefined;
      if (!map) return;
      map.dragging.disable();
      const centroid = L.latLng(
        (placement.bounds.north + placement.bounds.south) / 2,
        (placement.bounds.east + placement.bounds.west) / 2
      );
      const centroidContainer = map.latLngToContainerPoint(centroid);
      dragRef.current = {
        startScreen: { x: e.clientX, y: e.clientY },
        startCentroid: { x: centroidContainer.x, y: centroidContainer.y },
        startTheta: thetaRef.current,
        pointerId: e.pointerId,
      };
      handle.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || (drag.pointerId !== null && e.pointerId !== drag.pointerId))
        return;
      // The centroid in screen space can move when the user pans, but
      // during a drag we don't pan, so currentCentroid == startCentroid.
      const newTheta = computeDeltaTheta(
        drag.startScreen,
        drag.startCentroid,
        { x: e.clientX, y: e.clientY },
        drag.startCentroid,
        drag.startTheta
      );
      const clamped = normaliseDegrees(newTheta);
      thetaRef.current = clamped;
      onRotateRef.current(clamped);
    };

    const onPointerUp = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      try {
        handle.releasePointerCapture(e.pointerId);
      } catch {
        // already released
      }
      // Re-enable map dragging.
      const map = (handle as any)._map as L.Map | undefined;
      if (map) map.dragging.enable();
      dragRef.current = null;
    };

    handle.addEventListener("pointerdown", onPointerDown);
    handle.addEventListener("pointermove", onPointerMove);
    handle.addEventListener("pointerup", onPointerUp);
    handle.addEventListener("pointercancel", onPointerUp);
    return () => {
      handle.removeEventListener("pointerdown", onPointerDown);
      handle.removeEventListener("pointermove", onPointerMove);
      handle.removeEventListener("pointerup", onPointerUp);
      handle.removeEventListener("pointercancel", onPointerUp);
    };
  }, [placement.bounds.north, placement.bounds.south, placement.bounds.east, placement.bounds.west]);

  return (
    <>
      <div
        ref={leaderRef}
        className="pointer-events-none absolute left-0 top-0 origin-left"
        style={{
          height: "1px",
          background: COLOUR,
          transformOrigin: "0 0",
        }}
      />
      <div
        ref={handleRef}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        {...({ _map: map } as any)}
        role="button"
        aria-label="Rotate placement"
        title="Drag to rotate"
        className="absolute left-0 top-0 cursor-grab active:cursor-grabbing"
        style={{
          width: `${HANDLE_RADIUS_PX * 2}px`,
          height: `${HANDLE_RADIUS_PX * 2}px`,
          borderRadius: "50%",
          background: COLOUR,
          border: "2px solid white",
          boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
          touchAction: "none",
        }}
      />
    </>
  );
}

export { LEADER_LENGTH_PX, HANDLE_RADIUS_PX, HANDLE_OFFSET_PX };
