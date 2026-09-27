# Aventrix Realty — Website & Admin CMS: Audit, Fixes and Test Results (2026-09-26)

**Build:** `aventrix-realty-cms-complete-2026-09-26`. It builds on the property-card fix build and keeps all of its changes.

**Status:**
- Tested locally only.
- **Not deployed and not pushed.**
- **Nothing was written to the live database.** The live database was only *read* (a content export, verified by checksum), so the tests ran on an exact copy.

---

## 1. Audit: issues found and fixed

### A. Admin / CMS

| # | Issue found | Fix |
|---|---|---|
| 1 | Most page content wasn't in the CMS. About, Services, Professional Fees, Privacy Policy, Enquiry and the Properties header had no Admin row at all. Joint Venture, NRI, List With Us, Free Valuation, Insights and Our Realtors only had their hero. The Homepage had 7 of its 12 blocks. This is why Admin looked blank while the site showed content. | Every content block on 18 pages is now connected: 80 sections and 327 list items (cards, steps, FAQs, timelines, tags, buttons). Migration 04 fills Admin with exactly the text each page shows today. |
| 2 | The old rich-text editor (Quill) strips layout markup on save. Saving "Our Legacy" once would have destroyed the timeline layout. The office and Quick Enquiry texts would also have lost their styling classes. | New structured editor: separate fields and list items (e.g. Year / Title / Text, Question / Answer). Quill is only used for plain formatted text; anything with layout markup opens in an HTML box. The "Our Legacy" menu now opens this editor. |
| 3 | Homepage FAQ questions and answers were hard-coded ("edit this file directly"). | Editable as Question / Answer items (add / reorder / remove). The accordion still works; this is tested. |
| 4 | Duplicate hero editors: Website Content → Homepage showed hero fields that did nothing, while Site Settings held the real ones. A Site Settings save could also overwrite hero edits. | The Homepage hero is edited in one place only (Website Content → Homepage) and saves only hero fields. Site Settings no longer reads or writes them. |
| 5 | Head Office address, phones and email were typed into 24 footers, the mobile menu, Quick Enquiry and Contact. | All now come from Admin → Office Locations → Head Office. |
| 6 | Head Office map: after the Admin edit, the "embed" field holds a share link (`maps.app.goo.gl`), which Google won't show inside a page. The Adyar branch had no map. | The site only embeds real embed links. Otherwise it builds the map from the office address, so both maps show. Admin now explains this and warns on save. |
| 7 | Founder profile pages were half static and half Admin-driven. Their About, Experience, Expertise and Languages ignored Admin. | Now read from Our Realtors / Leadership. **Decision needed:** see §4. |
| 8 | About Us repeated the founder bios a second time, as separate static text. | About Us now shows the same leader list as the Homepage (one source). |
| 9 | The header call link lost the country code (`tel:9176887770`) whenever Admin held the local number. | Always `tel:+91…`. |
| 10 | Changing a page's SEO title would have changed how that page's leads are labelled in the CRM. | Leads keep the original page name. |
| 11 | "Our Services" footer link and the What We Do / Services cards pointed at `property.html` (the single-listing page). The homepage "Explore Properties" button pointed at a removed section. | Fixed to `services.html` / `properties.html`. |

### B. Website

