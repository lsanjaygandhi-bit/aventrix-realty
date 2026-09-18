# Aventrix Realty — Phase 2A: Property Discovery & Search UX

Builds on top of the (still unpushed) Phase 1 SEO package. No files
outside this list were touched. No Supabase schema changes were made —
none were needed for any Phase 2A feature.

## New files
- **`js/near-me.js`** — the "Properties Near Me" feature. Runs only on
  `properties.html`.
- **`css/phase2a.css`** — new, additive stylesheet for every Phase 2A
  UI element (near-me widget, loading skeletons, Similar
  Properties/Recently Viewed grids). `style.css` was not touched.

## Modified files

**`properties.html`**
- Added Facing, Furnishing, Parking, and Min. Road Width filter fields
  to the existing filter panel (reusing the exact same `.sf-field`
  markup pattern already used by every other filter).
- Added the "Properties Near Me" widget above the filter panel.
- Linked `css/phase2a.css` and `js/near-me.js`.

**`js/properties-search.js`**
- Facing and Furnishing filter server-side via `.eq()` (both are
  controlled-vocabulary dropdowns in the admin CMS — confirmed exact
  values by checking `admin/dashboard.html` before writing the public
  filter options, so they match precisely).
- Parking filters server-side via `.gte()` (existing integer column).
- Road Width filters client-side (same pattern already used for
  Built-up Area, since `road_width` is free text like `"30 ft"` with
  no numeric column to filter on server-side).
- All four new filters are included in the shareable URL query string,
  the active-filter chips, and Clear Filters — consistent with every
  existing filter.
- Added a loading-skeleton state (6 skeleton cards) shown while a
  search query is in flight, replacing the plain "Loading
  properties…" blank period.
- Exposed the existing `cardTemplate()` function as
  `window.AventrixPropertyCard` so `near-me.js` can reuse the exact
  same card markup instead of duplicating it.

**`property.html`**
- Added two new sections: Similar Properties and Recently Viewed
  (both hidden by default, shown only once they have real results —
  never an empty section).
- Linked `css/phase2a.css`.

**`js/public-properties.js`**
- **Similar Properties**: a deterministic, rule-based matcher — no AI.
  Tries, in order, until at least 4 results are found: (1) same
  category + same location text, (2) same category + price within
  ±20%, (3) same listing type + same bedroom count, (4) fallback: same
  category, most recent. A rule that finds nothing simply falls
  through to the next one; nothing is invented.
- **Recently Viewed**: reads the history `AventrixStorage.recentlyViewed`
  already tracks on every property view (this tracking already
  existed before Phase 2A — only the display was missing). No new
  Supabase table, no new client-side storage mechanism.
- Both reuse the existing `cardTemplate()` and the existing
  wishlist/shortlist listener functions — no duplicated card markup or
  duplicated save/shortlist logic.

## "Properties Near Me" — how it actually works (read this carefully)

Individual properties do **not** yet have their own latitude/longitude
— that's a Phase 2B schema change, explicitly not made here. So this
feature works as follows, and is honest about it in the UI copy:

1. The browser's **real, native** Geolocation permission prompt is
   triggered only after the user clicks "Allow Location Access" inside
   an Aventrix-styled explainer panel — never on page load, never
   faked, never re-prompted automatically after a denial in that
   session.
2. Once permission is granted, the browser gives the user's
   coordinates. These are held in memory only for that page view —
   never written to localStorage, sessionStorage, or Supabase, and
   never sent anywhere. Reloading the page clears it.
3. Those coordinates are compared (via the Haversine formula) against
   a static, hand-maintained reference table of ~45 well-known Chennai
   locality center coordinates in `js/near-me.js` — public geography,
   not property data. Localities within the selected radius (1/5/10/25
   km, matching the spec) are found.
4. Properties whose existing free-text `location` field matches one of
   those nearby locality names are shown, sorted by that locality's
   distance.
5. The UI explicitly states: *"Distance shown is to each locality's
   centre, not the exact property."* This is not hidden or glossed
   over.

**This is deliberately architected so Phase 2B is a data-source swap,
not a rewrite**: the same `haversineKm()` and sorting logic will work
identically once real per-property coordinates exist — only the input
（locality centers vs. real property coordinates) changes.

## Explicitly not touched
`style.css`, `admin/`, `js/supabase-client.js`, `js/aventrix-storage.js`,
`wishlist.html`, `shortlist.html`, `account.html`, authentication,
enquiry/WhatsApp/Call logic, CMS — none of these were modified.
Confirmed via `diff` against the pristine original.

