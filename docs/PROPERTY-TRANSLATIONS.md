# Property translations

Property translations are stored separately from `public.properties` in
`public.property_translations`. The public website uses only approved,
source-current translations and otherwise displays the original English
property data. Images, prices, areas, IDs, slugs, coordinates and all other
property facts remain in the English source row.

The configured Supabase project is `gkrtjeygrqkglsadskcg`. A read-only check on
2026-10-27 found 35 published properties and confirmed that the
`property_translations` REST resource exists. No approved translation rows were
visible to the public API at that time. The public anon key cannot inspect
private machine-review rows, database policies, triggers or all table
constraints; do not treat an empty public result as proof that no admin-only
rows exist.

## One-time deployment prerequisites

1. In Supabase SQL Editor, inspect the existing table before applying any
   migration. Do not run `sql/proposal-2026-10-27-property-translations-NOT-APPLIED.sql`
   wholesale: the table already exists in the configured project.

   ```sql
   select column_name, data_type, udt_name
   from information_schema.columns
   where table_schema = 'public'
     and table_name = 'property_translations'
   order by ordinal_position;

   select policyname, cmd, roles, qual, with_check
   from pg_policies
   where schemaname = 'public'
     and tablename = 'property_translations';

   select trigger_name, event_manipulation, action_timing, action_statement
   from information_schema.triggers
   where event_object_schema = 'public'
     and event_object_table in ('properties', 'property_translations')
   order by event_object_table, trigger_name;
   ```

   The application and Edge Function expect `property_id`, `lang`, `field`,
   `value` (JSON string or feature array), `source_hash`, `status`, and
   `provider`. The public read policy must expose only approved translations
   for published properties; authenticated writes must be restricted to
   admins; property text edits must make affected translations stale. Add only
   missing or incorrect policies/triggers after comparing the actual schema.

2. Before deploying, review and apply
   `sql/migration-2026-10-27-property-translations-seo-keywords.sql` after
   checking the live field constraint. It adds `seo_keywords` to the allowed
   translation fields and makes changes to that English field mark its
   translations stale. It does not update property or translation records.

3. Ensure the existing server-side `OPENAI_API_KEY` Edge Function secret is
   configured for the project. The translation function reads it from
   `Deno.env` only; never put the key in frontend code, SQL, logs, or Git.

4. Provide project access to the Supabase CLI account and deploy the existing
   function from the repository root:

   ```sh
   supabase functions deploy translate-property --project-ref gkrtjeygrqkglsadskcg
   ```

## Generate, review and publish

1. Sign in as a Supabase admin and open **Admin → Property Translations**.
2. Choose one language and run **Estimate missing translations**. Review the
   property/field count and source-character workload estimate. OpenAI billing
   is token-based, so this number is not a dollar estimate. The estimate makes
   no provider call. Only select **Generate translations** after accepting the
   estimate and its explicit confirmation prompt. The function skips
   source-current translations and requires the confirmed count to match the
   dry-run estimate. Run the five languages separately.
3. Machine output is saved with `status = 'machine'` and is not public. Review
   each field against its current English source. Edit and save drafts where
   needed, then approve individual fields or all current fields for that
   property/language. Stale source hashes cannot be approved.
4. Repeat for Tamil (`ta`), Hindi (`hi`), Telugu (`te`), Kannada (`kn`), and
   Malayalam (`ml`). Verify the approved counts and test listing and detail
   pages in each locale.

The function calls OpenAI `gpt-4.1-mini` using the server-side
`OPENAI_API_KEY`, requires structured JSON output, and protects numeric facts
with placeholders. It writes each successful batch immediately. If a later
batch fails, it reports the failed language and rows already saved; rerun the
dry-run to continue without re-requesting source-current rows.
`translation_runs` is optional and is not present in the inspected project's
REST schema, so its best-effort audit insert may log a missing-table warning
until that separate proposal is reviewed and applied.

## Current access limits

The checked-out Supabase CLI session can see a different project, but the
configured project denied Edge Function and secret listing with HTTP 403. The
existing public OpenAI-backed assistant returned HTTP 502 on one minimal
connectivity check and did not provide an OpenAI response. Function logs and
secret status are unavailable, so whether `OPENAI_API_KEY` is missing, invalid,
or unable to bill could not be determined. Translation deployment and
generation must wait until an authorized project administrator can verify the
secret and inspect function logs. No translation run should be started before
that verification.
