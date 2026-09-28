#!/usr/bin/env python3
"""
PROPERTY LOCATION PICKER — CUSTOMER (list-with-us.html) + ADMIN
(admin/dashboard.html) — local stack, real Chromium.

Customer side: search an address (mock Geocoder), click the map, verify
the hidden latitude/longitude inputs are filled with real values (never
0,0 or a random default), and that submitting the form sends them
through in the enquiry payload exactly like every other field. Also
checks "Clear selected location" empties them again.

Admin side: open a property, verify no marker before any coordinates
exist, click the map, verify Latitude/Longitude boxes fill in, verify
saving writes them to the database and the Properties-page Map View
then shows that property. Also verifies existing paste-to-fill still
works and that opening an already-mapped property shows its marker.

Stack: Postgres DB (default aventrix_cms) -> PostgREST :3000 -> site :8080.
"""
import json, os, subprocess, sys, time
import jwt
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
SITE, REST, REF = "http://localhost:8080", "http://localhost:3000", "gkrtjeygrqkglsadskcg"
SECRET = "local-test-secret-local-test-secret-32b"
DB = os.environ.get("CMS_DB", "aventrix_cms")
UMD = open("/tmp/sbjs/node_modules/@supabase/supabase-js/dist/umd/supabase.js").read()
QUILL_JS = open("/tmp/quill/node_modules/quill/dist/quill.min.js").read()
QUILL_CSS = open("/tmp/quill/node_modules/quill/dist/quill.snow.css").read()
MOCK = open(os.path.join(HERE, "mock-gmaps.js")).read()
ADMIN = "00000000-0000-0000-0000-00000000000a"
results = []

def check(name, cond, info=""):
    results.append(bool(cond))
    print(("PASS " if cond else "FAIL ") + name + ("" if cond else f"   -> {str(info)[:400]}"), flush=True)

def sql(q):
    return subprocess.run(["psql", "-X", "-tA", "-d", DB, "-c", q], capture_output=True, text=True).stdout.strip()

def session(uid):
    now = int(time.time())
    tok = jwt.encode({"sub": uid, "role": "authenticated", "aud": "authenticated", "exp": now + 7200, "iat": now, "email": "admin@aventrix.test"}, SECRET, algorithm="HS256")
    user = {"id": uid, "aud": "authenticated", "role": "authenticated", "email": "admin@aventrix.test", "user_metadata": {}, "app_metadata": {}}
    return {"access_token": tok, "refresh_token": "r", "token_type": "bearer", "expires_in": 7200, "expires_at": now + 7200, "user": user}

def ctx_for(browser, uid=None, geocode=None):
    ctx = browser.new_context(viewport={"width": 1280, "height": 900})
    if uid:
        ctx.add_init_script(f"try {{ localStorage.setItem('sb-{REF}-auth-token', {json.dumps(json.dumps(session(uid)))}); }} catch (e) {{}}")
    ctx.add_init_script("window.confirm = () => true; window.alert = (m) => { window.__lastAlert = m; };")
    if geocode:
        ctx.add_init_script(f"window.__mockGeocodeResults = {json.dumps(geocode)};")
    cfg = "window.AVENTRIX_MAPS_CONFIG = { apiKey: 'TESTKEY', mapId: '' };"

    def handle(route):
        u = route.request.url
        if "maps.googleapis.com/maps/api/js" in u:
            return route.fulfill(status=200, content_type="application/javascript", body=MOCK)
        if "cdn.jsdelivr.net/npm/@supabase/supabase-js" in u or "supabase-js@2" in u:
            return route.fulfill(status=200, content_type="application/javascript", body=UMD)
        if "quill.min.js" in u: return route.fulfill(status=200, content_type="application/javascript", body=QUILL_JS)
        if "quill.snow" in u: return route.fulfill(status=200, content_type="text/css", body=QUILL_CSS)
        if u.startswith(SITE + "/js/maps-config.js") or u.startswith(SITE + "/admin/../js/maps-config.js"):
            return route.fulfill(status=200, content_type="application/javascript", body=cfg)
        if u.endswith("/js/maps-config.js"):
            return route.fulfill(status=200, content_type="application/javascript", body=cfg)
        if f"{REF}.supabase.co/rest/v1" in u:
            h = {k: v for k, v in route.request.headers.items() if k.lower() in ("authorization", "content-type", "prefer", "accept", "range", "accept-profile", "content-profile", "origin")}
            if h.get("authorization", "").lower().startswith("bearer sb_publishable"): h.pop("authorization")
            return route.fulfill(response=route.fetch(url=REST + u.split("/rest/v1", 1)[1], method=route.request.method, headers=h, post_data=route.request.post_data))
        if f"{REF}.supabase.co/auth/v1/user" in u:
            return route.fulfill(status=200, content_type="application/json", body=json.dumps(session(uid)["user"]) if uid else "{}")
        if f"{REF}.supabase.co/auth" in u: return route.fulfill(status=200, content_type="application/json", body="{}")
        if u.startswith(SITE) or u.startswith("data:"): return route.continue_()
        return route.abort()
    ctx.route("**/*", handle)
    return ctx

