type BusinessRow = {
  id: string;
  name: string | null;
  featured: boolean | null;
  pricing_tier: string | null;
  paid_until: string | null;
  sponsor_mosque_id: string | null;
  is_verified: boolean | null;
  status: string | null;
  city: string | null;
};

type CampaignRow = {
  id: string;
  advertising_type: string | null;
  status: string | null;
  payment_status: string | null;
  activated_at: string | null;
  paid_until: string | null;
  selected_mosque_id: string | null;
  selected_city_id: number | null;
  created_at: string;
};

type MosqueRow = {
  id: string;
  name: string | null;
  city: string | null;
};

export type BusinessOwnerInsight = {
  type:
    | "renewal_risk"
    | "upgrade_opportunity"
    | "verification_needed"
    | "unused_sponsorship"
    | "listing_incomplete";
  level: "high" | "medium" | "low";
  title: string;
  description: string;
};

function daysUntil(value: string | null | undefined) {
  if (!value) return null;
  const diff = new Date(value).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function buildBusinessOwnerInsights(args: {
  businesses: BusinessRow[];
  campaigns: CampaignRow[];
  mosques: MosqueRow[];
}): BusinessOwnerInsight[] {
  const { businesses } = args;
  const insights: BusinessOwnerInsight[] = [];

  for (const business of businesses) {
    const expiryDays = daysUntil(business.paid_until);

    if (business.featured && expiryDays !== null && expiryDays >= 0 && expiryDays <= 7) {
      insights.push({
        type: "renewal_risk",
        level: expiryDays <= 3 ? "high" : "medium",
        title: `${business.name ?? "A featured listing"} expires in ${expiryDays} day${
          expiryDays === 1 ? "" : "s"
        }`,
        description:
          "Renew soon to avoid losing premium visibility and sponsored placement.",
      });
    }

    if (
      business.is_verified &&
      (!business.pricing_tier || business.pricing_tier === "free")
    ) {
      insights.push({
        type: "upgrade_opportunity",
        level: "low",
        title: `${business.name ?? "Verified business"} can upgrade for more reach`,
        description:
          "Verified businesses on the free tier are strong candidates for city featured or mosque sponsorship campaigns.",
      });
    }

    if (!business.is_verified) {
      insights.push({
        type: "verification_needed",
        level: "medium",
        title: `${business.name ?? "Business"} is not verified yet`,
        description:
          "Verification improves trust and increases the value of featured placement.",
      });
    }

    if (
      business.featured &&
      (!business.sponsor_mosque_id || business.sponsor_mosque_id.length === 0)
    ) {
      insights.push({
        type: "unused_sponsorship",
        level: "low",
        title: `${business.name ?? "Business"} is featured but not tied to a mosque`,
        description:
          "Adding a mosque sponsorship can strengthen local relevance and improve conversion.",
      });
    }

    if (!business.city || !business.status) {
      insights.push({
        type: "listing_incomplete",
        level: "medium",
        title: `${business.name ?? "Business"} has incomplete listing data`,
        description:
          "Complete city and listing status details to improve discoverability and ad performance.",
      });
    }
  }

  return insights.slice(0, 12);
}

