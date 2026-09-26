-- ============================================================
-- AVENTRIX REALTY — P1 MIGRATION: LEAD CRM + FOLLOW-UPS,
-- BUYER ACCOUNT DATA, PROPERTY ANALYTICS, DASHBOARD METRICS
-- File: sql/migration-2026-09-25-02-p1-crm-buyer-analytics.sql
-- Run AFTER: sql/migration-2026-09-25-01-p0-security-roles.sql
--            (uses is_admin() / is_staff() created there)
--
-- SAFETY:
--   * Additive only. Existing `enquiries` rows and columns are kept
--     exactly as they are; new CRM columns get safe defaults
--     (lead_stage 'NEW', lead_source 'Website').
--   * The existing status column (new/read) is kept — it still means
--     "has an admin opened this", separate from the sales stage.
--   * Every new table has RLS on from the moment it is created.
--   * Safe to re-run.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. ENQUIRIES → LEADS (CRM columns)
-- ------------------------------------------------------------
alter table public.enquiries add column if not exists lead_stage text not null default 'NEW';
alter table public.enquiries add column if not exists lead_source text not null default 'Website';
alter table public.enquiries add column if not exists property_slug text;          -- sent by the website; resolved below
alter table public.enquiries add column if not exists property_id uuid references public.properties(id) on delete set null;
alter table public.enquiries add column if not exists property_code text;
alter table public.enquiries add column if not exists requirement text;
alter table public.enquiries add column if not exists budget_min numeric;
alter table public.enquiries add column if not exists budget_max numeric;
alter table public.enquiries add column if not exists preferred_locations text[] default '{}';
alter table public.enquiries add column if not exists assigned_to uuid references auth.users(id) on delete set null;
alter table public.enquiries add column if not exists last_contact_at timestamptz;
alter table public.enquiries add column if not exists next_follow_up_at timestamptz;
alter table public.enquiries add column if not exists updated_at timestamptz default now();

do $$ begin
    alter table public.enquiries add constraint enquiries_lead_stage_check check (lead_stage in (
        'NEW', 'CONTACTED', 'REQUIREMENT_CONFIRMED', 'PROPERTY_SHARED',
        'SITE_VISIT', 'NEGOTIATION', 'BOOKED', 'CLOSED', 'LOST'));
exception when duplicate_object then null; end $$;

do $$ begin
    alter table public.enquiries add constraint enquiries_lead_source_check check (lead_source in (
        'Website', 'WhatsApp', 'Instagram', 'Facebook', 'Referral', 'Other'));
exception when duplicate_object then null; end $$;

create index if not exists idx_enquiries_lead_stage on public.enquiries (lead_stage);
create index if not exists idx_enquiries_next_follow_up on public.enquiries (next_follow_up_at) where next_follow_up_at is not null;
create index if not exists idx_enquiries_assigned_to on public.enquiries (assigned_to);
create index if not exists idx_enquiries_property_id on public.enquiries (property_id);
create index if not exists idx_enquiries_created_at on public.enquiries (created_at desc);

drop trigger if exists trg_enquiries_updated_at on public.enquiries;
create trigger trg_enquiries_updated_at
before update on public.enquiries
for each row execute function public.set_updated_at();

-- Public (website) inserts: force the CRM fields to safe values and
-- resolve property_slug → property_id / property_code server-side,
-- so a visitor can't invent a property code, assign a realtor, or
-- pre-set a stage. Replaces the P0 version of this function.
create or replace function public.guard_enquiry_insert()
returns trigger
language plpgsql
set search_path = public
as $$
declare
    prop record;
begin
    if current_user in ('anon', 'authenticated') and not public.is_staff() then
        new.status            := 'new';
        new.created_at        := now();
        new.lead_stage        := 'NEW';
        new.lead_source       := 'Website';
        new.assigned_to       := null;
        new.last_contact_at   := null;
        new.next_follow_up_at := null;
        new.property_id       := null;
        new.property_code     := null;
    end if;

    if new.property_id is null and new.property_slug is not null then
        select p.id, p.property_code into prop
        from public.properties p
        where p.slug = new.property_slug and p.publish_status = 'Published'
        limit 1;
        if found then
            new.property_id   := prop.id;
            new.property_code := prop.property_code;
        end if;
    elsif new.property_id is not null and new.property_code is null then
        select p.property_code into new.property_code from public.properties p where p.id = new.property_id;
    end if;
    return new;
end;
$$;
-- (trigger trg_guard_enquiry_insert already exists from P0 and
--  now runs this new body)

-- Realtors see and work only the leads assigned to them; they can't
-- re-assign a lead or change who submitted it.
drop policy if exists "Realtors can view assigned leads" on public.enquiries;
create policy "Realtors can view assigned leads"
on public.enquiries for select to authenticated
using (public.is_staff() and assigned_to = auth.uid());

