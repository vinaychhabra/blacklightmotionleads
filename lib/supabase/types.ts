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
  city: string | null;
  phone: string | null;
  email: string | null;
  source: string | null;
  status: LeadStatus;
  notes: string | null;
  priority: Priority;
  deal_value: number | null;
  follow_up_date: string | null; // ISO date, e.g. "2026-09-01"
  lost_reason: string | null;
  created_at: string;
  last_contacted_at: string | null;
}

export interface ActivityLogEntry {
  id: string;
  lead_id: string;
  action: string;
  detail: string;
  created_at: string;
}

export interface Template {
  id: string;
  label: string;
  subject: string;
  body: string;
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

export interface AppSettings {
  id: number;
  company_name: string;
  logo_url: string | null;
  updated_at: string;
}
