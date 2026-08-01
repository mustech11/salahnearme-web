import Link from "next/link";

import BusinessTrackedLink from "@/components/BusinessTrackedLink";
import SmartBadges from "@/components/SmartBadges";
import TrustBadge from "@/components/TrustBadge";

import { sortBusinessesByRank } from "@/lib/businessRanking";
import { getSmartBadges } from "@/lib/smartBadges";
import { supabasePublic } from "@/lib/supabaseServer";
import { calculateTrustScore } from "@/lib/trustScore";

type Props = {
  mosqueId: string;
  mosqueName: string | null;
  mosqueSlug: string | null;
  cityName: string | null;
  latitude: number | null;
  longitude: number | null;
};

type BusinessRow = {
  id: string;
  name: string | null;
  slug: string | null;
  category: string | null;
  city: string | null;
  area: string | null;
  address: string | null;
  postcode: string | null;
  phone: string | null;
  website: string | null;
  maps_url: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  gallery_urls: string[] | null;
  latitude: number | null;
  longitude: number | null;
  is_verified: boolean | null;
  featured: boolean | null;
  featured_rank: number | null;
  pricing_tier: string | null;
  paid_until: string | null;
  sponsor_mosque_id: string | null;
  halal_confidence: string | null;
  halal_score: number | null;
  review_status?: string | null;
  is_live?: boolean | null;
  quality_status?: string | null;
  import_source?: string | null;
};

type BusinessWithDistance = BusinessRow & {
  distanceMiles: number | null;
};

type BusinessCardModel = {
  business: BusinessWithDistance;
  name: string;
  category: string;
  area: string | null;
  address: string | null;
  distance: string | null;
  cardImage: string | null;
  logoUrl: string | null;
  websiteUrl: string | null;
  mapsUrl: string | null;
  phone: string | null;
  safeSlug: string | null;
  sponsored: boolean;
  paidFeatured: boolean;
  verified: boolean;
  trust: ReturnType<typeof calculateTrustScore>;
  smartBadges: ReturnType<typeof getSmartBadges>;
};

type IconName =
  | "arrow"
  | "building"
  | "call"
  | "check"
  | "location"
  | "map"
  | "mosque"
  | "route"
  | "shield"
  | "sparkles"
  | "star"
  | "store"
  | "website";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SLUG_REGEX =
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const QUERY_LIMIT = 80;
const DISPLAY_LIMIT = 6;
const MAX_TEXT_LENGTH = 500;
const MAX_URL_LENGTH = 2_000;

function cleanText(
  value: string | null | undefined,
  maxLength = MAX_TEXT_LENGTH
): string | null {
  const cleaned = String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);

  return cleaned || null;
}

function formatLabel(
  value: string | null | undefined,
  fallback = "Halal business"
): string {
  const cleaned = cleanText(value, 100);

  if (!cleaned) {
    return fallback;
  }

  return cleaned
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}

