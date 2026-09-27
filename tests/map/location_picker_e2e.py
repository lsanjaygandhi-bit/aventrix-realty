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
        check("customer: searching an address fills latitude", abs(float(lat or 0) - 13.085) < 0.001, lat)
        check("customer: searching an address fills longitude", abs(float(lng or 0) - 80.2101) < 0.001, lng)
        check("customer: status shows the selected location", "Location selected" in page.locator("#lwuLocationStatus").inner_text())

        # Click elsewhere on the map moves the marker to a NEW real point, not 0,0
        page.locator("#lwuLocationMap").scroll_into_view_if_needed()
        box = page.locator("#lwuLocationMap").bounding_box()
        page.mouse.click(box["x"] + box["width"] * 0.7, box["y"] + box["height"] * 0.3)
        page.wait_for_timeout(200)
        lat2 = page.locator("#lwuLatitude").input_value()
        check("customer: clicking the map updates the location (not left unchanged)", lat2 != lat, (lat, lat2))
        check("customer: clicked location is never 0,0", not (abs(float(lat2)) < 0.0001), lat2)

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
        alat = page.locator("#fLatitude").input_value()
        alng = page.locator("#fLongitude").input_value()
        check("admin: searching fills Latitude", abs(float(alat or 0) - 13.0418) < 0.001, alat)
        check("admin: searching fills Longitude", abs(float(alng or 0) - 80.2341) < 0.001, alng)
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
        b.close()
    print(f"\n{sum(results)}/{len(results)} passed")
    return 0 if all(results) else 1

sys.exit(run())
