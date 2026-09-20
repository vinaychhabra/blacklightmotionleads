import type {
  BusinessLeadRecord,
  BusinessSearchProvider,
  BusinessSearchRequest,
  LeadGenerationCampaign,
  LeadTemperature,
} from "@/lib/lead-generator/types";

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";

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

async function mapWithConcurrency<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>): Promise<void> {
  let index = 0;
  async function run() {
    while (index < items.length) {
      const current = items[index++];
      await worker(current);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, run));
}

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

  for (const record of records) {
    const phoneKey = normalizeText(record.phone).replace(/\D/g, "");
    const websiteKey = normalizeText(record.website).replace(/^https?:\/\//, "").replace(/\/$/, "");
    const emailKey = normalizeText(record.email);
    const externalKey = normalizeText(record.external_place_id);
    const companyKey = `${normalizeText(record.company_name)}|${normalizeText(record.city)}`;
    const keys = [
      externalKey && `external:${externalKey}`,
      websiteKey && `website:${websiteKey}`,
      phoneKey && `phone:${phoneKey}`,
      emailKey && `email:${emailKey}`,
      companyKey && `company:${companyKey}`,
    ].filter((key): key is string => Boolean(key));

    if (!keys.length || keys.some((key) => seen.has(key))) continue;
    keys.forEach((key) => seen.add(key));
    output.push(record);
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
    company_name: companyName,
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
    let lastError: string | null = null;

    for (const query of queries) {
      if (results.length >= limit) break;

      let items: any[];
      try {
        const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(`${query} ${request.location}`)}&key=${apiKey}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Google Places request failed with HTTP ${response.status}.`);

        const payload = await response.json();
        if (payload.status && payload.status !== "OK" && payload.status !== "ZERO_RESULTS") {
          throw new Error(payload.error_message || `Google Places returned ${payload.status}. Check API restrictions and enabled APIs.`);
        }
        items = Array.isArray(payload.results) ? payload.results : [];
      } catch (error: any) {
        lastError = error?.message || String(error);
        continue;
      }

      const newItems = items.filter((item) => {
        const placeId = item.place_id || item.id;
        if (!placeId || seen.has(placeId)) return false;
        seen.add(placeId);
        return true;
      }).slice(0, Math.max(0, limit - results.length));

      await mapWithConcurrency(newItems, 5, async (item) => {
        const placeId = item.place_id || item.id;
        const detailed = await this.fetchPlaceDetails(placeId, apiKey).catch(() => null);
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
      });
    }

    if (results.length === 0 && lastError) {
      throw new Error(lastError);
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

// Several long-advertised public mirrors were manually verified and dropped for this reason:
// - overpass.kumi.systems, overpass.openstreetmap.ru, overpass.private.coffee: never respond at
//   all, even to trivial queries — they hang until our timeout fires instead of erroring, which
//   silently ate the whole request budget.
// - overpass.osm.ch: responds fast but its database is effectively empty (0 results for known
//   busy areas worldwide) — worse than a timeout, since it looks like a clean "no leads found".
// overpass.openstreetmap.fr answers in ~1-2s with real global data; overpass-api.de also has
// real data but its shared cluster is frequently overloaded, so it's kept as a fallback only.
const OVERPASS_ENDPOINTS = [
  "https://overpass.openstreetmap.fr/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];
const OVERPASS_TIMEOUT_MS = 12000;

async function queryOverpassEndpoint(endpoint: string, query: string, userAgent: string): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OVERPASS_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "text/plain", "User-Agent": userAgent },
      body: query,
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`OpenStreetMap search service returned HTTP ${response.status}.`);
    }
    const payload = await response.json().catch(() => null);
    if (!payload) {
      throw new Error("OpenStreetMap search service returned an unreadable response.");
    }
    // Overpass returns HTTP 200 even when the query itself times out or errors
    // server-side — the failure only shows up in this `remark` field, with an
    // otherwise-valid but empty `elements` array. Treat that as a real failure
    // instead of silently reporting "no businesses found".
    if (typeof payload.remark === "string" && /error|timed out/i.test(payload.remark)) {
      throw new Error(`OpenStreetMap search service error: ${payload.remark}`);
    }
    return payload;
  } catch (error: any) {
    throw new Error(
      error?.name === "AbortError"
        ? "OpenStreetMap search service took too long to respond."
        : (error?.message || String(error))
    );
  } finally {
    clearTimeout(timer);
  }
}

async function raceOverpassMirrors(query: string, userAgent: string): Promise<any> {
  // Race every mirror at once instead of trying them one after another —
  // sequential attempts could add up to nearly a minute and blow past
  // serverless function time limits before a working mirror was reached.
  return Promise.any(OVERPASS_ENDPOINTS.map((endpoint) => queryOverpassEndpoint(endpoint, query, userAgent)));
}

async function queryOverpass(query: string, userAgent: string): Promise<any> {
  try {
    return await raceOverpassMirrors(query, userAgent);
  } catch {
    // Both mirrors can fail together on a transient spike (a momentary overload or
    // rate-limit window) that clears within a few seconds — one short-backoff retry
    // recovers from that without making the caller manually click generate again.
    await new Promise((resolve) => setTimeout(resolve, 3000));
    try {
      return await raceOverpassMirrors(query, userAgent);
    } catch (aggregate: any) {
      const lastError = aggregate?.errors?.[aggregate.errors.length - 1]?.message || aggregate?.message;
      throw new Error(`${lastError || "OpenStreetMap search failed."} Try a smaller radius, a narrower category, or try again in a minute — the free OpenStreetMap search service is sometimes overloaded.`);
    }
  }
}

export class OpenStreetMapBusinessSearchProvider implements BusinessSearchProvider {
 name = "OpenStreetMapBusinessSearchProvider";

 async searchBusinesses(request: BusinessSearchRequest): Promise<BusinessLeadRecord[]> {
   const limit = Math.max(5, Math.min(request.leadCount || 20, 60));
   const userAgent = "BlacklightMotionCRM/1.0 (lead discovery)";
   const geocodeResponse = await fetch(
     `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(request.location)}`,
     { headers: { "User-Agent": userAgent } }
   );
   if (!geocodeResponse.ok) {
     throw new Error(`OpenStreetMap location lookup failed with HTTP ${geocodeResponse.status}.`);
   }

   const locations = await geocodeResponse.json();
   const location = Array.isArray(locations) ? locations[0] : null;
   if (!location?.lat || !location?.lon) {
     throw new Error(`OpenStreetMap could not find the location "${request.location}".`);
   }

   const radius = Math.max(1000, Math.min((request.radiusKm || 25) * 1000, 50000));
   const categoryText = `${request.businessCategory} ${request.keywords.join(" ")}`.toLowerCase();
   const isRealEstate = /real estate|property|builder|broker|developer|estate agent/.test(categoryText);

   const stopWords = new Set(["and", "the", "for", "with", "near", "local", "business", "businesses"]);
   const tokens = [...new Set(
     `${request.businessCategory} ${request.keywords.join(" ")}`
       .toLowerCase()
       .split(/[^a-z0-9]+/)
       .filter((token) => token.length > 2 && !stopWords.has(token))
   )];
   const tokenPattern = tokens.map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");

   const filters = isRealEstate
     ? [
         `["office"="estate_agent"]["name"]`,
         `["office"="property_management"]["name"]`,
         `["shop"="real_estate"]["name"]`,
       ]
     : tokenPattern
       ? [
           `["shop"~"${tokenPattern}",i]["name"]`,
           `["office"~"${tokenPattern}",i]["name"]`,
           `["amenity"~"${tokenPattern}",i]["name"]`,
         ]
       : [
           `["name"]["shop"]`,
           `["name"]["office"]`,
         ];
   const query = `[out:json][timeout:12];(${filters.map((filter) =>
     `nwr(around:${radius},${location.lat},${location.lon})${filter};`
   ).join("")});out center tags ${Math.max(60, limit * 3)};`;
   const payload = await queryOverpass(query, userAgent);
   const elements = (Array.isArray(payload.elements) ? payload.elements : []).filter(
     (element: any) => Boolean(element?.tags?.name)
   );
   const records = elements.map((element: any): BusinessLeadRecord => {
     const tags = element.tags || {};
     const latitude = element.lat ?? element.center?.lat ?? null;
     const longitude = element.lon ?? element.center?.lon ?? null;
     const companyName = tags.name;
     const website = tags.website || tags["contact:website"] || null;
     const phone = tags.phone || tags["contact:phone"] || null;
     const email = tags.email || tags["contact:email"] || null;
     const city = tags["addr:city"] || request.location;
     const sourceUrl = `https://www.openstreetmap.org/${element.type}/${element.id}`;
     const scoreResult = calculateLeadScore({
       company_name: companyName, business_category: request.businessCategory,
       website, phone, email, city, source: "openstreetmap", source_url: sourceUrl,
       rating: null, review_count: null,
     });

     return {
       id: `osm-${element.type}-${element.id}`, company_name: companyName,
       business_category: request.businessCategory,
       description: `${companyName} is a local ${request.businessCategory.toLowerCase()} business in ${city}.`,
       phone, email, website,
       address: [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ") || null,
       city, state: tags["addr:state"] || null, country: tags["addr:country"] || null,
       postal_code: tags["addr:postcode"] || null, latitude, longitude,
       external_place_id: `osm-${element.type}-${element.id}`, source: "openstreetmap",
       source_url: sourceUrl, rating: null, review_count: null,
       facebook_url: tags["contact:facebook"] || null, instagram_url: tags["contact:instagram"] || null,
       linkedin_url: tags["contact:linkedin"] || null, youtube_url: tags["contact:youtube"] || null,
       contact_page_url: website, lead_score: scoreResult.score,
       lead_temperature: scoreResult.temperature, score_reasons: scoreResult.reasons,
       ai_relevance: true, ai_reason: `OpenStreetMap listing found for a ${request.businessCategory.toLowerCase()} business.`,
       ai_recommended_pitch: `We help ${companyName} improve its local visibility and convert qualified demand in ${city}.`,
       enrichment_status: "DISCOVERED", campaign_id: null, tags: [request.businessCategory, city],
     };
   }).filter((record: BusinessLeadRecord) =>
     (!request.websiteRequired || Boolean(record.website)) &&
     (!request.phoneRequired || Boolean(record.phone)) &&
     (!request.emailRequired || Boolean(record.email)) &&
     (!request.socialOnly || Boolean(record.instagram_url || record.facebook_url || record.linkedin_url)) &&
     (!request.leadQuality || request.leadQuality === "Any" || record.lead_temperature === request.leadQuality)
   ).slice(0, limit);

   if (!records.length) {
     throw new Error(
       `OpenStreetMap found no mapped businesses near "${request.location}". Try a larger radius, a broader category, or another location.`
     );
   }

   return records;
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

  if (configured === "openstreetmap" || configured === "open_street_map" || configured === "osm") {
    return new OpenStreetMapBusinessSearchProvider();
  }

  throw new Error("Live lead integration is required. Please choose Google Places or OpenStreetMap in Settings before generating leads.");
}

