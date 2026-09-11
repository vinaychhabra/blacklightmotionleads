"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/components/toast-provider";
import { fetchActivity, fetchEmailTracking, fetchLeads } from "@/lib/supabase/queries";
import type { ActivityLogEntry, EmailTracking, Lead } from "@/lib/supabase/types";

export default function EmailLogsPage() {
  const { showToast } = useToast();
  const [activity, setActivity] = useState<ActivityLogEntry[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [tracking, setTracking] = useState<EmailTracking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchActivity(), fetchLeads(), fetchEmailTracking()])
      .then(([entries, leadRows, trackingRows]) => {
        setActivity(entries);
        setLeads(leadRows);
        setTracking(trackingRows);
      })
      .catch((error) => showToast(error instanceof Error ? error.message : "Failed to load email logs", "error"))
      .finally(() => setLoading(false));
  }, [showToast]);

  const leadNames = useMemo(
    () => new Map(leads.map((lead) => [lead.id, lead])),
    [leads]
  );
  const logs = activity.filter((entry) => entry.action === "email_sent" || entry.action === "email_failed");
  const sentCount = logs.filter((entry) => entry.action === "email_sent").length;
  const failedCount = logs.length - sentCount;
  const trackingByActivity = useMemo(
    () => new Map(tracking.map((item) => [item.activity_id, item])),
    [tracking]
  );
  const openedCount = tracking.filter((item) => item.opened_at).length;

  return (
    <div>
      <PageHeader title="Email logs" />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3">
        <Summary label="Total attempts" value={logs.length} />
        <Summary label="Sent" value={sentCount} tone="text-success" />
        <Summary label="Failed" value={failedCount} tone="text-danger" />
        <Summary label="Opened" value={openedCount} tone="text-cyan" />
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-panel shadow-sm">
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber border-t-transparent" />
          </div>
        ) : logs.length === 0 ? (
          <p className="px-4 py-14 text-center text-xs text-ink-dim">No email activity has been logged yet.</p>
        ) : (
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-border bg-row/80 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-dim">
                <th className="px-4 py-3">Status</th>
                <th className="px-3 py-3">Lead</th>
                <th className="px-3 py-3">Email</th>
                <th className="px-3 py-3">Open status</th>
                <th className="px-3 py-3">Details</th>
                <th className="px-3 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((entry) => {
                const lead = leadNames.get(entry.lead_id);
                const sent = entry.action === "email_sent";
                const open = trackingByActivity.get(entry.id);
                return (
                  <tr key={entry.id} className="border-b border-border/70 last:border-0">
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1.5 text-xs font-semibold ${sent ? "text-success" : "text-danger"}`}>
                        {sent ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                        {sent ? "Sent" : "Failed"}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-medium text-ink">{lead?.name || "Deleted lead"}</td>
                    <td className="px-3 py-3 text-xs text-ink-dim">{lead?.email || "—"}</td>
                    <td className={`px-3 py-3 text-xs font-semibold ${open?.opened_at ? "text-success" : "text-ink-dim"}`}>
                      {sent ? (open?.opened_at ? `Opened (${open.open_count})` : "Not opened") : "—"}
                    </td>
                    <td className="max-w-[260px] truncate px-3 py-3 text-xs text-ink-dim">{entry.detail || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs text-ink-dim">{new Date(entry.created_at).toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Summary({ label, value, tone = "text-ink" }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-xl border border-border bg-panel px-4 py-3 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-dim">{label}</p>
      <p className={`mt-1 font-display text-xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}
