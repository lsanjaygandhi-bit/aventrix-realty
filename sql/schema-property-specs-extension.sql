-- ============================================================
-- AVENTRIX REALTY — PROPERTY DETAILS PAGE SPECS MIGRATION
-- Run AFTER sql/schema-quickview-extension.sql, in Supabase →
-- SQL Editor → New query.
--
-- Adds three more optional per-property fields the Full Property
-- Details page's specification grid can show, matching how Indian
-- real-estate listings commonly separate UDS (Undivided Share) from
-- overall land area, plus furnishing status and facing direction.
--
-- SAFETY: purely additive ("add column if not exists"), nullable,
-- no existing data touched, safe to re-run. The specs grid only
-- ever renders a card for a field that actually has a value, so
-- existing properties are unaffected until filled in via Admin.
-- ============================================================

alter table properties add column if not exists uds_area text;    -- free text, e.g. "1,680 sq.ft" (Undivided Share of land — distinct from land_area)
alter table properties add column if not exists furnishing text;  -- free text, e.g. "Fully Furnished", "Semi-Furnished", "Unfurnished"
alter table properties add column if not exists facing text;      -- free text, e.g. "North", "East"
