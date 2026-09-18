# Phase 1 — Validation Report

These are the static/automated checks that could be run without a live
browser or deployment. They confirm the code is well-formed and internally
consistent. They do **not** replace opening the pages in a browser — see
"Still needs your manual testing" at the bottom.

## Automated checks performed

**1. JSON-LD structured data validity**
25 `<script type="application/ld+json">` blocks across all HTML pages,
parsed with a JSON parser. Result: **0 invalid** — every block is
well-formed JSON.

**2. HTML head-tag balance**
Every modified page has exactly one `</head>` tag (no double-insertion
from the edit scripts). Result: **all pages OK**.

**3. Form `action` attribute bug**
Re-scanned every page for the malformed `action="` pattern found during
the audit. Result: **no remaining broken form actions** on any page,
including the 6 pages where it was fixed.

**4. Canonical tag presence**
Checked every `.html` file for a `rel="canonical"` tag. Result: present
on every real page. The one exception, `home.html`, is a disconnected
legacy stub with placeholder `href="#"` nav links, not reachable from
the live site's navigation or Supabase content — left untouched as
out of scope, same as the rest of Phase 1's "don't touch what isn't
broken" rule.

**5. Noindex on utility pages**
`account.html`, `wishlist.html`, `shortlist.html`, `enquiry.html`
confirmed to carry `noindex, follow`.

**6. JavaScript syntax check**
`js/public-properties.js` passed `node --check` with no errors.

**7. Unchanged-file confirmation**
`style.css` confirmed byte-identical to the original via `diff`. A full
recursive diff between the original repo and this package confirms
exactly 21 files changed (19 modified + `robots.txt` + `sitemap.xml`
newly added) — nothing else in the project was touched.

**8. Sitemap/robots sanity**
`sitemap.xml` is well-formed XML; every URL uses the live domain
(`https://aventrixrealty.com`). `robots.txt` correctly disallows admin
and personal-account paths and references the sitemap.

## Still needs your manual testing

These require an actual browser/server and weren't possible in this
review package:
- Open each changed page locally or on a staging URL and confirm it
  still looks and behaves exactly as before (no visual regressions)
- Confirm the property detail page still loads correctly from Supabase
  and that the dynamic title/meta/canonical/JSON-LD actually populate
  in the browser (view page source after JS runs, or use
  browser dev tools → Elements tab)
- Test the Quick Enquiry form submission on the homepage, contact page,
  and joint-venture page after the `action` attribute fix
- Run the pages through Google's Rich Results Test and Schema Markup
  Validator once deployed, to confirm Google parses the structured data
  as expected (can't be tested pre-deployment since it needs a live URL)
- Mobile responsiveness spot-check (no CSS was touched, so this should
  be unaffected, but worth confirming)
- Confirm `robots.txt` and `sitemap.xml` are reachable at the site root
  once deployed
