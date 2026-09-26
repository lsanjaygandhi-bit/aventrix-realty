# Aventrix Realty — Audit & P0/P1 Implementation (2026-09-25)

Base: `aventrix-realty-hero-search-2026-09-24.zip` (treated as production).
Live database inspected **read-only** (project `gkrtjeygrqkglsadskcg`): tables, columns,
RLS policies, storage policies, functions, triggers, row counts. Nothing was changed live.

---

## A. Audit summary

Static multi-page site (HTML/CSS/vanilla JS) on Cloudflare Workers, Supabase for data,
auth and storage. Mature CMS, property search, wishlist/shortlist/recently-viewed with
account sync, buyer login. The architecture is sound; the serious problems were
**authorization** (database policies written for a single-admin world, while buyer
signup is now live) and **schema drift** (live DB ≠ repo SQL).

## B. Existing architecture map

| Area | Files | Data |
|---|---|---|
| Public pages (22) | `*.html`, `style.css` (8.7k lines), `css/*.css`, `script.js` | — |
| Supabase client | `js/supabase-client.js` (publishable key only ✓) | — |
| Listings | `js/public-properties.js`, `js/properties-search.js`, `js/property-taxonomy.js` | `properties` |
| Near Me | `js/geo-bridge.js`, `js/geo-homepage.js`, `js/near-me.js` | locality-centre table (honestly labelled) |
| Wishlist/Shortlist/Recent | `js/aventrix-storage.js` (+ page scripts) | `wishlists`, `shortlists`, `recently_viewed` (live-only tables) |
| Recent searches | `js/recent-searches.js` | localStorage only |
| Buyer auth | `account.html`, `js/account-auth.js` | Supabase Auth |
| Enquiries | `js/enquiry-supabase.js` (all forms) | `enquiries` |
| CMS | `js/public-*.js` | `pages`, `site_settings`, `realtors`, `testimonials`, `insights`, `office_locations` |
| Admin | `admin/*` — CRUD engine + one module per table | all of the above, `media_library` |
| Mobile app (separate repo) | — | `admin_profiles`, `site_visits`, `notifications`, `properties.submitted_by…` |

## C. Critical issues (non-security)

1. Logged-in buyers' enquiries were **rejected** by the database (RLS required `submitted_by`, the site never sent it).
2. `office_locations` had RLS enabled and **no policies**: site silently fell back to static HTML; Admin → Office Locations couldn't load or save.
3. All 6 published Insights have **empty bodies** and linked to `insight.html`, which **didn't exist**.
4. `images/images:insight-4/5/6.jpg` misnamed → broken images.
5. Schema drift: 5 tables + 9 columns existed only in the live DB.
6. Card WhatsApp buttons carried **no property reference**; no AVX code in any message.
7. `style.css` hero fallback pointed to non-existent `images/hero.jpg`.
8. Sitemap missing About/Services; listed `index.html` while canonical is `/`.
9. `home.html` — indexable 35-line stub.
10. Password-reset link could be overridden by the logged-in panel (race).

## D. Security issues (all verified reproducible)

| # | Severity | Issue | Status |
|---|---|---|---|
| 1 | **Critical** | Any buyer could insert their own `admin_profiles` row → admin over properties, enquiries, site visits, notifications | Fixed (P0) |
| 2 | **Critical** | Any logged-in user could edit `pages`, `site_settings`, `realtors`, `testimonials`, `insights`, `media_library` | Fixed (P0) |
| 3 | **Critical** | Storage `property-images`: anonymous upload, public update & delete | Fixed (P0) |
| 4 | High | Customers could self-publish / self-feature their submitted listing | Fixed (trigger) |
| 5 | High | Stored XSS path: admin enquiry modal rendered `form_type` unescaped | Fixed (CRM rewrite escapes everything) |
| 6 | High | Admin panel accepted any session (buyers could open the dashboard shell) | Fixed (role gate; RLS is the real guard) |
| 7 | Medium | `sql/` and `*.md` deployed publicly | Fixed (`.assetsignore`) |
| 8 | Medium | Before fix #2, Insights body (rendered as HTML) was writable by any buyer → XSS on public site | Closed by #2 |
| 9 | Low | Public "Admin" link in header + footer on 22 pages | **Not changed** (your nav decision) — recommend removing from main nav |

