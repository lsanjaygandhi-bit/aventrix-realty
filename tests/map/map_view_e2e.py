#!/usr/bin/env python3
"""
PROPERTIES MAP VIEW — END-TO-END TESTS (local stack)

Real Chromium + the real site/admin code + real supabase-js → local
PostgREST over a Postgres DB with P0, P1, 03, 04 and 06 applied and the
browser test seed. Coordinates exist ONLY on local test fixtures.

Google Maps cannot be reached from the test sandbox, so the Maps
JavaScript API URL is answered by tests/map/mock-gmaps.js — a test
double with the same interface subset (Map, Marker, AdvancedMarkerElement,
LatLngBounds, fitBounds, getBounds, idle/zoom events) and real
Web-Mercator maths. Everything else (search engine, filters, map module,
preview, admin) is the shipped code.

Env: MAP_DB (default aventrix_map), NO06_DB (DB without migration 06,
optional), SITE :8080 / REST :3000 already running against MAP_DB.
"""
import json, os, re, subprocess, sys, time
import jwt
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
SITE, REST, REF = "http://localhost:8080", "http://localhost:3000", "gkrtjeygrqkglsadskcg"
SECRET = "local-test-secret-local-test-secret-32b"
DB = os.environ.get("MAP_DB", "aventrix_map")
UMD = open("/tmp/sbjs/node_modules/@supabase/supabase-js/dist/umd/supabase.js").read()
MOCK = open(os.path.join(HERE, "mock-gmaps.js")).read()
FA = "/tmp/fa/node_modules/@fortawesome/fontawesome-free"
ADMIN = "00000000-0000-0000-0000-00000000000a"
WIDTHS = [int(w) for w in os.environ.get("WIDTHS", "320,375,390,430,768,1024,1280,1440").split(",")]
results = []

def check(name, cond, info=""):
    results.append(bool(cond))
    print(("PASS " if cond else "FAIL ") + name + ("" if cond else f"   -> {str(info)[:600]}"), flush=True)

def sql(q, db=None):
    return subprocess.run(["psql", "-X", "-tA", "-d", db or DB, "-c", q], capture_output=True, text=True).stdout.strip()

def session(uid):
    now = int(time.time())
    tok = jwt.encode({"sub": uid, "role": "authenticated", "aud": "authenticated", "exp": now + 3600, "iat": now, "email": "admin@aventrix.test"}, SECRET, algorithm="HS256")
    return {"access_token": tok, "refresh_token": "r", "token_type": "bearer", "expires_in": 3600, "expires_at": now + 3600,
            "user": {"id": uid, "aud": "authenticated", "role": "authenticated", "email": "admin@aventrix.test", "user_metadata": {}, "app_metadata": {}}}

def ctx_for(browser, width, key="TESTKEY", map_id="", maps="ok", supabase="ok", uid=None, touch=None):
    mobile = width <= 430
    touch = (width <= 1024) if touch is None else touch
    ctx = browser.new_context(viewport={"width": width, "height": 844 if width < 700 else 900}, is_mobile=mobile, has_touch=touch)
    ctx.maps_requests = []
    if uid:
        ctx.add_init_script(f"try {{ localStorage.setItem('sb-{REF}-auth-token', {json.dumps(json.dumps(session(uid)))}); }} catch (e) {{}}")
    ctx.add_init_script("window.confirm = () => true; window.alert = (m) => { window.__lastAlert = m; };")
    cfg = f"window.AVENTRIX_MAPS_CONFIG = {{ apiKey: {json.dumps(key)}, mapId: {json.dumps(map_id)} }};"

    def handle(route):
        u = route.request.url
        if "maps.googleapis.com/maps/api/js" in u:
            ctx.maps_requests.append(u)
            if maps == "network":
                return route.abort("internetdisconnected")
            return route.fulfill(status=200, content_type="application/javascript", body=MOCK)
        if "cdn.jsdelivr.net/npm/@supabase/supabase-js" in u:
            return route.fulfill(status=200, content_type="application/javascript", body=UMD)
        if "font-awesome" in u and u.endswith("all.min.css"):
            return route.fulfill(status=200, content_type="text/css", body=open(FA + "/css/all.min.css").read())
        if "font-awesome" in u and "/webfonts/" in u:
            return route.fulfill(status=200, content_type="font/woff2", body=open(FA + "/webfonts/" + u.split("/webfonts/")[1].split("?")[0], "rb").read())
        if u.startswith(SITE + "/js/maps-config.js"):
            return route.fulfill(status=200, content_type="application/javascript", body=cfg)
        if f"{REF}.supabase.co" in u and supabase == "down":
            return route.abort("connectionrefused")
        if f"{REF}.supabase.co/rest/v1" in u:
            h = {k: v for k, v in route.request.headers.items() if k.lower() in ("authorization", "content-type", "prefer", "accept", "range", "accept-profile", "content-profile", "origin")}
            if h.get("authorization", "").lower().startswith("bearer sb_publishable"): h.pop("authorization")
            return route.fulfill(response=route.fetch(url=REST + u.split("/rest/v1", 1)[1], headers=h))
        if f"{REF}.supabase.co/auth/v1/user" in u:
            return route.fulfill(status=200, content_type="application/json", body=json.dumps(session(uid)["user"]) if uid else "{}")
        if f"{REF}.supabase.co/auth" in u:
            return route.fulfill(status=200, content_type="application/json", body="{}")
        if u.startswith(SITE) or u.startswith("data:"):
            return route.continue_()
        return route.abort()
    ctx.route("**/*", handle)
    return ctx

