-- =====================================================================
-- PROPOSAL ONLY — NOT APPLIED. Do not run without Sanjay's approval.
-- Aventrix published market rates, managed from the Admin panel.
--
-- Today the website reads data/market-rates.json (a static file in the
-- repo). This optional migration moves the same data into Supabase so
-- rates can be edited in Admin instead of by editing JSON.
--
-- Follows the existing conventions in sql/schema.sql and
-- migration-2026-09-25-01-p0-security-roles.sql:
--   * publish_status 'Draft' | 'Published'
--   * public read of Published rows only; admin full access via
--     public.is_admin(); no service-role key in the browser.
--   * set_updated_at() trigger.
-- Nothing here changes any existing table, policy or function.
-- =====================================================================

create table if not exists public.market_rates (
    id               uuid primary key default gen_random_uuid(),
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now(),
    publish_status   text not null default 'Draft' check (publish_status in ('Draft', 'Published')),
    locality         text not null,
    aliases          text[] not null default '{}',
    property_type    text not null check (property_type in ('apartment', 'land', 'commercial')),
    rate_basis       text not null default 'asking' check (rate_basis in ('asking', 'guideline', 'registered', 'opinion')),
    area_basis       text not null default 'super_built_up' check (area_basis in ('super_built_up', 'built_up', 'carpet', 'plot_area')),
    low_per_sqft     numeric(12,2) not null check (low_per_sqft > 0),
    mid_per_sqft     numeric(12,2),
    high_per_sqft    numeric(12,2) not null,
    sources_count    integer not null default 1 check (sources_count >= 1),
    confidence       text not null default 'low' check (confidence in ('low', 'medium', 'high')),
    sources          jsonb not null default '[]'::jsonb,   -- [{name,url,data_type,period,figure_as_published,value_used_per_sqft,checked}]
    notes            text,
    last_checked     date not null,
    reviewed_by      uuid references auth.users(id),
    constraint market_rates_range check (high_per_sqft >= low_per_sqft),
    -- An approved rate must have at least two independent sources.
    constraint market_rates_publish_needs_two_sources check (publish_status <> 'Published' or sources_count >= 2),
    unique (locality, property_type)
);

drop trigger if exists market_rates_updated_at on public.market_rates;
create trigger market_rates_updated_at before update on public.market_rates
for each row execute function set_updated_at();

alter table public.market_rates enable row level security;

drop policy if exists "Public can view published market rates" on public.market_rates;
create policy "Public can view published market rates"
on public.market_rates for select to anon, authenticated
using (publish_status = 'Published' or public.is_admin());

drop policy if exists "Admin full access to market rates" on public.market_rates;
create policy "Admin full access to market rates"
on public.market_rates for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- Front-end switch-over (after this is applied and seeded):
--   js/property-tools.js initValuation() → replace the fetch of
--   data/market-rates.json with
--     supabaseClient.from('market_rates').select('*').eq('publish_status','Published')
--   and map low_per_sqft/high_per_sqft/mid_per_sqft to low/high/mid.
--   Keep the JSON file as the fallback when Supabase is unreachable.
-- Admin: add a module entry in admin/js/modules-config.js (table
-- 'market_rates') following the testimonials module pattern.
