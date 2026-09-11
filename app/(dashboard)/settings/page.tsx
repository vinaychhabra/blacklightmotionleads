"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { fetchSettings, updateSettings, uploadLogo } from "@/lib/supabase/queries";
import type { AppSettings } from "@/lib/supabase/types";
import { useColumnPrefs, type ColumnPrefs } from "@/lib/column-prefs";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/components/toast-provider";
import { Upload } from "lucide-react";

export default function SettingsPage() {
  const { showToast } = useToast();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [leadProvider, setLeadProvider] = useState("demo");
  const [googlePlacesApiKey, setGooglePlacesApiKey] = useState("");
  const [aiProvider, setAiProvider] = useState("none");
  const [aiApiKey, setAiApiKey] = useState("");
  const [emailProvider, setEmailProvider] = useState("system_mailto");
  const [emailFromName, setEmailFromName] = useState("Blacklight Motion");
  const [emailFromAddress, setEmailFromAddress] = useState("noreply@blacklightmotion.com");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUsername, setSmtpUsername] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [smtpSecure, setSmtpSecure] = useState(true);
  const [sendgridApiKey, setSendgridApiKey] = useState("");
  const [resendApiKey, setResendApiKey] = useState("");
  const [mailgunApiKey, setMailgunApiKey] = useState("");
  const [mailgunDomain, setMailgunDomain] = useState("");
  const [brevoApiKey, setBrevoApiKey] = useState("");
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [whatsappAccessToken, setWhatsappAccessToken] = useState("");
  const [whatsappPhoneNumberId, setWhatsappPhoneNumberId] = useState("");
  const [whatsappBusinessAccountId, setWhatsappBusinessAccountId] = useState("");
  const [whatsappVerifyToken, setWhatsappVerifyToken] = useState("");
  const [whatsappApiVersion, setWhatsappApiVersion] = useState("v21.0");
  const [googleMapsEnabled, setGoogleMapsEnabled] = useState(false);
  const [websiteEnrichmentEnabled, setWebsiteEnrichmentEnabled] = useState(false);
  const [emailEnrichmentEnabled, setEmailEnrichmentEnabled] = useState(false);
  const [aiQualificationEnabled, setAiQualificationEnabled] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [email, setEmail] = useState<string | undefined>();
  const [needsMigration, setNeedsMigration] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { prefs, updatePrefs } = useColumnPrefs();

  useEffect(() => {
    fetchSettings()
      .then((s) => {
        setSettings(s);
        setCompanyName(s.company_name);
        setLogoPreview(s.logo_url);
        setLeadProvider(s.lead_provider || "demo");
        setGooglePlacesApiKey(s.google_places_api_key || "");
        setAiProvider(s.ai_provider || "none");
        setAiApiKey(s.ai_api_key || s.openai_api_key || "");
        setEmailProvider(s.email_provider || "system_mailto");
        setEmailFromName(s.email_from_name || "Blacklight Motion");
        setEmailFromAddress(s.email_from_address || "noreply@blacklightmotion.com");
        setSmtpHost(s.smtp_host || "");
        setSmtpPort(String(s.smtp_port ?? 587));
        setSmtpUsername(s.smtp_username || "");
        setSmtpPassword(s.smtp_password || "");
        setSmtpSecure(Boolean(s.smtp_secure ?? true));
        setSendgridApiKey(s.sendgrid_api_key || "");
        setResendApiKey(s.resend_api_key || "");
        setMailgunApiKey(s.mailgun_api_key || "");
        setMailgunDomain(s.mailgun_domain || "");
        setBrevoApiKey(s.brevo_api_key || "");
        setWhatsappEnabled(Boolean(s.whatsapp_enabled));
        setWhatsappAccessToken(s.whatsapp_access_token || "");
        setWhatsappPhoneNumberId(s.whatsapp_phone_number_id || "");
        setWhatsappBusinessAccountId(s.whatsapp_business_account_id || "");
        setWhatsappVerifyToken(s.whatsapp_verify_token || "");
        setWhatsappApiVersion(s.whatsapp_api_version || "v21.0");
        setGoogleMapsEnabled(Boolean(s.google_maps_api_enabled));
        setWebsiteEnrichmentEnabled(Boolean(s.website_enrichment_enabled));
        setEmailEnrichmentEnabled(Boolean(s.email_enrichment_enabled));
        setAiQualificationEnabled(Boolean(s.ai_qualification_enabled));
      })
      .catch((err) => {
        const msg = err?.message || "";
        if (msg.includes("Could not find the table") || msg.includes("app_settings")) {
          setNeedsMigration(true);
        } else {
          showToast(msg || "Failed to load settings", "error");
        }
      });

    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user?.email));
  }, []);

  async function handleSaveCompanyName() {
    if (!settings) return;
    try {
      const updated = await updateSettings({ company_name: companyName });
      setSettings(updated);
      showToast("Company name updated", "success");
    } catch (err: any) {
      showToast(err.message || "Save failed", "error");
    }
  }

  async function handleSaveIntegrations() {
    if (!settings) return;
    try {
      if (emailProvider === "smtp") {
        const verification = await fetch("/api/email/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            settings: {
              smtp_host: smtpHost,
              smtp_port: Number(smtpPort) || 587,
              smtp_username: smtpUsername,
              smtp_password: smtpPassword,
              smtp_secure: smtpSecure,
            },
          }),
        });
        const result = await verification.json();
        if (!verification.ok || !result.ok) {
          throw new Error(`SMTP verification failed: ${result.message || "Check your host, port, username, and password."}`);
        }
      }

      const updated = await updateSettings({
        lead_provider: leadProvider,
        google_places_api_key: googlePlacesApiKey,
        ai_provider: aiProvider,
        ai_api_key: aiApiKey,
        openai_api_key: aiApiKey,
        email_provider: emailProvider,
        email_from_name: emailFromName,
        email_from_address: emailFromAddress,
        smtp_host: smtpHost,
        smtp_port: Number(smtpPort) || 587,
        smtp_username: smtpUsername,
        smtp_password: smtpPassword,
        smtp_secure: smtpSecure,
        sendgrid_api_key: sendgridApiKey,
        resend_api_key: resendApiKey,
        mailgun_api_key: mailgunApiKey,
        mailgun_domain: mailgunDomain,
        brevo_api_key: brevoApiKey,
        whatsapp_enabled: whatsappEnabled,
        whatsapp_access_token: whatsappAccessToken,
        whatsapp_phone_number_id: whatsappPhoneNumberId,
        whatsapp_business_account_id: whatsappBusinessAccountId,
        whatsapp_verify_token: whatsappVerifyToken,
        whatsapp_api_version: whatsappApiVersion,
        google_maps_api_enabled: googleMapsEnabled,
        website_enrichment_enabled: websiteEnrichmentEnabled,
        email_enrichment_enabled: emailEnrichmentEnabled,
        ai_qualification_enabled: aiQualificationEnabled,
      });
      setSettings(updated);
      showToast("Integration settings saved", "success");
    } catch (err: any) {
      showToast(err.message || "Could not save integration settings", "error");
    }
  }

  async function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const url = await uploadLogo(file);
      const updated = await updateSettings({ logo_url: url });
      setSettings(updated);
      setLogoPreview(url);
      showToast("Logo updated — refresh to see it everywhere", "success");
    } catch (err: any) {
      showToast(err.message || "Upload failed", "error");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  const columnToggles: { key: keyof ColumnPrefs; label: string; description: string }[] = [
    { key: "showEmail", label: "Email column", description: "Show each lead's email address in the table." },
    { key: "showFollowUp", label: "Follow-up badge", description: "Show due/overdue/upcoming badges in the leads table." },
    { key: "showSendCounts", label: "Sent column", description: "Show the WhatsApp/email send-count column." },
  ];

  return (
    <div className="max-w-2xl">
      <PageHeader title="Settings" subtitle="Branding, table columns, and account info." />

      {needsMigration && (
        <div className="mb-6 rounded-xl border border-amber/40 bg-amber/10 p-4">
          <p className="text-sm font-semibold text-ink">One-time setup needed for Branding</p>
          <p className="mt-1 text-xs text-ink-dim">
            The branding table hasn't been created in your Supabase project yet. Open your
            Supabase SQL Editor, run <code className="rounded bg-row px-1 py-0.5 font-mono">migration_v3.sql</code>,
            then refresh this page. Column customization and account info below work fine either way.
          </p>
        </div>
      )}

      {!needsMigration && (
      <section className="mb-6 soft-card rounded-xl p-4">
        <h3 className="mb-3 font-display text-sm font-bold text-ink">Branding</h3>

        <div className="mb-4 flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-row">
            {logoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoPreview} alt="Logo" className="h-full w-full object-cover" />
            ) : (
              <span className="text-[10px] text-ink-dim">No logo</span>
            )}
          </div>
          <div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-ink-dim hover:text-ink disabled:opacity-50"
            >
              <Upload size={13} /> {uploading ? "Uploading…" : "Upload logo"}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoSelect} />
            <p className="mt-1.5 text-[10.5px] text-ink-dim">PNG or JPG, square works best. Updates the sidebar and login page.</p>
          </div>
        </div>

        <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-ink-dim">
          Company name
        </label>
        <div className="flex gap-2">
          <input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="flex-1 rounded-lg border border-border bg-row px-3 py-2 text-sm text-ink outline-none focus:border-amber"
          />
          <button
            onClick={handleSaveCompanyName}
            className="rounded-lg bg-gradient-to-r from-amber to-cyan px-4 py-2 text-xs font-semibold text-black"
          >
            Save
          </button>
        </div>
      </section>
      )}

      <section className="mb-6 soft-card rounded-xl p-4">
        <h3 className="mb-3 font-display text-sm font-bold text-ink">AI & integrations</h3>
        <div className="space-y-4">
          <label className="block text-[10px] font-medium uppercase tracking-wide text-ink-dim">
            <span className="inline-flex items-center gap-1">
              Lead provider
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border text-[9px] text-ink-dim" title="This chooses the source of business data. Demo is a local mock; Google Places fetches live businesses from Maps when you provide a key.">?</span>
            </span>
            <select
              value={leadProvider}
              onChange={(e) => setLeadProvider(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-row px-3 py-2 text-sm text-ink outline-none focus:border-amber"
            >
              <option value="demo">Demo provider</option>
              <option value="google_places">Google Places</option>
            </select>
          </label>

          <label className="block text-[10px] font-medium uppercase tracking-wide text-ink-dim">
            <span className="inline-flex items-center gap-1">
              Google Places API key
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border text-[9px] text-ink-dim" title="Required only if you want the system to discover real businesses from Google Maps and Places. This lets the app pull live local business records.">?</span>
            </span>
            <input
              type="password"
              value={googlePlacesApiKey}
              onChange={(e) => setGooglePlacesApiKey(e.target.value)}
              placeholder="Enter your Google Places key"
              className="mt-1 w-full rounded-lg border border-border bg-row px-3 py-2 text-sm text-ink outline-none focus:border-amber"
            />
          </label>

          <label className="block text-[10px] font-medium uppercase tracking-wide text-ink-dim">
            <span className="inline-flex items-center gap-1">
              AI provider
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border text-[9px] text-ink-dim" title="This selects the AI model that powers lead scoring, summaries, and qualification. You can switch between providers depending on your cost and usage needs.">?</span>
            </span>
            <select
              value={aiProvider}
              onChange={(e) => setAiProvider(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-row px-3 py-2 text-sm text-ink outline-none focus:border-amber"
            >
              <option value="none">No AI provider</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic Claude</option>
              <option value="google_gemini">Google Gemini</option>
              <option value="azure_openai">Azure OpenAI</option>
              <option value="groq">Groq</option>
            </select>
          </label>

          <label className="block text-[10px] font-medium uppercase tracking-wide text-ink-dim">
            <span className="inline-flex items-center gap-1">
              AI API key
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border text-[9px] text-ink-dim" title="This is the secret key for the selected AI provider. It is used for AI scoring, summarization, and lead qualification. Keep this private and only use the provider you selected.">?</span>
            </span>
            <input
              type="password"
              value={aiApiKey}
              onChange={(e) => setAiApiKey(e.target.value)}
              placeholder="Enter your AI provider key"
              className="mt-1 w-full rounded-lg border border-border bg-row px-3 py-2 text-sm text-ink outline-none focus:border-amber"
            />
          </label>
        </div>
      </section>

      <section className="mb-6 soft-card rounded-xl p-4">
        <h3 className="mb-3 font-display text-sm font-bold text-ink">Email delivery</h3>
        <div className="space-y-4">
          <label className="block text-[10px] font-medium uppercase tracking-wide text-ink-dim">
            <span className="inline-flex items-center gap-1">
              Outbound email provider
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border text-[9px] text-ink-dim" title="Choose how the CRM sends outbound email. SMTP sends directly from your server, while the default option just opens the local email app. Use a real provider for automatic sending.">?</span>
            </span>
            <select
              value={emailProvider}
              onChange={(e) => setEmailProvider(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-row px-3 py-2 text-sm text-ink outline-none focus:border-amber"
            >
              <option value="system_mailto">System mail app (fallback)</option>
              <option value="smtp">SMTP</option>
              <option value="sendgrid">SendGrid</option>
              <option value="resend">Resend</option>
              <option value="mailgun">Mailgun</option>
              <option value="brevo">Brevo</option>
            </select>
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-[10px] font-medium uppercase tracking-wide text-ink-dim">
              From name
              <input
                value={emailFromName}
                onChange={(e) => setEmailFromName(e.target.value)}
                placeholder="Blacklight Motion"
                className="mt-1 w-full rounded-lg border border-border bg-row px-3 py-2 text-sm text-ink outline-none focus:border-amber"
              />
            </label>
            <label className="block text-[10px] font-medium uppercase tracking-wide text-ink-dim">
              From email
              <input
                value={emailFromAddress}
                onChange={(e) => setEmailFromAddress(e.target.value)}
                placeholder="noreply@yourdomain.com"
                className="mt-1 w-full rounded-lg border border-border bg-row px-3 py-2 text-sm text-ink outline-none focus:border-amber"
              />
            </label>
          </div>

          {(emailProvider === "smtp" || emailProvider === "system_mailto") && (
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block text-[10px] font-medium uppercase tracking-wide text-ink-dim">
                SMTP host
                <input
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  placeholder="smtp.yourprovider.com"
                  className="mt-1 w-full rounded-lg border border-border bg-row px-3 py-2 text-sm text-ink outline-none focus:border-amber"
                />
              </label>
              <label className="block text-[10px] font-medium uppercase tracking-wide text-ink-dim">
                SMTP port
                <input
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(e.target.value)}
                  placeholder="587"
                  className="mt-1 w-full rounded-lg border border-border bg-row px-3 py-2 text-sm text-ink outline-none focus:border-amber"
                />
              </label>
              <label className="block text-[10px] font-medium uppercase tracking-wide text-ink-dim">
                SMTP username
                <input
                  value={smtpUsername}
                  onChange={(e) => setSmtpUsername(e.target.value)}
                  placeholder="SMTP username"
                  className="mt-1 w-full rounded-lg border border-border bg-row px-3 py-2 text-sm text-ink outline-none focus:border-amber"
                />
              </label>
              <label className="block text-[10px] font-medium uppercase tracking-wide text-ink-dim">
                SMTP password
                <input
                  type="password"
                  value={smtpPassword}
                  onChange={(e) => setSmtpPassword(e.target.value)}
                  placeholder="SMTP password"
                  className="mt-1 w-full rounded-lg border border-border bg-row px-3 py-2 text-sm text-ink outline-none focus:border-amber"
                />
              </label>
            </div>
          )}

          {emailProvider === "smtp" && (
            <label className="flex items-center justify-between rounded-lg border border-border bg-row px-3 py-2 text-sm text-ink">
              <span className="inline-flex items-center gap-1">
                Use TLS / SSL
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border text-[9px] text-ink-dim" title="Enable this for most modern SMTP providers like Gmail, SendGrid, Mailgun, and Microsoft 365 SMTP.">?</span>
              </span>
              <input
                type="checkbox"
                checked={smtpSecure}
                onChange={(e) => setSmtpSecure(e.target.checked)}
                className="h-4 w-4"
              />
            </label>
          )}

          {emailProvider === "sendgrid" && (
            <label className="block text-[10px] font-medium uppercase tracking-wide text-ink-dim">
              SendGrid API key
              <input
                type="password"
                value={sendgridApiKey}
                onChange={(e) => setSendgridApiKey(e.target.value)}
                placeholder="SG.xxx..."
                className="mt-1 w-full rounded-lg border border-border bg-row px-3 py-2 text-sm text-ink outline-none focus:border-amber"
              />
            </label>
          )}

          {emailProvider === "resend" && (
            <label className="block text-[10px] font-medium uppercase tracking-wide text-ink-dim">
              Resend API key
              <input
                type="password"
                value={resendApiKey}
                onChange={(e) => setResendApiKey(e.target.value)}
                placeholder="re_xxx..."
                className="mt-1 w-full rounded-lg border border-border bg-row px-3 py-2 text-sm text-ink outline-none focus:border-amber"
              />
            </label>
          )}

          {emailProvider === "mailgun" && (
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block text-[10px] font-medium uppercase tracking-wide text-ink-dim">
                Mailgun API key
                <input
                  type="password"
                  value={mailgunApiKey}
                  onChange={(e) => setMailgunApiKey(e.target.value)}
                  placeholder="key-xxx"
                  className="mt-1 w-full rounded-lg border border-border bg-row px-3 py-2 text-sm text-ink outline-none focus:border-amber"
                />
              </label>
              <label className="block text-[10px] font-medium uppercase tracking-wide text-ink-dim">
                Mailgun domain
                <input
                  value={mailgunDomain}
                  onChange={(e) => setMailgunDomain(e.target.value)}
                  placeholder="mg.yourdomain.com"
                  className="mt-1 w-full rounded-lg border border-border bg-row px-3 py-2 text-sm text-ink outline-none focus:border-amber"
                />
              </label>
            </div>
          )}

          {emailProvider === "brevo" && (
            <label className="block text-[10px] font-medium uppercase tracking-wide text-ink-dim">
              Brevo API key
              <input
                type="password"
                value={brevoApiKey}
                onChange={(e) => setBrevoApiKey(e.target.value)}
                placeholder="xkeysib-..."
                className="mt-1 w-full rounded-lg border border-border bg-row px-3 py-2 text-sm text-ink outline-none focus:border-amber"
              />
            </label>
          )}

          <div className="space-y-3 rounded-xl border border-border bg-row/40 p-4">
            <label className="flex items-center justify-between text-sm font-semibold text-ink">
              <span className="inline-flex items-center gap-1.5">
                Meta WhatsApp Cloud API
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border text-[9px] text-ink-dim" title="Sends messages through Meta's official WhatsApp Cloud API and receives delivery, read, and inbound reply webhooks.">?</span>
              </span>
              <input type="checkbox" checked={whatsappEnabled} onChange={(e) => setWhatsappEnabled(e.target.checked)} className="accent-amber" />
            </label>
            <p className="text-xs text-ink-dim">Use this for official direct sending. Meta approval is required, and approved message templates are required outside the 24-hour customer-service window.</p>
            <div className="grid gap-3 md:grid-cols-2">
              <SettingInput label="Phone Number ID" tooltip="The ID of the WhatsApp Business phone number that sends messages. Find it in Meta WhatsApp Manager." value={whatsappPhoneNumberId} onChange={setWhatsappPhoneNumberId} placeholder="Example: 123456789012345" />
              <SettingInput label="Business Account ID" tooltip="Your WhatsApp Business Account ID used by Meta for the business asset." value={whatsappBusinessAccountId} onChange={setWhatsappBusinessAccountId} placeholder="Example: 987654321098765" />
              <SettingInput label="Graph API version" tooltip="Meta Graph API version used by the send endpoint. Keep the current supported version unless Meta instructs otherwise." value={whatsappApiVersion} onChange={setWhatsappApiVersion} placeholder="Example: v21.0" />
              <SettingInput label="Webhook verify token" tooltip="A private string you choose. It must match the token entered when configuring the Meta webhook." value={whatsappVerifyToken} onChange={setWhatsappVerifyToken} placeholder="Create a strong random value" />
            </div>
            <SettingInput label="Permanent access token" tooltip="A Meta system-user token with WhatsApp messaging permissions. Keep it secret and never share it in the browser." value={whatsappAccessToken} onChange={setWhatsappAccessToken} placeholder="Paste your Meta access token" password />
            <div className="rounded-lg border border-cyan/20 bg-cyan/5 p-3 text-[11px] text-ink-dim">
              <strong className="text-ink">Webhook URL:</strong> <code>/api/whatsapp/webhook</code>. Add this public HTTPS URL in Meta, use the verify token above, and subscribe to <code>messages</code> for delivered/read statuses and replies.
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {[
              { key: "googleMapsEnabled", label: "Google Maps enabled", value: googleMapsEnabled, setter: setGoogleMapsEnabled, tooltip: "Enables location-based enrichment and map lookups for businesses." },
              { key: "websiteEnrichmentEnabled", label: "Website enrichment", value: websiteEnrichmentEnabled, setter: setWebsiteEnrichmentEnabled, tooltip: "Pulls website metadata, contact pages, and niche context for each lead." },
              { key: "emailEnrichmentEnabled", label: "Email enrichment", value: emailEnrichmentEnabled, setter: setEmailEnrichmentEnabled, tooltip: "Tries to discover valid business emails and contact signals from public information." },
              { key: "aiQualificationEnabled", label: "AI qualification", value: aiQualificationEnabled, setter: setAiQualificationEnabled, tooltip: "Lets the AI rank and qualify leads automatically based on your business rules." },
            ].map(({ key, label, value, setter, tooltip }) => (
              <label key={key} className="flex items-center justify-between rounded-lg border border-border bg-row px-3 py-2 text-sm text-ink">
                <span className="inline-flex items-center gap-1">
                  {label}
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border text-[9px] text-ink-dim" title={tooltip}>?</span>
                </span>
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(e) => setter(e.target.checked)}
                  className="h-4 w-4"
                />
              </label>
            ))}
          </div>

          <button
            onClick={handleSaveIntegrations}
            className="rounded-lg bg-gradient-to-r from-amber to-cyan px-4 py-2 text-xs font-semibold text-black"
          >
            Save settings
          </button>
        </div>
      </section>

      {/* Column customization */}
      <section className="mb-8 rounded-xl border border-border bg-panel p-5">
        <h3 className="mb-1 font-display text-sm font-bold text-ink">Leads table columns</h3>
        <p className="mb-4 text-xs text-ink-dim">Saved on this device only — customize what you see without affecting anyone else.</p>

        <div className="space-y-3">
          {columnToggles.map(({ key, label, description }) => (
            <div key={key} className="flex items-center justify-between">
              <div>
                <div className="text-sm text-ink">{label}</div>
                <div className="text-[10.5px] text-ink-dim">{description}</div>
              </div>
              <button
                onClick={() => updatePrefs({ [key]: !prefs[key] } as Partial<ColumnPrefs>)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                  prefs[key] ? "bg-gradient-to-r from-amber to-cyan" : "bg-row border border-border"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                    prefs[key] ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Account */}
      <section className="rounded-xl border border-border bg-panel p-5">
        <h3 className="mb-3 font-display text-sm font-bold text-ink">Account</h3>
        <div className="text-xs text-ink-dim">
          Signed in as <span className="font-medium text-ink">{email || "—"}</span>
        </div>
        <p className="mt-2 text-[10.5px] text-ink-dim">
          To change your password, do it directly in Supabase → Authentication → Users.
        </p>
      </section>
    </div>
  );
}

function SettingInput({ label, tooltip, value, onChange, placeholder, password = false }: { label: string; tooltip: string; value: string; onChange: (value: string) => void; placeholder: string; password?: boolean }) {
  return (
    <label className="block text-[10px] font-medium uppercase tracking-wide text-ink-dim">
      <span className="inline-flex items-center gap-1">
        {label}
        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border text-[9px] normal-case" title={tooltip}>?</span>
      </span>
      <input type={password ? "password" : "text"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-1 w-full rounded-lg border border-border bg-row px-3 py-2 text-sm normal-case text-ink outline-none focus:border-amber" />
    </label>
  );
}
