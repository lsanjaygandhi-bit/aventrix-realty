# Aventrix Realty Master JV Calculator — Revised Specification

## Current changes
- Removed the manual market land-rate input from the calculator.
- Indicative residual land value is derived from GDV less builder project costs, funding cost where applicable, non-refundable landowner consideration, and target developer profit.
- The suggested landowner allocation ratio is derived from the residual value supported by the project; it is not a fixed 50:50 default.
- The Generate JV Proposal PDF action opens the proposal window immediately from the click event, then renders the branded proposal with its own Print / Save as PDF button.
- The proposal reports land area, road width, assumed/verified FSI, estimated saleable area, selling rate, GDV, construction costs, builder investment, residual land value, deposit treatment, sharing scenarios and disclaimers.

## Important calculation limitations
- This is a preliminary residual valuation model, not an independent market valuation or statutory valuation.
- FSI and saleable efficiency must be verified for the actual site and building design.
- Deposit treatment is an assumption and must match the JV agreement. Refundable deposit funding cost is estimated; a non-refundable payment is treated as upfront landowner consideration and reduces the remaining property allocation benchmark.
- A negative residual land value means the project assumptions do not support a positive land consideration at the entered target profit.
- Sharing ratios are negotiation scenarios, not a universal recommendation.

## PDF use
1. Open `joint-venture.html`.
2. Enter the project and cost assumptions.
3. Click `Generate JV Proposal PDF`.
4. The separate proposal window should open; use its `Print / Save as PDF` button and choose `Save as PDF`.

## Map link note
A Google Maps short link can identify a pin/place, but it does not provide parcel boundary coordinates or a measured boundary polygon to reproduce at scale. The linked location must be confirmed against a boundary screenshot or coordinates before changing any parcel outline. Do not infer legal boundaries from a pin alone.

## Validation
- JavaScript syntax checked with Node.js.
- ZIP archive integrity checked after packaging.
- Browser-level visual/PDF rendering and Google Maps boundary validation remain to be performed.
- No live deployment or GitHub push was performed.
