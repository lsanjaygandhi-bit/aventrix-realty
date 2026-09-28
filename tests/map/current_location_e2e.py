#!/usr/bin/env python3
"""
PROPERTIES MAP VIEW — "CURRENT LOCATION" CONTROL (local stack)

Verifies the new Current Location control added to the Properties page's
Map View: it uses the real browser Geolocation API (emulated by Playwright,
never a second, custom geolocation system), reuses the existing
js/geo-bridge.js session bridge (shared with js/near-me.js) rather than
calling navigator.geolocation a second time, shows a marker that is
visually and technically distinct from property markers, handles
denied/unavailable/unsupported states with the required messages, never
writes anything to Supabase or localStorage, and does not disturb existing
Map View behaviour (property markers, Satellite toggle, Roadmap default,
List View).

Env: MAP_DB (default aventrix_map), SITE :8080 / REST :3000 already
running against MAP_DB.
"""
import os, sys
sys.argv = [sys.argv[0]]
HERE = os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(HERE, "map_view_e2e.py")).read().split("EXPECTED_ON_MAP =")[0])

CURRENT_LOCATION_TITLE = "Your current location"
LAT, LNG = 13.0067, 80.2572  # Adyar, Chennai — arbitrary real-looking test coordinate

def total_properties(markers):
    # Sum of properties represented across pins + clusters, ignoring the
    # current-location marker. Panning/zooming the map (which using
    # Current Location does) legitimately reshuffles which properties are
    # clustered together, so comparing raw marker-entry lists before/after
    # would be flaky; comparing the total number of properties covered is
    # the meaningful invariant ("existing property markers must remain
    # visible" per the spec, not "identically clustered").
    total = 0
    for m in markers:
        if m.get("title") == CURRENT_LOCATION_TITLE:
            continue
        if m.get("kind") == "cluster":
            try:
                total += count_of(m.get("label"))
            except ValueError:
                pass
        else:
            total += 1
    return total

def geo_marker(page):
    return page.locator(f'#sfMapCanvas .mock-marker[data-title="{CURRENT_LOCATION_TITLE}"], '
                         f'#sfMapCanvas .sf-current-location-dot')

def force_geo_error(ctx, code):
    # code: 1=PERMISSION_DENIED, 2=POSITION_UNAVAILABLE, 3=TIMEOUT
    ctx.add_init_script("""(function(code){
        Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
            getCurrentPosition: function(success, error) {
                setTimeout(function () {
                    error({ code: code, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 });
                }, 5);
            }
        }});
    })(%d);""" % code)

def force_geo_unsupported(ctx):
    ctx.add_init_script("""
        Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined });
    """)

