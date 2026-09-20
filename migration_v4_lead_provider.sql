-- ============================================================
-- Blacklight Motion CRM — Migration v4
-- Fixes: app_settings.lead_provider CHECK constraint rejected the
-- "openstreetmap" option added to the Settings UI, so choosing it
-- and saving silently failed and the app kept using whatever
-- provider was previously configured.
-- Run this in the Supabase SQL Editor after migration_v3.sql.
-- ============================================================

do $$
declare
  constraint_name text;
begin
  select con.conname into constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_attribute att on att.attrelid = rel.oid and att.attnum = any(con.conkey)
  where rel.relname = 'app_settings'
    and con.contype = 'c'
    and att.attname = 'lead_provider';

  if constraint_name is not null then
    execute format('alter table public.app_settings drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.app_settings
  add constraint app_settings_lead_provider_check
  check (lead_provider in ('demo', 'google_places', 'openstreetmap'));
