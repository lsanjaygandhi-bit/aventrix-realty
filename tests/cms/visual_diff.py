#!/usr/bin/env python3
"""
Visual regression: every public page, before (previous build + current DB)
vs after (this build + migrated DB), full-page screenshots at phone and
desktop widths, animations and the hero video frozen. Reports the share of
changed pixels and saves side-by-side images for any page that changed.
Needs /tmp/srv_pair.sh (before :8081/:3001, after :8080/:3000).
"""
import os, sys, glob, json
from playwright.sync_api import sync_playwright
from PIL import Image, ImageChops
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/vdiff"; os.makedirs(OUT, exist_ok=True)
REF = "gkrtjeygrqkglsadskcg"
UMD = open("/tmp/sbjs/node_modules/@supabase/supabase-js/dist/umd/supabase.js").read()
FA = "/tmp/fa/node_modules/@fortawesome/fontawesome-free"
pages = [os.path.basename(p) for p in sorted(glob.glob(os.path.join(ROOT, "*.html")))]
pages = [p for p in pages if p not in ("terms.html", "sitemap.html")]  # new pages: no "before"
if os.environ.get("VD_PAGES"): pages = os.environ["VD_PAGES"].split(",")
FREEZE = "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important} video{visibility:hidden!important}"
def ctx_for(b, site, rest, w):
    ctx = b.new_context(viewport={"width": w, "height": 900}, device_scale_factor=1, is_mobile=w < 500, has_touch=w < 500)
    ctx.add_init_script("Math.random = () => 0.42; try{localStorage.clear()}catch(e){}")
    def handle(route):
        u = route.request.url
        if "supabase-js" in u: return route.fulfill(status=200, content_type="application/javascript", body=UMD)
        if "font-awesome" in u and u.endswith(".css"):
            return route.fulfill(status=200, content_type="text/css", body=open(FA + "/css/all.min.css").read().replace("../webfonts/", "https://fa.local/webfonts/"))
        if u.startswith("https://fa.local/webfonts/"):
            return route.fulfill(status=200, body=open(FA + "/webfonts/" + u.rsplit("/", 1)[1], "rb").read())
        if f"{REF}.supabase.co/rest/v1" in u:
            h = {k: v for k, v in route.request.headers.items() if k.lower() in ("content-type", "prefer", "accept", "range", "accept-profile", "origin")}
            return route.fulfill(response=route.fetch(url=rest + u.split("/rest/v1", 1)[1], headers=h))
        if f"{REF}.supabase.co/auth" in u: return route.fulfill(status=200, content_type="application/json", body="{}")
        if u.startswith(site) or u.startswith("data:"): return route.continue_()
        return route.abort()
    ctx.route("**/*", handle)
    return ctx
res = {}
with sync_playwright() as p:
    b = p.chromium.launch()
    for w in (390, 1280):
        for pg in pages:
            shots = []
            for site, rest, tag in (("http://localhost:8081", "http://localhost:3001", "before"), ("http://localhost:8080", "http://localhost:3000", "after")):
                ctx = ctx_for(b, site, rest, w); page = ctx.new_page()
                page.goto(f"{site}/{pg}", wait_until="load"); page.add_style_tag(content=FREEZE); page.wait_for_timeout(3000)
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)"); page.wait_for_timeout(600); page.evaluate("window.scrollTo(0,0)"); page.wait_for_timeout(400)
                fn = f"{OUT}/{w}-{pg.replace('?','_').replace('=','_')}-{tag}.png"; page.screenshot(path=fn, full_page=True); shots.append(fn); ctx.close()
            a, c = Image.open(shots[0]).convert("RGB"), Image.open(shots[1]).convert("RGB")
            hmax = max(a.height, c.height)
            A = Image.new("RGB", (w, hmax), "white"); A.paste(a, (0, 0)); C = Image.new("RGB", (w, hmax), "white"); C.paste(c, (0, 0))
            diff = ImageChops.difference(A, C).convert("L").point(lambda v: 255 if v > 24 else 0)
            changed = sum(diff.histogram()[255:]) / (w * hmax) * 100
            bbox = diff.getbbox()
            res[f"{w} {pg}"] = {"changed_pct": round(changed, 3), "h_before": a.height, "h_after": c.height, "bbox": bbox}
            print(f"{w:5} {pg:22} changed {changed:6.2f}%  height {a.height}->{c.height}  bbox {bbox}", flush=True)
            if changed > 0.01:
                side = Image.new("RGB", (w * 3 + 20, hmax), "white"); side.paste(A, (0, 0)); side.paste(C, (w + 10, 0))
                side.paste(Image.merge("RGB", (diff, Image.new("L", diff.size, 0), Image.new("L", diff.size, 0))), (2 * w + 20, 0))
                side.save(f"{OUT}/DIFF-{w}-{pg.replace('?','_').replace('=','_')}.png")
    b.close()
json.dump(res, open(f"{OUT}/visual_diff.json", "w"), indent=1)
