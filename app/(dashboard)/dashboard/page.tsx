"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { BreakdownSection } from "@/components/breakdown-bar";
import { fetchLeads, fetchActivity } from "@/lib/supabase/queries";
import { formatINR } from "@/lib/messaging";
import { STATUSES, PRIORITIES } from "@/lib/supabase/types";
import type { Lead, ActivityLogEntry } from "@/lib/supabase/types";
import { useToast } from "@/components/toast-provider";

export default function DashboardPage() {
  const { showToast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [activity, setActivity] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchLeads(), fetchActivity()])
      .then(([l, a]) => {
        setLeads(l);
        setActivity(a);
      })
      .catch((err) => showToast(err.message || "Failed to load dashboard", "error"))
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const totalLeads = leads.length;
    const contactedCount = leads.filter((l) => l.status !== "New").length;
    const convertedCount = leads.filter((l) => l.status === "Converted").length;
    const deniedCount = leads.filter((l) => l.status === "Client Denied").length;
    const waSentTotal = activity.filter((a) => a.action === "whatsapp_sent").length;
    const emailSentTotal = activity.filter((a) => a.action === "email_sent").length;
    const conversionRate = totalLeads ? ((convertedCount / totalLeads) * 100).toFixed(1) : "0.0";
    const responseRate = totalLeads ? ((contactedCount / totalLeads) * 100).toFixed(1) : "0.0";
    const pipelineValue = leads
      .filter((l) => l.status !== "Converted" && l.status !== "Client Denied")
      .reduce((sum, l) => sum + (Number(l.deal_value) || 0), 0);
    const wonValue = leads
      .filter((l) => l.status === "Converted")
      .reduce((sum, l) => sum + (Number(l.deal_value) || 0), 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueTodayCount = leads.filter(
      (l) => l.follow_up_date && new Date(l.follow_up_date + "T00:00:00") <= today
    ).length;

    return {
      totalLeads,
      contactedCount,
      convertedCount,
      deniedCount,
      waSentTotal,
      emailSentTotal,
      conversionRate,
      responseRate,
      pipelineValue,
      wonValue,
      dueTodayCount,
    };
  }, [leads, activity]);

  const statusRows = useMemo(
    () => STATUSES.map((s) => ({ label: s, count: leads.filter((l) => l.status === s).length })),
    [leads]
  );

  const priorityRows = useMemo(
    () => PRIORITIES.map((p) => ({ label: p, count: leads.filter((l) => l.priority === p).length })),
    [leads]
  );

  const cityRows = useMemo(() => {
    const counts: Record<string, number> = {};
    leads.forEach((l) => { if (l.city) counts[l.city] = (counts[l.city] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, count]) => ({ label, count }));
  }, [leads]);

  const sourceRows = useMemo(() => {
    const counts: Record<string, number> = {};
    leads.forEach((l) => { if (l.source) counts[l.source] = (counts[l.source] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, count]) => ({ label, count }));
  }, [leads]);

  const lostReasonRows = useMemo(() => {
    const counts: Record<string, number> = {};
    leads
      .filter((l) => l.status === "Client Denied" && l.lost_reason)
      .forEach((l) => { counts[l.lost_reason!] = (counts[l.lost_reason!] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count }));
  }, [leads]);

  const recentActivity = useMemo(() => {
    return [...activity]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 15)
      .map((a) => ({ ...a, leadName: leads.find((l) => l.id === a.lead_id)?.name || "Unknown lead" }));
  }, [activity, leads]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Pipeline value, conversion rate, and activity at a glance." />

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard value={stats.totalLeads} label="Total Leads" accent />
        <StatCard value={formatINR(stats.pipelineValue)} label="Open Pipeline Value" accent />
        <StatCard value={formatINR(stats.wonValue)} label="Won Value" />
        <StatCard value={stats.dueTodayCount} label="Follow-ups Due" />
        <StatCard value={stats.contactedCount} label="Contacted" />
        <StatCard value={stats.convertedCount} label="Converted" />
        <StatCard value={stats.deniedCount} label="Client Denied" />
        <StatCard value={stats.waSentTotal} label="WhatsApp Sent" />
        <StatCard value={stats.emailSentTotal} label="Emails Sent" />
        <StatCard value={`${stats.responseRate}%`} label="Contact Rate" />
        <StatCard value={`${stats.conversionRate}%`} label="Conversion Rate" />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div>
          <BreakdownSection title="Leads by Status" rows={statusRows} />
          <BreakdownSection title="Leads by Priority" rows={priorityRows} />
          {lostReasonRows.length > 0 && <BreakdownSection title="Why Deals Were Lost" rows={lostReasonRows} />}
        </div>
        <div>
          <BreakdownSection title="Leads by City" rows={cityRows} />
          <BreakdownSection title="Leads by Source" rows={sourceRows} />

          <div>
            <h3 className="mb-3 font-display text-sm font-bold text-ink">Recent Activity</h3>
            {recentActivity.length === 0 ? (
              <p className="text-xs text-ink-dim">No activity logged yet.</p>
            ) : (
              <div className="space-y-1.5 rounded-xl border border-border bg-panel p-3">
                {recentActivity.map((a) => (
                  <div key={a.id} className="font-mono text-[11px] text-ink-dim">
                    {new Date(a.created_at).toLocaleString()} —{" "}
                    <span className="font-sans font-medium text-ink">{a.leadName}</span> — {a.action}
                    {a.detail ? `: ${a.detail}` : ""}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
