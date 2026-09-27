#!/usr/bin/env python3
"""
CMS fidelity check (offline): for each page, read the static content with
tests/cms/extract.js, then apply that content back through the real
js/public-page-content.js (window.AventrixCMS.applyPage) and compare every
[data-cms-section] before/after. Identical = the seed built from this page
reproduces the page exactly. Writes the extracted rows to tests/cms/extracted/.

Usage: fidelity.py [page.html ...]   (default: every page with data-page-key)
"""
import json, os, sys, glob, re
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SITE = "http://localhost:8080"
EXTRACT = open(os.path.join(ROOT, "tests/cms/extract.js")).read()
OUT = os.path.join(ROOT, "tests/cms/extracted"); os.makedirs(OUT, exist_ok=True)
pages = sys.argv[1:] or sorted(os.path.basename(p) for p in glob.glob(os.path.join(ROOT, "*.html")) if 'data-page-key=' in open(p).read())
SNAP = r"""() => { const B = '(?:p|h[1-6]|div|li|ul|ol|section|button|a|span|dd|dt|td|th|label)';
  const norm = (h) => h.replace(/\s+/g, ' ').replace(/> </g, '><').replace(new RegExp('(<' + B + '\\b[^>]*>) ', 'g'), '$1').replace(new RegExp(' (</' + B + '>)', 'g'), '$1').trim();
  const out = {}; document.querySelectorAll('[data-cms-section]').forEach((w, i) => { out[i + ':' + w.getAttribute('data-cms-section')] = norm(w.outerHTML); });
  document.querySelectorAll('[data-page-hero-eyebrow],[data-page-hero-title],[data-page-hero-subtitle],[data-page-hero-button],[data-page-hero-image]').forEach((e, i) => { out['hero' + i] = norm(e.outerHTML); });
  return out; }"""
bad = 0
with sync_playwright() as p:
    b = p.chromium.launch()
    for pg in pages:
        ctx = b.new_context()
        ctx.route("**/*", lambda r: r.continue_() if r.request.url.startswith(SITE) else r.abort())
        page = ctx.new_page(); errs = []
        page.on("pageerror", lambda e: None if "createClient" in str(e) else errs.append(str(e)[:200]))
        page.goto(f"{SITE}/{pg}", wait_until="load"); page.wait_for_timeout(300)
        row = page.evaluate(EXTRACT)
        before = page.evaluate(SNAP)
        ok = page.evaluate("typeof window.AventrixCMS === 'object'")
        if not ok:
            page.add_script_tag(url=f"{SITE}/js/public-page-content.js")
        own = {**row["hero"], "page_key": row["page_key"], "sections": [s for s in row["sections"] if "__page" not in s]}
        page.evaluate("(r) => window.AventrixCMS.applyPage(r, document, {seo:false})", own)
        for s in [s for s in row["sections"] if "__page" in s]:
            page.evaluate("(r) => window.AventrixCMS.applyPage(r, document, {seo:false, sectionsOnly:true})", {"page_key": s["__page"], "sections": [s]})
        after = page.evaluate(SNAP)
        diffs = [k for k in before if before[k] != after.get(k)]
        n = len(row["sections"]); nl = sum(len(v) for s in row["sections"] for v in (s.get("lists") or {}).values())
        print(f"{'OK  ' if not diffs and not errs else 'DIFF'} {pg:22} sections={n:3} list-items={nl:3} hero={len(row['hero'])} {diffs[:3]} {errs[:2]}")
        if diffs:
            bad += 1
            for k in diffs[:2]:
                a, c = before[k], after.get(k, "")
                i = next((i for i in range(min(len(a), len(c))) if a[i] != c[i]), min(len(a), len(c)))
                print("   before:", a[max(0, i-120):i+160]); print("   after: ", c[max(0, i-120):i+160])
        json.dump(row, open(os.path.join(OUT, pg.replace(".html", ".json")), "w"), indent=1, ensure_ascii=False)
        ctx.close()
    b.close()
sys.exit(1 if bad else 0)
