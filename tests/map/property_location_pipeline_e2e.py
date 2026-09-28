#!/usr/bin/env python3
"""
PROPERTY LOCATION DATA PIPELINE — Admin / List With Us → properties → Map View
(local stack, local test database only)

The business requirement: the Map View shows each property at the exact point
someone selected on a map. This follows the real data end to end:

  Admin Edit → Map Location (click / drag) → Save → properties.latitude/longitude
  → Properties page Map View marker at exactly that point.

  List With Us (customer clicks the exact spot) → enquiries.payload.

Also checks: address search never sets the coordinates, invalid coordinates
are rejected (UI and database), editing preserves coordinates, and two nearby
Chromepet properties cluster, then separate when zoomed in.

Exact points are placed the way a real click does it — a map "click" event
carrying a LatLng — so the test can assert exact values end to end.
Every fixture this test touches is restored at the end (finally block).

Env: MAP_DB (default aventrix_map), SITE :8080 / REST :3000 already running
against MAP_DB.
"""
import os, re, sys, time
sys.argv = [sys.argv[0]]
HERE = os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(HERE, "map_view_e2e.py")).read().split("EXPECTED_ON_MAP =")[0])

# Exact points "selected on the map" in this test (Chromepet A/B, Velachery V, List With Us L).
A  = (12.955432, 80.139876)   # Chromepet — first property
B  = (12.956210, 80.141345)   # Chromepet — second property, ~180 m from A
B2 = (12.956480, 80.141345)   # B moved ~30 m north by dragging the pin
V  = (12.978901, 80.218765)   # Velachery
L  = (12.962345, 80.151234)   # List With Us customer's exact spot
SEARCH = {"Chromepet, Chennai": {"lat": 12.9516, "lng": 80.1462}}   # geocoder "area centre" — must never be saved

FIXTURES = ["edge-no-description", "edge-rental", "draft-secret", "edge-short-title", "lease-office-guindy"]


def db_coords(slug):
    row = sql(f"select coalesce(latitude::text,''), coalesce(longitude::text,'') from properties where slug='{slug}'")
    la, ln = row.split("|")
    return (float(la), float(ln)) if la and ln else None


def pid(slug):
    return sql(f"select id from properties where slug='{slug}'")


def admin_ctx(b):
    ctx = ctx_for(b, 1280, uid=ADMIN, touch=False)
    ctx.add_init_script(f"window.__mockGeocodeResults = {json.dumps(SEARCH)};")
    return ctx


def open_admin(page):
    page.goto(SITE + "/admin/dashboard.html", wait_until="load")
    page.wait_for_function("window.PropertiesModule && document.querySelector('#adminNav a[data-section=\"properties\"]')", timeout=15000)
    page.wait_for_timeout(1500)
    page.click('#adminNav a[data-section="properties"]')
    page.wait_for_timeout(1200)


def picker_map_js():
    return "window.__mockMaps.maps.find(m => m.div && m.div.id === 'fLocationMap')"


def wait_picker(page):
    page.wait_for_function(f"!!({picker_map_js()})", timeout=15000)
    page.wait_for_timeout(250)


def click_exact(page, pt, map_js=None):
    """A user click on the map at exactly this point (same event Google Maps fires)."""
    page.evaluate(f"""(p) => {{ const m = {map_js or picker_map_js()}; const g = window.google.maps;
        g.event.trigger(m, "click", {{ latLng: new g.LatLng(p[0], p[1]) }}); }}""", list(pt))
    page.wait_for_timeout(200)


def drag_pin_to(page, pt):
    page.evaluate(f"""(p) => {{ const m = {picker_map_js()}; const g = window.google.maps;
        const mk = m.markers.find(x => x._title === "Selected Property Location");
        mk.setPosition(new g.LatLng(p[0], p[1])); g.event.trigger(mk, "dragend"); }}""", list(pt))
    page.wait_for_timeout(200)


def fields(page):
    return (page.locator("#fLatitude").input_value(), page.locator("#fLongitude").input_value())


def pin_at(page):
    return page.evaluate(f"""() => {{ const m = {picker_map_js()}; const mk = m && m.markers.find(x => x._title === "Selected Property Location");
        return mk ? [mk.getPosition().lat(), mk.getPosition().lng()] : null; }}""")


