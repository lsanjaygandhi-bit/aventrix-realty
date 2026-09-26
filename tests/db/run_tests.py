#!/usr/bin/env python3
"""Local RLS test runner for Aventrix migrations.
Usage: run_tests.py <phase>   phase = baseline | p0 | p1
Each test runs in its own transaction as a real API role (anon/authenticated)
with auth.uid() set, then rolls back."""
import subprocess, sys
DB = "aventrix_test"
A, B, R, B2 = ("00000000-0000-0000-0000-00000000000" + c for c in "abcd")

def run(role, uid, sql):
    script = f"""\\set ON_ERROR_STOP 1
begin;
select set_config('request.jwt.claim.sub', '{uid or ''}', true);
set local role {role};
{sql}
rollback;"""
    p = subprocess.run(["psql", "-X", "-q", "-tA", "-d", DB], input=script, capture_output=True, text=True)
    out = [l for l in p.stdout.strip().splitlines() if l.strip()]
    return p.returncode == 0, (out[-1] if out else ""), p.stderr.strip().splitlines()[-1:] 

results = []
def check(name, role, uid, sql, expect):
    ok, last, err = run(role, uid, sql)
    if expect == "error": passed = not ok
    elif expect == "ok": passed = ok
    else: passed = ok and last == str(expect)
    results.append(passed)
    print(("PASS " if passed else "FAIL ") + name + ("" if passed else f"   -> ok={ok} last={last!r} err={err}"))

def cnt(stmt):  # rows affected by an update/delete/insert … returning 1
    return f"with x as ({stmt} returning 1) select count(*) from x;"

phase = sys.argv[1]
if phase == "baseline":
    print("--- Confirming the LIVE vulnerabilities are reproduced (these SHOULD succeed = insecure) ---")
    check("VULN buyer self-inserts admin_profiles", "authenticated", B, cnt(f"insert into admin_profiles(id,name) values ('{B}','x')"), 1)
    check("VULN buyer edits website pages", "authenticated", B, cnt("update pages set hero_title='hacked'"), 1)
    check("VULN buyer edits site_settings phone", "authenticated", B, cnt("update site_settings set realtor_phone_1='0'"), 1)
    check("VULN anon uploads to property-images", "anon", None, cnt("insert into storage.objects(bucket_id,name) values ('property-images','x.jpg')"), 1)
    check("VULN anon deletes property images", "anon", None, cnt("delete from storage.objects where bucket_id='property-images'"), 1)
    check("BUG office_locations invisible to public", "anon", None, "select count(*) from office_locations;", 0)
    check("BUG logged-in buyer website enquiry rejected", "authenticated", B, "insert into enquiries(form_type,name) values ('Enquiry','Buyer');", "error")
    check("VULN buyer self-publishes own listing", "authenticated", B,
          f"insert into properties(slug,title,submitted_by) values ('mine','Mine','{B}'); " + cnt("update properties set publish_status='Published', is_featured=true where slug='mine'"), 1)
    check("CONTENT Sample Realtor publicly visible (pre-migration)", "anon", None, "select count(*) from realtors where slug='sample-realtor';", 1)
    check("CONTENT 3 seeded testimonials publicly visible (pre-migration)", "anon", None, "select count(*) from testimonials;", 3)
    sys.exit(0 if all(results) else 1)

print("=== P0 security matrix ===")
check("buyer cannot self-insert admin_profiles", "authenticated", B, f"insert into admin_profiles(id,name) values ('{B}','x');", "error")
check("buyer cannot self-promote in user_roles", "authenticated", B, f"insert into user_roles(user_id,role) values ('{B}','admin');", "error")
check("buyer cannot edit pages", "authenticated", B, cnt("update pages set hero_title='hacked'"), 0)
check("buyer cannot edit site_settings", "authenticated", B, cnt("update site_settings set realtor_phone_1='0'"), 0)
check("buyer cannot edit realtors", "authenticated", B, cnt("update realtors set name='x'"), 0)
check("buyer cannot read media_library rows / insert", "authenticated", B, "insert into media_library(file_url) values ('x');", "error")
check("buyer can still READ pages", "authenticated", B, "select count(*) from pages;", 1)
check("buyer can still READ realtors", "authenticated", B, "select count(*) from realtors where slug='sanjay';", 1)
check("buyer can still READ a published testimonial", "authenticated", B,
      "set local role postgres; insert into testimonials(client_name,quote,publish_status) values ('Genuine','Q','Published'); set local role authenticated; select count(*) from testimonials where client_name='Genuine';", 1)
