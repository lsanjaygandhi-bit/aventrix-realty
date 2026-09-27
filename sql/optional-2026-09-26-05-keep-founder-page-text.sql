-- ============================================================
-- AVENTRIX REALTY — OPTIONAL: KEEP THE FOUNDER PAGES' CURRENT TEXT (2026-09-26)
-- File: sql/optional-2026-09-26-05-keep-founder-page-text.sql
--
-- DECISION NEEDED — run this ONLY if you want the founder profile pages to
-- keep exactly the text they show today.
--
-- Why: gnanasekaran.html and sanjay.html now take About / Experience /
-- Areas of Expertise / Languages from Admin → Our Realtors / Leadership (one
-- source). Admin currently holds DIFFERENT text for these fields than the
-- pages show:
--   Gnanasekaran P  About       Admin: 3 paragraphs written 2026-08-20 ("carries forward a family legacy…")
--                               Page : 2 paragraphs ("With over 15 years of experience in Chennai's…")
--                   Experience  Admin: "15+ Years"   Page: "15+ Years in Real Estate & Business Development."
--                   Expertise   Admin: Real Estate Advisory, Property Strategy, Client Relations,
--                                      Business Development, Joint Venture Support
--                               Page : Land Advisory, Strategic Growth, Client Relationships
--                   Languages   Admin: English, Tamil, Hindi    Page: English, Tamil
--   Sanjay Gandhi L About       Admin: 1 sentence ("Leading business operations, client relationships…")
--                               Page : 1 long paragraph ("Sanjay Gandhi L brings over 15 years…")
--                   Experience  Admin: "15+ years"   Page: "15+ Years in Real Estate Sales, Marketing & Business Development."
--                   (Expertise already identical; the page shows no Languages.)
--
--   * Run this file  → Admin is updated to the page text; after deploy the
--                      pages look exactly as they do today.
--   * Don't run it   → after deploy the pages show the Admin text above.
--   Either way you can change the text later in Admin.
--
-- Guard: each row is only updated if Admin still holds exactly the value
-- listed above (md5 check), so nothing you have edited since is overwritten.
-- Snapshot first; rollback block at the end. No other table is touched.
-- ============================================================
begin;

create schema if not exists backup_20260926_founders;
revoke all on schema backup_20260926_founders from public, anon, authenticated;
create table if not exists backup_20260926_founders.realtors as
  select * from public.realtors where slug in ('gnanasekaran-p', 'sanjay-gandhi-l');
revoke all on all tables in schema backup_20260926_founders from public, anon, authenticated;

update public.realtors set
    about = $t$With over 15 years of experience in Chennai's real estate market, Gnanasekaran P provides the strategic direction and leadership behind Aventrix Realty. His deep understanding of local market cycles and neighbourhood trends shapes how the company sources and evaluates properties across residential, commercial and land segments.

Over the years, he has built trusted, long-standing relationships with clients, landowners and developers, grounded in transparency and professional conduct at every stage of a transaction. His focus remains on steady, sustainable business development — growing Aventrix Realty's presence across Chennai while holding firmly to the standards of integrity that lasting real estate relationships depend on.$t$,
    experience = '15+ Years in Real Estate & Business Development.',
    expertise  = array['Land Advisory', 'Strategic Growth', 'Client Relationships'],
    languages  = array['English', 'Tamil']
 where slug = 'gnanasekaran-p'
   and md5(coalesce(about, '')) = 'ecde9d3347a3e814220cca004be25928'
   and experience = '15+ Years'
   and expertise = array['Real Estate Advisory', 'Property Strategy', 'Client Relations', 'Business Development', 'Joint Venture Support']
   and languages = array['English', 'Tamil', 'Hindi'];

update public.realtors set
    about = $t$Sanjay Gandhi L brings over 15 years of hands-on real estate experience to his role as Co-Founder and Managing Partner of Aventrix Realty, where he leads day-to-day business and operational activity. His work spans the full property lifecycle — buying, selling and leasing — coordinating property marketing and transaction execution while managing negotiations through to closure. With close familiarity with Chennai's neighbourhoods and property values, he works directly with buyers, sellers, investors and property owners to guide each transaction with clarity and care. His approach is centred on building long-term client relationships, backed by practical market knowledge and dependable, on-ground support.$t$,
    experience = '15+ Years in Real Estate Sales, Marketing & Business Development.'
 where slug = 'sanjay-gandhi-l'
   and md5(coalesce(about, '')) = '081aa7fe6d089cd216fa3737d2b0edba'
   and experience = '15+ years';

commit;

-- VERIFY: select slug, left(about, 60), experience, expertise, languages from public.realtors
--          where slug in ('gnanasekaran-p', 'sanjay-gandhi-l');
-- ROLLBACK:
--   begin;
--   update public.realtors r set about = b.about, experience = b.experience, expertise = b.expertise, languages = b.languages
--     from backup_20260926_founders.realtors b where b.id = r.id;
--   commit;
