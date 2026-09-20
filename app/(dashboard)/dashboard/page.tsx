"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarClock,
  CircleAlert,
  Goal,
  MessageSquareText,
  Sparkles,
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

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-dim">Performance snapshot</h2>
          {stats.dueTodayCount > 0 && (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-danger/10 px-2.5 py-1 text-[11px] font-medium text-danger">
              <span className="h-1.5 w-1.5 rounded-full bg-danger" />
              {stats.dueTodayCount} action{stats.dueTodayCount === 1 ? "" : "s"} due today
            </div>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StatCard value={stats.totalLeads} label="Total Leads" icon={BriefcaseBusiness} accent />
          <StatCard value={`${stats.conversionRate}%`} label="Conversion Rate" icon={TrendingUp} />
          <StatCard value={stats.contactedCount} label="Contacted Leads" icon={MessageSquareText} />
          <StatCard value={stats.dueTodayCount} label="Due Today" icon={CalendarClock} />
        </div>
      </div>

      {stats.totalLeads === 0 ? (
        <div className="panel-surface flex flex-col items-center rounded-xl px-6 py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber/15">
            <Sparkles className="h-5 w-5 text-amber" />
          </div>
          <h3 className="mt-4 font-display text-lg font-bold text-ink">No leads yet</h3>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-dim">
            Generate a fresh batch of leads with AI, or add one manually to start tracking your pipeline.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/lead-generator"
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber to-cyan px-4 py-2 text-xs font-semibold text-black"
            >
              Generate leads with AI
              <ArrowRight size={14} />
            </Link>
            <Link
              href="/leads"
              className="flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-xs font-medium text-ink-dim hover:text-ink"
            >
              Add a lead manually
            </Link>
          </div>
        </div>
      ) : (
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
            <div className="panel-surface rounded-xl p-4">
              <div className="mb-3.5 flex items-center justify-between">
                <h3 className="font-display text-sm font-semibold text-ink">Priority queue</h3>
                <Goal className="h-4 w-4 text-ink-dim" />
              </div>
              <div className="space-y-2">
                {adminPriorityCards.map((card) => (
                  <div key={card.label} className="flex items-center justify-between gap-3 rounded-lg bg-row px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${
                        card.tone === "amber"
                          ? "bg-amber"
                          : card.tone === "cyan"
                            ? "bg-cyan"
                            : card.tone === "danger"
                              ? "bg-danger"
                              : "bg-success"
                      }`} />
                      <div>
                        <div className="text-[12.5px] font-medium text-ink">{card.label}</div>
                        <div className="text-[10.5px] text-ink-dim">{card.meta}</div>
                      </div>
                    </div>
                    <div className="text-lg font-bold text-ink">{card.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel-surface rounded-xl p-4">
              <div className="mb-3.5 flex items-center justify-between">
                <h3 className="font-display text-sm font-semibold text-ink">Urgent follow-ups</h3>
                <CircleAlert className="h-4 w-4 text-danger" />
              </div>
              {followUpQueue.length === 0 ? (
                <p className="text-xs text-ink-dim">No follow-ups overdue right now.</p>
              ) : (
                <div className="space-y-2">
                  {followUpQueue.map((lead) => (
                    <div key={lead.id} className="rounded-lg bg-row px-3 py-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="truncate text-[13px] font-medium text-ink">{lead.name}</div>
                        <span className="rounded-full bg-danger/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-danger">
                          {lead.priority}
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] text-ink-dim">
                        {lead.follow_up_date ? new Date(`${lead.follow_up_date}T00:00:00`).toLocaleDateString() : "Needs follow-up"} · {lead.status}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="panel-surface rounded-xl p-4">
              <h3 className="mb-3.5 font-display text-sm font-semibold text-ink">Recent activity</h3>
              {recentActivity.length === 0 ? (
                <p className="text-xs text-ink-dim">No activity logged yet.</p>
              ) : (
                <div className="space-y-2">
                  {recentActivity.slice(0, 5).map((a) => (
                    <div key={a.id} className="rounded-lg bg-row px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="truncate text-[13px] text-ink">{a.leadName}</div>
                        <div className="shrink-0 text-[10px] text-ink-dim">
                          {new Date(a.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </div>
                      </div>
                      <div className="text-[11px] text-ink-dim">
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
      )}
    </div>
  );
}
