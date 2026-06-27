export type TravelBusiness = {
  id: string;
  name: string | null;
  slug: string | null;
  category: string | null;
  city: string | null;
  area: string | null;
  country: string | null;
  featured: boolean | null;
  featured_rank: number | null;
  pricing_tier: string | null;
  is_verified: boolean | null;
  latitude?: number | null;
  longitude?: number | null;
  opens_at?: string | null;
  closes_at?: string | null;
  travel_tags?: string[] | null;
};

export type TravelMosque = {
  id: string;
  name: string | null;
  slug: string | null;
  city: string | null;
  area: string | null;
  country: string | null;
  latitude?: number | null;
  longitude?: number | null;
  is_travel_visible?: boolean | null;
  travel_tags?: string[] | null;
};

export function normalizeSlug(value: string) {
  return value.trim().toLowerCase();
}

export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(a));
}

export function isOpenNow(
  opensAt?: string | null,
  closesAt?: string | null,
  now = new Date()
) {
  if (!opensAt || !closesAt) return null;

  const [openHour, openMinute] = opensAt.split(":").map(Number);
  const [closeHour, closeMinute] = closesAt.split(":").map(Number);

  if (
    [openHour, openMinute, closeHour, closeMinute].some((v) => Number.isNaN(v))
  ) {
    return null;
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const openMinutes = openHour * 60 + openMinute;
  const closeMinutes = closeHour * 60 + closeMinute;

  if (closeMinutes >= openMinutes) {
    return currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
  }

  // overnight
  return currentMinutes >= openMinutes || currentMinutes <= closeMinutes;
}

export function getTravelEssentials(businesses: TravelBusiness[]) {
  const preferredOrder = [
    "Restaurant",
    "Takeaway",
    "Butcher",
    "Grocery",
    "Clinic",
    "Pharmacy",
    "Islamic Centre",
    "Bookshop",
    "Travel",
  ];

  const ranked = [...businesses].sort((a, b) => {
    const aFeatured = a.featured ? 1 : 0;
    const bFeatured = b.featured ? 1 : 0;
    if (aFeatured !== bFeatured) return bFeatured - aFeatured;

    const aVerified = a.is_verified ? 1 : 0;
    const bVerified = b.is_verified ? 1 : 0;
    if (aVerified !== bVerified) return bVerified - aVerified;

    const aCategoryRank = preferredOrder.indexOf(a.category ?? "");
    const bCategoryRank = preferredOrder.indexOf(b.category ?? "");
    return (aCategoryRank === -1 ? 999 : aCategoryRank) -
      (bCategoryRank === -1 ? 999 : bCategoryRank);
  });

  return ranked.slice(0, 8);
}

export function filterTravelBusinesses(
  businesses: TravelBusiness[],
  options: {
    category?: string;
    city?: string;
    country?: string;
    verifiedOnly?: boolean;
    featuredOnly?: boolean;
    openNowOnly?: boolean;
  }
) {
  return businesses.filter((b) => {
    if (options.category && b.category !== options.category) return false;
    if (options.city && b.city !== options.city) return false;
    if (options.country && b.country !== options.country) return false;
    if (options.verifiedOnly && !b.is_verified) return false;
    if (options.featuredOnly && !b.featured) return false;
    if (options.openNowOnly && isOpenNow(b.opens_at, b.closes_at) !== true) {
      return false;
    }
    return true;
  });
}

