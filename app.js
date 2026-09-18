
(() => {
  "use strict";

  const MAP_STYLE = {
    version: 8,
    name: "Research basemap",
    sources: {
      osm: {
        type: "raster",
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        attribution: "© OpenStreetMap contributors"
      }
    },
    layers: [
      { id: "background", type: "background", paint: { "background-color": "#e8e7e2" } },
      {
        id: "osm-basemap",
        type: "raster",
        source: "osm",
        minzoom: 0,
        maxzoom: 19,
        paint: { "raster-opacity": 0.82, "raster-saturation": -0.22, "raster-contrast": -0.04 }
      }
    ]
  };
  const HOLC_PMTILES = "pmtiles://https://s3-west.nrp-nautilus.io/public-mappinginequality/mappinginequality.pmtiles";
  const ROME_BOUNDS = [[12.460, 41.870], [12.520, 41.915]];
  const SF_BOUNDS = [[-122.53, 37.70], [-122.35, 37.83]];
  const SF_PAPER_BOUNDS = [
    [-122.515, 37.812],
    [-122.357, 37.812],
    [-122.357, 37.708],
    [-122.515, 37.708]
  ];
  const SF_PAPER_OVERLAYS = {
    ALL: "assets/sf-holc-overlay-all.png",
    A: "assets/sf-holc-overlay-a.png",
    B: "assets/sf-holc-overlay-b.png",
    C: "assets/sf-holc-overlay-c.png",
    D: "assets/sf-holc-overlay-d.png"
  };
  const COLORS = { A: "#4f9d5d", B: "#4d78c4", C: "#d3ab2f", D: "#cc5a55" };

  const state = {
    view: "explore",
    city: "rome",
    score: "normalized",
    lens: "all",
    sfGrade: "ALL",
    selectedRegion: 10,
    compareGrade: "ALL",
    compareScore: "normalized",
    storyIndex: 0
  };

  const regionFeatures = (window.ROME_REGIONS_GEOJSON?.features || []);
  const regions = regionFeatures.map(f => f.properties);
  const byId = new Map(regions.map(r => [Number(r.id), r]));

  let exploreMap = null;
  let compareRomeMap = null;
  let compareSfMap = null;
  let pmtilesRegistered = false;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function fallbackConfig(city = state.city) {
    if (city === "sf") {
      const image = state.sfGrade === "A" ? "assets/sf-a.png"
        : state.sfGrade === "B" ? "assets/sf-b.png"
        : state.sfGrade === "C" ? "assets/sf-c.png"
        : state.sfGrade === "D" ? "assets/sf-d.png"
        : "assets/sf-holc-composite.png";
      return {
        image,
        alt: `San Francisco HOLC ${state.sfGrade === "ALL" ? "all grades" : `Grade ${state.sfGrade}`} paper-map fallback`,
        title: "San Francisco paper-map fallback",
        text: "The live HOLC vector layer is unavailable in this browser/network. The San Francisco figure from the uploaded paper is shown instead."
      };
    }
    return {
      image: "assets/rome-regions.png",
      alt: "Augustan Rome 14-region paper-map fallback",
      title: "Rome paper-map fallback",
      text: "The GIS engine is unavailable in this browser. The paper’s 14-region Rome figure is shown instead."
    };
  }

  function updateFallbackContent(city = state.city) {
    const cfg = fallbackConfig(city);
    const image = $("#mapFallbackImage");
    if (image) { image.src = cfg.image; image.alt = cfg.alt; }
    if ($("#mapFallbackTitle")) $("#mapFallbackTitle").textContent = cfg.title;
    if ($("#mapFallbackText")) $("#mapFallbackText").textContent = cfg.text;
  }

  function showMapFallback(city = state.city) {
    updateFallbackContent(city);
    const fallback = $("#mapFallback");
    const mapEl = $("#exploreMap");
    if (fallback) fallback.hidden = false;
    if (mapEl) mapEl.hidden = true;
  }

  function hideMapFallback() {
    const fallback = $("#mapFallback");
    const mapEl = $("#exploreMap");
    if (fallback) fallback.hidden = true;
    if (mapEl) mapEl.hidden = false;
  }

  function isMapAvailable() {
    return typeof window.maplibregl !== "undefined";
  }

  function registerPmtiles() {
    if (pmtilesRegistered) return true;
    if (!isMapAvailable() || typeof window.pmtiles === "undefined") return false;
    try {
      const protocol = new window.pmtiles.Protocol();
      window.maplibregl.addProtocol("pmtiles", protocol.tile);
      pmtilesRegistered = true;
      return true;
    } catch (err) {
      // addProtocol can throw if another instance already registered it.
      pmtilesRegistered = true;
      return true;
    }
  }

  function gradeProperty(scoreMode = state.score) {
    return scoreMode === "agnostic" ? "grade_agnostic" : "grade_normalized";
  }

  function gradeColorExpression(scoreMode = state.score) {
    return [
      "match", ["get", gradeProperty(scoreMode)],
      "A", COLORS.A,
      "B", COLORS.B,
      "C", COLORS.C,
      "D", COLORS.D,
      "#9aa2ad"
    ];
  }

  function romeFillExpression(scoreMode = state.score, lens = state.lens) {
    if (lens === "positive") {
      return [
        "interpolate", ["linear"], ["coalesce", ["get", "positive_density"], 0],
        0, "#edf6f0",
        20, "#b8ddc5",
        50, "#73b58e",
        90, "#35815c",
        120, "#17563a"
      ];
    }
    if (lens === "negative") {
      return [
        "interpolate", ["linear"], ["coalesce", ["get", "negative_density"], 0],
        0, "#fbf0ef",
        5, "#efc7c2",
        12, "#dd8d84",
        22, "#c3574e",
        35, "#8d2f2a"
      ];
    }
    return gradeColorExpression(scoreMode);
  }

  function sfBaseFilter() {
    // Grade membership excludes non-residential / ungraded geometry without relying
    // on how the PMTiles encoder serialized the residential boolean.
    return [
      "all",
      ["==", ["get", "city"], "San Francisco"],
      ["==", ["get", "state"], "CA"],
      ["match", ["get", "grade"], ["A", "B", "C", "D"], true, false]
    ];
  }

  function sfFilter(grade = "ALL") {
    const base = sfBaseFilter();
    return grade === "ALL"
      ? base
      : ["all", base, ["==", ["get", "grade"], grade]];
  }

  function romeFilter(scoreMode = state.score, grade = "ALL") {
    return grade === "ALL"
      ? ["all"]
      : ["==", ["get", gradeProperty(scoreMode)], grade];
  }

  function createMap(container, bounds) {
    if (!isMapAvailable()) return null;
    const map = new window.maplibregl.Map({
      container,
      style: MAP_STYLE,
      bounds,
      fitBoundsOptions: { padding: 38, duration: 0 },
      attributionControl: true,
      maxPitch: 60
    });
    map.addControl(new window.maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new window.maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");
    return map;
  }

  function addRomeLayers(map, { interactive = true, scoreMode = state.score, grade = "ALL" } = {}) {
    if (!map || !window.ROME_REGIONS_GEOJSON) return;

    map.addSource("rome-regions", {
      type: "geojson",
      data: window.ROME_REGIONS_GEOJSON,
      attribution: "Region geometry digitized from the uploaded Rome–SF paper figure; paper-derived scores."
    });
    map.addSource("rome-labels", {
      type: "geojson",
      data: window.ROME_REGION_LABELS_GEOJSON
    });

    map.addLayer({
      id: "rome-fill",
      type: "fill",
      source: "rome-regions",
      filter: romeFilter(scoreMode, grade),
      paint: {
        "fill-color": romeFillExpression(scoreMode, interactive ? state.lens : "all"),
        "fill-opacity": 0.58,
        "fill-outline-color": "#ffffff"
      }
    });

    map.addLayer({
      id: "rome-outline",
      type: "line",
      source: "rome-regions",
      filter: romeFilter(scoreMode, grade),
      paint: {
        "line-color": "#334155",
        "line-width": 1.6,
        "line-opacity": 0.9
      }
    });

    map.addLayer({
      id: "rome-selected-fill",
      type: "fill",
      source: "rome-regions",
      filter: ["==", ["get", "id"], interactive ? state.selectedRegion : -1],
      paint: {
        "fill-color": "#ffffff",
        "fill-opacity": 0.08
      }
    });

    map.addLayer({
      id: "rome-selected-outline",
      type: "line",
      source: "rome-regions",
      filter: ["==", ["get", "id"], interactive ? state.selectedRegion : -1],
      paint: {
        "line-color": "#111827",
        "line-width": 4,
        "line-opacity": 1
      }
    });

    // Region labels use DOM markers so the Rome GIS remains independent of remote glyph fonts.
    (window.ROME_REGION_LABELS_GEOJSON?.features || []).forEach(feature => {
      const el = document.createElement("div");
      el.className = "gis-region-label";
      el.textContent = feature.properties?.label || "";
      el.setAttribute("aria-hidden", "true");
      new window.maplibregl.Marker({ element: el, anchor: "center" })
        .setLngLat(feature.geometry.coordinates)
        .addTo(map);
    });

    if (interactive) {
      let popup = null;

      map.on("mouseenter", "rome-fill", e => {
        map.getCanvas().style.cursor = "pointer";
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties;
        if (popup) popup.remove();
        popup = new window.maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 8 })
          .setLngLat(e.lngLat)
          .setHTML(
            `<strong>Regio ${esc(p.roman)} · ${esc(p.name)}</strong>` +
            `<small>${esc(p[gradeProperty(state.score)])} grade · click for details</small>`
          )
          .addTo(map);
      });

      map.on("mousemove", "rome-fill", e => {
        if (popup && e.lngLat) popup.setLngLat(e.lngLat);
      });

      map.on("mouseleave", "rome-fill", () => {
        map.getCanvas().style.cursor = "";
        if (popup) popup.remove();
        popup = null;
      });

      map.on("click", "rome-fill", e => {
        const f = e.features?.[0];
        if (!f) return;
        selectRomeRegion(Number(f.properties.id), false);
      });
    }
  }

  function updateRomeVisual(map, { scoreMode = state.score, lens = "all", grade = "ALL" } = {}) {
    if (!map || !map.getLayer("rome-fill")) return;
    map.setPaintProperty("rome-fill", "fill-color", romeFillExpression(scoreMode, lens));
    const filter = romeFilter(scoreMode, grade);
    map.setFilter("rome-fill", filter);
    map.setFilter("rome-outline", filter);
  }

  function removeSfPaperOverlay(map) {
    if (!map) return;
    if (map.getLayer("sf-paper-overlay")) map.removeLayer("sf-paper-overlay");
    if (map.getSource("sf-paper-overlay")) map.removeSource("sf-paper-overlay");
  }

  function addSfPaperOverlay(map, grade = "ALL", opacity = 0.72) {
    if (!map) return;
    removeSfPaperOverlay(map);
    const url = SF_PAPER_OVERLAYS[grade] || SF_PAPER_OVERLAYS.ALL;
    map.addSource("sf-paper-overlay", {
      type: "image",
      url,
      coordinates: SF_PAPER_BOUNDS
    });
    map.addLayer({
      id: "sf-paper-overlay",
      type: "raster",
      source: "sf-paper-overlay",
      paint: {
        "raster-opacity": opacity,
        "raster-fade-duration": 0
      }
    });
  }

  function setSfPaperOverlayOpacity(map, opacity) {
    if (map?.getLayer("sf-paper-overlay")) {
      map.setPaintProperty("sf-paper-overlay", "raster-opacity", opacity);
    }
  }

  function addSfLayers(map, { interactive = true, grade = "ALL" } = {}) {
    if (!map) return;

    // Always keep San Francisco visible as an interactive MAP. A locally
    // bundled paper overlay is added first, then exact vectors upgrade it
    // when the Mapping Inequality PMTiles source is reachable.
    addSfPaperOverlay(map, grade, 0.74);

    if (!registerPmtiles()) {
      $("#mapStatus").textContent =
        "Interactive basemap active · using the local San Francisco paper overlay because the PMTiles library is unavailable.";
      return;
    }

    map.addSource("holc", {
      type: "vector",
      url: HOLC_PMTILES,
      attribution: "Mapping Inequality / Digital Scholarship Lab · CC BY-NC-SA 4.0"
    });

    map.addLayer({
      id: "sf-holc-fill",
      type: "fill",
      source: "holc",
      "source-layer": "redlining",
      filter: sfFilter(grade),
      paint: {
        "fill-color": [
          "match", ["get", "grade"],
          "A", COLORS.A,
          "B", COLORS.B,
          "C", COLORS.C,
          "D", COLORS.D,
          "#9aa2ad"
        ],
        "fill-opacity": 0.54
      }
    });

    map.addLayer({
      id: "sf-holc-line",
      type: "line",
      source: "holc",
      "source-layer": "redlining",
      filter: sfFilter(grade),
      paint: {
        "line-color": "#263241",
        "line-width": 1.35,
        "line-opacity": 0.85
      }
    });

    map.addLayer({
      id: "sf-hover-line",
      type: "line",
      source: "holc",
      "source-layer": "redlining",
      filter: ["==", ["get", "area_id"], "__none__"],
      paint: {
        "line-color": "#111827",
        "line-width": 4
      }
    });

    if (interactive) {
      let popup = null;

      map.on("mouseenter", "sf-holc-fill", e => {
        map.getCanvas().style.cursor = "pointer";
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties || {};
        setSfHover(map, p);
        if (popup) popup.remove();
        popup = new window.maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 8 })
          .setLngLat(e.lngLat)
          .setHTML(
            `<strong>${esc(p.label || p.area_id || "HOLC area")}</strong>` +
            `<small>Grade ${esc(p.grade || "—")} · click for details</small>`
          )
          .addTo(map);
      });

      map.on("mousemove", "sf-holc-fill", e => {
        const f = e.features?.[0];
        if (f) setSfHover(map, f.properties || {});
        if (popup && e.lngLat) popup.setLngLat(e.lngLat);
      });

      map.on("mouseleave", "sf-holc-fill", () => {
        map.getCanvas().style.cursor = "";
        clearSfHover(map);
        if (popup) popup.remove();
        popup = null;
      });

      map.on("click", "sf-holc-fill", e => {
        const f = e.features?.[0];
        if (!f) return;
        renderSfDetail(f.properties || {});
        $("#mapStatus").textContent =
          `${f.properties?.label || f.properties?.area_id || "HOLC area"} · Grade ${f.properties?.grade || "—"}`;
      });
    }
  }

  function setSfHover(map, props) {
    if (!map?.getLayer("sf-hover-line")) return;
    const areaId = props.area_id;
    const label = props.label;
    if (areaId != null) {
      map.setFilter("sf-hover-line", ["==", ["get", "area_id"], areaId]);
    } else if (label != null) {
      map.setFilter("sf-hover-line", ["==", ["get", "label"], label]);
    }
  }

  function clearSfHover(map) {
    if (map?.getLayer("sf-hover-line")) {
      map.setFilter("sf-hover-line", ["==", ["get", "area_id"], "__none__"]);
    }
  }

  function updateSfFilter(map, grade) {
    if (!map) return;
    const filter = sfFilter(grade);
    ["sf-holc-fill", "sf-holc-line"].forEach(id => {
      if (map.getLayer(id)) map.setFilter(id, filter);
    });
    const vectorActive = Boolean(map.getLayer("sf-holc-fill"));
    if (map.getSource("sf-paper-overlay")) {
      addSfPaperOverlay(map, grade, vectorActive ? 0.08 : 0.74);
    }
    clearSfHover(map);
  }

  function bboxOfFeature(feature) {
    const coords = feature?.geometry?.coordinates?.[0] || [];
    if (!coords.length) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of coords) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    return [[minX, minY], [maxX, maxY]];
  }

  function focusRomeRegion(id, map = exploreMap) {
    const f = regionFeatures.find(x => Number(x.properties.id) === Number(id));
    const bounds = bboxOfFeature(f);
    if (map && bounds) map.fitBounds(bounds, { padding: 90, duration: 700, maxZoom: 14.2 });
  }

  function selectRomeRegion(id, focus = false) {
    state.selectedRegion = Number(id);
    const r = byId.get(state.selectedRegion);
    if (!r) return;

    $("#regionSelect").value = String(state.selectedRegion);
    if (exploreMap?.getLayer("rome-selected-fill")) {
      const filter = ["==", ["get", "id"], state.selectedRegion];
      exploreMap.setFilter("rome-selected-fill", filter);
      exploreMap.setFilter("rome-selected-outline", filter);
    }
    renderRomeDetail(r);
    $("#mapStatus").textContent =
      `Regio ${r.roman} · ${r.name} · Grade ${r[gradeProperty(state.score)]} · ${Number(r.positive_pct).toFixed(2)}% positive`;
    if (focus) focusRomeRegion(id);
  }

  function renderRomeDetail(r) {
    const grade = r[gradeProperty(state.score)];
    const scoreLabel = state.score === "agnostic" ? "Positive share" : "Normalized score";
    const scoreValue = state.score === "agnostic"
      ? `${Number(r.positive_pct).toFixed(2)}%`
      : Number(r.normalized).toFixed(3);

    $("#detailContent").innerHTML = `
      <div class="detail-kicker">Augustan Rome · Regio ${esc(r.roman)}</div>
      <h2 class="detail-title">${esc(r.name)}</h2>
      <div class="grade-badge grade-${String(grade).toLowerCase()}-bg" title="Current HOLC-style grade">${esc(grade)}</div>
      <p class="detail-description">${esc(r.description)}</p>
      <div class="detail-metrics">
        <div class="metric-box"><strong>${scoreValue}</strong><span>${scoreLabel}</span></div>
        <div class="metric-box"><strong>${Number(r.net).toFixed(3)}</strong><span>Net investment score</span></div>
        <div class="metric-box"><strong>${esc(r.pos)}</strong><span>Positive places</span></div>
        <div class="metric-box"><strong>${esc(r.neg)}</strong><span>Negative places</span></div>
        <div class="metric-box"><strong>${Number(r.area).toFixed(2)}</strong><span>Area value · Table 1</span></div>
        <div class="metric-box"><strong>${Number(r.positive_pct).toFixed(2)}%</strong><span>Positive share · Table 3</span></div>
        <div class="metric-box"><strong>${Number(r.positive_density).toFixed(3)}</strong><span>Positive density · Table 1</span></div>
        <div class="metric-box"><strong>${Number(r.negative_density).toFixed(3)}</strong><span>Negative density · Table 1</span></div>
      </div>
      <div class="detail-rule"></div>
      <p class="microcopy"><strong>Geometry note:</strong> scores and counts are paper data. The polygon is an approximate digitization of the paper figure, not an authoritative survey boundary.</p>
    `;
  }

  function renderSfDetail(p) {
    const grade = p.grade || "—";
    const label = p.label || p.area_id || "HOLC area";
    const category = p.category || ({
      A: "Best",
      B: "Still Desirable",
      C: "Definitely Declining",
      D: "Hazardous"
    }[grade] || "HOLC graded area");

    $("#detailContent").innerHTML = `
      <div class="detail-kicker">San Francisco · 1937 HOLC</div>
      <h2 class="detail-title">${esc(label)}</h2>
      <div class="grade-badge grade-${String(grade).toLowerCase()}-bg">${esc(grade)}</div>
      <p class="detail-description">${esc(category)}</p>
      <div class="detail-metrics">
        <div class="metric-box"><strong>${esc(p.area_id || "—")}</strong><span>Area ID</span></div>
        <div class="metric-box"><strong>${esc(grade)}</strong><span>HOLC grade</span></div>
        <div class="metric-box"><strong>${esc(p.city || "San Francisco")}</strong><span>City</span></div>
        <div class="metric-box"><strong>${esc(p.state || "CA")}</strong><span>State</span></div>
      </div>
      <div class="detail-rule"></div>
      <p class="microcopy">This geometry and its grade are read directly from the live Mapping Inequality vector layer.</p>
      <a class="source-link" href="https://dsl.richmond.edu/panorama/redlining/" target="_blank" rel="noopener">Open Mapping Inequality source ↗</a>
    `;
  }

  function renderEmptyDetail(city = state.city) {
    $("#detailContent").innerHTML = `
      <div class="detail-empty">
        <div>
          <strong>${city === "rome" ? "Click a Roman region" : "Click a San Francisco HOLC polygon"}</strong>
          <p class="microcopy">${city === "rome" ? "The entire polygon is interactive." : "Hover for label and grade; click for feature details."}</p>
        </div>
      </div>
    `;
  }

  function renderRanking() {
    const agnostic = state.score === "agnostic";
    const metric = agnostic ? "positive_pct" : "normalized";
    const sorted = [...regions].sort((a, b) => Number(b[metric]) - Number(a[metric]));
    const max = Math.max(...sorted.map(r => Number(r[metric])), 0.0001);

    $("#rankingTitle").textContent = agnostic
      ? "Regional positive-share ranking"
      : "Regional investment ranking";
    $("#rankingMetric").textContent = agnostic ? "Positive share" : "Normalized score";

    $("#rankingBars").innerHTML = sorted.map(r => {
      const v = Number(r[metric]);
      const width = Math.max(2, (v / max) * 100);
      const value = agnostic ? `${v.toFixed(2)}%` : v.toFixed(3);
      return `
        <button class="rank-row rank-button" data-region-id="${r.id}" title="Focus Regio ${esc(r.roman)} · ${esc(r.name)}">
          <span class="rank-label">Regio ${esc(r.roman)}</span>
          <span class="rank-track"><span class="rank-fill" style="width:${width}%"></span></span>
          <span class="rank-value">${value}</span>
        </button>
      `;
    }).join("");

    $$(".rank-button", $("#rankingBars")).forEach(btn => {
      btn.addEventListener("click", () => selectRomeRegion(Number(btn.dataset.regionId), true));
    });
  }

  function renderSfDistribution() {
    // Source: paper sections A-D (pp.10-15). These are graded-footprint shares,
    // intentionally kept separate from the different SF Pct series printed in Table 4.
    const data = [
      ["A", 13, 8.65], ["B", 30, 31.32], ["C", 26, 24.97], ["D", 17, 35.06]
    ];
    $("#sfDistributionBars").innerHTML = data.map(([grade, count, value]) => `
      <div class="rank-row sf-footprint-row">
        <span class="rank-label">Grade ${grade} · ${count} areas</span>
        <span class="rank-track"><span class="rank-fill" style="width:${value}%;background:${COLORS[grade]}"></span></span>
        <span class="rank-value">${value.toFixed(2)}%</span>
      </div>
    `).join("");
  }

  function updateLegend() {
    const legend = $("#mapLegend");
    if (state.city === "sf" || state.lens === "all") {
      legend.innerHTML = `
        <span><i class="swatch a"></i>A</span>
        <span><i class="swatch b"></i>B</span>
        <span><i class="swatch c"></i>C</span>
        <span><i class="swatch d"></i>D</span>`;
    } else if (state.lens === "positive") {
      legend.innerHTML = `<span class="gradient-legend positive-gradient"></span><span>Low → high positive density</span>`;
    } else {
      legend.innerHTML = `<span class="gradient-legend negative-gradient"></span><span>Low → high negative density</span>`;
    }
  }

  function setExploreUiForCity() {
    const isRome = state.city === "rome";
    $$(".rome-only").forEach(el => el.classList.toggle("hidden", !isRome));
    $$(".sf-only").forEach(el => el.classList.toggle("hidden", isRome));
    $("#rankingCard").classList.toggle("hidden", !isRome);
    $("#sfDistributionCard").classList.toggle("hidden", isRome);

    $$("#citySwitch .seg-btn").forEach(btn =>
      btn.classList.toggle("active", btn.dataset.city === state.city)
    );

    if (isRome) {
      $("#mapTitle").textContent = "Augustan Rome";
      $("#mapSubtitle").textContent = "Clickable 14-region GeoJSON overlay · paper-derived scoring";
      $("#sourceIntegrityText").textContent =
        "Rome scores come from the paper. Region geometry is an approximate digitization of its 14-region figure, georeferenced using the paper’s stated bounding box.";
      renderRanking();
      selectRomeRegion(state.selectedRegion, false);
    } else {
      $("#mapTitle").textContent = "San Francisco · 1937";
      $("#mapSubtitle").textContent = "Live Mapping Inequality HOLC polygons";
      $("#sourceIntegrityText").textContent =
        "San Francisco uses Mapping Inequality vector polygons when reachable. A locally bundled paper overlay remains available inside the interactive map as a resilient data-layer fallback. No Rome scoring or interpretive lens is applied.";
      renderEmptyDetail("sf");
      $("#mapStatus").textContent = "Hover and click a San Francisco HOLC polygon.";
    }
    updateLegend();
  }

  function rebuildExploreMap() {
    if (exploreMap) {
      try { exploreMap.remove(); } catch (_) {}
      exploreMap = null;
    }
    updateFallbackContent(state.city);
    hideMapFallback();

    // A static figure is used only if the mapping engine itself cannot start.
    // Network/data-layer failures never replace the map.
    if (!isMapAvailable()) {
      showMapFallback(state.city);
      $("#mapStatus").textContent = state.city === "rome"
        ? "Map engine unavailable · showing the Rome paper figure."
        : "Map engine unavailable · showing the San Francisco paper figure.";
      return;
    }

    const isRome = state.city === "rome";
    let sfDataLoaded = false;
    exploreMap = createMap("exploreMap", isRome ? ROME_BOUNDS : SF_BOUNDS);

    if (!exploreMap) {
      showMapFallback(state.city);
      return;
    }

    exploreMap.on("load", () => {
      hideMapFallback();

      if (isRome) {
        addRomeLayers(exploreMap, { interactive: true, scoreMode: state.score });
        selectRomeRegion(state.selectedRegion, false);
        $("#mapStatus").textContent =
          "Interactive geographic basemap · local Rome polygons and paper-derived scores.";
      } else {
        addSfLayers(exploreMap, { interactive: true, grade: state.sfGrade });
        $("#mapStatus").textContent =
          "Interactive geographic basemap · loading exact San Francisco HOLC vectors; local paper overlay remains visible.";
      }
    });

    exploreMap.on("sourcedata", evt => {
      if (!isRome && evt.sourceId === "holc" && evt.isSourceLoaded && !sfDataLoaded) {
        sfDataLoaded = true;
        setSfPaperOverlayOpacity(exploreMap, 0.08);
        $("#mapStatus").textContent = state.sfGrade === "ALL"
          ? "Exact Mapping Inequality HOLC polygons loaded on the interactive basemap."
          : `Exact Mapping Inequality Grade ${state.sfGrade} polygons loaded on the interactive basemap.`;
      }
    });

    exploreMap.on("error", evt => {
      const message = evt?.error?.message || "Map layer error";

      if (!isRome && /pmtiles|holc|range|cors/i.test(message)) {
        setSfPaperOverlayOpacity(exploreMap, 0.74);
        $("#mapStatus").textContent =
          "San Francisco vector source is unavailable · keeping the interactive basemap with the local paper overlay.";
        return;
      }

      if (/tile|openstreetmap/i.test(message)) {
        $("#mapStatus").textContent = isRome
          ? "Basemap tiles are unavailable · Rome GIS polygons remain interactive."
          : "Basemap tiles are unavailable · San Francisco map data remains visible.";
        return;
      }

      $("#mapStatus").textContent = `Map warning: ${message}`;
    });
  }

  function resetExploreMap() {
    if (!exploreMap) return;
    exploreMap.fitBounds(state.city === "rome" ? ROME_BOUNDS : SF_BOUNDS, {
      padding: 38,
      duration: 600
    });
  }

  function updateRomeScore(score) {
    state.score = score;
    renderRanking();
    renderRomeDetail(byId.get(state.selectedRegion));
    if (exploreMap && state.city === "rome") {
      updateRomeVisual(exploreMap, { scoreMode: state.score, lens: state.lens, grade: "ALL" });
      selectRomeRegion(state.selectedRegion, false);
    }
  }

  function updateRomeLens(lens) {
    state.lens = lens;
    $$("#lensSwitch .chip").forEach(btn =>
      btn.classList.toggle("active", btn.dataset.lens === lens)
    );
    if (exploreMap && state.city === "rome") {
      updateRomeVisual(exploreMap, { scoreMode: state.score, lens: state.lens, grade: "ALL" });
    }
    updateLegend();
  }

  function updateSfGrade(grade) {
    state.sfGrade = grade;
    $$("#sfGradeSwitch .grade-chip").forEach(btn =>
      btn.classList.toggle("active", btn.dataset.grade === grade)
    );
    if (exploreMap && state.city === "sf") updateSfFilter(exploreMap, grade);
    if (!$("#mapFallback")?.hidden) updateFallbackContent("sf");
    $("#mapStatus").textContent =
      grade === "ALL" ? "Showing all San Francisco HOLC grades." : `Showing San Francisco Grade ${grade} polygons.`;
  }

  function initRegionSelect() {
    const select = $("#regionSelect");
    select.innerHTML = regions
      .sort((a, b) => Number(a.id) - Number(b.id))
      .map(r => `<option value="${r.id}">Regio ${esc(r.roman)} · ${esc(r.name)}</option>`)
      .join("");
    select.value = String(state.selectedRegion);
  }

  function initExploreControls() {
    $$("#citySwitch .seg-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        if (state.city === btn.dataset.city) return;
        state.city = btn.dataset.city;
        setExploreUiForCity();
        rebuildExploreMap();
      });
    });

    $$('input[name="score"]').forEach(radio => {
      radio.addEventListener("change", () => {
        if (radio.checked) updateRomeScore(radio.value);
      });
    });

    $$("#lensSwitch .chip").forEach(btn =>
      btn.addEventListener("click", () => updateRomeLens(btn.dataset.lens))
    );

    $("#regionSelect").addEventListener("change", e =>
      selectRomeRegion(Number(e.target.value), false)
    );
    $("#focusRegion").addEventListener("click", () =>
      selectRomeRegion(Number($("#regionSelect").value), true)
    );

    $$("#sfGradeSwitch .grade-chip").forEach(btn =>
      btn.addEventListener("click", () => updateSfGrade(btn.dataset.grade))
    );

    $("#resetMap").addEventListener("click", resetExploreMap);

    $("#fullscreenMap").addEventListener("click", async () => {
      const card = $("#exploreMap").closest(".map-card");
      try {
        if (!document.fullscreenElement) await card.requestFullscreen();
        else await document.exitFullscreen();
      } catch (_) {}
      setTimeout(() => exploreMap?.resize(), 150);
    });
    document.addEventListener("fullscreenchange", () => setTimeout(() => exploreMap?.resize(), 150));
  }

  function initCompareMaps() {
    if (compareRomeMap || compareSfMap || !isMapAvailable()) return;
    compareRomeMap = createMap("compareRomeMap", ROME_BOUNDS);
    compareSfMap = createMap("compareSfMap", SF_BOUNDS);

    compareRomeMap?.on("load", () => {
      addRomeLayers(compareRomeMap, {
        interactive: false,
        scoreMode: state.compareScore,
        grade: state.compareGrade
      });
    });

    compareSfMap?.on("load", () => {
      addSfLayers(compareSfMap, {
        interactive: false,
        grade: state.compareGrade
      });
    });
  }

  function updateCompareGrade(grade) {
    state.compareGrade = grade;
    $$("[data-compare-grade]").forEach(btn =>
      btn.classList.toggle("active", btn.dataset.compareGrade === grade)
    );

    if (compareRomeMap?.getLayer("rome-fill")) {
      updateRomeVisual(compareRomeMap, {
        scoreMode: state.compareScore,
        lens: "all",
        grade
      });
    }
    if (compareSfMap?.getLayer("sf-holc-fill")) updateSfFilter(compareSfMap, grade);
  }

  function updateCompareScore(scoreMode) {
    state.compareScore = scoreMode;
    if (!compareRomeMap?.getLayer("rome-fill")) return;
    updateRomeVisual(compareRomeMap, {
      scoreMode: state.compareScore,
      lens: "all",
      grade: state.compareGrade
    });
    updateCompareGrade(state.compareGrade);
  }

  function initCompareControls() {
    $$("[data-compare-grade]").forEach(btn =>
      btn.addEventListener("click", () => updateCompareGrade(btn.dataset.compareGrade))
    );
    $("#compareScore").addEventListener("change", e => updateCompareScore(e.target.value));
  }

  const stories = [
    {
      kicker: "01 · The question",
      title: "Two cities, nearly two millennia apart",
      body: "The paper asks whether resource-driven spatial hierarchy can recur across radically different urban systems. San Francisco and Augustan Rome are compared not as equivalent histories, but as a test of recurring spatial mechanisms.",
      image: "assets/sf-all.png",
      stats: [["2", "cities"], ["~2,000", "years apart"]]
    },
    {
      kicker: "02 · San Francisco",
      title: "Classification becomes geography",
      body: "The 1937 HOLC map divided San Francisco into A, B, C and D graded areas. In the live Explore map those boundaries are vector polygons rather than paper screenshots.",
      image: "assets/sf-holc-composite.png",
      stats: [["96", "paper districts"], ["A–D", "HOLC grades"]]
    },
    {
      kicker: "03 · Rome",
      title: "Translate the spatial framework",
      body: "The paper maps archaeological places into fourteen Augustan administrative regions. This GIS edition digitizes those region boundaries from the paper figure so the full areas—not just labels—are clickable.",
      image: "assets/rome-regions-cropped.png",
      stats: [["14", "regions"], ["383", "paper candidate places"]]
    },
    {
      kicker: "04 · Scoring",
      title: "The model changes the map",
      body: "The paper tests an area-sensitive normalized investment model and a size-agnostic positive-share model. Switching the scoring method changes both the Roman grade map and the ranking.",
      image: "assets/rome-regions.png",
      stats: [["2", "scoring methods"], ["A–D", "translated grades"]]
    },
    {
      kicker: "05 · Limitation",
      title: "Resolution matters",
      body: "The paper itself warns that comparing ninety-six San Francisco districts with only fourteen Roman regions creates substantial scale differences. This interface keeps that limitation visible rather than smoothing it away.",
      image: "assets/rome-bounds.png",
      stats: [["96", "SF districts"], ["14", "Rome regions"]]
    }
  ];

  function renderStory(index = state.storyIndex) {
    state.storyIndex = index;
    const s = stories[index];
    $("#storyKicker").textContent = s.kicker;
    $("#storyTitle").textContent = s.title;
    $("#storyBody").textContent = s.body;
    $("#storyImage").src = s.image;
    $("#storyStats").innerHTML = s.stats.map(([value, label]) =>
      `<div><strong>${esc(value)}</strong><span>${esc(label)}</span></div>`
    ).join("");
    $$("#storyNav button").forEach((btn, i) => btn.classList.toggle("active", i === index));
  }

  function initStory() {
    $("#storyNav").innerHTML = stories.map((s, i) =>
      `<button data-story="${i}">${String(i + 1).padStart(2, "0")} · ${esc(s.title)}</button>`
    ).join("");
    $$("#storyNav button").forEach(btn =>
      btn.addEventListener("click", () => renderStory(Number(btn.dataset.story)))
    );
    renderStory(0);
  }

  function showView(name) {
    state.view = name;
    $$(".view").forEach(v => v.classList.toggle("active", v.id === `view-${name}`));
    $$(".nav-link").forEach(btn => btn.classList.toggle("active", btn.dataset.view === name));
    if (name === "compare") {
      initCompareMaps();
      setTimeout(() => {
        compareRomeMap?.resize();
        compareSfMap?.resize();
      }, 80);
    }
    if (name === "explore") setTimeout(() => exploreMap?.resize(), 80);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function initNav() {
    $$("[data-view]").forEach(btn =>
      btn.addEventListener("click", () => showView(btn.dataset.view))
    );
  }

  function exportRomeCsv() {
    const headers = [
      "region", "roman", "name", "area_km2", "positive_count", "negative_count",
      "net_investment_score", "normalized_score", "normalized_grade",
      "positive_percentage", "size_agnostic_grade"
    ];
    const rows = regions
      .sort((a, b) => Number(a.id) - Number(b.id))
      .map(r => [
        r.id, r.roman, r.name, r.area, r.pos, r.neg, r.net, r.normalized,
        r.grade_normalized, r.positive_pct, r.grade_agnostic
      ]);
    const csv = [headers, ...rows].map(row =>
      row.map(v => `"${String(v ?? "").replaceAll('"', '""')}"`).join(",")
    ).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "rome-region-scores.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }


  function initPresentationStudio() {
    const studio = $("#styleStudio");
    const backdrop = $("#styleStudioBackdrop");
    const toggle = $("#styleStudioToggle");
    const close = $("#styleStudioClose");

    const allowedStyles = new Set(["classic", "archive", "museum", "datalab", "night"]);
    const allowedLayouts = new Set(["standard", "mapfocus", "exhibit"]);

    let visualStyle = localStorage.getItem("rome-sf-visual-style") || "classic";
    let layoutMode = localStorage.getItem("rome-sf-layout-mode") || "standard";
    if (!allowedStyles.has(visualStyle)) visualStyle = "classic";
    if (!allowedLayouts.has(layoutMode)) layoutMode = "standard";

    function refreshMaps() {
      setTimeout(() => {
        exploreMap?.resize();
        compareRomeMap?.resize();
        compareSfMap?.resize();
      }, 140);
    }

    function applyStyle(value, persist = true) {
      if (!allowedStyles.has(value)) value = "classic";
      document.body.dataset.visualStyle = value;
      $$("[data-visual-style-choice]").forEach(btn =>
        btn.classList.toggle("active", btn.dataset.visualStyleChoice === value)
      );
      if (persist) localStorage.setItem("rome-sf-visual-style", value);
      refreshMaps();
    }

    function applyLayout(value, persist = true) {
      if (!allowedLayouts.has(value)) value = "standard";
      document.body.dataset.layoutMode = value;
      $$("[data-layout-choice]").forEach(btn =>
        btn.classList.toggle("active", btn.dataset.layoutChoice === value)
      );
      if (persist) localStorage.setItem("rome-sf-layout-mode", value);
      refreshMaps();
    }

    function setOpen(open) {
      studio.hidden = !open;
      backdrop.hidden = !open;
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    }

    applyStyle(visualStyle, false);
    applyLayout(layoutMode, false);

    toggle.addEventListener("click", () => setOpen(studio.hidden));
    close.addEventListener("click", () => setOpen(false));
    backdrop.addEventListener("click", () => setOpen(false));

    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && !studio.hidden) setOpen(false);
    });

    $$("[data-visual-style-choice]").forEach(btn =>
      btn.addEventListener("click", () => applyStyle(btn.dataset.visualStyleChoice))
    );

    $$("[data-layout-choice]").forEach(btn =>
      btn.addEventListener("click", () => applyLayout(btn.dataset.layoutChoice))
    );

    $("#resetPresentation").addEventListener("click", () => {
      applyStyle("classic");
      applyLayout("standard");
      document.body.classList.remove("dark");
      localStorage.setItem("rome-sf-theme", "light");
    });
  }

  function initTheme() {
    const saved = localStorage.getItem("rome-sf-theme");
    if (saved === "dark") document.body.classList.add("dark");
    $("#themeToggle").addEventListener("click", () => {
      document.body.classList.toggle("dark");
      localStorage.setItem("rome-sf-theme", document.body.classList.contains("dark") ? "dark" : "light");
    });
  }

  function init() {
    registerPmtiles();
    initNav();
    initRegionSelect();
    initExploreControls();
    initCompareControls();
    initStory();
    initTheme();
    initPresentationStudio();
    renderSfDistribution();
    renderRanking();
    setExploreUiForCity();
    rebuildExploreMap();
    $("#exportCsv").addEventListener("click", exportRomeCsv);

    // Keyboard shortcuts are intentionally scoped to the Explore view.
    document.addEventListener("keydown", e => {
      if (state.view !== "explore" || !exploreMap) return;
      if (["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;
      if (e.key === "0") resetExploreMap();
      if (e.key.toLowerCase() === "f" && state.city === "rome") focusRomeRegion(state.selectedRegion);
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
