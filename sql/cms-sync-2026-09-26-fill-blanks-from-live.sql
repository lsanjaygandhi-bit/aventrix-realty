-- ============================================================
-- AVENTRIX REALTY — ADMIN CMS SYNC FROM THE LIVE WEBSITE (2026-09-26)
-- File: sql/cms-sync-2026-09-26-fill-blanks-from-live.sql
--
-- WHAT: fills ONLY blank Admin/CMS fields with the exact content the
-- live website already displays for them (taken from the deployed page
-- source, GitHub 4c70d1c). Every field filled here is one the public
-- site reads, so the Admin value now controls what visitors see, and
-- the page looks exactly the same as before.
--
-- NEVER: overwrites a non-empty value · deletes a row · inserts a row ·
-- changes publish status, roles, policies or schema.
--
-- SAFETY: snapshots every affected row into backup_20260926_cms first.
-- Undo: see the ROLLBACK block at the bottom.
-- ============================================================
begin;

create schema if not exists backup_20260926_cms;
revoke all on schema backup_20260926_cms from public, anon, authenticated;
create table if not exists backup_20260926_cms.site_settings as select * from public.site_settings;
create table if not exists backup_20260926_cms.pages as select * from public.pages;
create table if not exists backup_20260926_cms.properties_seo as
  select id, property_code, seo_title, seo_description, updated_at from public.properties;
revoke all on all tables in schema backup_20260926_cms from public, anon, authenticated;

-- 1. Homepage hero + hero video + favicon (Admin → Site Settings).
--    Live page shows these from index.html because the fields are blank.
update public.site_settings set hero_title = 'Find Your Next Property in Chennai' where id = 1 and coalesce(hero_title, '') = '';
update public.site_settings set hero_subtitle = 'Trusted real estate solutions across residential, commercial and land investments — backed by decades of local expertise.' where id = 1 and coalesce(hero_subtitle, '') = '';
update public.site_settings set hero_tagline = 'Buy • Sell • Rent' where id = 1 and coalesce(hero_tagline, '') = '';
update public.site_settings set hero_video_url = 'images/hero-video.mp4?v=2' where id = 1 and coalesce(hero_video_url, '') = '';
update public.site_settings set favicon_url = '/favicon.ico' where id = 1 and coalesce(favicon_url, '') = '';

-- 2. Page SEO descriptions (Admin → Website Content → each page → SEO).
--    Live pages show these from their <meta name="description"> tag.
update public.pages set seo_description = 'Contact Aventrix Realty — Chennai real estate advisors with offices in Chromepet and Adyar. Call, WhatsApp or send an enquiry for buying, selling or leasing property.' where page_key = 'contact' and coalesce(seo_description, '') = '';
update public.pages set seo_description = 'Request a free property valuation from Aventrix Realty. Our Chennai property experts review your land, apartment, villa or commercial property to share its current market position.' where page_key = 'free-valuation' and coalesce(seo_description, '') = '';
update public.pages set seo_description = 'Real estate insights, market trends and property guidance for Chennai from Aventrix Realty.' where page_key = 'insights' and coalesce(seo_description, '') = '';
update public.pages set seo_description = 'Joint Venture and development options for land in Chennai. Aventrix Realty helps landowners assess their objectives and coordinate with development partners.' where page_key = 'joint-venture' and coalesce(seo_description, '') = '';
update public.pages set seo_description = 'List your property for free with Aventrix Realty — reach verified buyers and tenants across Chennai with expert marketing and advisory support.' where page_key = 'list-with-us' and coalesce(seo_description, '') = '';
update public.pages set seo_description = 'Remote-friendly real estate services for NRIs from Aventrix Realty — virtual property tours, documentation support, power-of-attorney coordination and end-to-end transaction assistance in Chennai.' where page_key = 'nri-services' and coalesce(seo_description, '') = '';
update public.pages set seo_description = 'Meet the Aventrix Realty team — experienced, TNRERA-registered real estate advisors serving buyers, sellers and investors across Chennai.' where page_key = 'our-realtors' and coalesce(seo_description, '') = '';

-- 3. Property SEO (Admin → Properties → SEO) for listings where it is blank.
--    Live property pages currently generate exactly these values:
--    title = "<title> | Aventrix Realty", description = short description.
update public.properties set seo_title = title || ' | Aventrix Realty'
 where coalesce(seo_title, '') = '' and coalesce(title, '') <> '';
update public.properties set seo_description = short_description
 where coalesce(seo_description, '') = '' and coalesce(short_description, '') <> '';

commit;

-- ============================================================
-- ROLLBACK (restores every value exactly as it was before this file):
--   begin;
--   update public.site_settings s set hero_title=b.hero_title, hero_subtitle=b.hero_subtitle,
--     hero_tagline=b.hero_tagline, hero_video_url=b.hero_video_url, favicon_url=b.favicon_url
--     from backup_20260926_cms.site_settings b where b.id = s.id;
--   update public.pages p set seo_description = b.seo_description
--     from backup_20260926_cms.pages b where b.id = p.id;
--   update public.properties p set seo_title = b.seo_title, seo_description = b.seo_description
--     from backup_20260926_cms.properties_seo b where b.id = p.id;
--   commit;
-- ============================================================
