"use client";

import { useMemo, useState } from "react";
import { X, MessageCircle, Mail, Trash2 } from "lucide-react";
import type { Lead, ActivityLogEntry, Template, LeadStatus, Priority } from "@/lib/supabase/types";
import { STATUSES, PRIORITIES } from "@/lib/supabase/types";
import { updateLead, deleteLead, logActivity, insertLead } from "@/lib/supabase/queries";
import { appendWhatsAppExtras, emailHtml, fillTemplate, mailtoLink, waLink } from "@/lib/messaging";
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
      const sanitized = {
        name: (fields.name ?? currentLead.name ?? "").trim() || (currentLead.name ?? "").trim() || "",
        phone: (fields.phone ?? currentLead.phone ?? "").trim() || (currentLead.phone ?? "").trim() || null,
        email: (fields.email ?? currentLead.email ?? "").trim() || (currentLead.email ?? "").trim() || null,
        city: (fields.city ?? currentLead.city ?? "").trim() || (currentLead.city ?? "").trim() || null,
        source: (fields.source ?? currentLead.source ?? "").trim() || (currentLead.source ?? "").trim() || null,
        status: fields.status ?? currentLead.status,
        notes: fields.notes ?? currentLead.notes,
        priority: fields.priority ?? currentLead.priority,
        follow_up_date: fields.follow_up_date ?? currentLead.follow_up_date,
        lost_reason: fields.lost_reason ?? currentLead.lost_reason,
      };

      const hasMeaningfulData = Boolean(
        sanitized.name || sanitized.phone || sanitized.email || sanitized.city || sanitized.source || sanitized.notes
      );

      if (!hasMeaningfulData) return;

      try {
        const created = await insertLead({
          ...sanitized,
          name: sanitized.name || "New Lead",
          status: sanitized.status || "New",
          priority: sanitized.priority || "Warm",
          source: sanitized.source || "Manual entry",
        });
        setLeads((prev) => [created, ...prev]);
        setSavedLeadId(created.id);
        setDraftLead(created);
      } catch (err: any) {
        showToast(err.message || "Could not create lead", "error");
      }
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

  async function addActivity(action: string, detail = "") {
    if (!currentLead.id || currentLead.id === "__new__") return;
    try {
      const entry = await logActivity(currentLead.id, action, detail);
      setActivity((prev) => [entry, ...prev]);
    } catch {
      // non-fatal — activity logging failure shouldn't block the user's action
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

  function handleSendWhatsApp() {
    if (!currentLead.phone || !whatsappTemplate) return;
    const msg = appendWhatsAppExtras(fillTemplate(whatsappTemplate.body, currentLead.name), whatsappTemplate.image_url, whatsappTemplate.cta_label, whatsappTemplate.cta_url);
    window.open(waLink(currentLead.phone, msg), "_blank");
    addActivity("whatsapp_sent", whatsappTemplate.label);
    if (currentLead.status === "New") patch({ status: "Contacted" });
  }

  async function handleSendEmail() {
    if (!currentLead.email || !emailTemplate) return;
    const msg = fillTemplate(emailTemplate.body, currentLead.name);
    const html = emailHtml(msg, emailTemplate.image_url, emailTemplate.cta_label, emailTemplate.cta_url);
    const subj = fillTemplate(emailTemplate.subject || "Hi from Blacklight Motion", currentLead.name);

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
        }),
      });
      const result = await response.json();

      if (!response.ok && result?.fallback) {
        shouldUseMailApp = true;
        window.open(mailtoLink(currentLead.email, subj, msg), "_self");
      } else if (!response.ok) {
        throw new Error(result?.message || "Email send failed");
      }

      addActivity("email_sent", emailTemplate.label);
      showToast("1 email sent successfully", "success");
      if (currentLead.status === "New") patch({ status: "Contacted" });
    } catch (err: any) {
      showToast(err.message || "Couldn't send email", "error");
      if (shouldUseMailApp) window.open(mailtoLink(currentLead.email, subj, msg), "_self");
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
                defaultValue={lead.name}
                onBlur={(e) => patch({ name: e.target.value })}
                className="input"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="City">
                <input defaultValue={lead.city ?? ""} onBlur={(e) => patch({ city: e.target.value })} className="input" />
              </Field>
              <Field label="Source">
                <input defaultValue={lead.source ?? ""} onBlur={(e) => patch({ source: e.target.value })} className="input" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone">
                <input defaultValue={lead.phone ?? ""} onBlur={(e) => patch({ phone: e.target.value })} className="input" />
              </Field>
              <Field label="Email">
                <input defaultValue={lead.email ?? ""} onBlur={(e) => patch({ email: e.target.value })} className="input" />
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

          {/* Send actions */}
          <div className="mt-5 flex gap-2">
            <button
              onClick={handleSendWhatsApp}
              disabled={!lead.phone}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-success py-2 text-xs font-semibold text-black disabled:opacity-40"
            >
              <MessageCircle size={14} /> WhatsApp {waCount > 0 && `(${waCount})`}
            </button>
            <button
              onClick={handleSendEmail}
              disabled={!lead.email}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-cyan py-2 text-xs font-semibold text-black disabled:opacity-40"
            >
              <Mail size={14} /> Email {emailCount > 0 && `(${emailCount})`}
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
