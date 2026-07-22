# Aventrix Realty — Supabase Setup Guide

Follow these steps in order. Takes about 15 minutes.

## 1. Create the Supabase project
1. Go to https://supabase.com → New Project.
2. Name it (e.g. `aventrix-realty`), set a strong database password, choose a region close to Chennai (Singapore is usually fastest).
3. Wait for it to finish provisioning.

## 2. Run the database schema
1. In your project, go to **SQL Editor → New query**.
2. Open `sql/schema.sql` from this project, paste the whole file in, and click **Run**.
3. This creates the `properties`, `enquiries`, and `site_settings` tables, the auto-ID trigger, and all Row Level Security (RLS) policies.

## 3. Create the Storage bucket
1. Go to **Storage → New bucket**.
2. Name it exactly: `property-images`
3. Toggle **Public bucket: ON** (so property photos load on the public website without extra signed URLs).
4. Click **Create bucket**.

No extra storage policy is needed for a public bucket — public read is automatic, and only your logged-in admin session (via the `authenticated` role) can upload, since uploads go through the browser using your session.

If you'd rather keep the bucket private and lock down write access explicitly, add this in SQL Editor instead of toggling public:
```sql
create policy "Public can view property images"
on storage.objects for select
to anon
using (bucket_id = 'property-images');

create policy "Admin can upload property images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'property-images');

create policy "Admin can delete property images"
on storage.objects for delete
to authenticated
using (bucket_id = 'property-images');
```

## 4. Create your admin login
1. Go to **Authentication → Users → Add user**.
2. Enter your email and a password.
3. Leave "Auto Confirm User" checked so you can log in immediately.
4. This is the email/password you'll use at `yoursite.com/admin/`.

(Any user created this way is treated as an admin — the RLS policies grant full access to anyone logged in, since this is a single-business, single-admin setup. If you want a second admin later, just add another user here.)

## 5. Connect the website to your project
1. In Supabase, go to **Settings → API**.
2. Copy the **Project URL** and the **anon public** key (never the `service_role` key).
3. Open `js/supabase-client.js` in this project and replace:
   ```js
   const SUPABASE_URL = "https://YOUR-PROJECT-REF.supabase.co";
   const SUPABASE_ANON_KEY = "YOUR-SUPABASE-ANON-KEY";
   ```
   with your real values.
4. Save, upload the whole site (including the new `admin/`, `js/`, `sql/` folders) to Hostinger as usual.

## 6. Log in
Visit `https://aventrixrealty.com/admin/` and sign in with the email/password from step 4.

## 7. Add your first property
Admin panel → Properties → Add Property → fill in the details, upload photos, set **Publish Status** to **Published**, save. It appears on the homepage and its own property page immediately — no code changes, no re-upload.

---

### Notes
- Properties default to **Draft** — the public site only ever shows **Published** ones.
- The Property ID (e.g. `AVX-000001`) is generated automatically by the database; you never type it.
- File-upload fields on the Free Valuation / List With Us / NRI Services forms currently record the filename only in the enquiry record (not the file itself) — let me know if you want those photos uploaded to Storage too.
- To add a future module (Blogs, Testimonials, Projects, Developers, Team Members), see the comments at the top of `admin/js/modules-config.js` — it explains the exact steps without restructuring anything.