## E. Database changes

**`sql/migration-2026-09-25-01-p0-security-roles.sql`** (run first)
- `user_roles(user_id, role admin|realtor|customer, realtor_id)`; no row = customer. Backfills existing admins.
- `app_role()`, `is_admin()`, `is_staff()`; last-admin protection trigger.
- Every policy rewritten to `is_admin()`; public reads re-granted to `anon, authenticated`.
- `office_locations` policies restored. `properties.managed_by` (realtor ownership).
- Guard triggers: non-admins can't publish/feature/re-assign listings; public enquiries forced to `status='new'`.
- Storage: uploads admin/realtor only (+ `customer-uploads/<uid>/` for customers); delete admin only.

**`sql/migration-2026-09-25-02-p1-crm-buyer-analytics.sql`**
- `enquiries` + lead_stage (9 stages), lead_source, property_slug/id/code, requirement, budget_min/max, preferred_locations, assigned_to, last_contact_at, next_follow_up_at, updated_at.
- Website inserts can't pre-set CRM fields; `property_slug` resolved server-side (Published only).
- Realtors: read/update only assigned leads, can't re-assign.
- `lead_notes` (history), `staff_directory()`.
- `customer_profiles`, `buyer_requirements`, `saved_searches` (owner-only + admin read).
- `property_events` + `track_property_event()` (validated, 1 per visitor/property/type/day, staff excluded) + `property_performance` view.
- `admin_dashboard_metrics()`.

**`sql/schema-live-drift-capture-2026-09-25.sql`** — documents live-only objects (no-op on live).

Impact on live data: 1 auth user (admin) today → nobody loses access. No rows deleted; the only
row writes are the admin backfill and column defaults on the 1 existing enquiry.

## F. Roadmap

**P0 — done:** items D1–D8, enquiry fix, office policies.

**P1 — done:** Lead CRM (stages, source, assignment, budget, locations, property, notes),
follow-ups (Overdue/Today/Upcoming), real-data dashboard, property-specific WhatsApp + manual
WhatsApp leads, interaction analytics, buyer dashboard (requirement, matches, saved searches,
my enquiries, profile), rule-based matching, save-search button, property-linked enquiries,
insight article page, broken assets, sitemap.

**P2 — next:**
- Customer-facing enquiries view (hide internal lead fields from the buyer API)
- Admin UI to assign listings to realtors (`managed_by`) and to manage `user_roles`
- `latitude/longitude/location_precision` on properties + admin map picker → List + Map split view; Near Me on real coordinates
- Saved-search alerts: DB job on publish → `notifications` (website first, then email/WhatsApp)
- Recent searches → Supabase for logged-in users
- Verified Property workflow (checklist table, verified_by/at, audit log; badge only when complete)
- Area landing pages with real listing counts & unique local copy (only where ≥ N listings)
- Pre-rendered insight/property pages for SEO (JS-rendered pages index poorly); dynamic sitemap
- Performance: hero video 13.7 MB → ~2 MB + poster on mobile; insight/property JPGs 2–3 MB (insight-4/5/6 are PNG data)
- Shared card template (4 near-identical card renderers today)

**P3:** investment calculator (EMI / yield / scenario ROI, clearly labelled assumptions), AI re-ranking on top of the transparent score.

