"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Plus,
  Upload,
  Download,
  Trash2,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Mail,
  Send,
  Loader2,
} from "lucide-react";
import type { Lead, ActivityLogEntry, Template, LeadStatus } from "@/lib/supabase/types";
import { STATUSES } from "@/lib/supabase/types";
import {
  fetchLeads,
  fetchActivity,
  fetchTemplates,
  insertLead,
  insertLeadsBulk,
  bulkDeleteLeads,
  updateLead,
  logActivity,
  insertEmailTracking,
  insertWhatsAppMessage,
} from "@/lib/supabase/queries";
import { appendWhatsAppExtras, emailHtml, fillTemplate, mailtoLink } from "@/lib/messaging";
import { StatusBadge } from "@/components/status-badge";
import { PriorityDot } from "@/components/priority-dot";
import { FollowUpBadge } from "@/components/followup-badge";
import { LeadDrawer } from "@/components/lead-drawer";
import { useToast } from "@/components/toast-provider";
import { useConfirm } from "@/components/confirm-provider";
import { useColumnPrefs } from "@/lib/column-prefs";
import { ColumnChooser } from "@/components/column-chooser";

const PAGE_SIZE = 20;

export function LeadsView({ dueOnly = false }: { dueOnly?: boolean }) {
  const { showToast } = useToast();
  const confirm = useConfirm();
  const { prefs, updatePrefs } = useColumnPrefs();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [activity, setActivity] = useState<ActivityLogEntry[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | LeadStatus>("all");
  const [page, setPage] = useState(1);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const [whatsappTemplateId, setWhatsappTemplateId] = useState<string | null>(null);
  const [emailTemplateId, setEmailTemplateId] = useState<string | null>(null);
  const [isBulkSending, setIsBulkSending] = useState(false);
  const [sendingEmailLeadIds, setSendingEmailLeadIds] = useState<Set<string>>(new Set());
  const [sendingWhatsAppLeadIds, setSendingWhatsAppLeadIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [l, a, t] = await Promise.all([fetchLeads(), fetchActivity(), fetchTemplates()]);
      setLeads(l);
      setActivity(a);
      setTemplates(t);
      if (t.length) {
        setWhatsappTemplateId(t.find((template) => template.channel !== "email")?.id ?? t[0].id);
        setEmailTemplateId(t.find((template) => template.channel !== "whatsapp")?.id ?? t[0].id);
      }
    } catch (err: any) {
      showToast(err.message || "Failed to load data", "error");
    } finally {
      setLoading(false);
    }
  }

  const activityByLead = useMemo(() => {
    const map: Record<string, ActivityLogEntry[]> = {};
    activity.forEach((a) => {
      if (!map[a.lead_id]) map[a.lead_id] = [];
      map[a.lead_id].push(a);
    });
    return map;
  }, [activity]);

  function sendCounts(leadId: string) {
    const entries = activityByLead[leadId] || [];
    return {
      wa: entries.filter((e) => e.action === "whatsapp_sent").length,
      email: entries.filter((e) => e.action === "email_sent").length,
    };
  }

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return leads
      .filter((l) => {
        if (dueOnly) {
          // Two different signals both belong here: leads explicitly staged
          // as "Follow-up" in the pipeline, and any lead with a reminder
          // date set (regardless of status). Either one qualifies.
          const hasDate = !!l.follow_up_date;
          const isFollowUpStatus = l.status === "Follow-up";
          if (!hasDate && !isFollowUpStatus) return false;
        } else if (statusFilter !== "all" && l.status !== statusFilter) {
          return false;
        }
        if (cityFilter !== "all" && l.city !== cityFilter) return false;
        if (sourceFilter !== "all" && l.source !== sourceFilter) return false;
        if (
          q &&
          !(l.name || "").toLowerCase().includes(q) &&
          !(l.phone || "").includes(q) &&
          !(l.email || "").toLowerCase().includes(q) &&
          !(l.city || "").toLowerCase().includes(q)
        )
          return false;
        return true;
      })
      .sort((a, b) => {
        if (dueOnly) {
          // undated "Follow-up" status leads surface first — they need a
          // date set. Dated ones sort soonest-first after that.
          if (!a.follow_up_date && !b.follow_up_date) return 0;
          if (!a.follow_up_date) return -1;
          if (!b.follow_up_date) return 1;
          return new Date(a.follow_up_date).getTime() - new Date(b.follow_up_date).getTime();
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [leads, search, cityFilter, sourceFilter, statusFilter, dueOnly, today]);

  const cities = useMemo(() => Array.from(new Set(leads.map((l) => l.city).filter(Boolean))) as string[], [leads]);
  const sources = useMemo(() => Array.from(new Set(leads.map((l) => l.source).filter(Boolean))) as string[], [leads]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function resetPage() {
    setPage(1);
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    const visibleIds = filtered.map((l) => l.id);
    const allSelected = visibleIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  async function handleBulkDelete() {
    const ok = await confirm({
      title: "Delete leads",
      message: `Delete ${selectedIds.size} selected lead(s) permanently? This can't be undone.`,
      confirmLabel: `Delete ${selectedIds.size}`,
      danger: true,
    });
    if (!ok) return;
    try {
      await bulkDeleteLeads(Array.from(selectedIds));
      setLeads((prev) => prev.filter((l) => !selectedIds.has(l.id)));
      setSelectedIds(new Set());
      showToast(`Deleted ${selectedIds.size} lead(s)`, "success");
    } catch (err: any) {
      showToast(err.message || "Delete failed", "error");
    }
  }

  async function handleAddLead() {
    setOpenLeadId("__new__");
  }

  const whatsappTemplates = templates.filter((template) => template.channel !== "email");
  const emailTemplates = templates.filter((template) => template.channel !== "whatsapp");
  const whatsappTemplate = whatsappTemplates.find((t) => t.id === whatsappTemplateId) || whatsappTemplates[0];
  const emailTemplate = emailTemplates.find((t) => t.id === emailTemplateId) || emailTemplates[0];

  async function quickSendWhatsApp(lead: Lead, e: React.MouseEvent) {
    e.stopPropagation();
    if (!lead.phone || !whatsappTemplate || sendingWhatsAppLeadIds.has(lead.id)) return;
    setSendingWhatsAppLeadIds((prev) => new Set(prev).add(lead.id));
    const msg = appendWhatsAppExtras(fillTemplate(whatsappTemplate.body, lead.name), whatsappTemplate.image_url, whatsappTemplate.cta_label, whatsappTemplate.cta_url);
    try {
      const response = await fetch("/api/whatsapp/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: lead.phone, text: msg, leadId: lead.id, templateLabel: whatsappTemplate.label }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.message || "WhatsApp send failed");
      const entry = await logActivity(lead.id, "whatsapp_sent", `${whatsappTemplate.label} (${result.messageId || "queued"})`);
      setActivity((prev) => [entry, ...prev]);
      if (lead.status === "New") {
        const updated = await updateLead(lead.id, { status: "Contacted" });
        setLeads((prev) => prev.map((l) => (l.id === lead.id ? updated : l)));
      }
    } catch (err: any) {
      const entry = await logActivity(lead.id, "whatsapp_failed", `${whatsappTemplate.label}: ${err.message || "WhatsApp send failed"}`).catch(() => null);
      if (entry) setActivity((prev) => [entry, ...prev]);
      await insertWhatsAppMessage({ lead_id: lead.id, recipient_phone: lead.phone, template_label: whatsappTemplate.label, body: msg, status: "failed", error_message: err.message || "WhatsApp send failed", failed_at: new Date().toISOString() }).catch(() => undefined);
      showToast(err.message || "WhatsApp send failed", "error");
    } finally {
      setSendingWhatsAppLeadIds((prev) => {
        const next = new Set(prev);
        next.delete(lead.id);
        return next;
      });
    }
  }

  async function quickSendEmail(lead: Lead, e: React.MouseEvent) {
    e.stopPropagation();
    if (!lead.email || !emailTemplate || sendingEmailLeadIds.has(lead.id)) return;
    setSendingEmailLeadIds((prev) => new Set(prev).add(lead.id));
    const msg = fillTemplate(emailTemplate.body, lead.name);
    const html = emailHtml(msg, emailTemplate.image_url, emailTemplate.cta_label, emailTemplate.cta_url);
    const subj = fillTemplate(emailTemplate.subject || "Hi from Blacklight Motion", lead.name);
    const trackingToken = crypto.randomUUID();

    let shouldUseMailApp = false;
    try {
      const response = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: lead.email,
          subject: subj,
          text: msg,
          html,
          trackingToken,
          trackingBaseUrl: window.location.origin,
        }),
      });
      const result = await response.json();

      if (!response.ok && result?.fallback) {
        shouldUseMailApp = true;
        window.open(mailtoLink(lead.email, subj, msg), "_self");
      } else if (!response.ok) {
        throw new Error(result?.message || "Email send failed");
      }

      const entry = await logActivity(lead.id, "email_sent", emailTemplate.label);
      setActivity((prev) => [entry, ...prev]);
      if (!shouldUseMailApp) {
        await insertEmailTracking({ token: trackingToken, lead_id: lead.id, activity_id: entry.id, template_label: emailTemplate.label });
      }
      showToast("1 email sent successfully", "success");
      if (lead.status === "New") {
        const updated = await updateLead(lead.id, { status: "Contacted" });
        setLeads((prev) => prev.map((l) => (l.id === lead.id ? updated : l)));
      }

      if (shouldUseMailApp) {
        showToast("Opened your email app", "default");
      }
    } catch (err: any) {
      showToast(err.message || "Couldn't send email", "error");
      if (shouldUseMailApp) window.open(mailtoLink(lead.email, subj, msg), "_self");
    } finally {
      setSendingEmailLeadIds((prev) => {
        const next = new Set(prev);
        next.delete(lead.id);
        return next;
      });
    }
  }

  async function handleBulkSendEmail() {
    if (!emailTemplate || selectedIds.size === 0 || isBulkSending) return;

    const selectedLeads = leads.filter((lead) => selectedIds.has(lead.id));
    const ok = await confirm({
      title: "Send bulk email",
      message: `Send "${emailTemplate.label}" to ${selectedLeads.length} selected lead(s)? Leads without an email address will be logged as failed.`,
      confirmLabel: `Send to ${selectedLeads.length}`,
    });
    if (!ok) return;

    setIsBulkSending(true);
    let sent = 0;
    let failed = 0;
    const newActivity: ActivityLogEntry[] = [];

    for (const lead of selectedLeads) {
      let action: "email_sent" | "email_failed" = "email_failed";
      let detail = emailTemplate.label;
      const trackingToken = crypto.randomUUID();

      try {
        if (!lead.email?.trim()) throw new Error("No email address");

        const msg = fillTemplate(emailTemplate.body, lead.name);
        const html = emailHtml(msg, emailTemplate.image_url, emailTemplate.cta_label, emailTemplate.cta_url);
        const subj = fillTemplate(emailTemplate.subject || "Hi from Blacklight Motion", lead.name);
        const response = await fetch("/api/email/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: lead.email,
            subject: subj,
            text: msg,
            html,
            trackingToken,
            trackingBaseUrl: window.location.origin,
          }),
        });
        const result = await response.json().catch(() => null);
        if (!response.ok) throw new Error(result?.message || "Email send failed");

        action = "email_sent";
        sent++;
        if (lead.status === "New") {
          const updated = await updateLead(lead.id, { status: "Contacted" });
          setLeads((prev) => prev.map((item) => (item.id === lead.id ? updated : item)));
        }
      } catch (error) {
        failed++;
        detail = `${emailTemplate.label}: ${error instanceof Error ? error.message : "Email send failed"}`;
      }

      try {
        const entry = await logActivity(lead.id, action, detail);
        newActivity.push(entry);
        if (action === "email_sent") {
          await insertEmailTracking({ token: trackingToken, lead_id: lead.id, activity_id: entry.id, template_label: emailTemplate.label });
        }
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Couldn't save email log", "error");
      }
    }

    setActivity((prev) => [...newActivity, ...prev]);
    setIsBulkSending(false);
    showToast(`Bulk email complete: ${sent} sent, ${failed} failed`, failed ? "default" : "success");
  }

  function handleExportCsv() {
    const header = "Name,City,Phone,Email,Source,Status,Priority,Follow Up Date\n";
    const rows = leads
      .map((l) =>
        [l.name, l.city, l.phone, l.email, l.source, l.status, l.priority, l.follow_up_date]
          .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "blacklight-leads.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = "";
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      const next = text[i + 1];
      if (inQuotes) {
        if (c === '"' && next === '"') {
          field += '"';
          i++;
        } else if (c === '"') {
          inQuotes = false;
        } else {
          field += c;
        }
      } else {
        if (c === '"') inQuotes = true;
        else if (c === ",") {
          row.push(field);
          field = "";
        } else if (c === "\n" || c === "\r") {
          if (c === "\r" && next === "\n") i++;
          row.push(field);
          field = "";
          if (row.length > 1 || row[0] !== "") rows.push(row);
          row = [];
        } else field += c;
      }
    }
    if (field !== "" || row.length) {
      row.push(field);
      rows.push(row);
    }
    return rows;
  }

  async function handleImportCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const rows = parseCsv(text);
    if (!rows.length) {
      showToast("That CSV looks empty.", "error");
      return;
    }
    const header = rows[0].map((h) => h.trim().toLowerCase());
    const nameIdx = header.findIndex((h) => h.includes("name"));
    const cityIdx = header.findIndex((h) => h.includes("city"));
    const phoneIdx = header.findIndex((h) => h.includes("phone") || h.includes("number") || h.includes("mobile"));
    const emailIdx = header.findIndex((h) => h.includes("email"));
    const sourceIdx = header.findIndex((h) => h.includes("source"));

    if (nameIdx === -1) {
      showToast("No Name column found in that CSV.", "error");
      return;
    }

    const existingPhones = new Set(leads.map((l) => (l.phone || "").replace(/\D/g, "")).filter(Boolean));
    const dataRows = rows.slice(1).filter((r) => r.some((v) => v.trim() !== ""));
    const toInsert: Partial<Lead>[] = [];
    let skipped = 0;

    dataRows.forEach((r) => {
      const name = (r[nameIdx] || "").trim();
      if (!name) return;
      const phone = phoneIdx > -1 ? (r[phoneIdx] || "").replace(/\D/g, "") : "";
      if (phone && existingPhones.has(phone)) {
        skipped++;
        return;
      }
      if (phone) existingPhones.add(phone);
      toInsert.push({
        name,
        city: cityIdx > -1 ? (r[cityIdx] || "").trim() : "",
        phone,
        email: emailIdx > -1 ? (r[emailIdx] || "").trim() : "",
        source: sourceIdx > -1 ? (r[sourceIdx] || "").trim() : "CSV import",
        status: "New",
      });
    });

    if (!toInsert.length) {
      showToast(`Nothing new to import — ${skipped} already exist.`, "default");
      e.target.value = "";
      return;
    }

    try {
      const saved = await insertLeadsBulk(toInsert);
      setLeads((prev) => [...saved, ...prev]);
      showToast(`Imported ${saved.length} new lead(s), skipped ${skipped} duplicate(s).`, "success");
    } catch (err: any) {
      showToast(err.message || "Import failed", "error");
    }
    e.target.value = "";
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      {/* Status filter chips */}
      {!dueOnly && (
        <div className="mb-3 flex w-full gap-0.5 overflow-x-auto rounded-xl border border-border bg-panel p-1 shadow-sm scrollbar-thin">
          {(["all", ...STATUSES] as const).map((s) => {
            const count = s === "all" ? leads.length : leads.filter((l) => l.status === s).length;
            const active = statusFilter === s;
            return (
              <button
                key={s}
                onClick={() => { setStatusFilter(s as any); resetPage(); }}
                className={`flex min-w-[92px] flex-1 shrink-0 items-center justify-center gap-1.5 rounded-lg border-b-2 px-2.5 py-1.5 text-[10.5px] font-semibold transition-colors ${
                  active
                    ? "border-amber text-ink"
                    : "border-transparent text-ink-dim hover:border-border hover:text-ink"
                }`}
              >
                {s === "all" ? "All leads" : s}
                <span className={`font-mono text-[9.5px] ${active ? "text-amber" : "text-ink-dim"}`}>{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-panel px-2 py-2 shadow-sm">
        <div className="flex w-full min-w-0 flex-wrap items-center gap-1.5">
          <div className="relative w-full sm:w-1/2 sm:shrink-0">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-dim" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              resetPage();
            }}
            placeholder="Search leads"
            className="w-full rounded-lg border border-border bg-panel py-1.5 pl-8 pr-3 text-xs text-ink outline-none focus:border-amber"
          />
          </div>

          <select
            value={cityFilter}
            onChange={(e) => { setCityFilter(e.target.value); resetPage(); }}
            className="min-w-[140px] flex-1 rounded-lg border border-border bg-panel px-2.5 py-1.5 text-xs text-ink outline-none focus:border-amber"
          >
            <option value="all">All cities</option>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          <select
            value={sourceFilter}
            onChange={(e) => { setSourceFilter(e.target.value); resetPage(); }}
            className="min-w-[140px] flex-1 rounded-lg border border-border bg-panel px-2.5 py-1.5 text-xs text-ink outline-none focus:border-amber"
          >
            <option value="all">All sources</option>
            {sources.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex w-full flex-wrap items-center justify-end gap-1.5 border-t border-border pt-2">
          {whatsappTemplates.length > 0 && (
            <label className="flex items-center gap-1 text-[10px] font-medium text-ink-dim">
              WA
              <select
                value={whatsappTemplateId ?? ""}
                onChange={(e) => setWhatsappTemplateId(e.target.value)}
                className="max-w-[150px] rounded-lg border border-border bg-panel px-2.5 py-1.5 text-xs text-ink outline-none focus:border-amber"
              >
                {whatsappTemplates.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </label>
          )}
          {emailTemplates.length > 0 && (
            <label className="flex items-center gap-1 text-[10px] font-medium text-ink-dim">
              Email
              <select
                value={emailTemplateId ?? ""}
                onChange={(e) => setEmailTemplateId(e.target.value)}
                className="max-w-[150px] rounded-lg border border-border bg-panel px-2.5 py-1.5 text-xs text-ink outline-none focus:border-amber"
              >
                {emailTemplates.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </label>
          )}
          <button
            onClick={handleAddLead}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber to-cyan px-3 py-1.5 text-xs font-semibold text-black"
          >
            <Plus size={13} /> Add lead
          </button>
          <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-ink-dim hover:text-ink">
            <Upload size={13} /> Import
            <input type="file" accept=".csv" className="hidden" onChange={handleImportCsv} />
          </label>
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-ink-dim hover:text-ink"
          >
            <Download size={13} /> Export
          </button>
          <ColumnChooser
            columns={prefs}
            labels={{ showEmail: "Email", showFollowUp: "Follow-up", showSendCounts: "Send counts" }}
            onChange={(column, visible) => updatePrefs({ [column]: visible })}
          />
        </div>
      </div>

      {/* Bulk bar */}
      {selectedIds.size > 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-lg border border-border bg-panel px-4 py-2">
          <span className="text-xs text-ink-dim">{selectedIds.size} selected</span>
          <button
            onClick={handleBulkSendEmail}
            disabled={!emailTemplate || isBulkSending}
            className="flex items-center gap-1.5 rounded-lg bg-cyan px-3 py-1.5 text-xs font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send size={13} /> {isBulkSending ? "Sending..." : "Send email"}
          </button>
          <button
            onClick={async () => {
              const selected = leads.filter((lead) => selectedIds.has(lead.id) && lead.phone);
              if (!whatsappTemplate || !selected.length) return;
              setIsBulkSending(true);
              let sent = 0;
              for (const lead of selected) {
                const recipientPhone = lead.phone;
                if (!recipientPhone) continue;
                const msg = appendWhatsAppExtras(fillTemplate(whatsappTemplate.body, lead.name), whatsappTemplate.image_url, whatsappTemplate.cta_label, whatsappTemplate.cta_url);
                try {
                  const response = await fetch("/api/whatsapp/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: recipientPhone, text: msg, leadId: lead.id, templateLabel: whatsappTemplate.label }) });
                  const result = await response.json().catch(() => null);
                  if (!response.ok) throw new Error(result?.message || "WhatsApp send failed");
                  const entry = await logActivity(lead.id, "whatsapp_sent", `${whatsappTemplate.label} (${result.messageId || "queued"})`);
                  setActivity((prev) => [entry, ...prev]);
                  sent++;
                } catch (error) {
                  const entry = await logActivity(lead.id, "whatsapp_failed", `${whatsappTemplate.label}: ${error instanceof Error ? error.message : "WhatsApp send failed"}`).catch(() => null);
                  if (entry) setActivity((prev) => [entry, ...prev]);
                  await insertWhatsAppMessage({ lead_id: lead.id, recipient_phone: recipientPhone, template_label: whatsappTemplate.label, body: msg, status: "failed", error_message: error instanceof Error ? error.message : "WhatsApp send failed", failed_at: new Date().toISOString() }).catch(() => undefined);
                }
              }
              setIsBulkSending(false);
              showToast(`WhatsApp bulk send complete: ${sent} sent, ${selected.length - sent} failed`, sent === selected.length ? "success" : "default");
            }}
            disabled={!whatsappTemplate || isBulkSending}
            className="flex items-center gap-1.5 rounded-lg bg-success px-3 py-1.5 text-xs font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40"
          >
            <MessageCircle size={13} /> WhatsApp
          </button>
          <button
            onClick={handleBulkDelete}
            className="ml-auto flex items-center gap-1.5 rounded-lg bg-danger/15 px-3 py-1.5 text-xs font-semibold text-danger hover:bg-danger/25"
          >
            <Trash2 size={13} /> Delete selected
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border bg-panel shadow-sm">
        <table className="min-w-[760px] w-full table-fixed text-sm">
          <thead>
            <tr className="border-b border-border bg-row/80 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-dim">
              <th className="w-9 px-4 py-2.5">
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && filtered.every((l) => selectedIds.has(l.id))}
                  onChange={toggleSelectAll}
                  className="accent-amber"
                />
              </th>
              <th className="w-[27%] px-3 py-2.5">Lead</th>
              <th className="w-[17%] px-3 py-2.5">Phone</th>
              {prefs.showEmail && <th className="w-[22%] px-3 py-2.5">Email</th>}
              <th className="w-[14%] px-3 py-2.5">Status</th>
              <th className="w-[12%] px-3 py-2.5 text-center">Reach</th>
              {prefs.showSendCounts && <th className="w-[10%] px-3 py-2.5 text-right">Sent</th>}
            </tr>
          </thead>
          <tbody>
            {pageItems.length === 0 && (
              <tr>
                <td colSpan={5 + (prefs.showEmail?1:0) + (prefs.showSendCounts?1:0)} className="px-4 py-14 text-center text-xs text-ink-dim">
                  {dueOnly
                    ? "Nothing here yet. Leads show up once you set a lead's status to \"Follow-up\" or give it a follow-up date in the drawer."
                    : "No leads match this view."}
                </td>
              </tr>
            )}
            {pageItems.map((lead) => {
              const counts = sendCounts(lead.id);
              return (
                <tr
                  key={lead.id}
                  onClick={() => setOpenLeadId(lead.id)}
                  className="cursor-pointer border-b border-border/70 even:bg-row/35 last:border-0 hover:bg-row"
                >
                  <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(lead.id)}
                      onChange={() => toggleSelect(lead.id)}
                      className="accent-amber"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <PriorityDot priority={lead.priority} />
                      <span className="truncate font-semibold text-ink">{lead.name || "(unnamed)"}</span>
                      <span className="shrink-0 text-[9px] font-medium uppercase tracking-wide text-ink-dim">{lead.priority}</span>
                    </div>
                    <div className="mt-1 flex min-w-0 items-center gap-2 text-[10.5px] text-ink-dim">
                      <span className="truncate">{lead.city || "No city"}</span>
                      {lead.source && <span className="truncate text-ink-dim/70">· {lead.source}</span>}
                      {prefs.showFollowUp && <FollowUpBadge dateStr={lead.follow_up_date} />}
                    </div>
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-ink-dim">{lead.phone || "—"}</td>
                  {prefs.showEmail && (
                    <td className="truncate px-3 py-3 text-xs text-ink-dim">{lead.email || "—"}</td>
                  )}
                  <td className="px-3 py-3"><StatusBadge status={lead.status} /></td>
                  <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={(e) => quickSendWhatsApp(lead, e)}
                        disabled={!lead.phone || sendingWhatsAppLeadIds.has(lead.id)}
                        title={lead.phone ? "Send WhatsApp" : "No phone number"}
                        className="flex h-7 w-7 items-center justify-center rounded-md bg-success/15 text-success hover:bg-success/25 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        {sendingWhatsAppLeadIds.has(lead.id) ? <Loader2 size={14} className="animate-spin" /> : <MessageCircle size={14} />}
                      </button>
                      <button
                        onClick={(e) => quickSendEmail(lead, e)}
                        disabled={!lead.email || sendingEmailLeadIds.has(lead.id)}
                        title={lead.email ? "Send Email" : "No email address"}
                        className="flex h-7 w-7 items-center justify-center rounded-md bg-cyan/15 text-cyan hover:bg-cyan/25 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        {sendingEmailLeadIds.has(lead.id) ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Mail size={14} />
                        )}
                      </button>
                    </div>
                  </td>
                  {prefs.showSendCounts && (
                    <td className="px-3 py-3 text-right font-mono text-[10.5px] text-ink-dim">
                      {counts.wa > 0 && <span className="mr-1.5 rounded bg-success/10 px-1.5 py-0.5 text-success">WA {counts.wa}</span>}
                      {counts.email > 0 && <span className="rounded bg-cyan/10 px-1.5 py-0.5 text-cyan">Mail {counts.email}</span>}
                      {counts.wa === 0 && counts.email === 0 && "—"}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {filtered.length > 0 && (
        <div className="mt-3 flex items-center justify-between text-xs text-ink-dim">
          <span>
            {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 disabled:opacity-40"
            >
              <ChevronLeft size={13} /> Prev
            </button>
            <span>Page {currentPage} of {totalPages}</span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 disabled:opacity-40"
            >
              Next <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}

      {openLeadId && (
        <LeadDrawer
          leadId={openLeadId}
          leads={leads}
          setLeads={setLeads}
          activityByLead={activityByLead}
          setActivity={setActivity}
          templates={templates}
          whatsappTemplateId={whatsappTemplateId}
          emailTemplateId={emailTemplateId}
          onClose={() => setOpenLeadId(null)}
        />
      )}
    </div>
  );
}
