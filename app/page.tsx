import type { Metadata } from "next";
import type { ReactNode } from "react";

import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { Anton } from "next/font/google";

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

const anton = Anton({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-anton",
});

const rawSiteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "https://www.salahnearme.com";

const siteUrl =
  rawSiteUrl.replace(/\/+$/, "");

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

type PlatformCardProps = {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  href?: string;
  linkLabel?: string;
  status?: string;
};

type CompactFeatureProps = {
  icon: ReactNode;
  title: string;
  description: string;
};

function cleanString(
  value: unknown
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function isValidCityRow(
  value: unknown
): value is CityRow {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return false;
  }

  const city =
    value as Partial<CityRow>;

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
  const cleanedSlug =
    cleanString(
      selectedSlug
    ).toLowerCase();

  if (!cleanedSlug) {
    return null;
  }

  return (
    cities.find(
      (city) =>
        city.slug.toLowerCase() ===
        cleanedSlug
    ) ?? null
  );
}

function formatCount(
  count: number | null,
  fallback = "Growing"
): string {
  if (
    typeof count !== "number" ||
    !Number.isFinite(count) ||
    count < 0
  ) {
    return fallback;
  }

  return new Intl.NumberFormat(
    "en-GB"
  ).format(count);
}

function getPrayerSourceLabel(
  source: PrayerTimesSource
): string {
  if (
    source === "manual_override"
  ) {
    return "Verified timetable";
  }

  if (source === "calculated") {
    return "Calculated locally";
  }

  return "Choose your city";
}

function getHeroContextDescription(
  selectedCity: CityRow | null,
  prayerTimesSource: PrayerTimesSource
): string {
  if (!selectedCity) {
    return "Choose your country and city to personalise prayer times, nearby mosques and daily recommendations.";
  }

  if (
    prayerTimesSource ===
    "manual_override"
  ) {
    return `Personalised for ${selectedCity.name} using locally maintained timetable data.`;
  }

  if (
    prayerTimesSource ===
    "calculated"
  ) {
    return `Personalised for ${selectedCity.name} using location-based prayer calculations.`;
  }

  return `Personalised for ${selectedCity.name}. Prayer information will appear when available.`;
}

