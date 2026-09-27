#!/usr/bin/env python3
"""
ADMIN CMS ROUND-TRIP TESTS (local stack, real Admin UI in Chromium)

For every page in Admin → Website Content:
  read   the form shows the database values (no blank field where the page has content)
  edit   one value in every section (text input, textarea or Quill), plus hero and SEO
  save   Save & Publish, then check the database row
  reload re-open the Admin page and check the edited values are shown
  public open the public page and check each edited value is rendered in its section
Plus: list add / reorder / remove (FAQ accordion still works), Homepage hero
(site_settings), Site Settings (footer + social + RERA, and hero untouched),
Office Locations (footer/contact everywhere, non-embeddable map link),
Our Realtors (founder profile pages), the "Our Legacy" shortcut, and no JS errors.

Stack: Postgres DB $CMS_DB (default aventrix_cms) → PostgREST :3000 → site :8080.
"""
import json, os, sys, time, subprocess, jwt, re
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SITE, REST, REF = "http://localhost:8080", "http://localhost:3000", "gkrtjeygrqkglsadskcg"
SECRET = "local-test-secret-local-test-secret-32b"
DB = os.environ.get("CMS_DB", "aventrix_cms")
UMD = open("/tmp/sbjs/node_modules/@supabase/supabase-js/dist/umd/supabase.js").read()
QUILL_JS = open("/tmp/quill/node_modules/quill/dist/quill.min.js").read()
QUILL_CSS = open("/tmp/quill/node_modules/quill/dist/quill.snow.css").read()
ADMIN = "00000000-0000-0000-0000-00000000000a"
results = []

def check(name, cond, info=""):
    results.append((name, bool(cond), str(info)[:300]))
    print(("PASS " if cond else "FAIL ") + name + ("" if cond else f"   -> {str(info)[:300]}"), flush=True)

def sql(q):
    return subprocess.run(["psql", "-X", "-tA", "-d", DB, "-c", q], capture_output=True, text=True).stdout.strip()

def session(uid):
    now = int(time.time())
    tok = jwt.encode({"sub": uid, "role": "authenticated", "aud": "authenticated", "exp": now + 7200, "iat": now, "email": "admin@aventrix.test"}, SECRET, algorithm="HS256")
    user = {"id": uid, "aud": "authenticated", "role": "authenticated", "email": "admin@aventrix.test", "user_metadata": {}, "app_metadata": {}}
    return {"access_token": tok, "refresh_token": "r", "token_type": "bearer", "expires_in": 7200, "expires_at": now + 7200, "user": user}

def make_ctx(browser, uid=None, width=1366):
    ctx = browser.new_context(viewport={"width": width, "height": 900})
    if uid:
        ctx.add_init_script(f"try {{ localStorage.setItem('sb-{REF}-auth-token', {json.dumps(json.dumps(session(uid)))}); }} catch (e) {{}}")
    ctx.add_init_script("window.confirm = () => true; window.alert = () => {};")
    def handle(route):
        u = route.request.url
        if "supabase-js" in u: return route.fulfill(status=200, content_type="application/javascript", body=UMD)
        if "quill.min.js" in u: return route.fulfill(status=200, content_type="application/javascript", body=QUILL_JS)
        if "quill.snow" in u: return route.fulfill(status=200, content_type="text/css", body=QUILL_CSS)
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

PAGES = [("home", "index.html"), ("about", "about.html"), ("services", "services.html"), ("properties", "properties.html"),
         ("list-with-us", "list-with-us.html"), ("free-valuation", "free-valuation.html"), ("joint-venture", "joint-venture.html"),
         ("nri-services", "nri-services.html"), ("brokerage-fees", "brokerage-fees.html"), ("our-realtors", "our-realtors.html"),
         ("gnanasekaran", "gnanasekaran.html"), ("sanjay", "sanjay.html"), ("insights", "insights.html"), ("contact", "contact.html"),
         ("enquiry", "enquiry.html"), ("privacy-policy", "privacy-policy.html"), ("terms", "terms.html"), ("sitemap", "sitemap.html")]
# sections that render on another page than their row
RENDERED_ON = {("home", "about-legacy"): ["about.html"], ("home", "leadership-intro"): ["index.html", "about.html"]}

def page_row(key):
    return json.loads(sql(f"select to_jsonb(p) from pages p where page_key='{key}'") or "null")

