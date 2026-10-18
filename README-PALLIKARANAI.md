# Pallikaranai Marsh — News Hub & Complete Guide

Two static pages inside the Property Intelligence Centre frame (same header, footer, floating buttons and scripts as `government-services.html`). No Supabase, schema, RLS or worker changes. Nothing is published until reviewed.

## URLs and navigation
| URL | Purpose |
|---|---|
| `/pallikaranai-marsh-updates.html` | News & Updates hub (dated feed, filters, legal background, checklist, FAQ, CTA) |
| `/pallikaranai-marsh-guide.html` | Evergreen complete guide (Ramsar, boundaries, NGT/CMDA, interim ZoI, legal status, buyer impact, checklist, FAQ, source register) |

Feature name: **Pallikaranai Ramsar Intelligence**.

| Where | What |
|---|---|
| Header → Tools (`property-tools.html`) | Featured card at the top of the page: "Pallikaranai Ramsar Intelligence" → `Explore Ramsar Updates →` |
| `insights.html` | "News & Updates" block above Latest Insights (`#news-updates`) |
| Homepage (`index.html`) | Compact card after Future Properties |
| Hub and guide | Sub-navigation: Latest News & Court Updates · Complete Ramsar Guide · Maps & Boundaries · Due-Diligence Checklist · Official Sources · Back to Property Tools / Insights |
| `sitemap.html`, `sitemap.xml` | Both pages listed |

The homepage and Insights cards are generated (regions `PM:HOME`, `PM:INSIGHTS`). They show the newest update that has at least one fully checked source and falls within `homepage_window_days` (45) of `dates.last_source_verification`; otherwise they show `current_status` and its date. Edit `current_status` in the JSON whenever the legal position changes.

The site header (copied into all 37 pages) is **not** changed. Optional, for approval: turn the header "Tools" link into a dropdown (Property Tools · Pallikaranai Ramsar Intelligence) and add an "Insights" item — a site-wide header edit.

## Files
| File | |
|---|---|
| `data/pallikaranai-updates.json` | The dataset: updates (from 18 Aug 2026), legal background, labels, unresolved questions |
| `tools/build-pallikaranai.py` | Validates the JSON and renders it into both pages (regions between `<!-- PM:NAME:START/END -->`). Writes `pallikaranai-source-register.csv` |
| `js/pallikaranai-updates.js` | Today/Yesterday labels (India time; exact date always shown), category chips, month archive, `?category=&month=` deep links. Page works fully without it |
| `css/pallikaranai.css` | Styles for these two pages only (`pm-` / `body.pm-page`) |
| `pallikaranai-source-register.csv` | Source register for editorial review (kept off the CDN by `.assetsignore`) |

## Adding an update
1. Add an object to `updates` in the JSON with: `id`, `event_date`, `published_date`, `category` (court / orders / wetland / zoi / approvals / buyers), `legal_status` (court_order / court_proceeding / court_submission / official_notification / proposal / interim_arrangement / administrative_action / statement / unverified_claim), `headline`, `summary`, `changed`, `not_changed`, and `sources[]` (`title, publisher, url, type, published, checked, verification`).
2. `verification`: `checked` only if you read the source itself; `partial` if only a headline/summary/excerpt was available; `unverified` otherwise.
3. Update `dates.last_substantive_update` (content changed) and/or `dates.last_source_verification` (sources re-checked), plus `next_scheduled` / `current_status` if they changed. Give every source a `tier` (primary / news / secondary) and add `review_flags` for any claim resting on a single secondary source or an inferred date.
4. Run `python3 tools/build-pallikaranai.py` — it refuses entries without sources, https URLs, check dates or a what-changed/what-did-not pair.
5. Review both pages locally, then deploy.
Rules: no entry if nothing happened; never describe a proposal or submission as an order; never imply patta land or land outside the 36 survey numbers is automatically unrestricted.

## Structured data
Hub: `BreadcrumbList` + `CollectionPage`. Guide: `BreadcrumbList` + `Article` (not NewsArticle) + `FAQPage`. While `dates.page_published` is null the pages show “Not yet published” and carry no `datePublished`/`dateModified`. On deploy day set `dates.page_published` to that date and re-run the build: it adds `datePublished` and `dateModified` (= last substantive update). Never backdate `page_published`; `coverage_start` (18 Aug 2026) is the research window, not a creation date.

## Deployment (after factual review and your approval only)
1. Commit on a review branch, e.g. `feature/pallikaranai-news-hub`; open a PR.
2. Preview locally: `python3 -m http.server` in the project folder → open both pages.
3. After approval: set `dates.page_published` to the deploy date, run `python3 tools/build-pallikaranai.py`, then merge to main and run the usual `npx wrangler deploy` (Cloudflare Workers, project `polished-band-06ef`).
4. After deploy: open both live URLs, test one source link per entry, submit `sitemap.xml` in Search Console.

## Related: the Draft Insight
The Supabase `insights` row `pallikaranai-marsh-1km-zone-buyers-guide` (Draft) overlaps this guide, and `insight.html` is `noindex`. Recommendation: keep it Draft, or replace its body with a short summary linking to `/pallikaranai-marsh-guide.html` so there is one authoritative version.
