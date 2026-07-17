import type { Metadata } from "next";
import type { ReactNode } from "react";

import Link from "next/link";
import { notFound } from "next/navigation";

import BusinessTrackedLink from "@/components/BusinessTrackedLink";
import { sortBusinessesByRank } from "@/lib/businessRanking";
import { supabasePublic } from "@/lib/supabaseServer";

export const revalidate = 300;

type PageProps = {
  params: Promise<{
    city: string;
  }>;
};

type CityRow = {
  id: number;
  name: string;
  slug: string;
  country: string | null;
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
  website: string | null;
  phone: string | null;
  maps_url: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  gallery_urls: string[] | null;
  featured: boolean | null;
  featured_rank: number | null;
  pricing_tier: string | null;
  subscription_type: string | null;
  paid_until: string | null;
  is_verified: boolean | null;
  sponsorship_active: boolean | null;
  city_sponsor: boolean | null;
  mosque_sponsor: boolean | null;
  can_advertise?: boolean | null;
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

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
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

function getCitySearchTerms(cityRow: CityRow) {
  const terms = new Set<string>();

  terms.add(cityRow.name);
  terms.add(cityRow.slug);
  terms.add(cityRow.name.toLowerCase());
  terms.add(cityRow.slug.toLowerCase());

  return Array.from(terms).filter(Boolean);
}

function getCategoryCounts(businesses: BusinessRow[]) {
  const counts = new Map<string, number>();

  for (const business of businesses) {
    const category = formatLabel(business.category) ?? "Other";

    counts.set(category, (counts.get(category) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

export async function generateStaticParams() {
  const supabase = supabasePublic();

  const { data } = await supabase
    .from("cities")
    .select("slug")
    .eq("is_active", true);

  return (data ?? []).map((item) => ({
    city: item.slug,
  }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { city } = await params;
  const supabase = supabasePublic();

  const { data: cityRow } = await supabase
    .from("cities")
    .select("name,slug")
    .eq("slug", city)
    .eq("is_active", true)
    .maybeSingle();

  if (!cityRow) {
    return {
      title: "Businesses Not Found | SalahNearMe",
    };
  }

  return {
    title: `Halal Businesses in ${cityRow.name} | SalahNearMe`,
    description: `Browse halal restaurants, butchers, groceries, shops, services, verified listings, and featured Muslim businesses in ${cityRow.name}.`,
    alternates: {
      canonical: `/${cityRow.slug}/businesses`,
    },
    openGraph: {
      title: `Halal Businesses in ${cityRow.name}`,
      description: `Explore trusted halal businesses, restaurants, butchers, shops, sponsors, and Muslim-friendly services in ${cityRow.name}.`,
      url: `/${cityRow.slug}/businesses`,
      type: "website",
    },
  };
}

export default async function CityBusinessesPage({ params }: PageProps) {
  const { city } = await params;
  const supabase = supabasePublic();

  const { data: cityRaw, error: cityError } = await supabase
    .from("cities")
    .select("id,name,slug,country")
    .eq("slug", city)
    .eq("is_active", true)
    .maybeSingle();

  if (cityError) {
    return <pre className="p-10 text-red-300">{cityError.message}</pre>;
  }

  const cityRow = cityRaw as CityRow | null;

  if (!cityRow) {
    notFound();
  }

  const cityTerms = getCitySearchTerms(cityRow);

  const { data: businessesRaw, error: businessesError } = await supabase
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
      can_advertise
    `
    )
    .in("city", cityTerms)
    .eq("can_advertise", true)
    .order("name", { ascending: true });

  if (businessesError) {
    return <pre className="p-10 text-red-300">{businessesError.message}</pre>;
  }

  const rankedBusinesses = sortBusinessesByRank(
    (businessesRaw ?? []) as BusinessRow[],
    {
      cityName: cityRow.name,
      cityId: cityRow.id,
    }
  );

  const featuredCount = rankedBusinesses.filter(
    (business) => business.featured && isPaidActive(business.paid_until)
  ).length;

  const verifiedCount = rankedBusinesses.filter(
    (business) => business.is_verified
  ).length;

  const sponsoredCount = rankedBusinesses.filter(
    (business) =>
      (business.city_sponsor ||
        business.mosque_sponsor ||
        business.sponsorship_active) &&
      isPaidActive(business.paid_until)
  ).length;

  const categoryCounts = getCategoryCounts(rankedBusinesses);

  return (
    <div className="space-y-8">
      <section className="luxe-card relative overflow-hidden rounded-3xl p-8 md:p-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,0.15),transparent_40%)]" />

        <div className="relative z-10">
          <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
            Halal Businesses
          </div>

          <h1 className="dashboard-hero-glow mt-4 text-4xl font-black tracking-[-0.04em] text-white md:text-6xl">
            {cityRow.name}
          </h1>

          <p className="mt-4 max-w-3xl text-white/70">
            Explore trusted halal businesses, featured sponsors, restaurants,
            butchers, shops, groceries, Muslim-friendly services, and verified
            local listings in {cityRow.name}.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <StatCard title="Businesses" value={rankedBusinesses.length} />
            <StatCard title="Featured" value={featuredCount} />
            <StatCard title="Verified" value={verifiedCount} />
          </div>

          {categoryCounts.length > 0 ? (
            <div className="mt-6 flex flex-wrap gap-2">
              {categoryCounts.map((item) => (
                <span
                  key={item.label}
                  className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-white/70"
                >
                  {item.label}{" "}
                  <span className="text-yellow-400">{item.count}</span>
                </span>
              ))}
            </div>
          ) : null}

          {sponsoredCount > 0 ? (
            <div className="mt-5 text-sm text-yellow-300">
              {sponsoredCount} active sponsor
              {sponsoredCount > 1 ? "s" : ""} supporting the local Muslim
              community.
            </div>
          ) : null}
        </div>
      </section>

      {rankedBusinesses.length === 0 ? (
        <EmptyCityBusinesses cityRow={cityRow} />
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
                className={`overflow-hidden rounded-3xl border transition ${
                  premium
                    ? "border-yellow-500/40 bg-yellow-500/[0.04] shadow-[0_0_40px_rgba(212,175,55,0.08)]"
                    : "border-yellow-500/20 bg-[rgb(var(--card))] hover:border-yellow-400/40 hover:bg-yellow-500/[0.03]"
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
                      <div className="mb-2 flex flex-wrap gap-2">
                        {index < 3 && premium ? (
                          <Badge>Top Placement</Badge>
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
                          pageType="city_businesses"
                          citySlug={cityRow.slug}
                          source="city_businesses"
                          className="text-lg font-semibold text-white hover:text-yellow-400"
                        >
                          {business.name ?? "Unnamed business"}
                        </BusinessTrackedLink>
                      ) : (
                        <div className="text-lg font-semibold text-white">
                          {business.name ?? "Unnamed business"}
                        </div>
                      )}

                      <div className="mt-2 text-sm text-white/70">
                        {[formatLabel(business.category), business.area]
                          .filter(Boolean)
                          .join(" • ") || "Business listing"}
                      </div>
                    </div>
                  </div>

                  {(business.address || business.postcode) && (
                    <div className="mt-3 text-sm text-white/60">
                      {[business.address, business.postcode]
                        .filter(Boolean)
                        .join(" • ")}
                    </div>
                  )}

                  {business.pricing_tier &&
                  business.pricing_tier !== "free" &&
                  paidActive ? (
                    <div className="mt-3">
                      <Badge>{formatLabel(business.pricing_tier)}</Badge>
                    </div>
                  ) : null}

                  <div className="mt-4 space-y-2 text-xs text-white/60">
                    {business.phone ? (
                      <div>
                        📞{" "}
                        <BusinessTrackedLink
                          businessId={business.id}
                          href={`tel:${business.phone}`}
                          eventType="phone_click"
                          pageType="city_businesses"
                          citySlug={cityRow.slug}
                          source="city_businesses"
                          className="underline hover:text-yellow-400"
                        >
                          {business.phone}
                        </BusinessTrackedLink>
                      </div>
                    ) : null}

                    {websiteUrl ? (
                      <div className="truncate">
                        🌐{" "}
                        <BusinessTrackedLink
                          businessId={business.id}
                          href={websiteUrl}
                          eventType="website_click"
                          pageType="city_businesses"
                          citySlug={cityRow.slug}
                          source="city_businesses"
                          target="_blank"
                          rel="noreferrer"
                          className="underline hover:text-yellow-400"
                        >
                          {business.website}
                        </BusinessTrackedLink>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    {business.slug ? (
                      <BusinessTrackedLink
                        businessId={business.id}
                        href={`/business/${business.slug}`}
                        eventType="profile_click"
                        pageType="city_businesses"
                        citySlug={cityRow.slug}
                        source="city_businesses"
                        className="rounded-xl bg-yellow-500 px-4 py-3 text-sm font-semibold text-black hover:bg-yellow-400"
                      >
                        View business
                      </BusinessTrackedLink>
                    ) : null}

                    {mapsUrl ? (
                      <BusinessTrackedLink
                        businessId={business.id}
                        href={mapsUrl}
                        eventType="maps_click"
                        pageType="city_businesses"
                        citySlug={cityRow.slug}
                        source="city_businesses"
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl border border-yellow-500/30 bg-black px-4 py-3 text-sm font-semibold text-yellow-400 hover:bg-yellow-500/10"
                      >
                        Open map
                      </BusinessTrackedLink>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}

function EmptyCityBusinesses({ cityRow }: { cityRow: CityRow }) {
  return (
    <section className="overflow-hidden rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))]">
      <div className="relative p-8 md:p-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,0.12),transparent_38%)]" />

        <div className="relative z-10 grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
              Help Build {cityRow.name}
            </div>

            <h2 className="mt-4 text-3xl font-black tracking-[-0.03em] text-white md:text-5xl">
              No halal businesses listed in {cityRow.name} yet.
            </h2>

            <p className="mt-4 max-w-3xl text-white/70">
              SalahNearMe is expanding city by city. If you know a halal
              restaurant, butcher, grocery shop, Islamic bookstore, travel
              service, tuition centre, charity, clinic, or Muslim-friendly local
              service in {cityRow.name}, you can help the community by adding it.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={`/add-business?city=${cityRow.slug}`}
                className="rounded-xl bg-yellow-500 px-5 py-3 text-sm font-bold text-black hover:bg-yellow-400"
              >
                Add a halal business
              </Link>

              <Link
                href="/claim/business"
                className="rounded-xl border border-yellow-500/30 bg-black px-5 py-3 text-sm font-bold text-yellow-400 hover:bg-yellow-500/10"
              >
                Claim your business
              </Link>

              <Link
                href={`/${cityRow.slug}/mosques`}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-bold text-white hover:bg-white/[0.06]"
              >
                Browse mosques
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/20 p-6">
            <div className="text-lg font-black text-white">
              Why add listings?
            </div>

            <div className="mt-5 space-y-4">
              <EmptyBenefit
                title="Help Muslims find halal places"
                text={`Make it easier for locals and travellers to discover trusted halal services in ${cityRow.name}.`}
              />

              <EmptyBenefit
                title="Support local Muslim businesses"
                text="New listings create visibility, traffic, calls, map clicks, and future sponsorship opportunities."
              />

              <EmptyBenefit
                title="Grow the city ecosystem"
                text="Every added business makes the city page stronger for prayer, food, shopping, services, and travel."
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function EmptyBenefit({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="font-semibold text-yellow-400">{title}</div>
      <p className="mt-1 text-sm text-white/65">{text}</p>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
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
  children: ReactNode;
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