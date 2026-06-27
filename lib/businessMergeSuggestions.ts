export type BusinessMergeRow = {
  id: string;
  name: string | null;
  slug: string | null;
  category: string | null;
  city: string | null;
  area: string | null;
  address: string | null;
  postcode: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  maps_url: string | null;
  latitude: number | null;
  longitude: number | null;
  is_verified: boolean | null;
  featured: boolean | null;
  featured_rank: number | null;
  can_advertise: boolean | null;
  is_claimed: boolean | null;
  pricing_tier: string | null;
  paid_until: string | null;
  sponsor_mosque_id: string | null;
  submitted_by_email: string | null;
  claimed_by_email: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: string | null;
};

export type MergeSide = "left" | "right";

export type MergeSuggestion = {
  side: MergeSide;
  reason: string;
};

export type MergeSuggestions = Record<string, MergeSuggestion>;

const tierRank: Record<string, number> = {
  free: 0,
  bronze: 1,
  silver: 2,
  gold: 3,
  platinum: 4,
};

function clean(value: string | null | undefined) {
  return (value ?? "").trim();
}

function isNonEmpty(value: unknown) {
  if (typeof value === "string") return value.trim().length > 0;
  return value !== null && value !== undefined;
}

function textScore(value: string | null | undefined) {
  const v = clean(value);
  if (!v) return 0;
  return v.length;
}

function dateScore(value: string | null | undefined) {
  const v = clean(value);
  if (!v) return 0;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : 0;
}

function betterText(
  left: string | null | undefined,
  right: string | null | undefined,
  label: string
): MergeSuggestion {
  const leftScore = textScore(left);
  const rightScore = textScore(right);

  if (leftScore === rightScore) {
    return { side: "left", reason: `${label}: equal or similar value` };
  }

  return leftScore > rightScore
    ? { side: "left", reason: `${label}: left is more complete` }
    : { side: "right", reason: `${label}: right is more complete` };
}

