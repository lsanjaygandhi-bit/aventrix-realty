-- Reproduces the LIVE policy state observed on 2026-09-25 (pg_policies),
-- which differs from the repo's schema*.sql files.
insert into storage.buckets values ('property-images', true), ('admin-photos', true) on conflict do nothing;

create or replace function public.enforce_notification_read_only_update() returns trigger language plpgsql as $f$
begin
  if exists (select 1 from admin_profiles where admin_profiles.id = auth.uid()) then return new; end if;
  if new.customer_id is distinct from old.customer_id or new.title is distinct from old.title
     or new.message is distinct from old.message or new.related_screen is distinct from old.related_screen
     or new.related_id is distinct from old.related_id or new.created_at is distinct from old.created_at then
    raise exception 'Customers may only mark their own notifications as read; no other change is allowed.';
  end if; return new; end; $f$;
create or replace function public.enforce_site_visit_customer_cancel_only() returns trigger language plpgsql as $f$
begin
  if exists (select 1 from admin_profiles where admin_profiles.id = auth.uid()) then return new; end if;
  if new.customer_id is distinct from old.customer_id or new.property_id is distinct from old.property_id
     or new.requested_date is distinct from old.requested_date or new.requested_time is distinct from old.requested_time
     or new.notes is distinct from old.notes or old.status is distinct from 'Requested' or new.status is distinct from 'Cancelled' then
    raise exception 'Customers may only cancel their own Requested site visit; no other change is allowed.';
  end if; return new; end; $f$;
create trigger trg_site_visits_customer_update_guard before update on site_visits for each row execute function enforce_site_visit_customer_cancel_only();
create trigger trg_notifications_customer_update_guard before update on notifications for each row execute function enforce_notification_read_only_update();

-- office_locations: live has RLS on and NO policies
drop policy if exists "Public can view published office locations" on office_locations;
drop policy if exists "Admin full access to office locations" on office_locations;

drop policy "Admin full access to properties" on properties;
create policy "Admin full access to properties" on properties for all to authenticated
  using (exists (select 1 from admin_profiles where admin_profiles.id = auth.uid()))
  with check (exists (select 1 from admin_profiles where admin_profiles.id = auth.uid()));
create policy "Authenticated users can view published properties" on properties for select to authenticated using (publish_status = 'Published');
create policy "Customers can submit their own properties" on properties for insert to authenticated with check (submitted_by = auth.uid());
create policy "Customers can update their own submitted properties" on properties for update to authenticated using (submitted_by = auth.uid()) with check (submitted_by = auth.uid());
create policy "Customers can view their own submitted properties" on properties for select to authenticated using (submitted_by = auth.uid());

drop policy "Admin full access to enquiries" on enquiries;
create policy "Admin full access to enquiries" on enquiries for all to authenticated
  using (exists (select 1 from admin_profiles where admin_profiles.id = auth.uid()))
  with check (exists (select 1 from admin_profiles where admin_profiles.id = auth.uid()));
create policy "Customer can view own enquiries" on enquiries for select to authenticated using (auth.uid() = submitted_by);
create policy "Customers can submit their own enquiries" on enquiries for insert to authenticated with check (submitted_by = auth.uid());
create policy "Customers can view their own enquiries" on enquiries for select to authenticated using (submitted_by = auth.uid());

create policy "Admin can insert own profile" on admin_profiles for insert to authenticated with check (auth.uid() = id);
create policy "Admin can update own profile" on admin_profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "Admin can view own profile" on admin_profiles for select to authenticated using (auth.uid() = id);

create policy "Admin full access to notifications" on notifications for all to authenticated
  using (exists (select 1 from admin_profiles where admin_profiles.id = auth.uid())) with check (exists (select 1 from admin_profiles where admin_profiles.id = auth.uid()));
create policy "Customers can update their own notifications" on notifications for update to authenticated using (customer_id = auth.uid()) with check (customer_id = auth.uid());
create policy "Customers can view their own notifications" on notifications for select to authenticated using (customer_id = auth.uid());
create policy "Admin full access to site visits" on site_visits for all to authenticated
  using (exists (select 1 from admin_profiles where admin_profiles.id = auth.uid())) with check (exists (select 1 from admin_profiles where admin_profiles.id = auth.uid()));
create policy "Customers can cancel their own requested site visits" on site_visits for update to authenticated using (customer_id = auth.uid() and status = 'Requested') with check (customer_id = auth.uid() and status = 'Cancelled');
create policy "Customers can request their own site visits" on site_visits for insert to authenticated with check (customer_id = auth.uid());
create policy "Customers can view their own site visits" on site_visits for select to authenticated using (customer_id = auth.uid());

create policy "Users manage their own recently viewed" on recently_viewed for all to public using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage their own shortlist" on shortlists for all to public using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage their own wishlist" on wishlists for all to public using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Allow delete" on storage.objects for delete to public using (bucket_id = 'property-images');
create policy "Allow update" on storage.objects for update to public using (bucket_id = 'property-images');
create policy "Allow upload and view 107eh68_0" on storage.objects for select to anon using (bucket_id = 'property-images');
create policy "Allow upload and view 107eh68_1" on storage.objects for insert to anon with check (bucket_id = 'property-images');
create policy "Allow uploads" on storage.objects for insert to public with check (bucket_id = 'property-images');
create policy "Public read property images" on storage.objects for select to public using (bucket_id = 'property-images');

-- Seed: 1 admin (as live), 1 fresh buyer, 1 realtor-to-be, data rows
insert into auth.users values
 ('00000000-0000-0000-0000-00000000000a','admin@aventrix.test', now()),
 ('00000000-0000-0000-0000-00000000000b','buyer@example.test', now()),
 ('00000000-0000-0000-0000-00000000000c','realtor@aventrix.test', now()),
 ('00000000-0000-0000-0000-00000000000d','buyer2@example.test', now());
insert into admin_profiles (id, name, role) values ('00000000-0000-0000-0000-00000000000a','Sanjay','Admin');
insert into properties (slug, title, publish_status, location, bedrooms, price_value) values
 ('pub-medavakkam-2bhk','2 BHK Apartment','Published','Medavakkam',2,7500000),
 ('draft-secret','Unreleased Land','Draft','Velachery',null,null);
insert into enquiries (form_type, name, phone) values ('Enquiry','Existing Lead','9000000000');
insert into storage.objects (bucket_id, name) values ('property-images','properties/a.jpg');
insert into pages (page_key, page_label) values ('home','Homepage');
-- Content as on live (2026-09-25): 3 seeded testimonials Published, 1 Draft;
-- 'Sample Realtor' Published alongside the real leadership profile.
insert into testimonials (client_name, client_role, quote, publish_status, display_order) values
 ('Ramesh Kumar','Purchased Residential Plot, Chromepet','Q1','Published',1),
 ('Priya Venkatesan','Sold Commercial Property','Q2','Published',2),
 ('Arvind Balaji','Bought Villa, Old Pallavaram','Q3','Published',3),
 ('Hema Krishnamoorthy','Property Seller – Tambaram East, Chennai | Client, 2015','Q4','Draft',4);
insert into realtors (slug, name, display_order) values ('sanjay','L. Sanjay Gandhi',1), ('sample-realtor','Sample Realtor',9);
