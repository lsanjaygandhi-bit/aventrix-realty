-- AVENTRIX REALTY — COMPLETE REAL ESTATE INTELLIGENCE (PROPOSAL)
-- File: sql/proposal-2026-10-19-real-estate-intelligence.sql
-- Additive only. Do NOT apply to production until reviewed and tested.
-- Requires existing public.is_admin(), public.is_staff(), and Supabase Auth.
-- Does not alter existing property_events / enquiries tables.

begin;

create table if not exists public.site_visitor_sessions (
  session_key text primary key,
  visitor_key text not null,
  user_id uuid references auth.users(id) on delete set null,
  current_path text not null default '/',
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint site_visitor_sessions_key_len check (length(session_key) between 16 and 80),
  constraint site_visitor_sessions_visitor_len check (length(visitor_key) between 8 and 80),
  constraint site_visitor_sessions_path_len check (length(current_path) between 1 and 300)
);

create index if not exists idx_site_visitor_sessions_last_seen
  on public.site_visitor_sessions (last_seen_at desc);
create index if not exists idx_site_visitor_sessions_user
  on public.site_visitor_sessions (user_id, last_seen_at desc);

create table if not exists public.site_analytics_events (
  id bigint generated always as identity primary key,
  session_key text not null references public.site_visitor_sessions(session_key) on delete cascade,
  visitor_key text not null,
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  page_path text not null,
  property_slug text,
  created_at timestamptz not null default now(),
  constraint site_analytics_events_type_check
    check (event_type in ('page_view', 'enquiry_submit')),
  constraint site_analytics_events_path_len check (length(page_path) between 1 and 300),
  constraint site_analytics_events_slug_len check (property_slug is null or length(property_slug) <= 180)
);

create unique index if not exists uq_site_analytics_page_view_session_path
  on public.site_analytics_events (session_key, page_path, event_type)
  where event_type = 'page_view';
create index if not exists idx_site_analytics_events_created
  on public.site_analytics_events (created_at desc);
create index if not exists idx_site_analytics_events_path_created
  on public.site_analytics_events (page_path, created_at desc);
create index if not exists idx_site_analytics_events_visitor_created
  on public.site_analytics_events (visitor_key, created_at desc);
create index if not exists idx_site_analytics_events_user_created
  on public.site_analytics_events (user_id, created_at desc);

create table if not exists public.user_login_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('login', 'logout')),
  created_at timestamptz not null default now()
);
create index if not exists idx_user_login_history_user_created
  on public.user_login_history (user_id, created_at desc);
create index if not exists idx_user_login_history_created
  on public.user_login_history (created_at desc);

alter table public.site_visitor_sessions enable row level security;
alter table public.site_analytics_events enable row level security;
alter table public.user_login_history enable row level security;

drop policy if exists "Admins read visitor sessions" on public.site_visitor_sessions;
create policy "Admins read visitor sessions"
on public.site_visitor_sessions for select to authenticated
using (public.is_admin());

drop policy if exists "Admins read site analytics events" on public.site_analytics_events;
create policy "Admins read site analytics events"
on public.site_analytics_events for select to authenticated
using (public.is_admin());

drop policy if exists "Admins read user login history" on public.user_login_history;
create policy "Admins read user login history"
on public.user_login_history for select to authenticated
using (public.is_admin());

revoke all on public.site_visitor_sessions from anon, authenticated;
revoke all on public.site_analytics_events from anon, authenticated;
revoke all on public.user_login_history from anon, authenticated;
grant select on public.site_visitor_sessions, public.site_analytics_events, public.user_login_history to authenticated;
-- RLS remains the authority for every direct SELECT.

