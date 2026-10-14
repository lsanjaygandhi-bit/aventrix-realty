# Aventrix Realty — Source Audit & Fix Report (14 Oct 2026)

Scope: the supplied ZIP `aventrix-realty-property-tools-header-scroll-fixes.zip` (258 files: 35 HTML pages + 2 admin pages, 13 page stylesheets + `style.css`, 37 scripts, images, fonts, SQL, tests). Work was done on a copy; the untouched original is the source ZIP itself. Nothing was deployed, merged, or changed in Supabase (schema, RLS, auth, keys, env config all untouched).

**Testing method:** headless Chromium (Playwright 1.56) against a local static server, with Supabase REST/auth calls answered by a mock (8 / 1 / 0 properties, API error, and a never-answering request for the loading state). Six viewports — 1440×900, 1280×800, 1024×768, 768×1024, 390×844, 375×812 — with phone/tablet sizes run as touch devices with iPhone / iPad user agents, so `html.is-mobile` engages as on real devices. 33 public pages × 6 viewports = 198 page loads, plus a 1 px-step header sweep 769–1920 px on three pages.
**Not tested:** real Safari / iOS WebKit (WebKit is not available in this environment — iPhone results are Chromium with an iPhone user agent, not Safari), real Android devices, live Supabase data, Google Maps (blocked offline), and the admin panel.

---

## B. Issues found

