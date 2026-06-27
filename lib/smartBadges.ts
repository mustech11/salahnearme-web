export type SmartBadgeInput = {
  is_verified?: boolean | null;
  verified_status?: string | null;
  featured?: boolean | null;
  sponsor_mosque_id?: string | null;
  mosqueId?: string | null;
  pricing_tier?: string | null;
  paid_until?: string | null;
  halal_confidence?: string | null;
  review_status?: string | null;
  is_live?: boolean | null;
  distance_miles?: number | null;
  has_coordinates?: boolean | null;
  has_phone?: boolean | null;
  has_website?: boolean | null;
};

export type SmartBadge = {
  label: string;
  className: string;
};

function isPaidActive(paidUntil?: string | null) {
  if (!paidUntil) return false;
  return new Date(paidUntil).getTime() > Date.now();
}

export function getSmartBadges(input: SmartBadgeInput): SmartBadge[] {
  const badges: SmartBadge[] = [];

  const paidActive = isPaidActive(input.paid_until);
  const isSponsored =
    !!input.mosqueId && input.sponsor_mosque_id === input.mosqueId;

  if (isSponsored && paidActive) {
    badges.push({
      label: "Mosque Sponsor",
      className: "border-yellow-500/30 bg-yellow-500 text-black",
    });
  }

  if (input.featured && paidActive) {
    badges.push({
      label: "Featured",
      className: "border-yellow-500/30 bg-yellow-500/10 text-yellow-400",
    });
  }

  if (input.is_verified || input.verified_status === "verified_from_directory") {
    badges.push({
      label: "Verified",
      className: "border-green-500/30 bg-green-500/10 text-green-300",
    });
  }

  if (input.halal_confidence === "high") {
    badges.push({
      label: "High Halal Confidence",
      className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    });
  }

  if (input.review_status === "approved") {
    badges.push({
      label: "Reviewed",
      className: "border-blue-500/30 bg-blue-500/10 text-blue-300",
    });
  }

  if (input.is_live) {
    badges.push({
      label: "Live",
      className: "border-purple-500/30 bg-purple-500/10 text-purple-300",
    });
  }

  if (
    typeof input.distance_miles === "number" &&
    input.distance_miles <= 0.5
  ) {
    badges.push({
      label: "Very Nearby",
      className: "border-orange-500/30 bg-orange-500/10 text-orange-300",
    });
  }

  if (input.has_coordinates) {
    badges.push({
      label: "Map Ready",
      className: "border-white/10 bg-white/5 text-white/60",
    });
  }

  if (input.has_phone || input.has_website) {
    badges.push({
      label: "Contact Available",
      className: "border-white/10 bg-white/5 text-white/60",
    });
  }

  return badges.slice(0, 4);
}

