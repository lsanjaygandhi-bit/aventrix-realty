-- ============================================================
-- PROPOSAL (NOT APPLIED) — translation_runs (admin-only audit log)
-- Review before running. Do not run on production without approval.
-- Written only by the translate-property Edge Function (service role,
-- which bypasses RLS). Only admins can read. No one else has any access.
-- Never stores API keys, request bodies or translated text.
-- Depends on public.is_admin() (migration-2026-09-25-01-p0-security-roles.sql).
-- Billable runs only: dry-runs write nothing.
-- ============================================================

create table if not exists public.translation_runs (
    id                      uuid primary key default gen_random_uuid(),
    created_at              timestamptz not null default now(),
    requested_by            uuid references auth.users(id) on delete set null,
    langs                   text[] not null,
    property_id             uuid references public.properties(id) on delete set null,
    source_characters       integer not null check (source_characters >= 0),
    rows_written            integer not null default 0,
    rows_skipped_protected  integer not null default 0,
    status                  text not null check (status in ('completed','failed')),
    error                   text   -- generic, non-sensitive message only
);

create index if not exists translation_runs_created_idx
    on public.translation_runs (created_at desc);

alter table public.translation_runs enable row level security;

revoke all on public.translation_runs from anon, authenticated;
grant select on public.translation_runs to authenticated; -- admin-only via policy
grant all on public.translation_runs to service_role;      -- Edge Function

drop policy if exists "Admins read translation runs" on public.translation_runs;
create policy "Admins read translation runs"
    on public.translation_runs for select
    to authenticated
    using (public.is_admin());
-- No insert/update/delete policies: only the service role writes.

-- ROLLBACK
-- drop table if exists public.translation_runs;
