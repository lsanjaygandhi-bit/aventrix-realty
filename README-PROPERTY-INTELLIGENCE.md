# Aventrix Realty — Property Intelligence Centre

Seven static pages under the site's shared header, footer and scripts. No database, Supabase schema, RLS or authentication changes. Nothing on these pages writes to Supabase.

## Files
| File | Purpose |
|---|---|
| `property-tools.html` | Hub: calculators (valuation, JV calculator, commercial, EMI) and guides |
| `property-valuation.html` | Self-service indicative valuation using Aventrix published rates or a visitor-entered rate; locality rate table |
| `property-checklists.html` | Flat / Land / Commercial / JV / Seller checklists; `?type=jv` etc. deep links; print / Save PDF |
| `jv-feasibility.html` | JV feasibility guide; links to the existing **jv-calculator.html** (no second calculator) |
| `commercial-investment.html` | Rental yield, NOI, cash flow, cash-on-cash, payback |
| `government-services.html` | Official portal links with a verification status and check date |
| `seller-landowner.html` | Route page: sell / lease / JV → the one existing page for each |
| `css/property-tools.css` | Styles for these pages only (scoped to `body.pt-page` and `pt-` classes) |
| `js/property-tools.js` | Checklist, valuation and commercial calculator behaviour |
| `data/market-rates.json` | Aventrix published locality rates (see below) |

The page frame is generated from `about.html` so the header is the real site header. If the shared header or footer changes, update the seven pages the same way as every other page (or regenerate them).

## Market rate data (Aventrix published rates)
- `data/market-rates.json` — the live dataset the valuation page reads (schema v2). `data/market-rates-review.csv` — the same data, one row per source, for review in Excel / Sheets.
- Full research notes: `MARKET-RATES-REPORT-2026-10-14.md`.

### How the page uses it
Only rows with `"status": "published"` are used. A row is matched when the visitor's locality equals `locality` or one of `aliases` (case, spaces and dots ignored) **and** the property type matches. No nearby or "similar" locality is ever substituted. No match → "Rate not yet available for this locality/property type" and the visitor enters their own rate.

### To add, edit, approve or withdraw a rate
1. Edit the row in `data/market-rates.json` (or add one with the fields below).
2. Each source needs `name`, `url`, `period`, `figure_as_published`, `value_used_per_sqft`, `checked` (YYYY-MM-DD). Never add a figure without a URL and date.
3. Recompute `low` (lowest source value), `high` (highest), `mid` (average of the two) and `sources_count` (number of different publishers).
4. Set `status` to `published` only when there are at least two independent publishers and you have reviewed it; otherwise `draft`. Set `last_checked`, and the top-level `last_reviewed`.
5. Commit, test locally (open `property-valuation.html` via a local server), then deploy as usual.

Row fields: `id, locality, aliases[], property_type (apartment|land|commercial), status (published|draft), rate_basis (asking|guideline|registered|opinion), area_basis (super_built_up|built_up|carpet|plot_area), unit ("sqft"), low, mid, high, sources_count, confidence (low|medium|high), last_checked, notes, sources[]`.

### Moving rate management into Admin (optional, needs approval)
`sql/proposal-2026-10-14-market-rates-NOT-APPLIED.sql` creates a `market_rates` table with the site's existing `publish_status` pattern and RLS (public reads Published rows; admins write via `is_admin()`), plus a check that a Published row has 2+ sources. It has **not** been run. Applying it, seeding it from the JSON and adding an Admin module is a separate step for your approval.

## Known limits
- Valuation output is arithmetic on the chosen rate, not a property valuation.
- The JV calculator is a simplified model; FSI / setbacks must be confirmed by a licensed architect.
- Government links marked "Not verified" could not be opened by the automated check on 14 Oct 2026.
- Checklist ticks are not persisted (by design — print / Save PDF to keep a copy).
