# church-site-ideator — parity phase 2: rotation + generative re-layout

**Status:** draft for sign-off  
**Author:** Hermes, after Tinmut's pivot on 2026-06-02

## Why this exists

Tinmut's screenshot showed a 67m × 67m car park that scored only **2.3
bays/100m²** and **116 bays**. The reference case (36m × 18m) scored **4.3
bays/100m²** and 28 bays. Same algorithm, dramatically worse result, because
the current solver picks the longest axis as the aisle direction and the
square has no preferred axis to choose.

Tinmut's actual ask: emulate the TestFit demo, where you declare the entire
block as car park and as you drop buildings the carpark shape and bay count
update in real time.

This plan lands it in two passes:

1. **Pass 1: rotation.** Add `theta` to placements; solver runs in local
   coords; BayGrid rotates the output. The square case above would improve
   automatically because the user can rotate the car park to align with the
   long access road.
2. **Pass 2: generative re-layout.** On every building/greenspace add,
   move, or delete, the solver re-runs and the bay count + sidebar update
   without the user touching the car park. (Same axis-aligned rectangle
   placement, but the model treats buildings inside the carpark as
   exclusions and the solver masks the affected bays.)

Both passes use a `theta` of 0 by default. v1 placements without `theta`
load fine (migrated on read).

## What changes for the user

Today:
- Draw block → shift-drag car park → see bays.
- Drop a building inside the car park rectangle. **Nothing happens.** The
  bays render on top of the building.

After pass 1:
- Same as today, plus a small rotation handle on each placement
  rectangle. Drag to rotate. Bay grid rotates with it.

After pass 2:
- Same as pass 1, plus: drop a building inside a car park rectangle →
  bays in the building's footprint vanish immediately, bay count in
  sidebar updates, coverage % updates. Move the building → bays
  reappear/disappear live. Delete the building → bays return. Greenspace
  does the same (the planner can carve out a green corner).

## Architecture

### Pass 1 — rotation

**Data model** (`lib/placements.ts`):
- Add `thetaDeg: number` to `Placement`. Default 0.
- `isPlacement` accepts missing `thetaDeg` (migrated on read).
- Bounds remain in unrotated lat/lng space; the renderer applies theta.

**Solver** (`lib/parking/solver.ts`):
- No change. The solver is geometry-agnostic. It takes
  `{ widthM, lengthM }` and returns local-coord bays. The rotation is
  applied at render time.

**BayGrid** (`components/BayGrid.tsx`):
- Add `thetaDeg` from the placement. Build a 2D rotation matrix, apply
  to every bay/aisle/access corner before projecting to leaflet layer
  points. Use a single SVG `transform="rotate(theta cx cy)"` wrapper
  around the existing SVG, where `(cx, cy)` is the placement centroid.
