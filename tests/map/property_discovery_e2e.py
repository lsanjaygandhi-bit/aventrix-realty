#!/usr/bin/env python3
"""
PROPERTIES MAP VIEW — PROPERTY DISCOVERY (local stack)

Checks the actual marker distribution against the database, not just
flags: every published property with valid coordinates reaches the map,
the first overview frames their real spread, clusters are built only
from real coordinates (member positions checked in pixels, cluster
position = mean of members), clusters split as the map zooms in, every
individual marker sits exactly on its stored latitude/longitude and opens
that same property, List and Map share one filtered dataset, and Current
Location stays a separate blue dot that never removes property markers.

Env: MAP_DB (default aventrix_map), SITE :8080 / REST :3000 already
running against MAP_DB.
"""
import math, os, re, sys
sys.argv = [sys.argv[0]]
HERE = os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(HERE, "map_view_e2e.py")).read().split("EXPECTED_ON_MAP =")[0])

DOT = "Your current location"
CLUSTER_RADIUS_PX = 64       # js/properties-map.js
NO_CLUSTER_ZOOM = 18         # js/properties-map.js
OVERVIEW_MAX_ZOOM = 14       # js/properties-map.js


def db_published_coords(where=""):
    out = {}
    for row in sql("select slug, latitude::text, longitude::text from properties where publish_status='Published' "
                   "and latitude is not null and longitude is not null " + where).splitlines():
        s, la, ln = row.split("|"); out[s] = (float(la), float(ln))
    return out


def project(lat, lng, zoom):
    scale = 256 * 2 ** zoom
    siny = min(max(math.sin(lat * math.pi / 180), -0.9999), 0.9999)
    return scale * (0.5 + lng / 360), scale * (0.5 - math.log((1 + siny) / (1 - siny)) / (4 * math.pi))


def markers(page):
    """Markers currently attached to the map: pins, clusters, the blue dot."""
    return page.evaluate("""() => window.__mockMaps.maps[0].markers
        .filter(m => !m.getMap || m.getMap())
        .map(m => ({ title: m._title || "", label: m._label ? (m._label.text || m._label) : "",
                     lat: m.getPosition().lat(), lng: m.getPosition().lng() }))""")


def pins(page):
    return [m for m in markers(page) if not m["label"] and m["title"] != DOT]


def clusters(page):
    return [m for m in markers(page) if m["label"]]


def set_zoom(page, z, center=None):
    if center:
        page.evaluate("(c) => window.__mockMaps.maps[0].setCenter({lat: c[0], lng: c[1]})", list(center))
    page.evaluate(f"window.__mockMaps.maps[0].setZoom({z})")
    page.wait_for_timeout(250)


def zoom(page):
    return page.evaluate("window.__mockMaps.maps[0].getZoom()")


def expected_price(value, display, listing):
    """Independent re-statement of the price-bubble rule, from the DB row only."""
    if value in (None, ""): return None
    v = float(value)
    if v <= 0: return None
    if v >= 1e7:
        cr = v / 1e7; t = (str(round(cr)) if cr >= 100 else f"{cr:.2f}".removesuffix(".00")) + " Cr"
    elif v >= 1e5:
        l = v / 1e5; t = (str(round(l)) if l >= 100 else f"{l:.2f}".rstrip("0").rstrip(".")) + " L"
    elif v >= 1000:
        t = f"{v/1000:.1f}".removesuffix(".0") + "K"
    else:
        t = str(round(v))
    per = ""
    if listing == "lease":
        d = display or ""
        per = "/mo" if re.search(r"month|/\s*mo\b|p\.?\s*m\b", d, re.I) else "/yr" if re.search(r"year|annum|/\s*yr\b|p\.?\s*a\b", d, re.I) else ""
    return "₹" + t + per


