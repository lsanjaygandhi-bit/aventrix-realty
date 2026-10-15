# Aventrix Realty — Global Footer (2026-10-15)

Status: implemented and tested locally. Ready to push and deploy.

## How it works
- `partials/footer.html` is the single source of the footer markup.
- `python3 tools/sync-footer.py` copies it into every public page (static HTML, so it stays SEO-friendly and works without JavaScript) and adds `css/site-footer.css` to each page's `<head>`.
- `python3 tools/sync-footer.py --check` reports any page whose footer is out of date.
- To change the footer later: edit `partials/footer.html` (or `css/site-footer.css`), run the sync script, commit.
- `partials/` and `tools/` are listed in `.assetsignore`, so they are not uploaded by `npx wrangler deploy`.

## Files
| File | Change |
|---|---|
| `partials/footer.html` | New — shared footer markup |
| `css/site-footer.css` | New — footer styles, all scoped to `.site-footer` / `ft-` classes |
| `js/site-footer.js` | New — splits the CMS copyright string ("… Reserved. \| Designed with ❤️ …") onto two lines |
| `tools/sync-footer.py` | New — copies the partial into every page |
| `images/footer-skyline-gold.svg` | New — original night-skyline background (SVG), no stock imagery; drawn by `tools/make-footer-skyline.py` |
| `tools/make-footer-skyline.py` | New — draws the skyline SVG (fixed seed, same output every run) |
| `images/design/footer-reference.png` | New — the approved reference screenshot (design reference only) |
| `.github/workflows/sync-footer.yml` | New — GitHub Action: when `partials/footer.html` or the sync script changes on `main`, draws the skyline, runs the sync script and commits the updated pages |
| `.assetsignore` | Added `partials`, `tools` and `.github` |
| 33 HTML pages | Old `<footer class="premium-footer">` replaced by the shared footer + one stylesheet link |

Pages: about, account, brokerage-fees, commercial-investment, contact, emi-calculator, enquiry, free-valuation, gnanasekaran, government-services, index, insight, insights, joint-venture, jv-calculator, jv-feasibility, list-with-us, nri-services, our-realtors, privacy-policy, properties, property-checklists, property-tools, property-valuation, property, realtor-profile, sanjay, seller-landowner, services, shortlist, sitemap, terms, wishlist.
Not touched: `admin/`, and the stale duplicates `sitemap 2.html`, `terms 2.html`.

## Preserved hooks (CMS / Supabase)
`data-site="footer-tagline" | footer-description | copyright-text | social-facebook | social-instagram | social-linkedin | social-youtube | whatsapp-link` and `data-hq="name" | address | phones | email | maps | map-embed` — same attributes, same default values. The map iframe keeps the same Head Office embed URL; "Open in Maps" and the Maps icon keep the owner link `https://maps.app.goo.gl/Gfs3JJ4VVN4cxU5G7?g_st=ic`. `id="footer"` (used by the homepage "Footer" shortcut) is kept.

## Minor adjustments (responsive only)
- Phones: contact items 2 × 2; Follow Us heading above the icons below 520px; map 210px tall; bottom row keeps a right gutter so the floating Back-to-top/WhatsApp buttons never cover a link.
- Phones: the site's own "Open in Maps" button is hidden because Google's compact embed shows its own "Open in Maps" in the same place (as in the reference); from 768px up the site's button is shown at the map's top-right.
- Below 360px everything stacks to one column.
- Footer links were standardised to the reference set. Page-specific footer links that are no longer in the footer: account/wishlist/shortlist/properties had "Search Properties", "My Saved Properties", "Shortlist & Compare", "My Account" (still reachable from the header/account menu on those pages).

## Tests (Playwright, Supabase mocked, Google map mocked offline)
354 page × viewport runs — 33 pages at 390 and 1440, every page with CMS values at 320/375/390/430/700/768/1024/1440, plus spot pages at the other widths. Each run checks: exactly one footer and one `#footer`; no horizontal overflow; all required links present; the 7 items (copyright, designer credit, Privacy Policy, Terms & Conditions, Sitemap, Property Tools, Admin) in order; CMS copyright split onto two lines; map iframe present with an embed URL; Open in Maps visibility; icons loaded; no text below 11px; no JavaScript errors; floating buttons not covering bottom-row text at the end of the page. Result: 0 problems.

## Remaining / for review
- The live Google map could not be loaded in the test environment; check it once on a preview deploy.
- Old `.premium-footer` CSS in `style.css` / `css/site-fixes.css` is now unused by the main pages (still used by the two "* 2.html" duplicates); left in place, removable later.
- The reference's address reads "No. 27 … New Colony"; the footer shows the CMS/static value "No.27 … Newcolony" — edit it in Admin → Office Locations if you want the reference wording.