## Known limitations / Phase 2B dependencies
- "Near Me" distance is locality-level, not per-property, until Phase
  2B adds real coordinates (documented above and in the UI itself).
- Amenities filter was not added in Phase 2A — the underlying
  `features` column is free text with no controlled vocabulary yet, so
  it wasn't added here per the "use existing fields, don't invent
  structure" instruction. Flagged for a data-cleanup pass before a
  future amenities filter.
- Homepage's "Future Properties" grid still shows plain "Loading
  properties…" text rather than a skeleton — left out of this pass to
  stay scoped to `properties.html`/`property.html` as the primary
  "property search" surfaces named in the approval; easy follow-up if
  wanted.

---

## Additional fix: Recent Searches / All Recent Searches (bug repair)

### Root cause (found by inspecting the actual code, not guessed)

The existing Recent Searches feature (`js/home-app-experience.js`) only
ever listened for a `submit` event on `.property-search-form` — an
element that exists **only on `index.html`'s homepage hero search
bar**. `properties.html`, where real searching actually happens, has
**zero `<form>` elements** — its entire filter panel
(`js/properties-search.js`) is wired via plain `change`/`input`
listeners straight into a Supabase query, with no form submission
event at all. So a real search performed on the actual search page
never triggered a save — this is problems #1, #3, and #4 from your
report, precisely.

Separately, the Recent Searches display (`recentSearchesChips`,
`allRecentSearchesBtn`) only existed on `index.html` — `properties.html`
had no Recent Searches UI at all, so there was nowhere for an "immediate
update" to even appear on the page where the user had just searched.

"All Recent Searches" itself technically ran (it toggled the chip
count from 5 to 8), but had no way to remove an individual search or
clear all, which the existing UI never had controls for.

### Fix

- **New shared module `js/recent-searches.js`** — the read/save/render
  logic extracted from `home-app-experience.js` and fixed, now used by
  both `index.html` and `properties.html` so there is one source of
  truth instead of two divergent copies.
- **`js/properties-search.js`** now calls this module directly after
  every successful search (`fetchAndRender()` → `renderResults()` →
  `recordCurrentSearch()`), which is the actual root-cause fix — this
  is the code path that runs on every real search on the page where
  searching happens.
- **`properties.html`** gained its own Recent Searches row (reusing
  the exact same `.home-app-recent-*` CSS classes and visual style
  already on the homepage — not a new design) plus an expanded list,
  so the update is visible immediately, on the page where the user
  just searched.
- **`index.html`** kept its existing hero-bar capture (there's no
  equivalent to hook into for that form), now routed through the same
  shared `record()` function for a single consistent storage format.
- **"All Recent Searches" now actually shows a real list**: every
  saved search as a row with its label (clickable to reapply) and a
  remove (×) button, plus a "Clear All Recent Searches" button at the
  bottom — all backed by real `removeAt()`/`clearAll()` functions that
  didn't exist before.
- **Normalization**: each entry now stores the canonical query string
  `properties.html` itself already writes via its own
  `writeStateToUrl()` — which always orders parameters the same way
  regardless of which order the user touched the filters in. Two
  logically-identical searches always produce the same stored URL and
  correctly de-duplicate (move to the top) instead of creating a
  second entry.
- **Empty state** copy updated to "No recent searches yet." as
  requested, same CSS class as before.
- **Storage**: still `localStorage`, same key
  (`aventrix_recent_searches`) as the original implementation —
  existing saved searches are read and displayed correctly, not lost.
  No new Supabase table, no server-side storage.
- **Logged-in server-side history**: inspected the existing
  architecture — Supabase Auth and `AventrixStorage` exist, but there
  is no existing server-side search-history table or column anywhere
  in the schema or codebase. Nothing to reuse here; introducing one
  would be a new backend system, explicitly out of scope for this fix.
  Client-side `localStorage` remains correct for both anonymous and
  logged-in users at this stage.

### Files touched by this specific fix
`js/recent-searches.js` (new), `js/home-app-experience.js` (refactored
to delegate to the shared module), `js/properties-search.js` (now
calls the shared module after each search), `properties.html` (added
the Recent Searches UI block + script include), `index.html` (added
the expanded-list container + script include + `phase2a.css` link),
`css/phase2a.css` (styles for the expanded list, remove button, clear
all).
