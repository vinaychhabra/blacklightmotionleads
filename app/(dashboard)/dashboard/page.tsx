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
        meta: "High-priority opportunities",
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
        subtitle="A clean view of pipeline health, priority work, and the actions that need attention today."
      />

      <div className="glass-surface rounded-xl p-3.5">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-dim">Executive overview</p>
            <h2 className="mt-1 font-display text-xl font-bold text-ink">Sales performance at a glance</h2>
          </div>
          <div className="glass-tile inline-flex items-center gap-2 rounded-full px-2.5 py-1.5 text-[10px] font-medium text-ink-dim">
            <span className="h-2 w-2 rounded-full bg-success" />
            {stats.dueTodayCount} actions due today
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StatCard value={stats.totalLeads} label="Total Leads" accent />
          <StatCard value={`${stats.conversionRate}%`} label="Conversion Rate" />
          <StatCard value={stats.contactedCount} label="Contacted Leads" />
          <StatCard value={stats.dueTodayCount} label="Due Today" />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <BreakdownSection title="Leads by Status" rows={statusRows} />
            <BreakdownSection title="Leads by Priority" rows={priorityRows} />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <BreakdownSection title="Leads by City" rows={cityRows} />
            <BreakdownSection title="Leads by Source" rows={sourceRows} />
          </div>

          {lostReasonRows.length > 0 && (
            <BreakdownSection title="Why deals were lost" rows={lostReasonRows} />
          )}
        </div>

        <aside className="space-y-4">
          <div className="glass-surface rounded-xl p-3.5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-ink">Daily focus</h3>
              <Goal className="h-4 w-4 text-amber" />
            </div>
            <div className="space-y-2.5">
              {adminPriorityCards.map((card) => (
                <div key={card.label} className="glass-tile rounded-lg px-3 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] uppercase tracking-[0.14em] text-ink-dim">{card.label}</span>
                    <span className={`h-2.5 w-2.5 rounded-full ${
                      card.tone === "amber"
                        ? "bg-amber"
                        : card.tone === "cyan"
                          ? "bg-cyan"
                          : card.tone === "danger"
                            ? "bg-danger"
                            : "bg-success"
                    }`} />
                  </div>
                  <div className="mt-1.5 text-lg font-bold text-ink">{card.value}</div>
                  <div className="mt-0.5 text-[10.5px] text-ink-dim">{card.meta}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-surface rounded-xl p-3.5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-ink">Urgent follow-ups</h3>
              <CircleAlert className="h-4 w-4 text-danger" />
            </div>
            {followUpQueue.length === 0 ? (
              <p className="text-xs text-ink-dim">No follow-ups overdue right now.</p>
            ) : (
              <div className="space-y-2.5">
                {followUpQueue.map((lead) => (
                  <div key={lead.id} className="glass-tile rounded-lg px-3 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="truncate text-sm font-medium text-ink">{lead.name}</div>
                      <span className="rounded-full bg-danger/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-danger">
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

          <div className="glass-surface rounded-xl p-3.5">
            <h3 className="mb-3 font-display text-sm font-bold text-ink">Recent activity</h3>
            {recentActivity.length === 0 ? (
              <p className="text-xs text-ink-dim">No activity logged yet.</p>
            ) : (
              <div className="space-y-2.5">
                {recentActivity.slice(0, 5).map((a) => (
                  <div key={a.id} className="glass-tile rounded-lg px-3 py-2.5">
                    <div className="font-mono text-[9.5px] uppercase tracking-wide text-ink-dim">
                      {new Date(a.created_at).toLocaleString()}
                    </div>
                    <div className="mt-1 text-sm text-ink">{a.leadName}</div>
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
