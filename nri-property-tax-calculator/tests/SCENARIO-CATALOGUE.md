# Scenario Catalogue for Future Tax Engine Validation

These are test categories, not expected tax answers. A qualified professional must supply expected outputs before calculation logic is implemented.

1. Simple purchase and sale by individual non-resident
2. Joint ownership with partial sale share
3. Inherited property with predecessor cost/date
4. Gifted property
5. Purchase and sale dates around relevant rule effective dates
6. Missing purchase deed / uncertain cost
7. Sale value vs applicable stamp/guideline value
8. Improvements with and without supporting invoices
9. Transfer expenses with eligible/ineligible classifications
10. Buyer category and withholding workflow variations
11. Lower/nil deduction application pathway
12. Exemption/reinvestment eligibility and deadline checks
13. Current-year and carried-forward capital losses
14. Foreign tax residency / treaty review required
15. Repatriation checklist with bank documentation
16. Unsupported property/entity type triggers professional review
17. Incomplete or contradictory inputs stop automated estimate
18. Rounding, currency formatting and boundary conditions


## v10 manual smoke scenario — demo button

Use **Try sample calculation** on the hero. It fills synthetic data and opens Review. For the demo inputs (100% share; sale ₹2,00,00,000; purchase ₹1,00,00,000; purchase costs ₹5,00,000; transfer expenses ₹2,00,000; acquisition 1 Jan 2022; sale 25 Oct 2026; entered TDS scenario 12.5%; surcharge 0%):

- Sale consideration: ₹2,00,00,000
- Capital gain: ₹93,00,000
- Illustrative base LTCG tax at 12.5%: ₹11,62,500
- Illustrative cess at 4%: ₹46,500
- Illustrative final-tax estimate: ₹12,09,000
- Illustrative buyer TDS scenario (12.5% + 4% cess): ₹26,00,000
- Estimated net proceeds after scenario TDS and entered transfer costs: ₹1,71,80,000

These figures are only a software smoke-test for arithmetic. They are not CA-approved tax advice, and the entered TDS rate is not asserted as the legally applicable rate. Browser visual QA should verify the mobile header, hero, stepper, review cards, report preview, print stylesheet, and share action before release.