def save(page):
    page.evaluate("document.getElementById('adminToast').textContent = ''")   # never read a previous save's message
    page.click("#savePropertyBtn")
    page.wait_for_timeout(1500)
    return page.locator("#adminToast").inner_text()


def edit(page, slug):
    saved = db_coords(slug)
    page.evaluate(f"PropertiesModule.openEdit('{pid(slug)}')")
    # openEdit loads the record asynchronously: wait until its saved location is in the form.
    page.wait_for_function("(s) => document.getElementById('propertyModalTitle').textContent === 'Edit Property' && "
                           "(s ? parseFloat(document.getElementById('fLatitude').value) === s[0] && parseFloat(document.getElementById('fLongitude').value) === s[1]"
                           "   : document.getElementById('fLatitude').value === '')", arg=list(saved) if saved else None, timeout=10000)
    page.wait_for_timeout(300)
    wait_picker(page)


def map_pins(page):
    return page.evaluate("""() => window.__mockMaps.maps[0].markers
        .filter(m => (!m.getMap || m.getMap()) && !m._label && m._title !== "Your current location")
        .map(m => [m.getPosition().lat(), m.getPosition().lng()])""")


def props_map(b, zoom=None, centre=None):
    ctx = ctx_for(b, 1280, touch=False); page = ctx.new_page()
    goto_props(page); open_map(page)
    if zoom:
        page.evaluate("(a) => { const m = window.__mockMaps.maps[0]; m.setCenter({lat: a[0], lng: a[1]}); m.setZoom(a[2]); }", [centre[0], centre[1], zoom])
        page.wait_for_timeout(400)
    return ctx, page


