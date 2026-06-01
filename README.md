# Church Site Ideator

A lightweight, browser-based tool for sketching site plans on a satellite map.
Designed for non-developers on a church planning committee to ideate layout
options (car park size, building footprint, green space) without paying for a
commercial feasibility tool like TestFit.

Built with Next.js, TypeScript, Tailwind, Leaflet, and Esri World Imagery
satellite tiles. No API key. No billing. No backend. All data stays in
localStorage on your machine.

## Features

- **Draw the church block** with the polygon tool in the top-left
- **Search for an address** with the top-centre search bar (Nominatim)
- **Sketch car parks, buildings, and green spaces** with shift-drag rectangles
- **Drag a placed rectangle** to reposition it on the map
- **Live bay grid visualisation** — each car park shows the solver's layout:
  standard bays, central drive aisle, building-edge access lane
- **Per-placement cards** in the sidebar with bay count, layout style,
  efficiency (bays/100m²)
- **Live area calculations** in square metres for the parcel and each
  placement
- **Site totals** — developed vs. undeveloped, coverage %, total bays
- **Solver warnings** — e.g. "rectangle is too narrow for a row of bays"
- **Containment warning** if a placement extends outside the church block
- **Default centre at 33 Hamilton St, Grantham Farm NSW 2765** — the
  home page opens there, ready to be drawn over
- **Viewport persistence** — the last pan/zoom survives page refreshes
- **Survives page refreshes** via localStorage
- **No API keys, no billing, no accounts**

## Quick start

```bash
pnpm install
pnpm dev
```

Open <http://localhost:3000>. The map starts centred on Grantham Farm NSW
(default: -33.6736, 150.8699, zoom 18). The polygon tool is in the top-left
of the map (the pentagon-shaped icon). Click to add points, click the first
point (or hit Enter) to close the polygon and set the church block.

Hold **Shift** and drag on the map to place rectangles. Use the toolbar at the
top to switch between Car park, Building, and Green space. Click an existing
rectangle and drag to move it.

Use the address bar at the top-centre to jump to a different church site.

## Scripts

| Command | Purpose |
|---|---|
| `pnpm dev` | Start the dev server on <http://localhost:3000> |
| `pnpm build` | Production build |
| `pnpm start` | Serve the production build |
| `pnpm test` | Run the vitest suite (93 tests) |
| `pnpm lint` | Run ESLint |

## Project layout

```
app/                              Next.js App Router pages
  page.tsx                        Renders the MapView
  layout.tsx                      Root layout, loads CSS
  globals.css                     Tailwind + Leaflet CSS imports
components/
  MapView.tsx                     Server component that imports the client view
  MapView.client.tsx              The map, drawing, search, persistence
  Sidebar.tsx                     Right-side panel: parcel info, placement
                                  cards, site totals, warnings
  BayGrid.tsx                     SVG overlay rendering bays/aisle/access
                                  for each carpark placement
  SearchBar.tsx                   Address search (Nominatim) with recents
  PlacementList.tsx               (deprecated; folded into Sidebar)
lib/
  types.ts                        Parcel, LonLat, LinearRing + isParcel guard
  area.ts                         turf.area wrapper, ringAreaSquareMetres
  placements.ts                   Placement type, isPlacement, colours, labels
  parking.ts                      BAY, AISLE, rectangleSideLengthsMetres,
                                  estimateBays shim (wraps solver)
  parking/
    solver.ts                     The real solver: two-row + aisle + access
    types.ts                      ParkingLayout, Bay, Aisle, Access, etc.
    solver.test.ts                39 tests covering geometry, edge cases,
                                  regression against the old shim
  containment.ts                  rectOutsideRing, rectFullyInsideRing
  persistence.ts                  v2 localStorage serialise/deserialise,
                                  v1->v2 migration
  viewport/
    persistence.ts                load/save viewport, with v1->v2 migration
  geocode/
    nominatim.ts                  searchAddress(query, signal?)
    cache.ts                      LRU of recent queries (10 entries)
  *.test.ts                       vitest unit tests for each module
docs/
  plans/                          Implementation plans (MVP, parity phase)
  MAP_PROVIDER_SWAP.md            How to swap Leaflet+Esri for Google Maps
```

## What's out of scope

This is a **lightweight ideation tool**, not a compliance tool. It will not
produce council-ready drawings, DA submissions, or surveyed measurements. For
those, hire a town planner or use TestFit, Spacemaker, or similar.

The parking bay count is a quick estimate using standard bay/aisle dimensions
- it does not account for landscaping islands, disabled bays, loading zones,
or council-mandated setbacks. See `lib/parking/solver.ts` for the exact
algorithm.

## Map provider

The default is **Leaflet + Esri World Imagery** (free, no API key, same
satellite feed as Google Maps). If you ever want to switch to Google Maps or
Mapbox, see [docs/MAP_PROVIDER_SWAP.md](docs/MAP_PROVIDER_SWAP.md).

The address search uses **OpenStreetMap Nominatim** (free, no API key).
The "Search by OpenStreetMap Nominatim" attribution is shown under the
search bar as required by the Nominatim usage policy.

## Tech stack

- Next.js 14 (App Router)
- React 18, TypeScript strict
- Tailwind CSS
- Leaflet 1.9 + leaflet-geoman (polygon drawing)
- @turf/turf (area, point-in-polygon)
- vitest (unit tests)

## License

Pick whatever you want. Built for the user's church committee.
