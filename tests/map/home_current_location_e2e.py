#!/usr/bin/env python3
"""
HOMEPAGE "FUTURE PROPERTIES" MAP — CURRENT LOCATION + VIEWPORT (local stack)

The homepage map is the same shared component (js/properties-map.js) as
the Properties page map, now with `currentLocation: true` on the home
instance. This file verifies the homepage map gets the SAME Current
Location behaviour through the SAME code path — shared
js/geo-bridge.js with forceRefresh, exact centering, zoom 16, blue dot —
bound to its own hp* elements, plus Roadmap/Hybrid, exact DB marker
coordinates, and the viewport empty-state message.

Note: index.html already asks for location once on page load (existing
behaviour, via the same bridge). These tests use that on purpose: the
page loads at position A (so the bridge caches A), then the device
"moves" to B before the button is ever clicked — the button must show B,
proving it fetches fresh rather than replaying the cached load-time fix.

Env: MAP_DB (default aventrix_map), SITE :8080 / REST :3000 already
running against MAP_DB.
"""
import os, re, sys
sys.argv = [sys.argv[0]]
HERE = os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(HERE, "home_map_e2e.py")).read().split("def run():")[0])

TITLE = "Your current location"
A = (13.0067, 80.2572)   # load-time position (cached by the homepage's existing on-load request)
B = (12.9580, 80.1400)   # where the visitor actually is when they first click (deliberately NOT any property's coordinates)
C = (13.0418, 80.2341)   # where they are on the second click
BTN, STATUS, CANVAS = "#hpCurrentLocationBtn", "#hpCurrentLocationStatus", "#hpMapCanvas"


def geo(ctx, pos):
    ctx.set_geolocation({"latitude": pos[0], "longitude": pos[1], "accuracy": 25})


def center(page):
    return page.evaluate("window.__mockMaps.maps[0].getCenter().toJSON()")


def zoom(page):
    return page.evaluate("window.__mockMaps.maps[0].getZoom()")


def dot_pos(page):
    return page.evaluate(f"""() => {{
        const m = window.__mockMaps.maps[0].markers.find(x => x._title === "{TITLE}" && x.getMap && x.getMap());
        return m ? m.getPosition().toJSON() : null;
    }}""")


def dots(page):
    return page.locator(f'{CANVAS} .mock-marker[data-title="{TITLE}"]').count()


def wait_center(page, pos):
    page.wait_for_function(
        "(p) => { const c = window.__mockMaps.maps[0].getCenter().toJSON(); return c.lat === p[0] && c.lng === p[1]; }",
        arg=list(pos), timeout=6000)


def property_pins(page):
    # Individual property pins only (clusters carry a label; the blue dot has its own title).
    return page.evaluate(f"""() => window.__mockMaps.maps[0].markers
        .filter(m => m.getPosition && !m._label && m._title !== "{TITLE}" && (!m.getMap || m.getMap()))
        .map(m => [m.getPosition().lat(), m.getPosition().lng()])""")


def note(page):
    el = page.locator("#hpMapNote")
    return "" if el.is_hidden() else el.inner_text().strip()


def set_bounds(page, s, w, n, e):
    page.evaluate("""(b) => { const g = window.google.maps;
        window.__mockMaps.maps[0].fitBounds(new g.LatLngBounds({lat: b[0], lng: b[1]}, {lat: b[2], lng: b[3]})); }""", [s, w, n, e])
    page.wait_for_timeout(350)


def rect(bx): return {"left": bx["x"], "right": bx["x"] + bx["width"], "top": bx["y"], "bottom": bx["y"] + bx["height"]}


