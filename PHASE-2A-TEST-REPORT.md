# Phase 2A — Validation Report

Static/automated checks performed on the code in this package. These
confirm the code is well-formed and internally consistent. They do
**not** replace opening the pages in a browser — the geolocation flow
in particular needs a real browser to test (see "Still needs your
manual testing").

## Automated checks performed

**1. JavaScript syntax**
`js/near-me.js`, `js/properties-search.js`, `js/public-properties.js`
all pass `node --check` with no errors.

**2. HTML head-tag balance**
`properties.html` and `property.html` each have exactly one `</head>`.

**3. JSON-LD re-validation**
Every JSON-LD block across all HTML pages (25 blocks, from Phase 1) was
re-parsed after the Phase 2A edits to confirm nothing was accidentally
broken. Result: all still valid.

**4. New UI elements present**
Confirmed via direct grep: the four new filter fields
(`sfFacing`/`sfFurnishing`/`sfParking`/`sfRoadWidthMin`) are in
`properties.html`; the near-me widget (`nearMeWidget`/`nearMeTrigger`)
is present; the Similar Properties and Recently Viewed section
containers (`pdSimilarSection`/`pdRecentlyViewedSection`) are in
`property.html`.

**5. Untouched-file confirmation**
`diff` against the pristine original repository confirms `style.css`,
the entire `admin/` directory, `js/supabase-client.js`, and
`js/aventrix-storage.js` are all byte-identical to the original —
none of the "do not break" list was touched. The full file-level diff
shows exactly the files listed in PHASE-2A-CHANGES.md changed, nothing
else.

**6. Filter value accuracy**
Facing and Furnishing dropdown option values were checked against the
actual admin CMS dropdown definitions in `admin/dashboard.html` (not
guessed) — the public filter uses the identical value strings
("Fully Furnished", "North-East", etc.) so the `.eq()` server-side
filter will match real data exactly.

**7. Supabase schema — no changes**
Confirmed no `CREATE TABLE`, `ALTER TABLE`, or any other schema-writing
call was made at any point during Phase 2A. All new filters query
existing columns only (`facing`, `furnishing`, `parking`, `road_width`
— all present before Phase 2A, per the Phase 1 audit).

## Still needs your manual testing

These require a real browser and couldn't be exercised in this static
review:
- **Facing/Furnishing/Parking/Road Width filters** — apply each on a
  live/staging site and confirm results match expectations; confirm
  the filter chips, Clear Filters, and shareable URL all include the
  new params correctly.
- **Similar Properties** — open a few different properties (different
  categories, some with/without price data) and confirm the section
  shows sensible matches and correctly hides itself when nothing
  matches, rather than showing an empty section.
- **Recently Viewed** — view 2-3 properties in sequence, then confirm
  they appear on a later property page's Recently Viewed section, most
  recent first, excluding whichever property is currently open.
- **Loading skeletons** — confirm they appear briefly on
  `properties.html` during a search and don't flash awkwardly on fast
  connections.
- **"Properties Near Me" — the full permission flow**, specifically:
  1. Click "Properties Near Me" → confirm the explainer panel appears
     (not the browser prompt yet)
  2. Click "Allow Location Access" → confirm the **real browser**
     permission dialog appears (this cannot be faked or tested outside
     a real browser)
  3. **Allow** → confirm nearby properties appear, sorted by locality
     distance, with radius chips (1/5/10/25 km) working
  4. **Deny** → confirm the friendly fallback message appears and the
     page continues working normally with manual filters
  5. Deny, then click the button again in the same session → confirm
     it does **not** re-prompt (per the "don't nag after denial"
     requirement)
  6. Test with geolocation unsupported/unavailable (e.g. via browser
     dev tools' geolocation override, or a browser/device without
     GPS) → confirm a graceful message, not a broken page
  7. Confirm nothing about the user's coordinates appears in
     localStorage, sessionStorage, or any network request to Supabase
     (check browser dev tools' Application and Network tabs)
- **Regression check on everything Phase 2A was told not to break**:
  property loading, existing filters, Wishlist, Shortlist,
  Authentication, property detail navigation, Enquiry/WhatsApp/Call
  buttons, CMS functionality — all should behave exactly as before
  Phase 2A on every page not listed as modified.
- **Mobile layout** — the near-me widget, radius chips, and new filter
  fields on small screens; confirm the near-me panel doesn't take
  excessive screen space as required.
- **Console check** — open browser dev tools on `properties.html` and
  `property.html` and confirm no JavaScript errors during normal use
  and during the location flow (allow, deny, and unsupported cases).

---

## Recent Searches fix — validation

**Automated checks performed:**
- `js/recent-searches.js`, `js/home-app-experience.js` (refactored),
  `js/properties-search.js` (updated) all pass `node --check`.
- `index.html` and `properties.html` each confirmed to have exactly
  one `</head>` after edits.
- All 25+ JSON-LD blocks across every page re-validated as parseable
  JSON after these edits — Phase 1's SEO structured data untouched.
- Confirmed via `diff` against the pristine original: only
  `index.html`, `properties.html`, `js/home-app-experience.js`,
  `js/properties-search.js`, plus new `js/recent-searches.js`, changed
  for this fix. `style.css` and `admin/` remain byte-identical.
- Confirmed the new/expanded IDs
  (`sfRecentSearchesChips`/`sfAllRecentSearchesBtn`/
  `sfRecentSearchesExpanded` on properties.html,
  `recentSearchesExpanded` on index.html) are present in the markup.

**Manual test walkthrough (all 19 steps from your list) — needs a real
browser, listed here as exactly what to check:**
1. Open `properties.html` → confirm "Recent Search" row appears
   (empty state: "No recent searches yet.")
2. Perform a search (e.g. Location: Pallikaranai, Type: Apartment,
   Beds: 2) → confirm a chip appears immediately under Recent Search
   on this same page, without navigating away
3. Perform a second, different search → confirm the newest appears
   first in the chip row
4. Refresh the page → confirm both searches persist (localStorage)
5. Click a recent-search chip → confirm it navigates to
   `properties.html` with the exact same filters restored and applied
   (location, type, beds, price, facing/furnishing/parking/road-width
   if set)
6. Click "All Recent Searches" → confirm a full vertical list appears
   with every saved search, each with a remove (×) button
7. Click remove on one entry → confirm it disappears immediately, the
   rest remain
8. Click "Clear All Recent Searches" → confirm the list empties and
   "No recent searches yet." appears
9. Repeat steps 1-8 with the homepage (`index.html`) hero search bar —
   confirm it still works and shares the same saved-search list as
   properties.html (a search from either page shows up in both)
10. Test on mobile viewport — confirm the recent-search row and
    expanded list don't overflow or break layout
11. Test with malformed/empty filter state (e.g. clicking a filter
    then immediately clearing it) → confirm nothing broken is saved
    (an all-empty search is correctly never recorded, matching the
    original design intent)
12. Open browser dev tools console throughout → confirm no JavaScript
    errors during any of the above

**Known limitation:** the visual placement of the Recent Search row on
`properties.html` (nested inside the results section, above the
results bar) reuses the homepage's existing CSS classes with a small
override to remove the full-bleed background — worth a quick visual
check to confirm it reads cleanly in that new context, since it wasn't
originally designed to appear there.