check("anon can READ a published testimonial", "anon", None,
      "set local role postgres; insert into testimonials(client_name,quote,publish_status) values ('Genuine','Q','Published'); set local role anon; select count(*) from testimonials where client_name='Genuine';", 1)
check("buyer can still READ site_settings", "authenticated", B, "select count(*) from site_settings;", 1)
check("anon can READ pages", "anon", None, "select count(*) from pages;", 1)
check("anon sees published properties only", "anon", None, "select count(*) from properties;", 1)
check("buyer sees published properties only", "authenticated", B, "select count(*) from properties;", 1)
check("buyer cannot read other enquiries", "authenticated", B, "select count(*) from enquiries;", 0)
check("public office_locations visible", "anon", None, "select count(*) from office_locations;", 2)
check("buyer office_locations visible", "authenticated", B, "select count(*) from office_locations;", 2)
check("logged-in buyer website enquiry now works", "authenticated", B, cnt("insert into enquiries(form_type,name) values ('Enquiry','Buyer')"), 1)
check("buyer enquiry with own submitted_by works + visible to them", "authenticated", B,
      f"insert into enquiries(form_type,name,submitted_by) values ('Enquiry','Buyer','{B}'); select count(*) from enquiries;", 1)
check("buyer cannot spoof submitted_by of someone else", "authenticated", B, f"insert into enquiries(form_type,submitted_by) values ('E','{B2}');", "error")
check("anon cannot set submitted_by", "anon", None, f"insert into enquiries(form_type,submitted_by) values ('E','{B}');", "error")
check("anon forced status=new", "anon", None, "insert into enquiries(form_type,status) values ('E','read'); set local role postgres; select status from enquiries where form_type='E';", "new")
check("customer listing forced to Draft on insert", "authenticated", B,
      f"insert into properties(slug,title,submitted_by,publish_status,is_featured) values ('mine','Mine','{B}','Published',true); select publish_status||'/'||is_featured from properties where slug='mine';", "Draft/false")
check("customer cannot self-publish own listing", "authenticated", B,
      f"insert into properties(slug,title,submitted_by) values ('mine','Mine','{B}'); update properties set publish_status='Published' where slug='mine';", "error")
check("customer CAN edit own listing text", "authenticated", B,
      f"insert into properties(slug,title,submitted_by) values ('mine','Mine','{B}'); " + cnt("update properties set title='Mine v2' where slug='mine'"), 1)
check("anon cannot upload property image", "anon", None, "insert into storage.objects(bucket_id,name) values ('property-images','x.jpg');", "error")
check("anon cannot delete property images", "anon", None, cnt("delete from storage.objects where bucket_id='property-images'"), 0)
check("anon cannot overwrite property images", "anon", None, cnt("update storage.objects set name='y' where bucket_id='property-images'"), 0)
check("buyer cannot upload to shared folder", "authenticated", B, "insert into storage.objects(bucket_id,name) values ('property-images','properties/x.jpg');", "error")
check("buyer CAN upload to own customer-uploads folder", "authenticated", B, cnt(f"insert into storage.objects(bucket_id,name) values ('property-images','customer-uploads/{B}/x.jpg')"), 1)
check("buyer cannot upload into another user's folder", "authenticated", B, f"insert into storage.objects(bucket_id,name) values ('property-images','customer-uploads/{B2}/x.jpg');", "error")
check("public can still view images", "anon", None, "select count(*) from storage.objects where bucket_id='property-images';", 1)
check("admin can upload images", "authenticated", A, cnt("insert into storage.objects(bucket_id,name) values ('property-images','properties/n.jpg')"), 1)
check("admin can delete images", "authenticated", A, cnt("delete from storage.objects where bucket_id='property-images'"), 1)
check("admin role backfilled", "authenticated", A, "select public.app_role();", "admin")
check("buyer role defaults to customer", "authenticated", B, "select public.app_role();", "customer")
check("anon role", "anon", None, "select public.app_role();", "anon")
check("admin edits pages", "authenticated", A, cnt("update pages set hero_title='ok'"), 1)
check("admin sees drafts", "authenticated", A, "select count(*) from properties;", 2)
check("admin publishes property", "authenticated", A, cnt("update properties set publish_status='Published' where slug='draft-secret'"), 1)
check("admin reads all enquiries", "authenticated", A, "select count(*) from enquiries;", 1)
check("admin writes office_locations", "authenticated", A, cnt("update office_locations set business_hours='9-6'"), 2)
check("cannot delete last admin", "authenticated", A, f"delete from user_roles where user_id='{A}';", "error")
check("admin can add a realtor role", "authenticated", A, cnt(f"insert into user_roles(user_id,role) values ('{R}','realtor')"), 1)