async function getPrayerTimesForCity(
  city: CityRow | null
): Promise<PrayerTimesLoadResult> {
  if (!city) {
    return {
      prayerTimes: null,
      prayerTimesSource:
        "unavailable",
      prayerTimesUpdatedAt: null,
    };
  }

  const supabase =
    await supabaseServer();

  const now = new Date();

  const { data, error } =
    await supabase
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
      .eq(
        "month",
        now.getMonth() + 1
      )
      .eq(
        "year",
        now.getFullYear()
      )
      .maybeSingle();

  if (error) {
    console.warn(
      "Homepage city prayer-time query unavailable:",
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
      data as unknown as PrayerTimesOverrideRow;

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
      prayerTimesSource:
        "manual_override",
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

function Icon({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <span
      aria-hidden="true"
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-yellow-400/20 bg-yellow-400/[0.08] text-yellow-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
    >
      {children}
    </span>
  );
}

function PlatformCard({
  icon,
  eyebrow,
  title,
  description,
  href,
  linkLabel,
  status,
}: PlatformCardProps) {
  const card = (
    <article className="group premium-inset relative h-full overflow-hidden rounded-3xl p-5 transition duration-300 hover:-translate-y-1 hover:border-yellow-400/30">
      <div
        aria-hidden="true"
        className="absolute -right-16 -top-16 h-40 w-40 rounded-full border border-yellow-400/10 bg-yellow-400/[0.02] transition duration-500 group-hover:scale-110"
      />

      <div className="relative flex items-start justify-between gap-4">
        <Icon>{icon}</Icon>

        {status ? (
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[0.62rem] font-black uppercase tracking-[0.16em] text-white/50">
            {status}
          </span>
        ) : (
          <span
            aria-hidden="true"
            className="text-lg text-yellow-400/45 transition duration-300 group-hover:translate-x-1 group-hover:text-yellow-200"
          >
            →
          </span>
        )}
      </div>

      <div className="relative mt-5 text-[0.65rem] font-black uppercase tracking-[0.2em] text-yellow-400/75">
        {eyebrow}
      </div>

      <h3 className="relative mt-2 text-xl font-black text-white">
        {title}
      </h3>

      <p className="relative mt-3 text-sm leading-7 text-white/55">
        {description}
      </p>

      {href && linkLabel ? (
        <span className="relative mt-5 inline-flex text-sm font-bold text-yellow-300 transition group-hover:text-yellow-100">
          {linkLabel}
        </span>
      ) : null}
    </article>
  );

  if (!href) {
    return card;
  }

  return (
    <Link
      href={href}
      className="block h-full"
    >
      {card}
    </Link>
  );
}

function CompactFeature({
  icon,
  title,
  description,
}: CompactFeatureProps) {
  return (
    <div className="group flex gap-4 rounded-2xl border border-white/10 bg-black/25 p-4 transition duration-300 hover:-translate-y-0.5 hover:border-yellow-400/25 hover:bg-yellow-400/[0.04]">
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

        <p className="mt-1 text-sm leading-6 text-white/50">
          {description}
        </p>
      </div>
    </div>
  );
}

function HeroMetric({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3.5 backdrop-blur-xl">
      <div className="text-[0.62rem] font-black uppercase tracking-[0.17em] text-yellow-300/75">
        {label}
      </div>

      <div className="mt-1.5 text-lg font-black text-white">
        {value}
      </div>

      <div className="mt-1 text-[0.68rem] leading-5 text-white/42">
        {description}
      </div>
    </div>
  );
}

function MosqueIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 21v-7h16v7" />
      <path d="M7 14V9h10v5" />
      <path d="M9 9c0-2 1.3-3.6 3-4.5C13.7 5.4 15 7 15 9" />
      <path d="M12 2v2.5" />
      <path d="M2 21h20" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
      />

      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function StoreIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 10v10h16V10" />
      <path d="M3 10l2-6h14l2 6" />
      <path d="M8 20v-6h8v6" />
      <path d="M3 10c1.2 1.4 2.5 1.4 4 0 1.2 1.4 2.5 1.4 4 0 1.2 1.4 2.5 1.4 4 0 1.2 1.4 2.5 1.4 4 0" />
    </svg>
  );
}

function TravelIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12h18" />
      <path d="m14 5 7 7-7 7" />
      <path d="M10 5 3 12l7 7" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
      />

      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </svg>
  );
}

