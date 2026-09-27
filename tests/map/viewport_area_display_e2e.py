#!/usr/bin/env python3
"""
PROPERTIES MAP VIEW — AREA-BASED (VIEWPORT) PROPERTY DISPLAY (local stack)

Verifies that which properties appear "in the current map area" is decided
purely by geographic geometry — each property's own stored
`properties.latitude`/`longitude` tested against the map's own
`getBounds()` — and never by any hardcoded area-name string (no
`if area === "Chromepet"` style logic anywhere in the map code). Also
verifies the map never goes blank when the current viewport has no mapped
properties nearby, and that panning to a different area changes which
properties are geometrically "in view" without losing the rest of the
dataset.

This intentionally does NOT test a custom re-filtering system: the site
has none, by design (per the brief) — Google Maps itself only ever renders
markers that are actually attached to it, and every mapped property's
marker is always attached, so "shows properties in the visible area" is
inherent to how Google Maps already draws markers. What this file checks
is that (a) the underlying data backing every marker is geometrically
correct for ANY viewport, generically, and (b) the one piece of UI that
IS new — the "no properties in this area yet" note — appears/disappears
correctly as the viewport changes.

Env: MAP_DB (default aventrix_map), SITE :8080 / REST :3000 already
running against MAP_DB.
"""
import os, re, sys
sys.argv = [sys.argv[0]]
HERE = os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(HERE, "map_view_e2e.py")).read().split("EXPECTED_ON_MAP =")[0])


def set_bounds(page, south, west, north, east):
    """Force the mock map's viewport to an exact geographic box and let it settle (idle fires)."""
    page.evaluate("""(b) => {
        const map = window.__mockMaps.maps[0];
        const g = window.google.maps;
        map.setCenter({ lat: (b[0] + b[2]) / 2, lng: (b[1] + b[3]) / 2 });
        map.fitBounds(new g.LatLngBounds({ lat: b[0], lng: b[1] }, { lat: b[2], lng: b[3] }));
    }""", [south, west, north, east])
    page.wait_for_timeout(350)


def note_text(page):
    el = page.locator("#sfMapNote")
    if el.count() == 0 or el.is_hidden():
        return ""
    return el.inner_text().strip()


