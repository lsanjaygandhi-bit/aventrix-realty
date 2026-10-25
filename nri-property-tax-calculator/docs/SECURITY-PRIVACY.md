# Security & Privacy Notes

## Prototype
- Static local page only; no network calls and no persistent storage.
- Use fictional values only.
- No PAN, passport, bank details, or document uploads.

## Production design requirements
- Keep privileged database operations server-side.
- Validate all inputs server-side; client validation is convenience, not a security boundary.
- Use rate limiting, abuse monitoring and request-size limits.
- Avoid raw financial inputs in analytics/logs.
- Use explicit consent and a published privacy notice before any processing/storage.
- Store the minimum pseudonymous calculation summary necessary; define and test 30-day deletion if that retention model is approved.
- Prevent unauthorized access to reports and prevent predictable public report URLs.
- Document incident response, access logging and data deletion.
- Review existing Cloudflare Worker and Supabase policies before integration; do not relax existing policies for this feature.
