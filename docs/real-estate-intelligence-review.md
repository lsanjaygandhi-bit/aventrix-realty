# Aventrix Realty — Complete Real Estate Intelligence

Status: **Draft implementation on `feature/real-estate-intelligence`**. Not merged, not deployed, and the SQL proposal has not been applied to Supabase.

## Scope

- Site-wide page-path tracking with pseudonymous browser and tab IDs.
- Live-session estimate based on a heartbeat in the previous 2 minutes.
- Property-level analytics remain on the existing `property_events` and `property_performance` implementation.
- Registered user listing through an admin-only RPC that reads Supabase Auth users and joins customer profile name and phone when provided.
- Successful customer/staff login and logout history from explicit auth flows.
- Admin → Website Intelligence section with Live Visitors, Registered Users, Login History, and Page Activity tabs.
- Successful enquiry submissions send a site analytics event.

## Existing architecture preserved

GitHub repository → Cloudflare Pages/Workers → Supabase Auth/Postgres. The work adds files and an additive SQL proposal; it does not replace hosting, existing CRM tables, or the current property event table.

## Files added

- `sql/proposal-2026-10-19-real-estate-intelligence.sql` — proposed additive tables, functions, grants, and RLS.
- `sql/verify-real-estate-intelligence.sql` — read-only preflight/postflight checks for dependencies, RLS, policies, and function grants.
- `docs/real-estate-intelligence-staging-test-plan.md` — 24-case acceptance matrix and security go/no-go criteria.
- `js/aventrix-intelligence.js` — visitor/session/page activity client, including heartbeat restart after browser tab restoration.
- `admin/js/intelligence.js` — admin-only dashboard module with property performance and CRM summary tabs using explicit admin-checked RPCs.
- `privacy-policy.html` — privacy disclosure update for the proposed analytics feature.

## Files changed

- `js/supabase-client.js` — loads the tracking client on public pages using the shared Supabase client.
- `js/account-auth.js` — records successful customer login/logout events.
- `admin/js/auth.js` — records successful staff login/logout events.
- `js/enquiry-supabase.js` — records successful enquiry submission as a site event.
- `admin/dashboard.html` — adds Website Intelligence section and module script.
- `admin/js/dashboard-app.js` — adds navigation title and module loading.

## Data minimisation

The client sends a random browser key, a random tab/session key, an event type, pathname, and optional property slug. Query strings, referrers, IP address, user-agent, and precise location are not stored by this feature. Names/emails are only returned to the authenticated administrator through an admin-checked RPC.

Anonymous visitors cannot be identified by real name unless they submit identifying information or sign in. Login history begins after deployment; it does not backfill historical events. Live visitor count is an estimate and can remain stale until the 2-minute expiry.

## Read-only review performed

- Inspected all 39 top-level public HTML pages in the feature branch; each includes the shared Supabase client, which is the loader point for the site-wide analytics script. This is source coverage only; browser/runtime verification is still pending.
- Re-ran JavaScript syntax parsing with `new Function` on all seven changed JavaScript files (`admin/js/auth.js`, `admin/js/dashboard-app.js`, `admin/js/intelligence.js`, `js/account-auth.js`, `js/aventrix-intelligence.js`, `js/enquiry-supabase.js`, and `js/supabase-client.js`); all seven passed syntax parsing. This is not a browser/runtime test.
- Checked the Website Intelligence dashboard markup against the module's required status/table element IDs; both required IDs exist, all six tab identifiers are present, and the module script is included after the shared Supabase client. Browser behaviour and database RPCs remain untested.
- Added Property Performance and Lead & CRM Summary tabs, backed by explicit admin-checked RPCs over existing aggregate views; the original property events and CRM records are not duplicated.
- Fixed the live heartbeat lifecycle so it restarts when a page is restored from the browser back-forward cache.
- Updated `privacy-policy.html` to describe pseudonymous site activity, account-associated activity when signed in, and the new analytics purposes.
- Confirmed the connected Supabase schema contains the existing `public.is_admin()`, `public.is_staff()`, and `public.app_role()` functions.
- Confirmed `public.properties.slug` and `public.properties.publish_status` exist, and the current published literal is `Published`.
- Confirmed these checks using read-only SQL queries only. No Supabase schema, policy, data, or configuration was changed.
- Admin-only registered-user table includes phone from `customer_profiles`, falling back to phone explicitly provided in Supabase Auth signup metadata; existing accounts without either value remain blank.
- Customer signup asks for a mobile number and stores it in Supabase Auth user metadata so it is available before email-confirmation/login; the customer can later manage profile details through the existing profile page.


## Existing project security baseline (read-only advisory check, 2026-10-19)

The connected Supabase project currently has **no development branches**, so staging SQL/browser validation cannot be performed there yet without creating a separate branch or project. No branch was created because development branches may incur charges and need cost confirmation.

The Supabase security advisor also reports pre-existing project-level findings. These are not caused by this draft and were not changed as part of this work:

- Two existing SECURITY DEFINER views: `public.crm_dashboard` and `public.crm_dashboard_v2`.
- Four existing functions with mutable search paths: `public.set_property_code`, `public.set_updated_at`, `public.enforce_notification_read_only_update`, and `public.enforce_site_visit_customer_cancel_only`.
- Six existing SECURITY DEFINER functions executable by anon/authenticated roles, including `app_role()`, `is_admin()`, `is_staff()`, `protect_last_admin()`, `staff_directory()`, and `track_property_event(...)`. Their intended exposure must be reviewed individually; do not blindly revoke grants because current website flows may depend on them.
- Supabase Auth leaked-password protection is disabled.

These are baseline findings for the project owner to review separately. This PR does not modify those existing objects. The new admin intelligence RPCs use explicit server-side `public.is_admin()` checks, but still require staging validation and role-by-role tests.

## Before merge/deployment

1. Run the read-only preflight queries in `sql/verify-real-estate-intelligence.sql` against staging, then review the SQL proposal and run it only in a non-production Supabase project first.
2. Add/verify Cloudflare edge rate limiting or a trusted ingestion endpoint. The database function has soft per-visitor event and new-session caps, including heartbeats, with a composite `(visitor_key, last_seen_at)` index to support the session cap efficiently. Login event validation explicitly rejects null event types. These are defence-in-depth only: a public RPC cannot reliably stop an attacker who rotates visitor/session keys, so Cloudflare edge rate limiting or a trusted ingestion endpoint remains required.
3. Verify all public routes load the shared Supabase client and do not count staff/admin traffic. Check the heartbeat survives browser back-forward cache restoration.
4. Test anonymous, customer, realtor, and admin access separately; verify RLS denies non-admin reads of analytics, login history, and user lists.
5. Test mobile Safari and Chrome, blocked storage, tab restore, heartbeat expiry, and failed RPCs. Analytics failure must never break login, enquiries, or page rendering.
6. Confirm privacy notice/cookie disclosures are appropriate for the site's use of persistent pseudonymous identifiers.
7. Merge only after review; Cloudflare deployment is a separate step.

## Known limitations in this draft

- Visitor tracking source coverage was checked across all 39 top-level public HTML pages; runtime loading and behavior still need browser verification.
- Page views are de-duplicated per tab session and pathname; repeated refreshes of the same path in one tab are not counted repeatedly.
- Registered-user listing is capped at the latest 500 accounts.
- Login/logout history starts after rollout; it is not the complete Supabase Auth audit log.
- This draft has not been deployed or tested against a staging database/browser yet.
