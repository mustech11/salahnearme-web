export type PricingTier = "bronze" | "silver" | "gold" | "platinum";
export type AdvertisingType =
  | "mosque_sponsor"
  | "city_featured"
  | "multi_mosque"
  | "multi_city";

export const TIER_LABELS: Record<PricingTier, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
};

export function getTierDisplayName(
  tier: PricingTier,
  advertisingType: AdvertisingType
) {
  const base = TIER_LABELS[tier];

  switch (advertisingType) {
    case "city_featured":
      return `${base} City Featured`;
    case "multi_mosque":
      return `${base} Multi-Mosque`;
    case "multi_city":
      return `${base} Multi-City`;
    default:
      return `${base} Mosque Sponsor`;
  }
}

