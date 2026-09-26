-- ============================================================
-- AVENTRIX REALTY — P0 SECURITY MIGRATION: ROLES + RLS HARDENING
-- File: sql/migration-2026-09-25-01-p0-security-roles.sql
-- Run in: Supabase → SQL Editor → New query → paste → Run
-- Run BEFORE: sql/migration-2026-09-25-02-p1-crm-buyer-analytics.sql
--
-- WHY (audited against the LIVE database on 2026-09-25):
--   1. admin_profiles has an INSERT policy "auth.uid() = id". Any
--      buyer who signs up on account.html could insert their own
--      admin_profiles row — and properties / enquiries / site_visits
--      / notifications all treat "has an admin_profiles row" as admin.
--      => any buyer could make themselves an administrator.
--   2. pages, testimonials, realtors, insights, media_library and
--      site_settings grant ALL to every authenticated user
--      (using (true)). Buyer signup is live, so any buyer could edit
--      the website, leadership profiles, contact numbers, etc.
--   3. Storage bucket property-images allows INSERT to anon and
--      UPDATE / DELETE to public. Anyone holding the public anon key
--      (it ships in every page) could upload, overwrite or delete
--      property photos without logging in.
--   4. office_locations has RLS enabled but ZERO policies, so the
--      public site silently falls back to static HTML and the Admin
--      "Office Locations" screen cannot read or save anything.
--   5. A customer who submitted a property could update their own
--      row to publish_status = 'Published' / is_featured = true.
--   6. A logged-in buyer's website enquiry is REJECTED (authenticated
--      insert policy requires submitted_by = auth.uid(), but the
--      website form never sends submitted_by).
--
-- WHAT THIS DOES:
--   * Adds ONE authorization table, public.user_roles
--     (admin | realtor | customer). No row = customer.
--   * Adds helper functions is_admin(), is_staff(), app_role().
--   * Back-fills every existing admin_profiles row whose role is
--     'Admin' as role 'admin' (live DB: exactly 1 row — Sanjay's).
--   * Rewrites every "any authenticated user" / "has admin_profiles
--     row" policy to use is_admin().
--   * Re-creates public read policies for anon AND authenticated
--     (a logged-in buyer must still see the public website).
--   * Locks property-images uploads to admins/realtors (plus a
--     per-user "customer-uploads/<uid>/" folder for customer listing
--     photos, in case the mobile app needs it).
--   * Adds guard triggers so non-admins cannot self-publish,
--     self-feature, or tamper with enquiry status.
--
-- WHAT THIS DOES NOT DO:
--   * No table or column is dropped. No row is deleted or changed
--     except: one INSERT per existing admin into user_roles, and
--     the policies listed below.
--   * admin_profiles is kept (display name / photo). It simply
--     stops being the source of admin permission.
--
-- IMPACT CHECK BEFORE RUNNING:
--   * Live DB had 1 auth user, who is the admin. No buyer loses
--     anything. Sanjay keeps full admin access via user_roles.
--   * If the Expo mobile app uploads customer photos to a path other
--     than customer-uploads/<user id>/..., those uploads will be
--     refused after this runs — align the app to that folder.
--
-- ROLLBACK: see the block at the very bottom of this file.
-- Safe to re-run (every statement is idempotent).
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. ROLE TABLE
-- ------------------------------------------------------------
create table if not exists public.user_roles (
    user_id     uuid primary key references auth.users(id) on delete cascade,
    role        text not null check (role in ('admin', 'realtor', 'customer')),
    realtor_id  uuid references public.realtors(id) on delete set null, -- links a realtor login to their public profile
    created_at  timestamptz default now(),
    updated_at  timestamptz default now()
);

comment on table public.user_roles is
    'Single source of truth for authorization. No row = customer. Only admins can write here.';

drop trigger if exists trg_user_roles_updated_at on public.user_roles;
create trigger trg_user_roles_updated_at
before update on public.user_roles
for each row execute function public.set_updated_at();

-- Back-fill existing admins (live: 1 row). Never downgrades anyone.
insert into public.user_roles (user_id, role)
select ap.id, 'admin'
from public.admin_profiles ap
where coalesce(lower(ap.role), 'admin') = 'admin'
on conflict (user_id) do nothing;

-- ------------------------------------------------------------
-- 2. HELPER FUNCTIONS (SECURITY DEFINER so they can read
--    user_roles regardless of the caller's own RLS; they only ever
--    answer questions about the CURRENT user)
-- ------------------------------------------------------------
create or replace function public.app_role()
returns text
language sql stable security definer
set search_path = public
as $$
    select case
        when auth.uid() is null then 'anon'
        else coalesce((select ur.role from public.user_roles ur where ur.user_id = auth.uid()), 'customer')
    end;
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
    select exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'admin');
