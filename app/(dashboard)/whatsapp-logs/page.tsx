"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { fetchLeads, fetchWhatsAppMessages } from "@/lib/supabase/queries";
import type { Lead, WhatsAppMessage } from "@/lib/supabase/types";
import { useToast } from "@/components/toast-provider";
import { ColumnChooser } from "@/components/column-chooser";
import { useTableColumns } from "@/lib/column-prefs";

export default function WhatsAppLogsPage() {
  const { showToast } = useToast();
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const { columns, setColumn } = useTableColumns("whatsapp-logs", {
    status: true, direction: true, lead: true, phone: true, message: true, date: true,
  });
  const columnLabels = { status: "Status", direction: "Direction", lead: "Lead", phone: "Phone", message: "Message", date: "Date" };
  useEffect(() => {
    Promise.all([fetchWhatsAppMessages(), fetchLeads()])
      .then(([items, leadRows]) => { setMessages(items); setLeads(leadRows); })
      .catch((error) => showToast(error instanceof Error ? error.message : "Failed to load WhatsApp logs", "error"));
  }, [showToast]);
  const leadMap = useMemo(() => new Map(leads.map((lead) => [lead.id, lead])), [leads]);
  async function retry(message: WhatsAppMessage) {
    const response = await fetch("/api/whatsapp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: message.recipient_phone, text: message.body, leadId: message.lead_id, templateLabel: message.template_label }),
    });
    if (!response.ok) {
      const result = await response.json().catch(() => null);
      showToast(result?.message || "Retry failed", "error");
      return;
    }
    showToast("WhatsApp message retry sent", "success");
    setMessages(await fetchWhatsAppMessages());
  }
  return (
    <div>
      <div className="flex items-start justify-between"><PageHeader title="WhatsApp logs" subtitle="Sent, delivered, read, failed, and inbound messages." /><ColumnChooser columns={columns} labels={columnLabels} onChange={setColumn} /></div>
      <div className="overflow-x-auto rounded-xl border border-border bg-panel shadow-sm">
        <table className="w-full min-w-[760px] text-sm">
          <thead><tr className="border-b border-border bg-row/80 text-left text-[10px] font-semibold uppercase tracking-wide text-ink-dim">
            {columns.status && <th className="px-4 py-3">Status</th>}{columns.direction && <th className="px-3 py-3">Direction</th>}{columns.lead && <th className="px-3 py-3">Lead</th>}{columns.phone && <th className="px-3 py-3">Phone</th>}{columns.message && <th className="px-3 py-3">Message</th>}{columns.date && <th className="px-3 py-3">Date</th>}
          </tr></thead>
          <tbody>{messages.map((message) => <tr key={message.id} className="border-b border-border/70 last:border-0">
            {columns.status && <td className="px-4 py-3"><span className={message.status === "failed" ? "text-danger" : message.status === "read" ? "text-success" : "text-ink"}>{message.status}</span>{message.status === "failed" && message.body && <button onClick={() => retry(message)} className="ml-2 rounded bg-amber/20 px-2 py-0.5 text-[10px] font-semibold text-amber">Retry</button>}</td>}{columns.direction && <td className="px-3 py-3 text-xs text-ink-dim">{message.direction}</td>}{columns.lead && <td className="px-3 py-3 font-medium text-ink">{leadMap.get(message.lead_id || "")?.name || "Unknown"}</td>}{columns.phone && <td className="px-3 py-3 text-xs text-ink-dim">{message.recipient_phone}</td>}{columns.message && <td className="max-w-[260px] truncate px-3 py-3 text-xs text-ink-dim">{message.body || message.error_message || "—"}</td>}{columns.date && <td className="whitespace-nowrap px-3 py-3 text-xs text-ink-dim">{new Date(message.created_at).toLocaleString()}</td>}
          </tr>)}</tbody>
        </table>
        {!messages.length && <p className="px-4 py-14 text-center text-xs text-ink-dim">No WhatsApp messages logged yet.</p>}
      </div>
    </div>
  );
}
