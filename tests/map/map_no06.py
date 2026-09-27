#!/usr/bin/env python3
"""
Compatibility: the new site + Admin against a database WITHOUT migration 06
(no latitude/longitude columns). Expected: List View unchanged, Map View
explains that no property has a map location yet, Admin hides the
coordinate fields and saving a property still works.
Env: NO06_DB (served by PostgREST :3000 during this run).
"""
import os, sys
sys.argv = [sys.argv[0]]
HERE = os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(HERE, "map_view_e2e.py")).read().split("EXPECTED_ON_MAP =")[0])
DB = os.environ.get("NO06_DB", "aventrix_cms")

def main():
    cols = sql("select count(*) from information_schema.columns where table_schema='public' and table_name='properties' and column_name in ('latitude','longitude')", DB)
    check("setup: database has NO coordinate columns (migration 06 not run)", cols == "0", cols)
    published = int(sql("select count(*) from properties where publish_status='Published'", DB))
    with sync_playwright() as p:
        b = p.chromium.launch()
        for w in (390, 1280):
            ctx = ctx_for(b, w); page = ctx.new_page(); errs = []
            page.on("pageerror", lambda e: errs.append(str(e)[:200]))
            goto_props(page)
            check(f"{w}: List View lists every published property", page.locator("#sfResultsGrid .property-card").count() == published and count_num(page) == published)
            page.click("#sfViewMapBtn"); page.wait_for_timeout(600)
            note = page.locator("#sfMapNote").inner_text()
            check(f"{w}: Map View says the properties don't have a map location yet", "don't have a map location yet" in note, note)
            check(f"{w}: map still renders (Chennai-centered) even with no coordinate column at all", page.locator("#sfMapWrap").is_visible() and page.locator("#sfMapCanvas .mock-marker").count() == 0)
            check(f"{w}: Google Maps IS loaded — there are properties, they just have no coordinates yet", len(ctx.maps_requests) >= 1)
            check(f"{w}: no JS errors", not errs, errs)
            ctx.close()
        ctx = ctx_for(b, 1280, uid=ADMIN, touch=False); page = ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)[:200]))
        page.goto(SITE + "/admin/dashboard.html", wait_until="load"); page.wait_for_timeout(2500)
        page.click('#adminNav a[data-section="properties"]'); page.wait_for_timeout(1500)
        pid = sql("select id from properties where publish_status='Published' order by created_at limit 1", DB)
        before = sql(f"select updated_at from properties where id='{pid}'", DB)
        page.evaluate(f"PropertiesModule.openEdit('{pid}')"); page.wait_for_timeout(1500)
        check("admin: coordinate fields hidden before migration 06", page.locator("#fCoordsRow").is_hidden())
        page.fill("#fSeoKeywords", "compat-check"); page.click("#savePropertyBtn"); page.wait_for_timeout(1800)
        after = sql(f"select updated_at||'|'||seo_keywords from properties where id='{pid}'", DB)
        check("admin: saving a property still works (no coordinate columns sent)", after.endswith("|compat-check") and not after.startswith(before), after)
        check("admin: no JS errors", not errs, errs)
        ctx.close(); b.close()
    print(f"\n{sum(results)}/{len(results)} passed")
    return 0 if all(results) else 1

sys.exit(main())
