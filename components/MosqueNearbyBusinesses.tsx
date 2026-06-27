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

function label(value: string | null | undefined) {
  if (!value) {
    return "Halal business";
  }

  return value
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function normaliseExternalUrl(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://")
  ) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

function getCardImage(business: BusinessRow) {
  return (
    business.cover_image_url ||
    business.logo_url ||
    business.gallery_urls?.[0] ||
    null
  );
}

function haversineMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const radiusMiles = 3958.8;
  const toRad = (n: number) => (n * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return 2 * radiusMiles * Math.asin(Math.sqrt(a));
}

function getDistance(
  mosqueLat: number | null,
  mosqueLng: number | null,
  businessLat: number | null,
  businessLng: number | null
) {
  if (
    typeof mosqueLat !== "number" ||
    typeof mosqueLng !== "number" ||
    typeof businessLat !== "number" ||
    typeof businessLng !== "number"
  ) {
    return null;
  }

  return haversineMiles(mosqueLat, mosqueLng, businessLat, businessLng);
}

function formatDistance(distance: number | null) {
  if (distance === null) {
    return null;
  }

  if (distance < 0.1) {
    return "Under 0.1 miles";
  }

  return `${distance.toFixed(1)} miles`;
}

function isPaidActive(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  const time = new Date(value).getTime();

  return Number.isFinite(time) && time > Date.now();
}

function getBusinessTrust(business: BusinessWithDistance) {
  return calculateTrustScore({
    is_verified: business.is_verified,
    featured: business.featured,
    pricing_tier: business.pricing_tier,
    paid_until: business.paid_until,
    halal_confidence: business.halal_confidence,
    halal_score: business.halal_score,
    review_status: business.review_status,
    is_live: business.is_live,
    quality_status: business.quality_status,
    source: business.import_source,
    distance_miles: business.distanceMiles,
    has_coordinates:
      typeof business.latitude === "number" &&
      typeof business.longitude === "number",
    has_phone: !!business.phone,
    has_website: !!business.website,
    has_address: !!business.address,
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
  const supabase = supabasePublic();

  if (!cityName) {
    return null;
  }

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
    .eq("city", cityName)
    .eq("is_live", true)
    .eq("is_active", true)
    .order("featured", {
      ascending: false,
    })
    .limit(80);

  if (error) {
    return (
      <section className="rounded-3xl border border-red-500/20 bg-red-500/10 p-6 text-red-200">
        {error.message}
      </section>
    );
  }

  const ranked = sortBusinessesByRank((data ?? []) as BusinessRow[], {
    mosqueId,
    cityName,
  }) as BusinessRow[];

  const businesses: BusinessWithDistance[] = ranked
    .map((business) => ({
      ...business,
      distanceMiles: getDistance(
        latitude,
        longitude,
        business.latitude,
        business.longitude
      ),
    }))
    .sort((a, b) => {
      const aSponsored = a.sponsor_mosque_id === mosqueId ? 1 : 0;
      const bSponsored = b.sponsor_mosque_id === mosqueId ? 1 : 0;

      if (aSponsored !== bSponsored) {
        return bSponsored - aSponsored;
      }

      const aFeatured =
        a.featured && isPaidActive(a.paid_until) ? 1 : 0;
      const bFeatured =
        b.featured && isPaidActive(b.paid_until) ? 1 : 0;

      if (aFeatured !== bFeatured) {
        return bFeatured - aFeatured;
      }

      const trustA = getBusinessTrust(a).score;
      const trustB = getBusinessTrust(b).score;

      if (trustA !== trustB) {
        return trustB - trustA;
      }

      if (a.distanceMiles !== null && b.distanceMiles !== null) {
        return a.distanceMiles - b.distanceMiles;
      }

      return (a.name ?? "").localeCompare(b.name ?? "");
    })
    .slice(0, 6);

  return (
    <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
            Nearby Halal Businesses
          </div>

          <h2 className="mt-3 text-3xl font-bold text-white">
            Halal places near {mosqueName ?? "this mosque"}
          </h2>

          <p className="mt-3 max-w-3xl text-white/70">
            Approved halal businesses near this mosque. Sponsored, verified, and
            trusted businesses appear with stronger visibility.
          </p>
        </div>

        {mosqueSlug ? (
          <Link
            href={`/sponsor/mosque/${mosqueSlug}`}
            className="rounded-xl bg-yellow-500 px-5 py-3 text-sm font-semibold text-black hover:bg-yellow-400"
          >
            Promote near this mosque
          </Link>
        ) : null}
      </div>

      {businesses.length > 0 ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {businesses.map((business) => {
            const distance = formatDistance(business.distanceMiles);
            const sponsored = business.sponsor_mosque_id === mosqueId;
            const trust = getBusinessTrust(business);
            const cardImage = getCardImage(business);
            const websiteUrl = normaliseExternalUrl(business.website);
            const mapsUrl = normaliseExternalUrl(business.maps_url);

            const smartBadges = getSmartBadges({
              is_verified: business.is_verified,
              featured: business.featured,
              sponsor_mosque_id: business.sponsor_mosque_id,
              mosqueId,
              pricing_tier: business.pricing_tier,
              paid_until: business.paid_until,
              halal_confidence: business.halal_confidence,
              review_status: business.review_status,
              is_live: business.is_live,
              distance_miles: business.distanceMiles,
              has_coordinates:
                typeof business.latitude === "number" &&
                typeof business.longitude === "number",
              has_phone: !!business.phone,
              has_website: !!business.website,
            });

            return (
              <article
                key={business.id}
                className="overflow-hidden rounded-2xl border border-yellow-500/20 bg-black/30 transition hover:border-yellow-400/50"
              >
                {cardImage ? (
                  <div className="relative h-36 overflow-hidden">
                    <img
                      src={cardImage}
                      alt={`${business.name ?? "Business"} image`}
                      className="h-full w-full object-cover"
                    />

                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                    {business.logo_url && business.cover_image_url ? (
                      <img
                        src={business.logo_url}
                        alt={`${business.name ?? "Business"} logo`}
                        className="absolute bottom-3 left-3 h-14 w-14 rounded-2xl border border-yellow-500/30 bg-black object-cover p-1"
                      />
                    ) : null}
                  </div>
                ) : null}

                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {business.slug ? (
                        <BusinessTrackedLink
                          businessId={business.id}
                          href={`/business/${business.slug}`}
                          eventType="profile_click"
                          source="mosque_nearby_businesses"
                          pageType="mosque_nearby_businesses"
                          className="text-lg font-bold text-white hover:text-yellow-400"
                          metadata={{
                            mosque_id: mosqueId,
                          }}
                        >
                          {business.name ?? "Unnamed business"}
                        </BusinessTrackedLink>
                      ) : (
                        <div className="text-lg font-bold text-white">
                          {business.name ?? "Unnamed business"}
                        </div>
                      )}

                      <div className="mt-2 text-sm text-white/60">
                        {[label(business.category), business.area]
                          .filter(Boolean)
                          .join(" • ")}
                      </div>

                      <div className="mt-3">
                        <TrustBadge result={trust} />
                      </div>

                      <div className="mt-3">
                        <SmartBadges badges={smartBadges} />
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-2">
                      {sponsored ? (
                        <span className="rounded-full bg-yellow-500 px-2 py-1 text-[10px] font-bold text-black">
                          Sponsor
                        </span>
                      ) : null}

                      {business.featured ? (
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

                  {business.address ? (
                    <div className="mt-4 text-sm text-white/70">
                      {business.address}
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    {distance ? (
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/70">
                        📍 {distance}
                      </span>
                    ) : null}

                    {business.halal_confidence ? (
                      <span className="rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-green-300">
                        {label(business.halal_confidence)} halal confidence
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {business.slug ? (
                      <BusinessTrackedLink
                        businessId={business.id}
                        href={`/business/${business.slug}`}
                        eventType="profile_click"
                        source="mosque_nearby_businesses"
                        pageType="mosque_nearby_businesses"
                        className="rounded-xl border border-yellow-500/30 bg-black px-3 py-2 text-xs font-semibold text-yellow-400 hover:bg-yellow-500/10"
                        metadata={{
                          mosque_id: mosqueId,
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
                        rel="noreferrer"
                        className="rounded-xl border border-yellow-500/30 bg-black px-3 py-2 text-xs font-semibold text-yellow-400 hover:bg-yellow-500/10"
                        metadata={{
                          mosque_id: mosqueId,
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
                        rel="noreferrer"
                        className="rounded-xl border border-white/10 bg-black px-3 py-2 text-xs font-semibold text-white hover:border-yellow-500/30"
                        metadata={{
                          mosque_id: mosqueId,
                        }}
                      >
                        Website
                      </BusinessTrackedLink>
                    ) : null}

                    {business.phone ? (
                      <BusinessTrackedLink
                        businessId={business.id}
                        href={`tel:${business.phone}`}
                        eventType="phone_click"
                        source="mosque_nearby_businesses"
                        pageType="mosque_nearby_businesses"
                        className="rounded-xl border border-white/10 bg-black px-3 py-2 text-xs font-semibold text-white hover:border-yellow-500/30"
                        metadata={{
                          mosque_id: mosqueId,
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
        <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-6 text-white/60">
          No approved halal businesses are live near this mosque yet.
        </div>
      )}
    </section>
  );
}

