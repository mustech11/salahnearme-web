import type { Metadata } from "next";
import Link from "next/link";

import BusinessTrackedLink from "@/components/BusinessTrackedLink";
import { sortBusinessesByRank } from "@/lib/businessRanking";
import { supabasePublic } from "@/lib/supabaseServer";

export const revalidate = 300;

const SITE_NAME = "SalahNearMe";
const PAGE_TITLE = "Find Halal Businesses Near You | SalahNearMe";
const PAGE_DESCRIPTION =
  "Find halal restaurants, butchers, groceries, Islamic bookstores, clinics, Muslim-friendly services, verified listings, and featured halal businesses near you.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: {
    canonical: "/businesses",
  },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: "/businesses",
    siteName: SITE_NAME,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
  },
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

type CitySummary = {
  city: string;
  slug: string;
  count: number;
};

function cleanText(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function formatLabel(value: string | null | undefined) {
  const cleaned = cleanText(value);

  if (!cleaned) {
    return null;
  }

  return cleaned
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function slugify(value: string | null | undefined) {
  const cleaned = cleanText(value);

  if (!cleaned) {
    return null;
  }

  return cleaned
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isPaidActive(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  const time = new Date(value).getTime();

  return Number.isFinite(time) && time > Date.now();
}

function normaliseExternalUrl(value: string | null | undefined) {
  const cleaned = cleanText(value);

  if (!cleaned) {
    return null;
  }

  if (cleaned.startsWith("http://") || cleaned.startsWith("https://")) {
    return cleaned;
  }

  return `https://${cleaned}`;
}

function normalisePhoneHref(value: string | null | undefined) {
  const cleaned = cleanText(value);

  if (!cleaned) {
    return null;
  }

  const phone = cleaned.replace(/[^\d+]/g, "");

  return phone ? `tel:${phone}` : null;
}

function getCardImage(business: BusinessRow) {
  return (
    cleanText(business.cover_image_url) ||
    cleanText(business.logo_url) ||
    business.gallery_urls?.find((url) => Boolean(cleanText(url))) ||
    null
  );
}

function getBusinessProfileHref(business: BusinessRow) {
  const slug = cleanText(business.slug);

  return slug ? `/business/${slug}` : null;
}

function getCityHref(city: string | null | undefined) {
  const slug = slugify(city);

  return slug ? `/${slug}/businesses` : null;
}

function getCityPageHref(city: string | null | undefined) {
  const slug = slugify(city);

  return slug ? `/${slug}` : null;
}

function categorySummary(businesses: BusinessRow[]) {
  const counts = new Map<string, number>();

  for (const business of businesses) {
    const label = formatLabel(business.category) ?? "Other";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10);
}

function citySummary(businesses: BusinessRow[]) {
  const counts = new Map<string, number>();

  for (const business of businesses) {
    const label = formatLabel(business.city);

    if (!label) {
      continue;
    }

    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([city, count]) => ({
      city,
      slug: slugify(city) ?? "",
      count,
    }))
    .filter((item) => item.slug)
    .sort((a, b) => b.count - a.count || a.city.localeCompare(b.city))
    .slice(0, 12);
}

function isPremiumBusiness(business: BusinessRow) {
  const paidActive = isPaidActive(business.paid_until);

  return Boolean(
    paidActive &&
      (business.featured ||
        business.city_sponsor ||
        business.mosque_sponsor ||
        business.sponsorship_active ||
        business.pricing_tier === "premium" ||
        business.pricing_tier === "featured")
  );
}

function getListingLabel(business: BusinessRow) {
  if (business.is_verified) {
    return "Verified listing";
  }

  if (isPremiumBusiness(business)) {
    return "Featured listing";
  }

  return "Community listing";
}

function getLocationLine(business: BusinessRow) {
  return [
    formatLabel(business.category),
    cleanText(business.area),
    cleanText(business.city),
    cleanText(business.postcode),
  ]
    .filter(Boolean)
    .join(" • ");
}

function getAddressLine(business: BusinessRow) {
  return [cleanText(business.address), cleanText(business.postcode)]
    .filter(Boolean)
    .join(" • ");
}

function buildJsonLd(total: number, categories: Array<[string, number]>) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: "https://www.salahnearme.com/businesses",
    isPartOf: {
      "@type": "WebSite",
      name: SITE_NAME,
      url: "https://www.salahnearme.com",
    },
    about: categories.map(([name]) => ({
      "@type": "Thing",
      name,
    })),
    numberOfItems: total,
  };
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
    .limit(600);

  if (error) {
    return (
      <div className="space-y-6">
        <section className="luxe-card rounded-3xl p-8 md:p-10">
          <p className="text-sm uppercase tracking-[0.25em] text-yellow-400">
            Halal Businesses
          </p>

          <h1 className="dashboard-hero-glow mt-4 text-4xl font-black tracking-[-0.04em] text-white md:text-6xl">
            Business directory temporarily unavailable
          </h1>

          <p className="mt-4 max-w-3xl text-white/70">
            We could not load the halal business directory at the moment. Please
            try again shortly.
          </p>

          <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
            {error.message}
          </div>
        </section>
      </div>
    );
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

  const featuredCount = rankedBusinesses.filter((business) =>
    isPremiumBusiness(business)
  ).length;

  const verifiedCount = rankedBusinesses.filter(
    (business) => business.is_verified
  ).length;

  const categories = categorySummary(rankedBusinesses);
  const cities = citySummary(rankedBusinesses);
  const jsonLd = buildJsonLd(total, categories);

  const topBusinesses = rankedBusinesses.slice(0, 24);
  const remainingBusinesses = rankedBusinesses.slice(24);

  return (
    <div className="space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd),
        }}
      />

      <section className="luxe-card relative overflow-hidden rounded-3xl p-8 md:p-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,0.18),transparent_38%)]" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-yellow-500/30 to-transparent" />

        <div className="relative z-10 grid gap-8 lg:grid-cols-[1.4fr_0.8fr] lg:items-end">
          <div>
            <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
              Halal Business Directory
            </div>

            <h1 className="dashboard-hero-glow mt-4 max-w-5xl text-4xl font-black tracking-[-0.05em] text-white md:text-6xl">
              Find halal businesses near you
            </h1>

            <p className="mt-5 max-w-3xl text-lg leading-8 text-white/72">
              Discover halal restaurants, butchers, groceries, Islamic
              bookstores, clinics, travel services, Muslim-friendly businesses,
              featured sponsors, and verified local listings.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/add-business" className="luxe-button text-sm">
                Add a halal business
              </Link>

              <Link href="/advertise" className="luxe-button-outline text-sm">
                Advertise your business
              </Link>

              <Link href="/claim/business" className="luxe-button-outline text-sm">
                Claim a listing
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
            <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
              Directory snapshot
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <MiniStat title="Businesses" value={total} />
              <MiniStat title="Verified" value={verifiedCount} />
              <MiniStat title="Featured" value={featuredCount} />
              <MiniStat title="Paid Active" value={paidCount} />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <Stat title="Businesses" value={total} />
        <Stat title="Featured" value={featuredCount} />
        <Stat title="Verified" value={verifiedCount} />
        <Stat title="Paid Active" value={paidCount} />
      </section>

      {categories.length > 0 || cities.length > 0 ? (
        <section className="grid gap-4 lg:grid-cols-2">
          {categories.length > 0 ? (
            <div className="luxe-card-soft rounded-3xl p-6">
              <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
                Popular categories
              </div>

              <p className="mt-3 text-sm leading-6 text-white/60">
                Explore the most common halal business categories currently
                available on SalahNearMe.
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                {categories.map(([name, count]) => (
                  <span
                    key={name}
                    className="rounded-full border border-white/10 bg-black/30 px-4 py-2 text-sm text-white/75"
                  >
                    {name}
                    <span className="ml-1 text-yellow-400">{count}</span>
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {cities.length > 0 ? (
            <div className="luxe-card-soft rounded-3xl p-6">
              <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
                Browse by city
              </div>

              <p className="mt-3 text-sm leading-6 text-white/60">
                Jump straight into local halal business pages for major cities.
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                {cities.map((city) => (
                  <Link
                    key={city.slug}
                    href={`/${city.slug}/businesses`}
                    className="rounded-full border border-yellow-500/20 bg-black/30 px-4 py-2 text-sm font-semibold text-white/75 hover:border-yellow-400/50 hover:text-yellow-400"
                  >
                    {city.city}
                    <span className="ml-1 text-yellow-400">{city.count}</span>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {rankedBusinesses.length === 0 ? (
        <EmptyDirectoryState />
      ) : (
        <>
          <section className="space-y-4">
            <div>
              <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
                Featured and trusted listings
              </div>

              <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-white">
                Explore halal businesses
              </h2>

              <p className="mt-2 max-w-3xl text-white/60">
                Featured and verified listings are prioritised first, followed
                by active community listings.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {topBusinesses.map((business, index) => (
                <BusinessCard
                  key={business.id}
                  business={business}
                  index={index}
                />
              ))}
            </div>
          </section>

          {remainingBusinesses.length > 0 ? (
            <section className="space-y-4">
              <div>
                <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
                  More halal businesses
                </div>

                <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-white">
                  More listings
                </h2>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {remainingBusinesses.map((business) => (
                  <CompactBusinessRow key={business.id} business={business} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}

      <section className="luxe-card-soft rounded-3xl p-7 md:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr] lg:items-center">
          <div>
            <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
              Help grow SalahNearMe
            </div>

            <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-white">
              Know a halal business missing from the directory?
            </h2>

            <p className="mt-3 max-w-3xl leading-7 text-white/65">
              Add restaurants, butchers, groceries, Islamic shops, clinics,
              travel agents, tuition centres, charities, and other
              Muslim-friendly services so local Muslims and travellers can find
              them.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 lg:justify-end">
            <Link href="/add-business" className="luxe-button text-sm">
              Add business
            </Link>

            <Link href="/advertise" className="luxe-button-outline text-sm">
              Become featured
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function BusinessCard({
  business,
  index,
}: {
  business: BusinessRow;
  index: number;
}) {
  const premium = isPremiumBusiness(business);
  const cardImage = getCardImage(business);
  const profileHref = getBusinessProfileHref(business);
  const websiteUrl = normaliseExternalUrl(business.website);
  const mapsUrl = normaliseExternalUrl(business.maps_url);
  const phoneHref = normalisePhoneHref(business.phone);
  const cityHref = getCityHref(business.city);
  const locationLine = getLocationLine(business);
  const addressLine = getAddressLine(business);

  return (
    <article
      className={`overflow-hidden rounded-3xl transition ${
        premium
          ? "luxe-card border-yellow-500/30 shadow-[0_0_40px_rgba(212,175,55,0.08)]"
          : "luxe-card hover:border-yellow-400/40"
      }`}
    >
      {cardImage ? (
        <div className="relative h-44 overflow-hidden">
          <img
            src={cardImage}
            alt={`${business.name ?? "Halal business"} image`}
            className="h-full w-full object-cover"
            loading="lazy"
          />

          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

          {business.logo_url && business.cover_image_url ? (
            <img
              src={business.logo_url}
              alt={`${business.name ?? "Business"} logo`}
              className="absolute bottom-3 left-3 h-14 w-14 rounded-2xl border border-yellow-500/30 bg-black object-cover p-1"
              loading="lazy"
            />
          ) : null}
        </div>
      ) : null}

      <div className="p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {index < 3 && premium ? <Badge>Top placement</Badge> : null}
          {business.city_sponsor && isPaidActive(business.paid_until) ? (
            <Badge>City Sponsor</Badge>
          ) : null}
          {business.mosque_sponsor && isPaidActive(business.paid_until) ? (
            <Badge>Mosque Sponsor</Badge>
          ) : null}
          {business.featured && isPaidActive(business.paid_until) ? (
            <Badge>Featured</Badge>
          ) : null}
          {business.is_verified ? <Badge variant="green">Verified</Badge> : null}
        </div>

        {profileHref ? (
          <BusinessTrackedLink
            businessId={business.id}
            href={profileHref}
            eventType="profile_click"
            source="all_businesses_page"
            pageType="business_directory"
            className="text-xl font-bold text-white hover:text-yellow-400"
          >
            {business.name ?? "Unnamed business"}
          </BusinessTrackedLink>
        ) : (
          <h2 className="text-xl font-bold text-white">
            {business.name ?? "Unnamed business"}
          </h2>
        )}

        <div className="mt-2 text-white/70">
          {locationLine || getListingLabel(business)}
        </div>

        <div className="mt-2 text-sm text-white/50">
          {addressLine || "Location details coming soon"}
        </div>

        <div className="mt-4 text-xs uppercase tracking-[0.2em] text-white/35">
          {getListingLabel(business)}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {profileHref ? (
            <BusinessTrackedLink
              businessId={business.id}
              href={profileHref}
              eventType="profile_click"
              source="all_businesses_page"
              pageType="business_directory"
              className="rounded-lg border border-yellow-500/30 bg-black px-3 py-2 text-xs font-semibold text-yellow-400 hover:bg-yellow-500/10"
            >
              View profile
            </BusinessTrackedLink>
          ) : null}

          {cityHref ? (
            <Link
              href={cityHref}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/10"
            >
              {formatLabel(business.city)}
            </Link>
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

          {phoneHref ? (
            <BusinessTrackedLink
              businessId={business.id}
              href={phoneHref}
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
}

function CompactBusinessRow({ business }: { business: BusinessRow }) {
  const profileHref = getBusinessProfileHref(business);
  const cityPageHref = getCityPageHref(business.city);
  const locationLine = getLocationLine(business);

  return (
    <article className="luxe-card-soft rounded-2xl p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap gap-2">
            {business.is_verified ? <Badge variant="green">Verified</Badge> : null}
            {isPremiumBusiness(business) ? <Badge>Featured</Badge> : null}
          </div>

          {profileHref ? (
            <BusinessTrackedLink
              businessId={business.id}
              href={profileHref}
              eventType="profile_click"
              source="all_businesses_page_more_listings"
              pageType="business_directory"
              className="text-lg font-bold text-white hover:text-yellow-400"
            >
              {business.name ?? "Unnamed business"}
            </BusinessTrackedLink>
          ) : (
            <h3 className="text-lg font-bold text-white">
              {business.name ?? "Unnamed business"}
            </h3>
          )}

          <p className="mt-2 text-sm text-white/60">
            {locationLine || "Halal business listing"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 md:justify-end">
          {profileHref ? (
            <BusinessTrackedLink
              businessId={business.id}
              href={profileHref}
              eventType="profile_click"
              source="all_businesses_page_more_listings"
              pageType="business_directory"
              className="rounded-lg border border-yellow-500/30 px-3 py-2 text-xs font-semibold text-yellow-400 hover:bg-yellow-500/10"
            >
              Profile
            </BusinessTrackedLink>
          ) : null}

          {cityPageHref ? (
            <Link
              href={cityPageHref}
              className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/75 hover:bg-white/10"
            >
              City
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function EmptyDirectoryState() {
  return (
    <section className="luxe-card-soft rounded-3xl p-8 md:p-10">
      <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
            Help build the directory
          </div>

          <h2 className="dashboard-hero-glow mt-4 text-4xl font-black tracking-[-0.04em] text-white md:text-5xl">
            No halal businesses listed yet.
          </h2>

          <p className="mt-4 max-w-3xl leading-7 text-white/65">
            SalahNearMe is expanding city by city. Add halal restaurants,
            butchers, grocery shops, Islamic bookstores, travel services,
            tuition centres, charities, clinics, and trusted Muslim-friendly
            services.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/add-business" className="luxe-button text-sm">
              Add the first business
            </Link>

            <Link href="/advertise" className="luxe-button-outline text-sm">
              Become a launch sponsor
            </Link>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
          <h3 className="text-xl font-black text-white">Why add listings?</h3>

          <div className="mt-4 space-y-3">
            <InfoBox
              title="Help Muslims find halal places"
              description="Make it easier for locals and travellers to discover trusted halal services."
            />
            <InfoBox
              title="Support local Muslim businesses"
              description="New listings create visibility, traffic, calls, map clicks, and customer trust."
            />
            <InfoBox
              title="Build a national halal directory"
              description="Every verified listing improves SalahNearMe for the wider Muslim community."
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function InfoBox({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="font-bold text-yellow-400">{title}</div>
      <p className="mt-2 text-sm leading-6 text-white/60">{description}</p>
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

function MiniStat({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="text-xs uppercase tracking-[0.18em] text-white/40">
        {title}
      </div>

      <div className="mt-2 text-2xl font-black text-white">{value}</div>
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