def open_admin(page, section="content"):
    page.goto(SITE + "/admin/dashboard.html", wait_until="load")
    page.wait_for_selector("#adminNav a[data-section='content']", timeout=10000)
    page.wait_for_timeout(800)
    page.locator(f'#adminNav a[data-section="{section}"]').click(); page.wait_for_timeout(500)

def open_content_page(page, key):
    page.select_option("#pageContentSelect", key)
    page.wait_for_selector("#pageContentForm", state="visible", timeout=10000)
    page.wait_for_timeout(700)

def run():
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = make_ctx(b, ADMIN); page = ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)[:200]))
        open_admin(page)
        check("admin: Website Content lists every public page", page.locator("#pageContentSelect option").count() == len(PAGES) + 1,
              page.locator("#pageContentSelect option").count())

        edits = {}   # (page_key, section_key) -> marker
        for n, (key, url) in enumerate(PAGES):
            row = page_row(key)
            if not row:
                check(f"read {key}: row exists", False, "no pages row"); continue
            open_content_page(page, key)
            # ---- READ: every input shows its DB value (no blank field where the DB has content)
            blank_inputs = page.evaluate("""() => Array.from(document.querySelectorAll('#pcSectionsList input[type=text], #pcSectionsList textarea'))
                .filter(e => e.offsetParent && !e.value.trim()).map(e => ({s: +e.dataset.s, k: e.dataset.k, f: e.dataset.f, l: e.dataset.l, i: e.dataset.i, itf: e.dataset.if}))""")
            secs = sorted(row["sections"], key=lambda x: x.get("display_order") or 0)
            def db_val(b):
                sec = secs[b["s"]]
                if b.get("k"): return sec.get(b["k"]) or ""
                if b.get("f"): return (sec.get("fields") or {}).get(b["f"]) or ""
                return ((sec.get("lists") or {}).get(b["l"]) or [{}])[int(b["i"])].get(b["itf"]) or ""
            # a blank input is only a problem when the database holds a value for it
            blanks = [f"{secs[b['s']]['key']}:{b.get('k') or b.get('f') or b.get('itf')}" for b in blank_inputs if str(db_val(b)).strip()]
            nsec = page.locator(".pc-section-block").count()
            check(f"read {key}: all {len(row['sections'])} sections shown, no blank field with page content", nsec == len(row["sections"]) and not blanks, f"sections {nsec}/{len(row['sections'])} blanks {blanks[:6]}")
            if key != "home":
                check(f"read {key}: hero/SEO fields show DB values",
                      page.input_value("#pcHeroTitle") == (row["hero_title"] or "") and page.input_value("#pcSeoTitle") == (row["seo_title"] or ""),
                      (page.input_value("#pcHeroTitle"), row["hero_title"]))

            # ---- EDIT: one value per section + hero + SEO
            marker_seo = f"E2E SEO {key}"
            page.fill("#pcSeoTitle", marker_seo)
            hero_marker = None
            if key != "home" and row.get("hero_title"):
                hero_marker = f"E2E Hero {n}"
                page.fill("#pcHeroTitle", hero_marker)
            for si, s in enumerate(sorted(row["sections"], key=lambda x: x.get("display_order") or 0)):
                marker = f"E2E-{n}-{si}"
                blk = page.locator(f'.pc-section-block[data-si="{si}"]')
                target = None
                for sel in ['input[data-k="heading"]', 'input[data-f]', 'textarea[data-f]', 'input[data-if]', 'textarea[data-if]', 'textarea[data-k="html"]', 'input[data-k="eyebrow"]']:
                    loc = blk.locator(sel)
                    if loc.count():
                        target = loc.first; break
                if target is not None:
                    cur = target.input_value()
                    if cur.strip().startswith("<"):
                        # HTML value: add the marker inside the first element's text
                        new = re.sub(r"(<[a-z0-9]+[^>]*>)", r"\1" + marker + " ", cur, count=1)
                    else:
                        new = marker + " " + cur
                    target.fill(new)
                    edits[(key, s["key"])] = marker
                elif blk.locator(".ql-editor").count():
                    blk.locator(".ql-editor").first.click()
                    page.keyboard.press("Control+Home"); page.keyboard.type(marker + " ")
                    edits[(key, s["key"])] = marker
            page.click("#savePageContentBtn"); page.wait_for_timeout(1500)
            row2 = page_row(key)
            saved = json.dumps(row2, ensure_ascii=False)
            missing = [m for (k, sk), m in edits.items() if k == key and m not in saved]
            check(f"save {key}: every edit stored in the database", not missing and row2["seo_title"] == marker_seo and (not hero_marker or row2["hero_title"] == hero_marker), missing[:5])
            # unchanged content must survive the round trip through the form (nothing dropped)
            lost = [s["key"] for s in row["sections"] if len(json.dumps(s)) > 30 and not any(x["key"] == s["key"] for x in row2["sections"])]
            old_items = sum(len(v) for s in row["sections"] for v in (s.get("lists") or {}).values())
            new_items = sum(len(v) for s in row2["sections"] for v in (s.get("lists") or {}).values())
            check(f"save {key}: no section or list item lost ({old_items} items)", not lost and old_items == new_items, (lost, old_items, new_items))

            # ---- RELOAD admin and re-read
            page.reload(wait_until="load"); page.wait_for_timeout(1200)
            page.locator('#adminNav a[data-section="content"]').click(); page.wait_for_timeout(400)
            open_content_page(page, key)
            form_txt = page.evaluate("""() => Array.from(document.querySelectorAll('#pageContentForm input, #pageContentForm textarea')).map(e => e.value).join(' ') + ' ' +
                Array.from(document.querySelectorAll('#pageContentForm .ql-editor')).map(e => e.innerText).join(' ')""")
            miss2 = [m for (k, sk), m in edits.items() if k == key and m not in form_txt]
            check(f"reload {key}: edited values shown in Admin after reload", not miss2 and marker_seo in form_txt, miss2[:5])

        # ---- PUBLIC rendering of every edit
        pub = make_ctx(b); pp = pub.new_page(); perrs = []
        pp.on("pageerror", lambda e: perrs.append(str(e)[:200]))
        for key, url in PAGES:
            row = page_row(key)
            pp.goto(f"{SITE}/{url}", wait_until="load"); pp.wait_for_timeout(2500)
            title = pp.title()
            check(f"public {url}: SEO title from Admin", title == f"E2E SEO {key}" or key in ("gnanasekaran", "sanjay") and title == f"E2E SEO {key}", title)
            og = pp.evaluate("(document.querySelector('meta[property=\"og:title\"]')||{}).content")
            if og is not None:
                check(f"public {url}: og:title follows SEO title", og == f"E2E SEO {key}", og)
            if key != "home" and row.get("hero_title", "").startswith("E2E Hero"):
                h = pp.evaluate("(document.querySelector('[data-page-hero-title]')||{}).textContent || ''")
                check(f"public {url}: hero title from Admin", row["hero_title"] in h, h[:80])
            bad = []
            for (k, sk), m in edits.items():
                if k != key or (k, sk) in RENDERED_ON: continue
                txt = pp.evaluate(f"""() => Array.from(document.querySelectorAll('[data-cms-section="{sk}"]')).map(e => e.innerText + ' ' + e.innerHTML).join(' ')""")
                if m not in txt: bad.append(sk)
            check(f"public {url}: every edited section shows its new text", not bad, bad)
        # the shared leaders list: edit the first leader's bio and check Homepage + About
        open_admin(page); open_content_page(page, "home")
        bio = page.locator('.pc-section-block[data-section-key="leadership-intro"] [data-l="leaders"] [data-if="bio"]').first
        bio.fill("E2E leader bio. " + bio.input_value())
        page.click("#savePageContentBtn"); page.wait_for_timeout(1500)
        edits[("home", "leadership-intro")] = "E2E leader bio."
        for (k, sk), pages_ in RENDERED_ON.items():
            m = edits.get((k, sk))
            for u in pages_:
                pp.goto(f"{SITE}/{u}", wait_until="load"); pp.wait_for_timeout(2500)
                txt = pp.evaluate(f"""() => Array.from(document.querySelectorAll('[data-cms-section="{sk}"]')).map(e => e.innerText + e.innerHTML).join(' ')""")
                check(f"public {u}: {sk} (Homepage row) shows the Admin edit", m and m in txt, (m, txt[:120]))
        check("public: no JS errors on any page", not perrs, perrs[:3])

        # ---- LISTS: add, reorder, remove (Homepage FAQ) and the accordion still works
        open_admin(page); open_content_page(page, "home")
        faq = page.locator('.pc-section-block[data-section-key="faq"] .pc-list')
        before = faq.locator(".pc-list-item").count()
        faq.locator(".pc-item-add").click(); page.wait_for_timeout(300)
        faq = page.locator('.pc-section-block[data-section-key="faq"] .pc-list')
        last = faq.locator(".pc-list-item").last
        last.locator('[data-if="question"]').fill("E2E new question?")
        last.locator('[data-if="answer"]').fill("<p>E2E new answer.</p>")
        last.locator(".pc-item-up").click(); page.wait_for_timeout(300)                          # move up one place
        page.locator('.pc-section-block[data-section-key="faq"] .pc-list .pc-list-item').first.locator(".pc-item-remove").click(); page.wait_for_timeout(300)  # remove the first
        page.click("#savePageContentBtn"); page.wait_for_timeout(1500)
        faqs = json.loads(sql("select s->'lists'->'faqs' from pages, jsonb_array_elements(sections) s where page_key='home' and s->>'key'='faq'"))
        qs = [re.sub('<[^>]+>', '', f["question"]) for f in faqs]
        check("lists: add + move up + remove saved in the right order", len(faqs) == before and qs[-2].startswith("E2E new question"), qs)
        pp.goto(f"{SITE}/index.html", wait_until="load"); pp.wait_for_timeout(2500)
        pub_qs = pp.evaluate("Array.from(document.querySelectorAll('#faqList .faq-question span')).map(e => e.textContent.trim())")
        check("lists: public FAQ shows the same questions in the same order", [q.strip() for q in pub_qs] == [q.strip() for q in qs], (pub_qs, qs))
        item = pp.locator("#faqList .faq-item").nth(len(qs) - 2)
        item.locator(".faq-question").click(); pp.wait_for_timeout(500)
        check("lists: FAQ accordion opens the new question after the CMS render",
              item.evaluate("e => e.classList.contains('active') || e.querySelector('.faq-question').getAttribute('aria-expanded') === 'true'"),
              item.evaluate("e => e.outerHTML.slice(0, 200)"))

        # ---- Homepage hero (site_settings) edited in Website Content → Homepage
        open_admin(page); open_content_page(page, "home")
        page.fill("#pcSsHeroTitle", "E2E Hero Title"); page.fill("#pcSsHeroSubtitle", "E2E hero subtitle")
        page.fill("#pcHeroButtonText", "E2E Post <span>FREE</span>")
        page.click("#savePageContentBtn"); page.wait_for_timeout(1500)
        check("home hero: title/subtitle saved to site_settings", sql("select hero_title||'|'||hero_subtitle from site_settings where id=1") == "E2E Hero Title|E2E hero subtitle")
        pp.goto(f"{SITE}/index.html", wait_until="load"); pp.wait_for_timeout(2500)
        check("home hero: public hero shows Admin title and button",
              pp.inner_text("#heroTitle") == "E2E Hero Title" and "E2E Post" in pp.inner_text(".home-app-hero-post-btn"),
              (pp.inner_text("#heroTitle"), pp.inner_text(".home-app-hero-post-btn")))

        # ---- Site Settings: footer, social, RERA — and it must not touch the hero
        page.locator('#adminNav a[data-section="settings"]').click(); page.wait_for_timeout(1200)
        page.fill("#setFooterTagline", "E2E footer tagline"); page.fill("#setSocialInstagram", "https://www.instagram.com/e2e-test")
        page.fill("#setReraNo", "TN/Agent/E2E/2026")
        page.click("#saveSettingsBtn"); page.wait_for_timeout(1500)
        check("settings: saved, hero left untouched", sql("select footer_tagline||'|'||hero_title from site_settings where id=1") == "E2E footer tagline|E2E Hero Title")
        for u in ("about.html", "properties.html", "terms.html"):
            pp.goto(f"{SITE}/{u}", wait_until="load")
            try: pp.wait_for_function("(document.querySelector(\"[data-site='footer-tagline']\")||{}).textContent === 'E2E footer tagline'", timeout=8000)
            except Exception: pass
            vals = pp.evaluate("Array.from(document.querySelectorAll(\"[data-site='footer-tagline'],[data-site='social-instagram']\")).map(e => e.getAttribute('href') || e.textContent.trim())")
            check(f"settings: footer tagline + Instagram (footer and menu) on {u}",
                  vals and all(v in ("E2E footer tagline", "https://www.instagram.com/e2e-test") for v in vals), vals)
        pp.goto(f"{SITE}/sanjay.html", wait_until="load"); pp.wait_for_timeout(2200)
        check("settings: RERA number on Sanjay's profile", pp.inner_text("[data-site='rera-no']") == "TN/Agent/E2E/2026")
        pp.goto(f"{SITE}/index.html", wait_until="load"); pp.wait_for_timeout(2200)
        check("settings: header phone link has +91", (pp.get_attribute(".nav-phone", "href") or "").startswith("tel:+91"), pp.get_attribute(".nav-phone", "href"))

        # ---- Office Locations: head office details everywhere, map embed guard
        hid = sql("select id from office_locations where is_head_office limit 1")
        sql(f"update office_locations set phone='+91 90000 11111, +91 90000 22222', email='e2e-office@example.com', maps_embed_url='https://maps.app.goo.gl/abc' where id='{hid}'")
        for u in ("services.html", "index.html", "contact.html"):
            pp.goto(f"{SITE}/{u}", wait_until="load"); pp.wait_for_timeout(2500)
            foot = pp.inner_text(".pf-office-block")
            check(f"offices: footer head-office phones/email from Admin on {u}", "+91 90000 11111" in foot and "+91 90000 22222" in foot and "e2e-office@example.com" in foot, foot[:200])
            if u == "index.html":
                qe = pp.inner_text(".quick-enquiry-details")
                check("offices: homepage Quick Enquiry phones/email from Admin", "+91 90000 11111" in qe and "e2e-office@example.com" in qe, qe)
            if u == "contact.html":
                src = pp.evaluate("Array.from(document.querySelectorAll('[data-offices-grid=\"map\"] iframe')).map(f => f.src)")
                check("offices: share link isn't used as a map embed (address map instead)", src and all("output=embed" in s for s in src), src)
                qc = pp.inner_text('[data-cms-section="contact-hours"]')
                check("offices: Contact quick-contact phones from Admin", "+91 90000 11111" in qc, qc)

        # ---- Realtors → founder profile pages
        gid = sql("select id from realtors where slug='gnanasekaran-p'")
        sql(f"""update realtors set about='E2E about para one.\n\nE2E about para two.', experience='E2E 16+ Years', expertise='{{"E2E Skill A","E2E Skill B"}}', languages='{{"English","E2E Lang"}}' where id='{gid}'""")
        pp.goto(f"{SITE}/gnanasekaran.html", wait_until="load"); pp.wait_for_timeout(2500)
        body = pp.inner_text(".profile-container")
        check("realtors: founder page About/Experience/Expertise/Languages from Admin",
              "E2E about para one." in body and "E2E about para two." in body and "E2E 16+ Years" in body and "E2E Skill B" in body and "E2E Lang" in body, body[:300])
        check("realtors: About paragraphs keep the page style", pp.locator("[data-realtor-about] p.profile-body-text").count() == 2)

        # ---- Our Legacy shortcut
        open_admin(page, "legacy"); page.wait_for_timeout(1200)
        check("legacy: sidebar opens Homepage editor at Our Legacy",
              page.locator("#section-content").is_visible() and page.locator('.pc-section-block[data-section-key="about-legacy"].pc-section-focus').count() == 1)
        check("legacy: timeline edited as structured fields (no Quill, no raw layout HTML)",
              page.locator('.pc-section-block[data-section-key="about-legacy"] [data-l="timeline"] .pc-list-item').count() == 3 and
              page.locator('.pc-section-block[data-section-key="about-legacy"] .ql-editor').count() == 0)

        check("admin: no JS errors", not errs, errs[:3])
        ctx.close(); pub.close(); b.close()
    ok = sum(1 for r in results if r[1]); print(f"\n{ok}/{len(results)} passed")
    json.dump(results, open(os.path.join(ROOT, "tests/cms/admin_cms_e2e.json"), "w"), indent=1)
    sys.exit(0 if ok == len(results) else 1)

if __name__ == "__main__":
    run()
