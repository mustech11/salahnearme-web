import { calculateTrustScore } from "@/lib/trustScore";

export type PricingTier =
  | "free"
  | "verified"
  | "bronze"
  | "silver"
  | "gold"
  | "platinum"
  | "featured"
  | "mosque_sponsor"
  | "city_sponsor";

export type RankedBusiness = {
  id: string;
  name?: string | null;
  city?: string | null;
  featured?: boolean | null;
  featured_rank?: number | null;
  sponsor_mosque_id?: string | null;
  sponsor_city_id?: number | null;
  pricing_tier?: string | null;
  subscription_type?: string | null;
  subscription_status?: string | null;
  paid_until?: string | null;
  is_verified?: boolean | null;
  sponsorship_active?: boolean | null;
  city_sponsor?: boolean | null;
  mosque_sponsor?: boolean | null;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  halal_confidence?: string | number | null;
  halal_score?: number | null;
  trust_score?: number | null;
  quality_score?: number | null;
  ranking_score?: number | null;
  review_status?: string | null;
  is_live?: boolean | null;
  quality_status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type RankOptions = {
  mosqueId?: string | null;
  cityId?: number | null;
  cityName?: string | null;
  userLat?: number;
  userLon?: number;
  includeExpiredPenalty?: boolean;
  rotateSponsors?: boolean;
};

const tierScores: Record<PricingTier, number> = {
  free: 0,
  verified: 80,
  bronze: 120,
  silver: 260,
  gold: 480,
  platinum: 760,
  featured: 520,
  mosque_sponsor: 950,
  city_sponsor: 1200,
};

function normaliseText(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function normaliseTier(value: string | null | undefined): PricingTier {
  const tier = normaliseText(value).replace(/-/g, "_");

  return tier in tierScores ? (tier as PricingTier) : "free";
}

function getTierScore(...values: Array<string | null | undefined>) {
  return Math.max(
    ...values.map((value) => tierScores[normaliseTier(value)] ?? 0),
    0
  );
}

export function isBusinessPaidActive(paidUntil: string | null | undefined) {
  if (!paidUntil) return false;

  const expiry = new Date(paidUntil).getTime();

  return Number.isFinite(expiry) && expiry > Date.now();
}

function daysUntilExpiry(paidUntil: string | null | undefined) {
  if (!paidUntil) return null;

  const diff = new Date(paidUntil).getTime() - Date.now();

  return Number.isFinite(diff) ? Math.ceil(diff / 86400000) : null;
}

function getDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const earthRadiusKm = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(a));
}

function getDistanceScore(
  business: RankedBusiness,
  userLat?: number,
  userLon?: number
) {
  if (
    typeof userLat !== "number" ||
    typeof userLon !== "number" ||
    typeof business.latitude !== "number" ||
    typeof business.longitude !== "number"
  ) {
    return 0;
  }

  const distanceKm = getDistanceKm(
    userLat,
    userLon,
    business.latitude,
    business.longitude
  );

  return Math.max(0, 240 - distanceKm * 20);
}

function hasGoodBasicProfile(business: RankedBusiness) {
  return Boolean(
    business.name &&
      business.address &&
      (business.phone || business.website) &&
      typeof business.latitude === "number" &&
      typeof business.longitude === "number"
  );
}

function getRotationOffset(length: number) {
  if (length <= 1) return 0;
  return new Date().getMinutes() % length;
}

function rotatePaidGroup<T extends RankedBusiness>(businesses: T[]) {
  if (businesses.length <= 1) return businesses;

  const offset = getRotationOffset(businesses.length);

  return [...businesses.slice(offset), ...businesses.slice(0, offset)];
}

function getStoredScore(value: number | null | undefined, max = 100) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(value, max));
}

