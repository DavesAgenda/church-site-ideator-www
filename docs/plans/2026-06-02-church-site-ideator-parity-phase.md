# Church Site Ideator — Parity Phase Plan

**Date:** 2026-06-02
**Status:** Proposed, awaiting sign-off
**Builds on:** `docs/plans/2026-06-01-church-site-ideator-mvp.md` (MVP shipped at `fdcd5ff` on `main`)
**Target push:** `church-site-ideator-www` on GitHub, Vercel-mounted

## 1. Why this phase exists

The MVP proves the loop works: draw a parcel on satellite, drop rectangles, get a parking estimate. But for the audience (church planning committees) the elevator pitch is "you get TestFit-lite for free in your browser". The MVP is currently TestFit-*zero*. This plan moves us to genuine TestFit parity on the one capability that actually matters to the user — the **parking layout solver**.

Everything else in the plan is plumbing that has to exist *around* the solver for it to be useful: address search, no-jump-on-tab-switch, drag-to-move placements, live bay visualisation. Without those four, the solver is invisible.

## 2. Confirmed bugs (code-verified)

| # | Bug | Root cause in current code |
|---|-----|---------------------------|
| 1 | No address search, wrong default centre | `components/MapView.client.tsx:27` hardcodes `[-33.8688, 151.2093]` (Sydney CBD). No geocoder wiring. |
| 2 | Changing carpark/building/greenspace resets the map | `components/MapView.client.tsx:167` — the giant init `useEffect` lists `[activeKind]` in its dep array, so clicking a toolbar button unmounts and remounts the entire Leaflet map. The `hydratedRef` reset on line 163 confirms the cleanup-then-rebuild pattern. |
| 3 | No live bay visualisation inside carpark rectangles | `components/MapView.client.tsx:114-120` draws each placement as a flat solid-fill `L.rectangle`. `lib/parking.ts` calculates bay counts but only `Sidebar.tsx:22-26` consumes them, and only as a sum. The rectangles themselves show no bays. |
| 4 | Placements can be resized (via geoman edit) but not moved | `components/MapView.client.tsx:37-51` enables `editMode: true` (which exposes vertex handles) but not `dragMode`. There is no handler for moving a placed rectangle as a whole. |

All four are real and reproducible. The plan below fixes them.

## 3. Product north star: the parking solver

TestFit's value is not the polygon-drawing. It is the answer to: *"if I put a car park here, how many bays do I actually get, and how do I lay them out?"* The MVP gives a number; this phase gives a layout.

**Solver contract (proposed, please push back):**

```
solveParking(bounds: PlacementBounds, options?) -> ParkingLayout
```

Where `ParkingLayout` is a JSON shape with:

- `bays: Array<{ x: number; y: number; w: number; h: number; type: 'standard' | 'accessible' }>`
- `aisles: Array<{ x: number; y: number; w: number; h: number; orientation: 'h' | 'v' }>`
- `drives: Array<{ /* perimeter or access roads */ }>`
- `summary: { totalBays, standardBays, accessibleBays, grossAreaM2, efficiency: number /* bays / 100m² */ }`
- `warnings: Array<string>` (e.g. "rectangle too narrow for any standard layout")

The solver is pure: same input, same output, fully unit-testable, no Leaflet dependency. It returns a layout; a separate renderer draws it.

### 3.1 What the solver considers

1. **Aspect ratio** — narrow rectangles get a single-loaded aisle or 90° head-in only; wide rectangles can support 60°/75° angled bays for higher density.
2. **Standard bay geometries** — `2.5m × 5m` at 90° (current default), `2.6m × 5.2m` at 60°, `2.7m × 5.4m` at 45°. Pick the densest that fits the rectangle's row depth with a `6m` two-way aisle (or `3.5m` one-way for small carparks).
3. **Aisle placement** — central aisle for two-row layouts; perimeter drive-aisle for one-row.
4. **End caps / driveways** — at least one `3.5m` wide access lane to the rectangle boundary, modelled so a real architect would not reject it.
5. **Landscaping buffer** — configurable 5–15% reduction in row depth (currently hardcoded to 10% in the MVP). UI slider later.
6. **Accessible bays** — default `1 per 25 standard` (AS 2890.1), placed nearest the rectangle's shortest edge (assumed building access).

### 3.2 MVP-solver scope (what we actually build now)

We do **not** build angled bays, accessibility ratios, or perimeter driveways in this phase. We build:

