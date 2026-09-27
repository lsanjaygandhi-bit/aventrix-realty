#!/usr/bin/env python3
"""
PROPERTIES MAP VIEW — "NEVER BLANK" DEFAULT VIEWPORT (local stack)

Verifies: the map itself always renders and stays interactive — never
replaced by a blank panel or hidden — whether there are zero results for
the current search, results with zero coordinates, exactly one mapped
property, or several. Also verifies the default Chennai viewport, that
fitBounds() is not blindly used for 0/1 markers, and that "Search this
area" / the no-mapped-properties note never blocks the map.

Env: MAP_DB (default aventrix_map), SITE :8080 / REST :3000 already
running against MAP_DB.
"""
import os, sys
sys.argv = [sys.argv[0]]
HERE = os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(HERE, "map_view_e2e.py")).read().split("EXPECTED_ON_MAP =")[0])

CHENNAI_CENTER = {"lat": 13.0827, "lng": 80.2707}

def near(a, b, tol=0.5):
    return abs(a - b) < tol

def run():
    with sync_playwright() as p:
        b = p.chromium.launch()

        # ================= A. Zero results for the current search =================
        ctx = ctx_for(b, 1280, touch=False); page = ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)[:200]))
        goto_props(page, "?location=NoSuchLocalityXYZ999")
        check("zero-results: search returns nothing", page.evaluate("(window.AventrixSearchResults.properties || []).length") == 0)
        open_map(page)
        check("zero-results: map wrap is NOT hidden (map stays visible)", page.locator("#sfMapWrap").is_visible())
        check("zero-results: map fallback is NOT shown", page.locator("#sfMapFallback").is_hidden())
        check("zero-results: a real Google Map instance was created", page.evaluate("window.__mockMaps.maps.length") >= 1)
        center = page.evaluate("window.__mockMaps.maps[0].getCenter().toJSON()")
        check("zero-results: map centers on the default Chennai viewport",
              near(center["lat"], CHENNAI_CENTER["lat"]) and near(center["lng"], CHENNAI_CENTER["lng"]), center)
        zoom = page.evaluate("window.__mockMaps.maps[0].getZoom()")
        check("zero-results: default zoom is a metro-wide (not street-level, not world-level) view", 8 <= zoom <= 13, zoom)
        note = page.locator("#sfMapNote")
        check("zero-results: a subtle note is shown", note.is_visible() and note.inner_text().strip() != "")
        check("zero-results: the note does not cover/hide the map canvas",
              page.locator("#sfMapCanvas").is_visible())
        check("no JS errors (zero-results)", not errs, errs)
        ctx.close()

        # ================= B. Results present, none of them mapped =================
        ctx = ctx_for(b, 1280, touch=False); page = ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)[:200]))
        goto_props(page, "?priceMin=1000000000")  # isolates edge-long-price (no lat/lng)
        slugs_b = page.evaluate("(window.AventrixSearchResults.properties || []).map(p => p.slug)")
        check("no-coords: filter isolates exactly the unmapped test property", slugs_b == ["edge-long-price"], slugs_b)
        open_map(page)
        check("no-coords: map wrap is NOT hidden", page.locator("#sfMapWrap").is_visible())
        check("no-coords: no markers on the map", len(visible_markers(page)) == 0)
        center2 = page.evaluate("window.__mockMaps.maps[0].getCenter().toJSON()")
        check("no-coords: map centers on the default Chennai viewport",
              near(center2["lat"], CHENNAI_CENTER["lat"]) and near(center2["lng"], CHENNAI_CENTER["lng"]), center2)
        check("no-coords: subtle 'no mapped properties' note shown, map still interactive",
              page.locator("#sfMapNote").is_visible() and page.locator("#sfMapCanvas").is_visible())
        check("no JS errors (no-coords)", not errs, errs)
        ctx.close()

        # ================= C. Exactly one mapped property: center + reasonable zoom, no fitBounds =================
        ctx = ctx_for(b, 1280, touch=False); page = ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)[:200]))
        goto_props(page, "?location=Medavakkam")
        results_c = page.evaluate("(window.AventrixSearchResults.properties || []).map(p => p.slug)")
        check("one-mapped: filter isolates exactly one mapped property", results_c == ["pub-medavakkam-2bhk"], results_c)
        open_map(page)
        markers_c = visible_markers(page)
        check("one-mapped: exactly one marker shown", len(markers_c) == 1, markers_c)
        m = page.evaluate("window.__mockMaps.maps[0]")
        zoom_c = page.evaluate("window.__mockMaps.maps[0].getZoom()")
        check("one-mapped: reasonable (not maximally close) zoom retaining geographic context", 12 <= zoom_c <= 17, zoom_c)
        check("one-mapped: fitBounds() was not invoked for a single marker (no __lastFit recorded)",
              page.evaluate("!window.__mockMaps.maps[0].__lastFit"))
        check("no JS errors (one-mapped)", not errs, errs)
        ctx.close()

        # ================= D. Multiple mapped properties: fitBounds used, all visible =================
        ctx = ctx_for(b, 1280, touch=False); page = ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)[:200]))
        goto_props(page)
        open_map(page)
        check("multi: fitBounds() WAS used for 2+ markers", page.evaluate("!!window.__mockMaps.maps[0].__lastFit"))
        markers_d = visible_markers(page)
        check("multi: more than one marker/cluster visible", len(markers_d) > 1, markers_d)
        check("no JS errors (multi)", not errs, errs)
        ctx.close()

        # ================= E. Manual pan/zoom is not forced back to fit bounds =================
        ctx = ctx_for(b, 1280, touch=False); page = ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)[:200]))
        goto_props(page)
        open_map(page)
        fit_before = page.evaluate("window.__mockMaps.maps[0].__lastFit")
        page.evaluate("window.__mockMaps.maps[0].__dragBy(500, 0)")
        page.wait_for_timeout(300)
        moved_center = page.evaluate("window.__mockMaps.maps[0].getCenter().toJSON()")
        page.wait_for_timeout(500)
        after_idle_center = page.evaluate("window.__mockMaps.maps[0].getCenter().toJSON()")
        check("no-reset: the map does not snap back after the visitor pans it",
              abs(moved_center["lng"] - after_idle_center["lng"]) < 0.001, (moved_center, after_idle_center))
        check("no JS errors (no-reset)", not errs, errs)
        ctx.close()

        b.close()
    print(f"\n{sum(results)}/{len(results)} passed")
    return 0 if all(results) else 1

sys.exit(run())
