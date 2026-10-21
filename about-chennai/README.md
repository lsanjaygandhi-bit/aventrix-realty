# About Chennai — Integration Notes

## Route
- Public route: `/about-chennai/`
- Source file: `about-chennai/index.html`
- Scoped stylesheet: `css/about-chennai.css`
- Page interactions: `js/about-chennai.js`

## Integration choices
- Built from the supplied Aventrix Realty source ZIP.
- The shared site header and footer markup are retained from the existing Land Knowledge Centre page.
- New page styles are scoped to `.ac-page`; the shared header/footer styles were not edited.
- English-only initial release.
- Adds a page URL to `sitemap.xml`.
- No live deployment or Git push has been performed.

## Content and evidence policy
- Historical chronology is a research framework; every published event needs a specific source.
- Chennai District, Greater Chennai Corporation, CMA, Chengalpattu District and local-body boundaries must not be conflated.
- Government guideline values, registered transaction prices and market-price evidence are separate data series.
- No historic rupee values have been fabricated. Price section explicitly remains in research until the exact locality, street/survey identifier, unit, effective date and source are verified.
- Area cards are a research directory, not a statement of jurisdiction.

## Files added
- `about-chennai/index.html`
- `css/about-chennai.css`
- `js/about-chennai.js`
- `docs/ABOUT-CHENNAI-IMPLEMENTATION-REPORT.md`
- `docs/ABOUT-CHENNAI-SOURCE-REGISTER.md`

## QA checklist
1. Open `/about-chennai/` on desktop and mobile.
2. Test timeline filters and locality search/filter/clear controls.
3. Confirm existing shared header navigation and footer render as before.
4. Verify canonical URL and JSON-LD.
5. Check browser console for missing assets or JavaScript errors.
6. Before publication, review every historical claim and verify all future land-price entries against original sources.


### Hero image
The approved Madras-then / Chennai-now composite is stored at `images/about-chennai/madras-then-chennai-now.jpeg` and is used only by the About Chennai hero and social-preview metadata.