- A clean, pure, fully-tested solver that takes axis-aligned bounds and returns a 90° layout.
- Renderer: draws bay outlines, central aisle, access lane inside each carpark rectangle.
- Live re-solve: drag a rectangle, solver runs, layout updates, no perceptible lag for typical church-sized carparks (under 200 bays).
- A side panel showing per-rectangle and total metrics: `N bays (M standard) — area efficiency X bays / 100m²`.

Angled bays, AI suggestions, density scoring, and "compare two layouts" all move to the next phase.

**Solver algorithm (corrected, this is what gets built):**

For an axis-aligned rectangle of width `w` (longer side, aisle direction) and length `l` (shorter side, row depth), with landscaping fraction `f = 0.10`:

```
effectiveL = l * (1 - f)

if w < BAY.width:                   → 0 bays, warning
elif effectiveL >= 2*BAY.length + AISLE.width:   # two-side layout
    baysPerRow    = floor(w / BAY.width)         # across the long axis
    sideDepth     = (effectiveL - AISLE.width) / 2
    rowsPerSide   = min(2, floor(sideDepth / BAY.length))
    totalBays     = baysPerRow * rowsPerSide * 2
    # One aisle centred along the length, bays stacked on each side
elif effectiveL >= BAY.length:     # single-side layout
    baysPerRow    = floor(w / BAY.width)
    totalBays     = baysPerRow
else:                                → 0 bays, warning "too shallow"
```

Note: `rowsPerSide` is *per side* of the aisle, not total rows. Earlier sketch in this section conflated the two and would have produced double the correct bay count. The MVP's `estimateBays` in `lib/parking.ts` already uses the correct formula.

**Visual mock:** `docs/mock-solver-2026-06-02.html` (in the repo, for archive/reference) and `public/mock-solver.html` (deployed to Vercel, accessible at `https://church-site-ideator-www.vercel.app/mock-solver.html`). Both run the same solver algorithm against a hand-drawn parcel polygon over the Grantham Farm satellite tiles. They confirm the visual output: 28 bays for a 36m × 18m placement, two-row layout, central 6m drive aisle, 4.3 bays/100m² efficiency, 13.9% coverage of the 4,661 m² parcel. Used as the visual ground-truth for §3 below.

## 4. Non-solver UX work

### 4.1 Default centre and address search

- **Default centre:** `33 Hamilton St, Riverstone NSW 2765` — a real church-site-ish address. Cache `[-33.6793, 150.8702]` (approximate, will geocode precisely on first load) as the default map state. Zoom 18 (church-block scale, not city scale).
- **Address search bar:** fixed to top of the viewport, Leaflet-Geoman style, above the toolbar.
  - Use **Nominatim OpenStreetMap** as the geocoder — free, no API key, attribution required. Endpoint: `https://nominatim.openstreetmap.org/search?format=json&limit=1&q={address}`. CORS-enabled for browser fetches.
  - Throttle to 1 req/300ms. Debounce the input by 400ms.
  - On select: `map.flyTo([lat, lon], 18, { duration: 1.0 })`. No markers dropped — search bar is a viewport control, not a placemark.
  - Cache the last 10 successful queries in `localStorage` so the bar shows recent addresses on return visits. Plain JSON, not a library.
  - Attribution: "Search by OpenStreetMap Nominatim" in the search bar's footer.
- **Coordinate persistence:** store last viewport (`{ center, zoom }`) in `localStorage` under a separate key `STORAGE_VIEWPORT_KEY`, restore on mount, write on `moveend`. This means the map comes back to wherever you left it, not the default.

### 4.2 No-jump on kind switch

The whole bug is that `[activeKind]` is in the init `useEffect` deps. The fix:

- Strip `activeKind` from the dep array. The init effect runs **once**.
- The `mousedown` handler reads `activeKind` from a ref (a `kindRef`) that is kept in sync via a tiny separate effect: `useEffect(() => { kindRef.current = activeKind; }, [activeKind]);`.
- The `mousemove`/`mouseup` handlers read `kindRef.current` instead of the closed-over `activeKind`. The colour for the in-progress drag preview reads from the ref too.

That single refactor removes the map-jump entirely. Bonus: the in-progress drag preview (the moving rectangle following the mouse) now actually updates colour when you switch kinds mid-drag, which is the right behaviour.

### 4.3 Live bay visualisation inside carpark rectangles

Two options. I recommend the second.

**Option A (cheap):** draw bay outlines as a `L.polygon` with multiple sub-rings (true "polygon with holes" pattern). One Leaflet layer per carpark rectangle. Easy, but re-drawing on every bounds change is a full layer replacement and flickers with Leaflet's renderer.

