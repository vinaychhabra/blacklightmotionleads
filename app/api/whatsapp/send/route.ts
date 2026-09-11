import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

async function settings() {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://bmhsjutyqplvwlkuarbr.supabase.co",
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_5SkqsKU8jNnwKF22Wf1W5A_rA7Ufckm"
  );
  const { data, error } = await client.from("app_settings").select("whatsapp_enabled,whatsapp_access_token,whatsapp_phone_number_id,whatsapp_api_version").eq("id", 1).single();
  if (error || !data) throw new Error(error?.message || "WhatsApp settings are unavailable");
  return data;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      to?: string; text?: string; templateName?: string; languageCode?: string; parameters?: string[]; leadId?: string; templateLabel?: string;
    };
    const to = String(body.to || "").replace(/\D/g, "");
    if (!to) return NextResponse.json({ message: "A recipient phone number is required." }, { status: 400 });
    const config = await settings();
    if (!config.whatsapp_enabled || !config.whatsapp_access_token || !config.whatsapp_phone_number_id) {
      return NextResponse.json({ message: "Configure and enable WhatsApp Cloud API in Settings." }, { status: 400 });
    }
    const apiVersion = config.whatsapp_api_version || "v21.0";
    const payload = body.templateName
      ? { messaging_product: "whatsapp", to, type: "template", template: { name: body.templateName, language: { code: body.languageCode || "en_US" }, ...(body.parameters?.length ? { components: [{ type: "body", parameters: body.parameters.map((text) => ({ type: "text", text })) }] } : {}) } }
      : { messaging_product: "whatsapp", to, type: "text", text: { preview_url: true, body: String(body.text || "") } };
    const response = await fetch(`https://graph.facebook.com/${apiVersion}/${config.whatsapp_phone_number_id}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.whatsapp_access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) return NextResponse.json({ message: result?.error?.message || "WhatsApp send failed", code: result?.error?.code }, { status: response.status });
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "https://bmhsjutyqplvwlkuarbr.supabase.co",
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_5SkqsKU8jNnwKF22Wf1W5A_rA7Ufckm"
    );
    await client.from("whatsapp_messages").insert({
      lead_id: body.leadId || null,
      recipient_phone: to,
      message_id: result?.messages?.[0]?.id || null,
      template_label: body.templateLabel || body.templateName || null,
      body: body.text || null,
      status: "sent",
      sent_at: new Date().toISOString(),
    });
    return NextResponse.json({ success: true, messageId: result?.messages?.[0]?.id || null });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "WhatsApp send failed" }, { status: 500 });
  }
}
