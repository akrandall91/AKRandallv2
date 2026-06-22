// Outcome Atlas — powers the infrastructure proof map on work.html
// Data source: window.PROJECTS_DATA (injected by assets/data/projects-data.js)
// or fetched from assets/data/projects.json when served over http.

(function () {
  "use strict";

  // ── Category config ────────────────────────────────────────────────────────
  const CATEGORIES = {
    "Transit": { color: "#e85b2a", dot: "dot-transit" },
    "Parks & Trails": { color: "#2da44e", dot: "dot-parks" },
    "Public Safety": { color: "#1e6bb8", dot: "dot-safety" },
    "Smart Infrastructure": { color: "#8b6bb8", dot: "dot-smart" },
    "Emergency / Resilience": { color: "#e6a817", dot: "dot-emergency" },
  };

  // ── Map state ──────────────────────────────────────────────────────────────
  let map = null;
  let allProjects = [];
  let activeCategory = "all";
  let activeYear = "all";

  // ── Leaflet marker factory ─────────────────────────────────────────────────
  function makeIcon(category) {
    const color = (CATEGORIES[category] || CATEGORIES["Smart Infrastructure"]).color;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18">
      <circle cx="9" cy="9" r="7" fill="${color}" stroke="#fff" stroke-width="2"/>
    </svg>`;
    return L.divIcon({
      html: svg,
      className: "",
      iconSize: [18, 18],
      iconAnchor: [9, 9],
      popupAnchor: [0, -10],
    });
  }

  // ── Popup content ──────────────────────────────────────────────────────────
  function popupHtml(p) {
    const catLabel = p.category || "Infrastructure";
    const thumbnail = Array.isArray(p.gallery_images) && p.gallery_images.length
      ? `<img class="atlas-thumb" src="${escHtml(p.gallery_images[0])}" alt="${escHtml(p.name || p.id)} project documentation">`
      : "";
    const dealTag = p.cold_rfp_win
      ? `<span class="atlas-tag atlas-tag--cold">Cold RFP Win</span>`
      : p.deal_type
        ? `<span class="atlas-tag">${escHtml(p.deal_type)}</span>`
        : "";
    const mapsLink = p.google_maps_url
      ? `<a href="${escHtml(p.google_maps_url)}" target="_blank" rel="noopener" class="atlas-maps-link">View on Maps →</a>`
      : "";
    const galleryLink = `<a href="gallery.html#${encodeURIComponent(p.id)}" class="atlas-gallery-link">View in Gallery →</a>`;
    const desc = p.description ? `<p class="atlas-desc">${escHtml(p.description)}</p>` : "";
    return `
      <div class="atlas-popup">
        ${thumbnail}
        <span class="atlas-category">${escHtml(catLabel)}</span>
        <strong class="atlas-name">${escHtml(p.name || p.id)}</strong>
        <span class="atlas-loc">${escHtml(p.city_state || "")}</span>
        ${desc}
        <div class="atlas-meta">${dealTag}${mapsLink}${galleryLink}</div>
      </div>`;
  }

  function escHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // ── Map initializer ────────────────────────────────────────────────────────
  function initMap() {
    const el = document.getElementById("map");
    if (!el || map) return;

    el.style.height = el.style.height || "520px";

    map = L.map("map", {
      center: [38.5, -96],
      zoom: 4,
      scrollWheelZoom: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(map);
  }

  // ── Render markers based on active filters ─────────────────────────────────
  function renderMarkers() {
    if (!map) return;
    map.eachLayer(layer => { if (layer instanceof L.Marker) map.removeLayer(layer); });

    const visible = allProjects.filter(p => {
      if (!p.lat || !p.lng) return false;
      if (activeCategory !== "all" && p.category !== activeCategory) return false;
      if (activeYear !== "all" && String(p.year) !== String(activeYear)) return false;
      return true;
    });

    visible.forEach(p => {
      L.marker([p.lat, p.lng], { icon: makeIcon(p.category) })
        .bindPopup(popupHtml(p), { maxWidth: 300 })
        .addTo(map);
    });

    const countEl = document.getElementById("map-count");
    if (countEl) {
      countEl.textContent = visible.length === 1
        ? "1 proof point"
        : `${visible.length} proof points`;
    }
  }

  // ── Filter button wiring ───────────────────────────────────────────────────
  function wireFilters() {
    document.querySelectorAll(".filter-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        activeCategory = btn.dataset.filter === "all" ? "all" : btn.dataset.filter;
        renderMarkers();
      });
    });

    document.querySelectorAll(".year-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".year-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        activeYear = btn.dataset.year;
        renderMarkers();
      });
    });
  }

  // ── Data loading ───────────────────────────────────────────────────────────
  function loadData() {
    if (window.PROJECTS_DATA && Array.isArray(window.PROJECTS_DATA)) {
      return Promise.resolve(window.PROJECTS_DATA);
    }
    return fetch("assets/data/projects.json")
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
  }

  // ── Map styles injected inline ─────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById("atlas-styles")) return;
    const style = document.createElement("style");
    style.id = "atlas-styles";
    style.textContent = `
      #map { border-radius: 4px; }
      .atlas-popup { font-family: inherit; min-width: 180px; }
      .atlas-popup .atlas-thumb { display: block; width: calc(100% + 40px); height: 118px; margin: -14px -20px 12px; object-fit: cover; border-radius: 4px 4px 0 0; }
      .atlas-popup .atlas-category { display: block; font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: #6b7280; margin-bottom: 4px; }
      .atlas-popup .atlas-name { display: block; font-size: 15px; font-weight: 600; line-height: 1.3; margin-bottom: 2px; }
      .atlas-popup .atlas-loc { display: block; font-size: 12px; color: #6b7280; margin-bottom: 6px; }
      .atlas-popup .atlas-desc { font-size: 13px; margin: 0 0 8px; line-height: 1.5; }
      .atlas-popup .atlas-meta { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
      .atlas-tag { font-size: 11px; padding: 2px 7px; border-radius: 3px; background: #f3f4f6; color: #374151; }
      .atlas-tag--cold { background: #fef3c7; color: #92400e; }
      .atlas-maps-link { font-size: 12px; color: #1e6bb8; text-decoration: none; }
      .atlas-gallery-link { font-size: 12px; color: #1e6bb8; text-decoration: none; font-weight: 600; }
      .atlas-maps-link:hover, .atlas-gallery-link:hover { text-decoration: underline; }
      .atlas-no-data { padding: 40px; text-align: center; color: #6b7280; font-size: 14px; line-height: 1.6; }
    `;
    document.head.appendChild(style);
  }

  // ── No-data state ─────────────────────────────────────────────────────────
  function showNoData(msg) {
    const el = document.getElementById("map");
    if (!el) return;
    el.style.height = "auto";
    el.innerHTML = `<div class="atlas-no-data">${msg}</div>`;
    const countEl = document.getElementById("map-count");
    if (countEl) countEl.textContent = "";
  }

  // ── Bootstrap ──────────────────────────────────────────────────────────────
  function bootstrap() {
    injectStyles();
    wireFilters();

    loadData()
      .then(projects => {
        allProjects = projects.filter(p => p.lat && p.lng);
        if (!allProjects.length) {
          showNoData("No geocoded projects found. Run <code>generate_website_data.py</code> or export from the Case Study Manager to populate the map.");
          return;
        }
        initMap();
        renderMarkers();
      })
      .catch(() => {
        showNoData(
          "Map data not loaded. " +
          "Open the <strong>Case Study Manager</strong> and click <strong>Export to Website</strong>, " +
          "or run <code>generate_website_data.py</code> from the New Website folder."
        );
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap);
  } else {
    bootstrap();
  }
})();