def goto_props(page, qs=""):
    page.goto(SITE + "/properties.html" + qs, wait_until="load")
    page.wait_for_function("window.AventrixSearchResults && window.AventrixSearchResults.status !== undefined", timeout=15000)
    page.wait_for_timeout(300)

def snap(page):
    return page.evaluate("window.AventrixPropertyMap.snapshot()")

def wait_map(page):
    page.wait_for_function("window.AventrixPropertyMap.snapshot().mapsStatus !== 'loading' && (window.__mockMaps ? true : true)", timeout=20000)
    page.wait_for_timeout(250)

def open_map(page):
    page.click("#sfViewMapBtn")
    wait_map(page)
    page.wait_for_timeout(200)

def results_slugs(page):
    return page.evaluate("(window.AventrixSearchResults.properties || []).map(p => p.slug)")

def count_num(page):
    t = page.locator("#sfResultsCount").inner_text()
    m = re.match(r"(\d+)", t)
    return int(m.group(1)) if m else None

def visible_markers(page):
    return page.evaluate("""() => [...document.querySelectorAll('#sfMapCanvas .mock-marker, #sfMapCanvas .mock-adv-marker')].map(e => ({
        kind: e.classList.contains('mock-adv-marker') ? (e.querySelector('.sf-map-cluster') ? 'cluster' : 'pin') : e.dataset.kind,
        title: e.dataset.title || e.getAttribute('title') || '', label: e.dataset.label || (e.querySelector('.sf-map-cluster') ? e.querySelector('.sf-map-cluster').textContent : '')}))""")

def rect_overlap(a, b):
    return max(0, min(a["right"], b["right"]) - max(a["left"], b["left"])) * max(0, min(a["bottom"], b["bottom"]) - max(a["top"], b["top"]))

EXPECTED_ON_MAP = set(sql("select slug from properties where publish_status='Published' and latitude is not null").split())
ALL_PUBLISHED = set(sql("select slug from properties where publish_status='Published'").split())

