# MAP-RESTORED

This build keeps the map as the primary interface.

## Rome
- OpenStreetMap geographic basemap when online.
- Local Rome GeoJSON polygons remain interactive even if basemap tiles fail.
- All paper-derived numeric values remain unchanged from the data-audited CORRECTED build.

## San Francisco
- OpenStreetMap geographic basemap.
- Exact Mapping Inequality HOLC vector polygons are attempted.
- A transparent, locally bundled HOLC overlay extracted from the uploaded paper is always available inside the map.
- If the vector service is blocked/unavailable, the map is NOT replaced by a static fallback; only the HOLC data layer falls back to the local paper overlay.
- A/B/C/D switching updates both the exact vector filter and the local overlay.

## Static fallback
The full static paper figure is used only if MapLibre itself cannot start.

## Precision note
The local San Francisco overlay is a presentation fallback and is approximately georeferenced to the city extent. It is not used for polygon-level numeric calculations.
