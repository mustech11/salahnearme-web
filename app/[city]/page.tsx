import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { supabasePublic } from "@/lib/supabaseServer";
import { cityBranding } from "@/lib/cityBranding";
import { sortBusinessesByRank } from "@/lib/businessRanking";
import {
  buildMosqueLiveTrust,
  type LiveReportRow,
} from "@/lib/mosqueTrust";
import { sortMosquesByTrustAndActivity } from "@/lib/mosqueSmartRanking";
import {
  calculatePrayerTimesForCity,
  type PrayerTimesResult,
} from "@/lib/prayerTimes";

import NextSalahCountdown from "@/components/NextSalahCountdown";

export const revalidate = 300;

type PageProps = {
  params: Promise<{ city: string }>;
};

type CityRow = {
  id: number;
  name: string;
  slug: string;
  country: string | null;
  country_code?: string | null;
  timezone: string | null;
  latitude: number | null;
  longitude: number | null;
  is_active?: boolean | null;
};

type BusinessRow = {
  id: string;
  name: string | null;
  slug: string | null;
  category: string | null;
  city: string | null;
  area?: string | null;
  postcode?: string | null;
  featured: boolean | null;
  featured_rank: number | null;
  pricing_tier: string | null;
  paid_until: string | null;
  is_verified: boolean | null;
};

type MosqueRow = {
  id: string;
  name: string | null;
  slug: string | null;
  area: string | null;
  postcode: string | null;
};

type PrayerTimesRow = PrayerTimesResult;

type PrayerTimesOverrideRow = {
  fajr_start?: string | null;
  sunrise?: string | null;
  dhuhr_start?: string | null;
  asr_start?: string | null;
  maghrib_start?: string | null;
  isha_start?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type PrayerTimesSource =
  | "manual_override"
  | "calculated"
  | "unavailable";

function formatTime(value: string | null | undefined) {
  if (!value) return "—";

  const trimmed = value.trim();

  if (!trimmed) return "—";

  return trimmed.slice(0, 5);
}

function hasAnyPrayerTime(value: PrayerTimesRow | null | undefined) {
  if (!value) return false;

  return Boolean(
    value.fajr_start ||
      value.sunrise ||
      value.dhuhr_start ||
      value.asr_start ||
      value.maghrib_start ||
      value.isha_start
  );
}

function formatUpdatedAt(
  value: string | null | undefined,
  timezone: string | null
) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone ?? "Europe/London",
  }).format(date);
}

function sourceBadge(source: PrayerTimesSource) {
  if (source === "manual_override") {
    return "Verified local timetable";
  }

  if (source === "calculated") {
    return "Calculated automatically";
  }

  return "Times unavailable";
}

function sourceHelperText(source: PrayerTimesSource, cityName: string) {
  if (source === "manual_override") {
    return `These times are from the saved ${cityName} city timetable.`;
  }

  if (source === "calculated") {
    return `Approximate beginning times calculated from ${cityName} city coordinates.`;
  }

  return `Prayer times are not available for ${cityName} yet.`;
}

function toPrayerTimesRow(
  override: PrayerTimesOverrideRow
): PrayerTimesRow {
  return {
    fajr_start: override.fajr_start ?? null,
    sunrise: override.sunrise ?? null,
    dhuhr_start: override.dhuhr_start ?? null,
    asr_start: override.asr_start ?? null,
    maghrib_start: override.maghrib_start ?? null,
    isha_start: override.isha_start ?? null,
  };
}

function getCanonicalUrl(slug: string) {
  return `https://www.salahnearme.com/${slug}`;
}

function getDescription(cityName: string) {
  return `Find ${cityName} prayer times, mosques, halal restaurants, halal butchers, Islamic shops, Muslim-friendly services, Hajj and Umrah resources on SalahNearMe.`;
}