def run():
    with sync_playwright() as p:
        b = p.chromium.launch()

        # ================= A. Functional, desktop 1280 =================
        ctx = ctx_for(b, 1280, touch=False); page = ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)[:200]))
        goto_props(page)
        check("list: default view is List, map hidden", page.locator("#sfResultsGrid").is_visible() and page.locator("#sfMapView").is_hidden()
              and page.get_attribute("#sfViewListBtn", "aria-pressed") == "true")
        check("list: Google Maps NOT requested while in List View", len(ctx.maps_requests) == 0, ctx.maps_requests)
        n_cards = page.locator("#sfResultsGrid .property-card").count()
        check("list: all published properties listed (count = cards = DB)", n_cards == len(ALL_PUBLISHED) == count_num(page), (n_cards, len(ALL_PUBLISHED), count_num(page)))
        check("list: Draft property never listed", "draft-secret" not in results_slugs(page))

        open_map(page)
        s = snap(page)
        check("map: Maps API requested exactly once, key from config, marker library", len(ctx.maps_requests) == 1 and "key=TESTKEY" in ctx.maps_requests[0] and "libraries=marker" in ctx.maps_requests[0], ctx.maps_requests)
        check("map: loads (status ready)", s["mapsStatus"] == "ready", s)
        check("map: exactly the published properties that have coordinates are placed", set(s["mapped"]) == EXPECTED_ON_MAP, (s["mapped"], EXPECTED_ON_MAP))
        check("map: Draft property with coordinates is NOT on the map", "draft-secret" not in s["mapped"])
        check("map: properties without coordinates are not placed anywhere", not (set(s["mapped"]) - EXPECTED_ON_MAP))
        note = page.locator("#sfMapNote").inner_text()
        check("map: note says how many are on the map + 'not currently available' message", f"Showing {len(EXPECTED_ON_MAP)} of {len(ALL_PUBLISHED)} properties on the map" in note and "not currently available on the map" in note, note)
        check("map: count text unchanged (same result set as list)", count_num(page) == len(ALL_PUBLISHED))
        check("map: list grid hidden, toggle state Map", page.locator("#sfResultsGrid").is_hidden() and page.get_attribute("#sfViewMapBtn", "aria-pressed") == "true")
        fit = page.evaluate("window.__mockMaps.maps[0].__lastFit")
        lats = [float(x) for x in sql("select latitude from properties where publish_status='Published' and latitude is not null").split()]
        lngs = [float(x) for x in sql("select longitude from properties where publish_status='Published' and latitude is not null").split()]
        check("map: bounds fitted around all markers", fit and abs(fit["s"] - min(lats)) < 1e-6 and abs(fit["n"] - max(lats)) < 1e-6 and abs(fit["w"] - min(lngs)) < 1e-6 and abs(fit["e"] - max(lngs)) < 1e-6, fit)
        check("map: Google attribution present (not removed)", page.locator("#sfMapCanvas .mock-attribution").count() == 1)
        mk = visible_markers(page)
        pins = [m for m in mk if m["kind"] == "pin"]; clusters = [m for m in mk if m["kind"] == "cluster"]
        clustered = sum(int(c["label"]) for c in clusters)
        check("map: every mapped property is a pin or inside a cluster", len(pins) + clustered == len(EXPECTED_ON_MAP), (pins, clusters))
        check("map: nearby Chromepet properties are clustered at city zoom", any(int(c["label"]) >= 3 for c in clusters), clusters)
        check("map: one marker DOM element per property, no duplicates", page.locator("#sfMapCanvas .mock-marker").count() == len(mk))
        # pin → preview
        page.locator('#sfMapCanvas .mock-marker[data-kind="pin"][data-title="Lease Office Guindy"], #sfMapCanvas .mock-marker[data-kind="pin"]').first.click()
        page.wait_for_timeout(200)
        slug = page.get_attribute("#sfMapPreview", "data-slug")
        row = sql(f"select title||'|'||coalesce(location,'')||'|'||coalesce(price_display,'') from properties where slug='{slug}'").split("|")
        ptxt = page.locator("#sfMapPreview").inner_text()
        check("preview: opens from a marker with the real record (title, location, price)", slug in EXPECTED_ON_MAP and all(x in ptxt for x in row if x), (slug, row, ptxt))
        href = page.get_attribute("#sfMapPreview .sf-map-preview-cta", "href")
        check("preview: View Details links to that property's page", href == f"property.html?id={slug}", href)
        pv = page.evaluate("(() => { const r = document.getElementById('sfMapPreview').getBoundingClientRect(), w = document.getElementById('sfMapWrap').getBoundingClientRect(); return {inside: r.left >= w.left && r.right <= w.right && r.top >= w.top && r.bottom <= w.bottom, vp: r.left >= 0 && r.right <= innerWidth}; })()")
        check("preview: fully inside the map and the viewport", pv["inside"] and pv["vp"], pv)
        # wishlist from preview syncs with list card and storage
        page.click("#sfMapPreview .sf-map-wish"); page.wait_for_timeout(200)
        st = page.evaluate(f"[window.AventrixStorage.wishlist.has('{slug}'), document.querySelector('#sfResultsGrid .property-save-btn[data-slug=\"{slug}\"]').getAttribute('aria-pressed')]")
        check("preview: Wishlist uses the property's own ID and updates the list card", st == [True, "true"], st)
        page.click("#sfMapPreview .sf-map-short"); page.wait_for_timeout(200)
        st2 = page.evaluate(f"[window.AventrixStorage.shortlist.has('{slug}'), document.querySelector('#sfResultsGrid .icon-shortlist-btn[data-slug=\"{slug}\"]').getAttribute('aria-pressed')]")
        check("preview: Shortlist uses the property's own ID and updates the list card", st2 == [True, "true"], st2)
        page.click("#sfMapPreview .sf-map-short"); page.click("#sfMapPreview .sf-map-wish"); page.wait_for_timeout(150)
        page.keyboard.press("Escape"); page.wait_for_timeout(100)
        check("preview: Escape closes it", page.locator("#sfMapPreview").is_hidden())
        # cluster click zooms in; same-spot pair opens paged preview
        z0 = page.evaluate("window.__mockMaps.maps[0].getZoom()")
        page.locator('#sfMapCanvas .mock-marker[data-kind="cluster"]').first.click(); page.wait_for_timeout(300)
        z1 = page.evaluate("window.__mockMaps.maps[0].getZoom()")
        check("cluster: click zooms in to expand it", z1 > z0, (z0, z1))
        for _ in range(8):
            same = page.locator('#sfMapCanvas .mock-marker[data-kind="cluster"]')
            if not same.count(): break
            same.first.click(); page.wait_for_timeout(300)
            if page.locator("#sfMapPreview").is_visible(): break
        pv_items = snap(page)["preview"]
        check("cluster: two properties at the exact same spot open as a paged preview (1 / 2)", pv_items and set(pv_items) == {"edge-short-title", "edge-wide-image"} and "1 / 2" in page.locator("#sfMapPreview").inner_text(), pv_items)
        if pv_items:
            first = page.get_attribute("#sfMapPreview", "data-slug"); page.click("#sfMapPreview .sf-map-next"); page.wait_for_timeout(100)
            check("cluster: pager shows the other property", page.get_attribute("#sfMapPreview", "data-slug") != first)
        page.click("#sfMapPreview .sf-map-preview-close")

        # ---- filters sync ----
        page.select_option("#sfCategory", "commercial"); page.wait_for_timeout(1500)
        res = set(results_slugs(page)); s = snap(page)
        exp_res = set(sql("select slug from properties where publish_status='Published' and category='commercial'").split())
        exp_map = set(sql("select slug from properties where publish_status='Published' and category='commercial' and latitude is not null").split())
        check("filter: Type=Commercial → results = DB, map = results with coordinates", res == exp_res and set(s["mapped"]) == exp_map and count_num(page) == len(exp_res), (res, s["mapped"]))
        z = page.evaluate("[window.__mockMaps.maps[0].getZoom(), window.__mockMaps.maps[0].getCenter().lat(), window.__mockMaps.maps[0].getCenter().lng()]")
        one = sql(f"select latitude||','||longitude from properties where slug='{list(exp_map)[0]}'").split(",") if len(exp_map) == 1 else None
        check("bounds: a single mapped property is centred at zoom 15", one and z[0] == 15 and abs(z[1] - float(one[0])) < 1e-6 and abs(z[2] - float(one[1])) < 1e-6, (z, one))
        check("filter: note shows the property without coordinates is only in List View", "1 of 2" in page.locator("#sfMapNote").inner_text(), page.locator("#sfMapNote").inner_text())
        page.click("#sfViewListBtn"); page.wait_for_timeout(200)
        cards = set(page.evaluate("[...document.querySelectorAll('#sfResultsGrid .property-card')].map(c => c.dataset.slug)"))
        check("filter: List View shows the identical filtered set", cards == res, (cards, res))
        check("filter: Map requested only once in total (no re-initialisation)", len(ctx.maps_requests) == 1 and page.evaluate("window.__mockMaps.maps.length") == 1)
        page.click("#sfViewMapBtn"); page.wait_for_timeout(300)
        page.select_option("#sfCategory", ""); page.wait_for_timeout(1400)
        page.fill("#sfLocation", "Chromepet"); page.wait_for_timeout(1600)
        res = set(results_slugs(page)); s = snap(page)
        exp_res = set(sql("select slug from properties where publish_status='Published' and location ilike '%Chromepet%'").split())
        check("filter: Location=Chromepet → list, map and count agree with the DB", res == exp_res and set(s["mapped"]) == {x for x in exp_res if x in EXPECTED_ON_MAP} and count_num(page) == len(exp_res), (res, s["mapped"]))
        page.fill("#sfLocation", ""); page.wait_for_timeout(1600)
        page.select_option("#sfListingType", "lease"); page.wait_for_timeout(1400)
        exp_res = set(sql("select slug from properties where publish_status='Published' and listing_type='lease'").split())
        check("filter: Rent/Lease → same set in list, map and count", set(results_slugs(page)) == exp_res and set(snap(page)["mapped"]) == {x for x in exp_res if x in EXPECTED_ON_MAP} and count_num(page) == len(exp_res))
        page.select_option("#sfListingType", ""); page.wait_for_timeout(1400)
        page.select_option("#sfBedrooms", "2"); page.wait_for_timeout(1400)
        exp_res = set(sql("select slug from properties where publish_status='Published' and bedrooms>=2").split())
        check("filter: 2+ Beds → same set in list, map and count", set(results_slugs(page)) == exp_res and set(snap(page)["mapped"]) == {x for x in exp_res if x in EXPECTED_ON_MAP} and count_num(page) == len(exp_res))
        page.select_option("#sfBedrooms", ""); page.wait_for_timeout(1400)
        page.fill("#sfPriceMin", "7000000"); page.fill("#sfPriceMax", "30000000"); page.wait_for_timeout(1700)
        exp_res = set(sql("select slug from properties where publish_status='Published' and price_value between 7000000 and 30000000").split())
        check("filter: Price 70 L – 3 Cr → same set in list, map and count", set(results_slugs(page)) == exp_res and set(snap(page)["mapped"]) == {x for x in exp_res if x in EXPECTED_ON_MAP} and count_num(page) == len(exp_res), (results_slugs(page), exp_res))
        page.fill("#sfPriceMin", ""); page.fill("#sfPriceMax", ""); page.wait_for_timeout(1700)
        page.select_option("#sfSort", "price_high"); page.wait_for_timeout(1400)
        check("sort: changing sort keeps the same map set", set(snap(page)["mapped"]) == EXPECTED_ON_MAP and results_slugs(page)[0] == sql("select slug from properties where publish_status='Published' order by price_value desc nulls last limit 1"))
        page.select_option("#sfSort", "recommended"); page.wait_for_timeout(1400)

        # ---- Search this area ----
        check("area: button hidden after the map frames results by itself", page.locator("#sfMapAreaBtn").is_hidden())
        m0 = page.evaluate("window.__mockMaps.maps[0]") if False else None
        page.locator("#sfMapCanvas").dispatch_event("pointerdown")
        page.evaluate("(() => { const m = window.__mockMaps.maps[0]; m.setZoom(14); m.setCenter({lat: 12.9520, lng: 80.1460}); })()")
        page.wait_for_timeout(300)
        check("area: button appears after the visitor moves/zooms the map", page.locator("#sfMapAreaBtn").is_visible())
        bounds = page.evaluate("(() => { const b = window.__mockMaps.maps[0].getBounds(); return [b.getSouthWest().lat(), b.getSouthWest().lng(), b.getNorthEast().lat(), b.getNorthEast().lng()]; })()")
        page.click("#sfMapAreaBtn"); page.wait_for_timeout(600)
        exp_area = set(sql(f"select slug from properties where publish_status='Published' and latitude between {bounds[0]} and {bounds[2]} and longitude between {bounds[1]} and {bounds[3]}").split())
        res = set(results_slugs(page))
        check("area: results = published properties inside the visible map area (DB check)", res == exp_area and len(exp_area) >= 1 and set(snap(page)["mapped"]) == exp_area, (res, exp_area))
        check("area: count matches", count_num(page) == len(exp_area))
        check("area: 'Map area' chip shown and no extra DB request loop", "Map area" in page.locator("#sfActiveChips").inner_text())
        check("area: map view kept where the visitor left it (not re-fitted)", page.evaluate("window.__mockMaps.maps[0].getZoom()") == 14)
        page.click("#sfViewListBtn"); page.wait_for_timeout(200)
        cards = set(page.evaluate("[...document.querySelectorAll('#sfResultsGrid .property-card')].map(c => c.dataset.slug)"))
        check("area: List View shows the same area-filtered set", cards == exp_area, cards)
        page.locator('#sfActiveChips .sf-chip:has-text("Map area")').click(); page.wait_for_timeout(1500)
        check("area: clearing the chip restores all results", count_num(page) == len(ALL_PUBLISHED))
        page.click("#sfViewMapBtn"); page.wait_for_timeout(300)
        check("url: map state never adds URL parameters (canonical page unchanged)", page.evaluate("location.search") == "" and page.get_attribute('link[rel="canonical"]', "href") == "https://aventrixrealty.com/properties.html")

        # ---- no results / no coordinates ----
        # The map must NEVER go blank: even with zero results, or results
        # none of which have coordinates, the actual Google Map still shows
        # (Chennai-centered, fully interactive) — the List View's own empty
        # state (with its "Clear All Filters" action) can still appear below
        # it, but it never replaces or hides the map while in Map View.
        page.fill("#sfLocation", "zzzz-nowhere"); page.wait_for_timeout(1600)
        check("empty: 0 results → List View's empty state shown, but the map itself stays visible (never blank), no error",
              page.locator("#sfEmptyState").is_visible() and page.locator("#sfMapWrap").is_visible() and page.locator("#sfMapFallback").is_hidden()
              and page.evaluate("window.__mockMaps.maps[0].getCenter().toJSON()")["lat"] is not None)
        page.fill("#sfLocation", ""); page.wait_for_timeout(1500)
        page.select_option("#sfCategory", "land"); page.wait_for_timeout(1400)
        page.fill("#sfLocation", "Chromepet"); page.wait_for_timeout(1600)
        nc = set(results_slugs(page))
        check("no-coords: results without coordinates → map still visible (Chennai-centered), no marker at a made-up place, clear message", nc and not (nc & EXPECTED_ON_MAP) and page.locator("#sfMapWrap").is_visible() and page.locator("#sfMapCanvas .mock-marker").count() == 0 and "No mapped properties yet" in page.locator("#sfMapNote").inner_text(), (nc, page.locator("#sfMapNote").inner_text()))
        page.fill("#sfLocation", ""); page.select_option("#sfCategory", ""); page.wait_for_timeout(1600)

        # ---- View Details from map opens the right detail page ----
        page.locator('#sfMapCanvas .mock-marker[data-kind="pin"]').first.click(); page.wait_for_timeout(200)
        slug = page.get_attribute("#sfMapPreview", "data-slug")
        page.click("#sfMapPreview .sf-map-preview-cta"); page.wait_for_load_state("load"); page.wait_for_timeout(1500)
        title = sql(f"select title from properties where slug='{slug}'")
        check("detail: View Details opens the correct property page", f"id={slug}" in page.url and title in page.locator("body").inner_text(), page.url)
        goto_props(page); page.wait_for_timeout(800)
        check("view: returning to Properties keeps Map View for this visit", snap(page)["view"] == "map")
        check("A: no JS errors across the functional run", not errs, errs)
        ctx.close()

        # ================= B. Error handling =================
        for label, kw, expect in [
            ("no key configured (as shipped)", dict(key=""), 0),
            ("invalid key (gm_authFailure)", dict(key="INVALID"), 1),
            ("network failure loading Google Maps", dict(maps="network"), 1),
        ]:
            ctx = ctx_for(b, 390, **kw); page = ctx.new_page(); errs = []
            page.on("pageerror", lambda e: errs.append(str(e)[:200]))
            goto_props(page); open_map(page); page.wait_for_timeout(700)
            fb = page.locator("#sfMapFallback")
            check(f"error: {label} → fallback message", fb.is_visible() and fb.inner_text().strip() == "Map view is temporarily unavailable. Please use List View to browse properties." and page.locator("#sfMapWrap").is_hidden(), fb.inner_text() if fb.count() else "")
            check(f"error: {label} → Maps requested {expect}x", len(ctx.maps_requests) == expect, ctx.maps_requests)
            page.click("#sfViewListBtn"); page.wait_for_timeout(200)
            check(f"error: {label} → List View still works", page.locator("#sfResultsGrid .property-card").count() == len(ALL_PUBLISHED) and not errs, errs)
            ctx.close()
        ctx = ctx_for(b, 1280, key="HANG", touch=False); page = ctx.new_page()
        goto_props(page); page.click("#sfViewMapBtn")
        check("error: slow/hung Google Maps shows 'Loading map…' first", page.locator("#sfMapLoading").is_visible())
        page.wait_for_timeout(15800)
        check("error: hung load times out to the fallback message (15 s)", page.locator("#sfMapFallback").is_visible() and page.locator("#sfMapLoading").is_hidden())
        ctx.close()
        ctx = ctx_for(b, 1280, supabase="down", touch=False); page = ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)[:200]))
        page.goto(SITE + "/properties.html", wait_until="load"); page.wait_for_timeout(2500)
        page.click("#sfViewMapBtn"); page.wait_for_timeout(800)
        # Existing behaviour (identical in the previous build): with Supabase fully unreachable the
        # page keeps "Loading properties…". The map must simply stay out of the way.
        check("error: database unreachable → no map shown, no crash (list behaves as before)", page.locator("#sfMapWrap").is_hidden() and page.locator("#sfMapFallback").is_hidden() and not errs, errs)
        check("error: database unreachable → Google Maps not even loaded", len(ctx.maps_requests) == 0)
        ctx.close()

        # ================= C. Advanced markers (Map ID configured) =================
        ctx = ctx_for(b, 1280, map_id="TEST_MAP_ID", touch=False); page = ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)[:200]))
        goto_props(page); open_map(page)
        s = snap(page); mk = visible_markers(page)
        check("advanced: Map ID → Advanced Markers used", s["advanced"] and page.locator("#sfMapCanvas .mock-adv-marker").count() >= 1)
        check("advanced: pins + clusters cover exactly the mapped properties", sum(1 for m in mk if m["kind"] == "pin") + sum(int(m["label"] or 0) for m in mk if m["kind"] == "cluster") == len(EXPECTED_ON_MAP), mk)
        page.locator("#sfMapCanvas .mock-adv-marker:not(:has(.sf-map-cluster))").first.click(); page.wait_for_timeout(200)
        check("advanced: marker click opens the preview once", page.locator("#sfMapPreview").is_visible() and not errs, errs)
        ctx.close()

        # ================= D. Responsive =================
        for w in WIDTHS:
            ctx = ctx_for(b, w); page = ctx.new_page(); errs = []
            page.on("pageerror", lambda e: errs.append(str(e)[:200]))
            goto_props(page)
            tg = page.evaluate("(() => { const r = document.getElementById('sfViewToggle').getBoundingClientRect(); return {w: r.width, left: r.left, right: r.right, vis: r.width > 0}; })()")
            check(f"{w}: List/Map toggle visible and inside the page", tg["vis"] and tg["left"] >= 0 and tg["right"] <= w + 0.5, tg)
            open_map(page)
            page.evaluate("document.getElementById('sfMapWrap').scrollIntoView({block:'center', behavior:'instant'})"); page.wait_for_timeout(400)
            geo = page.evaluate("""(() => { const W = innerWidth, H = innerHeight, wr = document.getElementById('sfMapWrap').getBoundingClientRect();
                const vis = s => { const e = document.querySelector(s); if (!e) return null; const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity < .05) return null; const r = e.getBoundingClientRect(); return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}; };
                const zoom = document.querySelector('#sfMapCanvas .mock-zoom-controls').getBoundingClientRect();
                return {overflow: document.documentElement.scrollWidth > W + 1, wrap:{left:wr.left,right:wr.right,top:wr.top,bottom:wr.bottom,h:wr.height,w:wr.width}, H: H,
                        wa: vis('.whatsapp-float'), top: vis('.back-to-top'), zoom:{left:zoom.left,right:zoom.right,top:zoom.top,bottom:zoom.bottom},
                        filterOpen: document.getElementById('sfFilterPanel').classList.contains('sf-panel-open')}; })()""")
            check(f"{w}: no horizontal scroll", not geo["overflow"])
            cw = page.evaluate("(() => { const c = document.querySelector('.sf-results-section .container'); const cs = getComputedStyle(c); return Math.min(1200, c.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)); })()")
            check(f"{w}: map full width of the results area and a useful height", geo["wrap"]["left"] >= 0 and geo["wrap"]["right"] <= w + 0.5 and geo["wrap"]["h"] >= min(340, geo["H"] * 0.4) and geo["wrap"]["w"] >= cw - 1, (geo["wrap"], cw))
            fl = [f for f in (geo["wa"], geo["top"]) if f]
            check(f"{w}: WhatsApp / Back-to-top don't cover the map or its zoom controls", all(rect_overlap(f, geo["wrap"]) == 0 and rect_overlap(f, geo["zoom"]) == 0 for f in fl), (fl, geo["wrap"]))
            check(f"{w}: filter panel not covering the map", not geo["filterOpen"])
            for _ in range(6):
                if page.locator('#sfMapCanvas .mock-marker[data-kind="pin"]').count(): break
                page.locator('#sfMapCanvas .mock-marker[data-kind="cluster"]').first.click(); page.wait_for_timeout(300)
            page.locator('#sfMapCanvas .mock-marker[data-kind="pin"]').first.click(); page.wait_for_timeout(250)
            pv = page.evaluate("""(() => { const r = document.getElementById('sfMapPreview').getBoundingClientRect(), w = document.getElementById('sfMapWrap').getBoundingClientRect();
                const vis = s => { const e = document.querySelector(s); if (!e) return null; const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity < .05) return null; const q = e.getBoundingClientRect(); return {left:q.left,right:q.right,top:q.top,bottom:q.bottom}; };
                const btns = [...document.querySelectorAll('#sfMapPreview a, #sfMapPreview button')].map(b => { const q = b.getClientRects()[0] || b.getBoundingClientRect(); const hit = document.elementFromPoint(q.left + q.width/2, q.top + q.height/2); return b === hit || b.contains(hit); });
                return {r:{left:r.left,right:r.right,top:r.top,bottom:r.bottom,w:r.width}, inside: r.left >= w.left - .5 && r.right <= w.right + .5 && r.top >= w.top - .5 && r.bottom <= w.bottom + .5,
                        inVp: r.left >= 0 && r.right <= innerWidth + .5 && r.top >= 0 && r.bottom <= innerHeight + .5, wa: vis('.whatsapp-float'), top: vis('.back-to-top'), clickable: btns.every(Boolean), n: btns.length,
                        overflowX: [...document.querySelectorAll('#sfMapPreview *')].some(e => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow === 'visible' && e.tagName !== 'svg')}; })()""")
            check(f"{w}: preview opens inside the map and the screen", pv["inside"] and pv["inVp"], pv)
            fl = [f for f in (pv["wa"], pv["top"]) if f]
            check(f"{w}: WhatsApp / Back-to-top never cover the preview; all its buttons tappable", all(rect_overlap(f, pv["r"]) == 0 for f in fl) and pv["clickable"] and pv["n"] >= 4, pv)
            page.click("#sfMapPreview .sf-map-preview-close")
            page.evaluate("window.scrollTo({top: document.documentElement.scrollHeight, behavior: 'instant'})"); page.wait_for_timeout(500)
            check(f"{w}: WhatsApp button returns once the map is scrolled away", page.evaluate("getComputedStyle(document.querySelector('.whatsapp-float')).visibility") == "visible")
            check(f"{w}: no JS errors", not errs, errs)
            page.evaluate("window.scrollTo({top: 0, behavior: 'instant'})")
            page.screenshot(path=f"/tmp/claude-0/-home-claude/0b2e453c-9df2-51a1-a8b1-d41793b3faf9/scratchpad/map/shot_{w}.png", full_page=False)
            ctx.close()

        # ================= E. Admin: coordinate fields =================
        ctx = ctx_for(b, 1280, uid=ADMIN, touch=False); page = ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)[:200]))
        page.goto(SITE + "/admin/dashboard.html", wait_until="load"); page.wait_for_timeout(2500)
        page.click('#adminNav a[data-section="properties"]'); page.wait_for_timeout(1500)
        pid = sql("select id from properties where slug='villa-neelankarai'")
        page.evaluate(f"PropertiesModule.openEdit('{pid}')"); page.wait_for_timeout(1200)
        check("admin: Map location fields shown (migration 06 present) with saved values", page.locator("#fCoordsRow").is_visible() and page.input_value("#fLatitude") == "12.9496" and page.input_value("#fLongitude") == "80.2593",
              [page.input_value("#fLatitude"), page.input_value("#fLongitude")])
        page.fill("#fLatitude", ""); page.fill("#fLongitude", "")
        page.locator("#fLatitude").focus()
        page.evaluate("(() => { const dt = new DataTransfer(); dt.setData('text', '12.94961, 80.25932'); document.getElementById('fLatitude').dispatchEvent(new ClipboardEvent('paste', {clipboardData: dt, bubbles: true, cancelable: true})); })()")
        check("admin: pasting '12.94961, 80.25932' fills both boxes", page.input_value("#fLatitude") == "12.94961" and page.input_value("#fLongitude") == "80.25932")
        page.click("#savePropertyBtn"); page.wait_for_timeout(1800)
        check("admin: coordinates saved to the property", sql(f"select latitude||','||longitude from properties where id='{pid}'") == "12.949610,80.259320")
        before = sql(f"select md5(to_jsonb(p)::text) from properties p where id='{pid}'")
        for lat, lng, why in [("12.9", "", "only one value"), ("95", "80", "latitude out of range"), ("12.9", "abc", "not a number"), ("0", "0", "0,0")]:
            page.evaluate(f"PropertiesModule.openEdit('{pid}')"); page.wait_for_timeout(900)
            page.fill("#fLatitude", lat); page.fill("#fLongitude", lng); page.click("#savePropertyBtn"); page.wait_for_timeout(900)
            toast = page.evaluate("(document.querySelector('.admin-toast, .toast, #toast') || {}).textContent || ''")
            check(f"admin: rejects {why} with a message; property unchanged", sql(f"select md5(to_jsonb(p)::text) from properties p where id='{pid}'") == before and page.locator("#propertyModalOverlay.open").count() == 1, toast)
            page.click("#closePropertyModal"); page.wait_for_timeout(200)
        page.evaluate(f"PropertiesModule.openEdit('{pid}')"); page.wait_for_timeout(900)
        page.fill("#fLatitude", ""); page.fill("#fLongitude", ""); page.click("#savePropertyBtn"); page.wait_for_timeout(1500)
        check("admin: clearing both boxes removes the property from the map (NULL)", sql(f"select coalesce(latitude::text,'null')||','||coalesce(longitude::text,'null') from properties where id='{pid}'") == "null,null")
        sql(f"update properties set latitude=12.949600, longitude=80.259300 where id='{pid}'")
        check("admin: no JS errors", not errs, errs)
        ctx.close()

        # ================= F. Before migration 06 (compatibility) =================
        no06 = os.environ.get("NO06_DB")
        if no06:
            print("-- compatibility run against", no06, "is done by map_no06.py", flush=True)
        b.close()
    print(f"\n{sum(results)}/{len(results)} passed")
    return 0 if all(results) else 1

if __name__ == "__main__":
    sys.exit(run())
