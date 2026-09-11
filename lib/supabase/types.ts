export type LeadStatus =
  | "New"
  | "Contacted"
  | "Follow-up"
  | "No Response"
  | "Interested"
  | "Client Denied"
  | "Converted";

export type Priority = "Hot" | "Warm" | "Cold";

export interface Lead {
  id: string;
  name: string;
  company_name?: string | null;
  business_category?: string | null;
  description?: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  website?: string | null;
  address?: string | null;
  state?: string | null;
  country?: string | null;
  postal_code?: string | null;
  source: string | null;
  source_url?: string | null;
  external_place_id?: string | null;
  rating?: number | null;
  review_count?: number | null;
  facebook_url?: string | null;
  instagram_url?: string | null;
  linkedin_url?: string | null;
  youtube_url?: string | null;
  contact_page_url?: string | null;
  lead_score?: number | null;
  lead_temperature?: "HOT" | "WARM" | "COLD" | null;
  status: LeadStatus;
  notes: string | null;
  priority: Priority;
  follow_up_date: string | null; // ISO date, e.g. "2026-09-01"
  lost_reason: string | null;
  created_at: string;
  updated_at?: string | null;
  last_contacted_at: string | null;
}

export interface ActivityLogEntry {
  id: string;
  lead_id: string;
  action: string;
  detail: string;
  created_at: string;
}

export interface EmailTracking {
  id: string;
  token: string;
  lead_id: string;
  activity_id: string | null;
  template_label: string | null;
  sent_at: string;
  opened_at: string | null;
  last_opened_at: string | null;
  open_count: number;
}

export interface Template {
  id: string;
  label: string;
  channel?: "whatsapp" | "email" | "both" | string | null;
  subject: string;
  body: string;
  image_url?: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
}

export const STATUSES: LeadStatus[] = [
  "New",
  "Contacted",
  "Follow-up",
  "No Response",
  "Interested",
  "Client Denied",
  "Converted",
];

export const PRIORITIES: Priority[] = ["Hot", "Warm", "Cold"];

export type EmailProvider = "system_mailto" | "smtp" | "sendgrid" | "resend" | "mailgun" | "brevo" | "none";

export interface AppSettings {
  id: number;
  company_name: string;
  logo_url: string | null;
  lead_provider?: "demo" | "google_places" | string | null;
  google_places_api_key?: string | null;
  ai_provider?: "none" | "openai" | "anthropic" | "google_gemini" | "azure_openai" | "groq" | string | null;
  ai_api_key?: string | null;
  openai_api_key?: string | null;
  google_maps_api_enabled?: boolean | null;
  website_enrichment_enabled?: boolean | null;
  email_enrichment_enabled?: boolean | null;
  ai_qualification_enabled?: boolean | null;
  email_provider?: EmailProvider | string | null;
  email_from_name?: string | null;
  email_from_address?: string | null;
  smtp_host?: string | null;
  smtp_port?: number | string | null;
  smtp_username?: string | null;
  smtp_password?: string | null;
  smtp_secure?: boolean | null;
  sendgrid_api_key?: string | null;
  resend_api_key?: string | null;
  mailgun_api_key?: string | null;
  mailgun_domain?: string | null;
  brevo_api_key?: string | null;
  updated_at: string;
}