- The placement rectangle itself already rotates with the rect layer
  (Leaflet's `setRotationAngle` extension, or we render it via SVG).

**Rotation handle** (`components/RotationHandle.tsx`, new):
- A small circle at the placement's NE corner, offset ~20px on screen.
- On mousedown → start drag, capture starting angle from placement
  centroid to pointer, delta from initial theta.
- On mousemove → compute new theta, throttle to 60Hz, update placement
  state.
- On mouseup → commit; persistence autosave fires.

**MapView.client.tsx**:
- Add rotation handle as a child of each placement (or use the new
  `L.SVG` based render).

### Pass 2 — generative re-layout

**Idea**: when a building or greenspace placement is *inside* a car park
placement, treat the intersection region as an exclusion. Solver still
runs on the unrotated rectangle, but the renderer masks out bays/aisle
that fall within the exclusion polygon.

**Better idea** (the one we will build):
- Solver still runs on the rectangle.
- Compute the **intersection polygon** of each building/greenspace with
  the carpark rectangle.
- For each bay whose centre is inside the intersection polygon, drop
  the bay from the rendered layout. Same for aisle segments.
- The summary (totalBays, efficiency) in the solver output already
  doesn't know about exclusions. Add a **post-solve filter step** that
  walks the layout, drops the masked bays, and reports the new count.
- Place this in a new module `lib/parking/exclusions.ts` so the solver
  stays pure and the filter is easy to test in isolation.

**Why this approach**:
- Solver is still pure. Easy to test.
- The render is the source of truth for "what's drawn", so we just
  drop the masked bays from the SVG before the layer points are
  computed.
- Adding more exclusion kinds (driveways, stormwater, future
  landscaping islands) is a 1-line change.
- The architectural cost is small: a single function that takes a
  layout + list of exclusion polygons → filtered layout.

**Exclusions** (`lib/parking/exclusions.ts`):
- `applyExclusions(layout, exclusions): ParkingLayout`
  - Walks bays, drops any whose centroid is inside any exclusion polygon.
  - Walks aisles, splits or drops segments that cross an exclusion.
    (V1: just drop aisle if any bay was dropped. Good enough for the
    TestFit feel.)
  - Walks access, drops if any bay was dropped.
  - Recomputes summary: totalBays, standardBays, accessibleBays, gross
    unchanged, **efficiency computed on net developed area
    `(gross - sum(exclusion∩carpark))`**, not gross.

**MapView.client.tsx**:
- For each carpark placement, pass `exclusions = placements.filter(p =>
  p.kind !== "carpark" && bbox-overlaps-or-contains p.bounds).map(p =>
  rectToPolygon(p.bounds))` to BayGrid.
- BayGrid applies exclusions and renders.

**Sidebar**:
- Per-placement card for the carpark shows: gross area, net developed
  area, **excluded area**, totalBays (post-filter), efficiency
  (post-filter).
- Site totals: net developed (sum of post-exclusion carpark areas),
  coverage % (net / parcel).

### Data model migration

`isPlacement` accepts both shapes:
- v1: `{ id, kind, name, bounds }`
- v2: `{ id, kind, name, bounds, thetaDeg?: number }` (thetaDeg is
  optional, default 0)

Persisted v2 state in localStorage gets the placement migration on
read, before validation. If any placement is missing `thetaDeg`,
`migrateV1toV2` injects `thetaDeg: 0`.

## Out of scope (deliberately)

These are easy follow-ups but not in this plan:

- **Polygon carparks.** Carpark placement stays an axis-aligned
  rectangle. To go polygonal we'd need a polygon-clipping solver; the
  data model is set up to extend later.
- **Live drag rotation of the carpark rectangle** (vs corner handle).
  Corner handle is enough for now.
- **Disabled bay allocation.** All bays are "standard" until we ship
  accessible bay placement.
- **Snap to road angle.** We could use Overpass to query the nearest
  road and suggest a rotation. Worth a future cron.
- **Multi-storey layout.** No.
- **Landscaping islands at row ends.** No.

## Build order

1. `lib/placements.ts` — add `thetaDeg` and `isPlacement` migration.
   Add tests.
2. `components/BayGrid.tsx` — add rotation transform. Add tests for
   the rotation matrix (deterministic, just check corner points).
3. `components/RotationHandle.tsx` — new component. Renders, drag,
   commit. Tests for the angle math.
4. `MapView.client.tsx` — mount RotationHandle per placement, pass
   `thetaDeg` to BayGrid, wire the rotation state.
5. `lib/parking/exclusions.ts` — `applyExclusions`. Tests cover
   centroid-in-polygon, multi-exclusion, edge cases (bay exactly on
   boundary, exclusion that covers the whole carpark).
6. `MapView.client.tsx` — compute exclusions per carpark, pass to
   BayGrid.
7. `BayGrid.tsx` — apply exclusions to the rendered layout. Recompute
   summary locally.
8. `Sidebar.tsx` — show net area, excluded area, post-exclusion
   efficiency.
9. Smoke test live, push, verify Vercel.

Estimated time: pass 1 in one sitting (1-2 hours), pass 2 in one
sitting (3-4 hours).

## What success looks like

Pass 1: drag the rotation handle on a 20m × 20m placement, the bay
grid rotates with it, the sidebar bay count updates if the rotation
flips which axis is the long one.

Pass 2: drop a 5m × 5m building inside a 20m × 20m car park. The 4
bays closest to the building's centre disappear. Sidebar reports
"4 bays" instead of "16 bays" with no further input. Drag the
building — bay count updates live. Delete the building — bays
reappear.