export async function enrichBusinessesWithAnthropic(
  records: BusinessLeadRecord[],
  apiKey: string,
  businessCategory: string,
  location: string
): Promise<BusinessLeadRecord[]> {
  if (!records.length) return records;

  const candidates = records.slice(0, 30).map((record) => ({
    id: record.id,
    company_name: record.company_name,
    category: record.business_category,
    city: record.city,
    address: record.address,
    phone: record.phone,
    email: record.email,
    website: record.website,
    description: record.description,
  }));
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: Math.min(6000, Math.max(1200, candidates.length * 180)),
      messages: [{
        role: "user",
        content: [
          `Qualify these discovered businesses for a ${businessCategory} sales campaign in ${location}.`,
          "Use only the supplied facts. Do not invent phone numbers, emails, websites, ratings, or services.",
          "Return JSON only as an array with one object per input record, using exactly these fields:",
          "id, relevant (boolean), score (0-100), temperature (HOT/WARM/COLD), reason, recommended_pitch.",
          JSON.stringify(candidates),
        ].join("\n"),
      }],
    }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`Claude lead qualification failed: ${payload?.error?.message || `HTTP ${response.status}`}. Configure a supported Anthropic model with ANTHROPIC_MODEL if needed.`);
  }

  const text = Array.isArray(payload?.content)
    ? payload.content.filter((item: any) => item?.type === "text").map((item: any) => item.text).join("")
    : "";
  let evaluations: Array<{
    id: string;
    relevant?: boolean;
    score?: number;
    temperature?: LeadTemperature;
    reason?: string;
    recommended_pitch?: string;
  }>;
  try {
    evaluations = JSON.parse(text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim());
    if (!Array.isArray(evaluations)) throw new Error("not an array");
  } catch {
    throw new Error("Claude returned an invalid lead qualification response.");
  }

  const byId = new Map(evaluations.map((evaluation) => [evaluation.id, evaluation]));
  return records.filter((record) => byId.get(record.id)?.relevant !== false).map((record) => {
    const evaluation = byId.get(record.id);
    if (!evaluation) return record;
    const score = Math.max(0, Math.min(100, Number(evaluation.score ?? record.lead_score)));
    const temperature: LeadTemperature =
      evaluation.temperature === "HOT" || evaluation.temperature === "WARM" ? evaluation.temperature : "COLD";
    return {
      ...record,
      ai_relevance: Boolean(evaluation.relevant),
      ai_reason: evaluation.reason || record.ai_reason,
      ai_recommended_pitch: evaluation.recommended_pitch || record.ai_recommended_pitch,
      lead_score: score,
      lead_temperature: temperature,
      score_reasons: [...record.score_reasons, "Claude qualification"].slice(0, 8),
    };
  }).sort((left, right) => right.lead_score - left.lead_score);
}

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const IGNORED_EMAIL_DOMAINS = [
  "sentry.io", "wixpress.com", "example.com", "godaddy.com", "schema.org",
  "w3.org", "yourdomain.com", "domain.com", "email.com", "wordpress.org",
];
const PRIVATE_HOSTNAME_PATTERNS = [
  /^localhost$/i,
  /^0\.0\.0\.0$/,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^::1$/,
  /\.local$/i,
  /\.internal$/i,
];

