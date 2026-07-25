import type { Metadata } from "next";

import Image from "next/image";
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
  title:
    "SalahNearMe | Mosques, Prayer Times & Halal Places Near You",
  description:
    "Find nearby mosques, prayer times, iqamah information, halal businesses, Muslim travel essentials, Hajj guidance and Umrah guidance with SalahNearMe.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title:
      "SalahNearMe | Mosques, Prayer Times & Halal Places",
    description:
      "Your intelligent Muslim companion for prayer, mosques, halal discovery, travel, Hajj and Umrah.",
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
    title:
      "SalahNearMe | Mosques, Prayer Times & Halal Places",
    description:
      "Find mosques, pray on time and discover halal places wherever you are.",
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

type PrayerTimesOverrideRow =
  Partial<PrayerTimesResult> & {
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

type StatProps = {
  value: string;
  label: string;
};

function cleanString(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function isValidCityRow(value: unknown): value is CityRow {
  if (
    !value ||
    typeof value !== "object"
  ) {
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
      (city) =>
        city.slug.toLowerCase() === cleanedSlug
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
    console.error(
      "Homepage city prayer-time query failed:",
      {
        cityId: city.id,
        citySlug: city.slug,
        code: error.code,
        message: error.message,
      }
    );
  }

  if (data) {
    const row =
      data as PrayerTimesOverrideRow;

    return {
      prayerTimes: {
        fajr_start:
          row.fajr_start ?? null,
        sunrise:
          row.sunrise ?? null,
        dhuhr_start:
          row.dhuhr_start ?? null,
        asr_start:
          row.asr_start ?? null,
        maghrib_start:
          row.maghrib_start ?? null,
        isha_start:
          row.isha_start ?? null,
      },
      prayerTimesSource: "manual_override",
      prayerTimesUpdatedAt:
        row.created_at ?? null,
    };
  }

  const calculated =
    calculatePrayerTimesForCity({
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

function HomepageStat({
  value,
  label,
}: StatProps) {
  return (
    <div className="hero-stat rounded-2xl px-4 py-3">
      <div className="text-xl font-black text-white sm:text-2xl">
        {value}
      </div>

      <div className="mt-1 text-xs font-semibold text-white/48">
        {label}
      </div>
    </div>
  );
}

function JourneyCard({
  number,
  title,
  description,
  href,
  linkLabel,
}: {
  number: string;
  title: string;
  description: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <article className="group premium-inset rounded-3xl p-5 transition duration-300 hover:-translate-y-1 hover:border-yellow-400/30">
      <div className="flex items-start justify-between gap-4">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-yellow-500/25 bg-yellow-500/10 text-sm font-black text-yellow-300">
          {number}
        </span>

        <span
          aria-hidden="true"
          className="text-xl text-yellow-400/45 transition group-hover:translate-x-1 group-hover:text-yellow-200"
        >
          →
        </span>
      </div>

      <h3 className="mt-5 text-xl font-black text-white">
        {title}
      </h3>

      <p className="mt-3 text-sm leading-7 text-white/55">
        {description}
      </p>

      <Link
        href={href}
        className="mt-5 inline-flex text-sm font-bold text-yellow-300 hover:text-yellow-100"
      >
        {linkLabel}
      </Link>
    </article>
  );
}

function CompactFeature({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-4 rounded-2xl border border-white/10 bg-black/25 p-4">
      <span
        aria-hidden="true"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-yellow-500/25 bg-yellow-500/10 text-yellow-300"
      >
        {icon}
      </span>

      <div>
        <div className="font-black text-white">
          {title}
        </div>

        <p className="mt-1 text-sm leading-6 text-white/48">
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

  const { data, error } = await supabase
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
    });

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

  const cities = ((data ?? []) as unknown[])
    .filter(isValidCityRow);

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
      target:
        `${siteUrl}/businesses?q={search_term_string}`,
      "query-input":
        "required name=search_term_string",
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

      <section className="home-hero rounded-[2rem] px-5 py-8 sm:px-8 sm:py-10 lg:px-12 lg:py-14 xl:px-16">
        <div
          aria-hidden="true"
          className="hero-orbit"
        />

        <div className="relative z-10 grid min-h-[520px] items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <div className="hero-kicker">
              Find. Pray. Connect.
            </div>

            <h1 className="hero-title mt-5 white-soft-glow">
              Your Muslim life,
              <span className="gold-gradient-text">
                {" "}
                intelligently connected.
              </span>
            </h1>

            <p className="hero-description mt-6">
              Find nearby mosques, accurate prayer times,
              halal places and Muslim travel essentials in
              one beautifully simple platform.
            </p>

            <div className="mt-7 max-w-3xl">
              <CitySearch cities={citySearchOptions} />
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/near-me/pray"
                className="premium-button px-5 py-3 text-sm sm:px-6"
              >
                Find a mosque to pray now
              </Link>

              <Link
                href="/businesses"
                className="premium-button-outline px-5 py-3 text-sm"
              >
                Discover halal places
              </Link>
            </div>

            <div className="mt-7 grid max-w-2xl grid-cols-3 gap-2 sm:gap-3">
              <HomepageStat
                value="Prayer"
                label="Times and mosques"
              />

              <HomepageStat
                value="Halal"
                label="Food and services"
              />

              <HomepageStat
                value="Travel"
                label="Muslim essentials"
              />
            </div>
          </div>

          <div className="relative hidden min-h-[500px] lg:block">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="premium-float relative flex h-[390px] w-[390px] items-center justify-center rounded-full border border-yellow-400/14 bg-yellow-400/[0.025] shadow-[0_0_120px_rgba(212,175,55,0.08)]">
                <div className="absolute inset-[13%] rounded-full border border-yellow-400/12" />
                <div className="absolute inset-[27%] rounded-full border border-yellow-400/18" />

                <Image
                  src="/logo-horizontal.png"
                  alt="SalahNearMe"
                  width={520}
                  height={220}
                  priority
                  className="relative z-10 h-auto w-[300px] object-contain drop-shadow-[0_18px_50px_rgba(0,0,0,0.65)]"
                />
              </div>
            </div>

            <div className="absolute left-0 top-[12%] w-[210px] rounded-3xl border border-yellow-500/20 bg-[#040b1d]/88 p-4 shadow-2xl shadow-black/40 backdrop-blur-xl">
              <div className="text-[0.65rem] font-black uppercase tracking-[0.22em] text-yellow-400">
                Prayer aware
              </div>

              <div className="mt-2 text-lg font-black text-white">
                Best mosque now
              </div>

              <p className="mt-1 text-xs leading-5 text-white/48">
                Distance, timetable and live community
                signals combined.
              </p>
            </div>

            <div className="absolute bottom-[11%] right-0 w-[220px] rounded-3xl border border-emerald-500/20 bg-[#03131a]/88 p-4 shadow-2xl shadow-black/40 backdrop-blur-xl">
              <div className="text-[0.65rem] font-black uppercase tracking-[0.22em] text-emerald-300">
                Halal discovery
              </div>

              <div className="mt-2 text-lg font-black text-white">
                Trusted places nearby
              </div>

              <p className="mt-1 text-xs leading-5 text-white/48">
                Restaurants, shops and Muslim-friendly
                services.
              </p>
            </div>
          </div>
        </div>
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
        aria-labelledby="pray-near-me-heading"
        className="premium-panel rounded-[2rem] p-5 sm:p-7 lg:p-8"
      >
        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <div className="section-kicker">
              Pray Near Me intelligence
            </div>

            <h2
              id="pray-near-me-heading"
              className="mt-4 max-w-3xl text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl"
            >
              Find the best mosque for your next prayer.
            </h2>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/60 sm:text-base">
              SalahNearMe compares distance, travel time,
              timetable quality, facilities and live
              community signals before recommending where
              to pray.
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
            <CompactFeature
              icon="⌖"
              title="Nearby"
              description="Distance and estimated travel time."
            />

            <CompactFeature
              icon="◷"
              title="Prayer context"
              description="Current and upcoming salah checked."
            />

            <CompactFeature
              icon="✓"
              title="Trusted data"
              description="Timetable quality and confidence."
            />

            <CompactFeature
              icon="●"
              title="Live signals"
              description="Community activity and capacity reports."
            />
          </div>
        </div>
      </section>

      <HomeHajjHijriBanner />

      <section
        aria-labelledby="journeys-heading"
        className="premium-panel rounded-[2rem] p-5 sm:p-7"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="section-kicker">
              Explore SalahNearMe
            </div>

            <h2
              id="journeys-heading"
              className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl"
            >
              One platform. Every Muslim journey.
            </h2>
          </div>

          <Link
            href="/how-it-works"
            className="text-sm font-bold text-yellow-300 hover:text-yellow-100"
          >
            Discover the platform →
          </Link>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <JourneyCard
            number="01"
            title="Mosques & prayer"
            description="Mosque profiles, timetables, iqamah signals and prayer-aware discovery."
            href="/near-me/pray"
            linkLabel="Find a mosque →"
          />

          <JourneyCard
            number="02"
            title="Halal businesses"
            description="Find halal restaurants, groceries, shops, services and featured listings."
            href="/businesses"
            linkLabel="Browse businesses →"
          />

          <JourneyCard
            number="03"
            title="Muslim travel"
            description="Discover mosques and halal essentials in supported cities worldwide."
            href="/travel"
            linkLabel="Open travel mode →"
          />

          <JourneyCard
            number="04"
            title="Hajj & Umrah"
            description="Follow practical step-by-step guidance, reminders, duas and checklists."
            href="/hajj"
            linkLabel="Open the guides →"
          />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="premium-panel rounded-[2rem] p-6 sm:p-8">
          <div className="section-kicker">
            Hajj & Umrah
          </div>

          <h2 className="mt-4 text-3xl font-black tracking-tight text-white">
            Prepare with confidence.
          </h2>

          <p className="mt-3 max-w-xl text-sm leading-7 text-white/58">
            Step-by-step rituals, practical checklists,
            duas, reminders and guided modes for your
            journey.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/hajj"
              className="premium-button px-5 py-3 text-sm"
            >
              Hajj guide
            </Link>

            <Link
              href="/umrah"
              className="premium-button-outline px-5 py-3 text-sm"
            >
              Umrah guide
            </Link>
          </div>
        </article>

        <article className="premium-panel rounded-[2rem] p-6 sm:p-8">
          <div className="section-kicker">
            Travel mode
          </div>

          <h2 className="mt-4 text-3xl font-black tracking-tight text-white">
            Take SalahNearMe with you.
          </h2>

          <p className="mt-3 max-w-xl text-sm leading-7 text-white/58">
            Find mosques, halal food and Muslim-friendly
            essentials when travelling or exploring a new
            city.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/travel"
              className="premium-button px-5 py-3 text-sm"
            >
              Explore travel
            </Link>

            <Link
              href="/travel/map"
              className="premium-button-outline px-5 py-3 text-sm"
            >
              Open map
            </Link>
          </div>
        </article>
      </section>

      <section className="rounded-[2rem] border border-yellow-500/20 bg-black/25 px-5 py-6 text-center sm:px-8">
        <div className="text-xs font-black uppercase tracking-[0.26em] text-yellow-400">
          Built for the Ummah
        </div>

        <p className="mx-auto mt-3 max-w-3xl text-sm leading-7 text-white/55">
          Prayer-aware discovery, trustworthy mosque data,
          halal business visibility and Muslim travel tools
          in one community-focused platform.
        </p>
      </section>
    </div>
  );
}