**Option B (chosen):** use an SVG `L.svg()` overlay renderer for the bay grid. Each bay is an `<rect>`, the central aisle is another `<rect>` in a different fill, the access lane is a third. Re-rendering is just attribute updates on existing SVG nodes, no Leaflet layer churn. Pairs naturally with a future "edit a single bay" feature because you can attach click handlers to individual `<rect>` elements.

Renderer is a React component: `<BayGrid bounds={p.bounds} layout={solver(p.bounds)} />` mounted into a Leaflet `SVG` renderer bound to the same map. The component lives in `components/BayGrid.tsx`, owns its own ref + `useEffect` that imperatively syncs the SVG nodes when props change.

The renderer is dumb — it draws what the solver hands it. Solver stays pure and testable.

### 4.4 Drag-to-move placements

Two-phase edit model:

- **Vertex edit (resize):** keep the geoman `editMode: true` for vertex handles on the rectangle. Existing behaviour preserved.
- **Move (drag):** new — when a placement is clicked (not on a vertex handle), the cursor changes to `move` and the user can drag the whole rectangle. Released rectangle snaps to integer-degree-ish bounds (round to 6 decimal places, sub-millimetre precision) and re-runs the solver.

Implementation: detect click-on-rectangle (not on a vertex) via `map.on('pm:edit', ...)` payload + a separate `map.on('click', ...)` that checks `e.originalEvent.target` against the SVG `<rect>` for the placement. Drag delta is tracked in a `mousemove` handler scoped to the drag, and committed on `mouseup` by mutating the placement's `bounds` in React state. The Leaflet rectangle is re-positioned via `setBounds([[south, west], [north, east]])`.

A small visual cue: rectangle's stroke changes from `weight: 2` to `weight: 3` on hover, and a `cursor: move` style applies to the map while dragging.

## 5. Sidebar changes

The sidebar grows but does not bloat. Current sections stay (Site, Outside-the-block, Parking estimate, PlacementList). New sections:

- **Per-placement metrics card** — for each placement: `120 m²` (or `85 m²` etc.), `12 bays` (or `0 — too narrow`), `efficiency 9.2 bays/100m²` (only for carpark kind). Clicking the card pans + zooms the map to fit that placement (`map.fitBounds`).
- **Site totals** — currently a single total. Keep as is. Add: `gross parcel area`, `total developed area` (sum of all placement areas), `undeveloped area` (parcel minus developed), `site coverage %` (developed / parcel). All derived, no new state.
- **Solver warnings** — list of `warnings` from the solver across all placements, e.g. `"Car park 1: rectangle is 4.2m wide, no standard bay fits"`. Amber style, dismissable.

We do not add tabs, accordions, or modals. The sidebar stays a single scrolling column.

## 6. File plan

New files:
- `lib/parking/solver.ts` — the pure solver.
- `lib/parking/solver.test.ts` — exhaustive tests: aspect ratios, edge cases, regression against MVP's `estimateBays` (the solver should return *at least* the same count for every rectangle the MVP handled, plus a layout).
- `lib/parking/types.ts` — `ParkingLayout`, `Bay`, `Aisle`, `Drive`, `SolverOptions`.
- `lib/geocode/nominatim.ts` — the geocoder wrapper. `searchAddress(query: string): Promise<GeocodeResult | null>`.
- `lib/geocode/cache.ts` — localStorage-backed recent-queries cache.
- `components/SearchBar.tsx` — the address search bar.
- `components/BayGrid.tsx` — the SVG renderer.
- `components/SiteTotals.tsx` — pulled out of Sidebar for clarity.
- `lib/viewport/persistence.ts` — viewport save/load helpers.

Modified files:
- `components/MapView.client.tsx` — refactor for kind-switch ref pattern, mount `<BayGrid>` and `<SearchBar>`, default centre, drag-to-move.
- `components/Sidebar.tsx` — new sections, delegate to `SiteTotals`.
- `lib/persistence.ts` — add `viewport` to the persisted state shape, version-bump the storage key from `STORAGE_KEY` to `STORAGE_KEY_V2` (or use a `version` field; I lean toward a version field inside the persisted JSON, with a one-time migration that drops the old `STORAGE_KEY`).
- `lib/types.ts` — no real change; the parcel type stays.
- `package.json` — no new runtime deps. Nominatim is plain fetch. SVG renderer is a Leaflet built-in. We might add `vitest --coverage` as a dev dep, but only if it's already close.

## 7. Test strategy

