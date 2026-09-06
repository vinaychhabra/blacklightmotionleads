import type {
  BusinessLeadRecord,
  BusinessSearchProvider,
  BusinessSearchRequest,
  LeadGenerationCampaign,
  LeadTemperature,
} from "@/lib/lead-generator/types";

const COMPANY_BANK = [
  "ABC Realty",
  "Urban Nest Properties",
  "Prime Horizon Realty",
  "Signature Homes Group",
  "Venture Crest Builders",
  "Golden Heights Property Solutions",
  "Nexa Property Advisory",
  "Royal City Developers",
  "Skyline Estates",
  "Harbor View Realty",
  "Evergreen Property Advisors",
  "Metro Homes Consultancy",
  "MileStone Property Dealers",
  "BluePeak Realty",
  "Maple Grove Builders",
  "NorthStar Properties",
  "Elev8 Real Estate",
  "Shivam Property Services",
  "Titan Realty Partners",
  "Apex Investment Homes",
  "Sunrise Property Consultants",
  "Cityscapes Residences",
  "Dreamline Properties",
  "Kinetic Realty Solutions",
  "Legacy Builders & Estates",
  "Pacific Horizons Property",
];

export function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/\s+/g, " ")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .trim()
    .toLowerCase();
}

export function dedupeBusinesses(records: BusinessLeadRecord[]): BusinessLeadRecord[] {
  const seen = new Set<string>();
  const output: BusinessLeadRecord[] = [];

  const addIfUnique = (record: BusinessLeadRecord, key: string) => {
    if (!key) return;
    if (seen.has(key)) return;
    seen.add(key);
    output.push(record);
  };

  for (const record of records) {
    const phoneKey = normalizeText(record.phone).replace(/\D/g, "");
    const websiteKey = normalizeText(record.website).replace(/^https?:\/\//, "").replace(/\/$/, "");
    const emailKey = normalizeText(record.email);
    const externalKey = normalizeText(record.external_place_id);
    const companyKey = `${normalizeText(record.company_name)}|${normalizeText(record.city)}`;

    if (externalKey) addIfUnique(record, `external:${externalKey}`);
    if (websiteKey) addIfUnique(record, `website:${websiteKey}`);
    if (phoneKey) addIfUnique(record, `phone:${phoneKey}`);
    if (emailKey) addIfUnique(record, `email:${emailKey}`);
    if (companyKey) addIfUnique(record, `company:${companyKey}`);
  }

  return output;
}

export function generateSearchQueries(
  businessCategory: string,
  location: string,
  keywords: string[]
): string[] {
  const base = [
    businessCategory,
    ...keywords,
    ...keywords.map((keyword) => `${keyword} ${location}`),
    ...keywords.map((keyword) => `${keyword} in ${location}`),
  ]
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.replace(/\s+/g, " "));

  const variants = new Set<string>();

  for (const part of base) {
    variants.add(`${part} ${location}`.trim());
    variants.add(`${part} ${location} deals`.trim());
    variants.add(`${part} ${location} homes`.trim());
    variants.add(`${part} ${location} real estate`.trim());
    variants.add(`${part} in ${location}`.trim());
  }

  for (const keyword of keywords) {
    variants.add(`${keyword} ${location}`);
    variants.add(`${keyword} properties ${location}`);
    variants.add(`${keyword} builders ${location}`);
    variants.add(`${keyword} consultants ${location}`);
    variants.add(`${keyword} brokers ${location}`);
  }

  const ordered = [...variants]
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 3)
    .filter((entry, index, array) => array.indexOf(entry) === index)
    .slice(0, 12);

  return ordered;
}

export function calculateLeadScore(record: Partial<BusinessLeadRecord>) {
  let score = 0;
  const reasons: string[] = [];

  if (record.website) {
    score += 10;
    reasons.push("Website");
  }
  if (record.phone) {
    score += 10;
    reasons.push("Phone");
  }
  if (record.email) {
    score += 10;
    reasons.push("Email");
  }
  if (record.instagram_url) {
    score += 5;
    reasons.push("Instagram");
  }
  if (record.facebook_url) {
    score += 5;
    reasons.push("Facebook");
  }
  if (record.linkedin_url) {
    score += 5;
    reasons.push("LinkedIn");
  }
  if ((record.rating ?? 0) > 4) {
    score += 5;
    reasons.push("High rating");
  }
  if ((record.review_count ?? 0) > 50) {
    score += 5;
    reasons.push("High review count");
  }
  if (record.website && /^(https?:)?\/\//i.test(record.website)) {
    score += 10;
    reasons.push("Active website");
  }
  if (record.business_category) {
    score += 15;
    reasons.push("Relevant business category");
  }

  score = Math.min(100, score);
  let temperature: LeadTemperature = "COLD";
  if (score >= 80) temperature = "HOT";
  else if (score >= 60) temperature = "WARM";

  return { score, temperature, reasons: reasons.slice(0, 8) };
}