export function getBusinessRankScore(
  business: RankedBusiness,
  options?: RankOptions
) {
  let score = 0;

  const paidActive = isBusinessPaidActive(business.paid_until);

  const sponsorshipActive =
    paidActive ||
    business.sponsorship_active === true ||
    business.subscription_status === "active" ||
    business.subscription_status === "paypal_paid";

  const tierScore = getTierScore(
    business.pricing_tier,
    business.subscription_type
  );

  const expiryDays = daysUntilExpiry(business.paid_until);
  const includeExpiredPenalty = options?.includeExpiredPenalty ?? true;

  if (sponsorshipActive) score += tierScore;

  if (business.city_sponsor && sponsorshipActive) score += 1400;

  if (
    options?.cityId &&
    business.sponsor_city_id === options.cityId &&
    sponsorshipActive
  ) {
    score += 1400;
  }

  if (business.mosque_sponsor && sponsorshipActive) score += 1050;

  if (
    options?.mosqueId &&
    business.sponsor_mosque_id === options.mosqueId &&
    sponsorshipActive
  ) {
    score += 1200;
  }

  if (business.featured && sponsorshipActive) score += 520;

  if (business.featured && !sponsorshipActive && includeExpiredPenalty) {
    score -= 250;
  }

  if (
    options?.cityName &&
    normaliseText(business.city) === normaliseText(options.cityName)
  ) {
    score += 90;
  }

  if (business.is_verified) score += 120;

  if (hasGoodBasicProfile(business)) score += 80;

  if (typeof business.featured_rank === "number" && business.featured_rank > 0) {
    score += Math.max(0, 180 - business.featured_rank * 12);
  }

  if (expiryDays !== null) {
    if (expiryDays < 0 && includeExpiredPenalty) score -= 220;
    else if (expiryDays <= 7) score -= 45;
    else if (expiryDays >= 30) score += 30;
  }

  const trust = calculateTrustScore({
    is_verified: business.is_verified,
    halal_confidence:
      typeof business.halal_confidence === "string"
        ? business.halal_confidence
        : null,
    halal_score: business.halal_score,
    review_status: business.review_status,
    is_live: business.is_live,
    quality_status: business.quality_status,
    has_phone: Boolean(business.phone),
    has_website: Boolean(business.website),
    has_address: Boolean(business.address),
  });

  score += trust.score ?? 0;

  score += getStoredScore(business.trust_score, 100);
  score += getStoredScore(business.quality_score, 100);
  score += getStoredScore(business.ranking_score, 200);
  score += getDistanceScore(business, options?.userLat, options?.userLon);

  return score;
}

export function sortBusinessesByRank<T extends RankedBusiness>(
  businesses: T[],
  options?: RankOptions
) {
  const scored = businesses.map((business) => {
    const paidActive = isBusinessPaidActive(business.paid_until);

    return {
      business,
      score: getBusinessRankScore(business, options),
      sponsorActive:
        paidActive &&
        Boolean(
          business.city_sponsor ||
            business.mosque_sponsor ||
            business.featured ||
            business.sponsorship_active
        ),
    };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;

    const aRank =
      typeof a.business.featured_rank === "number"
        ? a.business.featured_rank
        : 9999;

    const bRank =
      typeof b.business.featured_rank === "number"
        ? b.business.featured_rank
        : 9999;

    if (aRank !== bRank) return aRank - bRank;

    return normaliseText(a.business.name).localeCompare(
      normaliseText(b.business.name)
    );
  });

  if (options?.rotateSponsors === false) {
    return scored.map((item) => item.business);
  }

  const sponsors = scored
    .filter((item) => item.sponsorActive)
    .map((item) => item.business);

  const normal = scored
    .filter((item) => !item.sponsorActive)
    .map((item) => item.business);

  return [...rotatePaidGroup(sponsors), ...normal];
}

export function getTopBusinesses<T extends RankedBusiness>(
  businesses: T[],
  limit = 6,
  options?: RankOptions
) {
  return sortBusinessesByRank(businesses, options).slice(0, limit);
}

