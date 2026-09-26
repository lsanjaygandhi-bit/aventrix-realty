#!/usr/bin/env python3
"""
AVENTRIX REALTY — END-TO-END BROWSER TESTS (local stack)

Real Chromium + the site's real JS + real supabase-js, talking to a
local PostgREST over a Postgres database that reproduces the LIVE
schema/policies and has both 2026-09-25 migrations applied.

  https://gkrtjeygrqkglsadskcg.supabase.co/rest/v1/*  → localhost:3000
  /auth/v1/*                                          → small mock (sessions are JWTs we sign)
  supabase-js CDN                                     → local npm copy
  other CDNs (fonts/icons)                            → aborted (offline sandbox)

Run: tests/run-browser-tests.sh
"""
import json, sys, time, jwt, subprocess
from playwright.sync_api import sync_playwright

SITE = "http://localhost:8080"
REST = "http://localhost:3000"
SECRET = "local-test-secret-local-test-secret-32b"
REF = "gkrtjeygrqkglsadskcg"
UMD = open("/tmp/sbjs/node_modules/@supabase/supabase-js/dist/umd/supabase.js").read()
ADMIN, BUYER, REALTOR = ("00000000-0000-0000-0000-00000000000" + c for c in "abc")
EMAILS = {ADMIN: "admin@aventrix.test", BUYER: "buyer@example.test", REALTOR: "realtor@aventrix.test"}

results = []
def check(name, cond, info=""):
    results.append(bool(cond))
    print(("PASS " if cond else "FAIL ") + name + ("" if cond else f"   -> {info}"))

def sql(q):
    return subprocess.run(["psql", "-X", "-tA", "-d", "aventrix_test", "-c", q], capture_output=True, text=True).stdout.strip()

def token(uid):
    now = int(time.time())
    return jwt.encode({"sub": uid, "role": "authenticated", "aud": "authenticated", "exp": now + 3600, "iat": now,
                       "email": EMAILS[uid]}, SECRET, algorithm="HS256")

def user_obj(uid):
    return {"id": uid, "aud": "authenticated", "role": "authenticated", "email": EMAILS[uid],
            "user_metadata": {"full_name": "Test " + ("Admin" if uid == ADMIN else "Buyer")}, "app_metadata": {}}

def session(uid):
    return {"access_token": token(uid), "refresh_token": "r", "token_type": "bearer", "expires_in": 3600,
            "expires_at": int(time.time()) + 3600, "user": user_obj(uid)}

