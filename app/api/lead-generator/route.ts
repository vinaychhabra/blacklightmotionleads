import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { discoverBusinessLeads, generateSearchQueries, GooglePlacesBusinessSearchProvider } from "@/lib/lead-generator/service";
import type { BusinessSearchRequest } from "@/lib/lead-generator/types";

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

    const supabaseUrl = "https://bmhsjutyqplvwlkuarbr.supabase.co" //process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseAnonKey = "sb_publishable_5SkqsKU8jNnwKF22Wf1W5A_rA7Ufckm" //process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    let configuredProvider = (process.env.LEAD_PROVIDER || process.env.NEXT_PUBLIC_LEAD_PROVIDER || "demo").toLowerCase();
    let configuredKey = process.env.GOOGLE_PLACES_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY || "";

    if (supabaseUrl && supabaseAnonKey) {
      const settingsClient = createClient(supabaseUrl, supabaseAnonKey);
      const { data: settingsRow } = await settingsClient
        .from("app_settings")
        .select("lead_provider, google_places_api_key")
        .eq("id", 1)
        .maybeSingle();

      if (settingsRow?.lead_provider) {
        configuredProvider = String(settingsRow.lead_provider).toLowerCase();
      }
      if (settingsRow?.google_places_api_key) {
        configuredKey = settingsRow.google_places_api_key;
      }
    }

    if (configuredProvider !== "google_places" && configuredProvider !== "google-places" && configuredProvider !== "googleplaces") {
      return NextResponse.json({
        success: false,
        message: getProviderSetupError(),
        code: "INTEGRATION_REQUIRED",
      }, { status: 400 });
    }

    if (!configuredKey) {
      return NextResponse.json({
        success: false,
        message: "Google Places is selected but no API key was found. Add your Google Places API key in Settings to enable live lead discovery.",
        code: "MISSING_API_KEY",
      }, { status: 400 });
    }

    const provider = new GooglePlacesBusinessSearchProvider(configuredKey);
    const result = await discoverBusinessLeads(payload, provider);

    return NextResponse.json({
      success: true,
      queries: generateSearchQueries(payload.businessCategory, payload.location, payload.keywords),
      leads: result.discovered,
      campaign: result.campaign,
    });
  } catch (error: any) {
    const message = error?.message || "Lead generation failed";
    return NextResponse.json({
      success: false,
      message,
    }, { status: 500 });
  }
}
