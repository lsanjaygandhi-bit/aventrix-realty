-- ============================================================
-- AVENTRIX REALTY — LIVE SCHEMA DRIFT CAPTURE (2026-09-25)
--
-- DOCUMENTATION FILE. These objects EXIST in the live Supabase
-- project (gkrtjeygrqkglsadskcg) but were never saved in this
-- repository — they were created directly in the Supabase dashboard
-- during the buyer-account and mobile-app work. Captured here
-- (reconstructed from the live catalog) so the repo describes the
-- real database.
--
-- Running it against the live DB is a no-op (everything is
-- "if not exists"). Its policies are NOT repeated here — the
-- current, hardened policies live in:
--   sql/migration-2026-09-25-01-p0-security-roles.sql
--   sql/migration-2026-09-25-02-p1-crm-buyer-analytics.sql
--
-- Order to build a fresh database from scratch:
--   schema.sql → schema-cms-extension.sql → seed-cms-content.sql →
--   schema-cms-extension-2.sql → schema-quickview-extension.sql →
--   schema-property-specs-extension.sql → schema-search-filter-extension.sql →
--   THIS FILE → migration-2026-09-25-01-… → migration-2026-09-25-02-…
-- ============================================================

-- properties: taxonomy sub-type + customer-submitted listing fields
alter table public.properties add column if not exists sub_type text;
alter table public.properties add column if not exists submitted_by uuid references auth.users(id);
alter table public.properties add column if not exists contact_phone text;
alter table public.properties add column if not exists contact_email text;
alter table public.properties add column if not exists submitter_name text;
alter table public.properties add column if not exists owner_relationship text;
alter table public.properties add column if not exists owner_name text;
alter table public.properties add column if not exists owner_phone text;

-- enquiries: link to the logged-in submitter
alter table public.enquiries add column if not exists submitted_by uuid references auth.users(id);

-- Buyer account data (account-aware js/aventrix-storage.js)
create table if not exists public.wishlists (
    user_id       uuid not null references auth.users(id),
    property_slug text not null,
    created_at    timestamptz default now(),
    primary key (user_id, property_slug)
);
create table if not exists public.shortlists (
    user_id       uuid not null references auth.users(id),
    property_slug text not null,
    created_at    timestamptz default now(),
    primary key (user_id, property_slug)
);
create table if not exists public.recently_viewed (
    user_id       uuid not null references auth.users(id),
    property_slug text not null,
    viewed_at     timestamptz default now(),
    primary key (user_id, property_slug)
);
alter table public.wishlists enable row level security;
alter table public.shortlists enable row level security;
alter table public.recently_viewed enable row level security;

-- Staff display profile (name/photo). NOT an authorization source
-- after the P0 migration — see public.user_roles.
create table if not exists public.admin_profiles (
    id         uuid primary key references auth.users(id),
    name       text,
    role       text default 'Admin',
    photo_url  text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);
alter table public.admin_profiles enable row level security;
drop trigger if exists trg_admin_profiles_updated_at on public.admin_profiles;
create trigger trg_admin_profiles_updated_at before update on public.admin_profiles
for each row execute function public.set_updated_at();

-- Mobile app: site visit requests + in-app notifications
create table if not exists public.site_visits (
    id             uuid primary key default gen_random_uuid(),
    customer_id    uuid not null references auth.users(id),
    property_id    uuid not null references public.properties(id),
    requested_date date not null,
    requested_time time,
    status         text not null default 'Requested'
                   check (status in ('Requested', 'Confirmed', 'Completed', 'Cancelled')),
    notes          text,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);
create table if not exists public.notifications (
    id             uuid primary key default gen_random_uuid(),
    customer_id    uuid not null references auth.users(id),
    title          text not null,
    message        text not null,
    is_read        boolean not null default false,
    related_screen text,
    related_id     text,
    created_at     timestamptz not null default now()
);
alter table public.site_visits enable row level security;
alter table public.notifications enable row level security;

drop trigger if exists trg_site_visits_updated_at on public.site_visits;
create trigger trg_site_visits_updated_at before update on public.site_visits
for each row execute function public.set_updated_at();

-- Storage buckets (both public-read):
--   property-images  — listing photos
--   admin-photos     — staff profile photos (<user id>/<file>)
