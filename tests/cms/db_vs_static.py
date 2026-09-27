#!/usr/bin/env python3
"""
Renders each public page twice — static HTML only (database blocked) and
with the CMS database (local PostgREST) — and lists every visible text or
link that differs. After the content sync, the only differences should be
values the Admin already holds that differ from the old static copy.
Usage: db_vs_static.py [page.html ...]
"""
import sys, os, glob, difflib, json
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SITE = "http://localhost:8080"; REST = "http://localhost:3000"; REF = "gkrtjeygrqkglsadskcg"
UMD = open("/tmp/sbjs/node_modules/@supabase/supabase-js/dist/umd/supabase.js").read()
pages = sys.argv[1:] or sorted(os.path.basename(p) for p in glob.glob(os.path.join(ROOT, "*.html")) if not p.endswith(("account.html",)))
SNAP = r"""() => {
  const out = [];
  document.querySelectorAll('body *').forEach(el => {
    if (el.closest('script,style,noscript,svg,iframe,template')) return;
    if (el.children.length === 0 || el.tagName === 'A' || el.tagName === 'P' || /^H[1-6]$/.test(el.tagName)) {
      const t = (el.innerText || '').replace(/\s+/g, ' ').trim();
      const vis = el.offsetParent !== null || el.tagName === 'TITLE';
      if (t && vis) out.push(el.tagName + ': ' + t.slice(0, 160));
    }
    if (el.tagName === 'A' && el.getAttribute('href') && el.offsetParent !== null) out.push('href: ' + (el.innerText||'').trim().slice(0,30) + ' -> ' + el.getAttribute('href'));
    if (el.tagName === 'IMG' && el.offsetParent !== null) out.push('img: ' + el.getAttribute('src'));
  });
  out.push('TITLE: ' + document.title);
  const md = document.querySelector('meta[name=description]'); out.push('DESC: ' + (md ? md.content : ''));
  return out; }"""
def ctx_for(b, db):
    ctx = b.new_context(viewport={"width": 1366, "height": 900})
    def handle(route):
        u = route.request.url
        if "supabase-js" in u:
            return route.fulfill(status=200, content_type="application/javascript", body=UMD) if db else route.abort()
        if f"{REF}.supabase.co/rest/v1" in u and db:
            h = {k: v for k, v in route.request.headers.items() if k.lower() in ("content-type", "prefer", "accept", "range", "accept-profile", "origin")}
            return route.fulfill(response=route.fetch(url=REST + u.split("/rest/v1", 1)[1], headers=h))
        if f"{REF}.supabase.co/auth" in u:
            return route.fulfill(status=200, content_type="application/json", body="{}")
        if u.startswith(SITE) or u.startswith("data:"):
            return route.continue_()
        return route.abort()
    ctx.route("**/*", handle)
    return ctx
res = {}
with sync_playwright() as p:
    b = p.chromium.launch()
    for pg in pages:
        snaps = {}
        for db in (False, True):
            ctx = ctx_for(b, db); page = ctx.new_page(); errs = []
            page.on("pageerror", lambda e: errs.append(str(e)[:150]))
            page.goto(f"{SITE}/{pg}", wait_until="load"); page.wait_for_timeout(2500 if db else 600)
            snaps[db] = page.evaluate(SNAP); snaps[str(db) + 'err'] = [e for e in errs if 'createClient' not in e]
            ctx.close()
        d = [l for l in difflib.unified_diff(snaps[False], snaps[True], lineterm="", n=0) if l[:1] in "+-" and not l.startswith(("+++", "---"))]
        res[pg] = {"diff": d, "errors": snaps['Trueerr']}
        print(f"{pg:22} {len(d):3} changed lines  js-errors={len(snaps['Trueerr'])}")
        for l in d[:40]: print("     ", l[:200])
    b.close()
json.dump(res, open(os.path.join(ROOT, "tests/cms/db_vs_static.json"), "w"), indent=1, ensure_ascii=False)
