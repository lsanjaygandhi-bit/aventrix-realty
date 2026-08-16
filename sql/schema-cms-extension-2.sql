-- ============================================================
-- AVENTRIX REALTY — CMS COMPLETION MIGRATION (PART 2)
-- Run AFTER sql/schema-cms-extension.sql and sql/seed-cms-content.sql.
--
-- Adds two small, genuinely useful branding fields that were
-- flagged as missing when completing the Admin Panel:
--   - hero_tagline_color: lets Admin change the "BUY · SELL · LEASE"
--     tagline color without touching CSS. Falls back to the
--     existing gold (#D4AF37) if left empty, so nothing changes
--     until Admin explicitly sets a value.
--   - hero_video_url: lets Admin swap the homepage hero background
--     video without a redeploy. Falls back to the existing local
--     video file if left empty.
--
-- SAFETY: purely additive ("add column if not exists"), no existing
-- column altered/dropped, no data touched. Safe to re-run.
-- ============================================================

alter table site_settings add column if not exists hero_tagline_color text;
alter table site_settings add column if not exists hero_video_url text;

-- Seed the current gold color as the default so the public site's
-- visual result is identical before and after this migration —
-- Admin can change it later, but nothing changes on go-live.
update site_settings
set hero_tagline_color = coalesce(hero_tagline_color, '#D4AF37')
where id = 1;