function normaliseExternalUrl(
  value: string | null | undefined
): string | null {
  const cleaned = cleanText(value, MAX_URL_LENGTH);

  if (!cleaned) {
    return null;
  }

  const candidate = /^https?:\/\//i.test(cleaned)
    ? cleaned
    : `https://${cleaned}`;

  try {
    const url = new URL(candidate);

    if (
      url.protocol !== "http:" &&
      url.protocol !== "https:"
    ) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function normalisePhone(
  value: string | null | undefined
): string | null {
  const cleaned = cleanText(value, 80);

  if (!cleaned) {
    return null;
  }

  const phone = cleaned.replace(/[^\d+*#]/g, "");

  return phone.length >= 6 ? phone : null;
}

function getCardImage(
  business: BusinessRow
): string | null {
  const candidates = [
    business.cover_image_url,
    business.logo_url,
    ...(business.gallery_urls ?? []),
  ];

  for (const candidate of candidates) {
    const url = normaliseExternalUrl(candidate);

    if (url) {
      return url;
    }
  }

  return null;
}

function isCoordinate(
  value: number | null
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value)
  );
}

function haversineMiles(
  latitudeOne: number,
  longitudeOne: number,
  latitudeTwo: number,
  longitudeTwo: number
): number {
  const radiusMiles = 3_958.8;

  const toRadians = (value: number) =>
    (value * Math.PI) / 180;

  const latitudeDifference = toRadians(
    latitudeTwo - latitudeOne
  );

  const longitudeDifference = toRadians(
    longitudeTwo - longitudeOne
  );

  const calculation =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(toRadians(latitudeOne)) *
      Math.cos(toRadians(latitudeTwo)) *
      Math.sin(longitudeDifference / 2) ** 2;

  const bounded = Math.min(
    1,
    Math.max(0, calculation)
  );

  return (
    2 *
    radiusMiles *
    Math.asin(Math.sqrt(bounded))
  );
}

function getDistance(
  mosqueLatitude: number | null,
  mosqueLongitude: number | null,
  businessLatitude: number | null,
  businessLongitude: number | null
): number | null {
  if (
    !isCoordinate(mosqueLatitude) ||
    !isCoordinate(mosqueLongitude) ||
    !isCoordinate(businessLatitude) ||
    !isCoordinate(businessLongitude)
  ) {
    return null;
  }

  return haversineMiles(
    mosqueLatitude,
    mosqueLongitude,
    businessLatitude,
    businessLongitude
  );
}

function formatDistance(
  distance: number | null
): string | null {
  if (
    distance === null ||
    !Number.isFinite(distance) ||
    distance < 0
  ) {
    return null;
  }

  if (distance < 0.1) {
    return "Under 0.1 miles";
  }

  if (distance < 1) {
    return `${distance.toFixed(1)} mile`;
  }

  return `${distance.toFixed(1)} miles`;
}

function isPaidActive(
  value: string | null | undefined
): boolean {
  const cleaned = cleanText(value, 100);

  if (!cleaned) {
    return false;
  }

  const timestamp = new Date(cleaned).getTime();

  return (
    Number.isFinite(timestamp) &&
    timestamp > Date.now()
  );
}

function getBusinessTrust(
  business: BusinessWithDistance
) {
  return calculateTrustScore({
    is_verified: business.is_verified,
    featured: business.featured,
    pricing_tier: business.pricing_tier,
    paid_until: business.paid_until,
    halal_confidence:
      business.halal_confidence,
    halal_score: business.halal_score,
    review_status: business.review_status,
    is_live: business.is_live,
    quality_status:
      business.quality_status,
    source: business.import_source,
    distance_miles:
      business.distanceMiles,
    has_coordinates:
      isCoordinate(business.latitude) &&
      isCoordinate(business.longitude),
    has_phone: Boolean(
      cleanText(business.phone)
    ),
    has_website: Boolean(
      cleanText(business.website)
    ),
    has_address: Boolean(
      cleanText(business.address)
    ),
  });
}

function getSafeBusinessRows(
  rows: BusinessRow[]
): BusinessRow[] {
  const seenIds = new Set<string>();

  return rows.filter((business) => {
    if (
      !UUID_REGEX.test(business.id) ||
      seenIds.has(business.id)
    ) {
      return false;
    }

    seenIds.add(business.id);

    return true;
  });
}

function buildAddress(
  business: BusinessRow
): string | null {
  const value = [
    cleanText(business.address),
    cleanText(business.postcode, 40),
  ]
    .filter((item): item is string => Boolean(item))
    .join(" • ");

  return value || null;
}

function getDistancePriority(
  value: number | null
): number {
  return value === null
    ? Number.POSITIVE_INFINITY
    : value;
}

function getBusinessModel(
  business: BusinessWithDistance,
  mosqueId: string
): BusinessCardModel {
  const websiteUrl = normaliseExternalUrl(
    business.website
  );

  const mapsUrl = normaliseExternalUrl(
    business.maps_url
  );

  const phone = normalisePhone(
    business.phone
  );

  const safeSlug =
    business.slug &&
    SLUG_REGEX.test(business.slug)
      ? business.slug
      : null;

  const sponsored =
    business.sponsor_mosque_id === mosqueId;

  const paidFeatured =
    business.featured === true &&
    isPaidActive(business.paid_until);

  return {
    business,
    name:
      cleanText(business.name, 200) ??
      "Unnamed business",
    category: formatLabel(
      business.category
    ),
    area: cleanText(business.area, 160),
    address: buildAddress(business),
    distance: formatDistance(
      business.distanceMiles
    ),
    cardImage: getCardImage(business),
    logoUrl: normaliseExternalUrl(
      business.logo_url
    ),
    websiteUrl,
    mapsUrl,
    phone,
    safeSlug,
    sponsored,
    paidFeatured,
    verified:
      business.is_verified === true,
    trust: getBusinessTrust(business),
    smartBadges: getSmartBadges({
      is_verified:
        business.is_verified,
      featured: business.featured,
      sponsor_mosque_id:
        business.sponsor_mosque_id,
      mosqueId,
      pricing_tier:
        business.pricing_tier,
      paid_until:
        business.paid_until,
      halal_confidence:
        business.halal_confidence,
      review_status:
        business.review_status,
      is_live: business.is_live,
      distance_miles:
        business.distanceMiles,
      has_coordinates:
        isCoordinate(business.latitude) &&
        isCoordinate(business.longitude),
      has_phone: Boolean(phone),
      has_website: Boolean(websiteUrl),
    }),
  };
}

function getSummaryMetrics(
  businesses: BusinessCardModel[]
): {
  total: number;
  sponsored: number;
  verified: number;
  distanceKnown: number;
} {
  return {
    total: businesses.length,
    sponsored: businesses.filter(
      (item) => item.sponsored
    ).length,
    verified: businesses.filter(
      (item) => item.verified
    ).length,
    distanceKnown: businesses.filter(
      (item) =>
        item.business.distanceMiles !== null
    ).length,
  };
}

export default async function MosqueNearbyBusinesses({
  mosqueId,
  mosqueName,
  mosqueSlug,
  cityName,
  latitude,
  longitude,
}: Props) {
  const safeMosqueId = UUID_REGEX.test(
    mosqueId
  )
    ? mosqueId
    : null;

  const safeMosqueSlug =
    mosqueSlug &&
    SLUG_REGEX.test(mosqueSlug)
      ? mosqueSlug
      : null;

  const cleanCityName =
    cleanText(cityName, 160);

  if (!safeMosqueId || !cleanCityName) {
    return null;
  }

  const supabase = supabasePublic();

  const { data, error } = await supabase
    .from("businesses")
    .select(
      `
      id,
      name,
      slug,
      category,
      city,
      area,
      address,
      postcode,
      phone,
      website,
      maps_url,
      logo_url,
      cover_image_url,
      gallery_urls,
      latitude,
      longitude,
      is_verified,
      featured,
      featured_rank,
      pricing_tier,
      paid_until,
      sponsor_mosque_id,
      halal_confidence,
      halal_score,
      review_status,
      is_live,
      quality_status,
      import_source
    `
    )
    .eq("city", cleanCityName)
    .eq("is_live", true)
    .eq("is_active", true)
    .order("featured", {
      ascending: false,
    })
    .limit(QUERY_LIMIT);

  if (error) {
    console.error(
      "Nearby mosque businesses load failed:",
      {
        mosqueId: safeMosqueId,
        cityName: cleanCityName,
        code: error.code,
        message: error.message,
      }
    );

    return (
      <NearbyBusinessesError
        cityName={cleanCityName}
      />
    );
  }

  const safeRows = getSafeBusinessRows(
    (data ?? []) as BusinessRow[]
  );

  const ranked = sortBusinessesByRank(
    safeRows,
    {
      mosqueId: safeMosqueId,
      cityName: cleanCityName,
    }
  ) as BusinessRow[];

  const businesses = ranked
    .map((business) => ({
      ...business,
      distanceMiles: getDistance(
        latitude,
        longitude,
        business.latitude,
        business.longitude
      ),
    }))
    .sort((first, second) => {
      const firstSponsored =
        first.sponsor_mosque_id ===
        safeMosqueId
          ? 1
          : 0;

      const secondSponsored =
        second.sponsor_mosque_id ===
        safeMosqueId
          ? 1
          : 0;

      if (
        firstSponsored !== secondSponsored
      ) {
        return (
          secondSponsored -
          firstSponsored
        );
      }

      const firstFeatured =
        first.featured &&
        isPaidActive(first.paid_until)
          ? 1
          : 0;

      const secondFeatured =
        second.featured &&
        isPaidActive(second.paid_until)
          ? 1
          : 0;

      if (
        firstFeatured !== secondFeatured
      ) {
        return (
          secondFeatured -
          firstFeatured
        );
      }

      const firstTrust =
        getBusinessTrust(first).score;

      const secondTrust =
        getBusinessTrust(second).score;

      if (firstTrust !== secondTrust) {
        return secondTrust - firstTrust;
      }

      const distanceDifference =
        getDistancePriority(
          first.distanceMiles
        ) -
        getDistancePriority(
          second.distanceMiles
        );

      if (
        Number.isFinite(
          distanceDifference
        ) &&
        distanceDifference !== 0
      ) {
        return distanceDifference;
      }

      return (
        cleanText(first.name, 200) ?? ""
      ).localeCompare(
        cleanText(second.name, 200) ?? "",
        "en-GB"
      );
    })
    .slice(0, DISPLAY_LIMIT)
    .map((business) =>
      getBusinessModel(
        business,
        safeMosqueId
      )
    );

  const summary =
    getSummaryMetrics(businesses);

  const cleanMosqueName =
    cleanText(mosqueName, 200) ??
    "this mosque";

  return (
    <section
      aria-labelledby="nearby-halal-businesses-heading"
      className="luxe-card relative isolate overflow-hidden rounded-[2rem] border border-yellow-500/20 p-6 sm:p-8"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,0.10),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.05),transparent_28%)]"
      />

      <div className="flex flex-col gap-6 border-b border-white/10 pb-6 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-yellow-300">
            <Icon
              name="store"
              className="h-4 w-4"
            />
            Local halal discovery
          </div>

          <h2
            id="nearby-halal-businesses-heading"
            className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl"
          >
            Halal businesses near{" "}
            <span className="text-yellow-300">
              {cleanMosqueName}
            </span>
          </h2>

          <p className="mt-3 max-w-3xl text-sm leading-7 text-white/60 sm:text-base">
            Discover approved halal businesses in{" "}
            {cleanCityName}. Active sponsorship,
            listing quality, verification, trust and
            available distance data help determine
            visibility.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href={`/${encodeURIComponent(
              safeMosqueSlug
                ? cleanCityName
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-|-$/g, "")
                : cleanCityName
            )}/businesses`}
            className="luxe-button-outline inline-flex min-h-11 items-center justify-center px-5 py-3 text-sm"
          >
            Browse city businesses
            <Icon
              name="arrow"
              className="ml-2 h-4 w-4"
            />
          </Link>

          {safeMosqueSlug ? (
            <Link
              href={`/sponsor/mosque/${safeMosqueSlug}`}
              className="luxe-button inline-flex min-h-11 items-center justify-center px-5 py-3 text-sm"
            >
              Promote near this mosque
            </Link>
          ) : null}
        </div>
      </div>

      {businesses.length > 0 ? (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryMetric
              label="Shown nearby"
              value={String(summary.total)}
              helper="Ranked live listings"
              icon="building"
            />

            <SummaryMetric
              label="Mosque sponsors"
              value={String(summary.sponsored)}
              helper="Supporting this profile"
              icon="star"
            />

            <SummaryMetric
              label="Verified"
              value={String(summary.verified)}
              helper="Confirmed listings"
              icon="check"
            />

            <SummaryMetric
              label="Distance known"
              value={String(summary.distanceKnown)}
              helper="Coordinates available"
              icon="route"
            />
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {businesses.map(
              (model, index) => (
                <BusinessCard
                  key={model.business.id}
                  model={model}
                  mosqueId={safeMosqueId}
                  position={index + 1}
                />
              )
            )}
          </div>

          <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-xs leading-6 text-white/40 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2">
              <Icon
                name="shield"
                className="mt-1 h-4 w-4 shrink-0"
              />

              <p>
                Listings are ranked using active
                sponsorship, verification, trust,
                quality and distance signals.
                Sponsorship does not replace halal
                due diligence.
              </p>
            </div>

            {safeMosqueSlug ? (
              <Link
                href={`/sponsor/mosque/${safeMosqueSlug}`}
                className="shrink-0 font-bold text-yellow-300 transition hover:text-yellow-200"
              >
                Learn about sponsorship →
              </Link>
            ) : null}
          </div>
        </>
      ) : (
        <EmptyBusinessesState
          cityName={cleanCityName}
          mosqueSlug={safeMosqueSlug}
        />
      )}
    </section>
  );
}

