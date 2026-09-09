import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

async function getSavedSettings() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) return null;

  const client = createClient(supabaseUrl, supabaseAnonKey);
  const { data } = await client.from("app_settings").select("smtp_host, smtp_port, smtp_username, smtp_password, smtp_secure").eq("id", 1).maybeSingle();
  return data;
}

function isTruthy(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const supplied = body?.settings;
    const settings = supplied || await getSavedSettings();

    if (!settings) {
      return NextResponse.json({ ok: false, message: "Could not load SMTP settings." }, { status: 400 });
    }

    const host = String(settings.smtp_host || "").trim();
    const username = String(settings.smtp_username || "").trim();
    const password = String(settings.smtp_password || "").trim();
    const port = Number(settings.smtp_port ?? 587);

    if (!host || !username || !password) {
      return NextResponse.json({
        ok: false,
        message: "SMTP host, username, and password are required.",
      }, { status: 400 });
    }

    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return NextResponse.json({ ok: false, message: "SMTP port must be a valid number between 1 and 65535." }, { status: 400 });
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      requireTLS: isTruthy(settings.smtp_secure) && port !== 465,
      auth: { user: username, pass: password },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });

    await transporter.verify();
    transporter.close();

    return NextResponse.json({ ok: true, message: "SMTP connection verified." });
  } catch (error: any) {
    const rawMessage = String(error?.message || "SMTP verification failed.");
    const message = /535|badcredentials|username and password not accepted/i.test(rawMessage)
      ? "Gmail rejected the login. Use your full Gmail address and a Google App Password, not your normal Gmail password. App Passwords require 2-Step Verification."
      : rawMessage.replace(/\b(?:password|pass|pwd)\s*[:=]\s*\S+/gi, "$1: [hidden]");
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }
}
