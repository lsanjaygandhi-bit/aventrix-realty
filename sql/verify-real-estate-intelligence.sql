-- AVENTRIX REALTY — INTELLIGENCE PREFLIGHT / POSTFLIGHT CHECKS
-- READ ONLY: this file does not create, alter, or delete anything.
-- Run against a staging Supabase project before and after applying the proposal.

-- 1) Existing dependencies required by the proposed migration.
select n.nspname as schema_name, p.proname as function_name,
       pg_get_function_identity_arguments(p.oid) as arguments,
       p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('is_admin', 'is_staff', 'app_role')
order by p.proname;

-- 2) Existing property fields used to validate listing slugs.
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'properties'
  and column_name in ('slug', 'publish_status')
order by column_name;

-- 3) Current publish-status values; used to confirm the exact published literal.
select publish_status, count(*) as listing_count
from public.properties
group by publish_status
order by listing_count desc;

-- 4) Proposed objects: before migration, these should be absent; after migration, present.
select object_name, object_kind, present
from (
  values
    ('site_visitor_sessions', 'table'),
    ('site_analytics_events', 'table'),
    ('user_login_history', 'table'),
    ('track_site_activity', 'function'),
    ('record_login_activity', 'function'),
    ('admin_intelligence_users', 'function'),
    ('admin_intelligence_property_performance', 'function'),
    ('admin_intelligence_crm_summary', 'function')
) as expected(object_name, object_kind)
cross join lateral (
  select case expected.object_kind
    when 'table' then to_regclass('public.' || expected.object_name) is not null
    when 'function' then exists (
      select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = expected.object_name
    )
    else false
  end as present
) found
order by object_kind, object_name;

-- 5) After migration: ensure RLS is enabled for all analytics tables.
select c.relname as table_name, c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as force_rls
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('site_visitor_sessions', 'site_analytics_events', 'user_login_history')
order by c.relname;

-- 6) After migration: inspect policies without returning visitor/customer data.
select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('site_visitor_sessions', 'site_analytics_events', 'user_login_history')
order by tablename, policyname;

-- 7) After migration: verify function execute grants.
select routine_name, grantee, privilege_type
from information_schema.routine_privileges
where specific_schema = 'public'
  and routine_name in ('track_site_activity', 'record_login_activity', 'admin_intelligence_users', 'admin_intelligence_property_performance', 'admin_intelligence_crm_summary')
order by routine_name, grantee, privilege_type;

-- Do not use this read-only checklist as a substitute for role-by-role
-- access tests with separate anonymous, customer, realtor, and admin sessions.