| # | Severity | Issue | Files | Status |
|---|---|---|---|---|
| 1 | **Critical** | Property Tools pages loaded `assets/style.css`, which styled bare `header`, `nav`, `footer`, `body`, `h1`, `select`, `.hero`, `.card`… globally. `.hero` collided with the site's own homepage `.hero` (flex/video layout) — hero text broke into columns and ran off-screen on mobile; header grew to 99–124 px | 7 tool pages, `assets/style.css` | Fixed — replaced by scoped `css/property-tools.css` (all rules under `body.pt-page` or `pt-` classes) |
| 2 | **Critical** | Tool pages had a hand-made header: no mobile-detection script (so `html.is-mobile` never set → desktop header layout on phones), no wishlist/shortlist/account icons, no socials, no `data-site` hooks (CMS phone/WhatsApp updates didn't apply), own menu script instead of `script.js` | 7 tool pages | Fixed — pages rebuilt in the real page frame copied from `about.html` (head script, favicons, header, premium footer, WhatsApp/back-to-top, shared scripts) |
| 3 | **Critical** | Homepage header overflow: the 11th nav item ("Property Tools", added only to `index.html`) pushed the call button and icons past the container/viewport at **768 of 1,152** desktop widths 769–1920 px (e.g. at 1024 px the call button sat at 1034–1074 px, off-screen) | `index.html`, `style.css` | Fixed — nav gaps re-tuned per tier (font size/weight unchanged); desktop label reads "Tools", drawer reads "Property Tools". 0 bad widths after |
| 4 | **High** | "Property Tools" was in the nav of only 2 of 26 site pages — inconsistent navigation | 24 pages | Fixed — added to every page's `.main-nav` |
| 5 | **High** | Duplicate account icon (`.home-app-header-actions`) visible and clipped off the right edge on desktop windows 769–900 px; and **hidden on touch tablets ≥901 px** (iPad landscape) where `.nav-right` is also hidden → no account icon at all | `style.css` | Fixed — now follows the drawer switch (`html.is-mobile` / ≤768 fallback) |
| 6 | **High** | Homepage property cards stacked vertically (2-col phone / 4-col desktop grid of up to 20 cards). The earlier "rail" CSS targeted guessed selectors and its stylesheet was never loaded by `index.html` | `index.html`, `css/aventrix-requested-fixes.css` | Fixed — see section E |
| 7 | **High** | JV Feasibility page duplicated the existing JV Calculator with a **different surplus formula** (`GDV×dev share − costs − profit` vs the calculator's `dev value − developer investment`) → two answers for the same inputs | `jv-feasibility.html`, `assets/app.js` | Fixed — page is now a guide that documents the existing calculator's formulas and links to it. `jv-calculator.html` and `js/jv-calculator-integration.js` untouched |
| 8 | **High** | Valuation page offered no self-service estimate — only a WhatsApp enquiry form that duplicated the existing Free Valuation form | `property-valuation.html` | Fixed — instant estimator (area × reference rate, unit conversion, range, basis, source, disclaimer). Enquiry is optional and links to the existing Free Valuation form |
| 9 | **Medium** | Commercial calculator: "Cash-on-cost yield (incl. fit-out)" was actually NOI ÷ (price + fit-out); payback divided unlevered cost by **after-loan** cash flow; no input validation (negatives silently became 0); negative money rendered "₹-1,00,000" | `commercial-investment.html`, `assets/app.js` | Fixed — see "Formula changes" below |
| 10 | **Medium** | Government links: one labelled "TANGEDCO link (verify)"; no record of which links were checked | `government-services.html` | Fixed — each card shows "Link checked 14 Oct 2026" or "Not verified"; TNRERA added; TANGEDCO link replaced with the official TNPDCL address `https://www.tnpdcl.org/en/tnpdcl/`; TNPDCL and the Chennai Corporation building-plan search are marked “Confirmed by Aventrix 14 Oct 2026” (addresses confirmed by you) |
| 11 | **Medium** | Seller & Landowner page repeated valuation / JV / checklist CTAs | `seller-landowner.html` | Fixed — route page (Sell / Lease / JV) linking to one existing page each |
| 12 | **Medium** | Page-hero subtitle ran edge-to-edge on phones (no side gutter) on all `.list-hero` pages | `css/site-fixes.css` | Fixed — 20 px gutter on phones |
| 13 | **Medium** | Tool pages: no meta description (6 of 7), no canonical, no OG tags, no favicons | 7 tool pages | Fixed |
| 14 | **Medium** | `images/chennai-marina.jpg` is referenced (about / contact backgrounds in `style.css`, OG image on 21 pages) but **not in the ZIP** (404 locally) | `style.css`, 21 pages | **Unresolved** — not invented. If it exists on production, add it to the source; otherwise pick a replacement |
| 15 | **Medium** | Root-level `*.sql` files and `property-coordinates-worksheet.csv` are not excluded by `.assetsignore` (only `sql/`, `tests/`, `*.md` are), so they deploy publicly with the site | `.assetsignore` | **Not changed** (deployment config) — recommend adding `*.sql` and `*.csv` |
| 16 | **Low** | Finder duplicates deploy publicly: `sitemap 2.html`, `terms 2.html` (stale copies, no Property Tools link, `terms 2` lacks Admin), plus `* 2.md` / `* 2.sql` | root | **Not deleted** per brief — recommend deleting |
| 17 | **Low** | Missing meta descriptions on account, shortlist, wishlist | 3 pages | Fixed |
| 18 | **Low** | Icon-only "Post Property" bottom-nav link had no accessible name | `index.html` | Fixed |
| 19 | **Low** | Sitemaps didn't list the tool pages | `sitemap.html`, `sitemap.xml` | Fixed |
| 20 | **Low** | Footer logo is an `<h3>` (heading-level skip) and map iframe uses `width="100%"` on every page | all pages | Left as is (cosmetic, sitewide) |
| 21 | **Low** | `realtor-profile.html` has no `<h1>` when opened without `?id=` (not-found state) | `script.js` | Left as is (only the error state) |
| 22 | Info | Google Maps browser key is in `js/maps-config.js` (normal for client-side Maps) | — | Confirm it is HTTP-referrer-restricted in Google Cloud |

No JavaScript errors, no broken internal links, no duplicate IDs and no missing scripts/stylesheets were found on any page before or after (other than #14).

### Formula changes (commercial calculator — explicit, not silent)
| Output | Before | After | Why |
|---|---|---|---|
| "Cash-on-cost yield (incl. fit-out)" | NOI ÷ (price + fit-out) | Same formula, **renamed** "Net yield on total cost" | Label didn't match the maths |
| Cash-on-cash return | — | Cash flow after loan ÷ own cash invested (new optional input) | Real cash-on-cash needs the equity figure |
| Simple payback | (price + fit-out) ÷ cash flow **after loan** | (price + fit-out) ÷ NOI | Mixed a full-cost numerator with a levered denominator. Identical when there is no loan |
| Equity payback | — | Own cash ÷ cash flow after loan (if entered) | Levered view, consistent inputs |
Gross rent, effective rent, NOI, cash flow, gross yield and net yield formulas are unchanged and were verified by hand (₹1 Cr / ₹80k rent / 5% vacancy / ₹1.2L costs → NOI ₹7,92,000, gross 9.6%, net 7.92%).

### JV calculator review (existing, unchanged)
Formulas in `js/jv-calculator-integration.js` were read end-to-end and are now documented on `jv-feasibility.html`: net land = land × (1 − deduction); FSI area = net land × base FSI × (1 + premium %); saleable = FSI area × efficiency; GDV = saleable × rate; residual land value = GDV − core investment − deposit funding cost − target profit − non-refundable payment; developer surplus = developer area value − developer investment. No errors found. One observation for you to decide on: "developer surplus" does **not** deduct target profit, while the status message compares it against target profit separately — consistent, but worth knowing when reading the numbers.

---

## C. Page-by-page checklist
Header = same markup/height/logo/nav as homepage. CSS/assets = all local CSS/JS/images load (200). Responsive = no horizontal page scroll at all 6 viewports. JS = no errors. ✅ = tested and passed in Chromium at all 6 viewports.

| Page | Header | CSS / assets | Responsive | Links / buttons | JS | Notes |
|---|---|---|---|---|---|---|
| index.html | ✅ | ✅ | ✅ | ✅ | ✅ | Rail tested with 0/1/8/12 cards, error, loading; List/Map toggle |
| about.html | ✅ | ⚠ chennai-marina.jpg 404 | ✅ | ✅ | ✅ | |
| contact.html | ✅ | ⚠ chennai-marina.jpg 404 | ✅ | ✅ | ✅ | |
| properties.html, property.html | ✅ | ✅ | ✅ | ✅ | ✅ | property.html tested without `?id` |
| services, list-with-us, free-valuation, joint-venture, jv-calculator, nri-services, brokerage-fees, emi-calculator, enquiry | ✅ | ✅ | ✅ | ✅ | ✅ | Forms not submitted (would write to Supabase) |
| insights, insight, our-realtors, realtor-profile, sanjay, gnanasekaran | ✅ | ✅ | ✅ | ✅ | ✅ | Empty CMS data (mock) |
| account, wishlist, shortlist | ✅ | ✅ | ✅ | ✅ | ✅ | Signed-out state only |
| privacy-policy, terms, sitemap | ✅ | ✅ | ✅ | ✅ | ✅ | |
| property-tools.html | ✅ | ✅ | ✅ | ✅ | ✅ | |
| property-valuation.html | ✅ | ✅ | ✅ | ✅ | ✅ | Calculations, unit conversion, swap, validation, published-rate path (test row), WhatsApp text |
| property-checklists.html | ✅ | ✅ | ✅ | ✅ | ✅ | All 5 lists, `?type=` deep link, progress, reset, print/PDF output checked |
| jv-feasibility.html | ✅ | ✅ | ✅ | ✅ | ✅ | |
| commercial-investment.html | ✅ | ✅ | ✅ | ✅ | ✅ | Defaults, loan + equity, negative cash flow, vacancy > 100%, empty rent |
| government-services.html | ✅ | ✅ | ✅ | ✅ (TN e-Services link: confirm it opens without session token) | ✅ | |
| seller-landowner.html | ✅ | ✅ | ✅ | ✅ | ✅ | |
| sitemap 2.html, terms 2.html | — | — | — | — | — | Stale duplicates, not tested (see #16) |
| admin/ | — | — | — | — | — | Out of scope, unchanged |

Mobile drawer (open via toggle, close via overlay and toggle, 2 tel links, "Property Tools" present) verified on index, property-tools and property-valuation at 390 px.

---

## D. Header & CSS summary
- **Logo:** every page uses `images/aventrix-logo.png` (763 px wide original) at the existing heights — 53 px ≥1451, 42 px 769–1450, 41 px on `html.is-mobile`. No path change was needed on existing pages; tool pages now use the identical markup.
- **Alignment / spacing:** the existing "authoritative" nav-tier block in `style.css` was kept and re-tuned (spacing only): gaps 1→1/3→1/5→4/9→7/14→12/18→13 px across the six tiers, admin margin and nav margin trimmed. Font sizes, weights and letter-spacing are unchanged. The desktop label "Tools" (`<span class="nav-label-extra">Property </span>Tools`) shows in full in the drawer. Verified at every pixel 769–1920: one row, no overlap, icons inside container and viewport; minimum nav→icon gap 5–8 px (10–24 px at ≥1024 px when there were 10 items).
- **Call button:** `.nav-right .nav-phone` → `tel:+919176887770` visible on every page at 1024/1280/1440 (on phones, the drawer's two tel links — unchanged site behaviour).
- **Header behaviour:** static white header, 71 px desktop / 75 px touch, identical on all 33 pages (tool pages were sticky 99–124 px).
- **Property Tools styles:** one scoped stylesheet `css/property-tools.css`, loaded after `style.css` and before `css/site-fixes.css` like every other page stylesheet. No `!important` except the `[hidden]` guard and print rules. Old `assets/style.css`, `assets/app.js` and `css/aventrix-requested-fixes.css` were removed because they were replaced, not because they looked unused.
- **Cache busting:** `style.css` and `css/site-fixes.css` bumped to `?v=20261014`, `css/home-hero.css` to `?v=5` so Cloudflare/browsers pick up the changes.

## E. Homepage property scrolling
- **Actual container:** `#futurePropertiesGrid.home-app-future-grid` inside `section#future-properties`; cards are `.home-app-property-card`, rendered by `loadFutureProperties()` in `js/home-app-experience.js` (latest 20 Published, featured first). Renderer, card markup, hearts, Call/WhatsApp and the List/Map toggle (`js/properties-map.js`) are untouched.
- **Implementation:** CSS only in `css/home-hero.css` (homepage-only file): `display:flex; overflow-x:auto; overflow-y:hidden; scroll-snap`. 4 cards visible ≥1181 px, 3 on laptops, 2.4 on narrow desktop, 3.3 on touch tablets, 2.15 on phones (next card peeks). Loading/empty/error messages span the full row. The rail has `role="region"`, an aria-label and `tabindex="0"` (arrow keys scroll it; focus ring in brand gold). Previous/Next buttons (`js/home-property-rail.js`) appear in the heading only when cards overflow, disable at either end, hide in Map View and on phones (swipe instead).
- **Results:** single row at all six viewports; page `scrollWidth` = viewport (no horizontal page scroll); homepage ~370 px shorter at 1440 and ~1,040 px shorter at 390. Arrow, keyboard, tab-focus-into-view and a synthetic touch swipe all scroll the rail without moving the page.
- **Tested on:** Chromium desktop (1440/1280/1024) and Chromium with iPhone/iPad user agents and touch (768/390/375). **Not tested on real iPhone Safari.**

## F. Remaining dependencies
1. **Market-rate data:** `data/market-rates.json` is intentionally empty. Supply sourced, dated rows (format in `README-PROPERTY-INTELLIGENCE.md`) to switch on the "Aventrix published rate" option and fill the rate table. Until then visitors use their own reference rate.
2. **Government links:** all nine now carry a status. TN e-Services, TNPDCL and the Chennai Corporation search are “Confirmed by Aventrix” (addresses you supplied). The Patta / Chitta link deliberately omits the `rno=` session token from the address you sent, because that token is generated per visit and would expire — please click it once on the live page to confirm the page opens without it.
3. **Missing image:** `images/chennai-marina.jpg` (#14).
4. **Safari / real devices:** needs a pass on an actual iPhone (Safari) and an Android phone — especially the rail swipe, drawer and `:has()` radio styling (Safari 15.4+).
5. **Deploy hygiene (needs your approval):** add `*.sql`, `*.csv` to `.assetsignore`; delete the `* 2.*` duplicates; confirm the Maps key restriction.
6. **Not modelled:** IRR/DSCR (commercial), tax/financing schedule (JV) — as stated on the pages.

## Files changed
Added: `css/property-tools.css`, `js/property-tools.js`, `js/home-property-rail.js`, `data/market-rates.json`, this report.
Removed (replaced): `assets/style.css`, `assets/app.js`, `css/aventrix-requested-fixes.css`.
Rebuilt: the 7 Property Tools pages.
Edited: `style.css` (nav tiers, account-icon rule), `css/home-hero.css` (rail), `css/site-fixes.css` (hero gutter), `index.html` (rail markup/script, aria-label), `sitemap.html`, `sitemap.xml`, `README-PROPERTY-INTELLIGENCE.md`, nav link + stylesheet versions on the other 24 pages, meta descriptions on account/shortlist/wishlist.
