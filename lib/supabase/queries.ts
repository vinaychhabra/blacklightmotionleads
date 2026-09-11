import { supabase } from "./client";
import type { Lead, ActivityLogEntry, EmailTracking, Template, AppSettings } from "./types";

export interface ScrapedLeadRecord {
  id?: string;
  campaign_id?: string | null;
  company_name?: string | null;
  business_category?: string | null;
  description?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postal_code?: string | null;
  source?: string | null;
  source_url?: string | null;
  external_place_id?: string | null;
  rating?: number | null;
  review_count?: number | null;
  facebook_url?: string | null;
  instagram_url?: string | null;
  linkedin_url?: string | null;
  youtube_url?: string | null;
  lead_score?: number | null;
  lead_temperature?: "HOT" | "WARM" | "COLD" | null;
  ai_relevance?: boolean | null;
  ai_reason?: string | null;
  enrichment_status?: string | null;
  review_status?: string | null;
  notes?: string | null;
  tags?: string[] | null;
  created_at?: string;
  updated_at?: string;
}

export interface LeadGenerationCampaignRecord {
  id?: string;
  name?: string;
  category?: string | null;
  location?: string | null;
  keywords?: string[] | null;
  requested_leads?: number | null;
  queries_generated?: number | null;
  businesses_discovered?: number | null;
  duplicates_removed?: number | null;
  unique_leads?: number | null;
  websites_enriched?: number | null;
  emails_found?: number | null;
  hot_count?: number | null;
  warm_count?: number | null;
  cold_count?: number | null;
  status?: string | null;
  created_at?: string | null;
}

export async function fetchLeads(): Promise<Lead[]> {
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Lead[];
}

export async function fetchActivity(): Promise<ActivityLogEntry[]> {
  const { data, error } = await supabase
    .from("activity_log")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ActivityLogEntry[];
}

export async function fetchTemplates(): Promise<Template[]> {
  const { data, error } = await supabase.from("templates").select("*");
  if (error) throw error;
  return (data ?? []) as Template[];
}

export async function updateLead(id: string, fields: Partial<Lead>): Promise<Lead> {
  const { data, error } = await supabase
    .from("leads")
    .update(fields)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Lead;
}

export async function insertLead(fields: Partial<Lead>): Promise<Lead> {
  const { data, error } = await supabase.from("leads").insert(fields).select().single();
  if (error) throw error;
  return data as Lead;
}

export async function insertLeadsBulk(rows: Partial<Lead>[]): Promise<Lead[]> {
  const { data, error } = await supabase.from("leads").insert(rows).select();
  if (error) throw error;
  return (data ?? []) as Lead[];
}

export async function deleteLead(id: string): Promise<void> {
  const { error } = await supabase.from("leads").delete().eq("id", id);
  if (error) throw error;
}

export async function bulkDeleteLeads(ids: string[]): Promise<void> {
  const { error } = await supabase.from("leads").delete().in("id", ids);
  if (error) throw error;
}

export async function logActivity(
  leadId: string,
  action: string,
  detail: string = ""
): Promise<ActivityLogEntry> {
  const { data, error } = await supabase
    .from("activity_log")
    .insert({ lead_id: leadId, action, detail })
    .select()
    .single();
  if (error) throw error;
  return data as ActivityLogEntry;
}

export async function insertEmailTracking(fields: {
  token: string;
  lead_id: string;
  activity_id?: string | null;
  template_label?: string | null;
}): Promise<EmailTracking> {
  const { data, error } = await supabase.from("email_tracking").insert(fields).select().single();
  if (error) throw error;
  return data as EmailTracking;
}

export async function fetchEmailTracking(): Promise<EmailTracking[]> {
  const { data, error } = await supabase.from("email_tracking").select("*").order("sent_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as EmailTracking[];
}

export async function insertTemplate(fields: Partial<Template>): Promise<Template> {
  const { data, error } = await supabase.from("templates").insert(fields).select().single();
  if (error) throw error;
  return data as Template;
}

export async function updateTemplate(id: string, fields: Partial<Template>): Promise<Template> {
  const { data, error } = await supabase
    .from("templates")
    .update(fields)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Template;
}

export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supabase.from("templates").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchScrapedLeads(): Promise<ScrapedLeadRecord[]> {
  const { data, error } = await supabase
    .from("scraped_leads")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ScrapedLeadRecord[];
}

export async function upsertScrapedLead(row: ScrapedLeadRecord): Promise<ScrapedLeadRecord> {
  const { data, error } = await supabase.from("scraped_leads").upsert(row, { onConflict: "external_place_id" }).select().single();
  if (error) throw error;
  return data as ScrapedLeadRecord;
}

export async function updateScrapedLead(id: string, fields: Partial<ScrapedLeadRecord>): Promise<ScrapedLeadRecord> {
  const { data, error } = await supabase
    .from("scraped_leads")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as ScrapedLeadRecord;
}

export async function fetchLeadGenerationCampaigns(): Promise<LeadGenerationCampaignRecord[]> {
  const { data, error } = await supabase
    .from("lead_generation_campaigns")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as LeadGenerationCampaignRecord[];
}

export async function insertLeadGenerationCampaign(row: LeadGenerationCampaignRecord): Promise<LeadGenerationCampaignRecord> {
  const { data, error } = await supabase.from("lead_generation_campaigns").insert(row).select().single();
  if (error) throw error;
  return data as LeadGenerationCampaignRecord;
}

export async function fetchSettings(): Promise<AppSettings> {
  const { data, error } = await supabase.from("app_settings").select("*").eq("id", 1).single();
  if (error) throw error;
  return data as AppSettings;
}

export async function updateSettings(fields: Partial<AppSettings>): Promise<AppSettings> {
  const { data, error } = await supabase
    .from("app_settings")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", 1)
    .select()
    .single();
  if (error) throw error;
  return data as AppSettings;
}

export async function uploadLogo(file: File): Promise<string> {
  const ext = file.name.split(".").pop();
  const path = `logo-${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage.from("branding").upload(path, file, {
    upsert: true,
  });
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from("branding").getPublicUrl(path);
  return data.publicUrl;
}
