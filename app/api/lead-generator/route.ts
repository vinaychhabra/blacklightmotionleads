import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  discoverBusinessLeads,
  enrichBusinessesWithAnthropic,
  enrichLeadsWithWebsiteContacts,
  generateSearchQueries,
  GooglePlacesBusinessSearchProvider,
  OpenStreetMapBusinessSearchProvider,
} from "@/lib/lead-generator/service";
import type { BusinessSearchRequest } from "@/lib/lead-generator/types";

export const maxDuration = 60;

function getProviderSetupError() {
  return "Live lead integration is not configured. Go to Settings → AI & integrations, choose a live provider, and add the required API key before generating leads.";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<BusinessSearchRequest>;

    const payload: BusinessSearchRequest = {
      businessCategory: body.businessCategory || "Property Dealers",
      location: body.location || "Gurgaon",
      keywords: Array.isArray(body.keywords)
        ? body.keywords.filter(Boolean)
        : String(body.keywords || "Property Dealer, Builder, Real Estate")
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
      leadCount: Number(body.leadCount || 50),
      minimumRating: Number(body.minimumRating ?? 0) || 0,
      websiteRequired: Boolean(body.websiteRequired),
      phoneRequired: Boolean(body.phoneRequired),
      emailRequired: Boolean(body.emailRequired),
      socialOnly: Boolean(body.socialOnly),
      leadQuality: (body.leadQuality as any) || "Any",
      radiusKm: Number(body.radiusKm ?? 0) || undefined,
    };

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "https://bmhsjutyqplvwlkuarbr.supabase.co";
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "sb_publishable_5SkqsKU8jNnwKF22Wf1W5A_rA7Ufckm";

    let configuredProvider = (process.env.LEAD_PROVIDER || process.env.NEXT_PUBLIC_LEAD_PROVIDER || "demo").toLowerCase();
    let configuredKey = String(process.env.GOOGLE_PLACES_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY || "").trim();
    let aiProvider = String(process.env.AI_PROVIDER || "").trim().toLowerCase();
    let aiKey = String(process.env.ANTHROPIC_API_KEY || "").trim();
    let emailEnrichmentEnabled = false;

    if (supabaseUrl && supabaseKey) {
      const settingsClient = createClient(supabaseUrl, supabaseKey);
      const { data: settingsRow, error: settingsError } = await settingsClient
        .from("app_settings")
        .select("lead_provider, google_places_api_key, ai_provider, ai_api_key, website_enrichment_enabled, email_enrichment_enabled")
        .eq("id", 1)
        .maybeSingle();

      if (settingsError) {
        return NextResponse.json({
          success: false,
          message: `Could not read lead integration settings: ${settingsError.message}. Run the latest migration and verify Supabase permissions.`,
          code: "SETTINGS_READ_FAILED",
        }, { status: 500 });
      }

      if (settingsRow?.lead_provider) {
        configuredProvider = String(settingsRow.lead_provider).trim().toLowerCase();
      }
      if (settingsRow?.google_places_api_key) {
        configuredKey = String(settingsRow.google_places_api_key).trim();
      }
      if (settingsRow?.ai_provider) aiProvider = String(settingsRow.ai_provider).trim().toLowerCase();
      if (settingsRow?.ai_api_key) aiKey = String(settingsRow.ai_api_key).trim();
      emailEnrichmentEnabled = Boolean(settingsRow?.website_enrichment_enabled || settingsRow?.email_enrichment_enabled);
    }

    const isGooglePlaces = ["google_places", "google-places", "googleplaces"].includes(configuredProvider);
    const isOpenStreetMap = ["openstreetmap", "open_street_map", "osm"].includes(configuredProvider);

    if (!isGooglePlaces && !isOpenStreetMap) {
      return NextResponse.json({
        success: false,
        message: getProviderSetupError(),
        code: "INTEGRATION_REQUIRED",
      }, { status: 400 });
    }

    if (isGooglePlaces && !configuredKey) {
      return NextResponse.json({
        success: false,
        message: "Google Places is selected but no API key was found. Add your Google Places API key in Settings to enable live lead discovery.",
        code: "MISSING_API_KEY",
      }, { status: 400 });
    }

    console.info("Lead generator provider configured", {
      provider: configuredProvider,
      hasGooglePlacesKey: Boolean(configuredKey),
      source: process.env.LEAD_PROVIDER || process.env.NEXT_PUBLIC_LEAD_PROVIDER ? "environment/settings" : "settings",
    });

    const provider = isOpenStreetMap
      ? new OpenStreetMapBusinessSearchProvider()
      : new GooglePlacesBusinessSearchProvider(configuredKey);
    const result = await discoverBusinessLeads(payload, provider);

    let warning: string | null = null;

    let withContacts = result.discovered;
    if (emailEnrichmentEnabled) {
      try {
        withContacts = await enrichLeadsWithWebsiteContacts(result.discovered);
      } catch (error: any) {
        warning = `Website email discovery failed: ${error?.message || "unknown error"}.`;
      }
    }

    let enriched = withContacts;
    if (aiProvider === "anthropic" && aiKey) {
      try {
        enriched = await enrichBusinessesWithAnthropic(withContacts, aiKey, payload.businessCategory, payload.location);
      } catch (error: any) {
        warning = `Claude lead qualification failed, showing unqualified results: ${error?.message || "unknown error"}.`;
      }
    }

    return NextResponse.json({
      success: true,
      warning,
      queries: generateSearchQueries(payload.businessCategory, payload.location, payload.keywords),
      leads: enriched,
      campaign: {
        ...result.campaign,
        businessesDiscovered: enriched.length,
        uniqueLeads: enriched.length,
        emailsFound: enriched.filter((lead) => Boolean(lead.email)).length,
        websitesEnriched: enriched.filter((lead) => Boolean(lead.website)).length,
        hotCount: enriched.filter((lead) => lead.lead_temperature === "HOT").length,
        warmCount: enriched.filter((lead) => lead.lead_temperature === "WARM").length,
        coldCount: enriched.filter((lead) => lead.lead_temperature === "COLD").length,
      },
    });
  } catch (error: any) {
    const message = error?.message || "Lead generation failed";
    return NextResponse.json({
      success: false,
      message,
    }, { status: 500 });
  }
}
