# Aventrix Realty Intelligence — Staging Test Plan

Status: prepared for staging; **not yet executed**. This document is a test specification, not evidence that the feature has passed runtime tests.

## Preconditions

- Use a dedicated non-production Supabase project and a preview deployment of branch `feature/real-estate-intelligence`.
- Do not run the proposal against production.
- Take a schema backup/snapshot of the staging project before applying the proposal.
- Apply `sql/verify-real-estate-intelligence.sql` read-only checks first; review expected objects and dependencies.
- Apply `sql/proposal-2026-10-19-real-estate-intelligence.sql` only after the staging owner approves it.
- Use test accounts with separate `admin`, `realtor`, and ordinary customer roles. Never use a real customer's credentials for access-control tests.

## Acceptance matrix

| ID | Scenario | Expected result | Status |
|---|---|---|---|
| T01 | Anonymous user opens a public page | A session and page-view event are recorded; no name/email is inferred | Not run |
| T02 | User moves to another path in same tab | Current path updates and a page view is recorded once per session/path | Not run |
| T03 | User opens two tabs | Two active tab sessions can appear; visitor identifier may be shared | Not run |
| T04 | Browser tab is hidden then shown | Heartbeat resumes while visible | Not run |
| T05 | Back/forward cache restores a page | Heartbeat timer restarts and active session is refreshed | Not run |
| T06 | No heartbeat for more than 2 minutes | Session stops counting as live | Not run |
| T07 | Query string contains a search term or personal-looking value | Stored page path contains pathname only, never query/hash | Not run |
| T08 | Property page uses a valid published slug | Event may include that published slug | Not run |
| T09 | Invalid/unpublished property slug is supplied | Stored property slug is null | Not run |
| T10 | Customer signs in and out successfully | Login/logout history records the authenticated user ID | Not run |
| T11 | Login fails | No successful-login event is recorded | Not run |
| T12 | Enquiry submission fails | No enquiry-success event is recorded | Not run |
| T13 | Enquiry is stored successfully | Site analytics enquiry event is recorded; existing CRM row remains intact | Not run |
| T14 | Anonymous client reads analytics tables directly | Denied | Not run |
| T15 | Customer/realtor calls admin user-list RPC | Denied by server-side role check | Not run |
| T16 | Admin calls admin user-list RPC | Only the capped user fields are returned | Not run |
| T17 | Customer/realtor calls property/CRM summary RPCs | Denied by server-side role check | Not run |
| T18 | Admin opens Website Intelligence | All six tabs load with database-backed data or a clear error | Not run |
| T19 | Migration is absent / RPC returns an error | Public browsing, authentication and enquiry flow continue working | Not run |
| T20 | Browser storage is blocked | Tracking degrades gracefully without breaking page operation | Not run |
| T21 | A public client rotates visitor/session IDs rapidly | Cloudflare edge rate limiting must limit abusive request volume; the SQL soft cap alone is not sufficient | Not run |
| T22 | Realtor/admin browses public pages | Staff sessions are not added to public visitor analytics | Not run |
| T23 | Existing property performance dashboard is compared before/after | Existing counts and CRM data are unchanged by this additive feature | Not run |
| T24 | Mobile Safari and Chrome are tested | No console errors or blocking overlays; tabs and tables remain usable | Not run |

## Security checks

1. Confirm RLS is enabled on all three new tables.
2. Confirm SELECT policies on visitor sessions, analytics events, and login history use `public.is_admin()`.
3. Confirm execute grants for `track_site_activity`, `record_login_activity`, `admin_intelligence_users`, `admin_intelligence_property_performance`, and `admin_intelligence_crm_summary` match the proposal.
4. Confirm all three admin RPCs reject both `anon` and authenticated non-admin users.
5. Verify the staff exclusion in `track_site_activity` for both admin and realtor sessions.
6. Verify the browser never receives a service-role key.
7. Review Cloudflare rate limiting or a trusted ingestion endpoint before public enablement; client-supplied random IDs are not an identity or abuse-prevention boundary.
8. Review analytics retention and privacy disclosure before enabling production collection.

## Go/no-go criteria

**No-go** if any role can read analytics/login data without admin permission, if a normal page/enquiry/login flow breaks when analytics fails, if the SQL migration changes existing business tables unexpectedly, or if public RPC abuse controls are not in place.

**Go to merge review** only after all required staging checks pass, failures are documented/fixed, and the final PR diff is reviewed. A successful syntax check alone is not a staging pass.