export function buildLeadFromBusiness(
  business: BusinessLeadRecord,
  category: string,
  location: string
): BusinessLeadRecord {
  const scored = calculateLeadScore(business);
  const companyName = business.company_name || "Unnamed business";
  const pitch = `We help ${companyName} expand its local reach and improve lead conversion in ${location} with targeted digital marketing and lead generation.`;

  return {
    ...business,
    business_category: business.business_category || category,
    city: business.city || location,
    source: business.source || "AI Lead Generator",
    lead_score: scored.score,
    lead_temperature: scored.temperature,
    score_reasons: scored.reasons,
    ai_relevance: true,
    ai_reason: `Strong ${category} prospect in ${location} with ${business.website ? "website" : "online visibility"} and clear sales potential.`,
    ai_recommended_pitch: pitch,
    enrichment_status: business.enrichment_status || "DISCOVERED",
    campaign_id: business.campaign_id || null,
    notes: business.notes || "Discovered through AI lead generation.",
    tags: business.tags || [category, location],
  };
}

export class GooglePlacesBusinessSearchProvider implements BusinessSearchProvider {
  name = "GooglePlacesBusinessSearchProvider";
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.GOOGLE_PLACES_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY || "";
  }

  private async fetchPlaceDetails(placeId: string, apiKey: string) {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=name,formatted_address,formatted_phone_number,website,types,geometry,rating,user_ratings_total,place_id,url&key=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    return payload.result ?? null;
  }

  async searchBusinesses(request: BusinessSearchRequest): Promise<BusinessLeadRecord[]> {
    const apiKey = this.apiKey || process.env.GOOGLE_PLACES_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;

    if (!apiKey) {
      throw new Error("Live lead integration is required. Please add your Google Places API key in Settings before generating leads.");
    }

    const queries = generateSearchQueries(request.businessCategory, request.location, request.keywords).slice(0, 5);
    const results: BusinessLeadRecord[] = [];
    const seen = new Set<string>();
    const limit = Math.max(5, Math.min(request.leadCount || 20, 60));

    for (const query of queries) {
      const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(`${query} ${request.location}`)}&key=${apiKey}`;
      const response = await fetch(url);
      if (!response.ok) continue;

      const payload = await response.json();
      const items = Array.isArray(payload.results) ? payload.results : [];

      for (const item of items) {
        const placeId = item.place_id || item.id;
        if (!placeId || seen.has(placeId)) continue;
        seen.add(placeId);

        const detailed = await this.fetchPlaceDetails(placeId, apiKey);
        const place = detailed || item;
        const companyName = place.name || item.name || "Unknown Business";
        const city = place.formatted_address ? place.formatted_address.split(",").slice(-3).join(",").trim() : request.location;
        const scoreResult = calculateLeadScore({
          company_name: companyName,
          business_category: request.businessCategory,
          website: place.website || null,
          phone: place.formatted_phone_number || null,
          email: null,
          city,
          source: "google-places",
          source_url: place.url || `https://maps.google.com/?q=${encodeURIComponent(companyName)}`,
          rating: place.rating ?? null,
          review_count: place.user_ratings_total ?? null,
          instagram_url: null,
          facebook_url: null,
          linkedin_url: null,
        });

        results.push({
          id: `google-${placeId}`,
          company_name: companyName,
          business_category: request.businessCategory,
          description: `${companyName} is a local ${request.businessCategory.toLowerCase()} business in ${request.location}.`,
          phone: place.formatted_phone_number || null,
          email: null,
          website: place.website || null,
          address: place.formatted_address || item.formatted_address || null,
          city,
          state: place.formatted_address ? (place.formatted_address.split(",").slice(-2, -1)[0] || request.location) : request.location,
          country: place.formatted_address ? (place.formatted_address.split(",").slice(-1)[0] || "India") : "India",
          postal_code: place.formatted_address ? (place.formatted_address.match(/\b\d{5,6}\b/)?.[0] ?? null) : null,
          latitude: place.geometry?.location?.lat ?? item.geometry?.location?.lat ?? null,
          longitude: place.geometry?.location?.lng ?? item.geometry?.location?.lng ?? null,
          external_place_id: place.place_id || placeId,
          google_place_id: place.place_id || placeId,
          source: "google-places",
          source_url: place.url || `https://maps.google.com/?q=${encodeURIComponent(companyName)}`,
          rating: place.rating ?? item.rating ?? null,
          review_count: place.user_ratings_total ?? item.user_ratings_total ?? null,
          facebook_url: null,
          instagram_url: null,
          linkedin_url: null,
          youtube_url: null,
          contact_page_url: place.website || null,
          lead_score: scoreResult.score,
          lead_temperature: scoreResult.temperature,
          score_reasons: scoreResult.reasons,
          ai_relevance: true,
          ai_reason: `Google Places listing found for a ${request.businessCategory.toLowerCase()} business in ${request.location}.`,
          ai_recommended_pitch: `We help ${companyName} improve its local visibility and convert qualified demand in ${request.location}.`,
          enrichment_status: "DISCOVERED",
          campaign_id: null,
          tags: [request.businessCategory, request.location],
        });

        if (results.length >= limit) break;
      }

      if (results.length >= limit) break;
    }

    return results.filter((record) => {
      if (request.minimumRating && (record.rating ?? 0) < request.minimumRating) return false;
      if (request.websiteRequired && !record.website) return false;
      if (request.phoneRequired && !record.phone) return false;
      if (request.emailRequired && !record.email) return false;
      if (request.socialOnly && !(record.instagram_url || record.facebook_url || record.linkedin_url)) return false;
      if (request.leadQuality && request.leadQuality !== "Any") {
        if (record.lead_temperature !== request.leadQuality) return false;
      }
      return true;
    }).slice(0, limit);
  }
}