function BusinessCard({
  model,
  mosqueId,
  position,
}: {
  model: BusinessCardModel;
  mosqueId: string;
  position: number;
}) {
  const {
    business,
    name,
    category,
    area,
    address,
    distance,
    cardImage,
    logoUrl,
    websiteUrl,
    mapsUrl,
    phone,
    safeSlug,
    sponsored,
    paidFeatured,
    verified,
    trust,
    smartBadges,
  } = model;

  const showSeparateLogo =
    Boolean(logoUrl) &&
    Boolean(cardImage) &&
    logoUrl !== cardImage;

  const metadata = {
    mosque_id: mosqueId,
    rank_position: position,
    sponsored,
    featured: paidFeatured,
  };

  return (
    <article
      className={`group relative flex h-full flex-col overflow-hidden rounded-3xl border bg-black/25 transition duration-300 hover:-translate-y-1 ${
        sponsored
          ? "border-yellow-400/45 shadow-[0_18px_55px_rgba(212,175,55,0.10)]"
          : paidFeatured
            ? "border-yellow-500/25 shadow-[0_16px_45px_rgba(0,0,0,0.22)]"
            : "border-white/10 hover:border-yellow-500/30"
      }`}
    >
      <div className="relative min-h-44 overflow-hidden border-b border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,0.14),transparent_40%),linear-gradient(135deg,rgba(255,255,255,0.04),rgba(0,0,0,0.16))]">
        {cardImage ? (
          <>
            <img
              src={cardImage}
              alt={`${name} listing image`}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              className="h-44 w-full object-cover transition duration-500 group-hover:scale-[1.035]"
            />

            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-transparent" />
          </>
        ) : (
          <div className="flex h-44 items-center justify-center">
            <span className="flex h-20 w-20 items-center justify-center rounded-3xl border border-yellow-500/20 bg-yellow-500/[0.08] text-yellow-300">
              <Icon
                name="store"
                className="h-10 w-10"
              />
            </span>
          </div>
        )}

        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          {sponsored ? (
            <StatusBadge
              label="Mosque sponsor"
              tone="gold"
              icon="star"
            />
          ) : null}

          {!sponsored && paidFeatured ? (
            <StatusBadge
              label="Featured"
              tone="gold"
              icon="sparkles"
            />
          ) : null}

          {verified ? (
            <StatusBadge
              label="Verified"
              tone="green"
              icon="check"
            />
          ) : null}
        </div>

        {showSeparateLogo ? (
          <div className="absolute bottom-4 left-4">
            <img
              src={logoUrl ?? ""}
              alt={`${name} logo`}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              className="h-16 w-16 rounded-2xl border border-white/15 bg-black object-cover p-1 shadow-xl"
            />
          </div>
        ) : null}

        {distance ? (
          <div className="absolute bottom-4 right-4 rounded-full border border-white/15 bg-black/75 px-3 py-1.5 text-[0.7rem] font-black text-white/80 backdrop-blur">
            <span className="inline-flex items-center gap-1.5">
              <Icon
                name="route"
                className="h-3.5 w-3.5"
              />
              {distance}
            </span>
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[0.65rem] font-black uppercase tracking-[0.17em] text-yellow-300">
              {category}
            </div>

            {safeSlug ? (
              <BusinessTrackedLink
                businessId={business.id}
                href={`/business/${safeSlug}`}
                eventType="profile_click"
                source="mosque_nearby_businesses"
                pageType="mosque_nearby_businesses"
                metadata={metadata}
                className="mt-2 block break-words text-xl font-black tracking-tight text-white transition hover:text-yellow-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"
              >
                {name}
              </BusinessTrackedLink>
            ) : (
              <h3 className="mt-2 break-words text-xl font-black tracking-tight text-white">
                {name}
              </h3>
            )}

            {area ? (
              <div className="mt-2 flex items-center gap-1.5 text-sm text-white/50">
                <Icon
                  name="location"
                  className="h-4 w-4 shrink-0"
                />
                <span className="truncate">
                  {area}
                </span>
              </div>
            ) : null}
          </div>

          <div className="shrink-0 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[0.65rem] font-black text-white/45">
            #{position}
          </div>
        </div>

        <div className="mt-4">
          <TrustBadge result={trust} />
        </div>

        {smartBadges.length > 0 ? (
          <div className="mt-3">
            <SmartBadges
              badges={smartBadges}
            />
          </div>
        ) : null}

        {address ? (
          <div className="mt-4 flex items-start gap-2 rounded-2xl border border-white/10 bg-white/[0.025] p-3 text-xs leading-6 text-white/55">
            <Icon
              name="map"
              className="mt-1 h-4 w-4 shrink-0 text-yellow-300"
            />
            <span dir="auto">
              {address}
            </span>
          </div>
        ) : null}

        <div className="mt-auto pt-5">
          <div className="grid grid-cols-2 gap-2">
            {safeSlug ? (
              <BusinessTrackedLink
                businessId={business.id}
                href={`/business/${safeSlug}`}
                eventType="profile_click"
                source="mosque_nearby_businesses"
                pageType="mosque_nearby_businesses"
                metadata={metadata}
                className="col-span-2 inline-flex min-h-11 items-center justify-center rounded-xl border border-yellow-400/30 bg-yellow-500/15 px-4 py-2 text-sm font-black text-yellow-100 transition hover:bg-yellow-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"
              >
                View business profile
                <Icon
                  name="arrow"
                  className="ml-2 h-4 w-4"
                />
              </BusinessTrackedLink>
            ) : null}

            {mapsUrl ? (
              <BusinessTrackedLink
                businessId={business.id}
                href={mapsUrl}
                eventType="maps_click"
                source="mosque_nearby_businesses"
                pageType="mosque_nearby_businesses"
                metadata={metadata}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-xs font-bold text-white/70 transition hover:border-yellow-500/30 hover:text-yellow-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"
              >
                <Icon
                  name="map"
                  className="mr-2 h-4 w-4"
                />
                Directions
              </BusinessTrackedLink>
            ) : null}

            {phone ? (
              <BusinessTrackedLink
                businessId={business.id}
                href={`tel:${phone}`}
                eventType="phone_click"
                source="mosque_nearby_businesses"
                pageType="mosque_nearby_businesses"
                metadata={metadata}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-xs font-bold text-white/70 transition hover:border-yellow-500/30 hover:text-yellow-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"
              >
                <Icon
                  name="call"
                  className="mr-2 h-4 w-4"
                />
                Call
              </BusinessTrackedLink>
            ) : null}

            {websiteUrl ? (
              <BusinessTrackedLink
                businessId={business.id}
                href={websiteUrl}
                eventType="website_click"
                source="mosque_nearby_businesses"
                pageType="mosque_nearby_businesses"
                metadata={metadata}
                target="_blank"
                rel="noopener noreferrer"
                className={`${mapsUrl && phone ? "col-span-2" : ""} inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-xs font-bold text-white/70 transition hover:border-yellow-500/30 hover:text-yellow-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300`}
              >
                <Icon
                  name="website"
                  className="mr-2 h-4 w-4"
                />
                Website
              </BusinessTrackedLink>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

function SummaryMetric({
  label,
  value,
  helper,
  icon,
}: {
  label: string;
  value: string;
  helper: string;
  icon: IconName;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-white/40">
            {label}
          </div>

          <div className="mt-2 text-2xl font-black text-white">
            {value}
          </div>

          <div className="mt-1 text-[0.7rem] leading-5 text-white/40">
            {helper}
          </div>
        </div>

        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-yellow-500/20 bg-yellow-500/[0.08] text-yellow-300">
          <Icon
            name={icon}
            className="h-5 w-5"
          />
        </span>
      </div>
    </article>
  );
}

function StatusBadge({
  label,
  tone,
  icon,
}: {
  label: string;
  tone: "gold" | "green";
  icon: IconName;
}) {
  const className =
    tone === "green"
      ? "border-emerald-400/30 bg-emerald-500/20 text-emerald-100"
      : "border-yellow-400/35 bg-yellow-500/20 text-yellow-100";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.65rem] font-black backdrop-blur ${className}`}
    >
      <Icon
        name={icon}
        className="h-3.5 w-3.5"
      />
      {label}
    </span>
  );
}

function NearbyBusinessesError({
  cityName,
}: {
  cityName: string;
}) {
  return (
    <section
      role="alert"
      className="rounded-[2rem] border border-red-500/20 bg-red-500/[0.08] p-6 sm:p-8"
    >
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-red-500/25 bg-red-500/10 text-red-200">
          <Icon
            name="store"
            className="h-5 w-5"
          />
        </span>

        <div>
          <h2 className="text-xl font-black text-red-100">
            Nearby businesses are temporarily
            unavailable
          </h2>

          <p className="mt-2 text-sm leading-7 text-red-100/65">
            We could not load approved halal
            businesses in {cityName}. Please try
            again shortly.
          </p>
        </div>
      </div>
    </section>
  );
}

function EmptyBusinessesState({
  cityName,
  mosqueSlug,
}: {
  cityName: string;
  mosqueSlug: string | null;
}) {
  return (
    <div className="mt-6 rounded-3xl border border-dashed border-white/15 bg-black/20 p-6 sm:p-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex max-w-2xl items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-yellow-500/20 bg-yellow-500/[0.08] text-yellow-300">
            <Icon
              name="store"
              className="h-6 w-6"
            />
          </span>

          <div>
            <h3 className="text-lg font-black text-white">
              No approved nearby listings yet
            </h3>

            <p className="mt-2 text-sm leading-7 text-white/55">
              No active halal businesses are
              currently available for this mosque in{" "}
              {cityName}. New approved listings will
              appear here automatically.
            </p>
          </div>
        </div>

        {mosqueSlug ? (
          <Link
            href={`/sponsor/mosque/${mosqueSlug}`}
            className="luxe-button shrink-0 px-5 py-3 text-sm"
          >
            Promote a halal business
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function Icon({
  name,
  className,
}: {
  name: IconName;
  className?: string;
}) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };

  if (name === "arrow") {
    return (
      <svg {...common}>
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
      </svg>
    );
  }

  if (name === "building") {
    return (
      <svg {...common}>
        <path d="M4 21V5l8-3v19" />
        <path d="M12 9h8v12" />
        <path d="M8 7v.01M8 11v.01M8 15v.01M16 13v.01M16 17v.01" />
        <path d="M2 21h20" />
      </svg>
    );
  }

  if (name === "call") {
    return (
      <svg {...common}>
        <path d="M22 16.9v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.62 2.63a2 2 0 0 1-.45 2.11L8 9.73a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.85.29 1.73.5 2.63.62A2 2 0 0 1 22 16.9Z" />
      </svg>
    );
  }

  if (name === "check") {
    return (
      <svg {...common}>
        <path d="m5 12 4 4L19 6" />
      </svg>
    );
  }

  if (name === "location") {
    return (
      <svg {...common}>
        <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </svg>
    );
  }

  if (name === "map") {
    return (
      <svg {...common}>
        <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" />
        <path d="M9 3v15M15 6v15" />
      </svg>
    );
  }

  if (name === "mosque") {
    return (
      <svg {...common}>
        <path d="M5 21V10M19 21V10M3 21h18" />
        <path d="M5 10h14M7 10V7h10v3" />
        <path d="M12 3c1.6 1.1 2.4 2.4 2.4 4H9.6C9.6 5.4 10.4 4.1 12 3Z" />
        <path d="M10 21v-5a2 2 0 0 1 4 0v5" />
      </svg>
    );
  }

  if (name === "route") {
    return (
      <svg {...common}>
        <circle cx="6" cy="19" r="2" />
        <circle cx="18" cy="5" r="2" />
        <path d="M8 19h3a4 4 0 0 0 4-4v-1a4 4 0 0 0-4-4H9a3 3 0 0 1-3-3V7" />
      </svg>
    );
  }

  if (name === "shield") {
    return (
      <svg {...common}>
        <path d="M12 3 5 6v5c0 4.8 2.9 8.1 7 10 4.1-1.9 7-5.2 7-10V6l-7-3Z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    );
  }

  if (name === "sparkles") {
    return (
      <svg {...common}>
        <path d="m12 3-1.4 3.6L7 8l3.6 1.4L12 13l1.4-3.6L17 8l-3.6-1.4L12 3Z" />
        <path d="m5 14-.8 2.2L2 17l2.2.8L5 20l.8-2.2L8 17l-2.2-.8L5 14ZM19 13l-.7 1.8-1.8.7 1.8.7L19 18l.7-1.8 1.8-.7-1.8-.7L19 13Z" />
      </svg>
    );
  }

  if (name === "star") {
    return (
      <svg {...common}>
        <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2 7.5 14 3 9.6l6.2-.9L12 3Z" />
      </svg>
    );
  }

  if (name === "website") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M4 10h16v11H4z" />
      <path d="m3 10 2-5h14l2 5" />
      <path d="M8 10v11M16 10v11" />
      <path d="M9 15h6" />
    </svg>
  );
}