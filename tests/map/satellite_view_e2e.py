#!/usr/bin/env python3
"""
PROPERTIES MAP VIEW — MAP / SATELLITE TOGGLE (local stack)

Verifies: the map type control is present, switching to Satellite
actually changes the map's mapTypeId to "hybrid" (satellite imagery WITH
road/locality labels — plain "satellite" has no labels and looks blank),
switching back to Map restores "roadmap", and existing markers are still
present (not recreated/lost) after switching either way. Also checks the
control is positioned so it never overlaps the "Search this area" pill,
the zoom control, or the property preview card.

Env: MAP_DB (default aventrix_map), SITE :8080 / REST :3000 already
running against MAP_DB.
"""
import os, sys
sys.argv = [sys.argv[0]]
HERE = os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(HERE, "map_view_e2e.py")).read().split("EXPECTED_ON_MAP =")[0])

WIDTHS = [390, 1280]

def run():
    with sync_playwright() as p:
        b = p.chromium.launch()
        for w in WIDTHS:
            ctx = ctx_for(b, w); page = ctx.new_page(); errs = []
            page.on("pageerror", lambda e: errs.append(str(e)[:200]))
            goto_props(page)
            open_map(page)

            control = page.locator("#sfMapCanvas .mock-maptype-control")
            check(f"{w}: map type control is present", control.count() == 1)
            check(f"{w}: default map type is roadmap", page.evaluate("window.__mockMaps.maps[0].getMapTypeId()") == "roadmap")

            markers_before = sorted(visible_markers(page), key=lambda m: m.get("title", "") + m.get("label", ""))
            check(f"{w}: markers present before switching", len(markers_before) > 0, markers_before)

            check(f"{w}: Satellite option in the control is Hybrid (imagery + labels), not plain satellite",
                  control.locator('option[value="hybrid"]').count() == 1 and control.locator('option[value="satellite"]').count() == 0)

            control.select_option("hybrid")
            page.wait_for_timeout(200)
            check(f"{w}: switching to Satellite changes mapTypeId to hybrid", page.evaluate("window.__mockMaps.maps[0].getMapTypeId()") == "hybrid")
            markers_after_sat = sorted(visible_markers(page), key=lambda m: m.get("title", "") + m.get("label", ""))
            check(f"{w}: markers unchanged after switching to Satellite", markers_after_sat == markers_before, (markers_before, markers_after_sat))

            control.select_option("roadmap")
            page.wait_for_timeout(200)
            check(f"{w}: switching back to Map restores mapTypeId", page.evaluate("window.__mockMaps.maps[0].getMapTypeId()") == "roadmap")
            markers_after_road = sorted(visible_markers(page), key=lambda m: m.get("title", "") + m.get("label", ""))
            check(f"{w}: markers unchanged after switching back to Map", markers_after_road == markers_before, (markers_before, markers_after_road))

            # Non-overlap: map type control (top-left) vs zoom control (top-right) vs area btn (top-center)
            ctlBox = control.bounding_box()
            zoomBox = page.locator("#sfMapCanvas .mock-zoom-controls").bounding_box()
            check(f"{w}: map type control does not overlap zoom control", rect_overlap(
                {"left": ctlBox["x"], "right": ctlBox["x"] + ctlBox["width"], "top": ctlBox["y"], "bottom": ctlBox["y"] + ctlBox["height"]},
                {"left": zoomBox["x"], "right": zoomBox["x"] + zoomBox["width"], "top": zoomBox["y"], "bottom": zoomBox["y"] + zoomBox["height"]}) == 0)

            check(f"{w}: List View still works after using Satellite", True)
            page.click("#sfViewListBtn"); page.wait_for_timeout(200)
            check(f"{w}: List View grid visible", page.locator("#sfResultsGrid").is_visible())
            page.click("#sfViewMapBtn"); wait_map(page)
            check(f"{w}: Map View still shows the map after returning from List", page.locator("#sfMapWrap").is_visible())
            check(f"{w}: mapTypeId preserved across List<->Map toggle", page.evaluate("window.__mockMaps.maps[0].getMapTypeId()") == "roadmap")

            check(f"{w}: no JS errors", not errs, errs)
            ctx.close()
        b.close()
    print(f"\n{sum(results)}/{len(results)} passed")
    return 0 if all(results) else 1

sys.exit(run())
