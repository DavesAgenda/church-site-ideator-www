# Map Provider Swap Guide

This project ships with **Leaflet + Esri World Imagery** as the default map
provider. It is free, requires no API key, and uses the same satellite feed
that Google Maps uses for its satellite layer. If you ever want to switch to
Google Maps or Mapbox, this guide walks through the change.

## Why Leaflet + Esri by default

| Provider | API key | Billing required | Satellite quality | Cost at small scale |
|---|---|---|---|---|
| **Leaflet + Esri** (default) | No | No | Excellent (same feed as Google) | Free forever |
| Google Maps JS | Yes | Yes | Excellent | ~$7 per 1,000 loads after $200/mo credit |
| Mapbox GL JS | Yes | Yes | Good | 50,000 monthly map loads free, then metered |
| OpenStreetMap raster | No | No | No satellite (map tiles only) | Free |

For a one-off church committee tool, the default is the right choice. The
steps below are kept short in case you ever do need to switch.

## Option A: Google Maps JS

You will need:

1. A Google Cloud project with billing enabled
2. The Maps JavaScript API enabled
3. An API key restricted to the dev/prod origin

### Code changes

1. Install: `pnpm add @googlemaps/js-api-loader`
2. Remove from `components/MapView.client.tsx`:
   - The `import L from "leaflet"`
   - The two `import "leaflet/dist/leaflet.css"`
   - All `L.tileLayer(...)` and `L.polygon(...)` / `L.rectangle(...)` calls
3. Replace the Leaflet map setup with Google Maps:
   ```ts
   import { Loader } from "@googlemaps/js-api-loader";
   const loader = new Loader({ apiKey: process.env.NEXT_PUBLIC_GMAPS_KEY! });
   const map = await loader.importLibrary("maps").then(g => new g.Map(ref.current!, {
     center: { lat: -33.8688, lng: 151.2093 },
     zoom: 17,
     mapTypeId: "satellite",
   }));
   ```
4. Replace drawing tools. The closest free option to leaflet-geoman for
   Google Maps is `@googlemaps/markerclusterer` for clusters and a custom
   polygon/rectangle drawer, or use the **Drawing library** (deprecated but
   still works in 2026, no billing on the library itself).
5. Update `lib/area.ts` to use the Google Maps Geometry library's
   `google.maps.geometry.spherical.computeArea` instead of `@turf/turf`.
6. Update `lib/containment.ts` to use `google.maps.geometry.poly.containsLocation`
   instead of `turf.booleanPointInPolygon`.
7. Update `lib/parking.ts` `haversineM` to use
   `google.maps.geometry.spherical.computeDistanceBetween`.

### Env

Add to `.env.local` (and Vercel/Netlify project env):
```
NEXT_PUBLIC_GMAPS_KEY=AIza...
```

### Cost reality check

A committee tool that gets ~50 visits in its lifetime will easily fit in the
$200/mo credit. The catch is you must enable billing - Google no longer
offers a "no billing" tier for the Maps JS API.

## Option B: Mapbox GL JS

You will need:

1. A Mapbox account
2. A public access token from the account dashboard

### Code changes

1. Install: `pnpm add mapbox-gl` and `pnpm add -D @types/mapbox-gl`
2. Replace the Leaflet map setup with Mapbox:
   ```ts
   import mapboxgl from "mapbox-gl";
   import "mapbox-gl/dist/mapbox-gl.css";
   mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;
   const map = new mapboxgl.Map({
     container: ref.current!,
     style: "mapbox://styles/mapbox/satellite-streets-v12",
     center: [151.2093, -33.8688], // [lng, lat]
     zoom: 17,
   });
   ```
3. Replace drawing tools. `mapbox-gl-draw` is the standard library:
   `pnpm add @mapbox/mapbox-gl-draw`
4. The geometry libraries (turf) work unchanged - mapbox-gl-draw emits GeoJSON
   features that @turf/turf consumes directly.

### Env

```
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ...
```

### Cost reality check

50,000 monthly map loads are free. After that, $5 per 1,000 loads. Same
small-scale use case as Google: you almost certainly stay under the free tier.

## Recommended: stay on Leaflet + Esri

For this project's scope (one church, one committee, no recurring traffic), the
default Leaflet + Esri provider is the right call. No API key, no billing, no
account to maintain, and the satellite imagery is excellent. Only switch if
you later need a feature that Leaflet cannot provide (3D buildings, street
view, Google Places autocomplete, etc.).
