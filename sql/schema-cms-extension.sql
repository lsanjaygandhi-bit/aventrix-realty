-- ============================================================
-- AVENTRIX REALTY — CMS EXTENSION SCHEMA
-- Run AFTER sql/schema.sql, in Supabase → SQL Editor → New query.
--
-- SAFETY NOTES:
--   * Every statement is additive: "create table if not exists",
--     "add column if not exists", "on conflict do nothing".
--   * Nothing here drops, renames, or alters any existing column
--     on `properties` or `enquiries`.
--   * `office_locations` is only ever extended with new columns —
--     its existing rows, columns and RLS policies are untouched.
--   * Safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- 1. PAGES  (structured hero/CTA fields + rich-text sections
--    per page, for Homepage / About / Services / Joint Venture /
--    NRI Services / List With Us / Free Valuation / Contact / FAQ)
-- ------------------------------------------------------------
create table if not exists pages (
    id               uuid primary key default gen_random_uuid(),
    page_key         text unique not null,   -- 'home', 'joint-venture', 'nri-services', ...
    page_label       text not null,          -- human label shown in Admin

    -- Structured hero fields (used by the shared "list-hero" pattern
    -- on Joint Venture / NRI Services / List With Us / Free Valuation
    -- / Insights, and by the homepage hero on index.html)
    hero_eyebrow     text,
    hero_title       text,
    hero_subtitle    text,
    hero_button_text text,
    hero_button_link text,
    hero_image_url   text,

    -- One rich-text block PER SECTION, not per sentence. Each item:
    -- { "key": "about-legacy", "heading": "...", "eyebrow": "...",
    --   "html": "<p>...</p>", "image_url": "...", "display_order": 0 }
    sections         jsonb default '[]',

    seo_title        text,
    seo_description  text,
    seo_keywords     text,
    og_image_url     text,

    publish_status   text default 'Published' check (publish_status in ('Draft', 'Published')),
    created_at       timestamptz default now(),
    updated_at       timestamptz default now()
);

drop trigger if exists trg_pages_updated_at on pages;
create trigger trg_pages_updated_at
before update on pages
for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- 2. TESTIMONIALS
-- ------------------------------------------------------------
create table if not exists testimonials (
    id             uuid primary key default gen_random_uuid(),
    client_name    text not null,
    client_role    text,           -- e.g. "Purchased Residential Plot, Chromepet"
    quote          text not null,
    photo_url      text,
    display_order  int default 0,
    publish_status text default 'Published' check (publish_status in ('Draft', 'Published')),
    created_at     timestamptz default now(),
    updated_at     timestamptz default now()
);

drop trigger if exists trg_testimonials_updated_at on testimonials;
create trigger trg_testimonials_updated_at
before update on testimonials
for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- 3. REALTORS  (replaces realtors-data.js as the source of truth)
-- ------------------------------------------------------------
create table if not exists realtors (
    id               uuid primary key default gen_random_uuid(),
    slug             text unique not null,     -- used in realtor-profile.html?id=<slug>
    name             text not null,
    designation      text,
    photo_url        text,
    short_intro      text,
    about            text,
    expertise        text[] default '{}',
    experience       text,                     -- e.g. "10+ Years"
    languages        text[] default '{}',
    specializations  text[] default '{}',
    phone            text,
    email            text,
    whatsapp         text,
    profile_link     text,                     -- optional override, e.g. 'sanjay.html'
    display_order    int default 0,
    publish_status   text default 'Published' check (publish_status in ('Draft', 'Published')),
    created_at       timestamptz default now(),
    updated_at       timestamptz default now()
);

drop trigger if exists trg_realtors_updated_at on realtors;
create trigger trg_realtors_updated_at
before update on realtors
for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- 4. INSIGHTS  (articles shown on insights.html)
-- ------------------------------------------------------------
create table if not exists insights (
    id               uuid primary key default gen_random_uuid(),
    slug             text unique not null,
    title            text not null,
    excerpt          text,
    body             text,          -- rich text (HTML)
    cover_image_url  text,
    category         text,
    seo_title        text,
    seo_description  text,
    seo_keywords     text,
    display_order    int default 0,
    publish_status   text default 'Draft' check (publish_status in ('Draft', 'Published')),
    published_at     timestamptz,
    created_at       timestamptz default now(),
    updated_at       timestamptz default now()
);

