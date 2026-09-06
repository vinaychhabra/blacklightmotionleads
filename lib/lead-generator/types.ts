export type LeadTemperature = "HOT" | "WARM" | "COLD";
export type ReviewStatus = "PENDING" | "APPROVED" | "REJECTED" | "DUPLICATE" | "IMPORTED";
export type EnrichmentStatus = "DISCOVERED" | "ENRICHING" | "ENRICHED" | "QUALIFIED" | "IMPORTED" | "FAILED";

export interface BusinessSearchRequest {
  businessCategory: string;
  location: string;
  keywords: string[];
  leadCount: number;
  minimumRating?: number;
  websiteRequired?: boolean;
  phoneRequired?: boolean;
  emailRequired?: boolean;
  socialOnly?: boolean;
  leadQuality?: "Any" | "HOT" | "WARM";
  radiusKm?: number;
}

export interface BusinessLeadRecord {
  id: string;
  company_name: string;
  business_category: string;
  description: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  external_place_id: string | null;
  google_place_id?: string | null;
  source: string;
  source_url: string | null;
  rating: number | null;
  review_count: number | null;
  facebook_url: string | null;
  instagram_url: string | null;
  linkedin_url: string | null;
  youtube_url: string | null;
  contact_page_url: string | null;
  lead_score: number;
  lead_temperature: LeadTemperature;
  score_reasons: string[];
  ai_relevance?: boolean;
  ai_reason?: string;
  ai_recommended_pitch?: string;
  enrichment_status?: EnrichmentStatus;
  campaign_id?: string | null;
  notes?: string | null;
  tags?: string[];
}

export interface LeadGenerationCampaign {
  id: string;
  name: string;
  category: string;
  location: string;
  keywords: string[];
  requestedLeads: number;
  queriesGenerated: number;
  businessesDiscovered: number;
  duplicatesRemoved: number;
  uniqueLeads: number;
  websitesEnriched: number;
  emailsFound: number;
  hotCount: number;
  warmCount: number;
  coldCount: number;
  status: "running" | "completed" | "failed";
  createdAt: string;
}

export interface BusinessSearchProvider {
  name: string;
  searchBusinesses: (request: BusinessSearchRequest) => Promise<BusinessLeadRecord[]>;
}