## G. Files changed
`.assetsignore`, `SUPABASE_SETUP.md`, `sitemap.xml`, `style.css` (hero fallback only),
`account.html`, `enquiry.html`, `index.html`, `insights.html`, `properties.html`, `property.html`,
`shortlist.html`, `wishlist.html` (script includes / version stamps; + markup on account, properties, property),
`about.html` and other pages (style.css version stamp only),
`admin/dashboard.html`, `admin/index.html` (version stamps), `admin/js/auth.js`, `admin/js/dashboard-app.js`, `admin/js/enquiries.js`,
`js/account-auth.js`, `js/enquiry-supabase.js`, `js/home-app-experience.js`, `js/properties-search.js`,
`js/public-insights.js`, `js/public-properties.js`, `js/shortlist-page.js`, `js/wishlist-page.js`.

## H. Files added
`insight.html`, `admin/css/admin-crm.css`, `css/buyer-features.css`, `js/account-dashboard.js`,
`js/aventrix-tracking.js`, `js/property-matching.js`, `js/saved-searches.js`,
3 SQL files (section E), `tests/` (see K), this report.

## I. Files removed (verified unreferenced in code AND in live database)
`home.html`, `images/hero.mp4` (3 MB). Renamed: `images/images:insight-{4,5,6}.jpg` → `insight-{4,5,6}.jpg`.
Unreferenced but **kept** (may be wanted for listings): `Founder 3.PNG`, `commercial-rental.jpg`,
`crownleaf.jpg`, `ecr-devaneri.jpg`, `property2.jpg`, `property3.jpg`.

## J. SQL migrations
See E. Order: P0 file → P1 file. Both idempotent; rollback notes at the bottom of each.

## K. Testing performed

| Suite | How | Result |
|---|---|---|
| Live vulnerabilities reproduced | local Postgres rebuilt from repo SQL + exact live policies | 8/8 reproduced |
| RLS security matrix (anon / buyer / buyer2 / realtor / admin) | real roles, real RLS, `tests/run-db-tests.sh` | **75/75** |
| Matching engine | `node tests/matching.test.js` | **13/13** |
| End-to-end browser | Chromium + real site JS + real supabase-js → PostgREST → migrated DB, `tests/run-browser-tests.sh` | **54/54** |

Browser coverage: anon search, WhatsApp message & tracking, view dedupe on reload, property enquiry
→ lead linked to AVX code, insights; buyer refused by admin, requirement → 100% match with factors,
lease excluded for buyer, profile, save search, wishlist sync, logged-in enquiry (previously broken),
own-enquiries only; admin metrics = DB counts, performance list, lead stage/follow-up/notes,
manual WhatsApp lead, today's follow-up on overview, offices load; realtor sees only assigned lead
and no admin-only menu; mobile (390 px) layout bounds on account & properties; zero JS errors.
A mobile layout bug in the new dashboard was caught by screenshot review and fixed.

Not tested: the live Supabase project itself (Auth emails, real storage uploads), the Expo mobile app,
Safari/iOS specifically, third-party CDNs (blocked in the test sandbox).

## L. Remaining limitations
- Buyers can read internal CRM columns of their **own** enquiries via the API (UI hides them) — P2 view.
- Realtor editing of listings needs `managed_by` set via SQL until the P2 admin UI.
- Admin Properties screen shows Add/Delete to realtors; the database refuses those actions.
- Saved-search alert preference is stored; delivery isn't built (UI says so).
- Analytics dedupe relies on a browser ID: clearing storage or a determined script can add events.
- If the mobile app uploads customer photos outside `customer-uploads/<uid>/`, those uploads will be refused.
- Near Me still uses locality centres (labelled as such) until per-property coordinates exist.
- Content decisions pending: published "Sample Realtor"; 3 seeded testimonials originally marked "representative".

## M. Recommended next phase
1. Apply P0 to live (urgent: storage), smoke-test admin login, then P1, then deploy these files.
2. Decide on Sample Realtor / testimonials and the public Admin link.
3. P2 in this order: customer enquiries view → role & listing-assignment admin UI → coordinates + map split view → saved-search alerts → hero video/image compression.

---

## Round 2 — content decisions and readiness review (2026-09-25)

