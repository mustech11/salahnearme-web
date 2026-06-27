type CampaignRow = {
  id: string;
  advertising_type: string | null;
  status: string | null;
  payment_status: string | null;
  paid_until: string | null;
  selected_city_id: number | null;
  selected_mosque_id: string | null;
};

type BusinessRow = {
  id: string;
  name: string | null;
  city: string | null;
  featured: boolean | null;
  featured_rank: number | null;
  pricing_tier: string | null;
  paid_until: string | null;
  sponsor_mosque_id: string | null;
  is_verified?: boolean | null;
};

type MosqueRow = {
  id: string;
  name: string | null;
  city: string | null;
};

type CityRow = {
  id: number;
  name: string;
};

export type IntelligenceAlert = {
  type:
    | "expiring_campaign"
    | "rank_conflict"
    | "unsponsored_mosque"
    | "city_growth_opportunity"
    | "upgrade_opportunity"
    | "inactive_campaign"
    | "missing_featured_rank";

  level: "high" | "medium" | "low";

  title: string;

  description: string;
};

function daysUntil(value: string | null | undefined): number | null {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const difference = date.getTime() - Date.now();

  return Math.ceil(difference / (1000 * 60 * 60 * 24));
}

function normalizeText(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

export function buildCampaignIntelligence(args: {
  campaigns?: CampaignRow[] | null;
  businesses?: BusinessRow[] | null;
  mosques?: MosqueRow[] | null;
  cities?: CityRow[] | null;
}): IntelligenceAlert[] {
  const campaigns = args.campaigns ?? [];
  const businesses = args.businesses ?? [];
  const mosques = args.mosques ?? [];
  const cities = args.cities ?? [];

  const alerts: IntelligenceAlert[] = [];

  /*
    ---------------------------------------------------------
    ACTIVE CAMPAIGNS
    ---------------------------------------------------------
  */

  const activeCampaigns = campaigns.filter(
    (campaign) =>
      campaign.status === "active" &&
      campaign.payment_status === "paid"
  );

  for (const campaign of activeCampaigns) {
    const days = daysUntil(campaign.paid_until);

    if (days !== null && days >= 0 && days <= 7) {
      alerts.push({
        type: "expiring_campaign",
        level: days <= 3 ? "high" : "medium",
        title: `Campaign expiring in ${days} day${
          days === 1 ? "" : "s"
        }`,
        description:
          "A paid campaign is close to expiry and should be renewed or replaced to protect revenue.",
      });
    }
  }

  /*
    ---------------------------------------------------------
    INACTIVE PAID CAMPAIGNS
    ---------------------------------------------------------
  */

  const inactiveCampaigns = campaigns.filter(
    (campaign) =>
      campaign.payment_status === "paid" &&
      campaign.status !== "active"
  );

  if (inactiveCampaigns.length > 0) {
    alerts.push({
      type: "inactive_campaign",
      level: "medium",
      title: `${inactiveCampaigns.length} paid campaigns are inactive`,
      description:
        "Some campaigns were paid for but are not currently active. Review campaign status consistency.",
    });
  }

  /*
    ---------------------------------------------------------
    FEATURED BUSINESSES
    ---------------------------------------------------------
  */

  const featuredBusinesses = businesses.filter(
    (business) => business.featured === true
  );

  const rankMap = new Map<number, BusinessRow[]>();

  for (const business of featuredBusinesses) {
    if (typeof business.featured_rank === "number") {
      const existing = rankMap.get(business.featured_rank) ?? [];

      existing.push(business);

      rankMap.set(business.featured_rank, existing);
    } else {
      alerts.push({
        type: "missing_featured_rank",
        level: "medium",
        title: `${business.name ?? "Featured business"} has no rank`,
        description:
          "A featured business is missing a featured_rank value. This can affect listing order consistency.",
      });
    }
  }

  /*
    ---------------------------------------------------------
    RANK CONFLICTS
    ---------------------------------------------------------
  */

  for (const [rank, items] of rankMap.entries()) {
    if (items.length > 1) {
      alerts.push({
        type: "rank_conflict",
        level: "high",
        title: `Featured rank conflict at #${rank}`,
        description:
          "Multiple businesses share the same featured rank. Resolve conflicts to maintain stable ordering.",
      });
    }
  }

  /*
    ---------------------------------------------------------
    UNSPONSORED MOSQUES
    ---------------------------------------------------------
  */

  const sponsoredMosqueIds = new Set(
    businesses
      .map((business) => business.sponsor_mosque_id)
      .filter((id): id is string => Boolean(id))
  );

  const unsponsoredMosques = mosques.filter(
    (mosque) => !sponsoredMosqueIds.has(mosque.id)
  );

  if (unsponsoredMosques.length > 0) {
    alerts.push({
      type: "unsponsored_mosque",
      level: "medium",
      title: `${unsponsoredMosques.length} mosques without sponsors`,
      description:
        "These mosque pages are strong monetisation opportunities for local business sponsorships.",
    });
  }

  /*
    ---------------------------------------------------------
    CITY GROWTH OPPORTUNITIES
    ---------------------------------------------------------
  */

  for (const city of cities) {
    const normalizedCity = normalizeText(city.name);

    const cityBusinesses = businesses.filter(
      (business) =>
        normalizeText(business.city) === normalizedCity
    );

    const cityFeaturedBusinesses = cityBusinesses.filter(
      (business) => business.featured === true
    );

    const cityMosques = mosques.filter(
      (mosque) =>
        normalizeText(mosque.city) === normalizedCity
    );

    if (
      cityMosques.length >= 3 &&
      cityFeaturedBusinesses.length === 0
    ) {
      alerts.push({
        type: "city_growth_opportunity",
        level: "medium",
        title: `${city.name} has growth potential`,
        description:
          "This city has enough mosque activity to support premium business listings but currently has no featured businesses.",
      });
    }
  }

  /*
    ---------------------------------------------------------
    VERIFIED BUSINESS UPGRADES
    ---------------------------------------------------------
  */

  for (const business of businesses) {
    const paidUntil = business.paid_until
      ? new Date(business.paid_until)
      : null;

    const hasActivePaidPlacement =
      paidUntil !== null &&
      !Number.isNaN(paidUntil.getTime()) &&
      paidUntil.getTime() > Date.now();

    if (
      business.is_verified === true &&
      business.pricing_tier === "free" &&
      !hasActivePaidPlacement
    ) {
      alerts.push({
        type: "upgrade_opportunity",
        level: "low",
        title: `${
          business.name ?? "Verified business"
        } is a strong upgrade candidate`,
        description:
          "Verified free-tier businesses are ideal candidates for featured placement or mosque sponsorship upgrades.",
      });
    }
  }

  /*
    ---------------------------------------------------------
    PRIORITY SORTING
    ---------------------------------------------------------
  */

  const priorityOrder: Record<
    IntelligenceAlert["level"],
    number
  > = {
    high: 0,
    medium: 1,
    low: 2,
  };

  return alerts
    .sort(
      (a, b) =>
        priorityOrder[a.level] -
        priorityOrder[b.level]
    )
    .slice(0, 12);
}

