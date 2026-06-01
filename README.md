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
- **Sketch car parks, buildings, and green spaces** with shift-drag rectangles
- **Live area calculations** in square metres
- **Estimated parking bay count** for each car park (standard 2.5m x 5m bays,
  6m two-way aisles, ~10% landscaping)
- **Containment warning** if a placement extends outside the church block
- **Survives page refreshes** via localStorage
- **No API keys, no billing, no accounts**

## Quick start

```bash
pnpm install
pnpm dev
```

Open <http://localhost:3000>. The map starts centred on Sydney; pan and zoom
to your church. The polygon tool is in the top-left of the map (the
pentagon-shaped icon). Click to add points, click the first point (or hit
Enter) to close the polygon and set the church block.

Hold **Shift** and drag on the map to place rectangles. Use the toolbar at the
top to switch between Car park, Building, and Green space.

## Scripts

| Command | Purpose |
|---|---|
| `pnpm dev` | Start the dev server on <http://localhost:3000> |
| `pnpm build` | Production build |
| `pnpm start` | Serve the production build |
| `pnpm test` | Run the vitest suite (23 tests) |
| `pnpm lint` | Run ESLint |

## Project layout

```
app/                       Next.js App Router pages
  page.tsx                 Renders the MapView
  layout.tsx               Root layout, loads CSS
  globals.css              Tailwind + Leaflet CSS imports
components/
  MapView.tsx              Server component that imports the client view
  MapView.client.tsx       The map, drawing, persistence (all the work)
  Sidebar.tsx              Right-side panel: parcel info, placements, warnings
  PlacementList.tsx        List of placements in the sidebar
lib/
  types.ts                 Parcel, LonLat, LinearRing + isParcel guard
  area.ts                  turf.area wrapper, ringAreaSquareMetres
  placements.ts            Placement type, isPlacement, colours, labels
  parking.ts               BAY, AISLE, estimateBays, rectangleSideLengthsMetres
  containment.ts           rectOutsideRing, rectFullyInsideRing
  persistence.ts           localStorage serialise/deserialise
  *.test.ts                vitest unit tests for each module
docs/
  plans/                   The original implementation plan
  MAP_PROVIDER_SWAP.md     How to swap Leaflet+Esri for Google Maps or Mapbox
```

## What's out of scope

This is a **lightweight ideation tool**, not a compliance tool. It will not
produce council-ready drawings, DA submissions, or surveyed measurements. For
those, hire a town planner or use TestFit, Spacemaker, or similar.

The parking bay count is a quick estimate using standard bay/aisle dimensions
- it does not account for landscaping islands, disabled bays, loading zones,
or council-mandated setbacks.

## Map provider

The default is **Leaflet + Esri World Imagery** (free, no API key, same
satellite feed as Google Maps). If you ever want to switch to Google Maps or
Mapbox, see [docs/MAP_PROVIDER_SWAP.md](docs/MAP_PROVIDER_SWAP.md).

## Tech stack

- Next.js 14 (App Router, static export)
- React 18, TypeScript strict
- Tailwind CSS
- Leaflet 1.9 + leaflet-geoman (polygon drawing)
- @turf/turf (area, point-in-polygon)
- vitest (unit tests)

## License

Pick whatever you want. Built for the user's church committee.
