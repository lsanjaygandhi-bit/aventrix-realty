# Free Property Search Assistant — Test Plan

Run these checks against a preview deployment before enabling the public widget. Do not use production activation as a test.

## Request validation
- [ ] OPTIONS preflight returns 204 for https://aventrixrealty.com.
- [ ] POST with valid JSON and a non-empty message returns JSON.
- [ ] GET returns 405.
- [ ] Malformed JSON returns 400.
- [ ] Empty message or message over 1,200 characters returns 400.
- [ ] Body over 5,000 characters returns 413.
- [ ] A browser-origin request from an unrelated origin is rejected with 403.

## Property search cases
Use actual published records in the current database and verify results against the listing pages:
- [ ] English location query, e.g. "property in Velachery".
- [ ] Tamil location query, e.g. "வேளச்சேரியில் வீடு".
- [ ] BHK query, e.g. "2 BHK".
- [ ] Budget query, e.g. "2 BHK under 70 lakhs".
- [ ] Plot/land query, e.g. "plot for sale".
- [ ] Rental query, e.g. "house for rent".
- [ ] Query that should have no matching result.
- [ ] A title containing BHK where the database bedrooms field is null.
- [ ] Every returned slug belongs to a Published row and opens the correct property page.
- [ ] Returned price and location match the published listing; the assistant does not claim current availability is guaranteed.

## Abuse protection gate
- [ ] Add and verify persistent server-side rate limiting before public activation. CORS checks and per-request input limits are not rate limiting.
- [ ] Confirm repeated requests receive 429 and a Retry-After header when the limit is exceeded.
- [ ] Confirm rate-limit state is shared across function instances (do not rely on a process-local counter).
- [ ] Check logs for errors and unexpected request volume.

## Release gate
- Keep the widget's `data-enabled="false"` until all applicable checks pass.
- Do not merge or enable the widget without explicit approval.
- Record the date, environment, test inputs, HTTP status codes, and observed results. Never mark an unrun check as passed.
