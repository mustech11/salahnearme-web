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

type CategoryCount = {
  label: string;
  count: number;
};

function cleanText(
  value: string | null | undefined
): string {
  return String(value ?? "").trim();
}

function formatLabel(
  value: string | null | undefined
): string | null {
  const cleaned = cleanText(value);

  if (!cleaned) {
    return null;
  }

  return cleaned
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase()
    );
}

function isPaidActive(
  value: string | null | undefined
): boolean {
  if (!value) {
    return false;
  }

  const time = new Date(value).getTime();

  return (
    Number.isFinite(time) &&
    time > Date.now()
  );
}

function normaliseExternalUrl(
  value: string | null | undefined
): string | null {
  const trimmed = cleanText(value);

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

function getCardImage(
  business: BusinessRow
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

function getBusinessInitials(
  name: string | null | undefined
): string {
  const cleaned =
    cleanText(name) || "Business";

  return cleaned
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function getCitySearchTerms(
  cityRow: CityRow
): string[] {
  const terms = new Set<string>([
    cityRow.name,
    cityRow.slug,
    cityRow.name.toLowerCase(),
    cityRow.slug.toLowerCase(),
  ]);

  return Array.from(terms).filter(
    Boolean
  );
}

function getCategoryCounts(
  businesses: BusinessRow[]
): CategoryCount[] {
  const counts = new Map<
    string,
    number
  >();

  for (const business of businesses) {
    const category =
      formatLabel(business.category) ??
      "Other";

    counts.set(
      category,
      (counts.get(category) ?? 0) + 1
    );
  }

  return Array.from(counts.entries())
    .map(([label, count]) => ({
      label,
      count,
    }))
    .sort(
      (a, b) => b.count - a.count
    )
    .slice(0, 8);
}

function getBusinessLocation(
  business: BusinessRow
): string {
  return [
    cleanText(business.area),
    cleanText(business.postcode),
  ]
    .filter(Boolean)
    .join(" • ");
}

function isPremiumBusiness(
  business: BusinessRow
): boolean {
  if (!isPaidActive(business.paid_until)) {
    return false;
  }

  return Boolean(
    business.featured ||
      business.city_sponsor ||
      business.mosque_sponsor ||
      business.sponsorship_active
  );
}

export async function generateStaticParams() {
  const supabase = supabasePublic();

  const { data } = await supabase
    .from("cities")
    .select("slug")
    .eq("is_active", true);

  return (data ?? [])
    .filter(
      (item) =>
        typeof item.slug === "string" &&
        item.slug.length > 0
    )
    .map((item) => ({
      city: item.slug,
    }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { city } = await params;
  const supabase = supabasePublic();

  const { data: cityRow } =
    await supabase
      .from("cities")
      .select("name,slug")
      .eq("slug", city)
      .eq("is_active", true)
      .maybeSingle();

  if (!cityRow) {
    return {
      title:
        "Businesses Not Found | SalahNearMe",
    };
  }

  const title =
    `Halal Businesses in ${cityRow.name}`;

  const description =
    `Browse halal restaurants, butchers, groceries, shops, services, verified listings and featured Muslim businesses in ${cityRow.name}.`;

  return {
    title,
    description,
    alternates: {
      canonical:
        `/${cityRow.slug}/businesses`,
    },
    openGraph: {
      title,
      description,
      url:
        `/${cityRow.slug}/businesses`,
      type: "website",
      siteName: "SalahNearMe",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function CityBusinessesPage({
  params,
}: PageProps) {
  const { city } = await params;
  const supabase = supabasePublic();

  const { data: cityRaw, error: cityError } =
    await supabase
      .from("cities")
      .select("id,name,slug,country")
      .eq("slug", city)
      .eq("is_active", true)
      .maybeSingle();

  if (cityError) {
    return (
      <div
        role="alert"
        className="rounded-3xl border border-red-500/25 bg-red-500/10 p-6 text-sm text-red-200"
      >
        Unable to load this city:{" "}
        {cityError.message}
      </div>
    );
  }

  const cityRow =
    cityRaw as CityRow | null;

  if (!cityRow) {
    notFound();
  }

  const cityTerms =
    getCitySearchTerms(cityRow);

  const {
    data: businessesRaw,
    error: businessesError,
  } = await supabase
    .from("businesses")
    .select(
      [
        "id",
        "name",
        "slug",
        "category",
        "city",
        "area",
        "address",
        "postcode",
        "website",
        "phone",
        "maps_url",
        "logo_url",
        "cover_image_url",
        "gallery_urls",
        "featured",
        "featured_rank",
        "pricing_tier",
        "subscription_type",
        "paid_until",
        "is_verified",
        "sponsorship_active",
        "city_sponsor",
        "mosque_sponsor",
        "can_advertise",
      ].join(",")
    )
    .in("city", cityTerms)
    .eq("can_advertise", true)
    .order("name", {
      ascending: true,
    });

  if (businessesError) {
    return (
      <div
        role="alert"
        className="rounded-3xl border border-red-500/25 bg-red-500/10 p-6 text-sm text-red-200"
      >
        Unable to load businesses:{" "}
        {businessesError.message}
      </div>
    );
  }

  const businessRows =
    (businessesRaw ?? []) as unknown as BusinessRow[];

  const rankedBusinesses =
    sortBusinessesByRank(
      businessRows,
      {
        cityName: cityRow.name,
        cityId: cityRow.id,
      }
    );

  const featuredCount =
    rankedBusinesses.filter(
      (business) =>
        business.featured &&
        isPaidActive(
          business.paid_until
        )
    ).length;

  const verifiedCount =
    rankedBusinesses.filter(
      (business) =>
        business.is_verified
    ).length;

  const sponsoredCount =
    rankedBusinesses.filter(
      (business) =>
        isPremiumBusiness(business) &&
        Boolean(
          business.city_sponsor ||
            business.mosque_sponsor ||
            business.sponsorship_active
        )
    ).length;

  const categoryCounts =
    getCategoryCounts(
      rankedBusinesses
    );

  return (
    <div className="space-y-8">
      <section className="premium-panel relative overflow-hidden rounded-[2rem] p-6 sm:p-8 lg:p-10">
        <div
          aria-hidden="true"
          className="absolute -right-28 -top-28 h-80 w-80 rounded-full border border-yellow-400/10 bg-yellow-400/[0.025]"
        />

        <div className="relative">
          <div className="section-kicker">
            Halal businesses
          </div>

          <h1 className="dashboard-hero-glow mt-4 text-4xl font-black tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl">
            {cityRow.name}
          </h1>

          <p className="mt-5 max-w-4xl text-base leading-8 text-white/65 sm:text-lg">
            Discover halal restaurants,
            butchers, groceries, shops,
            services, verified listings and
            community-supporting businesses in{" "}
            {cityRow.name}.
          </p>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Businesses"
              value={rankedBusinesses.length}
              description="Active local listings"
            />

            <StatCard
              title="Featured"
              value={featuredCount}
              description="Premium placements"
            />

            <StatCard
              title="Verified"
              value={verifiedCount}
              description="Trusted business profiles"
            />

            <StatCard
              title="Sponsors"
              value={sponsoredCount}
              description="Supporting the community"
            />
          </div>

          {categoryCounts.length > 0 ? (
            <div className="mt-6 flex flex-wrap gap-2">
              {categoryCounts.map(
                (item) => (
                  <span
                    key={item.label}
                    className="rounded-full border border-white/10 bg-black/25 px-4 py-2 text-sm text-white/65"
                  >
                    {item.label}{" "}
                    <span className="font-black text-yellow-400">
                      {item.count}
                    </span>
                  </span>
                )
              )}
            </div>
          ) : null}

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href={`/${cityRow.slug}`}
              className="premium-button px-5 py-3 text-sm"
            >
              Back to {cityRow.name}
            </Link>

            <Link
              href={`/${cityRow.slug}/mosques`}
              className="premium-button-outline px-5 py-3 text-sm"
            >
              Browse mosques
            </Link>

            <Link
              href={`/add-business?city=${encodeURIComponent(
                cityRow.slug
              )}`}
              className="rounded-2xl border border-white/10 bg-black/30 px-5 py-3 text-sm font-black text-white transition hover:border-yellow-500/40 hover:text-yellow-300"
            >
              Add a business
            </Link>
          </div>
        </div>
      </section>

      {rankedBusinesses.length === 0 ? (
        <EmptyCityBusinesses
          cityRow={cityRow}
        />
      ) : (
        <section
          aria-label={`Halal businesses in ${cityRow.name}`}
          className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3"
        >
          {rankedBusinesses.map(
            (business, index) => {
              const paidActive =
                isPaidActive(
                  business.paid_until
                );

              const premium =
                isPremiumBusiness(
                  business
                );

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

              const businessName =
                cleanText(
                  business.name
                ) || "Unnamed business";

              const location =
                getBusinessLocation(
                  business
                );

              return (
                <article
                  key={business.id}
                  className={[
                    "group relative overflow-hidden rounded-[2rem] border transition duration-300",
                    "hover:-translate-y-1",
                    premium
                      ? "border-yellow-500/40 bg-yellow-500/[0.045] shadow-[0_24px_70px_rgba(212,175,55,0.09)]"
                      : "border-yellow-500/20 bg-[rgb(var(--card))] hover:border-yellow-400/40",
                  ].join(" ")}
                >
                  <div className="relative h-44 overflow-hidden bg-gradient-to-br from-[#071431] to-[#020718]">
                    {cardImage ? (
                      <>
                        <img
                          src={cardImage}
                          alt={`${businessName} image`}
                          loading="lazy"
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                        />

                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />
                      </>
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <div className="flex h-24 w-24 items-center justify-center rounded-full border border-yellow-400/20 bg-yellow-400/[0.07] text-3xl font-black text-yellow-300">
                          {getBusinessInitials(
                            business.name
                          )}
                        </div>
                      </div>
                    )}

                    <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                      {index < 3 &&
                      premium ? (
                        <Badge>
                          Top placement
                        </Badge>
                      ) : null}

                      {business.featured &&
                      paidActive ? (
                        <Badge>
                          Featured
                        </Badge>
                      ) : null}

                      {business.is_verified ? (
                        <Badge variant="green">
                          Verified
                        </Badge>
                      ) : null}
                    </div>

                    {business.logo_url &&
                    business.cover_image_url ? (
                      <img
                        src={
                          business.logo_url
                        }
                        alt={`${businessName} logo`}
                        loading="lazy"
                        className="absolute bottom-4 left-4 h-14 w-14 rounded-2xl border border-yellow-500/30 bg-black/85 object-cover p-1 shadow-xl"
                      />
                    ) : null}
                  </div>

                  <div className="p-5">
                    <div className="flex flex-wrap gap-2">
                      {business.city_sponsor &&
                      paidActive ? (
                        <Badge>
                          City sponsor
                        </Badge>
                      ) : null}

                      {business.mosque_sponsor &&
                      paidActive ? (
                        <Badge>
                          Mosque sponsor
                        </Badge>
                      ) : null}

                      {business.pricing_tier &&
                      business.pricing_tier !==
                        "free" &&
                      paidActive ? (
                        <Badge>
                          {formatLabel(
                            business.pricing_tier
                          )}
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
                        pageType="city_businesses"
                        citySlug={
                          cityRow.slug
                        }
                        source="city_businesses"
                        className="mt-4 block text-xl font-black text-white transition group-hover:text-yellow-300"
                      >
                        {businessName}
                      </BusinessTrackedLink>
                    ) : (
                      <div className="mt-4 text-xl font-black text-white">
                        {businessName}
                      </div>
                    )}

                    <div className="mt-2 text-sm text-white/60">
                      {[
                        formatLabel(
                          business.category
                        ),
                        location,
                      ]
                        .filter(Boolean)
                        .join(" • ") ||
                        "Business listing"}
                    </div>

                    {business.address ? (
                      <p className="mt-3 line-clamp-2 text-sm leading-6 text-white/45">
                        {business.address}
                      </p>
                    ) : null}

                    <div className="mt-4 space-y-2 text-xs text-white/60">
                      {business.phone ? (
                        <div className="flex items-center gap-2">
                          <span
                            aria-hidden="true"
                            className="text-yellow-300"
                          >
                            ☎
                          </span>

                          <BusinessTrackedLink
                            businessId={
                              business.id
                            }
                            href={`tel:${business.phone}`}
                            eventType="phone_click"
                            pageType="city_businesses"
                            citySlug={
                              cityRow.slug
                            }
                            source="city_businesses"
                            className="hover:text-yellow-300"
                          >
                            {business.phone}
                          </BusinessTrackedLink>
                        </div>
                      ) : null}

                      {websiteUrl ? (
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            aria-hidden="true"
                            className="text-yellow-300"
                          >
                            ◉
                          </span>

                          <BusinessTrackedLink
                            businessId={
                              business.id
                            }
                            href={
                              websiteUrl
                            }
                            eventType="website_click"
                            pageType="city_businesses"
                            citySlug={
                              cityRow.slug
                            }
                            source="city_businesses"
                            target="_blank"
                            rel="noreferrer"
                            className="truncate hover:text-yellow-300"
                          >
                            {business.website}
                          </BusinessTrackedLink>
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      {business.slug ? (
                        <BusinessTrackedLink
                          businessId={
                            business.id
                          }
                          href={`/business/${business.slug}`}
                          eventType="profile_click"
                          pageType="city_businesses"
                          citySlug={
                            cityRow.slug
                          }
                          source="city_businesses"
                          className="premium-button px-4 py-3 text-sm"
                        >
                          View business
                        </BusinessTrackedLink>
                      ) : null}

                      {mapsUrl ? (
                        <BusinessTrackedLink
                          businessId={
                            business.id
                          }
                          href={mapsUrl}
                          eventType="maps_click"
                          pageType="city_businesses"
                          citySlug={
                            cityRow.slug
                          }
                          source="city_businesses"
                          target="_blank"
                          rel="noreferrer"
                          className="premium-button-outline px-4 py-3 text-sm"
                        >
                          Open map
                        </BusinessTrackedLink>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            }
          )}
        </section>
      )}
    </div>
  );
}

function EmptyCityBusinesses({
  cityRow,
}: {
  cityRow: CityRow;
}) {
  return (
    <section className="premium-panel relative overflow-hidden rounded-[2rem] p-6 sm:p-8 lg:p-10">
      <div
        aria-hidden="true"
        className="absolute -right-24 -top-24 h-72 w-72 rounded-full border border-yellow-400/10 bg-yellow-400/[0.025]"
      />

      <div className="relative grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
        <div>
          <div className="section-kicker">
            Help build {cityRow.name}
          </div>

          <h2 className="mt-4 text-3xl font-black tracking-[-0.03em] text-white sm:text-4xl lg:text-5xl">
            No halal businesses are listed
            in {cityRow.name} yet.
          </h2>

          <p className="mt-4 max-w-3xl text-base leading-8 text-white/65">
            Add halal restaurants, butchers,
            groceries, Islamic shops, travel
            services, tuition centres,
            charities, clinics and other
            Muslim-friendly services.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`/add-business?city=${encodeURIComponent(
                cityRow.slug
              )}`}
              className="premium-button px-5 py-3 text-sm"
            >
              Add a halal business
            </Link>

            <Link
              href="/claim/business"
              className="premium-button-outline px-5 py-3 text-sm"
            >
              Claim your business
            </Link>

            <Link
              href={`/${cityRow.slug}/mosques`}
              className="rounded-2xl border border-white/10 bg-black/30 px-5 py-3 text-sm font-bold text-white transition hover:border-yellow-400/30 hover:text-yellow-300"
            >
              Browse mosques
            </Link>
          </div>
        </div>

        <div className="premium-inset rounded-3xl p-6">
          <div className="text-lg font-black text-white">
            Why add a listing?
          </div>

          <div className="mt-5 space-y-4">
            <EmptyBenefit
              title="Help Muslims discover halal places"
              text={`Make trusted services easier to find in ${cityRow.name}.`}
            />

            <EmptyBenefit
              title="Support local Muslim businesses"
              text="Listings can generate profile visits, calls, map clicks and website traffic."
            />

            <EmptyBenefit
              title="Grow the local ecosystem"
              text="Every listing strengthens the city’s prayer, food, shopping and service directory."
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function EmptyBenefit({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="font-semibold text-yellow-300">
        {title}
      </div>

      <p className="mt-1 text-sm leading-6 text-white/60">
        {text}
      </p>
    </div>
  );
}

function StatCard({
  title,
  value,
  description,
}: {
  title: string;
  value: number;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-5 backdrop-blur-xl">
      <div className="text-xs font-black uppercase tracking-[0.2em] text-yellow-400">
        {title}
      </div>

      <div className="mt-3 text-3xl font-black text-white">
        {value}
      </div>

      <p className="mt-1 text-xs leading-5 text-white/45">
        {description}
      </p>
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
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
      : "border-yellow-500/30 bg-yellow-500/10 text-yellow-300";

  return (
    <span
      className={[
        "rounded-full border px-3 py-1 text-xs font-semibold",
        className,
      ].join(" ")}
    >
      {children}
    </span>
  );
}