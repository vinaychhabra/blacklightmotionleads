-- ============================================================
-- Blacklight Motion CRM — Migration v3
-- Adds: follow-up fields to leads, app_settings (branding: company
-- name + logo), and a public storage bucket for logo uploads.
-- Run this in the Supabase SQL Editor — safe alongside schema.sql,
-- migration_v2.sql.
-- ============================================================

-- Lead fields used by the follow-up and lost-reason workflows.
alter table if exists public.leads
  add column if not exists priority text default 'Warm',
  add column if not exists follow_up_date date,
  add column if not exists lost_reason text;

-- Channel-specific copy and optional image/CTA fields for templates.
alter table if exists public.templates
  add column if not exists channel text default 'both',
  add column if not exists image_url text,
  add column if not exists cta_label text,
  add column if not exists cta_url text;

-- Single-row settings table
create table if not exists app_settings (
  id int primary key default 1,
  company_name text not null default 'Blacklight Motion',
  logo_url text,
  lead_provider text default 'demo' check (lead_provider in ('demo', 'google_places')),
  google_places_api_key text default '',
  ai_provider text default 'none' check (ai_provider in ('none', 'openai', 'anthropic', 'google_gemini', 'azure_openai', 'groq')),
  ai_api_key text default '',
  openai_api_key text default '',
  google_maps_api_enabled boolean default false,
  website_enrichment_enabled boolean default false,
  email_enrichment_enabled boolean default false,
  ai_qualification_enabled boolean default false,
  email_provider text default 'system_mailto' check (email_provider in ('system_mailto', 'smtp', 'sendgrid', 'resend', 'mailgun', 'brevo', 'none')),
  email_from_name text default 'Blacklight Motion',
  email_from_address text default 'noreply@blacklightmotion.com',
  smtp_host text default '',
  smtp_port int default 587,
  smtp_username text default '',
  smtp_password text default '',
  smtp_secure boolean default true,
  sendgrid_api_key text default '',
  resend_api_key text default '',
  mailgun_api_key text default '',
  mailgun_domain text default '',
  brevo_api_key text default '',
  updated_at timestamptz not null default now(),
  constraint app_settings_singleton check (id = 1)
);

-- Upgrade an existing app_settings table created by an older schema.
alter table if exists public.app_settings
  add column if not exists company_name text not null default 'Blacklight Motion',
  add column if not exists logo_url text,
  add column if not exists lead_provider text default 'demo',
  add column if not exists google_places_api_key text default '',
  add column if not exists ai_provider text default 'none',
  add column if not exists ai_api_key text default '',
  add column if not exists openai_api_key text default '',
  add column if not exists google_maps_api_enabled boolean default false,
  add column if not exists website_enrichment_enabled boolean default false,
  add column if not exists email_enrichment_enabled boolean default false,
  add column if not exists ai_qualification_enabled boolean default false,
  add column if not exists email_provider text default 'system_mailto',
  add column if not exists email_from_name text default 'Blacklight Motion',
  add column if not exists email_from_address text default 'noreply@blacklightmotion.com',
  add column if not exists smtp_host text default '',
  add column if not exists smtp_port int default 587,
  add column if not exists smtp_username text default '',
  add column if not exists smtp_password text default '',
  add column if not exists smtp_secure boolean default true,
  add column if not exists sendgrid_api_key text default '',
  add column if not exists resend_api_key text default '',
  add column if not exists mailgun_api_key text default '',
  add column if not exists mailgun_domain text default '',
  add column if not exists brevo_api_key text default '',
  add column if not exists updated_at timestamptz not null default now();

insert into app_settings (
  id,
  company_name,
  lead_provider,
  google_places_api_key,
  ai_provider,
  ai_api_key,
  openai_api_key,
  google_maps_api_enabled,
  website_enrichment_enabled,
  email_enrichment_enabled,
  ai_qualification_enabled,
  email_provider,
  email_from_name,
  email_from_address,
  smtp_host,
  smtp_port,
  smtp_username,
  smtp_password,
  smtp_secure,
  sendgrid_api_key,
  resend_api_key,
  mailgun_api_key,
  mailgun_domain,
  brevo_api_key
)
values (
  1,
  'Blacklight Motion',
  'demo',
  '',
  'none',
  '',
  '',
  false,
  false,
  false,
  false,
  'system_mailto',
  'Blacklight Motion',
  'noreply@blacklightmotion.com',
  '',
  587,
  '',
  '',
  true,
  '',
  '',
  '',
  '',
  ''
)
on conflict (id) do nothing;

alter table app_settings enable row level security;

-- Branding is not sensitive — readable by anyone (including the
-- logged-out login page), but only your signed-in admin can change it.
drop policy if exists "public read app_settings" on app_settings;
create policy "public read app_settings" on app_settings
  for select using (true);

drop policy if exists "authenticated update app_settings" on app_settings;
create policy "authenticated update app_settings" on app_settings
  for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Storage bucket for the logo image
insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do nothing;

drop policy if exists "public read branding" on storage.objects;
create policy "public read branding" on storage.objects
  for select using (bucket_id = 'branding');

drop policy if exists "authenticated upload branding" on storage.objects;
create policy "authenticated upload branding" on storage.objects
  for insert with check (bucket_id = 'branding' and auth.role() = 'authenticated');

drop policy if exists "authenticated update branding storage" on storage.objects;
create policy "authenticated update branding storage" on storage.objects
  for update using (bucket_id = 'branding' and auth.role() = 'authenticated');

-- Make all new columns visible to PostgREST immediately.
notify pgrst, 'reload schema';

-- ============================================================
-- After running this: go to Settings in the app and upload your
-- logo / set your company name — it'll appear on the sidebar and
-- login page immediately, with no code changes needed.
-- ============================================================
