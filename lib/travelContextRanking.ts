import type { TravelPrayerInsight } from "@/lib/travelPrayerIntelligence";
import type { JumuahInsight } from "@/lib/jumuahIntelligence";
import type { MosqueJumuahInsight } from "@/lib/mosqueJumuahIntelligence";

export type TravelRankableBusiness = {
  id: string;
  name: string | null;
  slug: string | null;
  category: string | null;
  area: string | null;
  featured: boolean | null;
  featured_rank: number | null;
  is_verified: boolean | null;
  opens_at: string | null;
  closes_at: string | null;
  distanceKm?: number | null;
};

export type TravelRankableMosque = {
  id: string;
  name: string | null;
  slug: string | null;
  area: string | null;
  distanceKm?: number | null;
  mosqueJumuahInsight?: MosqueJumuahInsight | null;
};

function isOpenNow(
  opensAt?: string | null,
  closesAt?: string | null,
  now = new Date()
) {
  if (!opensAt || !closesAt) return false;

  const [openHour, openMinute] = opensAt.split(":").map(Number);
  const [closeHour, closeMinute] = closesAt.split(":").map(Number);

  if (
    [openHour, openMinute, closeHour, closeMinute].some((v) => Number.isNaN(v))
  ) {
    return false;
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const openMinutes = openHour * 60 + openMinute;
  const closeMinutes = closeHour * 60 + closeMinute;

  if (closeMinutes >= openMinutes) {
    return currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
  }

  return currentMinutes >= openMinutes || currentMinutes <= closeMinutes;
}

function businessCategoryScore(
  category: string | null,
  prayerInsight: TravelPrayerInsight
) {
  const value = category ?? "";

  switch (prayerInsight.context) {
    case "before_fajr":
    case "fajr_window":
      if (value === "Islamic Centre") return 25;
      if (value === "Restaurant") return 4;
      if (value === "Takeaway") return 3;
      return 0;

    case "dhuhr_window":
    case "asr_window":
      if (value === "Restaurant") return 12;
      if (value === "Takeaway") return 9;
      if (value === "Clinic") return 8;
      if (value === "Pharmacy") return 7;
      if (value === "Grocery") return 6;
      return 0;

    case "maghrib_window":
      if (value === "Restaurant") return 18;
      if (value === "Takeaway") return 16;
      if (value === "Grocery") return 9;
      if (value === "Butcher") return 7;
      return 0;

    case "isha_window":
      if (value === "Restaurant") return 15;
      if (value === "Takeaway") return 13;
      if (value === "Grocery") return 8;
      return 0;

    default:
      if (value === "Restaurant") return 10;
      if (value === "Takeaway") return 8;
      if (value === "Butcher") return 8;
      if (value === "Grocery") return 8;
      if (value === "Clinic") return 7;
      if (value === "Pharmacy") return 7;
      if (value === "Islamic Centre") return 7;
      return 0;
  }
}

export function rankTravelMosquesByPrayerContext(
  mosques: TravelRankableMosque[],
  prayerInsight: TravelPrayerInsight,
  jumuahInsight?: JumuahInsight
) {
  const ranked = [...mosques].map((mosque) => {
    let score = 0;

    if (
      prayerInsight.context === "before_fajr" ||
      prayerInsight.context === "fajr_window" ||
      prayerInsight.context === "dhuhr_window" ||
      prayerInsight.context === "asr_window" ||
      prayerInsight.context === "maghrib_window" ||
      prayerInsight.context === "isha_window"
    ) {
      score += 30;
    }

    if (typeof mosque.distanceKm === "number") {
      score += Math.max(0, 20 - mosque.distanceKm);
    }

    if (jumuahInsight?.isJumuahRelevant) {
      score += jumuahInsight.mosqueBoost;
    }

    if (mosque.mosqueJumuahInsight?.hasJumuah) {
      score += mosque.mosqueJumuahInsight.scoreBoost;
    }

    return {
      ...mosque,
      _score: score,
    };
  });

  ranked.sort((a, b) => b._score - a._score);

  return ranked;
}

export function rankTravelBusinessesByPrayerContext(
  businesses: TravelRankableBusiness[],
  prayerInsight: TravelPrayerInsight,
  now = new Date(),
  jumuahInsight?: JumuahInsight
) {
  const ranked = [...businesses].map((business) => {
    let score = 0;

    if (business.featured) score += 16;
    if (business.is_verified) score += 14;

    if (typeof business.featured_rank === "number") {
      score += Math.max(0, 10 - business.featured_rank);
    }

    if (typeof business.distanceKm === "number") {
      score += Math.max(0, 18 - business.distanceKm);
    }

    if (isOpenNow(business.opens_at, business.closes_at, now)) {
      score += 10;
    }

    score += businessCategoryScore(business.category, prayerInsight);

    if (jumuahInsight?.isJumuahRelevant) {
      score -= jumuahInsight.businessPenalty;
    }

    return {
      ...business,
      _score: score,
    };
  });

  ranked.sort((a, b) => b._score - a._score);

  return ranked;
}

