"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { Template } from "@/lib/supabase/types";
import { fetchTemplates, insertTemplate, updateTemplate, deleteTemplate } from "@/lib/supabase/queries";
import { appendWhatsAppExtras, emailHtml, fillTemplate } from "@/lib/messaging";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/components/toast-provider";
import { useConfirm } from "@/components/confirm-provider";

export default function TemplatesPage() {
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTemplates()
      .then(setTemplates)
      .catch((err) => showToast(err.message || "Failed to load templates", "error"))
      .finally(() => setLoading(false));
  }, []);

  async function handleAdd() {
    try {
      const saved = await insertTemplate({
        label: "New template",
        channel: "both",
        subject: "",
        body: "Hi {name}, ",
        image_url: null,
        cta_label: "Learn more",
        cta_url: null,
      });
      setTemplates((prev) => [...prev, saved]);
    } catch (err: any) {
      showToast(err.message || "Could not create template", "error");
    }
  }

  async function handleFieldChange(id: string, fields: Partial<Template>) {
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, ...fields } : t)));
    try {
      await updateTemplate(id, fields);
    } catch (err: any) {
      showToast(err.message || "Save failed", "error");
    }
  }

  async function handleDelete(t: Template) {
    const ok = await confirm({
      title: "Delete template",
      message: `Delete "${t.label}"? Any lead currently using it for sends will fall back to another template.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteTemplate(t.id);
      setTemplates((prev) => prev.filter((x) => x.id !== t.id));
      showToast("Template deleted", "success");
    } catch (err: any) {
      showToast(err.message || "Delete failed", "error");
    }
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
      <PageHeader title="Templates" subtitle="Reusable WhatsApp and email pitches. Use {name} — it's swapped for each lead automatically." />

      <button
        onClick={handleAdd}
        className="mb-4 flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber to-cyan px-3 py-1.5 text-xs font-semibold text-black"
      >
        <Plus size={14} /> Add template
      </button>

      {templates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-panel px-8 py-16 text-center text-xs text-ink-dim">
          No templates yet — add one above.
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              onChange={(fields) => handleFieldChange(t.id, fields)}
              onDelete={() => handleDelete(t)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TemplateCard({
  template,
  onChange,
  onDelete,
}: {
  template: Template;
  onChange: (fields: Partial<Template>) => void;
  onDelete: () => void;
}) {
  const [label, setLabel] = useState(template.label);
  const [subject, setSubject] = useState(template.subject || "");
  const [body, setBody] = useState(template.body);
  const [channel, setChannel] = useState(template.channel || "both");
  const [imageUrl, setImageUrl] = useState(template.image_url || "");
  const [ctaLabel, setCtaLabel] = useState(template.cta_label || "");
  const [ctaUrl, setCtaUrl] = useState(template.cta_url || "");

  const preview = fillTemplate(body, "Rohan");

  return (
    <div className="soft-card rounded-xl p-4">
      <div className="mb-3 flex items-center gap-3">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => onChange({ label })}
          className="flex-1 rounded-lg border border-border bg-row px-3 py-2 text-sm font-semibold text-ink outline-none focus:border-amber"
          placeholder="Template name"
        />
        <button
          onClick={onDelete}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-danger hover:bg-danger/10"
        >
          <Trash2 size={13} /> Delete
        </button>
      </div>

      <div className="mb-3 grid gap-3 md:grid-cols-2">
        <label className="block text-[10px] font-medium uppercase tracking-wide text-ink-dim">
          Channel
          <select
            value={channel}
            onChange={(e) => { setChannel(e.target.value); onChange({ channel: e.target.value }); }}
            className="mt-1 w-full rounded-lg border border-border bg-row px-3 py-2 text-xs text-ink outline-none focus:border-amber"
          >
            <option value="both">WhatsApp + Email</option>
            <option value="whatsapp">WhatsApp only</option>
            <option value="email">Email only</option>
          </select>
        </label>
        <label className="block text-[10px] font-medium uppercase tracking-wide text-ink-dim">
          Email subject
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            onBlur={() => onChange({ subject })}
            className="mt-1 w-full rounded-lg border border-border bg-row px-3 py-2 text-xs text-ink outline-none focus:border-amber"
            placeholder="Subject line for email sends"
          />
        </label>
      </div>

      <div className="mb-3">
        <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-ink-dim">
          Message body
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onBlur={() => onChange({ body })}
          rows={4}
          className="w-full resize-none rounded-lg border border-border bg-row px-3 py-2 font-mono text-xs text-ink outline-none focus:border-amber"
        />
      </div>

      <div className="mb-3 grid gap-3 md:grid-cols-3">
        <label className="block text-[10px] font-medium uppercase tracking-wide text-ink-dim">
          Image URL
          <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} onBlur={() => onChange({ image_url: imageUrl || null })} placeholder="https://..." className="mt-1 w-full rounded-lg border border-border bg-row px-3 py-2 text-xs text-ink outline-none focus:border-amber" />
        </label>
        <label className="block text-[10px] font-medium uppercase tracking-wide text-ink-dim">
          CTA label
          <input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} onBlur={() => onChange({ cta_label: ctaLabel || null })} placeholder="Book a call" className="mt-1 w-full rounded-lg border border-border bg-row px-3 py-2 text-xs text-ink outline-none focus:border-amber" />
        </label>
        <label className="block text-[10px] font-medium uppercase tracking-wide text-ink-dim">
          CTA URL
          <input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} onBlur={() => onChange({ cta_url: ctaUrl || null })} placeholder="https://..." className="mt-1 w-full rounded-lg border border-border bg-row px-3 py-2 text-xs text-ink outline-none focus:border-amber" />
        </label>
      </div>

      <div className="rounded-lg border border-dashed border-border bg-row px-3 py-2.5">
        <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-ink-dim">
          Preview (as "Rohan" would see it)
        </div>
        {channel !== "email" && <p className="text-xs leading-relaxed text-ink-dim">{appendWhatsAppExtras(preview, imageUrl, ctaLabel, ctaUrl)}</p>}
        {channel !== "whatsapp" && (
          <div className="mt-2 border-t border-border pt-2 text-xs leading-relaxed text-ink-dim" dangerouslySetInnerHTML={{ __html: emailHtml(preview, imageUrl, ctaLabel, ctaUrl) }} />
        )}
      </div>
    </div>
  );
}
