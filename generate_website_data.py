#!/usr/bin/env python3
"""
Generate website map data from Case Study Manager project tags.

Reads every tags.json under projects - Copy/, geocodes any project that has a
google_formatted_address but no lat/lng, then writes two output files:

  assets/data/projects.json        — raw JSON for http:// serving
  assets/data/projects-data.js     — window.PROJECTS_DATA = [...] for file:// serving

Geocoding uses Nominatim (OpenStreetMap) — no API key required, 1 req/sec.
Previously geocoded coordinates are read from tags.json lat/lng fields if present;
set FORCE_GEOCODE=1 to re-geocode everything.

Usage:
    python generate_website_data.py              # normal run
    FORCE_GEOCODE=1 python generate_website_data.py  # re-geocode all
"""

from __future__ import annotations

import json
import os
import time
import urllib.parse
import urllib.request
from pathlib import Path

# ── Paths ─────────────────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECTS_ROOT = SCRIPT_DIR / "projects - Copy"
OUT_JSON = SCRIPT_DIR / "assets" / "data" / "projects.json"
OUT_JS = SCRIPT_DIR / "assets" / "data" / "projects-data.js"
FORCE = os.environ.get("FORCE_GEOCODE") == "1"

# ── Category mapping ──────────────────────────────────────────────────────────
INDUSTRY_CATEGORY: dict[str, str] = {
    "Transit Authority": "Transit",
    "Municipal / Parks & Rec": "Parks & Trails",
    "Federal / DHS / Government Agency": "Emergency / Resilience",
    "Higher Education": "Smart Infrastructure",
    "K-12 / School District": "Smart Infrastructure",
    "Healthcare": "Public Safety",
    "Hospitality / Commercial": "Smart Infrastructure",
    "Utility": "Emergency / Resilience",
    "Other": "Smart Infrastructure",
}


def folder_category_hint(folder: str) -> str | None:
    """Derive category from folder name keywords."""
    n = folder.lower()
    if any(kw in n for kw in ("camera", "surveillance")):
        return "Public Safety"
    if any(kw in n for kw in ("homeland", "dhs", "dept_homeland")):
        return "Emergency / Resilience"
    if any(kw in n for kw in ("generator", "genear", "solar gen")):
        return "Emergency / Resilience"
    if any(kw in n for kw in ("veterans", "naval", "navy", "naval_air")):
        return "Public Safety"
    if any(kw in n for kw in (
        "transit", "gotriangle", "gocary", "palm_tran", "capital_metro",
        "golden_empire", "westchester", "metro", "_tps", "bus_shelter",
    )):
        return "Transit"
    if any(kw in n for kw in ("park", "greenway", "trail", "greenway", "river")):
        return "Parks & Trails"
    return None


def category_for(tags: dict, folder: str) -> str:
    industry = tags.get("industry", "")
    hint = folder_category_hint(folder)
    # Folder name beats an empty industry; explicit industry beats hint
    if industry and industry in INDUSTRY_CATEGORY:
        cat = INDUSTRY_CATEGORY[industry]
        # Override Federal/DHS entries with folder hint when more specific
        if cat == "Emergency / Resilience" and hint == "Public Safety":
            return "Public Safety"
        return cat
    return hint or INDUSTRY_CATEGORY.get(industry, "Smart Infrastructure")


# ── Nominatim geocoding ───────────────────────────────────────────────────────
_geocode_cache: dict[str, tuple[float, float] | None] = {}
_last_request: float = 0.0


def _nominatim_query(query: str) -> tuple[float, float] | None:
    """Single Nominatim request, rate-limited to 1 req/s."""
    global _last_request
    wait = 1.05 - (time.monotonic() - _last_request)
    if wait > 0:
        time.sleep(wait)
    url = (
        "https://nominatim.openstreetmap.org/search?"
        + urllib.parse.urlencode({"q": query, "format": "json", "limit": 1})
    )
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "AKRandall-WebsiteExport/1.0 (akrandall91@gmail.com)"},
    )
    try:
        _last_request = time.monotonic()
        with urllib.request.urlopen(req, timeout=15) as resp:
            results = json.loads(resp.read())
        if results:
            return float(results[0]["lat"]), float(results[0]["lon"])
    except Exception as exc:
        print(f"  Geocode error for {query!r}: {exc}")
    return None


def _simplify_address(address: str) -> str:
    """Strip suite/floor/unit noise that confuses Nominatim."""
    import re
    # Remove Plus Codes (e.g. "VWX8+84, ")
    address = re.sub(r'^[A-Z0-9]{4,8}\+[A-Z0-9]{2,4},?\s*', '', address)
    # Remove floor/suite/unit suffixes
    address = re.sub(r'\b(Suite|Ste|Floor|Fl|Unit|#)\s*[\w-]+', '', address, flags=re.IGNORECASE)
    # Remove "Carnegie Lecture Hall" style secondary names
    address = re.sub(r',\s*[^,]*(Hall|Building|Center|Room|Lobby)[^,]*', '', address, flags=re.IGNORECASE)
    # Collapse extra spaces and commas
    address = re.sub(r',\s*,', ',', address)
    address = re.sub(r'\s+', ' ', address).strip().strip(',').strip()
    return address