$$;

create or replace function public.is_staff()
returns boolean
language sql stable security definer
set search_path = public
as $$
    select exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role in ('admin', 'realtor'));
$$;

revoke all on function public.app_role() from public;
revoke all on function public.is_admin() from public;
revoke all on function public.is_staff() from public;
grant execute on function public.app_role() to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_staff() to anon, authenticated;

-- Never allow the last admin to be removed or downgraded (prevents
-- locking yourself out of the Admin Panel by mistake).
create or replace function public.protect_last_admin()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
    if (tg_op = 'DELETE' and old.role = 'admin')
       or (tg_op = 'UPDATE' and old.role = 'admin' and new.role <> 'admin') then
        if (select count(*) from public.user_roles where role = 'admin' and user_id <> old.user_id) = 0 then
            raise exception 'Cannot remove the last remaining admin.';
        end if;
    end if;
    return coalesce(new, old);
end;
$$;

drop trigger if exists trg_protect_last_admin on public.user_roles;
create trigger trg_protect_last_admin
before update or delete on public.user_roles
for each row execute function public.protect_last_admin();

alter table public.user_roles enable row level security;

drop policy if exists "Users can view own role" on public.user_roles;
create policy "Users can view own role"
on public.user_roles for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Admins manage roles" on public.user_roles;
create policy "Admins manage roles"
on public.user_roles for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- ------------------------------------------------------------
-- 3. ADMIN_PROFILES — close the self-promotion hole
-- ------------------------------------------------------------
drop policy if exists "Admin can insert own profile" on public.admin_profiles;
drop policy if exists "Admins manage staff profiles" on public.admin_profiles;
create policy "Admins manage staff profiles"
on public.admin_profiles for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
-- "Admin can view own profile" and "Admin can update own profile"
-- are kept: they only ever touch the caller's own row, and the row
-- no longer grants any permission by itself.

-- ------------------------------------------------------------
-- 4. CMS TABLES — admin-only writes, public reads for everyone
-- ------------------------------------------------------------
-- pages
drop policy if exists "Admin full access to pages" on public.pages;
drop policy if exists "Public can view published pages" on public.pages;
create policy "Public can view published pages"
on public.pages for select to anon, authenticated
using (publish_status = 'Published' or public.is_admin());
create policy "Admin full access to pages"
on public.pages for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- testimonials
drop policy if exists "Admin full access to testimonials" on public.testimonials;
drop policy if exists "Public can view published testimonials" on public.testimonials;
create policy "Public can view published testimonials"
on public.testimonials for select to anon, authenticated
using (publish_status = 'Published' or public.is_admin());
create policy "Admin full access to testimonials"
on public.testimonials for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- realtors
drop policy if exists "Admin full access to realtors" on public.realtors;
drop policy if exists "Public can view published realtors" on public.realtors;
create policy "Public can view published realtors"
on public.realtors for select to anon, authenticated
using (publish_status = 'Published' or public.is_admin());
create policy "Admin full access to realtors"
on public.realtors for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- insights
drop policy if exists "Admin full access to insights" on public.insights;
drop policy if exists "Public can view published insights" on public.insights;
create policy "Public can view published insights"
on public.insights for select to anon, authenticated
using (publish_status = 'Published' or public.is_admin());
create policy "Admin full access to insights"
on public.insights for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- media_library (admin only, not public)
drop policy if exists "Admin full access to media_library" on public.media_library;
create policy "Admin full access to media_library"
on public.media_library for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- site_settings
drop policy if exists "Admin can update site settings" on public.site_settings;
drop policy if exists "Public can view site settings" on public.site_settings;
create policy "Public can view site settings"
on public.site_settings for select to anon, authenticated
using (true);
create policy "Admin can update site settings"
on public.site_settings for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- office_locations (had RLS on and NO policies at all)
drop policy if exists "Public can view published office locations" on public.office_locations;
drop policy if exists "Admin full access to office locations" on public.office_locations;
create policy "Public can view published office locations"
on public.office_locations for select to anon, authenticated
using (publish_status = 'Published' or public.is_admin());
create policy "Admin full access to office locations"
on public.office_locations for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------
-- 5. PROPERTIES
-- ------------------------------------------------------------
-- Which realtor login looks after a listing (optional). Realtors
-- can edit only listings they manage; only admins publish.
alter table public.properties add column if not exists managed_by uuid references auth.users(id) on delete set null;

