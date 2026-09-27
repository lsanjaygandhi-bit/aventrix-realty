#!/usr/bin/env python3
"""
HOMEPAGE LIST / MAP (Future Properties section) — END-TO-END TESTS

Same local stack and Google Maps test stand-in as map_view_e2e.py.
Checks that the homepage uses its ONE existing property query for both
views, that the map shows exactly those records, and that the shared
component behaves the same as on the Properties page.
"""
import json, os, re, sys
sys.argv = [sys.argv[0]]
HERE = os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(HERE, "map_view_e2e.py")).read().split("EXPECTED_ON_MAP =")[0])

HOME_SQL = "select slug from properties where publish_status='Published' order by is_featured desc, created_at desc limit 20"
HOME = sql(HOME_SQL).split()
HOME_MAPPED = set(sql(f"select slug from ({HOME_SQL.replace('select slug', 'select slug, latitude, is_featured, created_at')}) t where latitude is not null").split())

def home_ctx(b, w, strip_coords=False, **kw):
    ctx = ctx_for(b, w, **kw)
    ctx.prop_requests = []
    def spy(route):
        u = route.request.url
        if "/rest/v1/properties" in u:
            ctx.prop_requests.append(u)
            if strip_coords:
                h = {k: v for k, v in route.request.headers.items() if k.lower() in ("content-type", "prefer", "accept", "range", "accept-profile", "origin")}
                resp = route.fetch(url=REST + u.split("/rest/v1", 1)[1], headers=h)
                data = resp.json()
                if isinstance(data, list):
                    for r in data: r["latitude"] = None; r["longitude"] = None
                return route.fulfill(response=resp, body=json.dumps(data))
        return route.fallback()
    ctx.route(f"**/{REF}.supabase.co/rest/v1/properties*", spy)
    return ctx

def goto_home(page):
    page.goto(SITE + "/index.html", wait_until="load")
    page.wait_for_function("window.AventrixHomeResults && window.AventrixHomeResults.status", timeout=15000)
    page.wait_for_timeout(400)

def hsnap(page):
    return page.evaluate("window.AventrixPropertyMap.snapshot('home')")

def open_home_map(page):
    page.locator("#hpViewMapBtn").scroll_into_view_if_needed()
    page.click("#hpViewMapBtn")
    page.wait_for_function("window.AventrixPropertyMap.snapshot('home').mapsStatus !== 'loading'", timeout=20000)
    page.wait_for_timeout(350)

def cards(page):
    return page.evaluate("[...document.querySelectorAll('#futurePropertiesGrid .home-app-card-heart')].map(b => b.dataset.slug)")

