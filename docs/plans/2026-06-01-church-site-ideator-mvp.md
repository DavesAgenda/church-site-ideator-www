# Church Site Ideator - MVP Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Build a browser-based tool that lets the church committee sketch a church block on a satellite map, drag rectangles for buildings / car parks / green space, and get an instant parking-bay count estimate so they can quickly ideate development options without paying for TestFit.

**Architecture:** Single-page Next.js app (App Router, TypeScript, Tailwind). Leaflet renders an Esri World Imagery satellite basemap (no API key, no billing). Polygon drawing + rectangle placement is done with Leaflet.draw + custom drag handlers. Parking optimisation runs entirely client-side in TypeScript using @turf/turf for the geometry maths. All state persists to localStorage so a session survives a refresh. No backend.

**Tech Stack:**
- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- Leaflet + leaflet-draw (or @geoman-io/leaflet-geoman-free) for drawing
- Esri World Imagery as the satellite tile source (free, no key)
- @turf/turf for polygon area / point-in-polygon / boolean ops
- vitest for unit tests
- pnpm for package management

**Why not Google Maps JS API:** Requires a billing-enabled Google Cloud project. Esri World Imagery is the same satellite feed the church committee would see in Google Maps, free, no key, no surprise bills. The map provider is isolated behind a single `<MapView>` component so we can swap to Mapbox or Google later if needed.

---

## Out of Scope (YAGNI)

- Multi-user collaboration / sharing links
- Server-side persistence
- Authentication
- Exporting to DWG/CAD
- Building height / floor area calcs beyond simple footprint
- Compliance checks (setbacks, easements, fire access)
- Mobile-optimised touch drawing (desktop-first; will work on tablet but not tuned)

---

## Repo Location

`C:\dev\church-site-ideator` (Windows) - this is a standalone repo, not under Valid-Agenda.

---

## Task 1: Initialise Next.js project with TypeScript and Tailwind

**Objective:** Scaffold a runnable Next.js 14 app in `C:\dev\church-site-ideator`.

**Files:**
- Create: `C:\dev\church-site-ideator\package.json`
- Create: `C:\dev\church-site-ideator\tsconfig.json`
- Create: `C:\dev\church-site-ideator\next.config.mjs`
- Create: `C:\dev\church-site-ideator\postcss.config.mjs`
- Create: `C:\dev\church-site-ideator\tailwind.config.ts`
- Create: `C:\dev\church-site-ideator\app\layout.tsx`
- Create: `C:\dev\church-site-ideator\app\page.tsx`
- Create: `C:\dev\church-site-ideator\app\globals.css`
- Create: `C:\dev\church-site-ideator\.gitignore`

**Step 1: Create package.json**

```json
{
  "name": "church-site-ideator",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "next": "14.2.5",
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "leaflet": "1.9.4",
    "@geoman-io/leaflet-geoman-free": "2.18.3",
    "@turf/turf": "7.1.0"
  },
  "devDependencies": {
    "@types/leaflet": "1.9.12",
    "@types/node": "20.14.10",
    "@types/react": "18.3.3",
    "@types/react-dom": "18.3.0",
    "autoprefixer": "10.4.19",
    "eslint": "8.57.0",
    "eslint-config-next": "14.2.5",
    "postcss": "8.4.39",
    "tailwindcss": "3.4.6",
    "typescript": "5.5.3",
    "vitest": "2.0.2"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

**Step 3: Create next.config.mjs**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};
export default nextConfig;
```

**Step 4: Create postcss.config.mjs**

```js
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
```

**Step 5: Create tailwind.config.ts**

```ts
import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
};
export default config;
```

