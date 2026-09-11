"use client";

import { useMemo, useState } from "react";
import { X, MessageCircle, Mail, Trash2, Loader2 } from "lucide-react";
import type { Lead, ActivityLogEntry, Template, LeadStatus, Priority } from "@/lib/supabase/types";
import { STATUSES, PRIORITIES } from "@/lib/supabase/types";
import { updateLead, deleteLead, logActivity, insertLead, insertEmailTracking, insertWhatsAppMessage } from "@/lib/supabase/queries";
import { appendWhatsAppExtras, emailHtml, fillTemplate, mailtoLink } from "@/lib/messaging";
import { StatusBadge } from "@/components/status-badge";
import { useToast } from "@/components/toast-provider";
import { useConfirm } from "@/components/confirm-provider";

const LOST_REASONS = ["Price too high", "Bad timing", "Went with competitor", "No response", "Other"];

interface Props {
  leadId: string;
  leads: Lead[];
  setLeads: React.Dispatch<React.SetStateAction<Lead[]>>;
  activityByLead: Record<string, ActivityLogEntry[]>;
  setActivity: React.Dispatch<React.SetStateAction<ActivityLogEntry[]>>;
  templates: Template[];
  whatsappTemplateId: string | null;
  emailTemplateId: string | null;
  onClose: () => void;
}