| # | Issue found | Fix |
|---|---|---|
| 12 | Floating WhatsApp / back-to-top buttons covered "Terms & Conditions" / "Sitemap" at the end of pages. | The footer's last row keeps a gutter for the buttons. Checked on 24 pages × 10 widths: no footer link covered. |
| 13 | "Terms & Conditions" and "Sitemap" links went nowhere (`#`). | New `terms.html` (draft — **you must review it**; it is `noindex` until then) and `sitemap.html`. The sitemap page lists every published property and article straight from the database. |
| 14 | The Privacy Policy said the site has no accounts or logins. It didn't mention the visitor-ID view/click counting, location use, account data, wishlist sync or third-party CDNs. | Rewritten to match what the code actually does. The CMS edits it. **Please review before deploy.** |
| 15 | The property page showed a fake listing ("Luxury Apartments… CMDA Approved") while loading or when offline. An unknown or removed listing URL silently showed a *different* property. | The page shows a neutral loading state. A removed listing shows "no longer available" and is marked `noindex`. |
| 16 | Property structured data published per-sq.ft rates and monthly rents as the sale price, and marked every listing "in stock". | Only real total prices are published. Sold / rented listings are flagged correctly. The Home breadcrumb now matches the canonical URL. |
| 17 | `sitemap.xml` had two dead property URLs and was missing two live listings. | Regenerated from the live listings: 25 properties plus the sitemap page. |
| 18 | Duplicate `robots` tags on Account, Wishlist and Shortlist. Properties had no social description. Enquiry had no meta description. | Fixed. |
| 19 | Realtor profile pages all shared one canonical URL and had no description. | Each profile now has its own canonical URL and description. Founders point to their dedicated page. |
| 20 | Heavy media. The hero video was 13.7 MB for every visitor. Ten ".jpg" images were really 2–3 MB PNG files. | Video: 7.0 MB on desktop and 3.7 MB on phones (SSIM 0.94); it isn't loaded at all under Data Saver or reduced-motion. Images: 23 MB → 2.9 MB, same file names and sizes. `images/` total: 40 MB → 18 MB. |
| 21 | Six insights cards had dead "Read More" links in the fallback HTML. | Removed. The live cards only link articles that have a body. |

Already done in earlier rounds and kept here: no public Admin link in the navigation, and placeholder testimonials hidden until real ones are published (migration 03).

---

## 2. Modified files (compared with the card-fix build)

- **New:**
  - `css/site-fixes.css`, `js/sitemap-page.js`
  - `terms.html`, `sitemap.html`
  - `images/hero-video-mobile.mp4`
  - `sql/migration-2026-09-26-04-cms-content-sync.sql`, `sql/optional-2026-09-26-05-keep-founder-page-text.sql`
  - `tests/cms/*` (the extractor, fidelity check, DB-vs-static check, Admin end-to-end tests, visual diff and responsive probe)
  - this report and `CMS-CONTENT-MAPPING-2026-09-26.md`
- **Public JS:** `js/public-page-content.js` (rewritten: structured sections), `js/public-offices.js`, `js/public-site-settings.js`, `js/public-realtors.js`, `js/public-properties.js`, `js/enquiry-supabase.js`, `script.js`
- **Admin:** `admin/dashboard.html`, `admin/js/page-content.js` (rewritten), `admin/js/legacy-content.js`, `admin/js/settings.js`, `admin/js/offices.js`, `admin/css/admin-crm.css`
- **Pages:** all 22 existing HTML pages. The changes are CMS hooks, loader includes with cache-busting (`?v=20260926b`), footer links and SEO fixes; content text is unchanged except the privacy policy.
- **Media:** `images/hero-video.mp4` and 13 images, re-encoded with the same names.
- **Other:**
  - `sitemap.xml`
  - `PRODUCTION-MIGRATION-CHECKLIST.md` (steps updated)
  - `tests/setup-local-stack.sh` (adds migration 04)
  - `tests/db/run_tests.py` (two page-count checks made independent of the number of pages)

## 3. SQL

| File | What | Needs |
|---|---|---|
| `sql/migration-2026-09-26-04-cms-content-sync.sql` | Adds 10 missing pages rows. Fills blank fields and appends missing sections (with fields and lists) to the 8 existing rows. Fills the blank RERA number with `TN/Agent/0284/2026` (the number the site shows). **Never overwrites a value.** The one exception: the old HTML copy of "Our Legacy" (now held as structured fields with identical words) is cleared, and only if it is still exactly the original. Snapshot `backup_20260926_cms2`; idempotent; rollback included. No RLS, role or schema change. | Your approval; run after P1 and 03 |
| `sql/optional-2026-09-26-05-keep-founder-page-text.sql` | Copies the founder pages' current About / Experience / Expertise / Languages text into Admin, so the pages look unchanged after deploy. Guarded, snapshotted, rollback included. | **Your decision** (§4) |

## 4. Decisions only you can make

