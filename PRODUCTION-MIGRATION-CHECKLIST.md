# Aventrix Realty — Production Migration Checklist (P0 + P1 + Content)

Build: `aventrix-realty-p0-p1-reconciled-2026-09-26.zip`, based on the live source
(GitHub `lsanjaygandhi-bit/aventrix-realty` @ `4c70d1c`, 24 Sep) with the tested P0/P1 changes applied.
Supabase project: `gkrtjeygrqkglsadskcg` · Cloudflare Worker: `polished-band-06ef`

**Status on 2026-09-26:** step 1 is done. The backup schema `backup_20260925` was created and verified on 25 Sep; keep it.
**Nothing else has been run.** No migration has been applied and the live site is unchanged.

Do the steps in order and don't skip ahead. Each step has a pass condition and a way back.
Allow about 45 minutes, and pick a quiet hour.

---

## 1 · Backup and verify the database

1. Supabase → **Database → Backups**: confirm a recent backup exists. On the Free plan there are no
   automatic backups, so run this from a computer with Postgres tools instead:
   `pg_dump "<connection string from Settings → Database>" -Fc -f aventrix-2026-09-25.dump`
2. Save the current policies as a record. In the SQL Editor, run the query below and download the result as CSV:
   ```sql
   select schemaname, tablename, policyname, cmd, roles, qual, with_check
   from pg_policies where schemaname in ('public','storage') order by 1,2,3;
   ```
3. Confirm the starting state matches what was tested:
   ```sql
   select (select count(*) from auth.users) users,
          (select count(*) from admin_profiles) admins,
          (select count(*) from properties) properties,
          (select count(*) from enquiries) enquiries,
          (select count(*) from pg_policies where tablename='office_locations') office_policies;
   ```
   At audit time the values were users 1, admins 1, properties 25, enquiries 1, office_policies 0.
   If users is greater than 1, check that every admin has an `admin_profiles` row with role `Admin`,
   because only those rows are carried over as admins.

✅ Pass: a backup exists and the counts look right.

## 2 · Apply P0: `sql/migration-2026-09-25-01-p0-security-roles.sql`

SQL Editor → New query → paste the whole file → **Run**. Expect "Success. No rows returned".

Then verify:
```sql
select u.email, r.role from user_roles r join auth.users u on u.id = r.user_id;   -- your email | admin
select count(*) from pg_policies where tablename = 'office_locations';            -- 2
select policyname from pg_policies where schemaname='storage' and tablename='objects' order by 1;
-- must NOT include: Allow delete, Allow update, Allow uploads, Allow upload and view 107eh68_1
```
✅ Pass: your email shows as admin and the old storage policies are gone.
↩ Rollback: restore the policies from the step 1 CSV. The instructions are at the bottom of the P0 file.

## 3 · Smoke-test admin login (the old website is still live, which is fine)

1. Open `https://aventrixrealty.com/admin/` and log in. Properties, Website Content and Enquiries should load as before.
2. Edit a harmless field, such as a property's SEO keywords, save it, then change it back.
3. Office Locations now shows both offices. Before P0 this screen was empty.

✅ Pass: all three work. ❌ If you're locked out, run
`insert into user_roles(user_id,role) select id,'admin' from auth.users where email='YOUR EMAIL' on conflict (user_id) do update set role='admin';`

## 4 · Smoke-test storage permissions

1. **Anonymous upload must fail.** From any terminal:
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" -X POST \
     "https://gkrtjeygrqkglsadskcg.supabase.co/storage/v1/object/property-images/smoke-test.txt" \
     -H "apikey: sb_publishable_MnbL_7U0x3xvksGpOJxtUQ_DEZ85MGL" \
     -H "Content-Type: text/plain" --data "x"
   ```
   Expected: 400 or 403, never 200. If you get 200, delete `smoke-test.txt` from the bucket and **stop**.
2. **Admin upload must work.** In Admin → Properties, open a property, add a gallery image and save. It should appear.
   Then remove it again if you don't want it.
3. **Public images still load.** Open any property page on the live site and check the photos show.

✅ Pass: 1 is refused, and 2 and 3 work.

## 5 · Apply P1 and the content migration

1. Run `sql/migration-2026-09-25-02-p1-crm-buyer-analytics.sql`.
2. Run `sql/migration-2026-09-25-03-content-drafts.sql`.

Then verify:
```sql
select lead_stage, lead_source, count(*) from enquiries group by 1,2;     -- existing rows: NEW / Website
select slug, publish_status from realtors order by display_order;         -- sample-realtor = Draft
select client_name, publish_status from testimonials order by display_order; -- Ramesh, Priya, Arvind, Hema = Draft
select public.admin_dashboard_metrics();  -- run in the SQL editor it returns NULL (no user); that's expected
```
✅ Pass: as shown above.
↩ Rollback: the P1 file has a rollback block at the bottom. For content, set `publish_status='Published'` on the same rows.

⚠️ Note: between steps 5 and 7, the **old** homepage still has its static testimonial cards built into the HTML.
They disappear when the new site is deployed in step 7. Keep the gap short.

## 6 · Smoke-test CRM (in the database, before the site deploy)

```sql
-- the website's enquiry path as an anonymous visitor:
begin;
set local role anon;
insert into enquiries (form_type, name, phone, property_slug, lead_stage)
values ('Smoke Test', 'Smoke Test', '0000000000',
        (select slug from properties where publish_status='Published' limit 1), 'BOOKED');
