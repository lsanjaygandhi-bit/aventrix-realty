-- ============================================================
-- AVENTRIX REALTY — SUPABASE SCHEMA
-- Run this once in Supabase: Dashboard → SQL Editor → New query
-- ============================================================

-- ------------------------------------------------------------
-- 1. PROPERTIES
-- ------------------------------------------------------------
create table if not exists properties (
    id                uuid primary key default gen_random_uuid(),
    property_code     text unique,                 -- auto-generated, e.g. AVX-000001
    slug              text unique not null,         -- used in property.html?id=<slug>
    title             text not null,
    category          text default 'residential',
    listing_type      text default 'sale' check (listing_type in ('sale', 'lease')),
    location          text,
    price_display     text,                         -- e.g. "₹1.14 Crore" (kept as free text to match existing design)
    short_description text,
    description       text,
    features          text[] default '{}',
    images            text[] default '{}',          -- public Storage URLs, first = hero image
    status            text default 'Available' check (status in ('Available', 'Sold', 'Under Negotiation', 'Rented')),
    publish_status    text default 'Draft' check (publish_status in ('Draft', 'Published')),
    is_featured       boolean default false,
    seo_title         text,
    seo_description   text,
    seo_keywords      text,
    created_at        timestamptz default now(),
    updated_at        timestamptz default now()
);

-- Friendly auto-incrementing ID: AVX-000001, AVX-000002, ...
create sequence if not exists properties_code_seq start 1;

create or replace function set_property_code()
returns trigger as $$
begin
    if new.property_code is null then
        new.property_code := 'AVX-' || lpad(nextval('properties_code_seq')::text, 6, '0');
    end if;
    return new;
end;
$$ language plpgsql;

drop trigger if exists trg_set_property_code on properties;
create trigger trg_set_property_code
before insert on properties
for each row execute function set_property_code();

-- Keep updated_at current on every edit
create or replace function set_updated_at()
returns trigger as $$
begin
    new.updated_at := now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists trg_properties_updated_at on properties;
create trigger trg_properties_updated_at
before update on properties
for each row execute function set_updated_at();

-- Featured image (single hero/thumbnail image), separate from the
-- `images` gallery array above. Added via ALTER so this script stays
-- safe to re-run against a database that already has the properties
-- table from before this field existed.
alter table properties add column if not exists featured_image text;

-- ------------------------------------------------------------
-- 2. ENQUIRIES  (captures every form on the public site)
-- ------------------------------------------------------------
create table if not exists enquiries (
    id          uuid primary key default gen_random_uuid(),
    form_type   text,          -- e.g. "Free Valuation", "Joint Venture"
    source_page text,          -- e.g. "free-valuation.html"
    name        text,
    phone       text,
    email       text,
    payload     jsonb default '{}',   -- every field the form submitted, verbatim
    status      text default 'new' check (status in ('new', 'read')),
    created_at  timestamptz default now()
);

-- ------------------------------------------------------------
-- 3. SITE SETTINGS  (single row, id = 1 — hero banner + contact info)
-- ------------------------------------------------------------
create table if not exists site_settings (
    id                 int primary key default 1,
    hero_title         text,
    hero_subtitle      text,
    hero_tagline       text,
    realtor_phone_1    text,
    realtor_phone_1_display text,
    realtor_email      text,
    updated_at         timestamptz default now()
);

insert into site_settings (id) values (1) on conflict (id) do nothing;

drop trigger if exists trg_settings_updated_at on site_settings;
create trigger trg_settings_updated_at
before update on site_settings
for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- 4. OFFICE LOCATIONS  (Head Office + any future branches)
-- ------------------------------------------------------------
-- NOTE: the public website currently displays office information
-- (Head Office + Adyar Branch) as static HTML directly in index.html
-- and the site footer, NOT from this table — an earlier dynamic
-- version of this feature was reverted because it could show a
-- fallback message instead of the real Head Office details if the
-- database wasn't reachable. This table and its Admin Panel screen
-- (Office Locations) are kept for record-keeping / possible future
-- use, but editing a row here will NOT currently change the live
-- site. To update office info on the site itself, edit the relevant
-- HTML files directly (search for "Head Office" / "Adyar Branch").
--
-- The Head Office row is seeded below and flagged is_head_office =
-- true; it is never removed or altered by this script on re-run
-- (unique name + `do nothing`).
create table if not exists office_locations (
    id             uuid primary key default gen_random_uuid(),
    name           text not null unique,          -- e.g. "Aventrix Realty – Head Office"
    address        text not null,
    phone          text,
    whatsapp       text,
    maps_url       text,                           -- Google Maps link; empty = not yet verified
    is_head_office boolean default false,
    display_order  int default 0,
    publish_status text default 'Published' check (publish_status in ('Draft', 'Published')),
    created_at     timestamptz default now(),
    updated_at     timestamptz default now()
);

drop trigger if exists trg_offices_updated_at on office_locations;
create trigger trg_offices_updated_at
before update on office_locations
for each row execute function set_updated_at();

-- Seed the existing Head Office (unchanged address/phone/map link).
insert into office_locations (name, address, phone, maps_url, is_head_office, display_order)
values (
    'Aventrix Realty – Head Office',
    'No.27, 1st Main Road, Newcolony, Chromepet, Chennai, Tamil Nadu',
    '+91 91768 87770',
    'https://maps.app.goo.gl/wQm9KBpQG9rEYFaX7?g_st=ic',
    true,
    0
)
on conflict (name) do nothing;

-- Seed the new Adyar Branch. maps_url left empty until verified.
insert into office_locations (name, address, phone, maps_url, is_head_office, display_order)
values (
    'Aventrix Realty – Adyar Branch',
    'No. 85, Padmini Complex, 2nd Floor, Gandhi Nagar, Adyar, Chennai – 600020, Tamil Nadu, India',
    '+91 91768 87770',
    '',
    false,
    1
)
on conflict (name) do nothing;

-- ============================================================
-- ROW LEVEL SECURITY
-- Model used: any authenticated Supabase Auth user = admin. This
-- fits a single-admin business. If you later add more admin users,
-- just add their email/password in Supabase Auth — no other change
-- is needed since every authenticated user is treated as an admin.
-- ============================================================

alter table properties enable row level security;
alter table enquiries enable row level security;
alter table site_settings enable row level security;

-- Public (anon key): can only read PUBLISHED properties
create policy "Public can view published properties"
on properties for select
to anon
using (publish_status = 'Published');

-- Admin (logged in): full read/write on properties
create policy "Admin full access to properties"
on properties for all
to authenticated
using (true)
with check (true);

-- Public: can submit enquiries, but never read them back
create policy "Public can submit enquiries"
on enquiries for insert
to anon
with check (true);

-- Admin: can read/update/delete enquiries
create policy "Admin full access to enquiries"
on enquiries for all
to authenticated
using (true)
with check (true);

-- Public: can read site settings (hero text, contact info)
create policy "Public can view site settings"
on site_settings for select
to anon
using (true);

-- Admin: can update site settings
create policy "Admin can update site settings"
on site_settings for all
to authenticated
using (true)
with check (true);

alter table office_locations enable row level security;

-- Public: can read published office locations (Head Office + branches)
create policy "Public can view published office locations"
on office_locations for select
to anon
using (publish_status = 'Published');

-- Admin: full read/write on office locations
create policy "Admin full access to office locations"
on office_locations for all
to authenticated
using (true)
with check (true);
