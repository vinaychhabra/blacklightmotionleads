-- ============================================================
-- AI Lead Generator - MVP schema
-- Adds a review layer between discovery and approved CRM leads.
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists lead_generation_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  location text,
  keywords text[] default '{}',
  requested_leads integer default 0,
  queries_generated integer default 0,
  businesses_discovered integer default 0,
  duplicates_removed integer default 0,
  unique_leads integer default 0,
  websites_enriched integer default 0,
  emails_found integer default 0,
  hot_count integer default 0,
  warm_count integer default 0,
  cold_count integer default 0,
  status text default 'completed',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists scraped_leads (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references lead_generation_campaigns(id) on delete set null,
  company_name text,
  business_category text,
  description text,
  phone text,
  email text,
  website text,
  address text,
  city text,
  state text,
  country text,
  postal_code text,
  latitude double precision,
  longitude double precision,
  google_place_id text,
  external_place_id text,
  source text,
  source_url text,
  rating numeric,
  review_count integer,
  facebook_url text,
  instagram_url text,
  linkedin_url text,
  youtube_url text,
  contact_page_url text,
  lead_score integer default 0,
  lead_temperature text default 'COLD' check (lead_temperature in ('HOT','WARM','COLD')),
  ai_relevance boolean,
  ai_reason text,
  ai_recommended_pitch text,
  enrichment_status text default 'DISCOVERED' check (enrichment_status in ('DISCOVERED','ENRICHING','ENRICHED','QUALIFIED','IMPORTED','FAILED')),
  review_status text default 'PENDING' check (review_status in ('PENDING','APPROVED','REJECTED','DUPLICATE','IMPORTED')),
  notes text,
  tags text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (external_place_id)
);

create table if not exists lead_generation_settings (
  id int primary key default 1,
  provider_name text default 'demo',
  api_provider text default 'DemoBusinessSearchProvider',
  google_maps_api_enabled boolean default false,
  website_enrichment_enabled boolean default false,
  email_enrichment_enabled boolean default false,
  ai_qualification_enabled boolean default false,
  max_leads_per_campaign integer default 200,
  max_api_requests integer default 500,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lead_generation_settings_singleton check (id = 1)
);

insert into lead_generation_settings (id)
values (1)
on conflict (id) do nothing;

alter table lead_generation_campaigns enable row level security;
alter table scraped_leads enable row level security;
alter table lead_generation_settings enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'lead_generation_campaigns'
      and policyname = 'authenticated read lead_generation_campaigns'
  ) then
    create policy "authenticated read lead_generation_campaigns" on public.lead_generation_campaigns
      for select using (auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'lead_generation_campaigns'
      and policyname = 'authenticated insert lead_generation_campaigns'
  ) then
    create policy "authenticated insert lead_generation_campaigns" on public.lead_generation_campaigns
      for insert with check (auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'lead_generation_campaigns'
      and policyname = 'authenticated update lead_generation_campaigns'
  ) then
    create policy "authenticated update lead_generation_campaigns" on public.lead_generation_campaigns
      for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'scraped_leads'
      and policyname = 'authenticated read scraped_leads'
  ) then
    create policy "authenticated read scraped_leads" on public.scraped_leads
      for select using (auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'scraped_leads'
      and policyname = 'authenticated insert scraped_leads'
  ) then
    create policy "authenticated insert scraped_leads" on public.scraped_leads
      for insert with check (auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'scraped_leads'
      and policyname = 'authenticated update scraped_leads'
  ) then
    create policy "authenticated update scraped_leads" on public.scraped_leads
      for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'lead_generation_settings'
      and policyname = 'authenticated read lead_generation_settings'
  ) then
    create policy "authenticated read lead_generation_settings" on public.lead_generation_settings
      for select using (auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'lead_generation_settings'
      and policyname = 'authenticated update lead_generation_settings'
  ) then
    create policy "authenticated update lead_generation_settings" on public.lead_generation_settings
      for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
  end if;
end $$;
