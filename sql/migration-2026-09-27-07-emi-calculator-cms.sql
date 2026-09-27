-- ============================================================
-- AVENTRIX REALTY — EMI CALCULATOR → ADMIN CMS (2026-09-27)
-- File: sql/migration-2026-09-27-07-emi-calculator-cms.sql
--
-- Registers emi-calculator.html in the Admin "Website Content" CMS,
-- using exactly the text already live on the page (js/public-page-content.js
-- only replaces text when the Admin value is non-empty, so nothing on the
-- public page changes until an admin edits it here). This also makes the
-- hero background photo Admin/media-controlled via the existing generic
-- "Hero Image URL" field (hero_image_url -> [data-page-hero-image] ->
-- .emi-hero-media), on top of the default images/emi-calculator-hero.jpg
-- set in css/emi-calculator.css.
--
-- SAFETY: snapshot first (backup_20260927_emi). Idempotent (insert only if
-- the row doesn't exist yet; does nothing on a second run). No RLS/schema
-- changes. Rollback block at the end.
-- ============================================================
begin;

create schema if not exists backup_20260927_emi;
revoke all on schema backup_20260927_emi from public, anon, authenticated;
create table if not exists backup_20260927_emi.pages as select * from public.pages where page_key = 'emi-calculator';
revoke all on all tables in schema backup_20260927_emi from public, anon, authenticated;

insert into public.pages (page_key, page_label, hero_eyebrow, hero_title, hero_subtitle, sections,
                          seo_title, seo_description, og_image_url, publish_status)
select 'emi-calculator', 'EMI Calculator', 'HOME LOANS', 'EMI Calculator',
       'Estimate your monthly EMI, total interest and total repayment instantly.',
       $sections$[
        {
         "key": "emi-note",
         "label": "Note under the hero",
         "eyebrow": "",
         "heading": "",
         "html": "",
         "image_url": "",
         "fields": {
          "text": "Rates vary by lender. All figures shown are estimates for reference purposes only."
         },
         "hooks": [],
         "display_order": 1
        },
        {
         "key": "emi-tips",
         "label": "Tips",
         "eyebrow": "",
         "heading": "Tips",
         "html": "",
         "image_url": "",
         "lists": {
          "tips": [
           {"text": "A longer tenure lowers the monthly EMI but increases the total interest paid over the life of the loan."},
           {"text": "A higher down payment reduces the loan principal, which lowers both the EMI and the total interest."},
           {"text": "A lower interest rate reduces the total interest payable, so it helps to compare offers from more than one lender."},
           {"text": "Where your lender allows part-prepayment, paying down principal early reduces the outstanding balance and can shorten the tenure."},
           {"text": "On a floating-rate loan, a change in the rate can change your EMI or your remaining tenure."}
          ]
         },
         "hooks": ["heading"],
         "display_order": 2
        },
        {
         "key": "emi-disclaimer",
         "label": "Disclaimer",
         "eyebrow": "",
         "heading": "",
         "html": "",
         "image_url": "",
         "fields": {
          "text": "EMI calculations are estimates for reference purposes only. Actual EMI, interest and loan eligibility may vary depending on the lender, loan terms and applicant profile. Please consult the lender or a qualified financial advisor before making financial decisions."
         },
         "hooks": [],
         "display_order": 3
        }
       ]$sections$::jsonb,
       'EMI Calculator | Aventrix Realty',
       'Estimate your home loan EMI with Aventrix Realty''s free EMI calculator — see your monthly instalment, total interest and total repayment instantly.',
       'https://aventrixrealty.com/images/chennai-marina.jpg',
       'Published'
 where not exists (select 1 from public.pages where page_key = 'emi-calculator');

commit;

-- ============================================================
-- VERIFY (read-only):
--   select page_key, hero_title, jsonb_array_length(sections) from public.pages where page_key = 'emi-calculator';
--   -- expected: 1 row, hero_title 'EMI Calculator', 3 sections
-- ============================================================
-- ROLLBACK:
--   begin;
--   delete from public.pages where page_key = 'emi-calculator'
--     and not exists (select 1 from backup_20260927_emi.pages b where b.page_key = 'emi-calculator');
--   commit;
-- ============================================================