def run():
    with sync_playwright() as p:
        b = p.chromium.launch()

        # ---------- functional, desktop ----------
        ctx = home_ctx(b, 1280, touch=False); page = ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)[:200]))
        goto_home(page)
        list_reqs = len(ctx.prop_requests)
        check("home: List View is the default; map hidden", page.locator("#futurePropertiesGrid").is_visible() and page.locator("#hpMapView").is_hidden()
              and page.get_attribute("#hpViewListBtn", "aria-pressed") == "true")
        check("home: existing Future Properties cards unchanged (same 20-limit query, same order as DB)", cards(page) == HOME, (cards(page), HOME))
        check("home: Google Maps not requested in List View", len(ctx.maps_requests) == 0)
        check("home: exactly one public property query on the homepage", len([u for u in ctx.prop_requests if "publish_status=eq.Published" in u]) == 1, ctx.prop_requests)
        check("home: 'View All Properties' links to the Properties page", page.get_attribute(".hp-view-all a", "href") == "properties.html" and page.locator(".hp-view-all a").inner_text().strip() == "View All Properties")
        check("home: CMS heading/subtitle/See All untouched", page.locator("#future-properties [data-cms-heading]").count() == 1 and page.locator("#future-properties .home-app-see-all").count() == 1)
        open_home_map(page)
        s = hsnap(page)
        check("home map: no extra property query when Map View opens (same records)", len(ctx.prop_requests) == list_reqs, ctx.prop_requests)
        check("home map: Maps requested once, only after Map View was chosen", len(ctx.maps_requests) == 1 and s["mapsStatus"] == "ready", ctx.maps_requests)
        check("home map: map uses exactly the records List View shows", s["results"] == HOME, s["results"])
        check("home map: markers = those records that have coordinates", set(s["mapped"]) == HOME_MAPPED, (s["mapped"], HOME_MAPPED))
        check("home map: Draft property never on the map", "draft-secret" not in s["mapped"] and "draft-secret" not in s["results"])
        note = page.locator("#hpMapNote").inner_text()
        check("home map: note 'Showing X of Y properties on the map.'", note == f"Showing {len(HOME_MAPPED)} of {len(HOME)} properties on the map.", note)
        fit = page.evaluate("window.__mockMaps.maps[0].__lastFit")
        lats = [float(x) for x in sql(f"select latitude from properties where slug in ({','.join(repr(x) for x in HOME_MAPPED)})").split()]
        check("home map: bounds fitted around the mapped records", fit and abs(fit["s"] - min(lats)) < 1e-6 and abs(fit["n"] - max(lats)) < 1e-6, fit)
        check("home map: no 'Search this area' on the homepage (no filters here)", page.locator("#hpMapAreaBtn").count() == 0)
        check("home map: 'View All Properties' still shown under the map", page.locator(".hp-view-all a").is_visible())
        # same records as the Properties page
        home_recs = page.evaluate("Object.fromEntries(window.AventrixHomeResults.properties.map(p => [p.slug, [p.title, p.price_display, p.location, p.featured_image, p.latitude, p.longitude, p.publish_status]]))")
        pg2 = ctx.new_page(); goto_props(pg2)
        prop_recs = pg2.evaluate("Object.fromEntries(window.AventrixSearchResults.properties.map(p => [p.slug, [p.title, p.price_display, p.location, p.featured_image, p.latitude, p.longitude, p.publish_status]]))")
        check("shared: every homepage record is identical to the Properties page record (same table, same fields)", all(prop_recs.get(k) == v for k, v in home_recs.items()) and len(home_recs) == len(HOME))
        pg2.close()
        # preview
        page.locator('#hpMapCanvas .mock-marker[data-kind="pin"]').first.click(); page.wait_for_timeout(250)
        slug = page.get_attribute("#hpMapPreview", "data-slug")
        row = sql(f"select title||'|'||coalesce(location,'')||'|'||coalesce(price_display,'') from properties where slug='{slug}'").split("|")
        ptxt = page.locator("#hpMapPreview").inner_text()
        check("home preview: the same preview (image, title, location, type, price) from the real record", slug in HOME_MAPPED and all(x in ptxt for x in row if x)
              and page.locator("#hpMapPreview .sf-map-preview-img img").count() == 1, (slug, ptxt))
        check("home preview: View Details → that property's page", page.get_attribute("#hpMapPreview .sf-map-preview-cta", "href") == f"property.html?id={slug}")
        page.click("#hpMapPreview .sf-map-wish"); page.wait_for_timeout(200)
        st = page.evaluate(f"[window.AventrixStorage.wishlist.has('{slug}'), document.querySelector('#futurePropertiesGrid .home-app-card-heart[data-slug=\"{slug}\"]').classList.contains('saved')]")
        check("home preview: Wishlist uses the property ID and updates the homepage card heart", st == [True, True], st)
        page.click("#hpMapPreview .sf-map-wish"); page.wait_for_timeout(150)
        page.click("#hpMapPreview .sf-map-preview-cta"); page.wait_for_load_state("load"); page.wait_for_timeout(1300)
        check("home preview: View Details opens the correct property", f"id={slug}" in page.url and sql(f"select title from properties where slug='{slug}'") in page.locator("body").inner_text())
        goto_home(page); page.wait_for_timeout(500)
        check("home: returning in the same tab keeps Map View", hsnap(page)["view"] == "map")
        page.click("#hpViewListBtn"); page.wait_for_timeout(200)
        check("home: back to List View shows the same cards", page.locator("#futurePropertiesGrid").is_visible() and cards(page) == HOME)
        check("home: no URL change for map/list state", page.evaluate("location.pathname + location.search") == "/index.html")
        check("home: no JS errors", not errs, errs)
        ctx.close()

        # ---------- properties without coordinates ----------
        ctx = home_ctx(b, 390, strip_coords=True); page = ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)[:200]))
        goto_home(page); open_home_map(page)
        check("no coords: map still renders (Chennai-centered), clean message, no markers", page.locator("#hpMapNote").inner_text() == "Map locations will appear as properties are added to the map."
              and page.locator("#hpMapWrap").is_visible() and len(ctx.maps_requests) == 1 and page.locator("#hpMapCanvas .mock-marker").count() == 0, page.locator("#hpMapNote").inner_text())
        check("no coords: map centered on Chennai with no properties to fit to", page.evaluate("(() => { const m = window.__mockMaps.maps[0]; const c = m.getCenter(); return Math.abs(c.lat() - 13.0827) < 0.01 && Math.abs(c.lng() - 80.2707) < 0.01; })()"))
        page.click("#hpViewListBtn"); page.wait_for_timeout(200)
        check("no coords: List View fully works", cards(page) == HOME and not errs, errs)
        ctx.close()

        # ---------- failures ----------
        for label, kw, n in [("no key configured (as shipped)", dict(key=""), 0), ("invalid key", dict(key="INVALID"), 1), ("network failure", dict(maps="network"), 1)]:
            ctx = home_ctx(b, 390, **kw); page = ctx.new_page(); errs = []
            page.on("pageerror", lambda e: errs.append(str(e)[:200]))
            goto_home(page); open_home_map(page); page.wait_for_timeout(600)
            check(f"fallback: {label} → message, List View still works", page.locator("#hpMapFallback").is_visible()
                  and page.locator("#hpMapFallbackText").inner_text().strip() == "Map view is temporarily unavailable. Please use List View to browse properties."
                  and len(ctx.maps_requests) == n and not errs, (ctx.maps_requests, errs))
            page.click("#hpViewListBtn"); page.wait_for_timeout(200)
            check(f"fallback: {label} → cards still listed", cards(page) == HOME)
            ctx.close()

        # ---------- responsive ----------
        for w in WIDTHS:
            ctx = home_ctx(b, w); page = ctx.new_page(); errs = []
            page.on("pageerror", lambda e: errs.append(str(e)[:200]))
            goto_home(page)
            tg = page.evaluate("(() => { const r = document.getElementById('hpViewToggle').getBoundingClientRect(); return {l: r.left, r: r.right, w: r.width}; })()")
            check(f"{w}: toggle visible and inside the page", tg["w"] > 0 and tg["l"] >= 0 and tg["r"] <= w + .5, tg)
            open_home_map(page)
            page.evaluate("document.getElementById('hpMapWrap').scrollIntoView({block:'center', behavior:'instant'})"); page.wait_for_timeout(450)
            geo = page.evaluate("""(() => { const W = innerWidth, H = innerHeight, wr = document.getElementById('hpMapWrap').getBoundingClientRect(), tg = document.getElementById('hpViewToggle').getBoundingClientRect();
                const vis = s => { const e = document.querySelector(s); if (!e) return null; const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity < .05) return null; const r = e.getBoundingClientRect(); return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}; };
                const z = document.querySelector('#hpMapCanvas .mock-zoom-controls').getBoundingClientRect();
                const ce = document.querySelector('#future-properties .container'), cs = getComputedStyle(ce), c = {width: ce.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)};
                const g = document.getElementById('futurePropertiesGrid');
                return {overflow: document.documentElement.scrollWidth > W + 1, wrap:{left:wr.left,right:wr.right,top:wr.top,bottom:wr.bottom,h:wr.height,w:wr.width}, cw: c.width, H: H,
                        toggleOverMap: tg.bottom > wr.top + .5,
                        wa: vis('.whatsapp-float'), top: vis('.back-to-top'), zoom:{left:z.left,right:z.right,top:z.top,bottom:z.bottom}}; })()""")
            check(f"{w}: no horizontal scroll", not geo["overflow"])
            check(f"{w}: map full section width and not too short", geo["wrap"]["left"] >= 0 and geo["wrap"]["right"] <= w + .5 and geo["wrap"]["w"] >= geo["cw"] - 1
                  and geo["wrap"]["h"] >= min(340, geo["H"] * 0.4), geo)
            check(f"{w}: toggle does not overlap the map", not geo["toggleOverMap"])
            fl = [f for f in (geo["wa"], geo["top"]) if f]
            check(f"{w}: WhatsApp / Back-to-top don't cover the map or its zoom controls", all(rect_overlap(f, geo["wrap"]) == 0 and rect_overlap(f, geo["zoom"]) == 0 for f in fl), (fl, geo["wrap"]))
            for _ in range(6):
                if page.locator('#hpMapCanvas .mock-marker[data-kind="pin"]').count(): break
                page.locator('#hpMapCanvas .mock-marker[data-kind="cluster"]').first.click(); page.wait_for_timeout(300)
            page.locator('#hpMapCanvas .mock-marker[data-kind="pin"]').first.click(); page.wait_for_timeout(250)
            pv = page.evaluate("""(() => { const r = document.getElementById('hpMapPreview').getBoundingClientRect(), wr = document.getElementById('hpMapWrap').getBoundingClientRect();
                const vis = s => { const e = document.querySelector(s); if (!e) return null; const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity < .05) return null; const q = e.getBoundingClientRect(); return {left:q.left,right:q.right,top:q.top,bottom:q.bottom}; };
                const ok = [...document.querySelectorAll('#hpMapPreview a, #hpMapPreview button')].map(b => { const q = b.getClientRects()[0] || b.getBoundingClientRect(); const hit = document.elementFromPoint(q.left + q.width/2, q.top + q.height/2); return b === hit || b.contains(hit); });
                return {r:{left:r.left,right:r.right,top:r.top,bottom:r.bottom}, inside: r.left >= wr.left - .5 && r.right <= wr.right + .5 && r.top >= wr.top - .5 && r.bottom <= wr.bottom + .5,
                        inVp: r.left >= 0 && r.right <= innerWidth + .5 && r.top >= 0 && r.bottom <= innerHeight + .5, wa: vis('.whatsapp-float'), top: vis('.back-to-top'), ok: ok.every(Boolean), n: ok.length}; })()""")
            check(f"{w}: preview inside the map and the screen (not clipped)", pv["inside"] and pv["inVp"], pv)
            fl = [f for f in (pv["wa"], pv["top"]) if f]
            check(f"{w}: floating buttons never cover the preview; its buttons tappable", all(rect_overlap(f, pv["r"]) == 0 for f in fl) and pv["ok"] and pv["n"] >= 4, pv)
            page.click("#hpMapPreview .sf-map-preview-close")
            page.evaluate("window.scrollTo({top: document.documentElement.scrollHeight, behavior: 'instant'})"); page.wait_for_timeout(500)
            check(f"{w}: WhatsApp returns once the map is scrolled away", page.evaluate("getComputedStyle(document.querySelector('.whatsapp-float')).visibility") == "visible")
            va = page.evaluate("(() => { const a = document.querySelector('.hp-view-all a'); a.scrollIntoView({block:'center', behavior:'instant'}); const r = a.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2); return {ok: a === hit || a.contains(hit), l: r.left, r: r.right}; })()")
            check(f"{w}: 'View All Properties' visible, inside the page, clickable", va["ok"] and va["l"] >= 0 and va["r"] <= w + .5, va)
            check(f"{w}: no JS errors", not errs, errs)
            page.evaluate("document.getElementById('future-properties').scrollIntoView({block:'start', behavior:'instant'})"); page.wait_for_timeout(300)
            page.screenshot(path=f"/tmp/claude-0/-home-claude/0b2e453c-9df2-51a1-a8b1-d41793b3faf9/scratchpad/map/home_{w}.png")
            ctx.close()
        b.close()
    print(f"\n{sum(results)}/{len(results)} passed")
    return 0 if all(results) else 1

sys.exit(run())