export async function generateStaticParams() {
  const supabase = supabasePublic();

  const { data } = await supabase
    .from("cities")
    .select("slug")
    .eq("is_active", true);

  return (data ?? [])
    .filter((c) => typeof c.slug === "string" && c.slug.length > 0)
    .map((c) => ({
      city: c.slug,
    }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { city } = await params;

  const supabase = supabasePublic();

  const { data: cityRow } = await supabase
    .from("cities")
    .select("name,slug,country")
    .eq("slug", city)
    .eq("is_active", true)
    .maybeSingle();

  if (!cityRow) {
    return {
      title: "City Not Found | SalahNearMe",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const title = `Mosques, Prayer Times & Halal Businesses in ${cityRow.name} | SalahNearMe`;
  const description = getDescription(cityRow.name);
  const canonical = getCanonicalUrl(cityRow.slug);

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "SalahNearMe",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function CityPage({ params }: PageProps) {
  const { city } = await params;

  const supabase = supabasePublic();

  const { data: cityRowRaw } = await supabase
    .from("cities")
    .select(
      "id,name,slug,country,country_code,timezone,latitude,longitude,is_active"
    )
    .eq("slug", city)
    .eq("is_active", true)
    .maybeSingle();

  const cityRow = cityRowRaw as CityRow | null;

  if (!cityRow) {
    notFound();
  }

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const [
    { data: businessesRaw },
    { data: mosquesRaw },
    { data: prayerTimesRaw },
  ] = await Promise.all([
    supabase
      .from("businesses")
      .select(
        "id,name,slug,category,city,area,postcode,featured,featured_rank,pricing_tier,paid_until,is_verified"
      )
      .eq("city", cityRow.name)
      .eq("is_active", true)
      .order("name", { ascending: true }),

    supabase
      .from("mosques")
      .select("id,name,slug,area,postcode")
      .eq("city_id", cityRow.id)
      .eq("is_active", true)
      .order("name", { ascending: true }),

    supabase
      .from("city_prayer_times")
      .select(
        "fajr_start,sunrise,dhuhr_start,asr_start,maghrib_start,isha_start,created_at,updated_at"
      )
      .eq("city_id", cityRow.id)
      .eq("month", month)
      .eq("year", year)
      .maybeSingle(),
  ]);

  const allBusinesses = (businessesRaw ?? []) as BusinessRow[];
  const allMosques = (mosquesRaw ?? []) as MosqueRow[];

  let prayerTimes: PrayerTimesRow | null = null;
  let prayerTimesSource: PrayerTimesSource = "unavailable";
  let prayerTimesUpdatedAt: string | null = null;

  if (prayerTimesRaw) {
    const override = prayerTimesRaw as PrayerTimesOverrideRow;
    const overrideTimes = toPrayerTimesRow(override);

    if (hasAnyPrayerTime(overrideTimes)) {
      prayerTimes = overrideTimes;
      prayerTimesSource = "manual_override";
      prayerTimesUpdatedAt =
        override.updated_at ?? override.created_at ?? null;
    }
  }

  if (!hasAnyPrayerTime(prayerTimes)) {
    const calculated = calculatePrayerTimesForCity({
      timezone: cityRow.timezone,
      latitude: cityRow.latitude,
      longitude: cityRow.longitude,
    });

    if (hasAnyPrayerTime(calculated)) {
      prayerTimes = calculated;
      prayerTimesSource = "calculated";
    } else {
      prayerTimes = null;
      prayerTimesSource = "unavailable";
    }
  }

  let rankedMosques = allMosques;

  const liveMap = new Map<
    string,
    ReturnType<typeof buildMosqueLiveTrust>
  >();

  if (allMosques.length > 0) {
    const { data: liveReportsRaw } = await supabase
      .from("mosque_live_reports")
      .select("mosque_id,report_type,created_at,user_fingerprint")
      .in(
        "mosque_id",
        allMosques.map((m) => m.id)
      )
      .order("created_at", { ascending: false })
      .limit(500);

    const liveReports = (liveReportsRaw ?? []) as LiveReportRow[];

    const grouped = new Map<string, LiveReportRow[]>();

    for (const report of liveReports) {
      const current = grouped.get(report.mosque_id) ?? [];
      current.push(report);
      grouped.set(report.mosque_id, current);
    }

    for (const mosque of allMosques) {
      liveMap.set(
        mosque.id,
        buildMosqueLiveTrust(grouped.get(mosque.id) ?? [])
      );
    }

    rankedMosques = sortMosquesByTrustAndActivity(
      allMosques,
      liveMap
    );
  }

  const rankedBusinesses = sortBusinessesByRank(allBusinesses, {
    cityName: cityRow.name,
  });

  const featuredBusinesses = rankedBusinesses
    .filter((b) => b.featured)
    .slice(0, 6);

  const businesses = rankedBusinesses.slice(0, 6);
  const mosques = rankedMosques.slice(0, 6);

  const verifiedBusinessCount = allBusinesses.filter(
    (business) => business.is_verified
  ).length;

  const liveMosqueCount = rankedMosques.filter(
    (m) => liveMap.get(m.id)?.hasLive ?? false
  ).length;

  const strongConfidenceCount = rankedMosques.filter(
    (m) => liveMap.get(m.id)?.confidence === "strong"
  ).length;

  const branding =
    cityBranding[cityRow.slug as keyof typeof cityBranding];

  const prayers = [
    { name: "Fajr", value: formatTime(prayerTimes?.fajr_start) },
    { name: "Sunrise", value: formatTime(prayerTimes?.sunrise) },
    { name: "Dhuhr", value: formatTime(prayerTimes?.dhuhr_start) },
    { name: "Asr", value: formatTime(prayerTimes?.asr_start) },
    { name: "Maghrib", value: formatTime(prayerTimes?.maghrib_start) },
    { name: "Isha", value: formatTime(prayerTimes?.isha_start) },
  ];

  const formattedUpdatedAt = formatUpdatedAt(
    prayerTimesUpdatedAt,
    cityRow.timezone
  );

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `Mosques, Prayer Times & Halal Businesses in ${cityRow.name}`,
    description: getDescription(cityRow.name),
    url: getCanonicalUrl(cityRow.slug),
    isPartOf: {
      "@type": "WebSite",
      name: "SalahNearMe",
      url: "https://www.salahnearme.com",
    },
    about: [
      "Mosques",
      "Prayer Times",
      "Halal Businesses",
      "Hajj",
      "Umrah",
      cityRow.name,
    ],
  };

  return (
    <div className="space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd),
        }}
      />

      <section className="luxe-card relative overflow-hidden rounded-3xl p-8 md:p-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,0.16),transparent_35%)]" />

        {branding?.image && (
          <div className="pointer-events-none absolute right-0 top-0 hidden h-full w-[36%] opacity-10 md:block">
            <Image
              src={branding.image}
              alt={branding.symbol}
              fill
              className="object-contain object-right"
              priority={false}
            />
          </div>
        )}

        <div className="relative z-10 grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
              SalahNearMe City Guide
            </div>

            <h1 className="mt-4 text-5xl font-black tracking-tight text-white md:text-6xl">
              {cityRow.name}
            </h1>

            <p className="mt-5 max-w-3xl text-lg leading-relaxed text-white/70">
              {branding?.tagline ??
                `Discover mosques, prayer times, halal businesses, Hajj and Umrah resources, and trusted Muslim community listings in ${cityRow.name}.`}
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <Badge>
                {branding?.symbol ?? `${cityRow.name} City`}
              </Badge>

              {cityRow.country && <Badge>{cityRow.country}</Badge>}

              {cityRow.timezone && <Badge>{cityRow.timezone}</Badge>}
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={`/${cityRow.slug}/prayer-times`}
                className="luxe-button text-sm"
              >
                View Prayer Times
              </Link>

              <Link
                href={`/${cityRow.slug}/mosques`}
                className="luxe-button-outline text-sm"
              >
                Browse Mosques
              </Link>

              <Link
                href={`/${cityRow.slug}/businesses`}
                className="luxe-button-outline text-sm"
              >
                Halal Businesses
              </Link>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <Stat title="Mosques" value={allMosques.length} />
              <Stat title="Businesses" value={allBusinesses.length} />
              <Stat title="Featured" value={featuredBusinesses.length} />
            </div>
          </div>

          <div className="luxe-card-soft rounded-3xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-2xl font-bold text-yellow-400">
                  Today’s Salah Times
                </div>

                <p className="mt-2 text-sm text-white/60">
                  Beginning times for {cityRow.name}.
                </p>

                <div className="mt-3 inline-flex rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-400">
                  {sourceBadge(prayerTimesSource)}
                </div>

                <p className="mt-2 max-w-sm text-xs leading-relaxed text-white/45">
                  {sourceHelperText(prayerTimesSource, cityRow.name)}
                </p>

                {formattedUpdatedAt && (
                  <div className="mt-2 text-xs text-white/50">
                    Last updated: {formattedUpdatedAt}
                  </div>
                )}
              </div>

              <div className="shrink-0 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-400">
                {month}/{year}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {prayers.map((prayer) => (
                <div
                  key={prayer.name}
                  className="rounded-2xl border border-white/10 bg-[rgb(var(--card))] p-4 text-center"
                >
                  <div className="text-sm font-semibold text-yellow-400">
                    {prayer.name}
                  </div>

                  <div className="mt-2 text-2xl font-black text-white">
                    {prayer.value}
                  </div>

                  <div className="mt-1 text-xs text-white/50">
                    Begins
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6">
              <Link
                href={`/${cityRow.slug}/prayer-times`}
                className="luxe-button-outline text-sm"
              >
                Open full prayer times page
              </Link>
            </div>
          </div>
        </div>
      </section>

      <NextSalahCountdown
        prayerTimes={prayerTimes}
        cityName={cityRow.name}
      />

      <section className="grid gap-4 md:grid-cols-3">
        <FeatureCard
          href="/hajj"
          title="Hajj Guide"
          description="Step-by-step Hajj rituals with visuals, duas, and practical preparation."
        />

        <FeatureCard
          href="/umrah"
          title="Umrah Guide"
          description="Learn Umrah from Ihram to completion with clear guided steps."
        />

        <FeatureCard
          href="/travel"
          title="Travel Mode"
          description="Find mosques and halal essentials while travelling."
        />
      </section>

      {(liveMosqueCount > 0 || strongConfidenceCount > 0) && (
        <section className="luxe-card rounded-3xl p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-2xl font-bold text-green-300">
                Live mosque activity
              </div>

              <p className="mt-2 text-sm text-white/60">
                {liveMosqueCount} mosque
                {liveMosqueCount === 1 ? "" : "s"} with recent live
                signals. {strongConfidenceCount} strong confidence.
              </p>
            </div>

            <Link
              href={`/${cityRow.slug}/mosques`}
              className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm font-semibold text-green-300 hover:bg-green-500/20"
            >
              View active mosques
            </Link>
          </div>
        </section>
      )}

      {featuredBusinesses.length > 0 && (
        <BusinessSection
          title="Featured Halal Businesses"
          businesses={featuredBusinesses}
        />
      )}

      <section className="grid gap-6 md:grid-cols-2">
        <MosqueList
          city={cityRow.slug}
          mosques={mosques}
          liveMap={liveMap}
        />

        <BusinessList
          city={cityRow.slug}
          businesses={businesses}
        />
      </section>

      {allMosques.length === 0 && allBusinesses.length === 0 && (
        <section className="luxe-card rounded-3xl p-8">
          <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
            Help build {cityRow.name}
          </div>

          <h2 className="mt-4 max-w-3xl text-4xl font-black text-white md:text-5xl">
            Add mosques and halal places in {cityRow.name}.
          </h2>

          <p className="mt-4 max-w-3xl text-base leading-relaxed text-white/70">
            SalahNearMe is expanding city by city. If you know a mosque,
            halal restaurant, butcher, grocery shop, Islamic bookstore,
            travel service, clinic, charity, or Muslim-friendly local
            service in {cityRow.name}, help the community by submitting it.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/add-business" className="luxe-button text-sm">
              Add halal business
            </Link>

            <Link
              href="/claim-mosque"
              className="luxe-button-outline text-sm"
            >
              Add or claim mosque
            </Link>
          </div>
        </section>
      )}

      <section className="luxe-card rounded-3xl p-8">
        <div className="text-3xl font-black text-yellow-400">
          Explore {cityRow.name} on SalahNearMe
        </div>

        <p className="mt-4 max-w-3xl text-lg leading-relaxed text-white/70">
          Browse city prayer times, discover mosques, find halal
          businesses, and use guided Hajj and Umrah resources.
          SalahNearMe is designed to make Muslim life easier, clearer,
          and more connected city by city.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <MiniStat label="Verified businesses" value={verifiedBusinessCount} />
          <MiniStat label="Live mosque signals" value={liveMosqueCount} />
          <MiniStat label="Strong confidence" value={strongConfidenceCount} />
        </div>
      </section>
    </div>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/70">
      {children}
    </div>
  );
}

function Stat({ title, value }: { title: string; value: number }) {
  return (
    <div className="luxe-card-soft rounded-2xl p-4">
      <div className="text-xs uppercase tracking-[0.2em] text-yellow-400">
        {title}
      </div>

      <div className="mt-2 text-3xl font-black text-white">
        {value}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="text-xs uppercase tracking-[0.18em] text-white/45">
        {label}
      </div>

      <div className="mt-2 text-2xl font-black text-white">
        {value}
      </div>
    </div>
  );
}

function FeatureCard({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="luxe-card rounded-3xl p-6 transition hover:-translate-y-1 hover:border-yellow-400/40"
    >
      <div className="text-xl font-bold text-yellow-400">{title}</div>

      <p className="mt-3 text-sm leading-relaxed text-white/70">
        {description}
      </p>
    </Link>
  );
}

function BusinessSection({
  title,
  businesses,
}: {
  title: string;
  businesses: BusinessRow[];
}) {
  return (
    <section className="luxe-card rounded-3xl p-8">
      <div className="text-2xl font-bold text-yellow-400">{title}</div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {businesses.map((business) => (
          <Link
            key={business.id}
            href={business.slug ? `/business/${business.slug}` : "#"}
            className="luxe-card-soft rounded-2xl p-5 transition hover:border-yellow-400/50"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-white">
                  {business.name ?? "Unnamed business"}
                </div>

                <div className="mt-1 text-sm text-white/60">
                  {business.category ?? "Business"}
                </div>
              </div>

              {business.is_verified && (
                <div className="rounded-full border border-green-500/30 bg-green-500/10 px-2 py-1 text-xs font-semibold text-green-300">
                  Verified
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function MosqueList({
  city,
  mosques,
  liveMap,
}: {
  city: string;
  mosques: MosqueRow[];
  liveMap: Map<string, ReturnType<typeof buildMosqueLiveTrust>>;
}) {
  return (
    <section className="luxe-card rounded-3xl p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="text-2xl font-bold text-yellow-400">
          Mosques
        </div>

        <Link href={`/${city}/mosques`} className="text-sm text-yellow-400">
          View all →
        </Link>
      </div>

      <div className="mt-5 space-y-3">
        {mosques.length === 0 ? (
          <Empty text="No mosques found yet." />
        ) : (
          mosques.map((mosque) => {
            const live = liveMap.get(mosque.id);

            return (
              <div
                key={mosque.id}
                className="luxe-card-soft rounded-2xl p-4"
              >
                {mosque.slug ? (
                  <Link
                    href={`/mosque/${mosque.slug}`}
                    className="font-semibold text-white hover:text-yellow-400"
                  >
                    {mosque.name ?? "Unnamed mosque"}
                  </Link>
                ) : (
                  <div className="font-semibold text-white">
                    {mosque.name ?? "Unnamed mosque"}
                  </div>
                )}

                <div className="mt-1 text-sm text-white/60">
                  {[mosque.area, mosque.postcode].filter(Boolean).join(" • ") ||
                    "Local mosque"}
                </div>

                {live?.hasLive && (
                  <div className="mt-3 inline-flex rounded-full border border-green-500/30 bg-green-500/10 px-2 py-1 text-xs text-green-300">
                    Live · {live.confidence}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

function BusinessList({
  city,
  businesses,
}: {
  city: string;
  businesses: BusinessRow[];
}) {
  return (
    <section className="luxe-card rounded-3xl p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="text-2xl font-bold text-yellow-400">
          Halal Businesses
        </div>

        <Link
          href={`/${city}/businesses`}
          className="text-sm text-yellow-400"
        >
          View all →
        </Link>
      </div>

      <div className="mt-5 space-y-3">
        {businesses.length === 0 ? (
          <Empty text="No businesses found yet." />
        ) : (
          businesses.map((business) => (
            <div
              key={business.id}
              className="luxe-card-soft rounded-2xl p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  {business.slug ? (
                    <Link
                      href={`/business/${business.slug}`}
                      className="font-semibold text-white hover:text-yellow-400"
                    >
                      {business.name ?? "Unnamed business"}
                    </Link>
                  ) : (
                    <div className="font-semibold text-white">
                      {business.name ?? "Unnamed business"}
                    </div>
                  )}

                  <div className="mt-1 text-sm text-white/60">
                    {[business.category, business.area]
                      .filter(Boolean)
                      .join(" • ") || "Business"}
                  </div>
                </div>

                {business.is_verified && (
                  <div className="rounded-full border border-green-500/30 bg-green-500/10 px-2 py-1 text-xs font-semibold text-green-300">
                    Verified
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="luxe-card-soft rounded-2xl p-4 text-sm text-white/60">
      {text}
    </div>
  );
}