def run():
    db_coords = set()
    for row in sql("select latitude::text, longitude::text from properties where latitude is not null").splitlines():
        la, ln = row.split("|"); db_coords.add((float(la), float(ln)))

    with sync_playwright() as p:
        b = p.chromium.launch()

        # ================= A. Control exists, Roadmap default, layout, independence =================
        ctx = home_ctx(b, 1280, touch=False); page = ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)[:200]))
        goto_home(page); open_home_map(page)
        check("A: homepage map has the Current Location button", page.locator(BTN).count() == 1 and page.locator(BTN).is_visible())
        check("A: it is the same shared control (same class as the Properties page button)",
              "sf-current-location-btn" in (page.get_attribute(BTN, "class") or ""))
        check("A: homepage has no Properties-page map instance (the two maps are independent)",
              page.evaluate("window.AventrixPropertyMap.snapshot('properties') === null || !window.AventrixPropertyMap.instances.properties")
              and page.locator("#sfCurrentLocationBtn").count() == 0)
        check("A: Roadmap is the default map type", page.evaluate("window.__mockMaps.maps[0].getMapTypeId()") == "roadmap")
        cl = page.locator(BTN).bounding_box()
        check("A: button does not overlap the zoom control", rect_overlap(rect(cl), rect(page.locator(f"{CANVAS} .mock-zoom-controls").bounding_box())) == 0)
        check("A: button does not overlap the Roadmap/Satellite control", rect_overlap(rect(cl), rect(page.locator(f"{CANVAS} .mock-maptype-control").bounding_box())) == 0)
        check("A: no blue dot before the button is used", dots(page) == 0)
        check("no JS errors (A)", not errs, errs)
        ctx.close()

        # ================= B/C/D. Granted: fresh fix, exact center, zoom 16, blue dot, re-click, manual pan =================
        ctx = home_ctx(b, 1280, touch=False)
        ctx.grant_permissions(["geolocation"]); geo(ctx, A)
        writes = []
        ctx.on("request", lambda r: writes.append(r.url) if "/rest/v1" in r.url and r.method != "GET" else None)
        page = ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)[:200]))
        goto_home(page); page.wait_for_timeout(400)   # homepage's existing on-load request caches A
        cached = page.evaluate("sessionStorage.getItem('aventrix_geo_session')") or ""
        check("B: setup — homepage's on-load request already cached position A in this session",
              str(A[0]) in cached and str(A[1]) in cached, cached)
        open_home_map(page)
        mapped_before = hsnap(page)["mapped"]
        pins_before = sorted(property_pins(page))

        geo(ctx, B)                                   # the visitor has moved since the page loaded
        page.click(BTN); wait_center(page, B)
        check("B: click fetches a FRESH position — centers on B, not the cached load-time A", center(page) == {"lat": B[0], "lng": B[1]}, center(page))
        check("B: map centers EXACTLY on the returned latitude/longitude", center(page)["lat"] == B[0] and center(page)["lng"] == B[1])
        check("B: zoom is 16", zoom(page) == 16, zoom(page))
        check("B: blue current-location dot appears", dots(page) == 1)
        check("B: blue dot sits exactly at the returned coordinates", dot_pos(page) == {"lat": B[0], "lng": B[1]}, dot_pos(page))
        check("B: blue dot uses the distinct current-location marker (not a property pin)",
              page.locator(f"{CANVAS} .sf-current-location-dot").count() == 1 or
              page.evaluate(f"window.__mockMaps.maps[0].markers.some(m => m._title === '{TITLE}' && !m._label)"))
        check("B: property markers unchanged — same properties mapped", hsnap(page)["mapped"] == mapped_before)
        check("B: no property is placed at the user's location", (B[0], B[1]) not in set(map(tuple, property_pins(page))))
        check("B: map center is not a property coordinate or the Chennai default",
              (B[0], B[1]) not in db_coords and (center(page)["lat"], center(page)["lng"]) != (13.0827, 80.2707))

        geo(ctx, C)
        page.evaluate("window.__mockMaps.maps[0].setCenter({lat: 12.5, lng: 79.5})")   # visitor is looking elsewhere
        page.wait_for_timeout(150)
        page.click(BTN); wait_center(page, C)
        check("C: second click gets a fresh location and leaves the other area", center(page) == {"lat": C[0], "lng": C[1]}, center(page))
        check("C: blue dot moved to the new position (still exactly one dot)", dots(page) == 1 and dot_pos(page) == {"lat": C[0], "lng": C[1]}, dot_pos(page))
        check("C: zoom is 16 again", zoom(page) == 16, zoom(page))

        page.evaluate("window.__mockMaps.maps[0].setCenter({lat: 12.92, lng: 80.19})")   # manual pan
        page.wait_for_timeout(500)
        c2 = center(page)
        check("D: manual pan after Current Location is not forced back", abs(c2["lat"] - 12.92) < 1e-9 and abs(c2["lng"] - 80.19) < 1e-9, c2)
        check("D: blue dot stays at the user's position while panning away", dot_pos(page) == {"lat": C[0], "lng": C[1]})

        page.wait_for_timeout(200)
        check("B: privacy — nothing written to Supabase", not writes, writes)
        check("B: privacy — location not stored in localStorage",
              not any("geo" in k.lower() for k in page.evaluate("Object.keys(localStorage)")))
        check("no JS errors (B-D)", not errs, errs)
        ctx.close()

        # ================= E. Roadmap/Hybrid + exact DB coordinates (no fake coordinates) =================
        ctx = home_ctx(b, 1280, touch=False)
        ctx.grant_permissions(["geolocation"]); geo(ctx, B)
        page = ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)[:200]))
        goto_home(page); open_home_map(page)
        pins = property_pins(page)
        check("E: every property pin is at a real stored DB latitude/longitude", pins and all(tuple(x) in db_coords for x in pins),
              [x for x in pins if tuple(x) not in db_coords])
        page.locator(f"{CANVAS} .mock-maptype-control").select_option("hybrid"); page.wait_for_timeout(200)
        check("E: Satellite option renders Hybrid (imagery with labels)", page.evaluate("window.__mockMaps.maps[0].getMapTypeId()") == "hybrid")
        check("E: switching to Hybrid does not move any property pin", sorted(property_pins(page)) == sorted(pins))
        page.click(BTN); wait_center(page, B)
        check("E: Current Location works in Hybrid (exact center, zoom 16, dot)",
              center(page) == {"lat": B[0], "lng": B[1]} and zoom(page) == 16 and dots(page) == 1)
        check("E: map type stays Hybrid after Current Location", page.evaluate("window.__mockMaps.maps[0].getMapTypeId()") == "hybrid")
        page.locator(f"{CANVAS} .mock-maptype-control").select_option("roadmap"); page.wait_for_timeout(200)
        check("E: back to Roadmap; blue dot unchanged", page.evaluate("window.__mockMaps.maps[0].getMapTypeId()") == "roadmap" and dot_pos(page) == {"lat": B[0], "lng": B[1]})
        check("no JS errors (E)", not errs, errs)
        ctx.close()

        # ================= F. Viewport-based display + empty-state on the homepage map =================
        ctx = home_ctx(b, 1280, touch=False); page = ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)[:200]))
        goto_home(page); open_home_map(page)
        mapped = hsnap(page)["mapped"]
        coords = {}
        for row in sql(f"select slug, latitude::text, longitude::text from properties where slug in ({','.join(repr(s) for s in mapped)})").splitlines():
            s, la, ln = row.split("|"); coords[s] = (float(la), float(ln))

        def in_view(page):
            return sorted(page.evaluate("""(pts) => { const b = window.__mockMaps.maps[0].getBounds();
                return pts.filter(p => b.contains({lat: p[1], lng: p[2]})).map(p => p[0]); }""",
                [[s, la, ln] for s, (la, ln) in coords.items()]))

        def expected_from_actual_bounds(page):
            # Read the map's ACTUAL visible bounds (fitBounds on a wide map shows
            # more than the requested box) and compute the expected set in
            # Python from the DB coordinates — independent of the page's JS.
            bb = page.evaluate("""() => { const b = window.__mockMaps.maps[0].getBounds();
                const ne = b.getNorthEast(), sw = b.getSouthWest();
                return [sw.lat(), sw.lng(), ne.lat(), ne.lng()]; }""")
            return sorted(s for s, (la, ln) in coords.items() if bb[0] <= la <= bb[2] and bb[1] <= ln <= bb[3])

        box1 = (12.90, 80.10, 13.00, 80.20)
        set_bounds(page, *box1)
        exp1 = expected_from_actual_bounds(page)
        check("F: viewport shows exactly the homepage properties whose stored lat/lng are inside it", exp1 and in_view(page) == exp1, (in_view(page), exp1))
        box2 = (12.94, 80.25, 12.96, 80.27)
        set_bounds(page, *box2)
        exp2 = expected_from_actual_bounds(page)
        check("F: moving to another area changes the in-view set to that area's real coordinates", in_view(page) == exp2 and exp2 != exp1, (in_view(page), exp2))
        set_bounds(page, -5.0, 60.0, -4.9, 60.1)
        check("F: empty viewport keeps the homepage map visible", page.locator("#hpMapWrap").is_visible() and page.locator(CANVAS).is_visible())
        check("F: empty viewport shows 'No properties in this area yet.'", note(page) == "No properties in this area yet.", note(page))
        set_bounds(page, *box1)
        check("F: panning back to a populated area clears the empty-state message", note(page) != "No properties in this area yet.", note(page))
        check("F: dataset untouched by panning", hsnap(page)["mapped"] == mapped)
        check("no JS errors (F)", not errs, errs)
        ctx.close()

        # ================= G. No hardcoded area names in the shared map code / homepage map markup =================
        src = open(os.path.join(HERE, "..", "..", "js", "properties-map.js"), encoding="utf-8").read()
        names = ["Chromepet", "Tambaram", "Velachery", "Perungudi", "Sholinganallur", "Pallavaram", "OMR"]
        check("G: js/properties-map.js has no hardcoded area-name literals", not [n for n in names if re.search(r"['\"]" + n + r"['\"]", src)])
        check("G: js/properties-map.js has no area === \"<name>\" comparisons", re.search(r'area\s*===?\s*["\']', src) is None)
        idx = open(os.path.join(HERE, "..", "..", "index.html"), encoding="utf-8").read()
        hp_block = idx[idx.index('id="hpMapView"'):idx.index('id="hpMapView"') + 2000]
        check("G: homepage map markup contains no hardcoded area labels", not [n for n in names if n in hp_block])

        # ================= H. Denied / unavailable messages on the homepage map =================
        for code, expect, label in [
            (1, "Location access is disabled. Please allow location access to use your current location.", "denied"),
            (2, "Unable to determine your current location. Please try again.", "unavailable")]:
            ctx = home_ctx(b, 1280, touch=False)
            ctx.add_init_script("""(function(code){ Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
                getCurrentPosition: function(ok, err) { setTimeout(function () { err({ code: code, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }); }, 5); } }}); })(%d);""" % code)
            page = ctx.new_page(); errs = []
            page.on("pageerror", lambda e: errs.append(str(e)[:200]))
            goto_home(page); open_home_map(page)
            before = center(page)
            page.click(BTN)
            page.wait_for_selector(f"{STATUS}:not([hidden])", timeout=5000)
            check(f"H: {label} — exact required message", page.locator(STATUS).inner_text().strip() == expect, page.locator(STATUS).inner_text())
            check(f"H: {label} — no blue dot, map not moved to any fallback location", dots(page) == 0 and center(page) == before)
            check(f"no JS errors (H {label})", not errs, errs)
            ctx.close()

        # ================= I. Mobile (iPhone/Android widths, touch) =================
        for w in (390, 375, 430):
            ctx = home_ctx(b, w)
            ctx.grant_permissions(["geolocation"]); geo(ctx, B)
            page = ctx.new_page(); errs = []
            page.on("pageerror", lambda e: errs.append(str(e)[:200]))
            goto_home(page); open_home_map(page)
            page.locator("#hpMapWrap").scroll_into_view_if_needed(); page.wait_for_timeout(300)
            btn = page.locator(BTN); bx = btn.bounding_box()
            wrap = page.locator("#hpMapWrap").bounding_box()
            check(f"I {w}: button visible and inside the map", btn.is_visible() and bx["x"] >= wrap["x"] and bx["x"] + bx["width"] <= wrap["x"] + wrap["width"] + 0.5)
            check(f"I {w}: touch target >= 44x44", bx["width"] >= 44 and bx["height"] >= 44, bx)
            check(f"I {w}: no overlap with zoom or Roadmap/Satellite controls",
                  rect_overlap(rect(bx), rect(page.locator(f"{CANVAS} .mock-zoom-controls").bounding_box())) == 0 and
                  rect_overlap(rect(bx), rect(page.locator(f"{CANVAS} .mock-maptype-control").bounding_box())) == 0)
            btn.tap(); wait_center(page, B)
            check(f"I {w}: tap centers on the live location at zoom 16 with the blue dot", zoom(page) == 16 and dots(page) == 1)
            # Production creates the blue dot with clickable:false (gmpClickable:false),
            # so real Google Maps passes taps through it; the mock ignores that flag,
            # so open a property preview via a direct click on a property pin.
            page.evaluate(f"""() => {{ const el = [...document.querySelectorAll('{CANVAS} .mock-marker[data-kind="pin"]')]
                .find(e => e.dataset.title !== "{TITLE}"); if (el) el.click(); }}""")
            page.wait_for_timeout(500)
            if page.locator("#hpMapPreview").is_visible():
                check(f"I {w}: button steps aside while the property preview is open", btn.is_hidden())
            else:
                check(f"I {w}: (cluster zoom) button still usable", btn.is_visible())
            check(f"no JS errors (I {w})", not errs, errs)
            ctx.close()

        b.close()
    print(f"\n{sum(results)}/{len(results)} passed")
    return 0 if all(results) else 1

sys.exit(run())
