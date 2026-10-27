-- ============================================================
-- PROPOSAL (NOT APPLIED) — property_translations
-- Review before running. Do not run on production without approval.
--
-- Stores translated listing text separately from `properties`.
-- The English source rows are never modified.
-- Key: (property_id, lang, field).
--
-- Visibility: the public site shows ONLY rows with status = 'approved'.
-- 'machine' (unreviewed), 'stale' (English changed afterwards) and
-- 'rejected' rows are hidden from the public, so the site falls back to the
-- English original. Admins can read every row (to review them).
-- Depends on public.is_admin() from migration-2026-09-25-01-p0-security-roles.sql.
-- ============================================================

create table if not exists public.property_translations (
    property_id  uuid not null references public.properties(id) on delete cascade,
    lang         text not null check (lang in ('ta','hi','te','kn','ml')),
    field        text not null check (field in
                   ('title','short_description','description','location','features','seo_title','seo_description','seo_keywords')),
    -- string for text fields; JSON array of strings for `features`
    value        jsonb not null,
    -- sha256 (hex) of the English source text when translated:
    --   text fields: the text; features: array_to_string(features, E'\n')
    source_hash  text not null,
    status       text not null default 'machine' check (status in ('machine','approved','stale','rejected')),
    provider     text,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now(),
    primary key (property_id, lang, field),
    -- text fields hold a JSON string; features holds a JSON array of strings
    constraint property_translations_value_shape check (
        (field = 'features' and jsonb_typeof(value) = 'array')
        or (field <> 'features' and jsonb_typeof(value) = 'string')
    )
);

create index if not exists property_translations_lang_idx on public.property_translations (lang, status);

alter table public.property_translations enable row level security;

-- Explicit least-privilege grants (RLS still applies on top of these).
revoke all on public.property_translations from anon, authenticated;
grant select on public.property_translations to anon, authenticated;
grant insert, update, delete on public.property_translations to authenticated; -- admin policy only
grant all on public.property_translations to service_role;                      -- Edge Function

-- Public: read approved translations of published properties only.
drop policy if exists "Public can read approved translations of published properties" on public.property_translations;
create policy "Public can read approved translations of published properties"
    on public.property_translations for select
    to anon, authenticated
    using (
        status = 'approved'
        and exists (select 1 from public.properties p
                    where p.id = property_id and p.publish_status = 'Published')
    );

-- Admin: full access (review, edit, reject, approve).
drop policy if exists "Admins manage translations" on public.property_translations;
create policy "Admins manage translations"
    on public.property_translations for all
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());

-- Keep updated_at current.
create or replace function public.property_translations_touch()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;
drop trigger if exists trg_property_translations_touch on public.property_translations;
create trigger trg_property_translations_touch
before update on public.property_translations
for each row execute function public.property_translations_touch();

-- When an English field is edited, mark the matching translations stale
-- so outdated text is never shown next to new English facts. A 'rejected' row
-- also becomes stale, so the corrected English can be translated again.
create or replace function public.property_translations_mark_stale()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  begin
    update public.property_translations t
       set status = 'stale'
     where t.property_id = new.id
       and t.status in ('machine','approved','rejected')
       and t.source_hash <> encode(sha256(convert_to(coalesce(
             case t.field
               when 'title'             then new.title
               when 'short_description' then new.short_description
               when 'description'       then new.description
               when 'location'          then new.location
               when 'seo_title'         then new.seo_title
               when 'seo_description'   then new.seo_description
               when 'seo_keywords'      then new.seo_keywords
               when 'features'          then array_to_string(new.features, E'\n')
             end, ''), 'UTF8')), 'hex');
  exception when others then
    -- never block an admin's property edit because of translation bookkeeping
    raise warning 'property_translations_mark_stale failed: %', sqlerrm;
  end;
    return new;
end;
$$;
drop trigger if exists trg_properties_translations_stale on public.properties;
create trigger trg_properties_translations_stale
after update of title, short_description, description, location, seo_title, seo_description, seo_keywords, features
on public.properties
for each row execute function public.property_translations_mark_stale();

-- Trigger functions are not meant to be called by clients.
revoke all on function public.property_translations_mark_stale() from public, anon, authenticated;
revoke all on function public.property_translations_touch() from public, anon, authenticated;

-- ============================================================
-- REVIEW WORKFLOW (run by an admin in the Supabase SQL editor)
-- ============================================================
-- 1. See machine translations awaiting review (side by side with English):
--    select p.title as english, t.value #>> '{}' as tamil, t.property_id, t.field
--      from property_translations t join properties p on p.id = t.property_id
--     where t.lang = 'ta' and t.status = 'machine' and t.field = 'title';
-- 2. Correct a translation (keeps it unapproved until you approve it):
--    update property_translations set value = to_jsonb('<corrected text>'::text)
--     where property_id = '<id>' and lang='ta' and field='title';
-- 3. Approve one property's Tamil text after a human has checked it:
--    update property_translations set status='approved', provider = coalesce(provider,'unknown') || '+human-reviewed'
--     where property_id = '<id>' and lang='ta' and status='machine';
-- 4. Reject a bad translation (hidden; not re-billed unless English changes):
--    update property_translations set status='rejected' where ...;

-- ============================================================
-- ROLLBACK (removes only the new objects; `properties` data is untouched)
-- ============================================================
-- drop trigger  if exists trg_properties_translations_stale on public.properties;
-- drop function if exists public.property_translations_mark_stale();
-- drop table    if exists public.property_translations;   -- also drops its policies, index, touch trigger
-- drop function if exists public.property_translations_touch();
