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

type BusinessWithDistance =
  BusinessRow & {
    distanceMiles: number | null;
  };

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SLUG_REGEX =
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const QUERY_LIMIT = 80;
const DISPLAY_LIMIT = 6;

function cleanText(
  value: string | null | undefined
): string | null {
  const cleaned = value?.trim();

  return cleaned ? cleaned : null;
}

function formatLabel(
  value: string | null | undefined
): string {
  const cleaned = cleanText(value);

  if (!cleaned) {
    return "Halal business";
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
  const cleaned = cleanText(value);

  if (!cleaned) {
    return null;
  }

  const candidate = /^https?:\/\//i.test(
    cleaned
  )
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
  const cleaned = cleanText(value);

  if (!cleaned) {
    return null;
  }

  const phone = cleaned.replace(
    /[^\d+]/g,
    ""
  );

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
    const url =
      normaliseExternalUrl(candidate);

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
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const radiusMiles = 3958.8;

  const toRadians = (value: number) =>
    (value * Math.PI) / 180;

  const latitudeDifference =
    toRadians(lat2 - lat1);

  const longitudeDifference =
    toRadians(lon2 - lon1);

  const a =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(
        longitudeDifference / 2
      ) **
        2;

  const bounded = Math.min(
    1,
    Math.max(0, a)
  );

  return (
    2 *
    radiusMiles *
    Math.asin(Math.sqrt(bounded))
  );
}

