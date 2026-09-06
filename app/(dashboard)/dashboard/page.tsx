"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarClock,
  CircleAlert,
  Goal,
  TrendingUp,
} from "lucide-react";
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

  const adminPriorityCards = useMemo(() => {
    const hotPipeline = leads.filter(
      (lead) => lead.priority === "Hot" && lead.status !== "Converted" && lead.status !== "Client Denied"
    );
    const urgentFollowUps = leads.filter((lead) => {
      if (!lead.follow_up_date) return lead.status === "Follow-up";
      const dueDate = new Date(`${lead.follow_up_date}T00:00:00`);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return dueDate <= today;
    });
    const noResponse = leads.filter((lead) => lead.status === "No Response");
    const interested = leads.filter((lead) => lead.status === "Interested");

    return [
      {
        label: "Hot pipeline",
        value: hotPipeline.length,
        meta: `${formatINR(hotPipeline.reduce((sum, lead) => sum + (Number(lead.deal_value) || 0), 0))} in focus`,
        tone: "amber",
      },
      {
        label: "Urgent follow-ups",
        value: urgentFollowUps.length,
        meta: "Needs action today",
        tone: "cyan",
      },
      {
        label: "No response",
        value: noResponse.length,
        meta: "Potential drop-off risk",
        tone: "danger",
      },
      {
        label: "Interested leads",
        value: interested.length,
        meta: "Strong conversion window",
        tone: "success",
      },
    ];
  }, [leads]);

  const followUpQueue = useMemo(() => {
    return [...leads]
      .filter((lead) => lead.status === "Follow-up" || (lead.follow_up_date && new Date(`${lead.follow_up_date}T00:00:00`) <= new Date(new Date().setHours(0, 0, 0, 0))))
      .sort((a, b) => {
        const aDate = a.follow_up_date ? new Date(`${a.follow_up_date}T00:00:00`).getTime() : Number.MAX_SAFE_INTEGER;
        const bDate = b.follow_up_date ? new Date(`${b.follow_up_date}T00:00:00`).getTime() : Number.MAX_SAFE_INTEGER;
        return aDate - bDate;
      })
      .slice(0, 5);
  }, [leads]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dashboard"
        subtitle="A focused admin snapshot of lead flow, revenue, and the work that needs attention today."
      />

      <div className="grid gap-4 xl:grid-cols-[1.6fr_0.9fr]">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
            <StatCard value={stats.totalLeads} label="Total Leads" accent />
            <StatCard value={formatINR(stats.pipelineValue)} label="Open Pipeline" accent />
            <StatCard value={formatINR(stats.wonValue)} label="Won Value" />
            <StatCard value={stats.dueTodayCount} label="Due Today" />
            <StatCard value={stats.contactedCount} label="Contacted" />
            <StatCard value={stats.convertedCount} label="Converted" />
            <StatCard value={`${stats.responseRate}%`} label="Contact Rate" />
            <StatCard value={`${stats.conversionRate}%`} label="Conversion Rate" />
          </div>

          <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
            {adminPriorityCards.map((card) => (
              <div
                key={card.label}
                className="soft-card rounded-xl p-3.5"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[9.5px] uppercase tracking-[0.18em] text-ink-dim">{card.label}</span>
                  <span
                    className={`h-2 w-2 rounded-full ${
                      card.tone === "amber"
                        ? "bg-amber"
                        : card.tone === "cyan"
                          ? "bg-cyan"
                          : card.tone === "danger"
                            ? "bg-danger"
                            : "bg-success"
                    }`}
                  />
                </div>
                <div className="font-display text-xl font-bold text-ink">{card.value}</div>
                <div className="mt-1.5 text-[10.5px] text-ink-dim">{card.meta}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <BreakdownSection title="Leads by Status" rows={statusRows} />
            <BreakdownSection title="Leads by Priority" rows={priorityRows} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <BreakdownSection title="Leads by City" rows={cityRows} />
            <BreakdownSection title="Leads by Source" rows={sourceRows} />
          </div>

          {lostReasonRows.length > 0 && (
            <div className="rounded-xl border border-border bg-panel/80 p-3.5 shadow-sm">
              <BreakdownSection title="Why Deals Were Lost" rows={lostReasonRows} />
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="soft-card rounded-xl p-3.5">
            <div className="mb-2.5 flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-ink">Admin priorities</h3>
              <Goal className="h-4 w-4 text-amber" />
            </div>
            <div className="space-y-2.5">
              <a href="/leads" className="flex items-center justify-between rounded-lg border border-border bg-row/80 px-2.5 py-2 text-sm text-ink transition-colors hover:border-amber/70 hover:bg-amber/5">
                <span className="flex items-center gap-2"><BriefcaseBusiness size={14} className="text-cyan" /> Review active leads</span>
                <ArrowRight size={14} />
              </a>
              <a href="/followups" className="flex items-center justify-between rounded-lg border border-border bg-row/80 px-2.5 py-2 text-sm text-ink transition-colors hover:border-amber/70 hover:bg-amber/5">
                <span className="flex items-center gap-2"><CalendarClock size={14} className="text-amber" /> Follow-up queue</span>
                <ArrowRight size={14} />
              </a>
              <a href="/settings" className="flex items-center justify-between rounded-lg border border-border bg-row/80 px-2.5 py-2 text-sm text-ink transition-colors hover:border-amber/70 hover:bg-amber/5">
                <span className="flex items-center gap-2"><TrendingUp size={14} className="text-success" /> Sales settings</span>
                <ArrowRight size={14} />
              </a>
            </div>
          </div>

          <div className="soft-card rounded-xl p-3.5">
            <div className="mb-2.5 flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-ink">Urgent follow-ups</h3>
              <CircleAlert className="h-4 w-4 text-danger" />
            </div>
            {followUpQueue.length === 0 ? (
              <p className="text-xs text-ink-dim">No follow-ups overdue right now.</p>
            ) : (
              <div className="space-y-2">
                {followUpQueue.map((lead) => (
                  <div key={lead.id} className="rounded-lg border border-border bg-row px-2.5 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="truncate text-sm font-medium text-ink">{lead.name}</div>
                      <span className="rounded-full bg-danger/10 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-danger">
                        {lead.priority}
                      </span>
                    </div>
                    <div className="mt-1 text-[10.5px] text-ink-dim">
                      {lead.follow_up_date ? new Date(`${lead.follow_up_date}T00:00:00`).toLocaleDateString() : "Needs follow-up"} · {lead.status}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-panel p-3.5">
            <h3 className="mb-2.5 font-display text-sm font-bold text-ink">Recent activity</h3>
            {recentActivity.length === 0 ? (
              <p className="text-xs text-ink-dim">No activity logged yet.</p>
            ) : (
              <div className="space-y-2">
                {recentActivity.slice(0, 6).map((a) => (
                  <div key={a.id} className="rounded-lg border border-border bg-row px-2.5 py-2">
                    <div className="font-mono text-[9.5px] uppercase tracking-wide text-ink-dim">
                      {new Date(a.created_at).toLocaleString()}
                    </div>
                    <div className="mt-1 text-sm text-ink">
                      <span className="font-medium">{a.leadName}</span>
                    </div>
                    <div className="text-[10.5px] text-ink-dim">
                      {a.action}
                      {a.detail ? ` · ${a.detail}` : ""}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
