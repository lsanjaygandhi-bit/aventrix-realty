#!/usr/bin/env python3
"""
Responsive probe for every public page at 10 widths (320–1440):
  * no horizontal page overflow
  * at the end of the page, the floating WhatsApp / Back-to-top buttons do
    not cover any link, button, form field or map in the footer
  * no JS errors
Uses the local stack (site :8080, PostgREST :3000).
"""
import os, sys, glob, json
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SITE, REST, REF = "http://localhost:8080", "http://localhost:3000", "gkrtjeygrqkglsadskcg"
UMD = open("/tmp/sbjs/node_modules/@supabase/supabase-js/dist/umd/supabase.js").read()
WIDTHS = [320, 360, 375, 390, 414, 430, 768, 1024, 1280, 1440]
pages = sys.argv[1:] or [os.path.basename(p) for p in sorted(glob.glob(os.path.join(ROOT, "*.html")))]
PROBE = r"""() => {
  const W = innerWidth, overflow = document.documentElement.scrollWidth > W + 1;
  const floats = ['.whatsapp-float', '.back-to-top.show'].map(s => document.querySelector(s))
     .filter(e => e && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).display !== 'none' && getComputedStyle(e).opacity !== '0')
     .map(e => e.getBoundingClientRect());
  const hits = [];
  document.querySelectorAll('footer a, footer button, footer iframe, footer input, .premium-footer-bottom *').forEach(el => {
    if (!el.offsetParent && el.tagName !== 'IFRAME') return;
    const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > innerHeight) return;
    for (const f of floats) {
      const ix = Math.min(f.right, r.right) - Math.max(f.left, r.left), iy = Math.min(f.bottom, r.bottom) - Math.max(f.top, r.top);
      if (ix > 1 && iy > 1) hits.push((el.tagName + ' ' + (el.textContent || el.title || '').trim()).slice(0, 40) + (el.tagName === 'IFRAME' ? ` (${Math.round(ix*iy/(r.width*r.height)*100)}% of map)` : ''));
    }
  });
  return {overflow, floats: floats.length, hits: [...new Set(hits)]};
}"""
out = {}; fails = 0
with sync_playwright() as p:
    b = p.chromium.launch()
    for w in WIDTHS:
        ctx = b.new_context(viewport={"width": w, "height": 900 if w < 700 else 1000}, is_mobile=w <= 430, has_touch=w <= 1024)
        def handle(route):
            u = route.request.url
            if "supabase-js" in u: return route.fulfill(status=200, content_type="application/javascript", body=UMD)
            if f"{REF}.supabase.co/rest/v1" in u:
                h = {k: v for k, v in route.request.headers.items() if k.lower() in ("content-type", "prefer", "accept", "range", "accept-profile", "origin")}
                return route.fulfill(response=route.fetch(url=REST + u.split("/rest/v1", 1)[1], headers=h))
            if f"{REF}.supabase.co/auth" in u: return route.fulfill(status=200, content_type="application/json", body="{}")
            if u.startswith(SITE) or u.startswith("data:"): return route.continue_()
            return route.abort()
        ctx.route("**/*", handle)
        page = ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)[:150]))
        for pg in pages:
            errs.clear()
            page.goto(f"{SITE}/{pg}", wait_until="load"); page.wait_for_timeout(1800)
            page.evaluate("window.scrollTo(0, document.documentElement.scrollHeight)"); page.wait_for_timeout(900)
            r = page.evaluate(PROBE); r["errors"] = errs[:]
            real_hits = [h for h in r["hits"] if not h.startswith("IFRAME")]
            bad = r["overflow"] or real_hits or r["errors"]
            fails += 1 if bad else 0
            out[f"{w} {pg}"] = r
            if bad or r["hits"]:
                print(f"{'FAIL' if bad else 'note'} {w:5} {pg:22} overflow={r['overflow']} covered={r['hits']} errors={r['errors']}", flush=True)
        ctx.close()
    b.close()
json.dump(out, open("/tmp/responsive_probe.json", "w"), indent=1)
print(f"{len(out)} page/width combinations checked, {fails} with problems")
sys.exit(1 if fails else 0)
