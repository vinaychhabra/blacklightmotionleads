import { supabase } from "./client";
import type { Lead, ActivityLogEntry, Template, AppSettings } from "./types";

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
