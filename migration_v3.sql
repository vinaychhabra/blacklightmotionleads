-- ============================================================
-- Blacklight Motion CRM — Migration v3
-- Adds: app_settings (branding: company name + logo) and a public
-- storage bucket for logo uploads.
-- Run this in the Supabase SQL Editor — safe alongside schema.sql,
-- migration_v2.sql.
-- ============================================================

-- Single-row settings table
create table if not exists app_settings (
  id int primary key default 1,
  company_name text not null default 'Blacklight Motion',
  logo_url text,
  updated_at timestamptz not null default now(),
  constraint app_settings_singleton check (id = 1)
);

insert into app_settings (id, company_name)
values (1, 'Blacklight Motion')
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

-- ============================================================
-- After running this: go to Settings in the app and upload your
-- logo / set your company name — it'll appear on the sidebar and
-- login page immediately, with no code changes needed.
-- ============================================================
