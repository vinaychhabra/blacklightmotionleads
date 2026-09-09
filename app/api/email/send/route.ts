import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

async function getEmailSettings() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Server Supabase environment variables are missing. Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  const client = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await client.from("app_settings").select("*").eq("id", 1).maybeSingle();

  if (error || !data) {
    throw new Error(error?.message || "Could not load saved email settings from Supabase.");
  }

  return data;
}

function isTruthy(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

async function sendWithSmtp(settings: Record<string, any>, to: string, subject: string, text: string) {
  const host = String(settings.smtp_host || "").trim();
  const username = String(settings.smtp_username || "").trim();
  const password = String(settings.smtp_password || "").trim();
  const port = Number(settings.smtp_port ?? 587);
  const fromAddress = String(settings.email_from_address || settings.smtp_username || username || "noreply@blacklightmotion.com").trim();
  const fromName = String(settings.email_from_name || "Blacklight Motion").trim();

  if (!host || !username || !password) {
    const message = "SMTP is selected but host, username, or password is missing. Add SMTP credentials in Settings to send emails automatically.";
    return { ok: false, fallback: false, code: "MISSING_SMTP_CREDENTIALS", message };
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: isTruthy(settings.smtp_secure ?? true) && port !== 465,
    auth: {
      user: username,
      pass: password,
    },
  });

  await transporter.sendMail({
    from: `${fromName} <${fromAddress}>`,
    to,
    subject,
    text,
  });

  return { ok: true, provider: "smtp" };
}

async function sendWithSendgrid(settings: Record<string, any>, to: string, subject: string, text: string) {
  const apiKey = String(settings.sendgrid_api_key || "").trim();
  const fromAddress = String(settings.email_from_address || "noreply@blacklightmotion.com").trim();
  const fromName = String(settings.email_from_name || "Blacklight Motion").trim();

  if (!apiKey) {
    return { ok: false, fallback: false, code: "MISSING_API_KEY", message: "SendGrid is selected but no API key was found in Settings." };
  }

  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: fromAddress, name: fromName },
      subject,
      content: [{ type: "text/plain", value: text }],
    }),
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(bodyText || "SendGrid failed to send the email");
  }

  return { ok: true, provider: "sendgrid" };
}

async function sendWithResend(settings: Record<string, any>, to: string, subject: string, text: string) {
  const apiKey = String(settings.resend_api_key || "").trim();
  const fromAddress = String(settings.email_from_address || "noreply@blacklightmotion.com").trim();
  const fromName = String(settings.email_from_name || "Blacklight Motion").trim();

  if (!apiKey) {
    return { ok: false, fallback: false, code: "MISSING_API_KEY", message: "Resend is selected but no API key was found in Settings." };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${fromName} <${fromAddress}>`,
      to: [to],
      subject,
      text,
    }),
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(bodyText || "Resend failed to send the email");
  }

  return { ok: true, provider: "resend" };
}

async function sendWithMailgun(settings: Record<string, any>, to: string, subject: string, text: string) {
  const apiKey = String(settings.mailgun_api_key || "").trim();
  const domain = String(settings.mailgun_domain || "").trim();
  const fromAddress = String(settings.email_from_address || "noreply@blacklightmotion.com").trim();
  const fromName = String(settings.email_from_name || "Blacklight Motion").trim();

  if (!apiKey || !domain) {
    return { ok: false, fallback: false, code: "MISSING_API_KEY", message: "Mailgun is selected but the API key or domain is missing. Add both in Settings." };
  }

  const credentials = Buffer.from(`api:${apiKey}`).toString("base64");
  const params = new URLSearchParams({
    from: `${fromName} <${fromAddress}>`,
    to,
    subject,
    text,
  });

  const response = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(bodyText || "Mailgun failed to send the email");
  }

  return { ok: true, provider: "mailgun" };
}

async function sendWithBrevo(settings: Record<string, any>, to: string, subject: string, text: string) {
  const apiKey = String(settings.brevo_api_key || "").trim();
  const fromAddress = String(settings.email_from_address || "noreply@blacklightmotion.com").trim();
  const fromName = String(settings.email_from_name || "Blacklight Motion").trim();

  if (!apiKey) {
    return { ok: false, fallback: false, code: "MISSING_API_KEY", message: "Brevo is selected but no API key was found in Settings." };
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      sender: { name: fromName, email: fromAddress },
      to: [{ email: to }],
      subject,
      textContent: text,
    }),
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(bodyText || "Brevo failed to send the email");
  }

  return { ok: true, provider: "brevo" };
}

export async function POST(request: Request) {
  let configuredProvider = "server_error";
  try {
    const body = (await request.json()) as {
      to?: string;
      subject?: string;
      text?: string;
      fromName?: string;
      fromEmail?: string;
    };

    const to = String(body.to || "").trim();
    const subject = String(body.subject || "New message").trim();
    const text = String(body.text || "").trim();

    if (!to) {
      return NextResponse.json({ success: false, code: "INVALID_EMAIL", message: "No recipient email was provided." }, { status: 400 });
    }

    const settings = await getEmailSettings();
    const providerName = String(settings.email_provider || "system_mailto").toLowerCase();
    configuredProvider = providerName;

    if (!providerName || providerName === "none" || providerName === "system_mailto") {
      return NextResponse.json({
        success: false,
        fallback: true,
        mode: "mailto",
        code: "CONFIG_REQUIRED",
        message: "No live email provider is configured. The CRM opened your default email app instead.",
      }, { status: 400 });
    }

    let result;

    switch (providerName) {
      case "smtp":
        result = await sendWithSmtp(settings, to, subject, text);
        break;
      case "sendgrid":
        result = await sendWithSendgrid(settings, to, subject, text);
        break;
      case "resend":
        result = await sendWithResend(settings, to, subject, text);
        break;
      case "mailgun":
        result = await sendWithMailgun(settings, to, subject, text);
        break;
      case "brevo":
        result = await sendWithBrevo(settings, to, subject, text);
        break;
      default:
        return NextResponse.json({
          success: false,
          fallback: false,
          mode: "direct",
          code: "UNSUPPORTED_PROVIDER",
          message: `Unsupported email provider: ${providerName}. Choose SMTP or a supported provider in Settings.`,
        }, { status: 400 });
    }

    if (!result?.ok) {
      return NextResponse.json({ success: false, ...result }, { status: 400 });
    }

    return NextResponse.json({ success: true, provider: result.provider, mode: "direct" });
  } catch (error: any) {
    const message = error?.message || "Email failed to send.";
    const canUseMailApp = configuredProvider === "system_mailto" || configuredProvider === "none";
    return NextResponse.json({
      success: false,
      fallback: canUseMailApp,
      mode: canUseMailApp ? "mailto" : "direct",
      message,
    }, { status: 500 });
  }
}