drop policy if exists "Admin full access to properties" on public.properties;
create policy "Admin full access to properties"
on public.properties for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Realtors can view all properties" on public.properties;
create policy "Realtors can view all properties"
on public.properties for select to authenticated
using (public.is_staff());

drop policy if exists "Realtors can update managed properties" on public.properties;
create policy "Realtors can update managed properties"
on public.properties for update to authenticated
using (public.is_staff() and managed_by = auth.uid())
with check (public.is_staff() and managed_by = auth.uid());

-- Kept unchanged (already correctly scoped):
--   "Public can view published properties"            (anon)
--   "Authenticated users can view published properties"
--   "Customers can submit their own properties"
--   "Customers can view their own submitted properties"
--   "Customers can update their own submitted properties"
-- ...but the guard trigger below stops non-admins from publishing,
-- featuring, or re-assigning ownership.

create or replace function public.guard_property_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    -- SQL editor / service role (not an API role) and admins are trusted.
    if current_user not in ('anon', 'authenticated') or public.is_admin() then
        return new;
    end if;

    if tg_op = 'INSERT' then
        new.publish_status := 'Draft';
        new.is_featured    := false;
        new.managed_by     := null;
        if not public.is_staff() then
            new.submitted_by := auth.uid();
        end if;
        return new;
    end if;

    -- UPDATE by a non-admin
    if new.publish_status is distinct from old.publish_status
       or new.is_featured is distinct from old.is_featured
       or new.submitted_by is distinct from old.submitted_by
       or new.managed_by is distinct from old.managed_by
       or new.property_code is distinct from old.property_code then
        raise exception 'Only an admin can publish, feature, or re-assign a property.';
    end if;
    return new;
end;
$$;

drop trigger if exists trg_guard_property_write on public.properties;
create trigger trg_guard_property_write
before insert or update on public.properties
for each row execute function public.guard_property_write();

-- ------------------------------------------------------------
-- 6. ENQUIRIES
-- ------------------------------------------------------------
drop policy if exists "Admin full access to enquiries" on public.enquiries;
create policy "Admin full access to enquiries"
on public.enquiries for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- Two identical customer SELECT policies existed; keep one.
drop policy if exists "Customer can view own enquiries" on public.enquiries;
drop policy if exists "Customers can view their own enquiries" on public.enquiries;
create policy "Customers can view their own enquiries"
on public.enquiries for select to authenticated
using (submitted_by = auth.uid());

-- Logged-in visitors can submit website forms (fixes the silent
-- failure); submitted_by may be left empty or must be themselves.
drop policy if exists "Customers can submit their own enquiries" on public.enquiries;
create policy "Customers can submit their own enquiries"
on public.enquiries for insert to authenticated
with check (submitted_by is null or submitted_by = auth.uid());

drop policy if exists "Public can submit enquiries" on public.enquiries;
create policy "Public can submit enquiries"
on public.enquiries for insert to anon
with check (submitted_by is null);

create or replace function public.guard_enquiry_insert()
returns trigger
language plpgsql            -- SECURITY INVOKER on purpose: current_user is
set search_path = public    -- then the real API role (anon / authenticated)
as $$
begin
    -- Only browser (API) callers are restricted; admins/realtors and
    -- the SQL editor / service role are trusted.
    if current_user in ('anon', 'authenticated') and not public.is_staff() then
        new.status := 'new';
        new.created_at := now();
    end if;
    return new;
end;
$$;

drop trigger if exists trg_guard_enquiry_insert on public.enquiries;
create trigger trg_guard_enquiry_insert
before insert on public.enquiries
for each row execute function public.guard_enquiry_insert();

