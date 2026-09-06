"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bell, CheckCircle2, Clock3, Mail, Sparkles, Users, X } from "lucide-react";
import { fetchSettings } from "@/lib/supabase/queries";
import { supabase } from "@/lib/supabase/client";

type Tone = "warning" | "danger" | "success" | "info";

interface NotificationItem {
  title: string;
  detail: string;
  tone: Tone;
}

export function NotificationPanel() {
  const [dueCount, setDueCount] = useState(0);
  const [newLeadsToday, setNewLeadsToday] = useState(0);
  const [missingContacts, setMissingContacts] = useState(0);
  const [settings, setSettings] = useState<any>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const { data: leads, error } = await supabase
          .from("leads")
          .select("id, follow_up_date, status, created_at, email, phone");

        if (!error && leads) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const due = leads.filter((lead) => {
            const followUp = lead.follow_up_date ? new Date(lead.follow_up_date) : null;
            return !!followUp && followUp <= new Date() || (!lead.follow_up_date && lead.status === "Follow-up");
          }).length;

          const newToday = leads.filter((lead) => {
            const created = lead.created_at ? new Date(lead.created_at) : null;
            return !!created && created.getTime() >= today.getTime();
          }).length;

          const missing = leads.filter((lead) => !(lead.email || lead.phone)).length;

          setDueCount(due);
          setNewLeadsToday(newToday);
          setMissingContacts(missing);
        }
      } catch {
        // ignore and keep panel resilient
      }

      try {
        const result = await fetchSettings();
        setSettings(result);
      } catch {
        setSettings(null);
      }
    }

    loadData();
  }, []);

  const items = useMemo<NotificationItem[]>(() => {
    const list: NotificationItem[] = [];

    if (dueCount > 0) {
      list.push({
        title: `${dueCount} follow-up${dueCount > 1 ? "s" : ""} due`,
        detail: "Review overdue conversations before they go cold.",
        tone: "warning",
      });
    }

    if (newLeadsToday > 0) {
      list.push({
        title: `${newLeadsToday} new lead${newLeadsToday > 1 ? "s" : ""} today`,
        detail: "Fresh prospects are waiting for outreach.",
        tone: "info",
      });
    }

    if (missingContacts > 0) {
      list.push({
        title: `${missingContacts} lead${missingContacts > 1 ? "s" : ""} missing contact details`,
        detail: "Add email or phone to improve qualification speed.",
        tone: "danger",
      });
    }

    if (!settings) {
      list.push({
        title: "Settings not ready",
        detail: "Run the latest migration in Supabase to activate the CRM config.",
        tone: "danger",
      });
    } else {
      if (!settings.ai_provider || settings.ai_provider === "none") {
        list.push({
          title: "AI integration pending",
          detail: "Connect OpenAI or another model for scoring and summaries.",
          tone: "danger",
        });
      }

      if (settings.lead_provider === "google_places" && !settings.google_places_api_key) {
        list.push({
          title: "Google Places key missing",
          detail: "Add your Maps API key to enable live lead discovery.",
          tone: "warning",
        });
      }

      if (!settings.email_provider || settings.email_provider === "system_mailto" || settings.email_provider === "none") {
        list.push({
          title: "Email transport not configured",
          detail: "Add SMTP or a provider to send outreach automatically.",
          tone: "warning",
        });
      }
    }

    if (!list.length) {
      list.push({
        title: "Everything looks healthy",
        detail: "No blockers are active right now.",
        tone: "success",
      });
    }

    return list.slice(0, 4);
  }, [dueCount, newLeadsToday, missingContacts, settings]);

  const toneClasses: Record<Tone, string> = {
    warning: "border-amber/30 bg-amber/5 text-amber-700 dark:text-amber-300",
    danger: "border-red-300/50 bg-red-500/5 text-red-700 dark:text-red-300",
    success: "border-emerald-300/50 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300",
    info: "border-cyan-300/50 bg-cyan-500/5 text-cyan-700 dark:text-cyan-300",
  };

  const toneIcons: Record<Tone, React.ReactNode> = {
    warning: <Clock3 size={12} />,
    danger: <AlertTriangle size={12} />,
    success: <CheckCircle2 size={12} />,
    info: <Sparkles size={12} />,
  };

  const totalNotifications = items.length;

  return (
    <div className="fixed right-5 top-5 z-[1001]">
      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="group relative flex h-12 w-12 items-center justify-center rounded-full border border-border bg-panel/95 text-ink shadow-lg shadow-slate-950/10 backdrop-blur-sm transition hover:scale-[1.02]"
          aria-label="Open notifications"
        >
          <Bell size={18} className="text-ink" />
          {totalNotifications > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-gradient-to-r from-amber to-cyan px-1 text-[9px] font-bold text-black">
              {Math.min(totalNotifications, 9)}
            </span>
          )}
        </button>
      ) : (
        <aside className="w-[360px] max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-panel/95 p-4 shadow-2xl shadow-slate-950/15 backdrop-blur-sm">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-amber to-cyan text-black shadow-sm">
                <Bell size={14} />
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-ink-dim">Notifications</p>
                <h3 className="font-display text-sm font-bold text-ink">Daily priorities</h3>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-dim hover:bg-row hover:text-ink"
              aria-label="Close notifications"
            >
              <X size={14} />
            </button>
          </div>

          <div className="space-y-2.5">
            {items.map((item) => (
              <div key={item.title} className={`rounded-xl border p-2.5 ${toneClasses[item.tone]}`}>
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-md bg-white/60 dark:bg-slate-900/40">
                    {toneIcons[item.tone]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold leading-tight text-ink">{item.title}</p>
                    <p className="mt-0.5 text-[10.5px] leading-relaxed text-ink-dim">{item.detail}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3 text-center">
            <div>
              <div className="flex items-center justify-center gap-1 text-[10px] text-ink-dim">
                <Users size={11} /> Leads
              </div>
              <div className="mt-1 text-sm font-bold text-ink">{newLeadsToday || 0}</div>
            </div>
            <div>
              <div className="flex items-center justify-center gap-1 text-[10px] text-ink-dim">
                <Clock3 size={11} /> Due
              </div>
              <div className="mt-1 text-sm font-bold text-ink">{dueCount}</div>
            </div>
            <div>
              <div className="flex items-center justify-center gap-1 text-[10px] text-ink-dim">
                <Mail size={11} /> Email
              </div>
              <div className="mt-1 text-sm font-bold text-ink">
                {settings?.email_provider && settings.email_provider !== "system_mailto" && settings.email_provider !== "none" ? "Live" : "Set"}
              </div>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
