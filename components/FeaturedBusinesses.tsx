import Link from "next/link";

import BusinessTrackedLink from "@/components/BusinessTrackedLink";
import { sortBusinessesByRank } from "@/lib/businessRanking";
import { supabasePublic } from "@/lib/supabaseServer";

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
  paid_until: string | null;
  is_verified: boolean | null;
  sponsorship_active?: boolean | null;
  city_sponsor?: boolean | null;
  mosque_sponsor?: boolean | null;
  sponsor_mosque_id?: string | null;
  sponsor_city_id?: number | null;
  can_advertise?: boolean | null;
  is_live?: boolean | null;
};

function formatLabel(value: string | null | undefined) {
  if (!value) {
    return "Halal business";
  }

  return value
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/\s+/g, "-");
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

function isPaidActive(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  const time = new Date(value).getTime();

  return Number.isFinite(time) && time > Date.now();
}

function getCardImage(business: FeaturedBusinessRow) {
  return (
    business.cover_image_url ||
    business.logo_url ||
    business.gallery_urls?.[0] ||
    null
  );
}

export default async function FeaturedBusinesses({
  city,
}: {
  city?: string | null;
}) {
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
      paid_until,
      is_verified,
      sponsorship_active,
      city_sponsor,
      mosque_sponsor,
      sponsor_mosque_id,
      sponsor_city_id,
      can_advertise,
      is_live
    `
    )
    .eq("featured", true)
    .eq("is_live", true)
    .eq("can_advertise", true)
    .order("featured_rank", {
      ascending: true,
    })
    .order("is_verified", {
      ascending: false,
    })
    .order("name", {
      ascending: true,
    })
    .limit(12);

  if (city) {
    query = query.eq("city", city);
  }

  const { data, error } = await query;

  if (error) {
    return (
      <div className="mt-10 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
        Could not load featured businesses.
      </div>
    );
  }

  const businesses = sortBusinessesByRank(
    (data ?? []) as FeaturedBusinessRow[],
    {
      cityName: city ?? null,
      cityId: null,
      mosqueId: null,
    }
  )
    .filter((business) => {
      if (!business.featured) {
        return false;
      }

      if (!business.paid_until) {
        return true;
      }

      return isPaidActive(business.paid_until);
    })
    .slice(0, 12);

  if (!businesses.length) {
    return null;
  }

  const cityHref = city ? `/${slugify(city)}/businesses` : "/businesses";

  return (
    <section className="mt-10 rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6 md:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
            Featured Businesses
          </div>

          <h2 className="mt-2 text-2xl font-black text-white">
            Trusted halal businesses
          </h2>

          <p className="mt-2 text-sm text-white/60">
            Local halal places and Muslim-friendly businesses supporting the
            platform.
          </p>
        </div>

        <Link
          href={cityHref}
          className="text-sm font-semibold text-yellow-400 hover:text-yellow-300"
        >
          View all →
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {businesses.map((business, index) => {
          const cardImage = getCardImage(business);
          const websiteUrl = normaliseExternalUrl(business.website);
          const mapsUrl = normaliseExternalUrl(business.maps_url);
          const paidActive = isPaidActive(business.paid_until);
          const premium =
            paidActive &&
            Boolean(
              business.featured ||
                business.city_sponsor ||
                business.mosque_sponsor ||
                business.sponsorship_active
            );

          return (
            <article
              key={business.id}
              className={`overflow-hidden rounded-3xl border transition ${
                premium
                  ? "border-yellow-500/40 bg-yellow-500/[0.04] shadow-[0_0_35px_rgba(212,175,55,0.08)]"
                  : "border-yellow-500/20 bg-black/30 hover:border-yellow-400/40"
              }`}
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
                <div className="mb-3 flex flex-wrap gap-2">
                  {index < 3 ? <Badge>Top placement</Badge> : null}
                  <Badge>Featured</Badge>

                  {business.is_verified ? (
                    <Badge variant="green">Verified</Badge>
                  ) : null}

                  {business.city_sponsor && paidActive ? (
                    <Badge>City Sponsor</Badge>
                  ) : null}

                  {business.mosque_sponsor && paidActive ? (
                    <Badge>Mosque Sponsor</Badge>
                  ) : null}
                </div>

                {business.slug ? (
                  <BusinessTrackedLink
                    businessId={business.id}
                    href={`/business/${business.slug}`}
                    eventType="profile_click"
                    source="featured_businesses"
                    pageType="featured_businesses"
                    className="text-lg font-bold text-white hover:text-yellow-400"
                  >
                    {business.name ?? "Unnamed business"}
                  </BusinessTrackedLink>
                ) : (
                  <div className="text-lg font-bold text-white">
                    {business.name ?? "Unnamed business"}
                  </div>
                )}

                <div className="mt-2 text-sm text-white/60">
                  {[formatLabel(business.category), business.area, business.city]
                    .filter(Boolean)
                    .join(" • ")}
                </div>

                <div className="mt-2 text-xs text-white/50">
                  {[business.address, business.postcode]
                    .filter(Boolean)
                    .join(" • ") || "Location details coming soon"}
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {business.slug ? (
                    <BusinessTrackedLink
                      businessId={business.id}
                      href={`/business/${business.slug}`}
                      eventType="profile_click"
                      source="featured_businesses"
                      pageType="featured_businesses"
                      className="rounded-xl bg-yellow-500 px-4 py-2 text-xs font-bold text-black hover:bg-yellow-400"
                    >
                      View
                    </BusinessTrackedLink>
                  ) : null}

                  {mapsUrl ? (
                    <BusinessTrackedLink
                      businessId={business.id}
                      href={mapsUrl}
                      eventType="maps_click"
                      source="featured_businesses"
                      pageType="featured_businesses"
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl border border-yellow-500/30 bg-black px-4 py-2 text-xs font-bold text-yellow-400 hover:bg-yellow-500/10"
                    >
                      Maps
                    </BusinessTrackedLink>
                  ) : null}

                  {websiteUrl ? (
                    <BusinessTrackedLink
                      businessId={business.id}
                      href={websiteUrl}
                      eventType="website_click"
                      source="featured_businesses"
                      pageType="featured_businesses"
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-white hover:border-yellow-500/30"
                    >
                      Website
                    </BusinessTrackedLink>
                  ) : null}

                  {business.phone ? (
                    <BusinessTrackedLink
                      businessId={business.id}
                      href={`tel:${business.phone}`}
                      eventType="phone_click"
                      source="featured_businesses"
                      pageType="featured_businesses"
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-white hover:border-yellow-500/30"
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
    </section>
  );
}

function Badge({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "green";
}) {
  const className =
    variant === "green"
      ? "border-green-500/30 bg-green-500/10 text-green-300"
      : "border-yellow-500/30 bg-yellow-500/10 text-yellow-400";

  return (
    <span
      className={`rounded-full border px-3 py-1 text-[10px] font-semibold ${className}`}
    >
      {children}
    </span>
  );
}