def geocode(address: str) -> tuple[float, float] | None:
    """Return (lat, lng) for an address using Nominatim. Rate-limited to 1 req/s."""
    if not address or not address.strip():
        return None
    key = address.strip().lower()
    if key in _geocode_cache:
        return _geocode_cache[key]

    # Try full address first
    result = _nominatim_query(address)
    if result:
        _geocode_cache[key] = result
        return result

    # Try simplified address (strip suite/floor/plus-code noise)
    simplified = _simplify_address(address)
    if simplified and simplified.lower() != key:
        result = _nominatim_query(simplified)
        if result:
            _geocode_cache[key] = result
            return result

    # Try city+state only as last resort
    parts = [p.strip() for p in address.split(",")]
    if len(parts) >= 3:
        city_state = ", ".join(parts[-3:-1]).strip()  # last two significant parts before country
        if city_state and city_state.lower() != key:
            result = _nominatim_query(city_state)
            if result:
                print(f"  (used city-state fallback for {address!r})")
                _geocode_cache[key] = result
                return result

    _geocode_cache[key] = None
    return None


# ── Tags loading ──────────────────────────────────────────────────────────────
def load_tags(project_dir: Path) -> dict:
    path = project_dir / "tags.json"
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def load_backstory(project_dir: Path) -> str:
    path = project_dir / "backstory.md"
    if not path.exists():
        return ""
    text = path.read_text(encoding="utf-8", errors="replace").strip()
    # First non-empty, non-heading paragraph
    for line in text.splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            return line[:220]
    return ""


def find_thumbnail(project_dir: Path) -> str | None:
    IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp"}
    for path in sorted(project_dir.rglob("*")):
        if path.suffix.lower() in IMAGE_EXT and path.is_file():
            return str(path)
    return None


# ── Main export ───────────────────────────────────────────────────────────────
def build_projects() -> list[dict]:
    skip = {"_case_study_manager", "Proof_Items"}
    dirs = sorted(
        [d for d in PROJECTS_ROOT.iterdir() if d.is_dir() and d.name not in skip],
        key=lambda d: d.name.casefold(),
    )

    projects = []
    for project_dir in dirs:
        tags = load_tags(project_dir)
        address = tags.get("google_formatted_address", "").strip()
        lat = tags.get("lat") or None
        lng = tags.get("lng") or None

        # Resolve coordinates
        if (not lat or not lng or FORCE) and address:
            print(f"  Geocoding: {project_dir.name}")
            coords = geocode(address)
            if coords:
                lat, lng = coords
                # Write back to tags.json so future runs skip geocoding
                tags["lat"] = round(lat, 6)
                tags["lng"] = round(lng, 6)
                (project_dir / "tags.json").write_text(
                    json.dumps(tags, indent=2, ensure_ascii=False) + "\n",
                    encoding="utf-8",
                )
            else:
                print(f"    No coords found for: {address}")

        if not lat or not lng:
            print(f"  Skipping (no coordinates): {project_dir.name}")
            continue

        # Derive year from modification time if not tagged
        year = tags.get("year") or None
        if not year:
            mtime = project_dir.stat().st_mtime
            import datetime
            year = datetime.datetime.fromtimestamp(mtime).year

        projects.append({
            "id": project_dir.name,
            "name": tags.get("official_name") or project_dir.name,
            "city_state": tags.get("city_state", ""),
            "category": category_for(tags, project_dir.name),
            "lat": round(float(lat), 6),
            "lng": round(float(lng), 6),
            "deal_type": tags.get("deal_type", ""),
            "cold_rfp_win": bool(tags.get("cold_rfp_win")),
            "industry": tags.get("industry", ""),
            "year": year,
            "google_maps_url": tags.get("google_maps_url", ""),
            "description": load_backstory(project_dir),
        })

    return projects


def write_outputs(projects: list[dict]) -> None:
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)

    OUT_JSON.write_text(
        json.dumps(projects, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    js_content = (
        "// Auto-generated by generate_website_data.py — do not edit manually.\n"
        "// Re-run the script to refresh project data.\n"
        "window.PROJECTS_DATA = "
        + json.dumps(projects, ensure_ascii=False)
        + ";\n"
    )
    OUT_JS.write_text(js_content, encoding="utf-8")


def main() -> None:
    print(f"Projects root: {PROJECTS_ROOT}")
    print(f"Force re-geocode: {FORCE}")
    print("Building project list…")

    projects = build_projects()

    print(f"\n{len(projects)} projects with coordinates.")
    write_outputs(projects)
    print(f"Wrote: {OUT_JSON}")
    print(f"Wrote: {OUT_JS}")

    category_counts: dict[str, int] = {}
    for p in projects:
        category_counts[p["category"]] = category_counts.get(p["category"], 0) + 1
    for cat, count in sorted(category_counts.items()):
        print(f"  {cat}: {count}")


if __name__ == "__main__":
    main()
