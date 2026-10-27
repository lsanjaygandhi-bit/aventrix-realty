# Staging migration and rollback checklist: property_translations (NOT EXECUTED)

Prerequisite: a staging Supabase project/branch confirmed by the owner. None is confirmed yet.
Never run against production (gkrtjeygrqkglsadskcg) until staging passes and the owner approves.

## Before
1. Owner names the staging project ref. Staging must already have `properties` (id uuid), `user_roles` and `is_admin()`.
2. On staging run: `select column_name, data_type, udt_name from information_schema.columns where table_name='properties' and column_name in ('id','features');`
   Expect uuid and ARRAY/_text. If features is jsonb, change the trigger hashing first.
3. Confirm `select public.is_admin();` works for a test admin and the existing properties RLS policies exist.
4. Take a backup/snapshot of staging.

## Apply (staging)
1. Run the proposal SQL in the SQL editor (policies and triggers are idempotent).
2. Verify: table exists, RLS enabled, 2 policies, 2 triggers (touch, stale).

## Verify
- anon select returns 0 rows. Insert a machine row as admin: anon still sees 0. Set it to approved: anon sees it.
- A row for an unpublished property is not visible to anon.
- anon/customer insert, update and delete are denied.
- Edit a property title: the approved row becomes stale; editing price or images does not.
- A property edit still succeeds if the stale trigger errors.
- Bad shapes are rejected (features as string, title as array, lang 'fr').

## Rollback
Run the commented ROLLBACK block at the end of the proposal SQL. properties data is untouched.
Confirm the site and admin property edits still work.
