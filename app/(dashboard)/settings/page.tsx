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
    { key: "showDealValue", label: "Deal value badge", description: "Show the ₹ expected value badge next to each lead." },
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

      {/* Branding */}
      {!needsMigration && (
      <section className="mb-8 rounded-xl border border-border bg-panel p-5">
        <h3 className="mb-4 font-display text-sm font-bold text-ink">Branding</h3>

        <div className="mb-5 flex items-center gap-4">
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