export function buildBusinessMergeSuggestions(
  left: BusinessMergeRow,
  right: BusinessMergeRow
): MergeSuggestions {
  const suggestions: MergeSuggestions = {};

  suggestions.name = betterText(left.name, right.name, "Name");
  suggestions.slug = betterText(left.slug, right.slug, "Slug");
  suggestions.category = betterText(left.category, right.category, "Category");
  suggestions.city = betterText(left.city, right.city, "City");
  suggestions.area = betterText(left.area, right.area, "Area");
  suggestions.address = betterText(left.address, right.address, "Address");
  suggestions.postcode = betterText(left.postcode, right.postcode, "Postcode");
  suggestions.website = betterText(left.website, right.website, "Website");
  suggestions.phone = betterText(left.phone, right.phone, "Phone");
  suggestions.email = betterText(left.email, right.email, "Email");
  suggestions.maps_url = betterText(left.maps_url, right.maps_url, "Maps URL");

  suggestions.latitude =
    isNonEmpty(left.latitude) && !isNonEmpty(right.latitude)
      ? { side: "left", reason: "Latitude: only left has value" }
      : !isNonEmpty(left.latitude) && isNonEmpty(right.latitude)
      ? { side: "right", reason: "Latitude: only right has value" }
      : { side: "left", reason: "Latitude: equal or similar value" };

  suggestions.longitude =
    isNonEmpty(left.longitude) && !isNonEmpty(right.longitude)
      ? { side: "left", reason: "Longitude: only left has value" }
      : !isNonEmpty(left.longitude) && isNonEmpty(right.longitude)
      ? { side: "right", reason: "Longitude: only right has value" }
      : { side: "left", reason: "Longitude: equal or similar value" };

  suggestions.is_verified =
    Boolean(left.is_verified) && !Boolean(right.is_verified)
      ? { side: "left", reason: "Verified: left is verified" }
      : !Boolean(left.is_verified) && Boolean(right.is_verified)
      ? { side: "right", reason: "Verified: right is verified" }
      : { side: "left", reason: "Verified: both equal" };

  suggestions.featured =
    Boolean(left.featured) && !Boolean(right.featured)
      ? { side: "left", reason: "Featured: left is featured" }
      : !Boolean(left.featured) && Boolean(right.featured)
      ? { side: "right", reason: "Featured: right is featured" }
      : { side: "left", reason: "Featured: both equal" };

  const leftFeaturedRank =
    typeof left.featured_rank === "number" ? left.featured_rank : null;
  const rightFeaturedRank =
    typeof right.featured_rank === "number" ? right.featured_rank : null;

  suggestions.featured_rank =
    leftFeaturedRank !== null && rightFeaturedRank === null
      ? { side: "left", reason: "Featured rank: only left has rank" }
      : leftFeaturedRank === null && rightFeaturedRank !== null
      ? { side: "right", reason: "Featured rank: only right has rank" }
      : leftFeaturedRank !== null &&
        rightFeaturedRank !== null &&
        leftFeaturedRank < rightFeaturedRank
      ? { side: "left", reason: "Featured rank: left rank is stronger" }
      : leftFeaturedRank !== null &&
        rightFeaturedRank !== null &&
        rightFeaturedRank < leftFeaturedRank
      ? { side: "right", reason: "Featured rank: right rank is stronger" }
      : { side: "left", reason: "Featured rank: both equal" };

  suggestions.can_advertise =
    Boolean(left.can_advertise) && !Boolean(right.can_advertise)
      ? { side: "left", reason: "Can advertise: left is enabled" }
      : !Boolean(left.can_advertise) && Boolean(right.can_advertise)
      ? { side: "right", reason: "Can advertise: right is enabled" }
      : { side: "left", reason: "Can advertise: both equal" };

  suggestions.is_claimed =
    Boolean(left.is_claimed) && !Boolean(right.is_claimed)
      ? { side: "left", reason: "Claimed: left is claimed" }
      : !Boolean(left.is_claimed) && Boolean(right.is_claimed)
      ? { side: "right", reason: "Claimed: right is claimed" }
      : { side: "left", reason: "Claimed: both equal" };

  const leftTierScore = tierRank[clean(left.pricing_tier).toLowerCase()] ?? 0;
  const rightTierScore = tierRank[clean(right.pricing_tier).toLowerCase()] ?? 0;

  suggestions.pricing_tier =
    leftTierScore > rightTierScore
      ? { side: "left", reason: "Pricing tier: left is higher" }
      : rightTierScore > leftTierScore
      ? { side: "right", reason: "Pricing tier: right is higher" }
      : { side: "left", reason: "Pricing tier: both equal" };

  const leftPaidUntil = dateScore(left.paid_until);
  const rightPaidUntil = dateScore(right.paid_until);

  suggestions.paid_until =
    leftPaidUntil > rightPaidUntil
      ? { side: "left", reason: "Paid until: left expires later" }
      : rightPaidUntil > leftPaidUntil
      ? { side: "right", reason: "Paid until: right expires later" }
      : { side: "left", reason: "Paid until: both equal" };

  suggestions.sponsor_mosque_id =
    isNonEmpty(left.sponsor_mosque_id) && !isNonEmpty(right.sponsor_mosque_id)
      ? { side: "left", reason: "Sponsor mosque: only left has value" }
      : !isNonEmpty(left.sponsor_mosque_id) && isNonEmpty(right.sponsor_mosque_id)
      ? { side: "right", reason: "Sponsor mosque: only right has value" }
      : { side: "left", reason: "Sponsor mosque: both equal" };

  suggestions.submitted_by_email = betterText(
    left.submitted_by_email,
    right.submitted_by_email,
    "Submitted by email"
  );

  suggestions.claimed_by_email = betterText(
    left.claimed_by_email,
    right.claimed_by_email,
    "Claimed by email"
  );

  suggestions.stripe_customer_id =
    isNonEmpty(left.stripe_customer_id) && !isNonEmpty(right.stripe_customer_id)
      ? { side: "left", reason: "Stripe customer: only left has value" }
      : !isNonEmpty(left.stripe_customer_id) && isNonEmpty(right.stripe_customer_id)
      ? { side: "right", reason: "Stripe customer: only right has value" }
      : { side: "left", reason: "Stripe customer: both equal" };

  suggestions.stripe_subscription_id =
    isNonEmpty(left.stripe_subscription_id) && !isNonEmpty(right.stripe_subscription_id)
      ? { side: "left", reason: "Stripe subscription: only left has value" }
      : !isNonEmpty(left.stripe_subscription_id) &&
        isNonEmpty(right.stripe_subscription_id)
      ? { side: "right", reason: "Stripe subscription: only right has value" }
      : { side: "left", reason: "Stripe subscription: both equal" };

  suggestions.status = betterText(left.status, right.status, "Status");

  return suggestions;
}