create or replace function public.track_site_activity(
  p_visitor_key text,
  p_session_key text,
  p_event_type text,
  p_page_path text,
  p_property_slug text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_path text;
  v_slug text;
begin
  if p_visitor_key is null or length(p_visitor_key) < 8 or length(p_visitor_key) > 80 then return; end if;
  if p_session_key is null or length(p_session_key) < 16 or length(p_session_key) > 80 then return; end if;
  if p_event_type is null or p_event_type not in ('page_view', 'heartbeat', 'enquiry_submit') then return; end if;

  -- Enforce path-only storage server-side too; query strings can contain private data.
  v_path := left(split_part(split_part(coalesce(nullif(trim(p_page_path), ''), '/'), '?', 1), '#', 1), 300);
  if left(v_path, 1) <> '/' or v_path like '%://%' then return; end if;
  if public.is_staff() then return; end if;

  -- Soft per-visitor caps. The event cap limits page/enquiry spam; the
  -- session cap also covers heartbeats, which do not create event rows.
  -- These are defence-in-depth only: clients can rotate IDs, so configure
  -- Cloudflare edge rate limiting before public rollout.
  if p_event_type in ('page_view', 'enquiry_submit') and (
      select count(*) from public.site_analytics_events e
      where e.visitor_key = p_visitor_key and e.created_at > now() - interval '1 minute'
    ) >= 30 then
    return;
  end if;

  if (
      select count(*) from public.site_visitor_sessions s
      where s.visitor_key = p_visitor_key
        and s.last_seen_at > now() - interval '1 minute'
    ) >= 60
    and not exists (
      select 1 from public.site_visitor_sessions s
      where s.session_key = p_session_key and s.visitor_key = p_visitor_key
    ) then
    return;
  end if;

  v_slug := nullif(left(coalesce(trim(p_property_slug), ''), 180), '');
  if v_slug is not null and not exists (
    select 1 from public.properties p
    where p.slug = v_slug and p.publish_status = 'Published'
  ) then
    v_slug := null;
  end if;

  insert into public.site_visitor_sessions
    (session_key, visitor_key, user_id, current_path, started_at, last_seen_at)
  values
    (p_session_key, p_visitor_key, auth.uid(), v_path, now(), now())
  on conflict (session_key) do update
    set visitor_key = excluded.visitor_key,
        user_id = coalesce(excluded.user_id, public.site_visitor_sessions.user_id),
        current_path = excluded.current_path,
        last_seen_at = now();

  if p_event_type in ('page_view', 'enquiry_submit') then
    insert into public.site_analytics_events
      (session_key, visitor_key, user_id, event_type, page_path, property_slug)
    values
      (p_session_key, p_visitor_key, auth.uid(), p_event_type, v_path, v_slug)
    on conflict do nothing;
  end if;
end;
$function$;

revoke all on function public.track_site_activity(text, text, text, text, text) from public;
grant execute on function public.track_site_activity(text, text, text, text, text) to anon, authenticated;

create or replace function public.record_login_activity(p_event_type text)
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_event_type not in ('login', 'logout') then raise exception 'Unsupported event'; end if;
  insert into public.user_login_history(user_id, event_type) values (auth.uid(), p_event_type);
end;
$function$;

revoke all on function public.record_login_activity(text) from public, anon;
grant execute on function public.record_login_activity(text) to authenticated;

-- Admin-only list. Do not expose auth.users through a public view or browser query.
create or replace function public.admin_intelligence_users(p_limit integer default 100)
returns table (
  user_id uuid,
  email text,
  registered_at timestamptz,
  last_sign_in_at timestamptz,
  app_role text,
  full_name text
)
language plpgsql
security definer
set search_path = public
as $function$
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  return query
    select u.id, u.email::text, u.created_at, u.last_sign_in_at,
           coalesce(ur.role, 'customer')::text, cp.full_name
    from auth.users u
    left join public.user_roles ur on ur.user_id = u.id
    left join public.customer_profiles cp on cp.user_id = u.id
    order by u.created_at desc
    limit greatest(1, least(coalesce(p_limit, 100), 500));
end;
$function$;

revoke all on function public.admin_intelligence_users(integer) from public, anon;
grant execute on function public.admin_intelligence_users(integer) to authenticated;


-- Controlled admin-only wrappers for existing aggregate views.
-- These functions do not expose the underlying SECURITY DEFINER views directly.
create or replace function public.admin_intelligence_property_performance(p_limit integer default 100)
returns table (
  property_id uuid,
  property_code text,
  slug text,
  title text,
  publish_status text,
  views bigint,
  enquiry_events bigint,
  whatsapp_clicks bigint,
  call_clicks bigint,
  wishlist_adds bigint,
  shortlist_adds bigint,
  shares bigint,
  site_visit_requests bigint,
  leads bigint
)
language plpgsql
security definer
set search_path = public
as $function$
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  return query
    select pp.id, pp.property_code, pp.slug, pp.title, pp.publish_status,
           pp.views, pp.enquiry_events, pp.whatsapp_clicks, pp.call_clicks,
           pp.wishlist_adds, pp.shortlist_adds, pp.shares,
           pp.site_visit_requests, pp.leads
    from public.property_performance pp
    order by pp.views desc, pp.title asc
    limit greatest(1, least(coalesce(p_limit, 100), 500));
end;
$function$;

revoke all on function public.admin_intelligence_property_performance(integer) from public, anon;
grant execute on function public.admin_intelligence_property_performance(integer) to authenticated;

create or replace function public.admin_intelligence_crm_summary()
returns table (
  open_leads bigint,
  new_leads bigint,
  hot_requirements bigint,
  overdue_tasks bigint,
  upcoming_site_visits bigint,
  active_deals bigint,
  closed_value_this_month numeric,
  brokerage_this_month numeric
)
language plpgsql
security definer
set search_path = public
as $function$
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  return query
    select d.open_leads, d.new_leads, d.hot_requirements, d.overdue_tasks,
           d.upcoming_site_visits, d.active_deals, d.closed_value_this_month,
           d.brokerage_this_month
    from public.crm_dashboard_v2 d
    limit 1;
end;
$function$;

revoke all on function public.admin_intelligence_crm_summary() from public, anon;
grant execute on function public.admin_intelligence_crm_summary() to authenticated;

commit;