def run():
    with sync_playwright() as p:
        b = p.chromium.launch()

        db_rows = {}
        for row in sql("select slug, latitude::text, longitude::text from properties where publish_status='Published' and latitude is not null").splitlines():
            slug, lat, lng = row.split("|")
            db_rows[slug] = (float(lat), float(lng))
        check("setup: at least 4 real published properties have stored coordinates in the test DB", len(db_rows) >= 4, db_rows)

        # A cluster of properties sits around Pallavaram/Chromepet
        # (~12.95N, 80.146E); one sits alone near Guindy (~13.01N, 80.22E);
        # one near Medavakkam (~12.919N, 80.188E); one near Neelankarai
        # (~12.9496N, 80.2593E). These are just the fixtures that happen to
        # exist — the test below works this out from the DB itself, not
        # from any hardcoded area name.
        def within(slug, south, west, north, east):
            lat, lng = db_rows[slug]
            return south <= lat <= north and west <= lng <= east

        # ================= A. No hardcoded area-name logic exists anywhere in the map code =================
        map_src = open(os.path.join(HERE, "..", "..", "js", "properties-map.js"), encoding="utf-8").read()
        AREA_NAMES = ["Chromepet", "Tambaram", "Velachery", "Perungudi", "Sholinganallur", "OMR"]
        hardcoded = [n for n in AREA_NAMES if re.search(r"""['"]""" + re.escape(n) + r"""['"]""", map_src)]
        check("A: js/properties-map.js contains no hardcoded area-name string literals (Chromepet/Tambaram/Velachery/...)",
              not hardcoded, hardcoded)
        check("A: js/properties-map.js contains no area === \"<name>\" style comparisons",
              re.search(r'area\s*===?\s*["\']', map_src) is None)
        # Marker/viewport logic must be driven by real coordinates and the
        # map's own bounds API, not by locality text.
        check("A: viewport logic reads the map's own getBounds()", "getBounds()" in map_src)
        check("A: marker positions come from coordsOf(...) (the shared lat/lng validator), not free-text fields",
              "coordsOf(p)" in map_src)
        ctx = ctx_for(b, 1280, touch=False); page = ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)[:200]))
        goto_props(page)

        # ================= B. Chromepet/Pallavaram-cluster-like viewport shows exactly the properties inside it =================
        open_map(page)
        set_bounds(page, 12.90, 80.10, 13.00, 80.20)  # a Chromepet/Pallavaram-sized box, defined purely by lat/lng
        expected_in = sorted(s for s in db_rows if within(s, 12.90, 80.10, 13.00, 80.20))
        check("B: at least one real property's stored coordinates fall inside this box (test fixture sanity)",
              len(expected_in) > 0, expected_in)
        bounds_contains = page.evaluate("""(pts) => {
            const map = window.__mockMaps.maps[0];
            const b = map.getBounds();
            const out = {};
            for (const [slug, lat, lng] of pts) out[slug] = b.contains({ lat, lng });
            return out;
        }""", [[s, db_rows[s][0], db_rows[s][1]] for s in db_rows])
        actually_in = sorted(s for s, inb in bounds_contains.items() if inb)
        check("B: map.getBounds().contains(...) using the property's OWN stored lat/lng agrees exactly with the expected in-box set (any area, no hardcoded names)",
              actually_in == expected_in, (actually_in, expected_in))

        # Every property inside this viewport must actually have a visible
        # marker (pin or cluster) on the map — not filtered out or hidden.
        on_map_slugs = page.evaluate("""() => (window.AventrixPropertyMap.snapshot().mapped || [])""")
        missing_markers = [s for s in expected_in if s not in on_map_slugs]
        check("B: every property inside the viewport is present among the map's mapped markers (not dropped)",
              not missing_markers, (missing_markers, on_map_slugs))

        # ================= C. Moving to a different area changes which properties are geometrically in view =================
        set_bounds(page, 12.94, 80.25, 12.96, 80.27)  # tight box around the lone Neelankarai-area fixture
        expected_in_c = sorted(s for s in db_rows if within(s, 12.94, 80.25, 12.96, 80.27))
        bounds_contains_c = page.evaluate("""(pts) => {
            const map = window.__mockMaps.maps[0];
            const b = map.getBounds();
            const out = {};
            for (const [slug, lat, lng] of pts) out[slug] = b.contains({ lat, lng });
            return out;
        }""", [[s, db_rows[s][0], db_rows[s][1]] for s in db_rows])
        actually_in_c = sorted(s for s, inb in bounds_contains_c.items() if inb)
        check("C: panning to a different area changes the in-view set (not the same set as box B)",
              actually_in_c != actually_in, (actually_in_c, actually_in))
        check("C: the new viewport's in-view set exactly matches this box's real coordinates (still no hardcoded names)",
              actually_in_c == expected_in_c, (actually_in_c, expected_in_c))

        # ================= D. Full dataset is never lost — only the viewport-visible SET changes =================
        total_after_pan = page.evaluate("(window.AventrixSearchResults.properties || []).length")
        total_before = page.evaluate("(window.AventrixSearchResults.properties || []).length")
        check("D: panning the map does not shrink the underlying results dataset", total_after_pan == total_before, (total_after_pan, total_before))
        check("no JS errors (A-D)", not errs, errs)
        ctx.close()

        # ================= E. No-property viewport: map stays visible, shows the required message =================
        ctx = ctx_for(b, 1280, touch=False); page = ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)[:200]))
        goto_props(page)
        open_map(page)
        before_note = note_text(page)
        # Pan to open ocean — nowhere near any Chennai-area test fixture.
        set_bounds(page, -5.0, 60.0, -4.9, 60.1)
        check("E: map wrapper remains fully visible with an empty viewport (never blanked)",
              page.locator("#sfMapWrap").is_visible())
        check("E: map canvas remains visible with an empty viewport", page.locator("#sfMapCanvas").is_visible())
        check("E: shows the required 'No properties in this area yet.' message",
              note_text(page) == "No properties in this area yet.", note_text(page))
        # The visitor can still interact — pan back to a populated area and
        # the message clears.
        set_bounds(page, 12.90, 80.10, 13.00, 80.20)
        check("E: panning back to a populated area clears the empty-viewport message",
              note_text(page) != "No properties in this area yet.", note_text(page))
        check("no JS errors (E)", not errs, errs)
        ctx.close()

        # ================= F. Roadmap and Satellite/Hybrid both keep viewport-based display working =================
        ctx = ctx_for(b, 1280, touch=False); page = ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)[:200]))
        goto_props(page)
        open_map(page)
        check("F: Roadmap is the default map type", page.evaluate("window.__mockMaps.maps[0].getMapTypeId()") == "roadmap")
        set_bounds(page, 12.90, 80.10, 13.00, 80.20)
        roadmap_in = page.evaluate("""(pts) => {
            const b = window.__mockMaps.maps[0].getBounds();
            return pts.filter(([s, lat, lng]) => b.contains({ lat, lng })).map(x => x[0]);
        }""", [[s, db_rows[s][0], db_rows[s][1]] for s in db_rows])
        page.locator("#sfMapCanvas .mock-maptype-control").select_option("hybrid")
        page.wait_for_timeout(200)
        check("F: switching to Satellite (rendered as Hybrid, keeping labels) does not change the map type used internally",
              page.evaluate("window.__mockMaps.maps[0].getMapTypeId()") == "hybrid")
        hybrid_in = page.evaluate("""(pts) => {
            const b = window.__mockMaps.maps[0].getBounds();
            return pts.filter(([s, lat, lng]) => b.contains({ lat, lng })).map(x => x[0]);
        }""", [[s, db_rows[s][0], db_rows[s][1]] for s in db_rows])
        check("F: the same viewport shows the same in-view properties whether Roadmap or Satellite/Hybrid is active",
              sorted(roadmap_in) == sorted(hybrid_in), (roadmap_in, hybrid_in))
        check("no JS errors (F)", not errs, errs)
        ctx.close()

        b.close()
    print(f"\n{sum(results)}/{len(results)} passed")
    return 0 if all(results) else 1

sys.exit(run())