def run():
    saved = {s: sql(f"select coalesce(latitude::text,'NULL'), coalesce(longitude::text,'NULL'), publish_status from properties where slug='{s}'").split("|") for s in FIXTURES}
    saved_price = {s: sql(f"select coalesce(price_display,'') from properties where slug='{s}'") for s in FIXTURES}
    created_slug = None; enquiry_phone = "9000011122"
    try:
        # Velachery scenario: the only Velachery record in the local fixtures is a draft; publish it for this test only.
        sql("update properties set publish_status='Published' where slug='draft-secret'")
        with sync_playwright() as p:
            b = p.chromium.launch()

            # ================= Search = approximate area only =================
            ctx = admin_ctx(b); page = ctx.new_page(); errs = []
            page.on("pageerror", lambda e: errs.append(str(e)[:200]))
            open_admin(page)
            edit(page, "edge-no-description")
            check("setup: a published Chromepet property with NO coordinates yet", db_coords("edge-no-description") is None and fields(page) == ("", ""))
            page.fill("#fLocationSearch", "Chromepet, Chennai"); page.click("#fLocationSearchBtn"); page.wait_for_timeout(400)
            c = page.evaluate(f"{picker_map_js()}.getCenter().toJSON()")
            check("search: map moves to the searched area", abs(c["lat"] - 12.9516) < 1e-6 and abs(c["lng"] - 80.1462) < 1e-6, c)
            check("search: Latitude/Longitude stay EMPTY — the area centre is never used", fields(page) == ("", ""), fields(page))
            check("search: no pin is dropped", pin_at(page) is None)
            check("search: tells the Admin to select the exact spot", "Now select the exact property location" in page.locator("#fLocationStatus").inner_text())

            # ================= TEST 1: Chromepet property at an exact point =================
            click_exact(page, A)
            check("T1: clicking the exact spot fills Latitude/Longitude with that point", fields(page) == (str(A[0]), str(A[1])), fields(page))
            check("T1: pin sits on the clicked point", pin_at(page) == list(A), pin_at(page))
            toast = save(page)
            check("T1: property saved", "updated" in toast.lower(), toast)
            check("T1: properties.latitude/longitude = exactly the clicked point", db_coords("edge-no-description") == A, db_coords("edge-no-description"))

            # ================= TEST 2: Velachery property at an exact point =================
            edit(page, "draft-secret")
            if not page.locator("#fPrice").input_value():
                page.fill("#fPrice", "Price on Request")   # this local fixture has no price; Price is a required field in the Admin form
            click_exact(page, V)
            toast = save(page)
            check("T2: Velachery property saved with its exact point", "updated" in toast.lower() and db_coords("draft-secret") == V, (toast, db_coords("draft-secret")))

            # ================= TEST 3 (setup): second Chromepet property close to the first =================
            edit(page, "edge-rental")
            click_exact(page, B)
            save(page)
            check("T3: second Chromepet property saved at its own exact point", db_coords("edge-rental") == B, db_coords("edge-rental"))

            # ================= TEST 4: edit existing marker by dragging =================
            edit(page, "edge-rental")
            check("T4: editing loads the saved coordinates", fields(page) == (str(B[0]), str(B[1])) or tuple(map(float, fields(page))) == B, fields(page))
            check("T4: the map opens on the saved point with the pin there", pin_at(page) == list(B), pin_at(page))
            ctr = page.evaluate(f"{picker_map_js()}.getCenter().toJSON()")
            check("T4: map centred on the exact saved location", abs(ctr["lat"] - B[0]) < 1e-9 and abs(ctr["lng"] - B[1]) < 1e-9, ctr)
            drag_pin_to(page, B2)
            check("T4: dragging the pin updates Latitude/Longitude immediately", tuple(map(float, fields(page))) == B2, fields(page))
            save(page)
            check("T4: the database now holds the dragged-to point", db_coords("edge-rental") == B2, db_coords("edge-rental"))

            # ================= Editing without touching the location preserves it =================
            before = db_coords("edge-short-title")
            edit(page, "edge-short-title")
            save(page)
            check("E: re-saving a property without touching its location keeps the exact same coordinates", db_coords("edge-short-title") == before, (before, db_coords("edge-short-title")))

            # ================= Invalid coordinates are rejected =================
            g_before = db_coords("lease-office-guindy")
            for label, la, ln, msg in [("out of range", "91", "80.2", "between -90 and 90"), ("not a number", "abc", "80.2", "decimal numbers"),
                                       ("0,0", "0", "0", "not a real property location"), ("only one value", "12.95", "", "both")]:
                edit(page, "lease-office-guindy")
                page.fill("#fLatitude", la); page.fill("#fLongitude", ln)
                toast = save(page)
                check(f"C [{label}]: save refused with a clear message", "Save failed" in toast and msg in toast, toast)
                page.evaluate("document.getElementById('cancelPropertyBtn') && document.getElementById('cancelPropertyBtn').click()"); page.wait_for_timeout(200)
            check("C: database coordinates unchanged after every refused save", db_coords("lease-office-guindy") == g_before)
            bad = subprocess.run(["psql", "-X", "-tA", "-d", DB, "-c", "update properties set latitude=0, longitude=0 where slug='lease-office-guindy'"], capture_output=True, text=True)
            check("C: the database itself rejects 0,0", "violates check constraint" in (bad.stderr or ""), bad.stderr[:200])
            bad2 = subprocess.run(["psql", "-X", "-tA", "-d", DB, "-c", "update properties set latitude=12.9, longitude=null where slug='lease-office-guindy'"], capture_output=True, text=True)
            check("C: the database itself rejects a latitude without a longitude", "violates check constraint" in (bad2.stderr or ""), bad2.stderr[:200])
            check("no JS errors (admin edits)", not errs, errs)
            ctx.close()

            # ================= Map View reads the saved coordinates =================
            ctx, page = props_map(b, 18, A)
            s = snap(page)
            check("F: Map View loaded all three newly located properties", {"edge-no-description", "draft-secret", "edge-rental"} <= set(s["mapped"]), s["mapped"])
            check("G T1: Chromepet property marker at EXACTLY its saved point", list(A) in map_pins(page), map_pins(page))
            ctx.close()
            ctx, page = props_map(b, 18, V)
            check("G T2: Velachery property marker at EXACTLY its saved point", list(V) in map_pins(page), map_pins(page))
            ctx.close()
            # TEST 3: the two Chromepet properties cluster when zoomed out, separate when zoomed in.
            ctx, page = props_map(b, 13, A)
            together = [c for c in snap(page)["clusters"] if "edge-no-description" in c and "edge-rental" in c]
            check("T3/H: zoomed out, the two nearby Chromepet properties are grouped in one cluster", bool(together), snap(page)["clusters"])
            ctx.close()
            ctx, page = props_map(b, 18, ((A[0] + B2[0]) / 2, (A[1] + B2[1]) / 2))
            pins = map_pins(page)
            check("T3/H: zoomed in, they separate into two pins at their own exact points", list(A) in pins and list(B2) in pins, pins)
            check("T4: Map View uses the NEW dragged-to point, not the old one", list(B2) in pins and list(B) not in pins, pins)
            check("F: the Velachery property is far from Chromepet — a separate location", abs(V[0] - A[0]) > 0.02)
            ctx.close()

            # ================= TEST 5: List With Us captures the exact clicked point =================
            sql(f"delete from enquiries where phone='{enquiry_phone}'")
            ctx = ctx_for(b, 1280, touch=False); ctx.add_init_script(f"window.__mockGeocodeResults = {json.dumps(SEARCH)};")
            page = ctx.new_page(); errs = []
            page.on("pageerror", lambda e: errs.append(str(e)[:200]))
            page.goto(SITE + "/list-with-us.html", wait_until="load")
            page.wait_for_selector("#lwuLocationMap .mock-map-layer", timeout=15000)
            lwu_map = "window.__mockMaps.maps.find(m => m.div && m.div.id === 'lwuLocationMap')"
            page.fill("#lwuLocationSearch", "Chromepet, Chennai"); page.click("#lwuLocationSearchBtn"); page.wait_for_timeout(400)
            check("T5: List With Us search alone leaves the location empty", page.locator("#lwuLatitude").input_value() == "")
            click_exact(page, L, lwu_map)
            check("T5: customer's click captures the exact point", (page.locator("#lwuLatitude").input_value(), page.locator("#lwuLongitude").input_value()) == (str(L[0]), str(L[1])))
            page.fill('input[name="full-name"]', "Pipeline Test Owner")
            page.fill('input[name="mobile-number"]', enquiry_phone)
            page.fill('input[name="whatsapp-number"]', enquiry_phone)
            page.select_option('select[name="property-type"]', "Residential")
            page.fill('input[name="property-address"]', "Test Street, Chromepet, Chennai")
            page.fill('input[name="expected-price"]', "8500000")
            page.select_option('select[name="listing-requirement"]', "Sale")
            page.click('#propertyForm button[type="submit"]'); page.wait_for_timeout(1500)
            row = sql(f"select id, payload->>'latitude', payload->>'longitude' from enquiries where phone='{enquiry_phone}' order by created_at desc limit 1")
            enq_id, plat, plng = (row.split("|") + ["", "", ""])[:3]
            check("T5: enquiry payload holds the exact latitude/longitude", (plat, plng) == (str(L[0]), str(L[1])), row)
            check("no JS errors (List With Us)", not errs, errs)
            ctx.close()


            # ================= No area-centre coordinates anywhere in the pipeline code =================
            for f in ["js/property-location-picker.js", "admin/js/properties.js", "admin/js/enquiries.js"]:
                src = open(os.path.join(HERE, "..", "..", f), encoding="utf-8").read()
                check(f"F: {f} has no hardcoded area names", not re.search(r"['\"](Chromepet|Velachery|Tambaram|Pallavaram|Medavakkam)['\"]", src))
            b.close()
    finally:
        for s_, (la, ln, ps) in saved.items():
            sql(f"update properties set latitude={la}, longitude={ln}, publish_status='{ps}' where slug='{s_}'")
            pd = saved_price[s_].replace("'", "''")
            sql(f"update properties set price_display={'NULL' if pd == '' else repr(pd).replace(chr(34), chr(39))} where slug='{s_}'")
        if created_slug:
            sql(f"delete from properties where slug='{created_slug}'")
        sql(f"delete from enquiries where phone='{enquiry_phone}'")
        restored = {s_: sql(f"select coalesce(latitude::text,'NULL'), coalesce(longitude::text,'NULL'), publish_status from properties where slug='{s_}'").split("|") for s_ in FIXTURES}
        check("cleanup: every touched local fixture restored exactly", restored == saved, (restored, saved))
    print(f"\n{sum(results)}/{len(results)} passed")
    return 0 if all(results) else 1

sys.exit(run())
