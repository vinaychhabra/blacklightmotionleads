import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://bmhsjutyqplvwlkuarbr.supabase.co",
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_5SkqsKU8jNnwKF22Wf1W5A_rA7Ufckm"
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const client = db();
  const { data } = await client.from("app_settings").select("whatsapp_verify_token").eq("id", 1).single();
  if (token && challenge && token === data?.whatsapp_verify_token) return new NextResponse(challenge);
  return NextResponse.json({ message: "Webhook verification failed" }, { status: 403 });
}

export async function POST(request: Request) {
  const body = await request.json();
  const client = db();
  const changes = body?.entry?.flatMap((entry: any) => entry.changes || []) || [];
  for (const change of changes) {
    const value = change.value || {};
    for (const status of value.statuses || []) {
      const fields = status.status === "delivered" ? { status: "delivered", delivered_at: new Date().toISOString() } :
        status.status === "read" ? { status: "read", read_at: new Date().toISOString() } :
        status.status === "failed" ? { status: "failed", failed_at: new Date().toISOString(), error_message: status.errors?.[0]?.title || "WhatsApp delivery failed" } : null;
      if (fields) await client.from("whatsapp_messages").update(fields).eq("message_id", status.id);
    }
    for (const message of value.messages || []) {
      const text = message.text?.body || message.button?.text || `[${message.type || "message"}]`;
      const { data: lead } = await client.from("leads").select("id").or(`phone.eq.${message.from},phone.eq.+${message.from}`).maybeSingle();
      await client.from("whatsapp_messages").insert({ lead_id: lead?.id || null, direction: "inbound", recipient_phone: message.from, message_id: message.id, body: text, status: "received", sent_at: new Date().toISOString() });
    }
  }
  return NextResponse.json({ received: true });
}
