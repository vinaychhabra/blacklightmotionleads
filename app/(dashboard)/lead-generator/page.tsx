"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BrainCircuit, CheckCircle2, Database, Filter, Loader2, Sparkles, Zap } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/components/toast-provider";
import { supabase } from "@/lib/supabase/client";
import type { Lead } from "@/lib/supabase/types";
import type { BusinessLeadRecord, LeadGenerationCampaign } from "@/lib/lead-generator/types";

const defaultForm = {
  businessCategory: "Property Dealers",
  location: "Gurgaon",
  keywords: "Property Dealer, Real Estate, Property Consultant, Builder",
  leadCount: 50,
  minimumRating: 3.5,
  websiteRequired: true,
  phoneRequired: true,
  emailRequired: false,
  socialOnly: false,
  leadQuality: "Any",
};

export default function LeadGeneratorPage() {
  const { showToast } = useToast();
  const [filters, setFilters] = useState(defaultForm);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [queries, setQueries] = useState<string[]>([]);
  const [leads, setLeads] = useState<BusinessLeadRecord[]>([]);
  const [campaign, setCampaign] = useState<LeadGenerationCampaign | null>(null);
  const [activeTab, setActiveTab] = useState<"generate" | "scraped" | "campaigns">("generate");
  const [integrationError, setIntegrationError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading) return;
    const steps = [15, 36, 60, 82, 100];
    let index = 0;
    const timer = setInterval(() => {
      index += 1;
      setProgress(steps[Math.min(index, steps.length - 1)] ?? 100);
      if (index >= steps.length) clearInterval(timer);
    }, 350);
    return () => clearInterval(timer);
  }, [isLoading]);

  function dedupeScrapedRows(rows: Array<Record<string, any>>) {
    const seen = new Set<string>();

    return rows.filter((row) => {
      const candidate = String(
        row.external_place_id ||
          row.website ||
          row.phone ||
          row.email ||
          `${row.company_name || "unknown"}-${row.city || "unknown"}` ||
          ""
      ).trim().toLowerCase();

      if (!candidate) return true;
      if (seen.has(candidate)) return false;
      seen.add(candidate);
      return true;
    });
  }

  async function handleGenerate() {
    setIsLoading(true);
    setProgress(5);
    try {
      const response = await fetch("/api/lead-generator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...filters,
          keywords: filters.keywords.split(",").map((item) => item.trim()).filter(Boolean),
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        const message = result?.message || "Failed to generate leads";
        setIntegrationError(message);
        showToast(message, "error");
        throw new Error(message);
      }

      setIntegrationError(null);
      const nextLeads = Array.isArray(result.leads) ? result.leads : [];
      setQueries(result.queries || []);
      setLeads(nextLeads);
      setCampaign(result.campaign || null);

      if (nextLeads.length > 0) {
        try {
          const campaignId = result.campaign?.id || null;
          const hotCount = nextLeads.filter((lead: BusinessLeadRecord) => lead.lead_temperature === "HOT").length;
          const warmCount = nextLeads.filter((lead: BusinessLeadRecord) => lead.lead_temperature === "WARM").length;
          const coldCount = nextLeads.filter((lead: BusinessLeadRecord) => lead.lead_temperature === "COLD").length;

          if (campaignId) {
            const { error: campaignError } = await supabase.from("lead_generation_campaigns").upsert({
              id: campaignId,
              name: result.campaign?.name || `${filters.location} ${filters.businessCategory}`,
              category: result.campaign?.category || filters.businessCategory,
              location: result.campaign?.location || filters.location,
              keywords: result.campaign?.keywords || filters.keywords.split(",").map((item) => item.trim()).filter(Boolean),
              requested_leads: result.campaign?.requestedLeads || filters.leadCount,
              queries_generated: result.campaign?.queriesGenerated || result.queries?.length || 0,
              businesses_discovered: result.campaign?.businessesDiscovered || nextLeads.length,
              duplicates_removed: result.campaign?.duplicatesRemoved || 0,
              unique_leads: result.campaign?.uniqueLeads || nextLeads.length,
              websites_enriched: result.campaign?.websitesEnriched || nextLeads.filter((lead: BusinessLeadRecord) => Boolean(lead.website)).length,
              emails_found: result.campaign?.emailsFound || nextLeads.filter((lead: BusinessLeadRecord) => Boolean(lead.email)).length,
              hot_count: result.campaign?.hotCount || hotCount,
              warm_count: result.campaign?.warmCount || warmCount,
              cold_count: result.campaign?.coldCount || coldCount,
              status: result.campaign?.status || "completed",
              created_at: result.campaign?.createdAt || new Date().toISOString(),
              metadata: {
                source: "AI Lead Generator",
                filters: {
                  businessCategory: filters.businessCategory,
                  location: filters.location,
                  keywords: filters.keywords,
                },
              },
            }, { onConflict: "id" });

            if (campaignError) {
              console.error("campaign insert failed", campaignError);
            }
          }

          const rows = nextLeads.map((lead: BusinessLeadRecord) => ({
            campaign_id: campaignId,
            company_name: lead.company_name,
            business_category: lead.business_category,
            description: lead.description,
            phone: lead.phone,
            email: lead.email,
            website: lead.website,
            address: lead.address,
            city: lead.city,
            state: lead.state,
            country: lead.country,
            postal_code: lead.postal_code,
            rating: lead.rating,
            review_count: lead.review_count,
            facebook_url: lead.facebook_url,
            instagram_url: lead.instagram_url,
            linkedin_url: lead.linkedin_url,
            youtube_url: lead.youtube_url,
            source: lead.source,
            source_url: lead.source_url,
            external_place_id: lead.external_place_id,
            lead_score: lead.lead_score,
            lead_temperature: lead.lead_temperature,
            ai_relevance: lead.ai_relevance,
            ai_reason: lead.ai_reason,
            enrichment_status: lead.enrichment_status || "DISCOVERED",
            review_status: "PENDING",
            notes: lead.notes,
            tags: lead.tags || [lead.business_category],
          }));

          const uniqueRows = dedupeScrapedRows(rows);

          if (uniqueRows.length === 0) {
            return;
          }

          const { error } = await supabase.from("scraped_leads").upsert(uniqueRows, { onConflict: "external_place_id" });
          if (error) {
            console.error("scraped lead insert failed", {
              code: error.code,
              message: error.message,
              details: error.details,
              hint: error.hint,
            });
            const reason = error?.message || "The insert is being rejected by Supabase.";
            const message = `Scraped leads were generated, but the save failed: ${reason}. Check for duplicate values, confirm the migration is active, and make sure the logged-in user is allowed to insert into scraped_leads.`;
            setIntegrationError(message);
            showToast(message, "error");
          }
        } catch (insertError: any) {
          console.error("scraped lead insert exception", insertError);
          const message = insertError?.message || "Could not save scraped leads to Supabase.";
          setIntegrationError(message);
          showToast(message, "error");
        }
      }
    } catch (error: any) {
      console.error(error);
      const message = error?.message || "Could not generate leads";
      setIntegrationError(message);
      showToast(message, "error");
    } finally {
      setIsLoading(false);
      setProgress(100);
    }
  }

  async function approveLead(leadId: string) {
    const match = leads.find((lead) => lead.id === leadId);
    if (!match) return;

    const existing = await supabase.from("leads").select("id, phone, email, website, name");
    const list = existing.data ?? [] as Lead[];
    const normalized = (value: string | null) => (value || "").replace(/\s+/g, "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    const duplicate = list.some((item) => {
      if (match.external_place_id && (item as any).external_place_id === match.external_place_id) return true;
      if (match.phone && normalized(item.phone) && normalized(item.phone) === normalized(match.phone)) return true;
      if (match.email && normalized(item.email) && normalized(item.email) === normalized(match.email)) return true;
      if (match.website && item.website && normalized(item.website) === normalized(match.website)) return true;
      return item.name && match.company_name && normalized(item.name) === normalized(match.company_name);
    });

    if (duplicate) {
      await supabase.from("scraped_leads").update({ review_status: "DUPLICATE" }).eq("external_place_id", match.external_place_id || leadId);
      return;
    }

    const { error } = await supabase.from("leads").insert({
      name: match.company_name,
      company_name: match.company_name,
      business_category: match.business_category,
      description: match.description,
      phone: match.phone,
      email: match.email,
      website: match.website,
      city: match.city,
      state: match.state,
      country: match.country,
      source: "AI Lead Generator",
      source_url: match.source_url,
      lead_score: match.lead_score,
      lead_temperature: match.lead_temperature,
      status: "New",
      priority: "Warm",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      notes: match.notes,
    });

    if (!error) {
      await supabase.from("scraped_leads").update({ review_status: "IMPORTED" }).eq("external_place_id", match.external_place_id || leadId);
      setLeads((prev) => prev.filter((lead) => lead.id !== leadId));
    }
  }

  const stats = useMemo(() => ({
    hot: leads.filter((lead) => lead.lead_temperature === "HOT").length,
    warm: leads.filter((lead) => lead.lead_temperature === "WARM").length,
    cold: leads.filter((lead) => lead.lead_temperature === "COLD").length,
  }), [leads]);

  return (
    <div className="space-y-6">
      <PageHeader title="AI Lead Generator" subtitle="Discover, score, and stage relevant businesses without polluting the active sales pipeline." />

      {integrationError && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-100">
          <div className="font-medium">Integration required</div>
          <div className="mt-1 text-xs text-red-100/90">{integrationError}</div>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <div className="soft-card rounded-xl p-3.5">
          <div className="text-[9.5px] uppercase tracking-[0.18em] text-ink-dim">Scraped Leads</div>
          <div className="mt-2 font-display text-xl font-bold text-ink md:text-2xl">{leads.length}</div>
        </div>
        <div className="soft-card rounded-xl p-3.5">
          <div className="text-[9.5px] uppercase tracking-[0.18em] text-ink-dim">HOT Leads</div>
          <div className="mt-2 font-display text-xl font-bold text-ink md:text-2xl">{stats.hot}</div>
        </div>
        <div className="soft-card rounded-xl p-3.5">
          <div className="text-[9.5px] uppercase tracking-[0.18em] text-ink-dim">Campaign</div>
          <div className="mt-2 font-display text-xl font-bold text-ink md:text-2xl">{campaign ? "Live" : "Idle"}</div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-panel p-2">
        <div className="flex flex-wrap gap-2">
          {[
            { key: "generate", label: "Generate Leads", icon: Sparkles },
            { key: "scraped", label: "Scraped Leads", icon: Database },
            { key: "campaigns", label: "Campaigns", icon: BrainCircuit },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as any)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium ${
                activeTab === key ? "border-amber bg-amber/10 text-ink" : "border-border text-ink-dim"
              }`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "generate" && (
        <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
          <div className="soft-card rounded-xl p-4">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink"><Filter size={15} /> Lead generation settings</div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-xs text-ink-dim">
                Business Category
                <input value={filters.businessCategory} onChange={(e) => setFilters((p) => ({ ...p, businessCategory: e.target.value }))} className="mt-1 w-full rounded-lg border border-border bg-row p-2 text-sm text-ink" />
              </label>
              <label className="text-xs text-ink-dim">
                Location
                <input value={filters.location} onChange={(e) => setFilters((p) => ({ ...p, location: e.target.value }))} className="mt-1 w-full rounded-lg border border-border bg-row p-2 text-sm text-ink" />
              </label>
              <label className="text-xs text-ink-dim md:col-span-2">
                Keywords
                <input value={filters.keywords} onChange={(e) => setFilters((p) => ({ ...p, keywords: e.target.value }))} className="mt-1 w-full rounded-lg border border-border bg-row p-2 text-sm text-ink" />
              </label>
              <label className="text-xs text-ink-dim">
                Number of Leads
                <input type="number" value={filters.leadCount} onChange={(e) => setFilters((p) => ({ ...p, leadCount: Number(e.target.value || 0) }))} className="mt-1 w-full rounded-lg border border-border bg-row p-2 text-sm text-ink" />
              </label>
              <label className="text-xs text-ink-dim">
                Minimum Rating
                <input type="number" step="0.1" value={filters.minimumRating} onChange={(e) => setFilters((p) => ({ ...p, minimumRating: Number(e.target.value || 0) }))} className="mt-1 w-full rounded-lg border border-border bg-row p-2 text-sm text-ink" />
              </label>
              <label className="text-xs text-ink-dim">
                Lead Quality
                <select value={filters.leadQuality} onChange={(e) => setFilters((p) => ({ ...p, leadQuality: e.target.value as any }))} className="mt-1 w-full rounded-lg border border-border bg-row p-2 text-sm text-ink">
                  <option value="Any">Any</option>
                  <option value="HOT">HOT</option>
                  <option value="WARM">WARM</option>
                </select>
              </label>
              <label className="text-xs text-ink-dim">
                Radius (km)
                <input type="number" value={25} readOnly className="mt-1 w-full rounded-lg border border-border bg-row p-2 text-sm text-ink opacity-75" />
              </label>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {[
                { key: "websiteRequired", label: "Website required" },
                { key: "phoneRequired", label: "Phone required" },
                { key: "emailRequired", label: "Email required" },
                { key: "socialOnly", label: "Only businesses with social" },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 rounded-lg border border-border bg-row px-3 py-2 text-xs text-ink-dim">
                  <input type="checkbox" checked={(filters as any)[key]} onChange={(e) => setFilters((p) => ({ ...p, [key]: e.target.checked } as any))} />
                  {label}
                </label>
              ))}
            </div>

            <button
              onClick={handleGenerate}
              disabled={isLoading}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-amber to-cyan px-4 py-3 text-sm font-semibold text-black disabled:opacity-70"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              {isLoading ? "Generating leads..." : "🚀 Generate Leads"}
            </button>
          </div>

          <div className="soft-card rounded-xl p-4">
            <div className="mb-4 flex items-center justify-between text-sm font-semibold text-ink">
              <span>Live progress</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-row">
              <div className="h-full rounded-full bg-gradient-to-r from-amber to-cyan" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-4 space-y-3 text-xs text-ink-dim">
              <div className="flex items-center gap-2"><CheckCircle2 size={14} className="text-success" /> Generating search queries...</div>
              <div className="flex items-center gap-2"><CheckCircle2 size={14} className="text-success" /> Searching for businesses...</div>
              <div className="flex items-center gap-2"><CheckCircle2 size={14} className="text-success" /> Deduplicating results...</div>
              <div className="flex items-center gap-2"><CheckCircle2 size={14} className="text-success" /> Scoring lead quality...</div>
            </div>
            {queries.length > 0 && (
              <div className="mt-6">
                <div className="mb-2 text-[10px] uppercase tracking-[0.2em] text-ink-dim">Generated Queries</div>
                <div className="space-y-1.5 text-xs text-ink-dim">
                  {queries.slice(0, 5).map((query) => (
                    <div key={query} className="rounded bg-row px-2 py-1.5">{query}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "scraped" && (
        <div className="soft-card rounded-xl p-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="font-display text-base font-bold text-ink">Scraped leads</div>
            <button onClick={() => setActiveTab("generate")} className="rounded-lg border border-border px-3 py-1.5 text-xs text-ink-dim">Refresh</button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-[10px] uppercase tracking-wide text-ink-dim">
                  <th className="px-3 py-2">Company</th>
                  <th className="px-3 py-2">City</th>
                  <th className="px-3 py-2">Phone</th>
                  <th className="px-3 py-2">Score</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {leads.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-xs text-ink-dim">No scraped leads yet. Generate a campaign to populate this table.</td>
                  </tr>
                ) : (
                  leads.map((lead) => (
                    <tr key={lead.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-3">
                        <div className="font-medium text-ink">{lead.company_name}</div>
                        <div className="text-[11px] text-ink-dim">{lead.business_category}</div>
                      </td>
                      <td className="px-3 py-3 text-ink-dim">{lead.city || "—"}</td>
                      <td className="px-3 py-3 text-ink-dim">{lead.phone || "—"}</td>
                      <td className="px-3 py-3">
                        <span className="rounded-full bg-amber/10 px-2 py-1 text-[11px] font-semibold text-amber">{lead.lead_score}</span>
                      </td>
                      <td className="px-3 py-3 text-ink-dim">{lead.lead_temperature}</td>
                      <td className="px-3 py-3">
                        <button onClick={() => approveLead(lead.id)} className="rounded-lg bg-success/15 px-2.5 py-1.5 text-xs font-semibold text-success">Approve</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "campaigns" && (
        <div className="soft-card rounded-xl p-4">
          <div className="font-display text-base font-bold text-ink">Campaign overview</div>
          {campaign ? (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-border bg-row p-4">
                <div className="text-[10px] uppercase tracking-[0.2em] text-ink-dim">Campaign</div>
                <div className="mt-2 text-lg font-semibold text-ink">{campaign.name}</div>
                <div className="mt-2 text-xs text-ink-dim">{campaign.category} · {campaign.location}</div>
              </div>
              <div className="rounded-lg border border-border bg-row p-4">
                <div className="text-[10px] uppercase tracking-[0.2em] text-ink-dim">Lead mix</div>
                <div className="mt-2 flex gap-2 text-xs">
                  <span className="rounded-full bg-danger/10 px-2 py-1 text-danger">HOT {campaign.hotCount}</span>
                  <span className="rounded-full bg-amber/10 px-2 py-1 text-amber">WARM {campaign.warmCount}</span>
                  <span className="rounded-full bg-cyan/10 px-2 py-1 text-cyan">COLD {campaign.coldCount}</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-xs text-ink-dim">No campaign is running yet. Create one with the generator form.</p>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-ink-dim">
        <ArrowRight size={14} />
        MVP status: discovery, scoring, deduplication, staging and approval workflow are active.
      </div>
    </div>
  );
}