drop policy if exists "Realtors can update assigned leads" on public.enquiries;
create policy "Realtors can update assigned leads"
on public.enquiries for update to authenticated
using (public.is_staff() and assigned_to = auth.uid())
with check (public.is_staff() and assigned_to = auth.uid());

create or replace function public.guard_enquiry_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    if current_user not in ('anon', 'authenticated') or public.is_admin() then
        return new;
    end if;
    if new.assigned_to is distinct from old.assigned_to
       or new.submitted_by is distinct from old.submitted_by
       or new.created_at is distinct from old.created_at
       or new.payload is distinct from old.payload then
        raise exception 'Only an admin can re-assign a lead or change its original submission.';
    end if;
    return new;
end;
$$;

drop trigger if exists trg_guard_enquiry_update on public.enquiries;
create trigger trg_guard_enquiry_update
before update on public.enquiries
for each row execute function public.guard_enquiry_update();

-- ------------------------------------------------------------
-- 2. LEAD NOTES (append-only history; the lead's latest state lives
--    on the enquiries row itself)
-- ------------------------------------------------------------
create table if not exists public.lead_notes (
    id           uuid primary key default gen_random_uuid(),
    enquiry_id   uuid not null references public.enquiries(id) on delete cascade,
    author_id    uuid references auth.users(id) on delete set null default auth.uid(),
    note         text not null check (length(trim(note)) > 0),
    created_at   timestamptz default now()
);
create index if not exists idx_lead_notes_enquiry on public.lead_notes (enquiry_id, created_at desc);

alter table public.lead_notes enable row level security;

drop policy if exists "Staff can read notes on visible leads" on public.lead_notes;
create policy "Staff can read notes on visible leads"
on public.lead_notes for select to authenticated
using (
    public.is_admin()
    or (public.is_staff() and exists (
        select 1 from public.enquiries e where e.id = enquiry_id and e.assigned_to = auth.uid()))
);

drop policy if exists "Staff can add notes on visible leads" on public.lead_notes;
create policy "Staff can add notes on visible leads"
on public.lead_notes for insert to authenticated
with check (
    author_id = auth.uid()
    and (public.is_admin()
         or (public.is_staff() and exists (
             select 1 from public.enquiries e where e.id = enquiry_id and e.assigned_to = auth.uid())))
);

drop policy if exists "Admins can delete notes" on public.lead_notes;
create policy "Admins can delete notes"
on public.lead_notes for delete to authenticated
using (public.is_admin());

-- ------------------------------------------------------------
-- 3. STAFF DIRECTORY (for the "Assign to" dropdown). Returns rows
--    only to staff; customers get nothing.
-- ------------------------------------------------------------
create or replace function public.staff_directory()
returns table (user_id uuid, role text, display_name text)
language sql stable security definer
set search_path = public
as $$
    select ur.user_id,
           ur.role,
           coalesce(nullif(r.name, ''), nullif(ap.name, ''), u.email, 'Staff') as display_name
    from public.user_roles ur
    join auth.users u on u.id = ur.user_id
    left join public.realtors r on r.id = ur.realtor_id
    left join public.admin_profiles ap on ap.id = ur.user_id
    where ur.role in ('admin', 'realtor')
      and public.is_staff()
    order by ur.role, display_name;
$$;
revoke all on function public.staff_directory() from public;
grant execute on function public.staff_directory() to authenticated;

-- ------------------------------------------------------------
-- 4. BUYER ACCOUNT DATA
-- ------------------------------------------------------------
create table if not exists public.customer_profiles (
    user_id        uuid primary key references auth.users(id) on delete cascade default auth.uid(),
    full_name      text,
    phone          text,
    preferred_contact text check (preferred_contact in ('Phone', 'WhatsApp', 'Email')),
    created_at     timestamptz default now(),
    updated_at     timestamptz default now()
);

create table if not exists public.buyer_requirements (
    user_id             uuid primary key references auth.users(id) on delete cascade default auth.uid(),
    transaction_type    text check (transaction_type in ('buy', 'rent', 'lease')),
    property_types      text[] default '{}',   -- values from js/property-taxonomy.js (category or sub_type)
    preferred_locations text[] default '{}',
    budget_min          numeric check (budget_min is null or budget_min >= 0),
    budget_max          numeric check (budget_max is null or budget_max >= 0),
    bhk                 int[]  default '{}',
    min_area_sqft       numeric check (min_area_sqft is null or min_area_sqft >= 0),
    parking_required    boolean default false,
    facing              text[] default '{}',
    furnishing          text[] default '{}',
    purpose             text check (purpose in ('self_use', 'investment', 'rental')),
    notes               text,
    created_at          timestamptz default now(),
    updated_at          timestamptz default now()
);

