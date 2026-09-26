-- ============================================================
-- AVENTRIX REALTY — OFFICE LOCATIONS DATA FIX (2026-09-26)
-- File: sql/office-fix-2026-09-26-restore-live-office-details.sql
-- Approved by Sanjay Gandhi, 2026-09-26 10:24 IST.
--
-- WHY: before P0, office_locations had no read policy, so the public
-- site showed the office cards built into index.html / contact.html.
-- P0 correctly allowed public reads, so the site now builds the cards
-- from these rows — which were incomplete (one phone each, no emails,
-- no Head Office map embed). This restores exactly what the live pages
-- showed, using the values in the deployed page source (GitHub 4c70d1c).
--
-- Changes ONLY: 2 × phone, 2 × email, 1 × maps_embed_url.
-- Each update applies only if the field still holds the value recorded
-- before the fix (or is blank), so nothing else can be overwritten.
-- No inserts, deletes, schema, policy, role or publish-status changes.
-- ============================================================
begin;

create schema if not exists backup_20260926_offices;
revoke all on schema backup_20260926_offices from public, anon, authenticated;
create table if not exists backup_20260926_offices.office_locations as select * from public.office_locations;
revoke all on all tables in schema backup_20260926_offices from public, anon, authenticated;

-- Head Office (id e5b3c50b-86fd-48e4-9f16-23309568791c)
update public.office_locations set phone = '+91 91768 87770, +91 70923 56222'
 where id = 'e5b3c50b-86fd-48e4-9f16-23309568791c' and phone = '+91 91768 87770';
update public.office_locations set email = 'office@aventrixrealty.com'
 where id = 'e5b3c50b-86fd-48e4-9f16-23309568791c' and coalesce(email, '') = '';
update public.office_locations set maps_embed_url = 'https://www.google.com/maps?q=No.27%2C%201st%20Main%20Road%2C%20Newcolony%2C%20Chromepet%2C%20Chennai%2C%20Tamil%20Nadu&output=embed'
 where id = 'e5b3c50b-86fd-48e4-9f16-23309568791c' and coalesce(maps_embed_url, '') = '';

-- Adyar Branch (id 57d24f61-0e4e-47c4-9041-752259a5067d)
update public.office_locations set phone = '+91 91768 87770, +91 70923 56222'
 where id = '57d24f61-0e4e-47c4-9041-752259a5067d' and phone = '+91 70923 56222';
update public.office_locations set email = 'adyar@aventrixrealty.com'
 where id = '57d24f61-0e4e-47c4-9041-752259a5067d' and coalesce(email, '') = '';

commit;

-- ============================================================
-- ROLLBACK (restores only these 5 fields, only on these 2 rows):
--   begin;
--   update public.office_locations o set phone = b.phone, email = b.email, maps_embed_url = b.maps_embed_url
--     from backup_20260926_offices.office_locations b
--    where b.id = o.id and o.id in ('e5b3c50b-86fd-48e4-9f16-23309568791c','57d24f61-0e4e-47c4-9041-752259a5067d');
--   commit;
-- ============================================================