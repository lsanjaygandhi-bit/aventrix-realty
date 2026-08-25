-- ============================================================
-- AVENTRIX REALTY — PROPERTY QUICK VIEW MIGRATION
-- Run AFTER sql/schema.sql (and the CMS extension scripts, if
-- already applied), in Supabase → SQL Editor → New query.
--
-- Adds the optional per-property fields the new Property Quick
-- View overlay needs for its stats row and brokerage line, plus
-- one global RERA agent registration field so that number lives
-- in one place instead of being repeated across the frontend.
--
-- SAFETY: purely additive ("add column if not exists"). No
-- existing column altered/dropped, no data touched, safe to
-- re-run. Every new properties column is nullable — the Quick
-- View only ever displays a field when it has a value, so
-- existing properties keep working exactly as before until
-- someone fills these in via Admin.
-- ============================================================

alter table properties add column if not exists bedrooms int;
alter table properties add column if not exists bathrooms int;
alter table properties add column if not exists parking int;
alter table properties add column if not exists built_up_area text;   -- free text, e.g. "1,450 sq.ft" (matches price_display convention)
alter table properties add column if not exists land_area text;       -- free text, e.g. "2,400 sq.ft" or "4 Grounds"
alter table properties add column if not exists floors int;
alter table properties add column if not exists road_width text;      -- free text, e.g. "30 ft"
alter table properties add column if not exists rental_income text;   -- free text, e.g. "₹45,000/month"
alter table properties add column if not exists brokerage text;       -- free text, e.g. "1%", "₹2,00,000", "Negotiable"

-- Real-estate AGENT's RERA registration (not the project's), shown in
-- the Quick View trust section. Seeded with the current number so the
-- Quick View displays correctly immediately; editable later in
-- Admin → Settings.
alter table site_settings add column if not exists rera_registration_no text;

update site_settings
set rera_registration_no = coalesce(rera_registration_no, 'TN/Agent/0284/2026')
where id = 1;
