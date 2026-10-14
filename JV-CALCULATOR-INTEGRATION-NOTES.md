# Aventrix Realty — JV Investment-Based Calculator Review Notes

Date: 2026-10-13

## Rebuilt model
- Starts with documented land area and market value per land sq.ft.; landowner contribution value = land area × land market rate.
- Captures road width (20/24/30/40/60 ft) and preliminary building category, but intentionally does not infer approved FSI from road width. Base FSI is a visible manual input to be verified for the exact site.
- Estimates net land for modelling, base/premium FSI-counted area, estimated saleable area, and gross development value.
- Builder investment includes construction cost on a selectable FSI-area or saleable-area basis, percentage-based soft costs, premium/statutory charges and other fixed costs.
- Displays total project cost including land contribution, project surplus, capital-contribution share as a reference only, proposed area/value allocation, developer surplus after investment, target profit, required developer share and comparison scenarios.

## Commercial logic
Land value and developer investment are different contributions. The landowner contribution reference is land value / (land value + developer investment); it is NOT a standard or recommended JV area ratio. The selected sharing scenario is evaluated separately against GDV, developer investment and target profit. The tool assumes equal selling value per saleable sq.ft. across allocations and is not a full residual valuation model.

## Regulatory limitation
FSI is deliberately manual. Road width alone is not sufficient to establish the permitted FSI, premium FSI, saleable area or approval. Verify the exact site, current amendments, land use, road width/length, setbacks, exclusions, high-rise category and statutory charges with a licensed architect and competent authority.

## QA performed
- Updated calculator IDs and script references checked.
- JavaScript syntax checked with Node.js.
- Formula spot-check: 10,000 sq.ft. saleable area at ₹4,800/sq.ft. gives GDV ₹4.8 crore; 50% developer allocation gives ₹2.4 crore gross allocation. If developer investment is ₹3.0 crore, developer surplus is -₹60 lakh, demonstrating why 50:50 is not automatically viable.
- ZIP integrity tested.

## Status
Local source ZIP only. Not deployed to Cloudflare Pages and not pushed to GitHub. The calculator remains exploratory and must be validated before production use.