export default async function Home() {
  const supabase =
    await supabaseServer();

  const cookieStore =
    await cookies();

  const selectedCitySlug =
    cookieStore.get("snm_city")
      ?.value ?? null;

  const [
    citiesResult,
    mosqueCountResult,
    businessCountResult,
  ] = await Promise.all([
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
      .eq(
        "can_advertise",
        true
      ),
  ]);

  if (citiesResult.error) {
    console.error(
      "Homepage city query failed:",
      {
        code:
          citiesResult.error.code,
        message:
          citiesResult.error
            .message,
      }
    );

    return (
      <div
        role="alert"
        className="rounded-3xl border border-red-500/30 bg-red-500/10 p-8 text-red-100"
      >
        <div className="text-xs font-black uppercase tracking-[0.22em] text-red-300">
          Service interruption
        </div>

        <h1 className="mt-3 text-2xl font-black">
          SalahNearMe is temporarily
          unavailable
        </h1>

        <p className="mt-3 max-w-xl text-sm leading-7 text-red-100/75">
          The city directory could not
          be loaded. Please refresh this
          page shortly.
        </p>

        <Link
          href="/"
          className="mt-5 inline-flex rounded-xl border border-red-300/25 bg-red-300/10 px-4 py-2.5 text-sm font-bold text-red-100 transition hover:bg-red-300/15"
        >
          Refresh homepage
        </Link>
      </div>
    );
  }

  if (mosqueCountResult.error) {
    console.warn(
      "Homepage mosque count unavailable:",
      mosqueCountResult.error
        .message
    );
  }

  if (
    businessCountResult.error
  ) {
    console.warn(
      "Homepage business count unavailable:",
      businessCountResult.error
        .message
    );
  }

  const cities = (
    (citiesResult.data ??
      []) as unknown[]
  ).filter(isValidCityRow);

  const selectedCity =
    getSelectedCity(
      cities,
      selectedCitySlug
    );

  const {
    prayerTimes,
    prayerTimesSource,
    prayerTimesUpdatedAt,
  } =
    await getPrayerTimesForCity(
      selectedCity
    );

  const citySearchOptions =
    cities.map(
      ({
        slug,
        name,
        country,
      }) => ({
        slug,
        name,
        country:
          country ?? null,
      })
    );

  const cityCoverageLabel =
    formatCount(cities.length);

  const mosqueCountLabel =
    formatCount(
      mosqueCountResult.count
    );

  const businessCountLabel =
    formatCount(
      businessCountResult.count
    );

  const prayerSourceLabel =
    getPrayerSourceLabel(
      prayerTimesSource
    );

  const heroContextDescription =
    getHeroContextDescription(
      selectedCity,
      prayerTimesSource
    );

  const prayerTimesHref =
    selectedCity
      ? `/${selectedCity.slug}/prayer-times`
      : undefined;

  const websiteJsonLd = {
    "@context":
      "https://schema.org",
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
    "@context":
      "https://schema.org",
    "@type": "Organization",
    name: "SalahNearMe",
    url: siteUrl,
    logo:
      `${siteUrl}/logo-horizontal.png`,
    description:
      "A Muslim discovery platform for prayer, mosques, halal businesses and travel.",
  };

  return (
    <div
      className={`${anton.variable} compact-page-stack`}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html:
            JSON.stringify([
              websiteJsonLd,
              organisationJsonLd,
            ]),
        }}
      />

      <section className="relative isolate overflow-hidden rounded-[2rem] border border-yellow-400/15 bg-[#020816] shadow-[0_32px_100px_rgba(0,0,0,0.48)]">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-30 bg-[radial-gradient(circle_at_75%_36%,rgba(212,175,55,0.10),transparent_27rem),linear-gradient(135deg,#020816_0%,#030b21_52%,#010511_100%)]"
        />

        <div
          aria-hidden="true"
          className="absolute inset-y-0 right-0 -z-20 hidden w-[54%] overflow-hidden lg:block"
        >
          <div className="absolute -top-[3%] right-[1%] h-[94%] w-[92%]">
            <Image
              src="/images/homepage-mosque-night.webp"
              alt=""
              fill
              priority
              quality={75}
              sizes="(max-width: 1024px) 0px, 54vw"
              className="object-contain object-top"
            />
          </div>

          <div className="absolute inset-0 bg-[linear-gradient(90deg,#020816_0%,rgba(2,8,22,0.86)_14%,rgba(2,8,22,0.30)_50%,rgba(2,8,22,0.02)_100%)]" />

          <div className="absolute inset-0 bg-gradient-to-t from-[#020816]/75 via-transparent to-black/5" />
        </div>

        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_86%_40%,transparent_0%,transparent_20%,rgba(212,175,55,0.05)_20.2%,transparent_20.5%,transparent_29%,rgba(212,175,55,0.045)_29.2%,transparent_29.5%)]"
        />

        <div className="relative px-5 py-9 sm:px-8 sm:py-11 lg:px-12 lg:py-14 xl:px-16">
          <div className="grid gap-8 lg:grid-cols-[0.94fr_1.06fr] lg:items-center">
            <div className="max-w-[52rem]">
              <div className="inline-flex items-center gap-3 rounded-full border border-yellow-400/25 bg-black/35 px-4 py-2.5 backdrop-blur-xl">
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 rounded-full bg-yellow-300 shadow-[0_0_14px_rgba(253,224,71,0.9)]"
                />

                <span className="text-[0.66rem] font-black uppercase tracking-[0.25em] text-yellow-300 sm:text-xs">
                  One Ummah. One Platform.
                </span>
              </div>

              <h1
                className={`${anton.className} mt-6 uppercase leading-none tracking-[-0.025em] text-white drop-shadow-[0_12px_30px_rgba(0,0,0,0.65)]`}
              >
                <span className="text-[2.8rem] sm:text-[3.7rem] lg:text-[4.1rem] xl:text-[4.7rem]">
                  Find.
                </span>{" "}

                <span className="gold-gradient-text text-[2.8rem] sm:text-[3.7rem] lg:text-[4.1rem] xl:text-[4.7rem]">
                  Pray.
                </span>{" "}

                <span className="text-[2.8rem] sm:text-[3.7rem] lg:text-[4.1rem] xl:text-[4.7rem]">
                  Connect.
                </span>
              </h1>

              <p className="mt-5 max-w-2xl text-base font-medium leading-8 text-white/68 sm:text-lg">
                Prayer, trusted mosque
                information, halal businesses
                and Muslim travel tools brought
                together with clarity and
                simplicity.
              </p>

              <div className="mt-5 flex max-w-2xl items-start gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 backdrop-blur-xl">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-yellow-400/20 bg-yellow-400/10 text-xs text-yellow-300"
                >
                  ◉
                </span>

                <div>
                  <div className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-yellow-300">
                    {selectedCity
                      ? selectedCity.name
                      : "Personalise SalahNearMe"}
                  </div>

                  <p className="mt-1 text-xs leading-5 text-white/48 sm:text-sm">
                    {
                      heroContextDescription
                    }
                  </p>
                </div>
              </div>
            </div>

            <div className="hidden min-h-[340px] lg:block" />
          </div>

          <div className="mt-7 w-full rounded-[1.5rem] border border-white/12 bg-[#020817]/92 p-3 shadow-[0_22px_55px_rgba(0,0,0,0.38)] backdrop-blur-2xl sm:p-4">
            <CitySearch
              cities={
                citySearchOptions
              }
            />
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/near-me/pray"
              className="premium-button px-6 py-3 text-sm"
            >
              Pray Near Me
            </Link>

            <Link
              href="/businesses"
              className="premium-button-outline px-6 py-3 text-sm"
            >
              Halal Businesses
            </Link>

            <Link
              href="/travel"
              className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.04] px-6 py-3 text-sm font-bold text-white/75 backdrop-blur-xl transition hover:border-yellow-400/30 hover:bg-yellow-400/[0.06] hover:text-yellow-100"
            >
              Travel
            </Link>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <HeroMetric
              label="Mosques"
              value={
                mosqueCountLabel
              }
              description="Active prayer spaces"
            />

            <HeroMetric
              label="Halal businesses"
              value={
                businessCountLabel
              }
              description="Community listings"
            />

            <HeroMetric
              label="Cities"
              value={
                cityCoverageLabel
              }
              description="Active locations"
            />

            <HeroMetric
              label="Prayer data"
              value={
                prayerSourceLabel
              }
              description={
                selectedCity
                  ? selectedCity.name
                  : "Select your location"
              }
            />
          </div>
        </div>

        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-yellow-300/40 to-transparent"
        />
      </section>

      <SmartDailyModePanel className="mt-0" />

      {selectedCity ? (
        <>
          <NextSalahCountdown
            prayerTimes={
              prayerTimes
            }
            cityName={
              selectedCity.name
            }
          />

          <SelectedCityHomePanel
            city={{
              name:
                selectedCity.name,
              slug:
                selectedCity.slug,
              timezone:
                selectedCity.timezone ??
                "Europe/London",
            }}
            prayerTimes={
              prayerTimes
            }
            prayerTimesSource={
              prayerTimesSource
            }
            prayerTimesUpdatedAt={
              prayerTimesUpdatedAt
            }
          />

          <HomeDailyPanel
            cityId={
              selectedCity.id
            }
            cityName={
              selectedCity.name
            }
            citySlug={
              selectedCity.slug
            }
            prayerTimes={
              prayerTimes
            }
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
        className="premium-panel relative overflow-hidden rounded-[2rem] p-5 sm:p-7 lg:p-8"
      >
        <div
          aria-hidden="true"
          className="absolute -right-24 -top-24 h-72 w-72 rounded-full border border-yellow-400/10 bg-yellow-400/[0.025]"
        />

        <div className="relative grid gap-7 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <div className="section-kicker">
              Pray Near Me
            </div>

            <h2
              id="pray-near-me-heading"
              className="mt-4 max-w-3xl text-3xl font-black tracking-tight text-white sm:text-4xl"
            >
              Make a better decision
              before your next prayer.
            </h2>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/60 sm:text-base">
              Nearby mosque discovery
              combined with prayer
              context, timetable
              confidence, facilities and
              recent community
              information.
            </p>

            <Link
              href="/near-me/pray"
              className="premium-button mt-6 px-5 py-3 text-sm"
            >
              Open Pray Near Me
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <CompactFeature
              icon={<MosqueIcon />}
              title="Nearby"
              description="Distance and estimated travel time."
            />

            <CompactFeature
              icon={<ClockIcon />}
              title="Prayer aware"
              description="Current and upcoming salah context."
            />

            <CompactFeature
              icon="✓"
              title="Trusted data"
              description="Timetable quality and confidence."
            />

            <CompactFeature
              icon="●"
              title="Live signals"
              description="Recent community activity reports."
            />
          </div>
        </div>
      </section>

      <section
        aria-labelledby="platform-heading"
        className="premium-panel rounded-[2rem] p-5 sm:p-7"
      >
        <div className="max-w-3xl">
          <div className="section-kicker">
            Explore SalahNearMe
          </div>

          <h2
            id="platform-heading"
            className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl"
          >
            Everything essential,
            organised clearly.
          </h2>

          <p className="mt-3 text-sm leading-7 text-white/55">
            Six clear routes into the
            platform, without repeating
            the same destination across
            the page.
          </p>
        </div>

        <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <PlatformCard
            icon={<MosqueIcon />}
            eyebrow="Prayer"
            title="Mosques"
            description="Find nearby mosques, prayer rooms, Islamic centres and live community signals."
            href="/near-me/pray"
            linkLabel="Find a mosque →"
          />

          <PlatformCard
            icon={<ClockIcon />}
            eyebrow="Timetables"
            title="Prayer Times"
            description={
              selectedCity
                ? `View prayer times and local timetable information for ${selectedCity.name}.`
                : "Choose your city above to unlock local prayer times and timetable information."
            }
            href={
              prayerTimesHref
            }
            linkLabel={
              prayerTimesHref
                ? "View prayer times →"
                : undefined
            }
            status={
              prayerTimesHref
                ? undefined
                : "Choose city"
            }
          />

          <PlatformCard
            icon={<StoreIcon />}
            eyebrow="Discovery"
            title="Halal Businesses"
            description="Explore halal restaurants, groceries, shops, services and verified listings."
            href="/businesses"
            linkLabel="Browse businesses →"
          />

          <PlatformCard
            icon={<TravelIcon />}
            eyebrow="Journey"
            title="Muslim Travel"
            description="Keep mosque and halal discovery available while visiting a new city."
            href="/travel"
            linkLabel="Explore travel →"
          />

          <PlatformCard
            icon={<PlusIcon />}
            eyebrow="Community"
            title="Add a Business"
            description="Help strengthen the directory by submitting a halal or Muslim-friendly business."
            href="/add-business"
            linkLabel="Add a listing →"
          />

          <PlatformCard
            icon={<InfoIcon />}
            eyebrow="Platform"
            title="How It Works"
            description="Understand city selection, prayer intelligence, verification and community signals."
            href="/how-it-works"
            linkLabel="Learn more →"
          />
        </div>
      </section>

      <HomeHajjHijriBanner />

      <section className="relative overflow-hidden rounded-[2rem] border border-yellow-500/20 bg-black/25 px-5 py-7 text-center backdrop-blur-xl sm:px-8">
        <div
          aria-hidden="true"
          className="absolute left-1/2 top-1/2 h-52 w-52 -translate-x-1/2 -translate-y-1/2 rounded-full border border-yellow-400/10 bg-yellow-400/[0.025]"
        />

        <div className="relative">
          <div className="text-xs font-black uppercase tracking-[0.26em] text-yellow-400">
            One Ummah. One Platform.
          </div>

          <p className="mx-auto mt-3 max-w-3xl text-sm leading-7 text-white/55">
            Prayer-aware discovery,
            mosque information, halal
            business visibility, travel
            tools and pilgrimage guidance
            in one trusted platform.
          </p>
        </div>
      </section>
    </div>
  );
}