create table if not exists public.saved_searches (
    id               uuid primary key default gen_random_uuid(),
    user_id          uuid not null references auth.users(id) on delete cascade default auth.uid(),
    name             text not null check (length(trim(name)) between 1 and 120),
    query_string     text not null default '',   -- properties.html?<query_string> re-runs it exactly
    filters          jsonb not null default '{}',
    alerts_enabled   boolean not null default true,
    last_checked_at  timestamptz default now(),   -- alert engine (P2) looks for listings published after this
    created_at       timestamptz default now(),
    updated_at       timestamptz default now()
);
create index if not exists idx_saved_searches_user on public.saved_searches (user_id, created_at desc);

drop trigger if exists trg_customer_profiles_updated_at on public.customer_profiles;
create trigger trg_customer_profiles_updated_at before update on public.customer_profiles
for each row execute function public.set_updated_at();
drop trigger if exists trg_buyer_requirements_updated_at on public.buyer_requirements;
create trigger trg_buyer_requirements_updated_at before update on public.buyer_requirements
for each row execute function public.set_updated_at();
drop trigger if exists trg_saved_searches_updated_at on public.saved_searches;
create trigger trg_saved_searches_updated_at before update on public.saved_searches
for each row execute function public.set_updated_at();

alter table public.customer_profiles enable row level security;
alter table public.buyer_requirements enable row level security;
alter table public.saved_searches enable row level security;

-- Owner full access; admins can read (to serve the buyer).
drop policy if exists "Owner manages own profile" on public.customer_profiles;
create policy "Owner manages own profile" on public.customer_profiles for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "Admins read customer profiles" on public.customer_profiles;
create policy "Admins read customer profiles" on public.customer_profiles for select to authenticated
using (public.is_admin());

drop policy if exists "Owner manages own requirement" on public.buyer_requirements;
create policy "Owner manages own requirement" on public.buyer_requirements for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "Admins read requirements" on public.buyer_requirements;
create policy "Admins read requirements" on public.buyer_requirements for select to authenticated
using (public.is_admin());

drop policy if exists "Owner manages own saved searches" on public.saved_searches;
create policy "Owner manages own saved searches" on public.saved_searches for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "Admins read saved searches" on public.saved_searches;
create policy "Admins read saved searches" on public.saved_searches for select to authenticated
using (public.is_admin());

-- Existing wishlists / shortlists / recently_viewed policies were
-- granted to role "public" (auth.uid() = user_id); functionally
-- owner-only already. Tighten the role to authenticated and let
-- admins read shortlist/wishlist interest for property analytics.
drop policy if exists "Users manage their own wishlist" on public.wishlists;
create policy "Users manage their own wishlist" on public.wishlists for all to authenticated
using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users manage their own shortlist" on public.shortlists;
create policy "Users manage their own shortlist" on public.shortlists for all to authenticated
using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users manage their own recently viewed" on public.recently_viewed;
create policy "Users manage their own recently viewed" on public.recently_viewed for all to authenticated
using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 5. PROPERTY ANALYTICS (real events only)
-- ------------------------------------------------------------
create table if not exists public.property_events (
    id           bigint generated always as identity primary key,
    property_id  uuid not null references public.properties(id) on delete cascade,
    event_type   text not null check (event_type in (
                    'view', 'enquiry', 'whatsapp_click', 'call_click',
                    'wishlist_add', 'shortlist_add', 'share', 'site_visit_request')),
    visitor_key  text not null,              -- random per-browser id, not personal data
    user_id      uuid references auth.users(id) on delete set null,
    event_day    date not null default (now() at time zone 'Asia/Kolkata')::date,
    created_at   timestamptz default now()
);
-- One event of each type per visitor per property per day: repeat
-- refreshes/clicks can't inflate the numbers.
create unique index if not exists uq_property_events_daily
    on public.property_events (property_id, event_type, visitor_key, event_day);
create index if not exists idx_property_events_type_time on public.property_events (event_type, created_at desc);

alter table public.property_events enable row level security;
-- No direct insert policy: browsers must go through the function
-- below, which validates the property and event type.
drop policy if exists "Admins read property events" on public.property_events;
create policy "Admins read property events" on public.property_events for select to authenticated
using (public.is_admin());