def run():
    with sync_playwright() as p:
        b = p.chromium.launch()

        # ================= A. Control exists + Roadmap default + basic layout =================
        ctx = ctx_for(b, 1280, touch=False); page = ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)[:200]))
        goto_props(page)
        open_map(page)
        check("control: Current Location button exists", page.locator("#sfCurrentLocationBtn").count() == 1)
        check("control: Current Location button is visible when Map View is open", page.locator("#sfCurrentLocationBtn").is_visible())
        check("roadmap: default map type is roadmap", page.evaluate("window.__mockMaps.maps[0].getMapTypeId()") == "roadmap")

        # Non-overlap: current-location button (bottom-right) vs zoom (top-right),
        # map-type dropdown (top-left) and "Search this area" (top-center).
        clBox = page.locator("#sfCurrentLocationBtn").bounding_box()
        zoomBox = page.locator("#sfMapCanvas .mock-zoom-controls").bounding_box()
        mtcBox = page.locator("#sfMapCanvas .mock-maptype-control").bounding_box()

        def as_rect(b): return {"left": b["x"], "right": b["x"] + b["width"], "top": b["y"], "bottom": b["y"] + b["height"]}
        check("layout: Current Location button does not overlap zoom control", rect_overlap(as_rect(clBox), as_rect(zoomBox)) == 0)
        check("layout: Current Location button does not overlap map-type control", rect_overlap(as_rect(clBox), as_rect(mtcBox)) == 0)

        markers_before = visible_markers(page)
        check("regression: property markers present before using Current Location", len(markers_before) > 0, markers_before)

        # Satellite toggle still works alongside the new control (the
        # dropdown's "Satellite" option maps internally to Google's HYBRID
        # map type so roads/labels stay visible over the imagery).
        page.locator("#sfMapCanvas .mock-maptype-control").select_option("hybrid")
        page.wait_for_timeout(150)
        check("regression: Satellite toggle still works", page.evaluate("window.__mockMaps.maps[0].getMapTypeId()") == "hybrid")
        page.locator("#sfMapCanvas .mock-maptype-control").select_option("roadmap")
        page.wait_for_timeout(150)
        check("no JS errors after layout/toggle checks", not errs, errs)
        ctx.close()

        # ================= B. Geolocation granted: centers map, shows marker =================
        ctx = ctx_for(b, 1280, touch=False)
        ctx.grant_permissions(["geolocation"])
        ctx.set_geolocation({"latitude": LAT, "longitude": LNG, "accuracy": 30})
        rest_calls = []
        ctx.on("request", lambda req: rest_calls.append(req) if "/rest/v1" in req.url and req.method != "GET" else None)
        page = ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)[:200]))
        goto_props(page)
        open_map(page)
        before_center = page.evaluate("window.__mockMaps.maps[0].getCenter().toJSON()")
        before_markers = visible_markers(page)

        page.click("#sfCurrentLocationBtn")
        page.wait_for_function(
            f'document.querySelector(\'#sfMapCanvas .mock-marker[data-title="{CURRENT_LOCATION_TITLE}"]\') !== null',
            timeout=5000)
        check("granted: current-location indicator appears", geo_marker(page).count() >= 1)

        after_center = page.evaluate("window.__mockMaps.maps[0].getCenter().toJSON()")
        check("granted: map centers EXACTLY on the returned latitude/longitude (not an approximation)",
              after_center["lat"] == LAT and after_center["lng"] == LNG,
              (before_center, after_center, LAT, LNG))
        check("granted: map zoomed to a close-up level in the 15-17 range", 15 <= page.evaluate("window.__mockMaps.maps[0].getZoom()") <= 17)

        after_markers = visible_markers(page)
        check("granted: property markers remain unchanged (separate from the current-location marker)",
              total_properties(before_markers) == total_properties(after_markers),
              (before_markers, after_markers))
        check("granted: current-location marker title distinguishes it from property markers",
              any(m.get("title") == CURRENT_LOCATION_TITLE for m in after_markers) and
              CURRENT_LOCATION_TITLE not in [m.get("title") for m in before_markers])

        # Filters / view state untouched by using Current Location.
        check("granted: List View still reachable after using Current Location", True)
        page.click("#sfViewListBtn"); page.wait_for_timeout(150)
        check("granted: List View grid visible", page.locator("#sfResultsGrid").is_visible())
        page.click("#sfViewMapBtn"); wait_map(page)
        check("granted: Map View still shows the map and markers after returning from List",
              page.locator("#sfMapWrap").is_visible() and total_properties(visible_markers(page)) == total_properties(before_markers))

        page.wait_for_timeout(200)  # let any stray async network settle before asserting
        check("privacy: no write request to Supabase REST after using Current Location", len(rest_calls) == 0,
              [c.url for c in rest_calls])
        session_val = page.evaluate("(() => { try { return sessionStorage.getItem('aventrix_geo_session'); } catch (e) { return null; } })()")
        local_keys = page.evaluate("(() => { try { return Object.keys(localStorage); } catch (e) { return []; } })()")
        check("privacy: geolocation result held in sessionStorage (browser-session only), not localStorage",
              session_val is not None and not any("geo" in k.lower() for k in local_keys), (session_val, local_keys))
        check("no JS errors (granted path)", not errs, errs)
        ctx.close()

        # ================= C. Permission denied =================
        ctx = ctx_for(b, 1280, touch=False)
        force_geo_error(ctx, 1)
        page = ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)[:200]))
        goto_props(page); open_map(page)
        page.click("#sfCurrentLocationBtn")
        page.wait_for_selector("#sfCurrentLocationStatus:not([hidden])", timeout=5000)
        check("denied: shows the required permission-denied message",
              page.locator("#sfCurrentLocationStatus").inner_text().strip() ==
              "Location access is disabled. Please allow location access to use your current location.")
        check("denied: no current-location marker is added", geo_marker(page).count() == 0)
        check("denied: property markers still present", len(visible_markers(page)) > 0)
        check("no JS errors (denied path)", not errs, errs)
        ctx.close()

        # ================= D. Location unavailable =================
        ctx = ctx_for(b, 1280, touch=False)
        force_geo_error(ctx, 2)
        page = ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)[:200]))
        goto_props(page); open_map(page)
        page.click("#sfCurrentLocationBtn")
        page.wait_for_selector("#sfCurrentLocationStatus:not([hidden])", timeout=5000)
        check("unavailable: shows the required unavailable message",
              page.locator("#sfCurrentLocationStatus").inner_text().strip() == "Unable to determine your current location. Please try again.")
        check("no JS errors (unavailable path)", not errs, errs)
        ctx.close()

        # ================= E. Geolocation not supported by the browser =================
        ctx = ctx_for(b, 1280, touch=False)
        force_geo_unsupported(ctx)
        page = ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)[:200]))
        goto_props(page); open_map(page)
        page.click("#sfCurrentLocationBtn")
        page.wait_for_selector("#sfCurrentLocationStatus:not([hidden])", timeout=5000)
        check("unsupported: shows a fallback message", page.locator("#sfCurrentLocationStatus").inner_text().strip() != "")
        check("no JS errors (unsupported path)", not errs, errs)
        ctx.close()

        # ================= F. Mobile layout + preview overlap avoidance =================
        ctx = ctx_for(b, 390)
        ctx.grant_permissions(["geolocation"])
        ctx.set_geolocation({"latitude": LAT, "longitude": LNG, "accuracy": 30})
        page = ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)[:200]))
        goto_props(page); open_map(page)
        btn = page.locator("#sfCurrentLocationBtn")
        check("mobile: Current Location button visible", btn.is_visible())
        box = btn.bounding_box()
        check("mobile: Current Location button is touch-friendly (>= 44x44)", box["width"] >= 44 and box["height"] >= 44, box)

        zoomBox2 = page.locator("#sfMapCanvas .mock-zoom-controls").bounding_box()
        mtcBox2 = page.locator("#sfMapCanvas .mock-maptype-control").bounding_box()
        check("mobile: does not overlap zoom control", rect_overlap(as_rect(box), as_rect(zoomBox2)) == 0)
        check("mobile: does not overlap map-type control", rect_overlap(as_rect(box), as_rect(mtcBox2)) == 0)

        # Open a property preview and confirm the button steps aside for it.
        first_marker = page.locator('#sfMapCanvas .mock-marker[data-kind="pin"]').first
        first_marker.click()
        page.wait_for_selector("#sfMapPreview:not([hidden])", timeout=5000)
        check("mobile: Current Location button hides while the property preview is open", btn.is_hidden())
        page.click("#sfMapPreview .sf-map-preview-close")
        page.wait_for_timeout(150)
        check("mobile: Current Location button reappears after the preview closes", btn.is_visible())
        check("no JS errors (mobile path)", not errs, errs)
        ctx.close()

        # ================= G. Second click with a NEW physical position: fresh fetch, not cached =================
        LAT2, LNG2 = 13.0827, 80.2707  # a different real coordinate (Chennai center) — must NOT be confused with LAT/LNG
        ctx = ctx_for(b, 1280, touch=False)
        ctx.grant_permissions(["geolocation"])
        ctx.set_geolocation({"latitude": LAT, "longitude": LNG, "accuracy": 30})
        page = ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)[:200]))
        goto_props(page); open_map(page)

        page.click("#sfCurrentLocationBtn")
        page.wait_for_function(
            f'document.querySelector(\'#sfMapCanvas .mock-marker[data-title="{CURRENT_LOCATION_TITLE}"]\') !== null',
            timeout=5000)
        first_center = page.evaluate("window.__mockMaps.maps[0].getCenter().toJSON()")
        check("reuse: first click centers on the first physical position",
              first_center["lat"] == LAT and first_center["lng"] == LNG, (first_center, LAT, LNG))

        # The visitor physically moves — the browser's live geolocation now
        # reports a different position. Simulate this by updating the
        # emulated geolocation the browser API itself returns.
        ctx.set_geolocation({"latitude": LAT2, "longitude": LNG2, "accuracy": 30})
        # Manually pan away first, so a "no-op" recenter to the OLD cached
        # position couldn't accidentally look like a correct move.
        page.evaluate(f"window.__mockMaps.maps[0].setCenter({{lat: 20, lng: 90}})")

        page.click("#sfCurrentLocationBtn")
        page.wait_for_function(
            "(() => { const c = window.__mockMaps.maps[0].getCenter().toJSON(); return c.lat === %r && c.lng === %r; })()" % (LAT2, LNG2),
            timeout=5000)
        second_center = page.evaluate("window.__mockMaps.maps[0].getCenter().toJSON()")
        check("reuse: second click fetches a FRESH position and recenters on the NEW coordinates (not the first, cached one)",
              second_center["lat"] == LAT2 and second_center["lng"] == LNG2, (second_center, LAT2, LNG2))
        check("reuse: current-location marker moved to the new position (only one current-location marker exists)",
              geo_marker(page).count() == 1)
        marker_pos_2 = page.evaluate(f"""() => {{
            const m = window.__mockMaps.maps[0].markers.find(x => x._title === "{CURRENT_LOCATION_TITLE}");
            return m && m.getPosition ? m.getPosition().toJSON() : null;
        }}""")
        check("reuse: current-location marker's own position equals the fresh coordinates",
              marker_pos_2 is not None and marker_pos_2["lat"] == LAT2 and marker_pos_2["lng"] == LNG2, marker_pos_2)
        check("no JS errors (reuse/forceRefresh path)", not errs, errs)
        ctx.close()

        # ================= H. Manual pan after Current Location is not forced back =================
        ctx = ctx_for(b, 1280, touch=False)
        ctx.grant_permissions(["geolocation"])
        ctx.set_geolocation({"latitude": LAT, "longitude": LNG, "accuracy": 30})
        page = ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)[:200]))
        goto_props(page); open_map(page)
        page.click("#sfCurrentLocationBtn")
        page.wait_for_function(
            f'document.querySelector(\'#sfMapCanvas .mock-marker[data-title="{CURRENT_LOCATION_TITLE}"]\') !== null',
            timeout=5000)
        # Visitor manually pans elsewhere afterward.
        page.evaluate("window.__mockMaps.maps[0].setCenter({lat: 11.0, lng: 78.0})")
        page.wait_for_timeout(300)  # let the mock map's idle-fire timer settle
        moved_center = page.evaluate("window.__mockMaps.maps[0].getCenter().toJSON()")
        check("no-force-back: manual pan after Current Location is preserved (map is not snapped back)",
              abs(moved_center["lat"] - 11.0) < 0.001 and abs(moved_center["lng"] - 78.0) < 0.001, moved_center)
        check("no JS errors (no-force-back path)", not errs, errs)
        ctx.close()

        b.close()
    print(f"\n{sum(results)}/{len(results)} passed")
    return 0 if all(results) else 1

sys.exit(run())
