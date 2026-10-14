# Aventrix Realty — Property Intelligence Centre (Phase 1 draft)

This change is additive and isolated on `feature/property-intelligence-centre`. It does not modify existing pages, existing JV integration, database schema, Supabase policies, production branch, or Cloudflare deployment.

## New files
- `property-tools.html` — tools hub
- `property-valuation.html` — property details form that prepares a WhatsApp enquiry; no street-rate dataset is claimed
- `property-checklists.html` — Flat, Land, Commercial, JV and Seller checklists; print/save PDF
- `jv-feasibility.html` — simplified scenario model
- `commercial-investment.html` — rental yield, NOI and cash-flow model
- `government-services.html` — official portal shortcuts
- `seller-landowner.html` — seller and landowner guidance
- `assets/style.css`, `assets/app.js`

## Known limits / QA before release
- Not yet linked into the existing site's shared header/footer or homepage; integration must preserve the existing navigation and brand system.
- Valuation enquiry is user-triggered WhatsApp only; there is no database storage or automatic submission.
- No verified street-wise transaction dataset or official guideline-value API is connected. Never invent rates; keep asking prices, transaction evidence and guideline values separate.
- JV model is intentionally simplified and does not calculate approvals, true residual land value, tax, financing schedule, IRR or all project risks. Confirm FSI/buildability with a qualified architect.
- Government links are shortcuts only; verify current official portal domains and service coverage before production.
- Checklist progress is not persisted. No Supabase schema or RLS changes were made.
- Run HTML/link/JS checks and test iOS Safari, Android Chrome, desktop and print layout. Obtain approval before merge or production deployment.
