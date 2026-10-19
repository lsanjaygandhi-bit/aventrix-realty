# Aventrix Realty Intelligence — Free-First Rollout Plan

Status: planning guidance for `feature/real-estate-intelligence`. This document does not authorize production deployment or a Supabase migration.

## Objective

Deliver useful website and lead intelligence without buying a new subscription, while protecting the existing Aventrix Realty website and Supabase data.

## Phase 0 — Use existing free dashboards (no code or database changes)

1. Enable Cloudflare Web Analytics for `aventrixrealty.com` in the Cloudflare dashboard, if it is available for the zone.
2. Verify page-view and visitor-trend reporting on the live site using Cloudflare's own dashboard.
3. Keep existing Supabase Auth, `property_events` / `property_performance`, enquiries, and CRM dashboards as the source of truth for registered accounts, property activity, and leads.
4. Do not promise person-level live visitor details from Cloudflare Web Analytics; its standard product is aggregate website analytics and does not provide custom event ingestion.

**Cost:** Intended to use existing/free capabilities. Confirm any account-specific limits in the dashboards before enabling optional features.

## Phase 1 — Reuse existing Aventrix data (no duplicate tables)

Before adding new database objects, document which existing views and tables already answer each admin question:

- Property views and engagement: existing `property_events` / `property_performance`.
- Enquiries and lead follow-up: existing `enquiries` and CRM records.
- Registered users: Supabase Auth, accessed only through an admin-authorized server-side function.
- Aggregate website traffic: Cloudflare Web Analytics.

Avoid creating a second copy of property events, leads, or CRM data.

## Phase 2 — Optional custom live visitor and login history

The custom tracking code and SQL proposal in this branch are **not production-ready merely because JavaScript syntax checks pass**. They require staging SQL/RLS checks, browser tests, privacy review, and abuse controls first.

A separate Supabase project may not be necessary if a genuinely isolated, free staging environment is available; do not assume a development branch is free. If no staging environment is available at zero additional cost, keep this phase on hold rather than applying untested SQL to the live database.

Before enabling this phase:
- Validate all new tables, policies, function grants, and admin RPCs using anonymous, customer, realtor, and admin roles.
- Configure and test appropriate Cloudflare-side rate limiting or a trusted ingestion endpoint. Client-generated visitor IDs alone are not an abuse-prevention mechanism.
- Confirm data retention, privacy wording, and which administrators can access account-linked login history.
- Test that login, enquiries, and normal page rendering still work when analytics RPCs fail.

## Dashboard truth-in-labeling

- “Live visitors” means sessions with a recent heartbeat, not verified unique people.
- “Registered users” is the account count/list available to the authorized admin function, subject to its cap.
- “Login history” starts only when custom recording is deployed; it is not a complete historical Supabase Auth audit log.
- “Page views” from the custom tracker are deduplicated by tab session and path; they are not identical to Cloudflare's aggregate page-view definition.

## Explicit no-go conditions

Do not merge/deploy the custom tracking feature or apply its SQL to production until staging validation is complete. Do not create a paid Supabase plan, branch, or project without explicit approval. Do not expose the Supabase service-role key to browser code.

## Recommended immediate next step

Start with Phase 0 in the Cloudflare dashboard and verify aggregate analytics. Keep PR #38 as a draft while Phase 2 remains untested. This provides a free baseline now without putting the production database at risk.
