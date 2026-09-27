-- ============================================================
-- AVENTRIX REALTY — PROPERTY MAP COORDINATES (2026-09-26)
-- File: sql/migration-2026-09-26-06-property-coordinates.sql
--
-- FOR REVIEW — NOT RUN. Needs your approval before it is run on production.
--
-- Why: the Properties page Map View places a marker only for a property
-- that has its own coordinates. public.properties has none today (checked
-- on the live database 2026-09-26: the only location field is the
-- free-text `location` column).
--
-- What it does (and nothing else):
--   1. Adds two nullable columns to public.properties:
--        latitude   numeric(9,6)   e.g.  12.941600
--        longitude  numeric(9,6)   e.g.  80.198400
--      numeric(9,6) stores 6 decimal places (about 0.1 m), which is
--      more than Google Maps' "copy coordinates" gives.
--   2. Adds one CHECK constraint: both empty, or both filled with a real
--      coordinate (latitude −90…90, longitude −180…180, not 0,0).
--
-- What it does NOT do:
--   * No existing value changes. Every property starts with no
--     coordinates and stays in List View until coordinates are added in
--     Admin → Properties.
--   * No coordinates are guessed or geocoded.
--   * No RLS policy, grant, trigger, function or view changes. The new
--     columns follow the table's existing policies:
--       - the public sees them on Published properties only;
--       - Admin can edit them;
--       - a customer or realtor can edit them only on the listings they
--         can already edit today;
--       - the existing guard still stops non-admins from publishing.
--
-- Safe to run more than once. Rollback at the end.
-- The website and Admin work before AND after this migration. Before it,
-- the Map View shows "not available on the map" and the Admin hides the
-- coordinate fields.
-- ============================================================
begin;

alter table public.properties
    add column if not exists latitude  numeric(9,6),
    add column if not exists longitude numeric(9,6);

alter table public.properties drop constraint if exists properties_coordinates_valid;
alter table public.properties add constraint properties_coordinates_valid check (
    (latitude is null and longitude is null)
    or (
        latitude  is not null and longitude is not null
        and latitude  between -90  and 90
        and longitude between -180 and 180
        and not (latitude = 0 and longitude = 0)
    )
);

comment on column public.properties.latitude  is 'Map latitude (WGS84, decimal degrees). Set in Admin → Properties. Empty = not shown on the map.';
comment on column public.properties.longitude is 'Map longitude (WGS84, decimal degrees). Set in Admin → Properties. Empty = not shown on the map.';

commit;

-- Make the API see the new columns immediately (Supabase normally does this by itself).
notify pgrst, 'reload schema';

-- VERIFY:
--   select column_name, data_type, numeric_precision, numeric_scale from information_schema.columns
--    where table_schema = 'public' and table_name = 'properties' and column_name in ('latitude', 'longitude');
--   select count(*) filter (where latitude is not null) as with_coordinates, count(*) as total from public.properties;
--
-- ROLLBACK (removes the columns and any coordinates entered since):
--   begin;
--   alter table public.properties drop constraint if exists properties_coordinates_valid;
--   alter table public.properties drop column if exists latitude, drop column if exists longitude;
--   commit;
--   notify pgrst, 'reload schema';
