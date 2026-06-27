import type { Metadata } from "next";
import Link from "next/link";

import BusinessTrackedLink from "@/components/BusinessTrackedLink";
import { sortBusinessesByRank } from "@/lib/businessRanking";
import { supabasePublic } from "@/lib/supabaseServer";

export const metadata: Metadata = {
  title: "Halal Businesses | SalahNearMe",
  description:
    "Browse halal businesses on SalahNearMe across cities, including restaurants, butchers, clinics, services, verified listings, featured sponsors, and trusted local services.",
  alternates: {
    canonical: "/businesses",
  },
};

export const revalidate = 300;

type BusinessRow = {
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
  paid_until: string | null;
  is_verified: boolean | null;
  sponsorship_active?: boolean | null;
  city_sponsor?: boolean | null;
  mosque_sponsor?: boolean | null;
  sponsor_mosque_id?: string | null;
  sponsor_city_id?: number | null;
  can_advertise?: boolean | null;
  is_live?: boolean | null;
  review_status?: string | null;
  created_at?: string | null;
};

function formatLabel(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return value
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function isPaidActive(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  const time = new Date(value).getTime();

  return Number.isFinite(time) && time > Date.now();
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

function categorySummary(businesses: BusinessRow[]) {
  const counts = new Map<string, number>();

  for (const business of businesses) {
    const label = formatLabel(business.category) ?? "Other";

    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
}

function getCardImage(business: BusinessRow) {
  return business.cover_image_url || business.logo_url || business.gallery_urls?.[0] || null;
}

export default async function AllBusinessesPage() {
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
      paid_until,
      is_verified,
      sponsorship_active,
      city_sponsor,
      mosque_sponsor,
      sponsor_mosque_id,
      sponsor_city_id,
      can_advertise,
      is_live,
      review_status,
      created_at
    `
    )
    .eq("can_advertise", true)
    .eq("is_live", true)
    .order("featured", { ascending: false })
    .order("featured_rank", { ascending: true })
    .order("is_verified", { ascending: false })
    .order("name", { ascending: true })
    .limit(500);

  if (error) {
    return <pre className="text-white/80">{error.message}</pre>;
  }

  const rawBusinesses = (data ?? []) as BusinessRow[];

  const rankedBusinesses = sortBusinessesByRank(rawBusinesses, {
    cityName: null,
    cityId: null,
    mosqueId: null,
  });

  const total = rankedBusinesses.length;

  const paidCount = rankedBusinesses.filter((business) =>
    isPaidActive(business.paid_until)
  ).length;

  const featuredCount = rankedBusinesses.filter(
    (business) => business.featured && isPaidActive(business.paid_until)
  ).length;

  const verifiedCount = rankedBusinesses.filter(
    (business) => business.is_verified
  ).length;

  const categories = categorySummary(rankedBusinesses);

  return (
    <div className="space-y-8">
      <section className="luxe-card relative overflow-hidden rounded-3xl p-8 md:p-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,0.16),transparent_38%)]" />

        <div className="relative z-10">
          <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
            Halal Businesses
          </div>

          <h1 className="dashboard-hero-glow mt-4 text-4xl font-black tracking-[-0.04em] text-white md:text-6xl">
            All halal businesses
          </h1>

          <p className="mt-4 max-w-3xl text-white/70">
            Browse approved halal businesses across SalahNearMe, including
            verified listings, featured sponsors, and trusted local services.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/advertise" className="luxe-button text-sm">
              Advertise your business
            </Link>

            <Link href="/business-claim" className="luxe-button-outline text-sm">
              Claim a business
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <Stat title="Businesses" value={total} />
        <Stat title="Featured" value={featuredCount} />
        <Stat title="Verified" value={verifiedCount} />
        <Stat title="Paid Active" value={paidCount} />
      </section>

      {categories.length > 0 ? (
        <section className="luxe-card-soft rounded-3xl p-6">
          <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
            Popular categories
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {categories.map(([name, count]) => (
              <span
                key={name}
                className="rounded-full border border-white/10 bg-black/30 px-4 py-2 text-sm text-white/75"
              >
                {name}{" "}
                <span className="ml-1 text-yellow-400">{count}</span>
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {rankedBusinesses.length === 0 ? (
        <div className="luxe-card-soft rounded-2xl p-6 text-white/60">
          No businesses found yet.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rankedBusinesses.map((business, index) => {
            const paidActive = isPaidActive(business.paid_until);

            const premium =
              paidActive &&
              (business.featured ||
                business.city_sponsor ||
                business.mosque_sponsor ||
                business.sponsorship_active);

            const cardImage = getCardImage(business);
            const websiteUrl = normaliseExternalUrl(business.website);
            const mapsUrl = normaliseExternalUrl(business.maps_url);

            return (
              <article
                key={business.id}
                className={`overflow-hidden rounded-3xl transition ${
                  premium
                    ? "luxe-card border-yellow-500/30 shadow-[0_0_40px_rgba(212,175,55,0.08)]"
                    : "luxe-card hover:border-yellow-400/40"
                }`}
              >
                {cardImage ? (
                  <div className="relative h-40 overflow-hidden">
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
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        {index < 3 && premium ? (
                          <Badge>Top placement</Badge>
                        ) : null}

                        {business.city_sponsor && paidActive ? (
                          <Badge>City Sponsor</Badge>
                        ) : null}

                        {business.mosque_sponsor && paidActive ? (
                          <Badge>Mosque Sponsor</Badge>
                        ) : null}

                        {business.featured && paidActive ? (
                          <Badge>Featured</Badge>
                        ) : null}

                        {business.is_verified ? (
                          <Badge variant="green">Verified</Badge>
                        ) : null}
                      </div>

                      {business.slug ? (
                        <BusinessTrackedLink
                          businessId={business.id}
                          href={`/business/${business.slug}`}
                          eventType="profile_click"
                          source="all_businesses_page"
                          pageType="business_directory"
                          className="text-xl font-bold text-white hover:text-yellow-400"
                        >
                          {business.name ?? "Unnamed business"}
                        </BusinessTrackedLink>
                      ) : (
                        <div className="text-xl font-bold text-white">
                          {business.name ?? "Unnamed business"}
                        </div>
                      )}

                      <div className="mt-2 text-white/70">
                        {[formatLabel(business.category), business.area, business.city]
                          .filter(Boolean)
                          .join(" • ") || "Business listing"}
                      </div>

                      <div className="mt-2 text-sm text-white/50">
                        {[business.address, business.postcode]
                          .filter(Boolean)
                          .join(" • ") || "Location details coming soon"}
                      </div>
                    </div>
                  </div>

                  {business.pricing_tier &&
                  business.pricing_tier !== "free" &&
                  paidActive ? (
                    <div className="mt-4">
                      <Badge>{formatLabel(business.pricing_tier)}</Badge>
                    </div>
                  ) : null}

                  <div className="mt-5 flex flex-wrap gap-2">
                    {business.slug ? (
                      <BusinessTrackedLink
                        businessId={business.id}
                        href={`/business/${business.slug}`}
                        eventType="profile_click"
                        source="all_businesses_page"
                        pageType="business_directory"
                        className="rounded-lg border border-yellow-500/30 bg-black px-3 py-2 text-xs font-semibold text-yellow-400 hover:bg-yellow-500/10"
                      >
                        View profile
                      </BusinessTrackedLink>
                    ) : null}

                    {websiteUrl ? (
                      <BusinessTrackedLink
                        businessId={business.id}
                        href={websiteUrl}
                        eventType="website_click"
                        source="all_businesses_page"
                        pageType="business_directory"
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/10"
                      >
                        Website
                      </BusinessTrackedLink>
                    ) : null}

                    {business.phone ? (
                      <BusinessTrackedLink
                        businessId={business.id}
                        href={`tel:${business.phone}`}
                        eventType="phone_click"
                        source="all_businesses_page"
                        pageType="business_directory"
                        className="rounded-lg border border-yellow-500/30 bg-black px-3 py-2 text-xs font-semibold text-yellow-400 hover:bg-yellow-500/10"
                      >
                        Call
                      </BusinessTrackedLink>
                    ) : null}

                    {mapsUrl ? (
                      <BusinessTrackedLink
                        businessId={business.id}
                        href={mapsUrl}
                        eventType="maps_click"
                        source="all_businesses_page"
                        pageType="business_directory"
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-yellow-500/30 bg-black px-3 py-2 text-xs font-semibold text-yellow-400 hover:bg-yellow-500/10"
                      >
                        Map
                      </BusinessTrackedLink>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ title, value }: { title: string; value: number }) {
  return (
    <div className="luxe-card-soft rounded-2xl p-5">
      <div className="text-xs uppercase tracking-[0.2em] text-yellow-400">
        {title}
      </div>

      <div className="mt-3 text-3xl font-black text-white">{value}</div>
    </div>
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
      className={`rounded-full border px-3 py-1 text-xs font-semibold ${className}`}
    >
      {children}
    </span>
  );
}