- Solver: target 95% line coverage. Cases: thin rectangle (under bay width), short rectangle (under bay length), aspect ratios 1:1, 1:2, 1:5, 2:1, 5:1, square parcel, weirdly-shaped rectangle (degenerate bounds), regression against `estimateBays` for all current MVP test fixtures.
- Geocoder: mock `fetch`, assert URL shape, handle network failure, handle 0 results, handle rate-limit (HTTP 429) gracefully.
- BayGrid renderer: snapshot test for a known layout, interaction test for re-render on bounds change.
- MapView integration: not unit-tested (Leaflet + JSDOM is a tar pit). Manual smoke test in the README.

## 8. Sequencing (one sitting)

1. **Refactor kind-switch out of map init** (15 min, fixes bug 2, lowest risk, immediate UX win).
2. **Default centre + viewport persistence** (20 min, fixes bug 1 minus search).
3. **Address search** (45 min, fixes bug 1 fully).
4. **Drag-to-move placements** (45 min, fixes bug 4).
5. **Solver `lib/parking/solver.ts` + tests** (90 min, the meat).
6. **BayGrid renderer + integration** (60 min, fixes bug 3).
7. **Sidebar upgrades** (30 min).
8. **README + final smoke test** (20 min).

Total: ~5 hours of focused work. Realistic for one push.

## 9. Out of scope (explicit)

To prevent scope creep mid-build, these are *deferred to a later phase*, not omitted by accident:

- Angled bays (60°, 45°, 75°).
- Accessibility bay ratios and AS 2890.1 compliance.
- Perimeter driveways, entry/exit modelling, vehicle swept paths.
- "What if" comparison between two layouts.
- AI-assisted suggestions ("try moving this 3m east to gain 4 bays").
- Undo/redo beyond browser's native Ctrl-Z on text inputs.
- Multi-parcel support (church + adjacent land).
- Export to PDF, SVG, or DXF. (This will be the next ask from a real committee — note for the post-phase plan.)
- Real-time collaboration. localStorage is single-user; no CRDT, no Yjs, no backend. The MVP and this phase both deliberately stay zero-backend.

## 10. Risk register

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Nominatim rate-limits (1 req/s, no key) | Medium | Throttle + debounce + recent-queries cache means we almost never hit the network. Fail soft: error toast, map stays put. |
| Leaflet SVG overlay z-order vs tile layer | Low | SVG renderer is on top by default in Leaflet. If it z-fights with the toolbar, bump `pane: 'overlayPane'` to a custom pane with `zIndex: 400`. |
| Solver perf on huge rectangles | Low | Cap solver iterations. A 200m × 200m rectangle (~4 hectares) should solve in < 50ms in JS. If it's slower, switch to a single-pass greedy and revisit. |
| `STORAGE_KEY_V2` migration breaks existing users | Low | Read both old and new keys, prefer new, write back, drop old on next save. |
| Drag-to-move fights with geoman vertex edit | Medium | Use `pm:edit` event to detect "user is mid-edit" and suppress the drag-to-move handler during that window. Add an explicit `isEditingRef` to gate the move handler. |

## 11. Definition of done

- All four user-reported bugs fixed and confirmed in a manual smoke test on the deployed Vercel URL.
- Solver unit tests pass; coverage report attached to the PR.
- No new runtime dependencies in `package.json`.
- README updated with: address search usage, drag-to-move gesture, bay grid explanation, solver scope and limits.
- `git push` to `church-site-ideator-www` triggers a Vercel deploy that succeeds.
- One short screen recording (under 60s) showing: address search → drop parcel → drop carpark → see live bay grid → drag to a different spot → see bay count update. Attach to the kanban ticket.

## 12. Open questions for you

1. **Solver depth confirmation:** am I right that you want a real solver (returns a layout, not just a count), and that the TestFit-style live re-solve on drag is the headline feature? If you'd rather keep the MVP's "just give me a number" approach and add a static visual layout, say the word — the plan collapses by ~3 hours.
2. **Geocoder choice:** Nominatim is free and zero-config, but it's slow (~300ms typical) and has a vague usage policy. Worth considering Mapbox Geocoding or Google Places if speed matters. I lean Nominatim for the "no API key, no billing" ethos in the README, but happy to switch.
3. **Default centre value:** is the literal "33 Hamilton St, Riverstone NSW 2765" the canonical starting point, or is there a real church address in your orbit that should be the demo seed? I default to that because it's a real, geocodable address with a clear church-block-shaped lot on the satellite imagery.
4. **Rotation:** do you want rectangles to be rotatable (90° increments) in this phase, or is axis-aligned enough for v1? Rotation adds ~1 hour and meaningfully improves solver quality on irregular parcels. I'd include it if you want the "real TestFit feel".
