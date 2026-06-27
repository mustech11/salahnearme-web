import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

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
  timezone: string | null;
  latitude: number | null;
  longitude: number | null;
};

type BusinessRow = {
  id: string;
  name: string | null;
  slug: string | null;
  category: string | null;
  city: string | null;
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

type PrayerTimesOverrideRow = PrayerTimesRow & {
  created_at?: string | null;
};

function formatTime(value: string | null | undefined) {
  if (!value) return "—";
  return value.slice(0, 5);
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

function sourceBadge(
  source: "manual_override" | "calculated" | "unavailable"
) {
  if (source === "manual_override") {
    return "Verified local override";
  }

  if (source === "calculated") {
    return "Calculated automatically";
  }

  return "Times unavailable";
}

export async function generateStaticParams() {
  const supabase = supabasePublic();

  const { data } = await supabase
    .from("cities")
    .select("slug")
    .eq("is_active", true);

  return (data ?? []).map((c) => ({
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
    .select("name,slug")
    .eq("slug", city)
    .eq("is_active", true)
    .maybeSingle();

  if (!cityRow) {
    return {
      title: "City Not Found",
    };
  }

  return {
    title: `Mosques, Prayer Times & Halal Businesses in ${cityRow.name} | SalahNearMe`,
    description: `Find ${cityRow.name} prayer times, mosques, halal businesses, Hajj and Umrah guides, and trusted Muslim community listings on SalahNearMe.`,
    alternates: {
      canonical: `/${cityRow.slug}`,
    },
    openGraph: {
      title: `Mosques, Prayer Times & Halal Businesses in ${cityRow.name}`,
      description: `Browse mosques, salah times, halal businesses, Hajj and Umrah resources in ${cityRow.name}.`,
      url: `/${cityRow.slug}`,
    },
  };
}

export default async function CityPage({ params }: PageProps) {
  const { city } = await params;

  const supabase = supabasePublic();

  const { data: cityRowRaw } = await supabase
    .from("cities")
    .select("id,name,slug,country,timezone,latitude,longitude")
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
        "id,name,slug,category,city,featured,featured_rank,pricing_tier,paid_until,is_verified"
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
        "fajr_start,sunrise,dhuhr_start,asr_start,maghrib_start,isha_start,created_at"
      )
      .eq("city_id", cityRow.id)
      .eq("month", month)
      .eq("year", year)
      .maybeSingle(),
  ]);

  const allBusinesses = (businessesRaw ?? []) as BusinessRow[];
  const allMosques = (mosquesRaw ?? []) as MosqueRow[];

  let prayerTimes: PrayerTimesRow | null = null;

  let prayerTimesSource:
    | "manual_override"
    | "calculated"
    | "unavailable" = "unavailable";

  let prayerTimesUpdatedAt: string | null = null;

  if (prayerTimesRaw) {
    const override = prayerTimesRaw as PrayerTimesOverrideRow;

    prayerTimes = {
      fajr_start: override.fajr_start,
      sunrise: override.sunrise,
      dhuhr_start: override.dhuhr_start,
      asr_start: override.asr_start,
      maghrib_start: override.maghrib_start,
      isha_start: override.isha_start,
    };

    prayerTimesSource = "manual_override";
    prayerTimesUpdatedAt = override.created_at ?? null;
  } else {
    prayerTimes = calculatePrayerTimesForCity({
      timezone: cityRow.timezone,
      latitude: cityRow.latitude,
      longitude: cityRow.longitude,
    });

    prayerTimesSource = prayerTimes ? "calculated" : "unavailable";
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
      .order("created_at", { ascending: false });

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
    description: `Find mosques, salah times, halal businesses, Hajj and Umrah guides in ${cityRow.name}.`,
    url: `https://www.salahnearme.com/${cityRow.slug}`,
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

              {cityRow.country && (
                <Badge>{cityRow.country}</Badge>
              )}

              {cityRow.timezone && (
                <Badge>{cityRow.timezone}</Badge>
              )}
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
              <Stat
                title="Businesses"
                value={allBusinesses.length}
              />
              <Stat
                title="Featured"
                value={featuredBusinesses.length}
              />
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

                {formattedUpdatedAt && (
                  <div className="mt-2 text-xs text-white/50">
                    Last updated: {formattedUpdatedAt}
                  </div>
                )}
              </div>

              <div className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-400">
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
          description="Step-by-step Hajj rituals with visuals, audio, duas, and offline mode."
        />

        <FeatureCard
          href="/umrah"
          title="Umrah Guide"
          description="Learn Umrah from Ihram to shaving or trimming with guided visuals."
        />

        <FeatureCard
          href="/travel"
          title="Travel Mode"
          description="Find mosques and halal essentials while travelling."
        />
      </section>

      {(liveMosqueCount > 0 ||
        strongConfidenceCount > 0) && (
        <section className="luxe-card rounded-3xl p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-2xl font-bold text-green-300">
                Live mosque activity
              </div>

              <p className="mt-2 text-sm text-white/60">
                {liveMosqueCount} mosque
                {liveMosqueCount === 1 ? "" : "s"} with
                recent live signals.{" "}
                {strongConfidenceCount} strong confidence.
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

      <section className="luxe-card rounded-3xl p-8">
        <div className="text-3xl font-black text-yellow-400">
          Explore {cityRow.name} on SalahNearMe
        </div>

        <p className="mt-4 max-w-3xl text-lg leading-relaxed text-white/70">
          Browse city prayer times, discover mosques,
          find halal businesses, and use guided Hajj
          and Umrah resources. SalahNearMe is designed
          to make Muslim life easier, clearer, and more
          connected city by city.
        </p>
      </section>
    </div>
  );
}

function Badge({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/70">
      {children}
    </div>
  );
}

function Stat({
  title,
  value,
}: {
  title: string;
  value: number;
}) {
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
      className="luxe-card rounded-3xl p-6 transition hover:-translate-y-1"
    >
      <div className="text-xl font-bold text-yellow-400">
        {title}
      </div>

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
      <div className="text-2xl font-bold text-yellow-400">
        {title}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {businesses.map((b) => (
          <Link
            key={b.id}
            href={b.slug ? `/business/${b.slug}` : "#"}
            className="luxe-card-soft rounded-2xl p-5 transition hover:border-yellow-400/50"
          >
            <div className="font-semibold text-white">
              {b.name}
            </div>

            <div className="mt-1 text-sm text-white/60">
              {b.category ?? "Business"}
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
  liveMap: Map<
    string,
    ReturnType<typeof buildMosqueLiveTrust>
  >;
}) {
  return (
    <section className="luxe-card rounded-3xl p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="text-2xl font-bold text-yellow-400">
          Mosques
        </div>

        <Link
          href={`/${city}/mosques`}
          className="text-sm text-yellow-400"
        >
          View all →
        </Link>
      </div>

      <div className="mt-5 space-y-3">
        {mosques.length === 0 ? (
          <Empty text="No mosques found yet." />
        ) : (
          mosques.map((m) => {
            const live = liveMap.get(m.id);

            return (
              <div
                key={m.id}
                className="luxe-card-soft rounded-2xl p-4"
              >
                <Link
                  href={`/mosque/${m.slug}`}
                  className="font-semibold text-white hover:text-yellow-400"
                >
                  {m.name}
                </Link>

                <div className="mt-1 text-sm text-white/60">
                  {[m.area, m.postcode]
                    .filter(Boolean)
                    .join(" • ")}
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
          businesses.map((b) => (
            <div
              key={b.id}
              className="luxe-card-soft rounded-2xl p-4"
            >
              {b.slug ? (
                <Link
                  href={`/business/${b.slug}`}
                  className="font-semibold text-white hover:text-yellow-400"
                >
                  {b.name}
                </Link>
              ) : (
                <div className="font-semibold text-white">
                  {b.name}
                </div>
              )}

              <div className="mt-1 text-sm text-white/60">
                {b.category ?? "Business"}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function Empty({
  text,
}: {
  text: string;
}) {
  return (
    <div className="luxe-card-soft rounded-2xl p-4 text-sm text-white/60">
      {text}
    </div>
  );
}