def run():
    with sync_playwright() as p:
        b = p.chromium.launch()

        # ================= CUSTOMER: list-with-us.html =================
        ctx = ctx_for(b, geocode={"Anna Nagar, Chennai": {"lat": 13.0850, "lng": 80.2101}})
        page = ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)[:300]))
        page.goto(SITE + "/list-with-us.html", wait_until="load")
        page.wait_for_selector("#lwuLocationMap .mock-map-layer", timeout=10000)

        check("customer: no coordinates before any interaction", page.locator("#lwuLatitude").input_value() == "" and page.locator("#lwuLongitude").input_value() == "")

        page.fill("#lwuLocationSearch", "Anna Nagar, Chennai")
        page.click("#lwuLocationSearchBtn")
        page.wait_for_timeout(400)
        lat = page.locator("#lwuLatitude").input_value()
        lng = page.locator("#lwuLongitude").input_value()
        check("customer: searching an address does NOT set the property coordinates (area only)", lat == "" and lng == "", (lat, lng))
        c = page.evaluate("window.__mockMaps.maps[0].getCenter().toJSON()")
        check("customer: search moves the map to the searched area", abs(c["lat"] - 13.085) < 0.001 and abs(c["lng"] - 80.2101) < 0.001, c)
        check("customer: no pin is dropped by search alone", page.locator("#lwuLocationMap .mock-marker").count() == 0)
        check("customer: status asks for the exact property location", "Now select the exact property location" in page.locator("#lwuLocationStatus").inner_text(),
              page.locator("#lwuLocationStatus").inner_text())

        # The customer clicks the exact spot: that point (not the geocoded one) is captured.
        page.locator("#lwuLocationMap").scroll_into_view_if_needed()
        box = page.locator("#lwuLocationMap").bounding_box()
        page.mouse.click(box["x"] + box["width"] * 0.7, box["y"] + box["height"] * 0.3)
        page.wait_for_timeout(200)
        lat2 = page.locator("#lwuLatitude").input_value()
        lng2 = page.locator("#lwuLongitude").input_value()
        check("customer: clicking the exact spot fills latitude and longitude", lat2 != "" and lng2 != "", (lat2, lng2))
        check("customer: captured point is the clicked spot, not the geocoded area centre",
              not (abs(float(lat2) - 13.085) < 1e-6 and abs(float(lng2) - 80.2101) < 1e-6), (lat2, lng2))
        check("customer: clicked location is never 0,0", not (abs(float(lat2)) < 0.0001), lat2)
        check("customer: status shows the selected location", "Location selected" in page.locator("#lwuLocationStatus").inner_text())

        page.click("#lwuLocationClearBtn")
        page.wait_for_timeout(150)
        check("customer: Clear empties both hidden inputs", page.locator("#lwuLatitude").input_value() == "" and page.locator("#lwuLongitude").input_value() == "")
        check("customer: status hides after clearing", page.locator("#lwuLocationStatus").is_hidden())

        # Re-pick and submit; verify it reaches the enquiry payload
        page.click("#lwuLocationMap")
        page.wait_for_timeout(200)
        latf = page.locator("#lwuLatitude").input_value()
        lngf = page.locator("#lwuLongitude").input_value()
        page.fill('input[name="full-name"]', "Test Owner")
        page.fill('input[name="mobile-number"]', "9876543210")
        page.fill('input[name="whatsapp-number"]', "9876543210")
        page.select_option('select[name="property-type"]', "Residential")
        page.fill('input[name="property-address"]', "12, Test Street, Chennai")
        page.fill('input[name="expected-price"]', "9000000")
        page.select_option('select[name="listing-requirement"]', "Sale")
        sql("delete from enquiries where phone='9876543210'")
        page.click('#propertyForm button[type="submit"]')
        page.wait_for_timeout(1200)
        row = sql("select payload->>'latitude', payload->>'longitude' from enquiries where phone='9876543210' order by created_at desc limit 1")
        check("customer: submitted enquiry payload carries the picked latitude/longitude", row and "|" in row and row.split("|")[0] == latf and row.split("|")[1] == lngf, (row, latf, lngf))
        check("customer: no JS errors", not errs, errs)
        ctx.close()

        # ================= ADMIN: dashboard.html =================
        pid = sql("select id from properties where publish_status='Published' and latitude is null limit 1")
        pid_mapped = sql("select id from properties where publish_status='Published' and latitude is not null limit 1")
        if not pid_mapped:
            # Fixture data may not have any property with coordinates yet
            # (e.g. right after migration-2026-09-26-06 adds the columns,
            # before any admin has used the picker) — seed one so the
            # "opening an already-mapped property" check below is
            # meaningful, without touching any other property's data.
            pid_mapped = sql("select id from properties where publish_status='Published' and id != '" + pid + "' limit 1")
            sql(f"update properties set latitude=13.05, longitude=80.21 where id='{pid_mapped}'")
        ctx = ctx_for(b, uid=ADMIN, geocode={"T Nagar, Chennai": {"lat": 13.0418, "lng": 80.2341}})
        page = ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)[:300]))
        page.goto(SITE + "/admin/dashboard.html", wait_until="load")
        page.wait_for_timeout(2500)
        page.click('#adminNav a[data-section="properties"]')
        page.wait_for_timeout(1500)

        page.evaluate(f"PropertiesModule.openEdit('{pid}')")
        page.wait_for_timeout(1200)
        check("admin: location picker map renders", page.locator("#fLocationMap .mock-map-layer").count() == 1)
        check("admin: no marker yet for a property with no coordinates", page.locator("#fLocationMap .mock-marker").count() == 0)

        page.fill("#fLocationSearch", "T Nagar, Chennai")
        page.click("#fLocationSearchBtn")
        page.wait_for_timeout(400)
        check("admin: search does NOT fill Latitude/Longitude (approximate area only)",
              page.locator("#fLatitude").input_value() == "" and page.locator("#fLongitude").input_value() == "")
        check("admin: search drops no pin", page.locator("#fLocationMap .mock-marker").count() == 0)
        check("admin: status asks for the exact property location", "Now select the exact property location" in page.locator("#fLocationStatus").inner_text())
        # The Admin clicks the exact spot on the map.
        fbox = page.locator("#fLocationMap").bounding_box()
        page.mouse.click(fbox["x"] + fbox["width"] * 0.55, fbox["y"] + fbox["height"] * 0.45)
        page.wait_for_timeout(250)
        alat = page.locator("#fLatitude").input_value()
        alng = page.locator("#fLongitude").input_value()
        check("admin: clicking the exact spot fills Latitude", alat != "" and abs(float(alat) - 13.0418) < 0.05, alat)
        check("admin: clicking the exact spot fills Longitude", alng != "" and abs(float(alng) - 80.2341) < 0.05, alng)
        check("admin: marker now shown on the map", page.locator("#fLocationMap .mock-marker").count() == 1)

        page.click("#savePropertyBtn")
        page.wait_for_timeout(1500)
        saved = sql(f"select latitude, longitude from properties where id='{pid}'")
        try:
            slat, slng = saved.split("|")
            coords_match = abs(float(slat) - float(alat)) < 0.001 and abs(float(slng) - float(alng)) < 0.001
        except Exception:
            coords_match = False
        check("admin: coordinates from the map picker were saved", coords_match, saved)

        # Verify the existing manual paste path still works untouched
        page.evaluate(f"PropertiesModule.openEdit('{pid}')"); page.wait_for_timeout(800)
        page.click("#fLatitude")
        page.evaluate("""() => {
            const dt = new DataTransfer(); dt.setData('text', '12.9416, 80.1984');
            const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
            document.getElementById('fLatitude').dispatchEvent(ev);
        }""")
        page.wait_for_timeout(300)
        check("admin: pasting 'lat, lng' still fills both boxes (unchanged behaviour)",
              page.locator("#fLatitude").input_value() == "12.9416" and page.locator("#fLongitude").input_value() == "80.1984")
        page.locator("#fLongitude").dispatch_event("change")
        page.wait_for_timeout(200)
        check("admin: pasted coordinates also move the picker's marker", page.locator("#fLocationMap .mock-marker").count() == 1)

        # Clear via the picker and verify it clears the boxes + save removes coordinates
        page.click("#fLocationClearBtn")
        page.wait_for_timeout(150)
        check("admin: Clear location empties Latitude/Longitude boxes", page.locator("#fLatitude").input_value() == "" and page.locator("#fLongitude").input_value() == "")
        page.click("#savePropertyBtn")
        page.wait_for_timeout(1200)
        cleared = sql(f"select latitude, longitude from properties where id='{pid}'")
        check("admin: clearing via the picker saves NULL coordinates", cleared == "|", cleared)

        # Opening an already-mapped property shows its existing marker
        page.evaluate(f"PropertiesModule.openEdit('{pid_mapped}')"); page.wait_for_timeout(1200)
        check("admin: opening an already-mapped property shows its marker immediately", page.locator("#fLocationMap .mock-marker").count() == 1)
        page.click("#propertyModalOverlay .admin-modal-close, #cancelPropertyBtn") if page.locator("#cancelPropertyBtn").count() else None

        check("admin: no JS errors", not errs, errs)
        ctx.close()

        # ================= LOCALITY SEARCH (area only) — Velachery / Chromepet / Madipakkam / Tambaram =================
        # These mock answers stand in for Google's geocoder (the sandbox can't reach Google).
        # They are only used to move the map in the test and are never saved anywhere.
        AREAS = {"velachery": [12.9815, 80.2180, [12.965, 80.200, 12.998, 80.236]],
                 "Chromepet": [12.9516, 80.1462, [12.938, 80.130, 12.965, 80.162]],
                 "madipakkam": [12.9623, 80.1986, [12.950, 80.185, 12.975, 80.212]],
                 "Tambaram": [12.9249, 80.1000, [12.905, 80.080, 12.945, 80.120]]}
        table = {k: {"lat": v[0], "lng": v[1], "viewport": v[2]} for k, v in AREAS.items()}
        ctx = ctx_for(b, uid=ADMIN, geocode=table)
        page = ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)[:300]))
        page.goto(SITE + "/admin/dashboard.html", wait_until="load")
        page.wait_for_timeout(2500)
        page.click('#adminNav a[data-section="properties"]'); page.wait_for_timeout(1500)
        page.click("#addPropertyBtn"); page.wait_for_timeout(1200)
        page.wait_for_selector("#fLocationMap .mock-map-layer", timeout=10000)
        pmap = "window.__mockMaps.maps.find(m => m.div && m.div.id === 'fLocationMap')"
        for name, (la, ln, vp) in AREAS.items():
            page.fill("#fLocationSearch", name); page.click("#fLocationSearchBtn"); page.wait_for_timeout(450)
            c = page.evaluate(f"{pmap}.getCenter().toJSON()")
            inside = vp[0] <= c["lat"] <= vp[2] and vp[1] <= c["lng"] <= vp[3]
            check(f"locality '{name}': search succeeds and the map moves to that area", inside and "Area found" in page.locator("#fLocationStatus").inner_text(),
                  (c, page.locator("#fLocationStatus").inner_text()))
            check(f"locality '{name}': search alone sets NO latitude/longitude and drops no pin",
                  page.locator("#fLatitude").input_value() == "" and page.locator("#fLongitude").input_value() == "" and page.locator("#fLocationMap .mock-marker").count() == 0)
        req = page.evaluate("window.__lastGeocodeRequest && { bounds: !!window.__lastGeocodeRequest.bounds, country: window.__lastGeocodeRequest.componentRestrictions && window.__lastGeocodeRequest.componentRestrictions.country }")
        check("search is biased to the area currently on the map (live view bounds, no fixed coordinates) and limited to India", req and req["bounds"] and req["country"] == "IN", req)
        # After searching Tambaram: explicit click sets the exact point, drag updates it.
        page.evaluate("(p) => { const m = " + pmap + "; const g = window.google.maps; g.event.trigger(m, 'click', { latLng: new g.LatLng(p[0], p[1]) }); }", [12.926789, 80.101234])
        page.wait_for_timeout(200)
        check("after search, clicking the exact spot sets exactly that latitude/longitude",
              (page.locator("#fLatitude").input_value(), page.locator("#fLongitude").input_value()) == ("12.926789", "80.101234"))
        page.evaluate("(p) => { const m = " + pmap + "; const g = window.google.maps; const mk = m.markers.find(x => x._title === 'Selected Property Location'); mk.setPosition(new g.LatLng(p[0], p[1])); g.event.trigger(mk, 'dragend'); }", [12.927011, 80.101456])
        page.wait_for_timeout(200)
        check("dragging the pin updates the exact latitude/longitude",
              (page.locator("#fLatitude").input_value(), page.locator("#fLongitude").input_value()) == ("12.927011", "80.101456"))
        page.fill("#fLocationSearch", "velachery"); page.click("#fLocationSearchBtn"); page.wait_for_timeout(450)
        check("searching again keeps the selected exact point (search never moves or replaces the pin)",
              (page.locator("#fLatitude").input_value(), page.locator("#fLongitude").input_value()) == ("12.927011", "80.101456"))
        check("no JS errors (locality search)", not errs, errs)
        ctx.close()

        # ================= Google refuses the search (key not allowed to use Geocoding) =================
        ctx = ctx_for(b, uid=ADMIN, geocode=table)
        ctx.add_init_script("window.__mockGeocodeStatus = 'REQUEST_DENIED';")
        page = ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)[:300]))
        page.goto(SITE + "/admin/dashboard.html", wait_until="load"); page.wait_for_timeout(2500)
        page.click('#adminNav a[data-section="properties"]'); page.wait_for_timeout(1500)
        page.click("#addPropertyBtn"); page.wait_for_timeout(1200)
        page.wait_for_selector("#fLocationMap .mock-map-layer", timeout=10000)
        page.fill("#fLocationSearch", "Velachery"); page.click("#fLocationSearchBtn"); page.wait_for_timeout(450)
        st = page.locator("#fLocationStatus").inner_text()
        check("REQUEST_DENIED is reported as search being unavailable — not as 'couldn't find that location'",
              "declined" in st and "Couldn't find" not in st, st)
        check("REQUEST_DENIED: nothing is filled in, and clicking the map still works",
              page.locator("#fLatitude").input_value() == "")
        fb = page.locator("#fLocationMap").bounding_box(); page.mouse.click(fb["x"] + fb["width"] / 2, fb["y"] + fb["height"] / 2); page.wait_for_timeout(200)
        check("REQUEST_DENIED: a map click still sets the exact location", page.locator("#fLatitude").input_value() != "")
        check("no JS errors (search refused)", not errs, errs)
        ctx.close()
        b.close()
    print(f"\n{sum(results)}/{len(results)} passed")
    return 0 if all(results) else 1

sys.exit(run())