create or replace function public.track_property_event(p_slug text, p_event_type text, p_visitor_key text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
    pid uuid;
begin
    if p_event_type not in ('view', 'enquiry', 'whatsapp_click', 'call_click',
                            'wishlist_add', 'shortlist_add', 'share', 'site_visit_request') then
        return;
    end if;
    if p_visitor_key is null or length(p_visitor_key) < 8 or length(p_visitor_key) > 64 then
        return;
    end if;
    -- Staff activity is not counted as customer interest.
    if public.is_staff() then
        return;
    end if;
    select id into pid from public.properties
    where slug = p_slug and publish_status = 'Published'
    limit 1;
    if pid is null then
        return;
    end if;
    insert into public.property_events (property_id, event_type, visitor_key, user_id)
    values (pid, p_event_type, p_visitor_key, auth.uid())
    on conflict do nothing;
end;
$$;
revoke all on function public.track_property_event(text, text, text) from public;
grant execute on function public.track_property_event(text, text, text) to anon, authenticated;

-- Per-property totals for the Admin dashboard. security_invoker makes
-- the view obey the caller's RLS (admins only see data).
create or replace view public.property_performance
with (security_invoker = on) as
select
    p.id,
    p.property_code,
    p.slug,
    p.title,
    p.publish_status,
    count(*) filter (where e.event_type = 'view')               as views,
    count(*) filter (where e.event_type = 'enquiry')            as enquiry_events,
    count(*) filter (where e.event_type = 'whatsapp_click')     as whatsapp_clicks,
    count(*) filter (where e.event_type = 'call_click')         as call_clicks,
    count(*) filter (where e.event_type = 'wishlist_add')       as wishlist_adds,
    count(*) filter (where e.event_type = 'shortlist_add')      as shortlist_adds,
    count(*) filter (where e.event_type = 'share')              as shares,
    count(*) filter (where e.event_type = 'site_visit_request') as site_visit_requests,
    (select count(*) from public.enquiries q where q.property_id = p.id) as leads
from public.properties p
left join public.property_events e on e.property_id = p.id
group by p.id;

-- ------------------------------------------------------------
-- 6. DASHBOARD METRICS — one round trip, admin only, real counts
-- ------------------------------------------------------------
create or replace function public.admin_dashboard_metrics()
returns jsonb
language plpgsql stable
set search_path = public
as $$
declare
    result jsonb;
    today_start timestamptz := date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';
    today_end   timestamptz := today_start + interval '1 day';
begin
    if not public.is_staff() then
        return null;
    end if;
    -- Runs as the caller: realtors automatically get only their own
    -- assigned leads through RLS.
    select jsonb_build_object(
        'properties_total',     (select count(*) from properties),
        'properties_published', (select count(*) from properties where publish_status = 'Published'),
        'properties_active',    (select count(*) from properties where publish_status = 'Published' and status in ('Available', 'Under Negotiation')),
        'leads_new',            (select count(*) from enquiries where lead_stage = 'NEW'),
        'leads_open',           (select count(*) from enquiries where lead_stage not in ('CLOSED', 'LOST')),
        'leads_site_visit',     (select count(*) from enquiries where lead_stage = 'SITE_VISIT'),
        'leads_negotiation',    (select count(*) from enquiries where lead_stage = 'NEGOTIATION'),
        'leads_booked',         (select count(*) from enquiries where lead_stage = 'BOOKED'),
        'leads_closed',         (select count(*) from enquiries where lead_stage = 'CLOSED'),
        'leads_lost',           (select count(*) from enquiries where lead_stage = 'LOST'),
        'enquiries_unread',     (select count(*) from enquiries where status = 'new'),
        'followups_overdue',    (select count(*) from enquiries where next_follow_up_at < today_start and lead_stage not in ('CLOSED', 'LOST')),
        'followups_today',      (select count(*) from enquiries where next_follow_up_at >= today_start and next_follow_up_at < today_end and lead_stage not in ('CLOSED', 'LOST')),
        'followups_upcoming',   (select count(*) from enquiries where next_follow_up_at >= today_end and lead_stage not in ('CLOSED', 'LOST')),
        'lead_sources',         coalesce((select jsonb_object_agg(lead_source, n) from (select lead_source, count(*) n from enquiries group by lead_source) s), '{}'::jsonb)
    ) into result;
    return result;
end;
$$;
revoke all on function public.admin_dashboard_metrics() from public;
grant execute on function public.admin_dashboard_metrics() to authenticated;

commit;

notify pgrst, 'reload schema';

-- ============================================================
-- ROLLBACK (removes only what this file added; enquiries keep their
-- original columns and rows):
--   drop view if exists public.property_performance;
--   drop function if exists public.admin_dashboard_metrics();
--   drop function if exists public.track_property_event(text, text, text);
--   drop function if exists public.staff_directory();
--   drop table if exists public.property_events, public.lead_notes,
--       public.saved_searches, public.buyer_requirements, public.customer_profiles;
--   drop trigger if exists trg_guard_enquiry_update on public.enquiries;
--   (CRM columns on enquiries can be left; they are nullable/defaulted.)
-- ============================================================