**Step 6: Create app/globals.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #__next { height: 100%; margin: 0; }
```

**Step 7: Create app/layout.tsx**

```tsx
import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Church Site Ideator",
  description: "Lightweight site planning for church development",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900">{children}</body>
    </html>
  );
}
```

**Step 8: Create app/page.tsx**

```tsx
export default function Home() {
  return (
    <main className="flex h-full items-center justify-center">
      <h1 className="text-2xl font-semibold">Church Site Ideator</h1>
    </main>
  );
}
```

**Step 9: Create .gitignore**

```
node_modules/
.next/
out/
*.log
.DS_Store
.env*.local
.vercel
coverage/
```

**Step 10: Install and verify**

```bash
cd C:\dev\church-site-ideator
pnpm install
pnpm dev
```

Open http://localhost:3000 - expect the heading "Church Site Ideator" centred on the page.

**Step 11: Initialise git and commit**

```bash
cd C:\dev\church-site-ideator
git init
git add .
git commit -m "chore: scaffold next.js + tailwind + typescript"
```

---

## Task 2: Add Leaflet map with Esri satellite tiles

**Objective:** Render a full-screen satellite map of Sydney by default (configurable later) using Leaflet and Esri World Imagery.

**Files:**
- Create: `components/MapView.tsx`
- Create: `components/MapView.client.tsx` (wrapper that only loads on the client)
- Create: `app/page.tsx` (replace placeholder)
- Create: `vitest.config.ts`

**Step 1: Create components/MapView.client.tsx**

```tsx
"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export default function MapView() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const map = L.map(ref.current, {
      center: [-33.8688, 151.2093], // Sydney CBD default
      zoom: 17,
      zoomControl: true,
    });
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 20,
        attribution:
          "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
      }
    ).addTo(map);
    return () => { map.remove(); };
  }, []);
  return <div ref={ref} className="h-full w-full" />;
}
```

**Step 2: Create components/MapView.tsx (server-friendly wrapper)**

```tsx
"use client";
import dynamic from "next/dynamic";
const Inner = dynamic(() => import("./MapView.client"), { ssr: false });
export default function MapView() { return <Inner />; }
```

**Step 3: Replace app/page.tsx**

```tsx
import MapView from "@/components/MapView";
export default function Home() {
  return <main className="h-screen w-screen"><MapView /></main>;
}
```

**Step 4: Create vitest.config.ts**

```ts
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { environment: "node", include: ["lib/**/*.test.ts"] },
});
```

**Step 5: Run dev server and verify**

```bash
cd C:\dev\church-site-ideator
pnpm dev
```

Open http://localhost:3000 - expect a full-screen satellite map of Sydney. Drag to pan, scroll to zoom. No console errors.

**Step 6: Commit**

```bash
git add .
git commit -m "feat(map): add leaflet + esri satellite basemap"
```

---

## Task 3: Parcel drawing with leaflet-geoman

**Objective:** User can click points on the satellite map to trace a polygon outlining the church block. Polygon is rendered in a distinct colour and stored in React state.

**Files:**
- Create: `lib/types.ts`
- Modify: `components/MapView.client.tsx`
- Create: `lib/types.test.ts`

**Step 1: Write failing test for Parcel type**

Create `lib/types.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isParcel } from "./types";

