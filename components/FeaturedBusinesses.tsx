import Image from "next/image";
import Link from "next/link";

import BusinessTrackedLink from "@/components/BusinessTrackedLink";
import {
  isBusinessPaidActive,
  sortBusinessesByRank,
} from "@/lib/businessRanking";
import { supabasePublic } from "@/lib/supabaseServer";

type Props = {
  city?: string | null;
  citySlug?: string | null;
  limit?: number;
  className?: string;
};

type FeaturedBusinessRow = {
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
  maps_url: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  gallery_urls: string[] | null;
  featured: boolean | null;
  featured_rank: number | null;
  pricing_tier: string | null;
  subscription_type?: string | null;
  subscription_status?: string | null;
  paid_until: string | null;
  is_verified: boolean | null;
  sponsorship_active?: boolean | null;
  city_sponsor?: boolean | null;
  mosque_sponsor?: boolean | null;
  sponsor_mosque_id?: string | null;
  sponsor_city_id?: number | null;
  can_advertise?: boolean | null;
  is_live?: boolean | null;
  trust_score?: number | null;
  quality_score?: number | null;
  ranking_score?: number | null;
};

const DEFAULT_LIMIT = 6;
const MAX_QUERY_ROWS = 30;

function cleanText(
  value: string | null | undefined
): string {
  return String(value ?? "").trim();
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
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

function normaliseExternalUrl(
  value: string | null | undefined
): string | null {
  const trimmed = cleanText(value);

  if (!trimmed) {
    return null;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

function getCardImage(
  business: FeaturedBusinessRow
): string | null {
  return (
    cleanText(
      business.cover_image_url
    ) ||
    cleanText(business.logo_url) ||
    cleanText(
      business.gallery_urls?.[0]
    ) ||
    null
  );
}

function getInitials(
  value: string | null | undefined
): string {
  const name =
    cleanText(value) ||
    "Halal Business";

  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function isPromoted(
  business: FeaturedBusinessRow
): boolean {
  const active =
    isBusinessPaidActive(
      business.paid_until
    ) ||
    business.sponsorship_active ===
      true ||
    business.subscription_status ===
      "active" ||
    business.subscription_status ===
      "paypal_paid";

  return Boolean(
    active &&
      (business.featured ||
        business.city_sponsor ||
        business.mosque_sponsor ||
        business.sponsorship_active)
  );
}

export default async function FeaturedBusinesses({
  city = null,
  citySlug = null,
  limit = DEFAULT_LIMIT,
  className = "",
}: Props) {
  const safeLimit = Math.max(
    1,
    Math.min(limit, 12)
  );

  const supabase = supabasePublic();

  let query = supabase
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
      website,
      phone,
      maps_url,
      logo_url,
      cover_image_url,
      gallery_urls,
      featured,
      featured_rank,
      pricing_tier,
      subscription_type,
      subscription_status,
      paid_until,
      is_verified,
      sponsorship_active,
      city_sponsor,
      mosque_sponsor,
      sponsor_mosque_id,
      sponsor_city_id,
      can_advertise,
      is_live,
      trust_score,
      quality_score,
      ranking_score
    `
    )
    .eq("can_advertise", true)
    .eq("is_live", true)
    .not("slug", "is", null)
    .order("featured_rank", {
      ascending: true,
      nullsFirst: false,
    })
    .order("is_verified", {
      ascending: false,
    })
    .order("name", {
      ascending: true,
    })
    .limit(MAX_QUERY_ROWS);

  if (city) {
    query = query.eq("city", city);
  }

  const { data, error } =
    await query;

  if (error) {
    console.warn(
      "Featured businesses unavailable:",
      error.message
    );

    return null;
  }

  const rows =
    (data ??
      []) as unknown as FeaturedBusinessRow[];

  if (rows.length === 0) {
    return null;
  }

  const ranked =
    sortBusinessesByRank(rows, {
      cityName: city,
      rotateSponsors: true,
    });

  const promoted = ranked.filter(
    isPromoted
  );

  const verifiedFallback =
    ranked.filter(
      (business) =>
        business.is_verified &&
        !promoted.some(
          (promotedBusiness) =>
            promotedBusiness.id ===
            business.id
        )
    );

  const standardFallback =
    ranked.filter(
      (business) =>
        !promoted.some(
          (promotedBusiness) =>
            promotedBusiness.id ===
            business.id
        ) &&
        !verifiedFallback.some(
          (verifiedBusiness) =>
            verifiedBusiness.id ===
            business.id
        )
    );

  const businesses = [
    ...promoted,
    ...verifiedFallback,
    ...standardFallback,
  ].slice(0, safeLimit);

  if (businesses.length === 0) {
    return null;
  }

  const viewAllHref =
    citySlug
      ? `/${citySlug}/businesses`
      : "/businesses";

  return (
    <section
      aria-labelledby="featured-businesses-heading"
      className={[
        "premium-panel relative overflow-hidden rounded-[2rem] p-5 sm:p-7",
        className,
      ].join(" ")}
    >
      <div
        aria-hidden="true"
        className="absolute -left-28 -top-28 h-80 w-80 rounded-full border border-emerald-400/[0.08] bg-emerald-400/[0.02]"
      />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="section-kicker">
            Featured businesses
          </div>

          <h2
            id="featured-businesses-heading"
            className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl"
          >
            {city
              ? `Halal businesses in ${city}`
              : "Trusted halal businesses"}
          </h2>

          <p className="mt-3 max-w-3xl text-sm leading-7 text-white/55">
            Discover promoted, verified and
            high-quality Muslim-friendly
            businesses ranked by active
            placement and trust.
          </p>
        </div>

        <Link
          href={viewAllHref}
          className="inline-flex shrink-0 items-center gap-2 text-sm font-bold text-yellow-300 transition hover:text-yellow-100"
        >
          View all businesses
          <span aria-hidden="true">
            →
          </span>
        </Link>
      </div>

      <div className="relative mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {businesses.map(
          (business, index) => {
            const cardImage =
              getCardImage(business);

            const websiteUrl =
              normaliseExternalUrl(
                business.website
              );

            const mapsUrl =
              normaliseExternalUrl(
                business.maps_url
              );

            const promotedBusiness =
              isPromoted(business);

            const businessName =
              cleanText(
                business.name
              ) ||
              "Unnamed business";

            const location = [
              cleanText(
                business.area
              ),
              cleanText(
                business.city
              ),
              cleanText(
                business.postcode
              ),
            ]
              .filter(Boolean)
              .join(" • ");

            return (
              <article
                key={business.id}
                className={[
                  "group overflow-hidden rounded-[1.75rem] border bg-[#030a1d] transition duration-300 hover:-translate-y-1",
                  promotedBusiness
                    ? "border-yellow-400/35 shadow-[0_22px_65px_rgba(212,175,55,0.08)]"
                    : "border-white/10 hover:border-yellow-400/30",
                ].join(" ")}
              >
                <div className="relative h-44 overflow-hidden bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,0.14),transparent_45%),linear-gradient(145deg,#071532,#020718)]">
                  {cardImage ? (
                    <>
                      <Image
                        src={cardImage}
                        alt={`${businessName} image`}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                        className="object-cover transition duration-700 group-hover:scale-[1.05]"
                      />

                      <div className="absolute inset-0 bg-gradient-to-t from-[#030a1d] via-black/20 to-transparent" />
                    </>
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <div className="flex h-24 w-24 items-center justify-center rounded-full border border-yellow-400/20 bg-yellow-400/[0.08] text-3xl font-black text-yellow-300">
                        {getInitials(
                          business.name
                        )}
                      </div>
                    </div>
                  )}

                  <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                    {promotedBusiness ? (
                      <Badge>
                        Promoted
                      </Badge>
                    ) : null}

                    {business.is_verified ? (
                      <Badge variant="verified">
                        Verified
                      </Badge>
                    ) : null}

                    {index < 3 &&
                    promotedBusiness ? (
                      <Badge>
                        Top placement
                      </Badge>
                    ) : null}
                  </div>

                  {business.logo_url &&
                  business.cover_image_url ? (
                    <Image
                      src={business.logo_url}
                      alt={`${businessName} logo`}
                      width={56}
                      height={56}
                      className="absolute bottom-4 left-4 h-14 w-14 rounded-2xl border border-yellow-400/25 bg-black/80 object-cover p-1 shadow-xl"
                    />
                  ) : null}
                </div>

                <div className="p-5">
                  <div className="flex flex-wrap gap-2">
                    <Badge>
                      {formatLabel(
                        business.category
                      )}
                    </Badge>

                    {business.city_sponsor &&
                    promotedBusiness ? (
                      <Badge>
                        City sponsor
                      </Badge>
                    ) : null}

                    {business.mosque_sponsor &&
                    promotedBusiness ? (
                      <Badge>
                        Mosque sponsor
                      </Badge>
                    ) : null}
                  </div>

                  {business.slug ? (
                    <BusinessTrackedLink
                      businessId={
                        business.id
                      }
                      href={`/business/${business.slug}`}
                      eventType="profile_click"
                      source="featured_businesses"
                      pageType="homepage"
                      className="mt-4 block text-xl font-black text-white transition group-hover:text-yellow-300"
                    >
                      {businessName}
                    </BusinessTrackedLink>
                  ) : (
                    <h3 className="mt-4 text-xl font-black text-white">
                      {businessName}
                    </h3>
                  )}

                  <p className="mt-2 min-h-6 text-sm text-white/55">
                    {location ||
                      "Location details coming soon"}
                  </p>

                  {business.address ? (
                    <p className="mt-2 line-clamp-2 min-h-12 text-xs leading-6 text-white/40">
                      {business.address}
                    </p>
                  ) : (
                    <div className="min-h-14" />
                  )}

                  <div className="mt-5 flex flex-wrap gap-2 border-t border-white/10 pt-4">
                    {business.slug ? (
                      <BusinessTrackedLink
                        businessId={
                          business.id
                        }
                        href={`/business/${business.slug}`}
                        eventType="profile_click"
                        source="featured_businesses"
                        pageType="homepage"
                        className="premium-button px-4 py-2.5 text-xs"
                      >
                        View profile
                      </BusinessTrackedLink>
                    ) : null}

                    {mapsUrl ? (
                      <BusinessTrackedLink
                        businessId={
                          business.id
                        }
                        href={mapsUrl}
                        eventType="maps_click"
                        source="featured_businesses"
                        pageType="homepage"
                        target="_blank"
                        rel="noreferrer"
                        className="premium-button-outline px-4 py-2.5 text-xs"
                      >
                        Maps
                      </BusinessTrackedLink>
                    ) : null}

                    {websiteUrl ? (
                      <BusinessTrackedLink
                        businessId={
                          business.id
                        }
                        href={
                          websiteUrl
                        }
                        eventType="website_click"
                        source="featured_businesses"
                        pageType="homepage"
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-bold text-white transition hover:border-yellow-400/30"
                      >
                        Website
                      </BusinessTrackedLink>
                    ) : null}

                    {business.phone ? (
                      <BusinessTrackedLink
                        businessId={
                          business.id
                        }
                        href={`tel:${business.phone}`}
                        eventType="phone_click"
                        source="featured_businesses"
                        pageType="homepage"
                        className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-bold text-white transition hover:border-yellow-400/30"
                      >
                        Call
                      </BusinessTrackedLink>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          }
        )}
      </div>
    </section>
  );
}

function Badge({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "verified";
}) {
  const className =
    variant === "verified"
      ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
      : "border-yellow-400/20 bg-yellow-400/[0.07] text-yellow-200";

  return (
    <span
      className={[
        "inline-flex rounded-full border px-3 py-1 text-[0.64rem] font-bold",
        className,
      ].join(" ")}
    >
      {children}
    </span>
  );
}