**Decisions implemented**
- `sql/migration-2026-09-25-03-content-drafts.sql` sets "Sample Realtor" (slug `sample-realtor`) and the 3 seeded
  testimonials to Draft. It only updates rows; nothing is deleted and no replacement content is created.
- The DB change alone would not have hidden them:
  - `index.html` shipped the same 3 testimonials as static fallback cards. These are removed, and the section now
    stays hidden until at least one genuine Published testimonial exists.
  - **Bug fixed:** `realtors-data.js` used `const REALTORS_DATA`, so the CMS loader's `window.REALTORS_DATA` never
    took effect and Our Realtors always showed the static file. It's now `var`, and the static fallback also
    excludes Drafts. The Sample Realtor entry is kept in the file, marked Draft.
  - After deploy, Our Realtors renders the live CMS rows. The only difference from the static file is Sanjay's
    experience: CMS "15+ years" vs static "10+ Years". This comparison came from a read-only query.
- The public "Admin" link is removed from the header and footer on all 22 public pages (44 lines).
  `/admin/` is unchanged and still reachable directly; `robots.txt` still disallows it.

**Final test results** (all run on a freshly rebuilt local database after the last code change)

| Suite | Result |
|---|---|
| Live-state reproduction (8 security holes + 2 placeholder-content checks) | 10/10 |
| RLS / security matrix + CRM + content migration | 85/85 |
| Matching engine | 13/13 |
| Browser E2E (Chromium, real site JS + supabase-js → PostgREST → migrated DB) | 79/79 |

Browser coverage by area: admin login and role gate 20, content decisions 9, buyer account 9, shortlist and
local-to-account migration 8, enquiry 7, Supabase outage and JS errors 7, mobile layout 6, WhatsApp and tracking 4,
public search and empty state 4, insights 3, wishlist 2.

**Readiness scan:** canonicals self-consistent; sitemap URLs equal the canonicals; no noindex page in the sitemap;
all 14 changed JS/CSS files version-stamped; `.assetsignore` excludes `sql/`, `tests/`, `*.md`; no secret keys;
no temp files.

See `PRODUCTION-MIGRATION-CHECKLIST.md` for the go-live order.

---

## Round 3: reconciliation onto the live source (2026-09-26)

- **Live source:** `aventrix-realty-hero-search-2026-09-24 5.zip`, confirmed identical to GitHub
  `lsanjaygandhi-bit/aventrix-realty` @ `4c70d1c` (all 45 root entries, including folder tree hashes). The deployed
  sitemap, `robots.txt`, Admin link and testimonials match it too.
- It is byte-identical (140/140 files) to the base the P0/P1 build was made from. The only extra content is 150
  `__MACOSX/` Finder metadata entries, which are excluded.
- The P0/P1 changes were applied to it as a **patch** (67 file-diffs; all applied cleanly with no conflicts), not as a file copy.
- **One addition:** `.wranglerignore` is kept identical to `.assetsignore`, matching the repo's existing convention. It also
  excludes `sql/`, `tests/` and `*.md`.
- **Restored live functionality:** the P0/P1 build had replaced the live Admin overview's "Drafts" card with
  "Active Listings". The Drafts card is back, counted exactly as before (`CrudEngine.count`, not dependent on
  any migration), in a 5-card first row. Files: `admin/dashboard.html`, `admin/js/dashboard-app.js`,
  `admin/css/admin-crm.css` (version stamps bumped to `?v=20260926`).
- **Test-harness fix:** the browser tests now forward the `Origin` header to local PostgREST, which then returns
  the same CORS headers as Supabase. Without it, count-only queries read 0. This was found by the new Drafts test.
- **Results on the reconciled build:** live-state reproduction 10/10 · DB/RLS/CRM/content 85/85 · matching 13/13 ·
  browser E2E 80/80 · readiness scan (SEO, sitemap, assets, cache stamps, deploy exclusions, secrets) all pass.
- The live source has 5 broken asset references (3 insight images, `images/hero.jpg`, `insight.html`); the reconciled build has 0.