export class DemoBusinessSearchProvider implements BusinessSearchProvider {
  name = "DemoBusinessSearchProvider";

  async searchBusinesses(request: BusinessSearchRequest): Promise<BusinessLeadRecord[]> {
    const queries = generateSearchQueries(
      request.businessCategory,
      request.location,
      request.keywords
    );

    const results: BusinessLeadRecord[] = [];
    const limit = Math.max(5, Math.min(request.leadCount || 20, 120));

    COMPANY_BANK.slice(0, limit).forEach((companyName, index) => {
      const q = queries[index % queries.length] || queries[0];
      const scoreResult = calculateLeadScore({
        company_name: companyName,
        business_category: request.businessCategory,
        website: index % 2 === 0 ? `https://www.${companyName.toLowerCase().replace(/\s+/g, "")}.com` : null,
        phone: index % 3 === 0 ? `+91${(9000000000 + index).toString().slice(0, 10)}` : null,
        email: index % 4 === 0 ? `hello@${companyName.toLowerCase().replace(/\s+/g, "")}.com` : null,
        city: request.location,
        source: "demo-provider",
        source_url: `https://search.example/${encodeURIComponent(q)}`,
        rating: 3.8 + (index % 5) * 0.3,
        review_count: 20 + index * 17,
        instagram_url: index % 2 === 0 ? `https://instagram.com/${companyName.toLowerCase().replace(/\s+/g, "")}` : null,
        facebook_url: index % 3 === 0 ? `https://facebook.com/${companyName.toLowerCase().replace(/\s+/g, "")}` : null,
        linkedin_url: index % 4 === 0 ? `https://linkedin.com/company/${companyName.toLowerCase().replace(/\s+/g, "")}` : null,
      });

      results.push({
        id: `demo-${index + 1}`,
        company_name: companyName,
        business_category: request.businessCategory,
        description: `${companyName} is a local ${request.businessCategory.toLowerCase()} operating in ${request.location}.`,
        phone: index % 3 === 0 ? `+91${(9000000000 + index).toString().slice(0, 10)}` : null,
        email: index % 4 === 0 ? `hello@${companyName.toLowerCase().replace(/\s+/g, "")}.com` : null,
        website: index % 2 === 0 ? `https://www.${companyName.toLowerCase().replace(/\s+/g, "")}.com` : null,
        address: `${index + 1} Main Market Road`,
        city: request.location,
        state: "Haryana",
        country: "India",
        postal_code: `12200${(index + 1).toString().padStart(2, "0")}`.slice(0, 8),
        latitude: 28.4583 + index * 0.001,
        longitude: 77.0266 + index * 0.001,
        external_place_id: `demo-${index + 1}`,
        source: "demo-provider",
        source_url: `https://search.example/${encodeURIComponent(q)}`,
        rating: 3.8 + (index % 5) * 0.3,
        review_count: 20 + index * 17,
        facebook_url: index % 3 === 0 ? `https://facebook.com/${companyName.toLowerCase().replace(/\s+/g, "")}` : null,
        instagram_url: index % 2 === 0 ? `https://instagram.com/${companyName.toLowerCase().replace(/\s+/g, "")}` : null,
        linkedin_url: index % 4 === 0 ? `https://linkedin.com/company/${companyName.toLowerCase().replace(/\s+/g, "")}` : null,
        youtube_url: index % 5 === 0 ? `https://youtube.com/@${companyName.toLowerCase().replace(/\s+/g, "")}` : null,
        contact_page_url: index % 2 === 0 ? `https://www.${companyName.toLowerCase().replace(/\s+/g, "")}.com/contact` : null,
        lead_score: scoreResult.score,
        lead_temperature: scoreResult.temperature,
        score_reasons: scoreResult.reasons,
        ai_relevance: true,
        ai_reason: `High-fit ${request.businessCategory.toLowerCase()} business in ${request.location}.`,
        ai_recommended_pitch: `We help ${companyName} grow its presence and generate more qualified leads in ${request.location}.`,
        enrichment_status: "DISCOVERED",
        campaign_id: null,
      });
    });

    return results.filter((record) => {
      if (request.minimumRating && (record.rating ?? 0) < request.minimumRating) return false;
      if (request.websiteRequired && !record.website) return false;
      if (request.phoneRequired && !record.phone) return false;
      if (request.emailRequired && !record.email) return false;
      if (request.socialOnly && !(record.instagram_url || record.facebook_url || record.linkedin_url)) return false;
      if (request.leadQuality && request.leadQuality !== "Any") {
        if (record.lead_temperature !== request.leadQuality) return false;
      }
      return true;
    }).slice(0, limit);
  }
}

