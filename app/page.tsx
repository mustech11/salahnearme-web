import type { Metadata } from "next";

import Link from "next/link";
import { cookies } from "next/headers";

import CitySearch from "@/components/CitySearch";
import HomeDailyPanel from "@/components/HomeDailyPanel";
import HomeHajjHijriBanner from "@/components/HomeHajjHijriBanner";
import NextSalahCountdown from "@/components/NextSalahCountdown";
import SelectedCityHomePanel from "@/components/SelectedCityHomePanel";
import SmartDailyModePanel from "@/components/SmartDailyModePanel";

import {
  calculatePrayerTimesForCity,
  type PrayerTimesResult,
} from "@/lib/prayerTimes";
import { supabaseServer } from "@/lib/supabaseServer";

export const revalidate = 300;

const rawSiteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "https://www.salahnearme.com";

const siteUrl = rawSiteUrl.replace(/\/+$/, "");

export const metadata: Metadata = {
  title: "SalahNearMe | Find Mosques, Prayer Times & Halal Places",
  description:
    "Find nearby mosques, accurate prayer times, halal businesses, Muslim travel essentials, Hajj guidance and Umrah guidance with SalahNearMe.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "SalahNearMe | Find. Pray. Connect.",
    description:
      "Your Muslim life, intelligently connected. Find mosques, prayer times, halal places and Muslim travel essentials.",
    url: siteUrl,
    siteName: "SalahNearMe",
    type: "website",
    locale: "en_GB",
    images: [
      {
        url: "/social-icon.png",
        width: 1200,
        height: 630,
        alt: "SalahNearMe",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SalahNearMe | Find. Pray. Connect.",
    description:
      "Find nearby mosques, accurate prayer times, halal places and Muslim travel essentials.",
    images: ["/social-icon.png"],
  },
};

type CityRow = {
  id: number;
  slug: string;
  name: string;
  timezone?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

type PrayerTimesOverrideRow = Partial<PrayerTimesResult> & {
  created_at?: string | null;
};

type PrayerTimesSource =
  | "manual_override"
  | "calculated"
  | "unavailable";

type PrayerTimesLoadResult = {
  prayerTimes: PrayerTimesResult | null;
  prayerTimesSource: PrayerTimesSource;
  prayerTimesUpdatedAt: string | null;
};

type PlatformCounts = {
  cities: number;
  mosques: number;
  businesses: number;
};

type ServiceCardProps = {
  icon: string;
  title: string;
  description: string;
  href: string;
  linkLabel: string;
};

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isValidCityRow(value: unknown): value is CityRow {
  if (!value || typeof value !== "object") {
    return false;
  }

  const city = value as Partial<CityRow>;

  return (
    typeof city.id === "number" &&
    typeof city.slug === "string" &&
    city.slug.trim().length > 0 &&
    typeof city.name === "string" &&
    city.name.trim().length > 0
  );
}

function getSelectedCity(
  cities: CityRow[],
  selectedSlug: string | null
): CityRow | null {
  const cleanedSlug = cleanString(selectedSlug).toLowerCase();

  if (!cleanedSlug) {
    return null;
  }

  return (
    cities.find(
      (city) => city.slug.toLowerCase() === cleanedSlug
    ) ?? null
  );
}

async function getPrayerTimesForCity(
  city: CityRow | null
): Promise<PrayerTimesLoadResult> {
  if (!city) {
    return {
      prayerTimes: null,
      prayerTimesSource: "unavailable",
      prayerTimesUpdatedAt: null,
    };
  }

  const supabase = await supabaseServer();
  const now = new Date();

  const { data, error } = await supabase
    .from("city_prayer_times")
    .select(
      [
        "fajr_start",
        "sunrise",
        "dhuhr_start",
        "asr_start",
        "maghrib_start",
        "isha_start",
        "created_at",
      ].join(",")
    )
    .eq("city_id", city.id)
    .eq("month", now.getMonth() + 1)
    .eq("year", now.getFullYear())
    .maybeSingle();

  if (error) {
    console.error("Homepage city prayer-time query failed:", {
      cityId: city.id,
      citySlug: city.slug,
      code: error.code,
      message: error.message,
    });
  }

  if (data) {
    const row = data as unknown as PrayerTimesOverrideRow;

    return {
      prayerTimes: {
        fajr_start: row.fajr_start ?? null,
        sunrise: row.sunrise ?? null,
        dhuhr_start: row.dhuhr_start ?? null,
        asr_start: row.asr_start ?? null,
        maghrib_start: row.maghrib_start ?? null,
        isha_start: row.isha_start ?? null,
      },
      prayerTimesSource: "manual_override",
      prayerTimesUpdatedAt: row.created_at ?? null,
    };
  }

  const calculated = calculatePrayerTimesForCity({
    timezone: city.timezone,
    latitude: city.latitude,
    longitude: city.longitude,
  });

  return {
    prayerTimes: calculated,
    prayerTimesSource: calculated
      ? "calculated"
      : "unavailable",
    prayerTimesUpdatedAt: null,
  };
}

async function getPlatformCounts(): Promise<PlatformCounts> {
  const supabase = await supabaseServer();

  const [citiesResult, mosquesResult, businessesResult] =
    await Promise.all([
      supabase
        .from("cities")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("is_active", true),

      supabase
        .from("mosques")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("is_active", true),

      supabase
        .from("businesses")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("is_active", true),
    ]);

  if (citiesResult.error) {
    console.error("Homepage city count failed:", {
      code: citiesResult.error.code,
      message: citiesResult.error.message,
    });
  }

  if (mosquesResult.error) {
    console.error("Homepage mosque count failed:", {
      code: mosquesResult.error.code,
      message: mosquesResult.error.message,
    });
  }

  if (businessesResult.error) {
    console.error("Homepage business count failed:", {
      code: businessesResult.error.code,
      message: businessesResult.error.message,
    });
  }

  return {
    cities: citiesResult.count ?? 0,
    mosques: mosquesResult.count ?? 0,
    businesses: businessesResult.count ?? 0,
  };
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-GB").format(value);
}

function PlatformStat({
  icon,
  value,
  label,
  description,
}: {
  icon: string;
  value: string;
  label: string;
  description: string;
}) {
  return (
    <div className="home-platform-stat">
      <div
        aria-hidden="true"
        className="home-platform-stat-icon"
      >
        {icon}
      </div>

      <div>
        <div className="text-xs font-black uppercase tracking-[0.18em] text-yellow-400">
          {label}
        </div>

        <div className="mt-1 text-2xl font-black text-white">
          {value}
        </div>

        <div className="mt-1 text-xs text-white/45">
          {description}
        </div>
      </div>
    </div>
  );
}

function ServiceCard({
  icon,
  title,
  description,
  href,
  linkLabel,
}: ServiceCardProps) {
  return (
    <Link
      href={href}
      className="home-service-card group"
    >
      <span
        aria-hidden="true"
        className="home-service-icon"
      >
        {icon}
      </span>

      <span className="mt-4 block text-lg font-black text-white transition group-hover:text-yellow-200">
        {title}
      </span>

      <span className="mt-2 block text-sm leading-6 text-white/55">
        {description}
      </span>

      <span className="mt-4 inline-flex items-center gap-2 text-sm font-black text-yellow-300">
        {linkLabel}
        <span
          aria-hidden="true"
          className="transition group-hover:translate-x-1"
        >
          →
        </span>
      </span>
    </Link>
  );
}

function TrustFeature({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="home-trust-feature">
      <span
        aria-hidden="true"
        className="home-trust-icon"
      >
        {icon}
      </span>

      <div>
        <div className="font-black text-yellow-300">
          {title}
        </div>

        <p className="mt-1 text-sm leading-6 text-white/52">
          {description}
        </p>
      </div>
    </div>
  );
}

export default async function Home() {
  const supabase = await supabaseServer();
  const cookieStore = await cookies();

  const selectedCitySlug =
    cookieStore.get("snm_city")?.value ?? null;

  const [{ data, error }, platformCounts] =
    await Promise.all([
      supabase
        .from("cities")
        .select(
          [
            "id",
            "slug",
            "name",
            "timezone",
            "country",
            "latitude",
            "longitude",
          ].join(",")
        )
        .eq("is_active", true)
        .order("country", {
          ascending: true,
        })
        .order("name", {
          ascending: true,
        }),

      getPlatformCounts(),
    ]);

  if (error) {
    console.error("Homepage city query failed:", {
      code: error.code,
      message: error.message,
    });

    return (
      <div
        role="alert"
        className="rounded-3xl border border-red-500/30 bg-red-500/10 p-8 text-red-100"
      >
        <h1 className="text-2xl font-black">
          SalahNearMe is temporarily unavailable
        </h1>

        <p className="mt-3 text-sm leading-7 text-red-100/75">
          The city directory could not be loaded. Please
          refresh this page shortly.
        </p>
      </div>
    );
  }

  const cities = ((data ?? []) as unknown[]).filter(
    isValidCityRow
  );

  const selectedCity = getSelectedCity(
    cities,
    selectedCitySlug
  );

  const {
    prayerTimes,
    prayerTimesSource,
    prayerTimesUpdatedAt,
  } = await getPrayerTimesForCity(selectedCity);

  const citySearchOptions = cities.map(
    ({ slug, name, country }) => ({
      slug,
      name,
      country: country ?? null,
    })
  );

  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "SalahNearMe",
    url: siteUrl,
    description:
      "Find mosques, prayer times, halal businesses and Muslim travel essentials.",
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteUrl}/businesses?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  const organisationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "SalahNearMe",
    url: siteUrl,
    logo: `${siteUrl}/logo-horizontal.png`,
    description:
      "A Muslim discovery platform for prayer, mosques, halal businesses and travel.",
  };

  return (
    <div className="compact-page-stack">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            websiteJsonLd,
            organisationJsonLd,
          ]),
        }}
      />

      <section className="home-directory-hero">
        <div className="home-directory-hero-overlay" />

        <div className="relative z-10 flex min-h-[700px] flex-col justify-center px-5 py-14 sm:px-9 lg:min-h-[730px] lg:px-14 xl:px-16">
          <div className="max-w-[720px]">
            <div className="hero-kicker">
              Find. Pray. Connect.
            </div>

            <h1 className="home-directory-title mt-5 white-soft-glow">
              Your Muslim life,
              <span className="gold-gradient-text block">
                intelligently connected.
              </span>
            </h1>

            <p className="mt-6 max-w-[690px] text-base leading-8 text-white/78 sm:text-lg lg:text-xl">
              Find nearby mosques, accurate prayer times,
              halal places and Muslim travel essentials in
              one beautifully simple platform.
            </p>

            <div className="home-directory-search mt-7">
              <CitySearch cities={citySearchOptions} />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs font-black uppercase tracking-[0.16em] text-yellow-400">
                Popular:
              </span>

              <Link
                href="/near-me/pray"
                className="home-popular-pill"
              >
                Mosques
              </Link>

              <Link
                href="/businesses"
                className="home-popular-pill"
              >
                Halal food
              </Link>

              <Link
                href="/businesses"
                className="home-popular-pill"
              >
                Groceries
              </Link>

              <Link
                href="/travel"
                className="home-popular-pill"
              >
                Travel
              </Link>
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/near-me/pray"
                className="premium-button px-6 py-3 text-sm"
              >
                Find the best mosque now
              </Link>

              <Link
                href="/businesses"
                className="premium-button-outline px-6 py-3 text-sm"
              >
                Discover halal places
              </Link>
            </div>
          </div>
        </div>

        <div className="home-hero-bottom-glow" />
      </section>

      <section
        aria-label="SalahNearMe platform coverage"
        className="home-platform-stats"
      >
        <PlatformStat
          icon="⌂"
          label="Mosques"
          value={formatCount(platformCounts.mosques)}
          description="Active mosque listings"
        />

        <PlatformStat
          icon="▣"
          label="Halal businesses"
          value={formatCount(platformCounts.businesses)}
          description="Community listings"
        />

        <PlatformStat
          icon="◎"
          label="Cities covered"
          value={formatCount(platformCounts.cities)}
          description="Supported city pages"
        />

        <PlatformStat
          icon="⌖"
          label="Prayer aware"
          value="Live"
          description="Location-based discovery"
        />
      </section>

      <SmartDailyModePanel className="mt-0" />

      {selectedCity ? (
        <>
          <NextSalahCountdown
            prayerTimes={prayerTimes}
            cityName={selectedCity.name}
          />

          <SelectedCityHomePanel
            city={{
              name: selectedCity.name,
              slug: selectedCity.slug,
              timezone:
                selectedCity.timezone ??
                "Europe/London",
            }}
            prayerTimes={prayerTimes}
            prayerTimesSource={prayerTimesSource}
            prayerTimesUpdatedAt={
              prayerTimesUpdatedAt
            }
          />

          <HomeDailyPanel
            cityId={selectedCity.id}
            cityName={selectedCity.name}
            citySlug={selectedCity.slug}
            prayerTimes={prayerTimes}
          />
        </>
      ) : (
        <>
          <SelectedCityHomePanel
            city={null}
            prayerTimes={null}
            prayerTimesSource="unavailable"
            prayerTimesUpdatedAt={null}
          />

          <HomeDailyPanel />
        </>
      )}

      <section
        aria-labelledby="services-heading"
        className="premium-panel rounded-[2rem] p-5 sm:p-7"
      >
        <div className="text-center">
          <div className="section-kicker justify-center">
            Everything you need
          </div>

          <h2
            id="services-heading"
            className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl"
          >
            Your Muslim essentials in one place
          </h2>

          <p className="mx-auto mt-3 max-w-3xl text-sm leading-7 text-white/55 sm:text-base">
            Move quickly between prayer, halal discovery,
            travel and trusted Islamic guidance.
          </p>
        </div>

        <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <ServiceCard
            icon="⌂"
            title="Mosques"
            description="Find mosques, prayer spaces, timetables and iqamah information."
            href="/near-me/pray"
            linkLabel="Find a mosque"
          />

          <ServiceCard
            icon="▣"
            title="Halal businesses"
            description="Discover restaurants, groceries, shops and Muslim-friendly services."
            href="/businesses"
            linkLabel="Browse businesses"
          />

          <ServiceCard
            icon="◈"
            title="Hajj & Umrah"
            description="Follow guided steps, practical checklists, duas and reminders."
            href="/hajj"
            linkLabel="Open the guides"
          />

          <ServiceCard
            icon="✈"
            title="Travel mode"
            description="Locate mosques and halal essentials while visiting a new city."
            href="/travel"
            linkLabel="Explore travel"
          />

          <ServiceCard
            icon="✓"
            title="Mosque management"
            description="Claim a mosque page and maintain accurate public information."
            href="/claim/mosque"
            linkLabel="Claim a mosque"
          />

          <ServiceCard
            icon="✦"
            title="Business visibility"
            description="Add, claim or promote a halal business on SalahNearMe."
            href="/add-business"
            linkLabel="Add a business"
          />
        </div>
      </section>

      <HomeHajjHijriBanner />

      <section
        aria-labelledby="pray-intelligence-heading"
        className="premium-panel rounded-[2rem] p-5 sm:p-7 lg:p-8"
      >
        <div className="grid gap-7 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <div className="section-kicker">
              Pray Near Me intelligence
            </div>

            <h2
              id="pray-intelligence-heading"
              className="mt-4 max-w-3xl text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl"
            >
              Find the best mosque for your next prayer.
            </h2>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/60 sm:text-base">
              SalahNearMe evaluates location, travel time,
              timetable quality, facilities and live
              community signals to help you make a better
              prayer decision.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/near-me/pray"
                className="premium-button px-5 py-3 text-sm"
              >
                Open Pray Near Me
              </Link>

              <Link
                href="/how-it-works"
                className="premium-button-outline px-5 py-3 text-sm"
              >
                See how it works
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <TrustFeature
              icon="⌖"
              title="Location aware"
              description="Nearby mosque discovery and estimated travel."
            />

            <TrustFeature
              icon="◷"
              title="Prayer aware"
              description="Current salah context and upcoming prayer."
            />

            <TrustFeature
              icon="✓"
              title="Trust signals"
              description="Timetable coverage and data confidence."
            />

            <TrustFeature
              icon="●"
              title="Community live"
              description="Recent iqamah and capacity reports."
            />
          </div>
        </div>
      </section>

      <section className="home-trust-strip">
        <TrustFeature
          icon="✓"
          title="Trusted data"
          description="Clear verification and timetable confidence."
        />

        <TrustFeature
          icon="⌾"
          title="Community focused"
          description="Designed to strengthen Muslim communities."
        />

        <TrustFeature
          icon="◇"
          title="Privacy conscious"
          description="Location is requested only when needed."
        />

        <TrustFeature
          icon="?"
          title="Here to help"
          description="Simple tools for worshippers and organisations."
        />
      </section>

      <section className="rounded-[2rem] border border-yellow-500/20 bg-black/25 px-5 py-7 text-center sm:px-8">
        <div className="text-xs font-black uppercase tracking-[0.26em] text-yellow-400">
          Connecting Muslims. Supporting halal. Strengthening communities.
        </div>

        <p className="mx-auto mt-3 max-w-3xl text-sm leading-7 text-white/55">
          SalahNearMe brings prayer-aware discovery,
          trustworthy mosque data, halal business
          visibility and Muslim travel tools together in
          one community-focused platform.
        </p>
      </section>
    </div>
  );
}