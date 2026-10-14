# Aventrix Realty — Requested Fixes (14 October 2026)

## Confirmed requirements from the owner
1. Property Tools and every tool page must use the existing Aventrix Realty website header: existing logo image, light header styling, navigation order, spacing, and call button. Do not use the separate dark/black header.
2. Align the header consistently across Home and Property Tools pages. Keep the call-to-phone action visible on desktop and accessible from the mobile navigation.
3. Preserve the existing homepage hero design and brand presentation; do not replace it with a new visual system.
4. On the homepage, display property listings as a horizontal left-to-right scroll rail instead of a long vertical stack. Cards must remain readable and touch-scrollable on mobile.
5. Market Rates & Valuation should let visitors explore indicative area/property rates and estimate a value themselves. An enquiry/request may be optional, not the only way to get a valuation.
6. Keep Property Checklist and Commercial Investment tools if working.
7. Audit JV Feasibility against the existing Joint Venture calculator before adding or duplicating calculations.
8. Reduce repeated calls-to-action across Seller & Landowner Centre (valuation request, checklist, JV); make it a guide page linking to the existing tools.
9. Never label unverified online asking prices as verified transaction rates. Show source and last-updated date for market rates.
10. Keep these changes in the feature branch/source ZIP until owner approves production deployment.

## QA still required before merge/deployment
- Compare the desktop header against the current homepage screenshot.
- Test iPhone Safari and Android responsive navigation.
- Confirm call button and phone links work.
- Confirm the actual dynamically rendered homepage property-list container matches the horizontal-rail CSS selectors; adjust selector if the CMS renders a different class.
- Verify no duplicated JV logic, all official portal links, and valuation calculations.
- Confirm horizontal scrolling does not break card actions or accessibility.
