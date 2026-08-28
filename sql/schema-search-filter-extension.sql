-- ============================================================
-- AVENTRIX REALTY — SEARCH & FILTER MIGRATION
-- Run AFTER sql/schema.sql (and the other extension scripts, if
-- already applied), in Supabase → SQL Editor → New query.
--
-- WHY THIS IS NEEDED:
-- `properties.price_display` is free text (e.g. "₹1.14 Crore",
-- "Contact for Price") by original design, so it can never be
-- reliably compared as a number. The new Search & Filter page
-- needs an actual number to do "Price: ₹50L – ₹1Cr" range
-- filtering and "Price: Low to High / High to Low" sorting.
--
-- This adds ONE new optional numeric column, `price_value`, that
-- sits alongside price_display without replacing it:
--   - price_display  → what visitors still see on every card/page
--                       (unchanged, still free text, still required)
--   - price_value     → plain rupees, digits only, e.g. 11400000
--                       for "₹1.14 Crore". Used ONLY by the filter
--                       engine for range/sort. Optional — a
--                       property left blank here simply won't
--                       match a price filter and sorts last on
--                       "Price: Low to High/High to Low", but
--                       still appears normally everywhere else.
--
-- SAFETY: purely additive ("add column if not exists"), nullable,
-- no existing column altered/dropped, no existing data touched or
-- reset. Safe to re-run. Indexes below only speed up filtering —
-- they change no data and are safe to re-run too.
-- ============================================================

alter table properties add column if not exists price_value numeric;

comment on column properties.price_value is
    'Plain numeric rupee value used only for price-range filtering and price sorting on the Search & Filter page. Free text price_display is still what visitors see. Optional — leave blank if unknown.';

-- Indexes to keep the Search & Filter page fast as the number of
-- listings grows. All are on existing columns already used for
-- filtering; none of these change or touch existing data.
create index if not exists idx_properties_publish_status on properties (publish_status);
create index if not exists idx_properties_category on properties (category);
create index if not exists idx_properties_listing_type on properties (listing_type);
create index if not exists idx_properties_bedrooms on properties (bedrooms);
create index if not exists idx_properties_bathrooms on properties (bathrooms);
create index if not exists idx_properties_price_value on properties (price_value);
create index if not exists idx_properties_created_at on properties (created_at desc);