export function getConfiguredBusinessSearchProvider(): BusinessSearchProvider {
  const configured = (process.env.LEAD_PROVIDER || process.env.NEXT_PUBLIC_LEAD_PROVIDER || "demo").toLowerCase();

  if (configured === "google_places" || configured === "google-places" || configured === "googleplaces") {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      throw new Error("Live lead integration is required. Please add your Google Places API key in Settings before generating leads.");
    }
    return new GooglePlacesBusinessSearchProvider(apiKey);
  }

  throw new Error("Live lead integration is required. Please add your Google Places API key in Settings before generating leads.");
}

function createUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.random() * 16 | 0;
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function createCampaignSummary(
  campaignName: string,
  category: string,
  location: string,
  keywords: string[],
  requestedLeads: number,
  discovered: BusinessLeadRecord[]
): LeadGenerationCampaign {
  const hotCount = discovered.filter((lead) => lead.lead_temperature === "HOT").length;
  const warmCount = discovered.filter((lead) => lead.lead_temperature === "WARM").length;
  const coldCount = discovered.filter((lead) => lead.lead_temperature === "COLD").length;

  return {
    id: createUuid(),
    name: campaignName,
    category,
    location,
    keywords,
    requestedLeads,
    queriesGenerated: generateSearchQueries(category, location, keywords).length,
    businessesDiscovered: discovered.length,
    duplicatesRemoved: Math.max(0, discovered.length - discovered.length),
    uniqueLeads: discovered.length,
    websitesEnriched: discovered.filter((lead) => lead.website).length,
    emailsFound: discovered.filter((lead) => lead.email).length,
    hotCount,
    warmCount,
    coldCount,
    status: "completed",
    createdAt: new Date().toISOString(),
  };
}

export async function discoverBusinessLeads(
  request: BusinessSearchRequest,
  provider: BusinessSearchProvider = getConfiguredBusinessSearchProvider()
): Promise<{ queries: string[]; discovered: BusinessLeadRecord[]; campaign: LeadGenerationCampaign }> {
  const queries = generateSearchQueries(request.businessCategory, request.location, request.keywords);
  const records = await provider.searchBusinesses(request);
  const unique = dedupeBusinesses(records.map((record) => buildLeadFromBusiness(record, request.businessCategory, request.location)));
  const campaign = createCampaignSummary(
    `${request.location} ${request.businessCategory} - ${new Date().toLocaleString("en-IN", { month: "long", year: "numeric" })}`,
    request.businessCategory,
    request.location,
    request.keywords,
    request.leadCount,
    unique
  );

  return {
    queries,
    discovered: unique,
    campaign,
  };
}
