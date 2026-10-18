# Rate Limiting Design — Free Property Search

## Decision
Do not rely on CORS, request-size limits, or a counter held in the Edge Function process. They do not provide durable abuse protection.

## Recommended implementation
Use a shared, server-side rate-limit store. Keep property reads on the Supabase anon key under the existing published-listing RLS policy. Use a server-only credential only for the rate-limit operation, never return it to the browser.

Suggested baseline limits (tune after observing legitimate traffic):
- 20 search requests per client IP per 10 minutes.
- 100 search requests per client IP per day.
- Return HTTP 429 with a generic JSON error and a `Retry-After` header when exceeded.
- Apply a global safety limit as well as per-IP limits.
- Do not store raw IP addresses longer than necessary; use a keyed HMAC/hash and set a retention policy.
- Reject malformed/oversized payloads before doing database work.
- Use only trusted proxy headers. Do not accept a client-supplied arbitrary IP header as authoritative.

## Supabase implementation options
1. A private Postgres rate-limit table plus a narrowly scoped RPC called by the Edge Function using a server-only key. Revoke direct execution from `anon` and `authenticated`; grant only the minimum required function privilege to the trusted server role. Add expiry/cleanup for old buckets.
2. An external managed rate-limit service integrated server-side, if a suitable account/service is already available.

Do not expose the rate-limit table or its write RPC to public clients. Do not use a process-local Map/counter; Edge Function instances can scale independently and restart.

## Release checklist
- [ ] Confirm chosen implementation and any database migration before deploying it.
- [ ] Verify the RPC/table cannot be called or read by anon/authenticated clients.
- [ ] Verify limits are shared across concurrent requests and multiple Edge Function instances.
- [ ] Verify 429 response includes `Retry-After`.
- [ ] Run valid English/Tamil search regression tests after rate limiting is enabled.
- [ ] Keep website widget disabled until all checks pass and explicit release approval is given.
