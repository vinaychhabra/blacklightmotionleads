# Blacklight Motion — CRM

A complete Next.js + TypeScript + Tailwind CRM, connected to your
Supabase backend. All 5 planned phases are built.

## What's working

**Shell & Auth** — Sidebar nav, Light/Dark/System theme, Supabase Auth login guard.

**Leads** — Full table (search, status/city/source filters, pagination),
slide-out detail drawer, priority (Hot/Warm/Cold), deal value (₹),
follow-up dates, lost-reason capture, one-click WhatsApp/Email with send
counts, bulk select/delete, CSV import (deduped by phone) + export.

**Follow-ups** — Same table, filtered to any lead with a follow-up date
set, sorted soonest first. Live overdue-count badge in the sidebar.

**Dashboard** — Stat cards (pipeline value, won value, contact/conversion
rate), breakdowns by status/priority/city/source, lost-reason chart,
recent activity feed.

**Templates** — Create/edit/delete message templates with a live preview,
feeding directly into every WhatsApp/Email send button.

**Settings** — Upload your own logo + set company name (updates the
sidebar and login page immediately), toggle which leads-table columns
you see (saved per device), account info.

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Run the SQL migrations** (in order, in Supabase's SQL Editor):
   - `schema.sql` — core tables (leads, activity_log, templates)
   - `migration_v2.sql` — priority, deal value, follow-up date, lost reason
   - `migration_v3.sql` — branding settings table + logo storage bucket

   Skip any you've already run in a previous session.

3. **Connect your Supabase project**

   ```bash
   cp .env.local.example .env.local
   ```

   Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

4. **Run it**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Deploying

Push to GitHub, import at vercel.com, add the same two environment
variables in Vercel's project settings, deploy.

## A note on what "complete" means here

Every screen described above is real and functional — not a mockup. That
said, I haven't been able to run `npm run dev` myself in this environment
(no live browser to test against), so everything has been verified by
static checks: every import resolves to a real export, every bracket is
balanced, every file using React hooks has "use client". A first real run
occasionally surfaces something only a live render catches — if that
happens, paste the error back and it gets fixed the same way the
next-themes issue did earlier.

## Beyond the original 5 phases

If you want to keep going, the natural next steps are things outside the
original roadmap: automated WhatsApp sending via the Business API (a
real backend integration, discussed earlier — Twilio/AiSensy), or
multi-tenancy if you decide to actually sell this to other agencies
rather than run it just for Blacklight.