function getDistance(
  mosqueLat: number | null,
  mosqueLng: number | null,
  businessLat: number | null,
  businessLng: number | null
): number | null {
  if (
    !isCoordinate(mosqueLat) ||
    !isCoordinate(mosqueLng) ||
    !isCoordinate(businessLat) ||
    !isCoordinate(businessLng)
  ) {
    return null;
  }

  return haversineMiles(
    mosqueLat,
    mosqueLng,
    businessLat,
    businessLng
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

  return `${distance.toFixed(1)} miles`;
}

function isPaidActive(
  value: string | null | undefined
): boolean {
  if (!value) {
    return false;
  }

  const timestamp = new Date(
    value
  ).getTime();

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
    review_status:
      business.review_status,
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
  const seen = new Set<string>();

  return rows.filter((business) => {
    if (
      !UUID_REGEX.test(business.id) ||
      seen.has(business.id)
    ) {
      return false;
    }

    seen.add(business.id);
    return true;
  });
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
    cleanText(cityName);

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
      <section
        role="alert"
        className="rounded-3xl border border-red-500/20 bg-red-500/10 p-6 text-sm text-red-200"
      >
        Nearby halal businesses are temporarily
        unavailable.
      </section>
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

  const businesses: BusinessWithDistance[] =
    ranked
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
          firstSponsored !==
          secondSponsored
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
          firstFeatured !==
          secondFeatured
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

        if (
          first.distanceMiles !== null &&
          second.distanceMiles !== null
        ) {
          return (
            first.distanceMiles -
            second.distanceMiles
          );
        }

        if (
          first.distanceMiles !== null
        ) {
          return -1;
        }

        if (
          second.distanceMiles !== null
        ) {
          return 1;
        }

        return (
          cleanText(first.name) ?? ""
        ).localeCompare(
          cleanText(second.name) ?? "",
          "en-GB"
        );
      })
      .slice(0, DISPLAY_LIMIT);

  return (
    <section
      aria-labelledby="nearby-halal-businesses-heading"
      className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6 md:p-8"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
            Nearby halal businesses
          </div>

          <h2
            id="nearby-halal-businesses-heading"
            className="mt-3 text-3xl font-bold text-white"
          >
            Halal places near{" "}
            {cleanText(mosqueName) ??
              "this mosque"}
          </h2>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/70">
            Discover live halal business listings
            near this mosque. Sponsorship,
            verification, trust and distance help
            determine visibility.
          </p>
        </div>

        {safeMosqueSlug ? (
          <Link
            href={`/sponsor/mosque/${safeMosqueSlug}`}
            className="rounded-xl bg-yellow-500 px-5 py-3 text-sm font-semibold text-black transition hover:bg-yellow-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"
          >
            Promote near this mosque
          </Link>
        ) : null}
      </div>

      {businesses.length > 0 ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {businesses.map((business) => {
            const distance = formatDistance(
              business.distanceMiles
            );

            const sponsored =
              business.sponsor_mosque_id ===
              safeMosqueId;

            const paidFeatured =
              business.featured === true &&
              isPaidActive(
                business.paid_until
              );

            const trust =
              getBusinessTrust(business);

            const cardImage =
              getCardImage(business);

            const logoUrl =
              normaliseExternalUrl(
                business.logo_url
              );

            const websiteUrl =
              normaliseExternalUrl(
                business.website
              );

            const mapsUrl =
              normaliseExternalUrl(
                business.maps_url
              );

            const phone =
              normalisePhone(
                business.phone
              );

            const safeSlug =
              business.slug &&
              SLUG_REGEX.test(
                business.slug
              )
                ? business.slug
                : null;

            const smartBadges =
              getSmartBadges({
                is_verified:
                  business.is_verified,
                featured:
                  business.featured,
                sponsor_mosque_id:
                  business.sponsor_mosque_id,
                mosqueId:
                  safeMosqueId,
                pricing_tier:
                  business.pricing_tier,
                paid_until:
                  business.paid_until,
                halal_confidence:
                  business.halal_confidence,
                review_status:
                  business.review_status,
                is_live:
                  business.is_live,
                distance_miles:
                  business.distanceMiles,
                has_coordinates:
                  isCoordinate(
                    business.latitude
                  ) &&
                  isCoordinate(
                    business.longitude
                  ),
                has_phone:
                  Boolean(phone),
                has_website:
                  Boolean(websiteUrl),
              });

            const address = [
              cleanText(business.address),
              cleanText(business.postcode),
            ]
              .filter(Boolean)
              .join(" • ");

            return (
              <article
                key={business.id}
                className={`overflow-hidden rounded-2xl border bg-black/30 transition ${
                  sponsored
                    ? "border-yellow-500/40 shadow-[0_0_28px_rgba(212,175,55,0.08)]"
                    : "border-yellow-500/20 hover:border-yellow-400/50"
                }`}
              >
                {cardImage ? (
                  <div className="relative h-36 overflow-hidden bg-black">
                    <img
                      src={cardImage}
                      alt={`${cleanText(
                        business.name
                      ) ?? "Business"} image`}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />

                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                    {logoUrl &&
                    business.cover_image_url ? (
                      <img
                        src={logoUrl}
                        alt={`${cleanText(
                          business.name
                        ) ?? "Business"} logo`}
                        loading="lazy"
                        decoding="async"
                        className="absolute bottom-3 left-3 h-14 w-14 rounded-2xl border border-yellow-500/30 bg-black object-cover p-1"
                      />
                    ) : null}
                  </div>
                ) : null}

                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {safeSlug ? (
                        <BusinessTrackedLink
                          businessId={business.id}
                          href={`/business/${safeSlug}`}
                          eventType="profile_click"
                          source="mosque_nearby_businesses"
                          pageType="mosque_nearby_businesses"
                          className="break-words text-lg font-bold text-white transition hover:text-yellow-400"
                          metadata={{
                            mosque_id:
                              safeMosqueId,
                          }}
                        >
                          {cleanText(
                            business.name
                          ) ??
                            "Unnamed business"}
                        </BusinessTrackedLink>
                      ) : (
                        <div className="break-words text-lg font-bold text-white">
                          {cleanText(
                            business.name
                          ) ??
                            "Unnamed business"}
                        </div>
                      )}

                      <div className="mt-2 text-sm text-white/60">
                        {[
                          formatLabel(
                            business.category
                          ),
                          cleanText(
                            business.area
                          ),
                        ]
                          .filter(Boolean)
                          .join(" • ")}
                      </div>

                      <div className="mt-3">
                        <TrustBadge
                          result={trust}
                        />
                      </div>

                      <div className="mt-3">
                        <SmartBadges
                          badges={smartBadges}
                        />
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-2">
                      {sponsored ? (
                        <span className="rounded-full bg-yellow-500 px-2 py-1 text-[10px] font-bold text-black">
                          Sponsor
                        </span>
                      ) : null}

                      {paidFeatured ? (
                        <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2 py-1 text-[10px] font-semibold text-yellow-400">
                          Featured
                        </span>
                      ) : null}

                      {business.is_verified ? (
                        <span className="rounded-full border border-green-500/30 bg-green-500/10 px-2 py-1 text-[10px] font-semibold text-green-300">
                          Verified
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {address ? (
                    <div className="mt-4 text-sm leading-6 text-white/70">
                      {address}
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    {distance ? (
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/70">
                        {distance}
                      </span>
                    ) : null}

                    {business.halal_confidence ? (
                      <span className="rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-green-300">
                        {formatLabel(
                          business.halal_confidence
                        )}{" "}
                        halal confidence
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {safeSlug ? (
                      <BusinessTrackedLink
                        businessId={business.id}
                        href={`/business/${safeSlug}`}
                        eventType="profile_click"
                        source="mosque_nearby_businesses"
                        pageType="mosque_nearby_businesses"
                        className="rounded-xl border border-yellow-500/30 bg-black px-3 py-2 text-xs font-semibold text-yellow-400 transition hover:bg-yellow-500/10"
                        metadata={{
                          mosque_id:
                            safeMosqueId,
                        }}
                      >
                        View
                      </BusinessTrackedLink>
                    ) : null}

                    {mapsUrl ? (
                      <BusinessTrackedLink
                        businessId={business.id}
                        href={mapsUrl}
                        eventType="maps_click"
                        source="mosque_nearby_businesses"
                        pageType="mosque_nearby_businesses"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-xl border border-yellow-500/30 bg-black px-3 py-2 text-xs font-semibold text-yellow-400 transition hover:bg-yellow-500/10"
                        metadata={{
                          mosque_id:
                            safeMosqueId,
                        }}
                      >
                        Map
                      </BusinessTrackedLink>
                    ) : null}

                    {websiteUrl ? (
                      <BusinessTrackedLink
                        businessId={business.id}
                        href={websiteUrl}
                        eventType="website_click"
                        source="mosque_nearby_businesses"
                        pageType="mosque_nearby_businesses"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-xl border border-white/10 bg-black px-3 py-2 text-xs font-semibold text-white transition hover:border-yellow-500/30"
                        metadata={{
                          mosque_id:
                            safeMosqueId,
                        }}
                      >
                        Website
                      </BusinessTrackedLink>
                    ) : null}

                    {phone ? (
                      <BusinessTrackedLink
                        businessId={business.id}
                        href={`tel:${phone}`}
                        eventType="phone_click"
                        source="mosque_nearby_businesses"
                        pageType="mosque_nearby_businesses"
                        className="rounded-xl border border-white/10 bg-black px-3 py-2 text-xs font-semibold text-white transition hover:border-yellow-500/30"
                        metadata={{
                          mosque_id:
                            safeMosqueId,
                        }}
                      >
                        Call
                      </BusinessTrackedLink>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-6 text-sm text-white/60">
          No approved halal businesses are live near
          this mosque yet.
        </div>
      )}
    </section>
  );
}