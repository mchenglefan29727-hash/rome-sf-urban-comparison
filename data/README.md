# Rome GIS data notes

`rome-regions.geojson` contains 14 interactive region polygons.

## Attribute provenance
The numerical attributes (area, positive/negative count, net investment score,
normalized score, normalized grade, positive percentage, size-agnostic grade)
are transcribed from the uploaded Rome-SF paper tables.

## Geometry provenance
The uploaded DOCX contains a raster figure of the 14 Augustan regions, not the
original GIS polygon dataset. The polygons in this folder were manually
digitized from that figure and georeferenced using the paper's stated bounding
box:

- Latitude: 41.870 to 41.915
- Longitude: 12.460 to 12.520

Use these polygons for interactive presentation and exploratory visualization,
not as authoritative survey-grade boundaries.

`rome-regions.js` contains the same GeoJSON assigned to browser globals so the
site can work without a local-file fetch.