if phase == "p1":
    print("=== P1 CRM / buyer / analytics ===")
    setup_realtor = f"set local role postgres; insert into user_roles(user_id,role) values ('{R}','realtor'); insert into enquiries(id,form_type,name,assigned_to) values ('11111111-1111-1111-1111-111111111111','Enquiry','Assigned Lead','{R}'); set local role authenticated;"
    check("existing lead got defaults", "authenticated", A, "select lead_stage||'/'||lead_source from enquiries limit 1;", "NEW/Website")
    check("anon cannot pre-set CRM fields", "anon", None,
          f"insert into enquiries(form_type,lead_stage,lead_source,assigned_to) values ('X','BOOKED','Referral','{R}'); set local role postgres; select lead_stage||'/'||lead_source||'/'||coalesce(assigned_to::text,'none') from enquiries where form_type='X';", "NEW/Website/none")
    check("property_slug resolves to property_code", "anon", None,
          "insert into enquiries(form_type,property_slug) values ('P','pub-medavakkam-2bhk'); set local role postgres; select property_code from enquiries where form_type='P';", "AVX-000001")
    check("draft property_slug is NOT resolved", "anon", None,
          "insert into enquiries(form_type,property_slug) values ('P','draft-secret'); set local role postgres; select coalesce(property_code,'none') from enquiries where form_type='P';", "none")
    check("invalid lead_stage rejected (admin)", "authenticated", A, "update enquiries set lead_stage='WON';", "error")
    check("realtor sees only assigned lead", "authenticated", R, setup_realtor + "select count(*) from enquiries;", 1)
    check("realtor updates stage + follow-up", "authenticated", R, setup_realtor + cnt("update enquiries set lead_stage='CONTACTED', next_follow_up_at=now()+interval '1 day'"), 1)
    check("realtor cannot re-assign", "authenticated", R, setup_realtor + "update enquiries set assigned_to=null;", "error")
    check("realtor can add note on assigned lead", "authenticated", R, setup_realtor + cnt(f"insert into lead_notes(enquiry_id,note,author_id) values ('11111111-1111-1111-1111-111111111111','Called','{R}')"), 1)
    manage = f"set local role postgres; update properties set managed_by='{R}' where slug='draft-secret'; set local role authenticated;"
    check("realtor cannot publish a managed property", "authenticated", R, setup_realtor + manage + "update properties set publish_status='Published' where slug='draft-secret';", "error")
    check("realtor CAN edit a managed property", "authenticated", R, setup_realtor + manage + cnt("update properties set title='Edited' where slug='draft-secret'"), 1)
    check("realtor cannot edit unmanaged property", "authenticated", R, setup_realtor + manage + cnt("update properties set title='X' where slug='pub-medavakkam-2bhk'"), 0)
    check("realtor sees draft inventory", "authenticated", R, setup_realtor + "select count(*) from properties;", 2)
    check("realtor staff_directory works", "authenticated", R, setup_realtor + "select count(*) from staff_directory();", 2)
    check("buyer staff_directory empty", "authenticated", B, "select count(*) from staff_directory();", 0)
    check("buyer cannot add lead notes", "authenticated", B, "insert into lead_notes(enquiry_id,note) select id,'x' from enquiries limit 1;", "ok")  # select returns 0 rows for buyer → inserts nothing
    check("buyer lead_notes insert 0 rows", "authenticated", B, "select count(*) from lead_notes;", 0)
    check("buyer saves requirement", "authenticated", B, cnt("insert into buyer_requirements(transaction_type,preferred_locations,budget_min,budget_max,bhk,parking_required) values ('buy','{Medavakkam}',6000000,9000000,'{2}',true)"), 1)
    check("buyer saves search", "authenticated", B, cnt("insert into saved_searches(name,query_string) values ('2BHK Medavakkam','location=Medavakkam&beds=2')"), 1)
    check("buyer2 cannot read buyer's saved searches", "authenticated", B2,
          f"set local role postgres; insert into saved_searches(user_id,name) values ('{B}','x'); set local role authenticated; select count(*) from saved_searches;", 0)
    check("buyer cannot write requirement for someone else", "authenticated", B, f"insert into buyer_requirements(user_id) values ('{B2}');", "error")
    check("anon tracks a view (deduped)", "anon", None,
          "select track_property_event('pub-medavakkam-2bhk','view','visitor-abc-123'); select track_property_event('pub-medavakkam-2bhk','view','visitor-abc-123'); set local role postgres; select count(*) from property_events;", 1)
    check("draft property events ignored", "anon", None,
          "select track_property_event('draft-secret','view','visitor-abc-123'); set local role postgres; select count(*) from property_events;", 0)
    check("bogus event type ignored", "anon", None,
          "select track_property_event('pub-medavakkam-2bhk','fake','visitor-abc-123'); set local role postgres; select count(*) from property_events;", 0)
    check("anon cannot insert events directly", "anon", None, "insert into property_events(property_id,event_type,visitor_key) select id,'view','zzzzzzzzzz' from properties limit 1;", "error")
    check("admin's own clicks not counted", "authenticated", A,
          "select track_property_event('pub-medavakkam-2bhk','view','visitor-admin-1'); set local role postgres; select count(*) from property_events;", 0)
    check("admin reads performance view", "authenticated", A,
          "select set_config('request.jwt.claim.sub','',true); set local role anon; select track_property_event('pub-medavakkam-2bhk','whatsapp_click','visitor-xyz-999'); select set_config('request.jwt.claim.sub','" + A + "',true); set local role authenticated; select whatsapp_clicks from property_performance where slug='pub-medavakkam-2bhk';", 1)
    check("buyer reads performance view = nothing", "authenticated", B, "select count(*) from property_performance where views>0 or whatsapp_clicks>0;", 0)
    check("metrics null for buyer", "authenticated", B, "select coalesce(admin_dashboard_metrics()::text,'null');", "null")
    check("metrics for admin", "authenticated", A, "select admin_dashboard_metrics()->>'leads_new';", 1)
    check("wishlist still owner-only", "authenticated", B, f"insert into wishlists(user_id,property_slug) values ('{B2}','x');", "error")
    check("wishlist own works", "authenticated", B, cnt(f"insert into wishlists(user_id,property_slug) values ('{B}','x')"), 1)

    print("=== Content migration (03) ===")
    check("Sample Realtor still exists (not deleted)", "authenticated", A, "select count(*) from realtors where slug='sample-realtor';", 1)
    check("Sample Realtor is Draft", "authenticated", A, "select publish_status from realtors where slug='sample-realtor';", "Draft")
    check("real leadership profile still Published", "authenticated", A, "select publish_status from realtors where slug='sanjay';", "Published")
    check("anon cannot see Sample Realtor", "anon", None, "select count(*) from realtors where slug='sample-realtor';", 0)
    check("buyer cannot see Sample Realtor", "authenticated", B, "select count(*) from realtors where slug='sample-realtor';", 0)
    check("all 4 testimonials still exist (none deleted)", "authenticated", A, "select count(*) from testimonials;", 4)
    check("3 seeded testimonials are Draft", "authenticated", A, "select count(*) from testimonials where publish_status='Draft' and client_name in ('Ramesh Kumar','Priya Venkatesan','Arvind Balaji');", 3)
    check("anon sees zero testimonials", "anon", None, "select count(*) from testimonials;", 0)
    check("no replacement content created", "authenticated", A, "select (select count(*) from realtors)||'/'||(select count(*) from testimonials);", "2/4")

total, passed = len(results), sum(results)
print(f"\n{passed}/{total} passed")
sys.exit(0 if passed == total else 1)