describe("isParcel", () => {
  it("accepts a valid parcel polygon", () => {
    const p = {
      id: "p1",
      name: "Church block",
      ring: [
        [151.2093, -33.8688],
        [151.2095, -33.8688],
        [151.2095, -33.8690],
        [151.2093, -33.8690],
        [151.2093, -33.8688],
      ],
    };
    expect(isParcel(p)).toBe(true);
  });
  it("rejects a parcel with fewer than 3 unique points", () => {
    const p = { id: "p1", name: "x", ring: [[1, 2], [1, 2], [1, 2]] };
    expect(isParcel(p)).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd C:\dev\church-site-ideator
pnpm test
```
Expected: FAIL - `Cannot find module './types'`

**Step 3: Create lib/types.ts**

```ts
export type LonLat = [number, number]; // [longitude, latitude]
export type LinearRing = LonLat[];

export interface Parcel {
  id: string;
  name: string;
  ring: LinearRing; // closed ring, first point repeated at end
}

export function isParcel(value: unknown): value is Parcel {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== "string" || typeof v.name !== "string") return false;
  if (!Array.isArray(v.ring)) return false;
  if (v.ring.length < 4) return false; // closed ring needs >= 4 points
  return v.ring.every(
    (p) => Array.isArray(p) && p.length === 2 &&
      p.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}
```

**Step 4: Run test to verify it passes**

```bash
pnpm test
```
Expected: 2 passed

**Step 5: Add polygon drawing to MapView.client.tsx**

Replace the entire content of `components/MapView.client.tsx`:

```tsx
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
```

**Step 6: Run dev server and verify**

```bash
pnpm dev
```

Open http://localhost:3000, use the polygon tool in the top-left to draw a shape on the map. The shape should render in blue. Use the trash tool to remove it.

**Step 7: Commit**

```bash
git add .
git commit -m "feat(parcel): polygon drawing with geoman"
```

---

## Task 4: Sidebar with parcel info and area calculation

**Objective:** Show a sidebar on the right that displays the drawn parcel's area in square metres using @turf/turf.

**Files:**
- Create: `lib/area.ts`
- Create: `lib/area.test.ts`
- Create: `components/Sidebar.tsx`
- Modify: `components/MapView.client.tsx` (lift parcel state to a small store)

**Step 1: Write failing test for area calculation**

Create `lib/area.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { ringAreaSquareMetres } from "./area";

describe("ringAreaSquareMetres", () => {
  it("returns a small positive area for a tiny square in Sydney", () => {
    const ring: [number, number][] = [
      [151.2093, -33.8688],
      [151.2094, -33.8688],
      [151.2094, -33.8689],
      [151.2093, -33.8689],
      [151.2093, -33.8688],
    ];
    const a = ringAreaSquareMetres(ring);
    // ~111m x ~111m ~= 12,300 m^2 (we just want positive and in a sensible range)
    expect(a).toBeGreaterThan(10_000);
    expect(a).toBeLessThan(15_000);
  });
  it("returns 0 for a degenerate ring", () => {
    const ring: [number, number][] = [[1, 1], [1, 1], [1, 1]];
    expect(ringAreaSquareMetres(ring)).toBe(0);
  });
});
```

**Step 2: Run test - expect failure**

```bash
pnpm test
```

**Step 3: Create lib/area.ts**

```ts
import * as turf from "@turf/turf";
import type { LinearRing } from "./types";

export function ringAreaSquareMetres(ring: LinearRing): number {
  if (ring.length < 4) return 0;
  const poly = turf.polygon([ring]);
  return turf.area(poly); // returns m^2
}
```

**Step 4: Run test - expect pass**

```bash
pnpm test
```

**Step 5: Create components/Sidebar.tsx**

```tsx
"use client";
import { useMemo } from "react";
import type { Parcel } from "@/lib/types";
import { ringAreaSquareMetres } from "@/lib/area";

interface Props {
  parcel: Parcel | null;
}

export default function Sidebar({ parcel }: Props) {
  const area = useMemo(
    () => (parcel ? ringAreaSquareMetres(parcel.ring) : 0),
    [parcel]
  );
  return (
    <aside className="absolute right-0 top-0 z-[1000] h-full w-72 bg-white p-4 shadow-lg">
      <h2 className="text-lg font-semibold">Site</h2>
      {parcel ? (
        <div className="mt-2 space-y-2 text-sm">
          <div>
            <span className="text-slate-500">Name:</span> {parcel.name}
          </div>
          <div>
            <span className="text-slate-500">Area:</span>{" "}
            {area.toLocaleString(undefined, { maximumFractionDigits: 0 })} m&sup2;
          </div>
          <div className="text-xs text-slate-400">
            ({Math.round(area / 10).toLocaleString()} m&sup2; approx)
          </div>
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-500">
          Use the polygon tool (top-left) to draw the church block outline.
        </p>
      )}
    </aside>
  );
}
```

**Step 6: Modify MapView.client.tsx to render Sidebar**

Add at the top of the component function (above the `return`):
```tsx
const [parcel, setParcel] = useState<Parcel | null>(null);
```

Then update the return statement to:
```tsx
return (
  <>
    <div ref={ref} className="h-full w-full" />
    <Sidebar parcel={parcel} />
  </>
);
```

And add the import at the top:
```tsx
import Sidebar from "./Sidebar";
```

**Step 7: Verify in browser**

```bash
pnpm dev
```

Draw a polygon - the sidebar should show the area in m². Refresh the page - the polygon disappears (persistence is Task 8).

**Step 8: Commit**

```bash
git add .
git commit -m "feat(sidebar): parcel name and area in m^2"
```

---

## Task 5: Rectangle placement (car park, building, green space)

**Objective:** Add three drag-and-drop rectangle types: Car Park, Building, Green Space. Each can be drawn anywhere inside or outside the parcel and shows up in the sidebar with its area and type.

**Files:**
- Create: `lib/placements.ts`
- Create: `lib/placements.test.ts`
- Create: `components/PlacementList.tsx`
- Modify: `components/MapView.client.tsx`
- Modify: `components/Sidebar.tsx`

**Step 1: Write failing test for placement type**

Create `lib/placements.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isPlacement, typePlacementColour } from "./placements";

describe("isPlacement", () => {
  it("accepts a car park placement", () => {
    const p = {
      id: "pl1", kind: "carpark" as const, name: "CP1",
      bounds: { south: -33.869, west: 151.209, north: -33.868, east: 151.210 },
    };
    expect(isPlacement(p)).toBe(true);
  });
  it("rejects unknown kind", () => {
    const p = { id: "pl1", kind: "sauna", name: "x", bounds: {} };
    expect(isPlacement(p)).toBe(false);
  });
});

describe("typePlacementColour", () => {
  it("returns blue for carpark", () => {
    expect(typePlacementColour("carpark")).toBe("#2563eb");
  });
  it("returns grey for building", () => {
    expect(typePlacementColour("building")).toBe("#475569");
  });
  it("returns green for green space", () => {
    expect(typePlacementColour("greenspace")).toBe("#16a34a");
  });
});
```

**Step 2: Run test - expect failure**

```bash
pnpm test
```

**Step 3: Create lib/placements.ts**

```ts
export type PlacementKind = "carpark" | "building" | "greenspace";

export interface PlacementBounds {
  south: number; west: number; north: number; east: number;
}

export interface Placement {
  id: string;
  kind: PlacementKind;
  name: string;
  bounds: PlacementBounds;
}

const KINDS: PlacementKind[] = ["carpark", "building", "greenspace"];

export function isPlacement(value: unknown): value is Placement {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== "string" || typeof v.name !== "string") return false;
  if (!KINDS.includes(v.kind as PlacementKind)) return false;
  if (!v.bounds || typeof v.bounds !== "object") return false;
  const b = v.bounds as Record<string, unknown>;
  return ["south", "west", "north", "east"].every(
    (k) => typeof b[k] === "number" && Number.isFinite(b[k] as number)
  );
}

export function typePlacementColour(kind: PlacementKind): string {
  switch (kind) {
    case "carpark": return "#2563eb"; // blue-600
    case "building": return "#475569"; // slate-600
    case "greenspace": return "#16a34a"; // green-600
  }
}

export function kindLabel(kind: PlacementKind): string {
  switch (kind) {
    case "carpark": return "Car park";
    case "building": return "Building";
    case "greenspace": return "Green space";
  }
}
```

**Step 4: Run test - expect pass**

```bash
pnpm test
```

**Step 5: Modify components/MapView.client.tsx**

Add to imports:
```tsx
import type { Placement, PlacementKind } from "@/lib/placements";
import { typePlacementColour, kindLabel } from "@/lib/placements";
import PlacementList from "./PlacementList";
```

Inside the component, add state:
```tsx
const [placements, setPlacements] = useState<Placement[]>([]);
const [activeKind, setActiveKind] = useState<PlacementKind>("carpark");
```

After the geoman controls setup, add three buttons somewhere visible (we'll add a small floating toolbar):
```tsx
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
```

After `map.on("pm:create", ...)` add a click handler to draw a rectangle for the active kind. We use Leaflet directly (not geoman) so we can colour each kind:
```tsx
let drawOrigin: L.LatLng | null = null;
let drawRect: L.Rectangle | null = null;
map.on("mousedown", (e: L.LeafletMouseEvent) => {
  if (e.originalEvent.shiftKey) { // hold shift to draw placement, avoid clashing with geoman polygon tool
    drawOrigin = e.latlng;
  }
});
map.on("mousemove", (e: L.LeafletMouseEvent) => {
  if (!drawOrigin) return;
  if (drawRect) map.removeLayer(drawRect);
  drawRect = L.rectangle([drawOrigin, e.latlng], {
    color: typePlacementColour(activeKind),
    weight: 2, fillOpacity: 0.3,
  }).addTo(map);
});
map.on("mouseup", (e: L.LeafletMouseEvent) => {
  if (!drawOrigin) return;
  const a = drawOrigin, b = e.latlng;
  drawOrigin = null;
  if (drawRect) { map.removeLayer(drawRect); drawRect = null; }
  const bounds: [L.LatLngTuple, L.LatLngTuple] = [
    [Math.min(a.lat, b.lat), Math.min(a.lng, b.lng)],
    [Math.max(a.lat, b.lat), Math.max(a.lng, b.lng)],
  ];
  const south = bounds[0][0], west = bounds[0][1];
  const north = bounds[1][0], east = bounds[1][1];
  const count = placements.filter((p) => p.kind === activeKind).length + 1;
  setPlacements((prev) => [
    ...prev,
    {
      id: crypto.randomUUID(),
      kind: activeKind,
      name: `${kindLabel(activeKind)} ${count}`,
      bounds: { south, west, north, east },
    },
  ]);
});
```

Update the return:
```tsx
return (
  <>
    <div ref={ref} className="h-full w-full" />
    <Toolbar />
    <Sidebar parcel={parcel} placements={placements} />
  </>
);
```

**Step 6: Create components/PlacementList.tsx**

```tsx
"use client";
import type { Placement } from "@/lib/placements";
import { kindLabel } from "@/lib/placements";

interface Props {
  placements: Placement[];
  onDelete: (id: string) => void;
}

export default function PlacementList({ placements, onDelete }: Props) {
  if (placements.length === 0) return null;
  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold">Placements</h3>
      <ul className="mt-1 space-y-1 text-sm">
        {placements.map((p) => (
          <li key={p.id} className="flex items-center justify-between">
            <span>{p.name} <span className="text-slate-400">({kindLabel(p.kind)})</span></span>
            <button
              onClick={() => onDelete(p.id)}
              className="text-xs text-red-600 hover:underline"
            >
              delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

**Step 7: Update Sidebar.tsx**

Change Props to:
```tsx
import type { Placement } from "@/lib/placements";
interface Props {
  parcel: Parcel | null;
  placements: Placement[];
}
```

And accept `onDeletePlacement` prop and render `<PlacementList>`. Full new file:

```tsx
"use client";
import { useMemo } from "react";
import type { Parcel } from "@/lib/types";
import { ringAreaSquareMetres } from "@/lib/area";
import type { Placement } from "@/lib/placements";
import PlacementList from "./PlacementList";

interface Props {
  parcel: Parcel | null;
  placements: Placement[];
  onDeletePlacement: (id: string) => void;
}

export default function Sidebar({ parcel, placements, onDeletePlacement }: Props) {
  const area = useMemo(
    () => (parcel ? ringAreaSquareMetres(parcel.ring) : 0),
    [parcel]
  );
  return (
    <aside className="absolute right-0 top-0 z-[1000] h-full w-72 bg-white p-4 shadow-lg">
      <h2 className="text-lg font-semibold">Site</h2>
      {parcel ? (
        <div className="mt-2 space-y-1 text-sm">
          <div><span className="text-slate-500">Name:</span> {parcel.name}</div>
          <div>
            <span className="text-slate-500">Area:</span>{" "}
            {area.toLocaleString(undefined, { maximumFractionDigits: 0 })} m&sup2;
          </div>
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-500">
          Use the polygon tool (top-left) to draw the church block outline.
        </p>
      )}
      <PlacementList placements={placements} onDelete={onDeletePlacement} />
      <p className="mt-4 text-xs text-slate-500">
        Hold <kbd className="rounded bg-slate-100 px-1">Shift</kbd> and drag on the map
        to place a rectangle using the selected type.
      </p>
    </aside>
  );
}
```

**Step 8: Wire `onDeletePlacement` in MapView.client.tsx**

Change the Sidebar usage to:
```tsx
<Sidebar
  parcel={parcel}
  placements={placements}
  onDeletePlacement={(id) =>
    setPlacements((prev) => prev.filter((p) => p.id !== id))
  }
/>
```

**Step 9: Verify in browser**

```bash
pnpm dev
```

- Top toolbar shows three buttons (Car park / Building / Green space), colour-coded
- Select "Car park", shift-drag on the map -> blue rectangle appears
- Select "Building", shift-drag -> grey rectangle
- Select "Green space", shift-drag -> green rectangle
- Each shows in the sidebar list with a delete button

**Step 10: Commit**

```bash
git add .
git commit -m "feat(placement): shift-drag rectangle placement for 3 kinds"
```

---

## Task 6: Parking bay count estimation

**Objective:** Given a car park rectangle, estimate how many standard parking bays it can fit using bay size, drive aisle width, and percentage lost to landscaping.

**Files:**
- Create: `lib/parking.ts`
- Create: `lib/parking.test.ts`
- Modify: `components/Sidebar.tsx`

**Step 1: Write failing test**

Create `lib/parking.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { estimateBays, BAY, AISLE } from "./parking";

describe("estimateBays", () => {
  it("a 30m x 20m rectangle with no landscaping fits ~22 bays", () => {
    // 30m x 20m = 600m^2
    // Bays 2.5m x 5m, two rows, aisle 6m, lose 10% to landscaping
    // Row depth 5m each side, aisle 6m => 16m for cars, plus landscaping
    const bays = estimateBays(30, 20, 0.1);
    expect(bays).toBeGreaterThan(15);
    expect(bays).toBeLessThan(30);
  });
  it("a tiny rectangle fits zero bays", () => {
    expect(estimateBays(4, 2, 0)).toBe(0);
  });
  it("a 10m x 5m rectangle fits at least a couple of single-row bays", () => {
    expect(estimateBays(10, 5, 0)).toBeGreaterThanOrEqual(2);
  });
});

describe("constants", () => {
  it("BAY is 2.5m x 5m", () => {
    expect(BAY.width).toBe(2.5);
    expect(BAY.length).toBe(5);
  });
  it("AISLE is 6m wide for two-way traffic", () => {
    expect(AISLE.width).toBe(6);
  });
});
```

**Step 2: Run test - expect failure**

```bash
pnpm test
```

**Step 3: Create lib/parking.ts**

```ts
import { ringAreaSquareMetres } from "./area";
import type { Placement } from "./placements";

export const BAY = { width: 2.5, length: 5 } as const;
export const AISLE = { width: 6 } as const;

/**
 * Approximate parking bay count for a rectangle of given width/length in metres.
 * Strategy:
 *   - Treat the longer side as the aisle direction.
 *   - Two rows of bays flank the aisle, each bay is BAY.length deep.
 *   - Bays per row = floor(aisle-direction / BAY.width).
 *   - Total = bays per row * 2.
 *   - Subtract landscaping fraction from the effective area and recalculate if needed.
 */
export function estimateBays(
  widthM: number,
  lengthM: number,
  landscapingFraction: number
): number {
  if (widthM < BAY.length * 2 + AISLE.width) return 0;
  const w = Math.min(widthM, lengthM);   // aisle direction
  const l = Math.max(widthM, lengthM);   // row depth direction
  const baysPerRow = Math.floor(w / BAY.width);
  if (baysPerRow === 0) return 0;
  const rowDepth = BAY.length;
  const aisleWidth = AISLE.width;
  // Effective length after subtracting landscaping proportional to area
  const effectiveL = l * (1 - landscapingFraction);
  const rows = Math.max(0, Math.floor((effectiveL - aisleWidth) / rowDepth));
  return baysPerRow * rows;
}

export function rectangleSideLengthsMetres(p: Placement): { width: number; length: number } {
  // Compute the two side lengths of the bounds rectangle using turf.
  // Use a small turf measure: distance between opposite corners is diagonal, but we want sides.
  // For axis-aligned lat/lng bounds the side distances are not constant per degree, so use turf.
  const w = ringAreaSquareMetres([
    [p.bounds.west, p.bounds.south],
    [p.bounds.east, p.bounds.south],
    [p.bounds.east, p.bounds.north],
    [p.bounds.west, p.bounds.north],
    [p.bounds.west, p.bounds.south],
  ]);
  // width^2 = w (rectangle area); length = width^2 / shorter
  // Simpler: compute two segments via turf.distance
  const dx = haversineM(p.bounds.west, p.bounds.south, p.bounds.east, p.bounds.south);
  const dy = haversineM(p.bounds.west, p.bounds.south, p.bounds.west, p.bounds.north);
  void w; // (kept for future per-rectangle area-based rules)
  return { width: dx, length: dy };
}

function haversineM(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
```

**Step 4: Run test - expect pass**

```bash
pnpm test
```

**Step 5: Add bay count to Sidebar**

Add a section in `components/Sidebar.tsx` above `<PlacementList>`:

```tsx
import { estimateBays, rectangleSideLengthsMetres } from "@/lib/parking";
import type { Placement } from "@/lib/placements";
import { kindLabel } from "@/lib/placements";
```

```tsx
const carparkPlacements = placements.filter((p) => p.kind === "carpark");
const totalBays = carparkPlacements.reduce((sum, p) => {
  const { width, length } = rectangleSideLengthsMetres(p);
  return sum + estimateBays(width, length, 0.1);
}, 0);
```

Render this just before PlacementList:
```tsx
{carparkPlacements.length > 0 && (
  <div className="mt-3 rounded bg-blue-50 p-2 text-sm">
    <div className="font-semibold">Parking estimate</div>
    <div>{totalBays} bays total</div>
    <div className="text-xs text-slate-600">~10% landscaping, two-way aisles</div>
  </div>
)}
```

**Step 6: Verify in browser**

Draw a car park rectangle roughly 30m x 20m. The sidebar should show "Parking estimate" with a bay count.

**Step 7: Commit**

```bash
git add .
git commit -m "feat(parking): bay count estimate for car park rectangles"
```

---

## Task 7: Sanity check - parcel containment of placements

**Objective:** Warn the user if any placement extends outside the drawn parcel boundary.

**Files:**
- Create: `lib/containment.ts`
- Create: `lib/containment.test.ts`
- Modify: `components/Sidebar.tsx`

**Step 1: Write failing test**

Create `lib/containment.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { rectFullyInsideRing, rectOutsideRing } from "./containment";

const square: [number, number][] = [
  [0, 0], [10, 0], [10, 10], [0, 10], [0, 0],
];

describe("rectFullyInsideRing", () => {
  it("inside rectangle is fully inside", () => {
    expect(rectFullyInsideRing({ south: 2, west: 2, north: 4, east: 4 }, square)).toBe(true);
  });
  it("rectangle straddling boundary is not fully inside", () => {
    expect(rectFullyInsideRing({ south: -1, west: 2, north: 4, east: 4 }, square)).toBe(false);
  });
});

describe("rectOutsideRing", () => {
  it("rectangle fully inside is not outside", () => {
    expect(rectOutsideRing({ south: 2, west: 2, north: 4, east: 4 }, square)).toBe(false);
  });
  it("rectangle far away is outside", () => {
    expect(rectOutsideRing({ south: 20, west: 20, north: 22, east: 22 }, square)).toBe(true);
  });
});
```

**Step 2: Run test - expect failure**

```bash
pnpm test
```

**Step 3: Create lib/containment.ts**

```ts
import * as turf from "@turf/turf";
import type { LinearRing } from "./types";
import type { PlacementBounds } from "./placements";

function ringToPolygon(ring: LinearRing) {
  return turf.polygon([ring]);
}

export function rectFullyInsideRing(b: PlacementBounds, ring: LinearRing): boolean {
  if (ring.length < 4) return false;
  const poly = ringToPolygon(ring);
  const corners: [number, number][] = [
    [b.west, b.south], [b.east, b.south],
    [b.east, b.north], [b.west, b.north],
  ];
  return corners.every((c) => turf.booleanPointInPolygon(turf.point(c), poly));
}

export function rectOutsideRing(b: PlacementBounds, ring: LinearRing): boolean {
  if (ring.length < 4) return true; // no ring => treat as "outside" to avoid false negative
  const poly = ringToPolygon(ring);
  const corners: [number, number][] = [
    [b.west, b.south], [b.east, b.south],
    [b.east, b.north], [b.west, b.north],
  ];
  return corners.every((c) => !turf.booleanPointInPolygon(turf.point(c), poly));
}
```

**Step 4: Run test - expect pass**

```bash
pnpm test
```

**Step 5: Show containment warning in Sidebar**

In `components/Sidebar.tsx`, add:
```tsx
import { rectOutsideRing } from "@/lib/containment";
```

And compute the warning:
```tsx
const outOfBounds = parcel
  ? placements.filter((p) => rectOutsideRing(p.bounds, parcel.ring))
  : [];
```

Render above the parking estimate:
```tsx
{outOfBounds.length > 0 && (
  <div className="mt-3 rounded bg-amber-50 p-2 text-sm text-amber-800">
    <div className="font-semibold">Outside the church block</div>
    <ul className="list-disc pl-4 text-xs">
      {outOfBounds.map((p) => <li key={p.id}>{p.name}</li>)}
    </ul>
  </div>
)}
```

**Step 6: Verify**

Draw a parcel, then draw a rectangle clearly outside it. The amber warning should appear in the sidebar.

**Step 7: Commit**

```bash
git add .
git commit -m "feat(containment): warn when placement leaves the parcel"
```

---

## Task 8: localStorage persistence

**Objective:** Survive page refreshes. Restore parcel and placements from localStorage.

**Files:**
- Create: `lib/persistence.ts`
- Create: `lib/persistence.test.ts`
- Modify: `components/MapView.client.tsx`

**Step 1: Write failing test**

Create `lib/persistence.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { serialise, deserialise, isValidState } from "./persistence";

const state = {
  parcel: {
    id: "p1", name: "Block",
    ring: [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]] as [number, number][],
  },
  placements: [
    { id: "pl1", kind: "carpark" as const, name: "CP1",
      bounds: { south: 0, west: 0, north: 1, east: 1 } },
  ],
};

describe("persistence", () => {
  it("round-trips a state through serialise/deserialise", () => {
    const json = serialise(state);
    const back = deserialise(json);
    expect(back).toEqual(state);
  });
  it("returns null for invalid JSON", () => {
    expect(deserialise("not json")).toBeNull();
  });
  it("returns null for missing fields", () => {
    expect(deserialise(JSON.stringify({ parcel: null, placements: "x" }))).toBeNull();
  });
  it("isValidState accepts a valid state", () => {
    expect(isValidState(state)).toBe(true);
  });
  it("isValidState rejects bad shape", () => {
    expect(isValidState({ parcel: null, placements: [] })).toBe(false);
  });
});
```

**Step 2: Run test - expect failure**

**Step 3: Create lib/persistence.ts**

```ts
import type { Parcel } from "./types";
import { isParcel } from "./types";
import { isPlacement, type Placement } from "./placements";

export interface PersistedState {
  parcel: Parcel | null;
  placements: Placement[];
}

export function serialise(s: PersistedState): string {
  return JSON.stringify(s);
}

export function deserialise(raw: string): PersistedState | null {
  try {
    const parsed = JSON.parse(raw);
    if (!isValidState(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function isValidState(value: unknown): value is PersistedState {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (v.parcel !== null && !isParcel(v.parcel)) return false;
  if (!Array.isArray(v.placements)) return false;
  return v.placements.every(isPlacement);
}

export const STORAGE_KEY = "church-site-ideator:v1";
```

**Step 4: Run test - expect pass**

**Step 5: Wire persistence into MapView.client.tsx**

Add imports:
```tsx
import { useEffect } from "react";
import { deserialise, isValidState, serialise, STORAGE_KEY, type PersistedState } from "@/lib/persistence";
```

Inside the component, add hydration + autosave effects (right after the useState declarations):
```tsx
useEffect(() => {
  if (typeof window === "undefined") return;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  const s = deserialise(raw);
  if (!s) return;
  setParcel(s.parcel);
  setPlacements(s.placements);
  if (s.parcel) {
    // Re-render the parcel polygon on the map
    const ring = s.parcel.ring;
    const latlngs = ring.map(([lng, lat]) => L.latLng(lat, lng));
    L.polygon(latlngs, { color: "#0ea5e9", weight: 3, fillOpacity: 0.1 })
      .bindTooltip(s.parcel.name)
      .addTo(map);
  }
  s.placements.forEach((p) => {
    L.rectangle(
      [
        [p.bounds.south, p.bounds.west],
        [p.bounds.north, p.bounds.east],
      ],
      { color: typePlacementColour(p.kind), weight: 2, fillOpacity: 0.3 }
    ).bindTooltip(p.name).addTo(map);
  });
}, []); // intentionally empty - runs once on mount

useEffect(() => {
  if (typeof window === "undefined") return;
  const s: PersistedState = { parcel, placements };
  if (!isValidState(s)) return; // skip saving mid-draw
  window.localStorage.setItem(STORAGE_KEY, serialise(s));
}, [parcel, placements]);
```

(Note: this duplicates drawing on the map after hydration. A refactor to a single render source of truth is a Task 9 candidate, not MVP.)

**Step 6: Verify**

Draw a parcel, a few placements, refresh the page. Parcel and placements should reappear.

**Step 7: Commit**

```bash
git add .
git commit -m "feat(persistence): localStorage round-trip"
```

---

## Task 9: (Optional polish) Map provider swap point

**Objective:** Document how to swap Esri for Mapbox or Google Maps JS API without touching app code.

**Files:**
- Create: `docs/maps-provider.md`

**Step 1: Create docs/maps-provider.md**

```markdown
# Swapping the map provider

`components/MapView.client.tsx` owns the basemap. Two constants matter:

## To switch to Google Maps JS API

1. `pnpm add @googlemaps/js-api-loader`
2. Replace the Leaflet setup with:
   ```ts
   const loader = new Loader({ apiKey: process.env.NEXT_PUBLIC_GMAPS_KEY!, version: "weekly" });
   await loader.importLibrary("maps");
   const map = new google.maps.Map(ref.current!, { center: ..., zoom: 17, mapTypeId: "satellite" });
   ```
3. Replace the polygon/rectangle drawing logic with `google.maps.Polygon` and `google.maps.Rectangle`.
4. The geometry maths in `lib/parking.ts` and `lib/containment.ts` are map-agnostic - they take lat/lng ring and bounds objects, so they keep working.

## To switch to Mapbox GL JS

1. `pnpm add mapbox-gl`
2. Replace the Leaflet setup with `new mapboxgl.Map({...})` using the `mapbox/satellite-v9` style.
3. Drawing polygons/rectangles requires the `mapbox-gl-draw` plugin.

## Cost note

Esri World Imagery tiles are free, no key, no billing. Google Maps JS API requires a billing-enabled GCP project ($200/mo free credit, then ~$7/1000 loads). Mapbox gives 50k loads/mo free, then pay-as-you-go.
```

**Step 2: Commit**

```bash
git add docs/
git commit -m "docs(map): provider swap guide"
```

---

## Task 10: README with run instructions

**Files:**
- Create: `README.md`

**Step 1: Create README.md**

```markdown
# Church Site Ideator

Lightweight, browser-based site planning tool for church development discussions.
Built with Next.js, Leaflet, and Esri World Imagery (free, no API key).

## Run

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000.

## Use

1. Use the polygon tool (top-left) to trace the church block.
2. Pick a placement type (Car park / Building / Green space) from the top toolbar.
3. Hold **Shift** and drag on the map to place a rectangle.
4. The sidebar shows parcel area, parking bay estimates, and any out-of-bounds warnings.
5. Your work is saved in localStorage and survives a refresh.

## Test

```bash
pnpm test
```

## Switch map provider

See [docs/maps-provider.md](docs/maps-provider.md).
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: readme with run instructions"
```

---

## Verification Checklist

After all tasks:

- [ ] `pnpm install` succeeds with no errors
- [ ] `pnpm dev` starts on port 3000
- [ ] `pnpm test` shows all tests passing
- [ ] `pnpm build` produces a successful production build
- [ ] Polygon drawing produces a parcel in the sidebar with area
- [ ] Shift-drag produces a rectangle of the selected type with correct colour
- [ ] Car park rectangles show a bay count estimate
- [ ] Out-of-bounds placements show a warning
- [ ] Refresh restores the parcel and placements

## Total Estimated Effort

~6-8 hours for a developer who knows React/TypeScript. About half of that is the geometry maths and tests; the map plumbing is the other half. No backend work. No billing setup. No auth.

## Hand-off

Plan complete and saved to `C:\dev\church-site-ideator\docs\plans\2026-06-01-church-site-ideator-mvp.md`. Ready to execute using subagent-driven-development - I'll dispatch a fresh subagent per task with two-stage review (spec compliance then code quality). Shall I proceed?