-- ------------------------------------------------------------
-- 7. SITE VISITS + NOTIFICATIONS (created by the mobile-app work;
--    switch their admin check from admin_profiles to is_admin())
-- ------------------------------------------------------------
drop policy if exists "Admin full access to site visits" on public.site_visits;
create policy "Admin full access to site visits"
on public.site_visits for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admin full access to notifications" on public.notifications;
create policy "Admin full access to notifications"
on public.notifications for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create or replace function public.enforce_notification_read_only_update()
returns trigger
language plpgsql
as $function$
begin
  if public.is_admin() then
    return new;
  end if;

  if new.customer_id is distinct from old.customer_id
     or new.title is distinct from old.title
     or new.message is distinct from old.message
     or new.related_screen is distinct from old.related_screen
     or new.related_id is distinct from old.related_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Customers may only mark their own notifications as read; no other change is allowed.';
  end if;

  return new;
end;
$function$;

create or replace function public.enforce_site_visit_customer_cancel_only()
returns trigger
language plpgsql
as $function$
begin
  if public.is_admin() then
    return new;
  end if;

  if new.customer_id is distinct from old.customer_id
     or new.property_id is distinct from old.property_id
     or new.requested_date is distinct from old.requested_date
     or new.requested_time is distinct from old.requested_time
     or new.notes is distinct from old.notes
     or old.status is distinct from 'Requested'
     or new.status is distinct from 'Cancelled' then
    raise exception 'Customers may only cancel their own Requested site visit; no other change is allowed.';
  end if;

  return new;
end;
$function$;

-- ------------------------------------------------------------
-- 8. STORAGE — property-images
-- ------------------------------------------------------------
drop policy if exists "Allow delete" on storage.objects;
drop policy if exists "Allow update" on storage.objects;
drop policy if exists "Allow uploads" on storage.objects;
drop policy if exists "Allow upload and view 107eh68_1" on storage.objects;  -- anon INSERT
drop policy if exists "Allow upload and view 107eh68_0" on storage.objects;  -- duplicate anon SELECT
-- "Public read property images" (public SELECT) is kept.

drop policy if exists "Staff can upload property images" on storage.objects;
create policy "Staff can upload property images"
on storage.objects for insert to authenticated
with check (
    bucket_id = 'property-images'
    and (
        public.is_staff()
        or ((storage.foldername(name))[1] = 'customer-uploads'
            and (storage.foldername(name))[2] = auth.uid()::text)
    )
);

drop policy if exists "Staff can update property images" on storage.objects;
create policy "Staff can update property images"
on storage.objects for update to authenticated
using (bucket_id = 'property-images' and public.is_staff())
with check (bucket_id = 'property-images' and public.is_staff());

drop policy if exists "Admin can delete property images" on storage.objects;
create policy "Admin can delete property images"
on storage.objects for delete to authenticated
using (bucket_id = 'property-images' and public.is_admin());

commit;

-- Refresh the API schema cache so the new function/table appear at once.
notify pgrst, 'reload schema';

-- ============================================================
-- ADDING A REALTOR LOGIN LATER (after they sign up on account.html
-- and confirm their email):
--   insert into public.user_roles (user_id, role, realtor_id)
--   select u.id, 'realtor', r.id
--   from auth.users u, public.realtors r
--   where u.email = 'realtor@example.com' and r.slug = 'their-profile-slug'
--   on conflict (user_id) do update set role = excluded.role, realtor_id = excluded.realtor_id;
--
-- ADDING A SECOND ADMIN:
--   insert into public.user_roles (user_id, role)
--   select id, 'admin' from auth.users where email = 'someone@example.com'
--   on conflict (user_id) do update set role = 'admin';
-- ============================================================

-- ============================================================
-- ROLLBACK (only if something goes wrong — restores the previous
-- "any logged-in user is admin" behaviour, which is INSECURE):
--   Re-run sql/schema.sql's and sql/schema-cms-extension.sql's
--   policy blocks, then:
--   drop trigger if exists trg_guard_property_write on public.properties;
--   drop trigger if exists trg_guard_enquiry_insert on public.enquiries;
-- The user_roles table and functions can be left in place harmlessly.
-- ============================================================