reset role;
select name, lead_stage, lead_source, property_code from enquiries where form_type='Smoke Test';
-- expect: Smoke Test | NEW | Website | AVX-…   (BOOKED is ignored for public submissions)
rollback;   -- nothing is saved
```
✅ Pass: NEW / Website / an AVX code.

## 7 · Deploy the website

1. Replace the repo contents with the reconciled ZIP (keep your `.git` folder). Check that both `.assetsignore` and `.wranglerignore`
   are included. Don't copy any `__MACOSX` folder into the repo.
2. Commit, push, then `npx wrangler deploy`.
3. `sql/`, `tests/` and `*.md` are excluded by `.assetsignore` (and the identical `.wranglerignore`). The Worker's own config
   (`wrangler.toml` / dashboard settings) is **not in the repo**, so this can't be checked in advance. The `/sql/…` 404 check
   in step 8 is the proof, so don't skip it.

## 8 · Verify production (use a private/incognito window)

| Check | Expected |
|---|---|
| `https://aventrixrealty.com/sql/migration-2026-09-25-01-p0-security-roles.sql` | 404 |
| Header and footer on any page | no "Admin" link |
| `/admin/` typed directly | login page loads, you can log in |
| Homepage | no testimonials section; Leadership section still directly below the hero |
| Our Realtors | Gnanasekaran P + L. Sanjay Gandhi only; Sanjay shows **"15+ years"** (the CMS value) |
| `realtor-profile.html?id=sample-realtor` | "couldn't find that profile" |
| A property page → WhatsApp | message starts "…interested in AVX-0000xx – <title>…" |
| Property page → "Send an enquiry…" → submit | appears in Admin → Leads with its AVX code |
| Create a buyer account (use a second email), confirm the email, log in | dashboard with 5 tabs |
| That buyer opens `/admin/` and logs in | "This account doesn't have Admin Panel access" |
| Buyer: set requirement → Matches | scored cards with ✓ / ~ / ✗ / ? |
| Buyer: wishlist / shortlist on phone, then on laptop | same items on both |
| Admin → Overview | real counts; the test enquiry shows under Leads |
| iPhone Safari: homepage, properties, account, admin | layout OK (not yet tested on real iOS) |

Delete the test buyer account and the test lead afterwards if you like (Admin → Leads → delete).

## 9 · Monitor (first 48 hours)

- Supabase → **Logs → API**: look for spikes of 401 / 403 / 42501 (RLS denials) on `enquiries`, `properties` or storage.
  A few are normal from bots; a steady stream from real pages means something needs a look.
- Admin → Leads: new website enquiries keep arriving.
- **Mobile app (Expo):** open it and test browsing, login, and (if it exists) listing submission with photo upload.
  Customer photos must go to `customer-uploads/<user id>/`.
- Watch Cloudflare analytics for 404 spikes.

---

## Not covered by testing (still open)

These were **not** verified and remain future / P2 work:

- Live Supabase Auth emails (signup confirmation, password reset). Checked manually in step 8 only.
- Real Supabase Storage upload behaviour. Checked in step 4 only.
- Expo mobile app compatibility with the new policies
- Safari / iOS on real devices; third-party CDNs (Font Awesome, Google Fonts) in the test environment
- Per-property latitude/longitude; List + Map split view; Near Me on real coordinates
- Saved-search alert **delivery** (the preference is stored; nothing is sent yet)
- Customer-facing enquiry field isolation (buyers can read internal CRM columns of their **own** enquiries through the API)
- Realtor assignment UI (listings: `managed_by`; roles: `user_roles`). SQL only for now.
- Verified Property workflow
- Area landing pages
- Pre-rendered / dynamic SEO property and article pages; dynamic sitemap
- Hero video (13.7 MB) and large image compression