def make_context(browser, uid=None, mobile=False, supabase_down=False):
    ctx = browser.new_context(viewport={"width": 390, "height": 844} if mobile else {"width": 1366, "height": 900},
                              is_mobile=mobile, has_touch=mobile)
    if uid:
        ctx.add_init_script(f"try {{ localStorage.setItem('sb-{REF}-auth-token', {json.dumps(json.dumps(session(uid)))}); }} catch (e) {{}}")
    ctx.add_init_script("window.prompt = () => 'My Test Search'; window.confirm = () => true; window.alert = (m) => { window.__lastAlert = m; };")

    def handle(route):
        url = route.request.url
        if "cdn.jsdelivr.net/npm/@supabase/supabase-js" in url:
            return route.fulfill(status=200, content_type="application/javascript", body=UMD)
        if f"{REF}.supabase.co" in url and supabase_down:
            return route.abort("connectionrefused")
        if f"{REF}.supabase.co/rest/v1" in url:
            target = REST + url.split("/rest/v1", 1)[1]
            headers = {k: v for k, v in route.request.headers.items() if k.lower() in ("authorization", "content-type", "prefer", "accept", "range", "content-profile", "accept-profile", "origin")}
            # "origin" is forwarded so PostgREST returns the same CORS headers as Supabase
            # (incl. Access-Control-Expose-Headers: Content-Range, needed by count queries).
            if headers.get("authorization", "").lower().startswith("bearer sb_publishable"):
                headers.pop("authorization")  # anon key isn't a JWT locally → anonymous
            resp = route.fetch(url=target, headers=headers)
            return route.fulfill(response=resp)
        if f"{REF}.supabase.co/auth/v1/user" in url:
            return route.fulfill(status=200, content_type="application/json", body=json.dumps(user_obj(uid)) if uid else "{}")
        if f"{REF}.supabase.co/auth/v1/logout" in url:
            return route.fulfill(status=204, body="")
        if url.startswith(SITE) or url.startswith("data:"):
            return route.continue_()
        return route.abort()
    ctx.route("**/*", handle)
    return ctx

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()

        # ---------- ANONYMOUS VISITOR ----------
        ctx = make_context(browser)
        page = ctx.new_page(); errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(SITE + "/properties.html", wait_until="load")
        page.wait_for_selector("#sfResultsGrid .property-card", timeout=10000)
        cards = page.locator("#sfResultsGrid .property-card").count()
        check("anon: properties.html lists only published listings", cards == 3, cards)
        wa = page.locator('.property-card[data-slug="pub-medavakkam-2bhk"] .icon-whatsapp-btn').get_attribute("href")
        check("anon: card WhatsApp message has AVX code + title + location", "AVX-000001" in (wa or "") and "Medavakkam" in (wa or "") and "2%20BHK" in (wa or ""), wa)
        page.locator('.property-card[data-slug="pub-medavakkam-2bhk"] .icon-whatsapp-btn').evaluate("el => { el.removeAttribute('target'); el.addEventListener('click', e => e.preventDefault()); el.click(); }")
        page.wait_for_timeout(700)
        check("anon: WhatsApp click recorded as a real event", sql("select count(*) from property_events where event_type='whatsapp_click'") == "1")
        page.locator("#sfSaveSearchBtn").click(); page.wait_for_timeout(400)
        check("anon: Save search asks visitor to log in", "log in" in page.locator("#sfSaveSearchStatus").inner_text().lower())
        check("anon: no JS errors on properties.html", not errors, errors)

        errors.clear()
        page.goto(SITE + "/property.html?id=pub-medavakkam-2bhk", wait_until="load")
        page.wait_for_function("document.getElementById('pdWhatsappBtn').href.includes('AVX-000001')", timeout=10000)
        page.wait_for_timeout(600)
        check("anon: property page view tracked once", sql("select count(*) from property_events where event_type='view'") == "1")
        page.reload(wait_until="load"); page.wait_for_timeout(1200)
        check("anon: reload does NOT inflate views", sql("select count(*) from property_events where event_type='view'") == "1")
        enq = page.locator("#pdEnquireBtn").get_attribute("href")
        check("anon: enquiry link carries property", enq == "enquiry.html?property=pub-medavakkam-2bhk", enq)
        check("anon: no JS errors on property.html", not errors, errors)

        errors.clear()
        page.goto(SITE + "/enquiry.html?property=pub-medavakkam-2bhk", wait_until="load")
        page.wait_for_selector(".enquiry-property-context", timeout=8000)
        check("anon: enquiry page shows property context", "AVX-000001" in page.locator(".enquiry-property-context").inner_text())
        page.fill('[name="Full Name"]', "Ravi Test"); page.fill('[name="Mobile Number"]', "9876543210")
        page.fill('[name="Message"]', "Is it still available?")
        page.locator("#propertyForm button[type=submit]").click(); page.wait_for_timeout(1500)
        row = sql("select name||'|'||property_code||'|'||lead_stage||'|'||lead_source||'|'||coalesce(submitted_by::text,'anon') from enquiries where name='Ravi Test'")
        check("anon: enquiry saved as lead linked to AVX code", row == "Ravi Test|AVX-000001|NEW|Website|anon", row)
        check("anon: no JS errors on enquiry.html", not errors, errors)

        page.goto(SITE + "/insights.html", wait_until="load"); page.wait_for_timeout(1500)
        links = page.locator("#insightGrid a").evaluate_all("els => els.map(e => e.getAttribute('href'))")
        check("anon: Read More only for articles with a body", links == ["insight.html?id=full-article"], links)
        page.goto(SITE + "/insight.html?id=full-article", wait_until="load")
        page.wait_for_selector("#insight-content:not([hidden])", timeout=8000)
        check("anon: article page renders body", "Real guidance" in page.locator("#insight-body").inner_text())
        page.goto(SITE + "/insight.html?id=empty-article", wait_until="load"); page.wait_for_timeout(1200)
        check("anon: empty article shows 'not available', not a blank page", page.locator("#insight-missing").is_visible())

        page.goto(SITE + "/admin/index.html", wait_until="load")
        check("anon: admin login page loads", page.locator("#adminLoginForm").is_visible())
        ctx.close()

        # ---------- BUYER (customer) ----------
        ctx = make_context(browser, BUYER)
        page = ctx.new_page(); errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(SITE + "/admin/dashboard.html", wait_until="load"); page.wait_for_timeout(2500)
        check("buyer: kicked out of admin dashboard", "index.html" in page.url and "denied=1" in page.url, page.url)
        check("buyer: denial message shown", "access" in page.locator("#adminLoginError").inner_text().lower())

        ctx.close(); ctx = make_context(browser, BUYER); page = ctx.new_page(); errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(SITE + "/account.html", wait_until="load")
        page.wait_for_selector("#acctLoggedInPanel:not([hidden])", timeout=8000)
        check("buyer: dashboard shown, login forms hidden", page.locator("#acctLoginForm").is_hidden())
        page.wait_for_timeout(800)
        check("buyer: Matches prompts to set requirement first", "Set My Requirement" in page.locator("#acctMatches").inner_text())
        page.locator('#acctDashTabs button[data-dtab="requirement"]').click()
        page.select_option("#reqTransaction", "buy")
        page.fill("#reqLocations", "Medavakkam, Velachery")
        page.fill("#reqBudgetMin", "60"); page.fill("#reqBudgetMax", "90")
        page.locator('#reqBhk label:has(input[value="2"])').click()
        page.locator('#reqTypes label:has(input[value="residential"])').click()
        page.check("#reqParking")
        page.locator("#acctRequirementForm button[type=submit]").click()
        page.wait_for_selector(".acct-match-card", timeout=8000)
        first = page.locator(".acct-match-card").first.inner_text()
        check("buyer: requirement saved to DB", sql(f"select budget_min::bigint||'-'||budget_max::bigint||'-'||bhk::text from buyer_requirements where user_id='{BUYER}'") == "6000000-9000000-{2}")
        check("buyer: top match is the 2BHK Medavakkam at 100%", "100% match" in first and "2 BHK Apartment" in first, first)
        check("buyer: lease office excluded for a buyer", page.locator(".acct-match-card:has-text('Office Space')").count() == 0)
        check("buyer: match factors are listed", page.locator(".acct-match-card").first.locator(".acct-factors li").count() == 5)

        page.locator('#acctDashTabs button[data-dtab="profile"]').click(); page.wait_for_timeout(600)
        page.fill("#profPhone", "9876500000"); page.locator("#acctProfileForm button[type=submit]").click(); page.wait_for_timeout(800)
        check("buyer: profile saved", sql(f"select phone from customer_profiles where user_id='{BUYER}'") == "9876500000")

        page.goto(SITE + "/properties.html?location=Medavakkam&beds=2", wait_until="load")
        page.wait_for_selector("#sfResultsGrid .property-card", timeout=8000)
        page.locator("#sfSaveSearchBtn").click(); page.wait_for_timeout(1000)
        check("buyer: search saved with exact filters", sql(f"select name||'|'||query_string from saved_searches where user_id='{BUYER}'") == "My Test Search|location=Medavakkam&beds=2")
        page.locator('.property-card[data-slug="pub-medavakkam-2bhk"] .property-save-btn').click(); page.wait_for_timeout(900)
        check("buyer: wishlist synced to account", sql(f"select count(*) from wishlists where user_id='{BUYER}'") == "1")
        check("buyer: wishlist_add event recorded", sql("select count(*) from property_events where event_type='wishlist_add'") == "1")

        page.goto(SITE + "/enquiry.html", wait_until="load")
        page.fill('[name="Full Name"]', "Buyer Logged In"); page.fill('[name="Mobile Number"]', "9000011111")
        page.fill('[name="Subject"]', "General"); page.fill('[name="Message"]', "Hello")
        page.locator("#propertyForm button[type=submit]").click(); page.wait_for_timeout(1500)
        check("buyer: logged-in enquiry now succeeds (was broken live)", sql(f"select count(*) from enquiries where submitted_by='{BUYER}'") == "1",
              page.evaluate("window.__lastAlert || ''"))
        page.goto(SITE + "/account.html#searches", wait_until="load")
        page.wait_for_selector("#acctSavedSearches li", timeout=8000)
        check("buyer: saved search listed in account", "My Test Search" in page.locator("#acctSavedSearches").inner_text())
        page.locator('#acctDashTabs button[data-dtab="enquiries"]').click()
        page.wait_for_selector("#acctEnquiries li", timeout=8000)
        check("buyer: sees own enquiry only", page.locator("#acctEnquiries li").count() == 1)
        check("buyer: no JS errors across buyer flow", not errors, errors)
        ctx.close()

        # ---------- ADMIN ----------
        ctx = make_context(browser, ADMIN)
        page = ctx.new_page(); errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(SITE + "/admin/dashboard.html", wait_until="load")
        page.wait_for_function("document.getElementById('statLeadsNew').textContent !== '–'", timeout=10000)
        new_leads = page.locator("#statLeadsNew").inner_text()
        check("admin: dashboard shows real new-lead count", new_leads == sql("select count(*) from enquiries where lead_stage='NEW'"), new_leads)
        check("admin: published count matches DB", page.locator("#statPublished").inner_text() == sql("select count(*) from properties where publish_status='Published'"))
        try: page.wait_for_function("document.getElementById('statDraft').textContent !== '–'", timeout=8000)
        except Exception: pass
        drafts_ui, drafts_db = page.locator("#statDraft").inner_text(), sql("select count(*) from properties where publish_status='Draft'")
        check("admin: Drafts card (kept from original dashboard) matches DB", drafts_ui == drafts_db, f"ui={drafts_ui!r} db={drafts_db!r}")
        page.wait_for_selector("#overviewPerformance .ov-perf-list li", timeout=8000)
        check("admin: Most Viewed lists the viewed property", "2 BHK Apartment" in page.locator("#overviewPerformance").inner_text())
        page.locator('#adminNav a[data-section="enquiries"]').click()
        page.wait_for_selector("#enquiriesTableBody tr", timeout=8000)
        check("admin: all leads listed", page.locator("#enquiriesTableBody tr").count() == int(sql("select count(*) from enquiries")))
        page.locator('#enquiriesTableBody tr:has-text("Ravi Test") [data-lead-open]').click()
        page.wait_for_selector("#leadModalOverlay.open", timeout=5000)
        check("admin: lead shows linked property", "AVX-000001" in page.locator("#leadOriginal").inner_text())
        page.select_option("#leadStage", "SITE_VISIT")
        page.fill("#leadFollowDate", time.strftime("%Y-%m-%d")); page.fill("#leadFollowTime", "23:30")
        page.fill("#leadNewNote", "Site visit fixed for Saturday")
        page.locator("#leadLogContactBtn").click(); page.wait_for_timeout(1500)
        r = sql("select lead_stage||'|'||(next_follow_up_at is not null)||'|'||(last_contact_at is not null) from enquiries where name='Ravi Test'")
        check("admin: stage, follow-up and last contact saved", r == "SITE_VISIT|true|true", r)
        check("admin: note saved with author", sql(f"select count(*) from lead_notes where author_id='{ADMIN}'") == "1")
        check("admin: note visible in history", "Site visit fixed" in page.locator("#leadNotesList").inner_text())
        page.locator("#closeLeadModal").click()
        # Add a manual WhatsApp lead
        page.locator("#addLeadBtn").click(); page.wait_for_selector("#leadModalOverlay.open")
        page.fill("#leadName", "WhatsApp Walk-in"); page.fill("#leadPhone", "9111122222")
        page.select_option("#leadSource", "WhatsApp"); page.fill("#leadPropertyCode", "avx-000001")
        page.locator("#leadSaveBtn").click(); page.wait_for_timeout(1500)
        check("admin: manual WhatsApp lead created & linked", sql("select lead_source||'|'||property_code from enquiries where name='WhatsApp Walk-in'") == "WhatsApp|AVX-000001")
        page.locator('#adminNav a[data-section="overview"]').click(); page.wait_for_timeout(1500)
        check("admin: today's follow-up appears on overview", "Ravi Test" in page.locator(".followup-today").inner_text())
        check("admin: WhatsApp source counted", "WhatsApp" in page.locator("#overviewLeadSources").inner_text())
        page.locator('#adminNav a[data-section="offices"]').click(); page.wait_for_timeout(1500)
        check("admin: Office Locations now load (was empty live)", "Head Office" in page.locator("#section-offices").inner_text())
        check("admin: no JS errors in admin", not errors, errors)
        ctx.close()

        # ---------- REALTOR ----------
        sql(f"insert into user_roles(user_id,role) values ('{REALTOR}','realtor') on conflict do nothing")
        sql(f"update enquiries set assigned_to='{REALTOR}' where name='Ravi Test'")
        ctx = make_context(browser, REALTOR)
        page = ctx.new_page(); errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(SITE + "/admin/dashboard.html", wait_until="load")
        page.wait_for_function("document.body.classList.contains('role-realtor')", timeout=10000)
        check("realtor: admin-only menu hidden", page.locator('#adminNav a[data-section="settings"]').is_hidden())
        page.locator('#adminNav a[data-section="enquiries"]').click()
        page.wait_for_selector("#enquiriesTableBody tr", timeout=8000)
        check("realtor: sees only assigned lead", page.locator("#enquiriesTableBody tr").count() == 1)
        check("realtor: no JS errors", not errors, errors)
        ctx.close()

        # ---------- MOBILE smoke ----------
        ctx = make_context(browser, BUYER, mobile=True)
        page = ctx.new_page(); errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(SITE + "/account.html", wait_until="load")
        page.wait_for_selector(".acct-match-card", timeout=8000)
        overflow = page.evaluate("document.documentElement.scrollWidth - window.innerWidth")
        check("mobile: account dashboard has no horizontal overflow", overflow <= 1, overflow)
        box = page.evaluate("(() => { const r = document.getElementById('acctLoggedInPanel').getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right), window.innerWidth]; })()")
        check("mobile: dashboard fully inside the screen", box[0] >= 0 and box[1] <= box[2], box)
        card = page.evaluate("(() => { const r = document.querySelector('.acct-match-card').getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right), window.innerWidth]; })()")
        check("mobile: match card fully inside the screen", card[0] >= 0 and card[1] <= card[2], card)
        page.screenshot(path="/tmp/shot-mobile-account.png", full_page=False)
        page.goto(SITE + "/properties.html", wait_until="load"); page.wait_for_selector(".property-card", timeout=8000)
        overflow = page.evaluate("document.documentElement.scrollWidth - window.innerWidth")
        check("mobile: properties page no horizontal overflow", overflow <= 1, overflow)
        btn = page.evaluate("(() => { const r = document.getElementById('sfSaveSearchBtn').getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right), window.innerWidth]; })()")
        check("mobile: Save-search button inside the screen", btn[0] >= 0 and btn[1] <= btn[2], btn)
        page.locator("#sfSaveSearchBtn").scroll_into_view_if_needed()
        page.screenshot(path="/tmp/shot-mobile-properties.png", full_page=False)
        check("mobile: no JS errors", not errors, errors)
        ctx.close()


        # ---------- SHORTLIST + LOCAL→ACCOUNT MIGRATION ----------
        ctx = make_context(browser)            # starts anonymous
        page = ctx.new_page(); errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(SITE + "/properties.html", wait_until="load")
        page.wait_for_selector('.property-card[data-slug="villa-neelankarai"]', timeout=8000)
        page.locator('.property-card[data-slug="villa-neelankarai"] .icon-shortlist-btn').click()
        page.locator('.property-card[data-slug="villa-neelankarai"] .property-save-btn').click()
        page.wait_for_timeout(500)
        local = page.evaluate("[JSON.parse(localStorage.getItem('aventrix:shortlist')||'[]'), JSON.parse(localStorage.getItem('aventrix:wishlist')||'[]')]")
        check("anon: shortlist + wishlist stored locally", "villa-neelankarai" in local[0] and "villa-neelankarai" in local[1], local)
        page.goto(SITE + "/shortlist.html", wait_until="load"); page.wait_for_timeout(1500)
        check("anon: shortlist page shows the shortlisted property", "3 BHK Villa" in page.locator("body").inner_text())
        # now log in (same browser) → local data must be migrated, not lost
        page.evaluate(f"localStorage.setItem('sb-{REF}-auth-token', {json.dumps(json.dumps(session(BUYER)))})")
        page.goto(SITE + "/shortlist.html", wait_until="load"); page.wait_for_timeout(2000)
        check("login: local shortlist migrated to account", sql(f"select count(*) from shortlists where user_id='{BUYER}' and property_slug='villa-neelankarai'") == "1")
        check("login: local wishlist merged with account wishlist (nothing lost)", sql(f"select count(*) from wishlists where user_id='{BUYER}'") == "2")
        check("login: shortlist page still shows the property", "3 BHK Villa" in page.locator("body").inner_text())
        check("login: local copy kept as fallback (not deleted)", "villa-neelankarai" in page.evaluate("localStorage.getItem('aventrix:shortlist')||''"))
        check("shortlist_add event recorded", sql("select count(*) from property_events where event_type='shortlist_add'") == "1")
        check("shortlist/migration flow: no JS errors", not errors, errors)
        ctx.close()

        # ---------- CONTENT DECISIONS (2026-09-25) ----------
        import glob, os
        public_pages = sorted(os.path.basename(f) for f in glob.glob(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "*.html")))
        leaks = [f for f in public_pages if "admin/index.html" in open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", f)).read()]
        check(f"content: no Admin link in any of {len(public_pages)} public pages (source scan)", not leaks and len(public_pages) >= 22, leaks)
        ctx = make_context(browser)
        page = ctx.new_page(); errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(SITE + "/index.html", wait_until="load"); page.wait_for_timeout(1500)
        check("content: homepage header+footer have no admin link (rendered)", page.locator('a[href*="admin/"]').count() == 0)
        check("content: testimonials section hidden (no genuine testimonials)", page.locator("#testimonials").is_hidden())
        check("content: no seeded testimonial names anywhere on homepage", not any(n in page.content() for n in ["Ramesh Kumar", "Priya Venkatesan", "Arvind Balaji"]))
        sql("insert into testimonials(client_name,client_role,quote,publish_status) values ('Genuine Client','Verified buyer','Real feedback','Published')")
        page.reload(wait_until="load"); page.wait_for_timeout(1500)
        check("content: a genuine Published testimonial makes the section appear", page.locator("#testimonials").is_visible() and "Genuine Client" in page.locator("#testimonialsGrid").inner_text())
        sql("delete from testimonials where client_name='Genuine Client'")
        page.goto(SITE + "/our-realtors.html", wait_until="load"); page.wait_for_timeout(1500)
        grid = page.locator("#realtorsGrid").inner_text()
        check("content: Our Realtors shows CMS data (binding bug fixed)", "L. Sanjay Gandhi" in grid and "Gnanasekaran" not in grid, grid[:200])
        check("content: Sample Realtor not shown on Our Realtors", "Sample Realtor" not in grid)
        page.goto(SITE + "/realtor-profile.html?id=sample-realtor", wait_until="load"); page.wait_for_timeout(1500)
        check("content: Sample Realtor profile URL shows 'not found'", "couldn't find" in page.locator("#realtorProfileContent").inner_text())
        page.goto(SITE + "/admin/index.html", wait_until="load")
        check("content: /admin/ still reachable directly", page.locator("#adminLoginForm").is_visible())
        page.goto(SITE + "/properties.html?location=Nowhereville", wait_until="load")
        page.wait_for_selector("#sfEmptyState:not([hidden])", timeout=8000)
        check("empty state: no-results search shows empty state", page.locator("#sfEmptyState").is_visible() and page.locator("#sfResultsGrid .property-card").count() == 0)
        check("content/empty-state pages: no JS errors", not errors, errors)
        ctx.close()

        # ---------- SUPABASE OUTAGE ----------
        ctx = make_context(browser, supabase_down=True)
        page = ctx.new_page(); errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(SITE + "/index.html", wait_until="load"); page.wait_for_timeout(2500)
        check("outage: homepage still renders", page.locator("header").first.is_visible())
        check("outage: no placeholder testimonials appear", page.locator("#testimonials").is_hidden())
        page.goto(SITE + "/properties.html", wait_until="load")
        page.wait_for_selector("#sfErrorState:not([hidden])", timeout=10000)
        check("outage: properties page shows error state (not a blank grid)", page.locator("#sfErrorState").is_visible())
        page.goto(SITE + "/our-realtors.html", wait_until="load"); page.wait_for_timeout(2000)
        grid = page.locator("#realtorsGrid").inner_text()
        check("outage: realtors fall back to static data without Sample Realtor", "Gnanasekaran" in grid and "Sample Realtor" not in grid, grid[:200])
        page.goto(SITE + "/enquiry.html", wait_until="load")
        page.fill('[name="Full Name"]', "Offline"); page.fill('[name="Mobile Number"]', "9000000001")
        page.fill('[name="Subject"]', "x"); page.fill('[name="Message"]', "x")
        page.locator("#propertyForm button[type=submit]").click(); page.wait_for_timeout(2500)
        alert_msg = page.evaluate("window.__lastAlert || ''")
        check("outage: enquiry failure tells visitor to call (form kept)", "call us" in alert_msg.lower() and page.locator("#propertyForm").is_visible(), alert_msg)
        check("outage: no uncaught JS errors", not errors, errors)
        ctx.close()

        # ---------- desktop screenshots for review ----------
        ctx = make_context(browser, ADMIN); page = ctx.new_page()
        page.goto(SITE + "/admin/dashboard.html", wait_until="load"); page.wait_for_timeout(2500)
        page.screenshot(path="/tmp/shot-admin-overview.png", full_page=True)
        ctx.close(); ctx = make_context(browser, BUYER); page = ctx.new_page()
        page.goto(SITE + "/account.html", wait_until="load"); page.wait_for_selector(".acct-match-card", timeout=8000)
        page.screenshot(path="/tmp/shot-desktop-account.png", full_page=False)
        ctx.close()
        ctx.close()
        browser.close()

run()
print(f"\n{sum(results)}/{len(results)} passed")
sys.exit(0 if all(results) else 1)
