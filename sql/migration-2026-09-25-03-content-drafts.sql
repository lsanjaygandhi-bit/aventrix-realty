-- ============================================================
-- AVENTRIX REALTY — CONTENT MIGRATION: UNPUBLISH PLACEHOLDER CONTENT
-- File: sql/migration-2026-09-25-03-content-drafts.sql
-- Run AFTER: migration-2026-09-25-01-… and migration-2026-09-25-02-…
--
-- Decision (Sanjay, 2026-09-25):
--   * "Sample Realtor" profile          → Draft (NOT deleted)
--   * 3 seeded "representative" testimonials → Draft (NOT deleted)
--     Ramesh Kumar, Priya Venkatesan, Arvind Balaji
--   No replacement content is created. Genuine testimonials can be
--   added later in Admin → Testimonials.
--
-- Targets rows by BOTH their seeded identifier and seeded text, so a
-- genuine record that happens to share a name is never touched:
--   realtors:     slug = 'sample-realtor' AND name = 'Sample Realtor'
--   testimonials: client_name + client_role exactly as seeded in
--                 sql/seed-cms-content.sql
-- The 4th testimonial (Hema Krishnamoorthy) is already Draft and is
-- left as-is.
--
-- SAFETY: UPDATE only (publish_status), no deletes, no inserts.
-- Safe to re-run. To undo, set publish_status back to 'Published'.
-- ============================================================

begin;

update public.realtors
set publish_status = 'Draft'
where slug = 'sample-realtor'
  and name = 'Sample Realtor'
  and publish_status is distinct from 'Draft';

update public.testimonials
set publish_status = 'Draft'
where publish_status is distinct from 'Draft'
  and (client_name, client_role) in (
      ('Ramesh Kumar',     'Purchased Residential Plot, Chromepet'),
      ('Priya Venkatesan', 'Sold Commercial Property'),
      ('Arvind Balaji',    'Bought Villa, Old Pallavaram')
  );

commit;

-- Verify (expected: sample-realtor = Draft; the 3 testimonials = Draft):
--   select slug, name, publish_status from public.realtors order by display_order;
--   select client_name, publish_status from public.testimonials order by display_order;