export function LeadDrawer({
  leadId,
  leads,
  setLeads,
  activityByLead,
  setActivity,
  templates,
  whatsappTemplateId,
  emailTemplateId,
  onClose,
}: Props) {
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [savedLeadId, setSavedLeadId] = useState<string | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
  const [isSavingLead, setIsSavingLead] = useState(false);
  const existingLead = leads.find((l) => l.id === leadId);
  const isDraft = leadId === "__new__" && !savedLeadId;
  const [draftLead, setDraftLead] = useState<Lead | null>(() =>
    existingLead ?? {
      id: "__new__",
      name: "",
      city: null,
      phone: null,
      email: null,
      source: null,
      status: "New",
      notes: null,
      priority: "Warm",
      follow_up_date: null,
      lost_reason: null,
      created_at: new Date().toISOString(),
      last_contacted_at: null,
    }
  );
  const [showLostReason, setShowLostReason] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<LeadStatus | null>(null);

  const lead = existingLead ?? draftLead;

  const entries = useMemo(
    () => (activityByLead[leadId] || []).slice(0, 15),
    [activityByLead, leadId]
  );

  const whatsappTemplates = templates.filter((template) => template.channel !== "email");
  const emailTemplates = templates.filter((template) => template.channel !== "whatsapp");
  const whatsappTemplate = whatsappTemplates.find((t) => t.id === whatsappTemplateId) || whatsappTemplates[0];
  const emailTemplate = emailTemplates.find((t) => t.id === emailTemplateId) || emailTemplates[0];

  if (!lead) return null;
  const currentLead = lead;

  async function patch(fields: Partial<Lead>) {
    if (isDraft && !existingLead) {
      setDraftLead((previous) => previous ? { ...previous, ...fields } : previous);
      return;
    }

    try {
      const updated = await updateLead(currentLead.id, fields);
      setLeads((prev) => prev.map((l) => (l.id === currentLead.id ? updated : l)));
      if (isDraft && !existingLead) {
        setDraftLead(updated);
      }

    } catch (err: any) {
      showToast(err.message || "Update failed", "error");
    }

  }

  async function handleSubmitLead() {
    if (!isDraft || !draftLead || isSavingLead) return;
    const name = draftLead.name.trim();
    const phone = draftLead.phone?.trim() || null;
    const email = draftLead.email?.trim() || null;
    const city = draftLead.city?.trim() || null;
    const source = draftLead.source?.trim() || null;
    const notes = draftLead.notes?.trim() || null;
    if (!name && !phone && !email && !city && !source && !notes) {
      showToast("Add at least a name, phone, email, city, source, or note before saving.", "error");
      return;
    }

    setIsSavingLead(true);
    try {
      const created = await insertLead({
        name: name || "New Lead",
        phone,
        email,
        city,
        source: source || "Manual entry",
        notes,
        status: draftLead.status || "New",
        priority: draftLead.priority || "Warm",
        follow_up_date: draftLead.follow_up_date,
        lost_reason: draftLead.lost_reason,
      });
      setLeads((prev) => [created, ...prev]);
      setSavedLeadId(created.id);
      setDraftLead(created);
      showToast("Lead saved successfully", "success");
    } catch (err: any) {
      showToast(err.message || "Could not save lead", "error");
    } finally {
      setIsSavingLead(false);
    }
  }

  async function addActivity(action: string, detail = ""): Promise<ActivityLogEntry | null> {
    if (!currentLead.id || currentLead.id === "__new__") return null;
    try {
      const entry = await logActivity(currentLead.id, action, detail);
      setActivity((prev) => [entry, ...prev]);
      return entry;
    } catch {
      // non-fatal — activity logging failure shouldn't block the user's action
      return null;
    }
  }

  function handleStatusChange(newStatus: LeadStatus) {
    if (newStatus === "Client Denied") {
      setPendingStatus(newStatus);
      setShowLostReason(true);
      return;
    }
    const oldStatus = currentLead.status;
    patch({ status: newStatus });
    addActivity("status_changed", `${oldStatus} → ${newStatus}`);
  }

  function confirmLostReason(reason: string) {
    const oldStatus = currentLead.status;
    patch({ status: "Client Denied", lost_reason: reason });
    addActivity("status_changed", `${oldStatus} → Client Denied`);
    setShowLostReason(false);
    setPendingStatus(null);
  }

  async function handleSendWhatsApp() {
    if (!currentLead.phone || !whatsappTemplate || isSendingWhatsApp) return;
    setIsSendingWhatsApp(true);
    const msg = appendWhatsAppExtras(fillTemplate(whatsappTemplate.body, currentLead.name), whatsappTemplate.image_url, whatsappTemplate.cta_label, whatsappTemplate.cta_url);
    try {
      const response = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: currentLead.phone, text: msg, leadId: currentLead.id, templateLabel: whatsappTemplate.label }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.message || "WhatsApp send failed");
      await addActivity("whatsapp_sent", `${whatsappTemplate.label} (${result.messageId || "queued"})`);
      if (currentLead.status === "New") patch({ status: "Contacted" });
    } catch (error) {
      await addActivity("whatsapp_failed", `${whatsappTemplate.label}: ${error instanceof Error ? error.message : "WhatsApp send failed"}`);
      await insertWhatsAppMessage({ lead_id: currentLead.id, recipient_phone: currentLead.phone, template_label: whatsappTemplate.label, body: msg, status: "failed", error_message: error instanceof Error ? error.message : "WhatsApp send failed", failed_at: new Date().toISOString() }).catch(() => undefined);
      showToast(error instanceof Error ? error.message : "WhatsApp send failed", "error");
    } finally {
      setIsSendingWhatsApp(false);
    }
  }

  async function handleSendEmail() {
    if (!currentLead.email || !emailTemplate || isSendingEmail) return;
    setIsSendingEmail(true);
    const msg = fillTemplate(emailTemplate.body, currentLead.name);
    const html = emailHtml(msg, emailTemplate.image_url, emailTemplate.cta_label, emailTemplate.cta_url);
    const subj = fillTemplate(emailTemplate.subject || "Hi from Blacklight Motion", currentLead.name);
    const trackingToken = crypto.randomUUID();

    let shouldUseMailApp = false;
    try {
      const response = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: currentLead.email,
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
        window.open(mailtoLink(currentLead.email, subj, msg), "_self");
      } else if (!response.ok) {
        throw new Error(result?.message || "Email send failed");
      }

      const entry = await addActivity("email_sent", emailTemplate.label);
      if (entry && !shouldUseMailApp) {
        await insertEmailTracking({ token: trackingToken, lead_id: currentLead.id, activity_id: entry.id, template_label: emailTemplate.label });
      }
      showToast("1 email sent successfully", "success");
      if (currentLead.status === "New") patch({ status: "Contacted" });
    } catch (err: any) {
      showToast(err.message || "Couldn't send email", "error");
      if (shouldUseMailApp) window.open(mailtoLink(currentLead.email, subj, msg), "_self");
    } finally {
      setIsSendingEmail(false);
    }
  }

  async function handleDelete() {
    if (currentLead.id === "__new__") {
      onClose();
      return;
    }
    const ok = await confirm({
      title: "Delete lead",
      message: `Delete "${currentLead.name}" permanently? This can't be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteLead(currentLead.id);
      setLeads((prev) => prev.filter((l) => l.id !== currentLead.id));
      showToast("Lead deleted", "success");
      onClose();
    } catch (err: any) {
      showToast(err.message || "Delete failed", "error");
    }
  }

  const waCount = entries.filter((e) => e.action === "whatsapp_sent").length;
  const emailCount = entries.filter((e) => e.action === "email_sent").length;

  return (
    <div className="fixed inset-0 z-[1000] flex justify-end bg-black/50" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-md flex-col border-l border-border bg-panel shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="font-display text-base font-bold text-ink">{lead.name || "(unnamed)"}</h2>
            <StatusBadge status={lead.status} />
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink-dim hover:bg-row hover:text-ink">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin px-5 py-5">
          {/* Editable fields */}
          <div className="space-y-3">
            <Field label="Name">
              <input
                value={isDraft ? lead.name : undefined}
                defaultValue={isDraft ? undefined : lead.name}
                onChange={isDraft ? (e) => patch({ name: e.target.value }) : undefined}
                onBlur={!isDraft ? (e) => patch({ name: e.target.value }) : undefined}
                className="input"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="City">
                <input value={isDraft ? (lead.city ?? "") : undefined} defaultValue={!isDraft ? (lead.city ?? "") : undefined} onChange={isDraft ? (e) => patch({ city: e.target.value }) : undefined} onBlur={!isDraft ? (e) => patch({ city: e.target.value }) : undefined} className="input" />
              </Field>
              <Field label="Source">
                <input value={isDraft ? (lead.source ?? "") : undefined} defaultValue={!isDraft ? (lead.source ?? "") : undefined} onChange={isDraft ? (e) => patch({ source: e.target.value }) : undefined} onBlur={!isDraft ? (e) => patch({ source: e.target.value }) : undefined} className="input" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone">
                <input value={isDraft ? (lead.phone ?? "") : undefined} defaultValue={!isDraft ? (lead.phone ?? "") : undefined} onChange={isDraft ? (e) => patch({ phone: e.target.value }) : undefined} onBlur={!isDraft ? (e) => patch({ phone: e.target.value }) : undefined} className="input" />
              </Field>
              <Field label="Email">
                <input value={isDraft ? (lead.email ?? "") : undefined} defaultValue={!isDraft ? (lead.email ?? "") : undefined} onChange={isDraft ? (e) => patch({ email: e.target.value }) : undefined} onBlur={!isDraft ? (e) => patch({ email: e.target.value }) : undefined} className="input" />
              </Field>
            </div>

            <Field label="Status">
              <select
                value={lead.status}
                onChange={(e) => handleStatusChange(e.target.value as LeadStatus)}
                className="input"
              >
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>

            <Field label="Priority">
              <select
                value={lead.priority}
                onChange={(e) => patch({ priority: e.target.value as Priority })}
                className="input"
              >
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>

            <Field label="Follow-up date">
              <input
                type="date"
                defaultValue={lead.follow_up_date ?? ""}
                onChange={(e) => {
                  patch({ follow_up_date: e.target.value || null });
                  if (e.target.value) addActivity("followup_set", new Date(e.target.value).toLocaleDateString("en-IN"));
                }}
                className="input"
              />
            </Field>

            {(lead.status === "Client Denied" || lead.lost_reason) && (
              <Field label="Lost reason">
                <input
                  defaultValue={lead.lost_reason ?? ""}
                  onBlur={(e) => patch({ lost_reason: e.target.value })}
                  className="input"
                />
              </Field>
            )}

            <Field label="Notes">
              <textarea
                defaultValue={lead.notes ?? ""}
                rows={3}
                onBlur={(e) => {
                  patch({ notes: e.target.value });
                  if (e.target.value) addActivity("note_added", e.target.value.slice(0, 80));
                }}
                className="input resize-none"
              />
            </Field>
          </div>

          {isDraft && (
            <button
              type="button"
              onClick={handleSubmitLead}
              disabled={isSavingLead}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-amber to-cyan py-2.5 text-xs font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSavingLead ? <Loader2 size={14} className="animate-spin" /> : null}
              {isSavingLead ? "Saving lead..." : "Submit lead"}
            </button>
          )}

          {/* Send actions */}
          <div className="mt-5 flex gap-2">
            <button
              onClick={handleSendWhatsApp}
              disabled={isDraft || !lead.phone || isSendingWhatsApp}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-success py-2 text-xs font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSendingWhatsApp ? <Loader2 size={14} className="animate-spin" /> : <MessageCircle size={14} />}
              {isSendingWhatsApp ? "Sending..." : "WhatsApp"} {!isSendingWhatsApp && waCount > 0 && `(${waCount})`}
            </button>
            <button
              onClick={handleSendEmail}
              disabled={isDraft || !lead.email || isSendingEmail}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-cyan py-2 text-xs font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSendingEmail ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
              {isSendingEmail ? "Sending..." : "Email"} {!isSendingEmail && emailCount > 0 && `(${emailCount})`}
            </button>
          </div>

          {/* Activity log */}
          <div className="mt-6 border-t border-border pt-4">
            <h4 className="mb-2 text-[10.5px] font-semibold uppercase tracking-wide text-ink-dim">Activity</h4>
            {entries.length === 0 ? (
              <p className="text-xs text-ink-dim">No activity yet.</p>
            ) : (
              <div className="space-y-1.5">
                {entries.map((e) => (
                  <div key={e.id} className="font-mono text-[11px] text-ink-dim">
                    {new Date(e.created_at).toLocaleString()} — {e.action}
                    {e.detail ? `: ${e.detail}` : ""}
                  </div>
                ))}
              </div>
            )}
          </div>

          {lead.id !== "__new__" && (
            <button
              onClick={handleDelete}
              className="mt-6 flex items-center gap-1.5 text-xs font-medium text-danger hover:underline"
            >
              <Trash2 size={13} /> Delete lead
            </button>
          )}
        </div>
      </div>

      {/* Lost reason quick-pick */}
      {showLostReason && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/60 px-4" onClick={(e) => e.stopPropagation()}>
          <div className="w-full max-w-sm rounded-xl border border-border bg-panel p-6 shadow-2xl">
            <h3 className="font-display text-base font-bold text-ink">Why did this fall through?</h3>
            <p className="mt-1 text-xs text-ink-dim">Pick the closest reason — helps spot patterns over time.</p>
            <div className="mt-4 flex flex-col gap-2">
              {LOST_REASONS.map((r) => (
                <button
                  key={r}
                  onClick={() => confirmLostReason(r === "Other" ? "" : r)}
                  className="rounded-lg border border-border px-3 py-2 text-left text-xs text-ink hover:border-amber"
                >
                  {r}
                </button>
              ))}
              <button
                onClick={() => { setShowLostReason(false); setPendingStatus(null); }}
                className="mt-1 text-xs text-ink-dim hover:text-ink"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .input {
          width: 100%;
          border: 1px solid rgb(var(--border));
          background: rgb(var(--row));
          border-radius: 0.5rem;
          padding: 0.5rem 0.65rem;
          font-size: 0.75rem;
          color: rgb(var(--ink));
          outline: none;
        }
        .input:focus {
          border-color: #b24bf3;
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-ink-dim">{label}</label>
      {children}
    </div>
  );
}