def pin_icons(page):
    """Each visible single pin: position + the text drawn in its icon (None = house pin)."""
    return page.evaluate(f"""() => window.__mockMaps.maps[0].markers
        .filter(m => (!m.getMap || m.getMap()) && !m._label && m._title !== "{DOT}")
        .map(m => {{ const svg = decodeURIComponent(((m._icon && m._icon.url) || "").split(",").slice(1).join(","));
                    const t = svg.match(/<text[^>]*>([^<]*)<\/text>/);
                    return {{ lat: m.getPosition().lat(), lng: m.getPosition().lng(), text: t ? t[1].replace(/&amp;/g, "&") : null,
                             w: m._icon && m._icon.scaledSize ? m._icon.scaledSize.width : null,
                             ax: m._icon && m._icon.anchor ? m._icon.anchor.x : null, ay: m._icon && m._icon.anchor ? m._icon.anchor.y : null,
                             h: m._icon && m._icon.scaledSize ? m._icon.scaledSize.height : null }}; }})""")


def run():
    ALL = db_published_coords()
    ALL_SET = set(ALL.values())
    with sync_playwright() as p:
        b = p.chromium.launch()

        # ================= 1. Every mapped property reaches Map View =================
        ctx = ctx_for(b, 1280, touch=False); page = ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)[:200]))
        goto_props(page)
        open_map(page)
        s = snap(page)
        print(f"   [data] published properties with coordinates in DB: {len(ALL)} -> {sorted(ALL)}")
        check("1: Map View holds ALL published properties with valid coordinates (set equals the DB)", set(s["mapped"]) == set(ALL), (s["mapped"], sorted(ALL)))
        no_coords = set(sql("select slug from properties where publish_status='Published' and (latitude is null or longitude is null)").split())
        check("13: published properties without coordinates are in List results but have no marker",
              no_coords <= set(s["results"]) and not (no_coords & set(s["mapped"])), (no_coords, s["mapped"]))
        check("1: draft properties never reach the map (e.g. the Velachery draft)", "draft-secret" not in s["mapped"])

        # ================= 2. Initial viewport = the real spread of the properties =================
        fit = page.evaluate("window.__mockMaps.maps[0].__lastFit")
        lats = [c[0] for c in ALL.values()]; lngs = [c[1] for c in ALL.values()]
        check("2: first overview fits exactly the bounding box of the stored coordinates",
              fit and abs(fit["s"] - min(lats)) < 1e-9 and abs(fit["n"] - max(lats)) < 1e-9 and
              abs(fit["w"] - min(lngs)) < 1e-9 and abs(fit["e"] - max(lngs)) < 1e-9, (fit, min(lats), max(lats), min(lngs), max(lngs)))
        z0 = zoom(page)
        inside = page.evaluate("(pts) => { const b = window.__mockMaps.maps[0].getBounds(); return pts.every(p => b.contains({lat: p[0], lng: p[1]})); }", list(ALL.values()))
        check("2: every mapped property is inside the first view", inside)
        bb = page.evaluate("(() => { const b = window.__mockMaps.maps[0].getBounds(); return [b.getSouthWest().lat(), b.getSouthWest().lng(), b.getNorthEast().lat(), b.getNorthEast().lng()]; })()")
        print(f"   [viewport] first view zoom {z0}, bounds S{bb[0]:.4f} W{bb[1]:.4f} N{bb[2]:.4f} E{bb[3]:.4f}; properties span "
              f"{min(lats):.4f}-{max(lats):.4f} N, {min(lngs):.4f}-{max(lngs):.4f} E")
        check("2: first view is not zoomed into a single property (zoom <= 14)", z0 <= OVERVIEW_MAX_ZOOM, z0)
        check("2: first view is tighter than an all-Chennai view (zoom > 11) since the properties sit in South Chennai", z0 > 11, z0)

        # ================= 4. Clusters come from real coordinates =================
        s = snap(page); cl = clusters(page); pn = pins(page)
        print(f"   [clusters @ zoom {z0}] " + ", ".join(f"[{c['label']}]" for c in cl) + f" + {len(pn)} single pin(s)")
        check("4: clusters + single pins together represent every mapped property exactly once",
              sum(count_of(c["label"]) for c in cl) + len(pn) == len(ALL), (cl, pn))
        bad = []
        for members in s["clusters"]:
            pts = [ALL[m] for m in members]
            px = [project(la, ln, z0) for la, ln in pts]
            far = any(math.dist(px[0], q) > 2 * CLUSTER_RADIUS_PX for q in px)
            mean = (sum(la for la, _ in pts) / len(pts), sum(ln for _, ln in pts) / len(pts))
            marker = [c for c in cl if count_of(c["label"]) == len(members) and abs(c["lat"] - mean[0]) < 1e-9 and abs(c["lng"] - mean[1]) < 1e-9]
            if far or not marker: bad.append((members, far, mean))
        check("4: each cluster's count = its members, placed at the mean of their stored coordinates, members truly close on screen",
              s["clusters"] and not bad, bad)

        # ================= 5. Zooming in splits clusters =================
        centre = ((min(lats) + max(lats)) / 2, (min(lngs) + max(lngs)) / 2)
        counts = []
        for z in (11, 12, 13, 14, 15, 16, 17, NO_CLUSTER_ZOOM):
            set_zoom(page, z, centre)
            counts.append((z, len(clusters(page)), len(pins(page))))
        print("   [split] zoom -> (clusters, single pins): " + ", ".join(f"{z}->({c},{p_})" for z, c, p_ in counts))
        check("5: number of individual pins never decreases as the map zooms in", all(counts[i][2] <= counts[i + 1][2] for i in range(len(counts) - 1)), counts)
        check("5: zoomed out there are clusters; zoomed right in they have split", counts[0][1] >= 1 and counts[-1][2] > counts[0][2], counts)
        s = snap(page)
        dup_groups = {}
        for slug, c in ALL.items(): dup_groups.setdefault(c, []).append(slug)
        same_spot = [sorted(v) for v in dup_groups.values() if len(v) > 1]
        check("5: at full zoom the only remaining clusters are properties stored at the IDENTICAL coordinates",
              sorted(sorted(c) for c in s["clusters"]) == sorted(same_spot), (s["clusters"], same_spot))

        # ================= 3 / 15. Exact coordinates, no fake markers =================
        pn = pins(page)
        check("3: every single pin sits exactly on a stored DB latitude/longitude", pn and all((m["lat"], m["lng"]) in ALL_SET for m in pn),
              [m for m in pn if (m["lat"], m["lng"]) not in ALL_SET])
        single = {c for c, v in dup_groups.items() if len(v) == 1}
        check("3: at full zoom every uniquely-located property has its own pin at its exact coordinates",
              {(m["lat"], m["lng"]) for m in pn} == single, ({(m["lat"], m["lng"]) for m in pn} ^ single))
        check("15: no marker at the Chennai default or any non-DB position",
              all((m["lat"], m["lng"]) in ALL_SET for m in pn) and not any(abs(m["lat"] - 13.0827) < 1e-6 and abs(m["lng"] - 80.2707) < 1e-6 for m in markers(page)))

        # ================= 6. Clicking a pin opens that exact property =================
        wrong = []
        for i in range(len(pn)):
            page.evaluate(f"""() => {{ const ms = window.__mockMaps.maps[0].markers.filter(m => (!m.getMap || m.getMap()) && !m._label && m._title !== "{DOT}");
                ms[{i}]._el.click(); }}""")
            page.wait_for_timeout(120)
            pos = page.evaluate(f"""() => {{ const ms = window.__mockMaps.maps[0].markers.filter(m => (!m.getMap || m.getMap()) && !m._label && m._title !== "{DOT}");
                return [ms[{i}].getPosition().lat(), ms[{i}].getPosition().lng()]; }}""")
            slug = page.get_attribute("#sfMapPreview", "data-slug")
            if not slug or ALL.get(slug) != tuple(pos): wrong.append((pos, slug))
            page.evaluate("document.querySelector('#sfMapPreview .sf-map-preview-close') && document.querySelector('#sfMapPreview .sf-map-preview-close').click()")
        check(f"6: clicking each of the {len(pn)} pins opens the preview of the property stored at that exact point", not wrong, wrong)

        # Cluster click at a wide zoom zooms in (it does not open a random property).
        set_zoom(page, 11, centre); z_before = zoom(page)
        page.evaluate("""() => { const c = window.__mockMaps.maps[0].markers.find(m => (!m.getMap || m.getMap()) && m._label); c && c._el.click(); }""")
        page.wait_for_timeout(300)
        check("5: clicking a cluster at a wide zoom zooms into it", zoom(page) > z_before, (z_before, zoom(page)))

        # ================= 10 / 11. Roadmap / Hybrid never move markers =================
        check("10: Roadmap is the default map type", page.evaluate("window.__mockMaps.maps[0].getMapTypeId()") == "roadmap")
        set_zoom(page, NO_CLUSTER_ZOOM, centre)
        before = sorted((m["lat"], m["lng"]) for m in pins(page))
        page.locator("#sfMapCanvas .mock-maptype-control").select_option("hybrid"); page.wait_for_timeout(250)
        after = sorted((m["lat"], m["lng"]) for m in pins(page))
        check("11: Satellite option renders Hybrid (imagery with road/locality labels)", page.evaluate("window.__mockMaps.maps[0].getMapTypeId()") == "hybrid")
        check("11: switching map type never moves a property marker", before == after)
        page.locator("#sfMapCanvas .mock-maptype-control").select_option("roadmap"); page.wait_for_timeout(150)

        # ================= 14. Empty viewport keeps the map =================
        set_zoom(page, 12, (-5.0, 60.0))
        check("14: empty viewport keeps the map visible", page.locator("#sfMapWrap").is_visible() and page.locator("#sfMapCanvas").is_visible())
        check("14: empty viewport says 'No properties in this area yet.'", page.locator("#sfMapNote").inner_text().strip() == "No properties in this area yet.")
        check("1: panning away does not remove anything from the map dataset", set(snap(page)["mapped"]) == set(ALL))
        check("no JS errors (1-6, 10-15)", not errs, errs)
        ctx.close()

        # ================= 7. List and Map share one filtered dataset =================
        for label, qs in [("2 BHK", "?beds=2"), ("price range", "?priceMin=5000000&priceMax=10000000"), ("sale only", "?listingType=sale")]:
            ctx = ctx_for(b, 1280, touch=False); page = ctx.new_page(); errs = []
            page.on("pageerror", lambda e: errs.append(str(e)[:200]))
            goto_props(page, qs)
            cards = set(page.evaluate("[...document.querySelectorAll('#sfResultsGrid .property-card')].map(c => c.dataset.slug)"))
            open_map(page); s = snap(page)
            expected_map = {x for x in cards if x in ALL}
            check(f"7 [{label}]: Map results are exactly the List View cards", set(s["results"]) == cards and len(cards) > 0, (s["results"], cards))
            check(f"7 [{label}]: map markers = those same cards that have coordinates ({len(expected_map)})",
                  set(s["mapped"]) == expected_map and set(s["mapped"]) != set(ALL), (s["mapped"], expected_map))
            print(f"   [filter {label}] list {len(cards)} -> map {len(expected_map)}: {sorted(expected_map)}")
            check(f"no JS errors (7 {label})", not errs, errs)
            ctx.close()

        # ================= 8 / 9. Current Location stays separate =================
        ctx = ctx_for(b, 1280, touch=False)
        ctx.grant_permissions(["geolocation"])
        ctx.set_geolocation({"latitude": 12.9560, "longitude": 80.1500, "accuracy": 25})   # near the Chromepet fixtures, not on any of them
        page = ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)[:200]))
        goto_props(page); open_map(page)
        mapped_before = set(snap(page)["mapped"])
        page.click("#sfCurrentLocationBtn")
        page.wait_for_function("(() => { const c = window.__mockMaps.maps[0].getCenter(); return c.lat() === 12.956 && c.lng() === 80.15; })()", timeout=6000)
        page.wait_for_timeout(300)   # let the map settle (idle -> re-cluster at the new zoom) before counting
        dots = [m for m in markers(page) if m["title"] == DOT]
        check("8: Current Location is one separate blue marker at the GPS position", len(dots) == 1 and (dots[0]["lat"], dots[0]["lng"]) == (12.956, 80.15), dots)
        check("8: the blue marker is not a property (not in the DB coordinates, not a cluster)", (12.956, 80.15) not in ALL_SET and not dots[0]["label"])
        check("9: after Current Location the full property dataset is still on the map", set(snap(page)["mapped"]) == mapped_before == set(ALL))
        near = page.evaluate("(pts) => { const b = window.__mockMaps.maps[0].getBounds(); return pts.filter(p => b.contains({lat: p[0], lng: p[1]})).length; }", list(ALL.values()))
        visible_props = sum(count_of(c["label"]) for c in clusters(page)) + len(pins(page))
        check("9: surrounding property markers remain visible around the user's location", near > 0 and visible_props == len(ALL), (near, visible_props))
        check("no JS errors (8-9)", not errs, errs)
        ctx.close()

        # ================= NoBroker-style discovery UX (Aventrix styling) =================
        prices = {}
        for row in sql("select slug, coalesce(price_value::text,''), coalesce(price_display,''), coalesce(listing_type,'') from properties "
                       "where publish_status='Published' and latitude is not null").splitlines():
            sl, v, d, lt = row.split("|"); prices[sl] = expected_price(v or None, d, lt)
        by_pos = {}
        for sl, c in ALL.items(): by_pos.setdefault(c, []).append(sl)
        for sl in sorted(prices): print(f"   [price] {sl}: DB -> bubble {prices[sl]!r}")
        ctx = ctx_for(b, 1280, touch=False); page = ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)[:200]))
        goto_props(page); open_map(page)
        cl = clusters(page)
        check("UX: cluster labels read 'N Properties' with N = real member count",
              cl and all(re.fullmatch(r"\d+ Properties", c["label"]) for c in cl)
              and sorted(count_of(c["label"]) for c in cl) == sorted(len(m) for m in snap(page)["clusters"]), cl)
        lo = min(c[0] for c in ALL.values()); hi = max(c[0] for c in ALL.values())
        set_zoom(page, NO_CLUSTER_ZOOM, ((lo + hi) / 2, sum(c[1] for c in ALL.values()) / len(ALL)))
        icons = pin_icons(page)
        wrong = []
        for ic in icons:
            owners = by_pos.get((ic["lat"], ic["lng"]), [])
            exp = prices.get(owners[0]) if len(owners) == 1 else "?"
            if exp is None and ic["text"] is not None: wrong.append(("house expected", ic))
            elif exp not in (None, "?") and ic["text"] != exp: wrong.append((exp, ic))
        check(f"UX: every single pin shows its OWN stored price as a bubble (or the house pin when the property has no price) — {len(icons)} pins", icons and not wrong, wrong)
        bubbles = [ic for ic in icons if ic["text"]]
        check("UX: price bubble pointer tip = the exact coordinate (anchor at bottom-centre of the bubble)",
              bubbles and all(abs(ic["ax"] - ic["w"] / 2) < 1e-6 and abs(ic["ay"] - ic["h"]) < 1e-6 for ic in bubbles), bubbles)
        check("UX: price bubbles never show a price for a property whose price_value is empty",
              all(ic["text"] is None for ic in icons if len(by_pos.get((ic["lat"], ic["lng"]), [])) == 1 and prices[by_pos[(ic["lat"], ic["lng"])][0]] is None))
        # Preview contents for a priced pin
        target = next(ic for ic in bubbles)
        slug_t = by_pos[(target["lat"], target["lng"])][0]
        page.evaluate(f"""() => {{ const m = window.__mockMaps.maps[0].markers.find(m => (!m.getMap || m.getMap()) && !m._label
            && m.getPosition().lat() === {target["lat"]} && m.getPosition().lng() === {target["lng"]}); m._el.click(); }}""")
        page.wait_for_timeout(200)
        row = sql(f"select title, coalesce(location,''), coalesce(price_display,''), coalesce(built_up_area, land_area, uds_area, '') from properties where slug='{slug_t}'").split("|")
        pv = page.locator("#sfMapPreview")
        check("UX: preview opens for the clicked price bubble's property", page.get_attribute("#sfMapPreview", "data-slug") == slug_t)
        check("UX: preview shows image, title, locality, price", pv.locator(".sf-map-preview-img img").count() == 1
              and row[0] in pv.inner_text() and row[1] in pv.inner_text() and row[2] in pv.inner_text(), (row, pv.inner_text()))
        check("UX: preview shows configuration and size", (not row[3] or row[3] in pv.locator(".sf-map-preview-meta").inner_text())
              and ("For Sale" in pv.inner_text() or "For Lease" in pv.inner_text()), pv.locator(".sf-map-preview-meta").inner_text())
        cta = pv.locator(".sf-map-preview-cta")
        check("UX: 'View Property' opens the existing property detail page",
              cta.inner_text().strip() == "View Property" and cta.get_attribute("href") == f"property.html?id={slug_t}", (cta.inner_text(), cta.get_attribute("href")))
        cta.click(); page.wait_for_load_state("load"); page.wait_for_timeout(800)
        check("UX: detail page for that exact property loads", f"id={slug_t}" in page.url and row[0] in page.locator("body").inner_text())
        check("no JS errors (UX desktop)", not errs, errs)
        ctx.close()

        # Mobile Map View
        ctx = ctx_for(b, 390); page = ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)[:200]))
        goto_props(page); open_map(page)
        cl_m = clusters(page); pn_m = pins(page)
        check("UX mobile: map shows clusters/bubbles covering every mapped property",
              sum(count_of(c["label"]) for c in cl_m) + len(pn_m) == len(ALL), (cl_m, pn_m))
        page.evaluate(f"""() => {{ const m = window.__mockMaps.maps[0].markers.find(m => (!m.getMap || m.getMap()) && !m._label && m._title !== "{DOT}"); m._el.click(); }}""")
        page.wait_for_timeout(300)
        check("UX mobile: preview opens with a visible 'View Property' button", page.locator("#sfMapPreview").is_visible()
              and page.locator("#sfMapPreview .sf-map-preview-cta").is_visible() and page.locator("#sfMapPreview .sf-map-preview-cta").inner_text().strip() == "View Property")
        check("no JS errors (UX mobile)", not errs, errs)
        ctx.close()

        # Advanced markers (used only if a Map ID is configured) render the same way
        ctx = ctx_for(b, 1280, map_id="TEST_MAP_ID", touch=False); page = ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)[:200]))
        goto_props(page); open_map(page)
        adv_cl = page.evaluate("[...document.querySelectorAll('#sfMapCanvas .sf-map-cluster')].map(e => e.textContent.trim())")
        check("UX advanced: clusters read 'N Properties'", adv_cl and all(re.fullmatch(r"\d+ Properties", t) for t in adv_cl), adv_cl)
        set_zoom(page, NO_CLUSTER_ZOOM, ((lo + hi) / 2, sum(c[1] for c in ALL.values()) / len(ALL)))
        adv_prices = sorted(page.evaluate("[...document.querySelectorAll('#sfMapCanvas .sf-map-price')].map(e => e.textContent.trim())"))
        exp_prices = sorted(prices[v[0]] for v in by_pos.values() if len(v) == 1 and prices[v[0]])
        check("UX advanced: price bubbles show exactly the stored prices", adv_prices == exp_prices, (adv_prices, exp_prices))
        check("no JS errors (UX advanced)", not errs, errs)
        ctx.close()

        # ================= 12. No hardcoded area-name logic =================
        src = open(os.path.join(HERE, "..", "..", "js", "properties-map.js"), encoding="utf-8").read()
        names = ["Chromepet", "Velachery", "Tambaram", "Pallavaram", "Pallikaranai", "Medavakkam", "Perungudi", "OMR", "ECR", "Adyar", "Guindy", "Porur", "Sholinganallur"]
        check("12: no area-name literals in js/properties-map.js", not [n for n in names if re.search(r"['\"]" + n + r"['\"]", src)])
        check("12: no area === '<name>' logic", re.search(r'area\s*===?\s*["\']', src) is None)

        # ================= Area coverage in the real test data =================
        loc = dict(l.split("|", 1) for l in sql("select slug, coalesce(location,'') from properties where publish_status='Published' and latitude is not null").splitlines())
        for area in ("Chromepet", "Velachery", "Tambaram"):
            hits = sorted(sl for sl, l in loc.items() if area.lower() in l.lower())
            print(f"   [area] {area}: {len(hits)} published propert{'y' if len(hits) == 1 else 'ies'} with coordinates {hits}")
        chrom = [sl for sl, l in loc.items() if "chromepet" in l.lower()]
        check("area: Chromepet-area properties with real coordinates are all on the map", chrom and set(chrom) <= set(ALL))

        b.close()
    print(f"\n{sum(results)}/{len(results)} passed")
    return 0 if all(results) else 1

sys.exit(run())