function isSafeWebsiteUrl(url: URL): boolean {
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  return !PRIVATE_HOSTNAME_PATTERNS.some((pattern) => pattern.test(url.hostname));
}

function extractEmailsFromHtml(html: string): string[] {
  const mailtoMatches = [...html.matchAll(/mailto:([^"'?\s>]+)/gi)].map((match) => {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  });
  const textMatches = html.match(EMAIL_REGEX) || [];
  const seen = new Set<string>();
  const emails: string[] = [];

  for (const raw of [...mailtoMatches, ...textMatches]) {
    const email = raw.trim().toLowerCase();
    if (seen.has(email)) continue;
    const domain = email.split("@")[1];
    if (!domain) continue;
    if (IGNORED_EMAIL_DOMAINS.some((ignored) => domain === ignored || domain.endsWith(`.${ignored}`))) continue;
    if (/\.(png|jpg|jpeg|gif|svg|webp|css|js)$/i.test(email)) continue;
    seen.add(email);
    emails.push(email);
  }

  return emails;
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; BlacklightMotionLeadBot/1.0)" },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function discoverWebsiteContact(
  website: string,
  timeoutMs: number
): Promise<{ email: string; contactPageUrl: string } | null> {
  let homepageUrl: URL;
  try {
    homepageUrl = new URL(website.startsWith("http") ? website : `https://${website}`);
  } catch {
    return null;
  }
  if (!isSafeWebsiteUrl(homepageUrl)) return null;

  const candidatePaths = ["", "contact", "contact-us"];
  for (const path of candidatePaths) {
    try {
      const pageUrl = path ? new URL(path, homepageUrl).toString() : homepageUrl.toString();
      const pageUrlParsed = new URL(pageUrl);
      if (!isSafeWebsiteUrl(pageUrlParsed)) continue;

      const response = await fetchWithTimeout(pageUrl, timeoutMs);
      if (!response.ok) continue;
      const contentType = response.headers.get("content-type") || "";
      if (contentType && !contentType.includes("html") && !contentType.includes("text")) continue;

      const html = await response.text();
      const emails = extractEmailsFromHtml(html);
      if (emails.length) {
        return { email: emails[0], contactPageUrl: pageUrl };
      }
    } catch {
      continue;
    }
  }
  return null;
}

export async function enrichLeadsWithWebsiteContacts(
  records: BusinessLeadRecord[],
  concurrency = 5,
  timeoutMs = 6000
): Promise<BusinessLeadRecord[]> {
  const candidates = records.filter((record) => record.website && !record.email);
  if (!candidates.length) return records;

  const found = new Map<string, { email: string; contactPageUrl: string }>();

  await mapWithConcurrency(candidates, concurrency, async (record) => {
    const contact = await discoverWebsiteContact(record.website as string, timeoutMs);
    if (contact) found.set(record.id, contact);
  });

  if (!found.size) return records;

  return records.map((record) => {
    const contact = found.get(record.id);
    if (!contact) return record;
    const updated = { ...record, email: contact.email, contact_page_url: contact.contactPageUrl };
    const rescored = calculateLeadScore(updated);
    return {
      ...updated,
      lead_score: rescored.score,
      lead_temperature: rescored.temperature,
      score_reasons: rescored.reasons,
      enrichment_status: "ENRICHED",
    };
  });
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
  discovered: BusinessLeadRecord[],
  duplicatesRemoved = 0
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
    businessesDiscovered: discovered.length + duplicatesRemoved,
    duplicatesRemoved,
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
    unique,
    records.length - unique.length
  );

  return {
    queries,
    discovered: unique,
    campaign,
  };
}