drop trigger if exists trg_insights_updated_at on insights;
create trigger trg_insights_updated_at
before update on insights
for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- 5. MEDIA LIBRARY  (index of uploads for browsing/reuse)
-- ------------------------------------------------------------
create table if not exists media_library (
    id          uuid primary key default gen_random_uuid(),
    file_url    text not null,
    file_name   text,
    alt_text    text,
    uploaded_at timestamptz default now()
);

-- ------------------------------------------------------------
-- 6. SITE SETTINGS — additive columns only (existing hero_title,
--    hero_subtitle, hero_tagline, realtor_phone_1, realtor_email
--    columns are untouched)
-- ------------------------------------------------------------
alter table site_settings add column if not exists realtor_phone_1_display text;
alter table site_settings add column if not exists realtor_phone_2 text;
alter table site_settings add column if not exists whatsapp_number text;
alter table site_settings add column if not exists logo_url text;
alter table site_settings add column if not exists favicon_url text;
alter table site_settings add column if not exists footer_tagline text;
alter table site_settings add column if not exists footer_description text;
alter table site_settings add column if not exists copyright_text text;
alter table site_settings add column if not exists social_facebook text;
alter table site_settings add column if not exists social_instagram text;
alter table site_settings add column if not exists social_linkedin text;
alter table site_settings add column if not exists social_youtube text;

-- ------------------------------------------------------------
-- 7. OFFICE LOCATIONS — additive columns only (existing columns
--    and both seeded rows are untouched)
-- ------------------------------------------------------------
alter table office_locations add column if not exists email text;
alter table office_locations add column if not exists business_hours text;
alter table office_locations add column if not exists maps_embed_url text;
alter table office_locations add column if not exists latitude numeric;
alter table office_locations add column if not exists longitude numeric;
alter table office_locations add column if not exists image_url text;

-- ============================================================
-- ROW LEVEL SECURITY — new tables only. Same model as the rest
-- of the project: any authenticated user = admin.
-- ============================================================

alter table pages enable row level security;
alter table testimonials enable row level security;
alter table realtors enable row level security;
alter table insights enable row level security;
alter table media_library enable row level security;

-- PAGES: always public-readable (no draft concept blocks display;
-- publish_status exists for future use), admin full access
drop policy if exists "Public can view published pages" on pages;
create policy "Public can view published pages"
on pages for select
to anon
using (publish_status = 'Published');

drop policy if exists "Admin full access to pages" on pages;
create policy "Admin full access to pages"
on pages for all
to authenticated
using (true) with check (true);

-- TESTIMONIALS
drop policy if exists "Public can view published testimonials" on testimonials;
create policy "Public can view published testimonials"
on testimonials for select
to anon
using (publish_status = 'Published');

drop policy if exists "Admin full access to testimonials" on testimonials;
create policy "Admin full access to testimonials"
on testimonials for all
to authenticated
using (true) with check (true);

-- REALTORS
drop policy if exists "Public can view published realtors" on realtors;
create policy "Public can view published realtors"
on realtors for select
to anon
using (publish_status = 'Published');

drop policy if exists "Admin full access to realtors" on realtors;
create policy "Admin full access to realtors"
on realtors for all
to authenticated
using (true) with check (true);

-- INSIGHTS
drop policy if exists "Public can view published insights" on insights;
create policy "Public can view published insights"
on insights for select
to anon
using (publish_status = 'Published');

drop policy if exists "Admin full access to insights" on insights;
create policy "Admin full access to insights"
on insights for all
to authenticated
using (true) with check (true);

-- MEDIA LIBRARY — admin only (not a public-facing table)
drop policy if exists "Admin full access to media_library" on media_library;
create policy "Admin full access to media_library"
on media_library for all
to authenticated
using (true) with check (true);