1. **Founder pages** — Admin and the pages currently hold different text. The exact texts are in the header of file 05.
   - Gnanasekaran P, About: Admin has 3 paragraphs; the page has 2 different paragraphs.
   - Gnanasekaran P, Languages: Admin includes **Hindi**; the page doesn't.
   - Gnanasekaran P, Expertise: the two lists differ.
   - Sanjay, About: Admin has 1 sentence; the page has a full paragraph.
   - **Run 05** to keep the page text, or **skip it** to show the Admin text.
2. **Terms & Conditions** — a drafted, generic website-terms page. Please review it (or have it reviewed). When you are happy, remove its `noindex` tag and add it to `sitemap.xml`.
3. **Privacy Policy** — rewritten from what the code does. Please confirm it before publishing.
4. **Claims on the site** that I kept but can't verify:
   - "Every property is legally verified before listing" (Why Aventrix, and the FAQ)
   - "Trusted since 1965"
5. Names already shown from Admin on the live site: "L. Sanjay Gandhi" (Admin) vs "Sanjay Gandhi L" (static pages). Pick one and set it in Admin.

## 5. Test results

**Everything ran locally.**
- **Stack:** Chromium, the real site and admin code, and real supabase-js talking to PostgREST.
- **Database:** Postgres with the live schema, policies and P0+P1, holding an exact copy of the live CMS content (checksums identical for pages, site_settings, realtors, testimonials, office_locations and insights).

| Test | Result |
|---|---|
| Fidelity: each page's content read out and applied back through the real loader gives an identical page (18 pages, 80 sections, 327 list items) | **18/18 identical** |
| Migration 04: applied to the live copy; rerun changes nothing; no existing value changed (checked field by field) | **pass** (only the intended Legacy HTML clear) |
| Migration edge cases: blank/null/missing fields filled; a custom heading and an existing list kept | **pass** |
| Admin round-trip, every page: read (no blank field where the page has content) → edit every section, the hero and SEO → save → DB check → reload Admin → public page shows each edit. Also: list add / move / remove, FAQ accordion, Homepage hero, Site Settings (footer, social, RERA, hero untouched), Office Locations (footer on every page, Quick Enquiry, Contact, share-link map), founder pages from Realtors, "Our Legacy" shortcut, no JS errors | **185/185** |
| Existing suites: DB / RLS security matrix | **85/85** |
| Existing suites: browser E2E | **80/80** |
| Existing suites: matching | **13/13** |
| Property-card feature regression (search, filters, sort, wishlist, shortlist, near-me, detail, SEO, recently viewed) | **53/53** |
| Property-card layout audit, 10 widths | unchanged from the card-fix build: 0 escapes / overlaps / misaligned rows / broken images / overflow |
| Responsive probe, 24 pages × 10 widths (320–1440): horizontal overflow, footer covered by floating buttons, JS errors | **0 problems in 240 combinations** |
| Visual diff: before build + live data vs this build + migrated data, 22 pages at 390 and 1280 px | 18 pages: only the footer bottom row changed (1 extra line on phones for the button gutter). Also changed, as expected: Privacy (new text); founder pages (the §4 decision); Contact (Adyar now has a map); property page with a bad ID (the "no longer available" state). |
| SEO scan: title, description, canonical, OG/Twitter, duplicates, JSON-LD parses, sitemap = canonicals | pass (noindex pages excepted) |

**Not tested (can't be tested here):**
- the live Supabase project itself
- real iPhone / Safari
- Google Maps rendering (blocked offline; only the URLs were checked)
- Admin image upload to the missing `site-media` bucket (still a separate task)
- the Expo app
- An independent second-reviewer pass was started but cut off by a usage limit. I then checked its items myself: the migration's merge rules on edge cases, third-party requests named in the privacy policy, and remaining `#` / wrong-page links.

## 6. Remaining issues

- `sitemap.xml` is static, so regenerate it when listings change. `sitemap.html` is always current.
- `site-media` storage bucket still missing: page hero image uploads in Admin fail (typing a URL works).
- The old placeholder testimonial note stays stored in the Homepage testimonials section. It is not shown anywhere; delete it in Admin if you like.
- Property and article pages are still rendered by JavaScript (indexing works, but not as well as pre-rendered pages).
- Deploy order is unchanged: P1 → 03 → 04 (→ 05 if chosen) → deploy → checklist step 8, which now includes CMS checks.
