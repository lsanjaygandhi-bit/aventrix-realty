-- Add SEO keywords to the existing property_translations field allowlist.
-- Inspect the live constraint first. This migration changes no property or
-- translation records and deliberately fails if it cannot identify the
-- existing field allowlist unambiguously.
begin;

do $$
declare
    c record;
    found_field_check boolean := false;
begin
    for c in
        select conname
        from pg_constraint
        where conrelid = 'public.property_translations'::regclass
          and contype = 'c'
          and pg_get_constraintdef(oid) ilike '%field%'
          and pg_get_constraintdef(oid) ilike '%seo_description%'
    loop
        found_field_check := true;
        execute format(
            'alter table public.property_translations drop constraint %I',
            c.conname
        );
    end loop;

    if not found_field_check then
        raise exception 'Could not identify the existing property_translations field constraint; inspect its live schema before applying this migration';
    end if;

    alter table public.property_translations
        add constraint property_translations_field_check
        check (field in (
            'title',
            'short_description',
            'description',
            'location',
            'features',
            'seo_title',
            'seo_description',
            'seo_keywords'
        ));
end;
$$;

-- Keep this column in sync with all other translatable English source fields.
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
    raise warning 'property_translations_mark_stale failed: %', sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists trg_properties_translations_stale on public.properties;
create trigger trg_properties_translations_stale
after update of title, short_description, description, location, seo_title,
    seo_description, seo_keywords, features
on public.properties
for each row execute function public.property_translations_mark_stale();

revoke all on function public.property_translations_mark_stale()
    from public, anon, authenticated;

commit;
