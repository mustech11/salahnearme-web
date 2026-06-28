import type { Metadata } from "next";

import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";

import CitySearch from "@/components/CitySearch";
import HomeDailyPanel from "@/components/HomeDailyPanel";
import HomeHajjHijriBanner from "@/components/HomeHajjHijriBanner";
import NextSalahCountdown from "@/components/NextSalahCountdown";
import SelectedCityHomePanel from "@/components/SelectedCityHomePanel";
import {
  calculatePrayerTimesForCity,
  type PrayerTimesResult,
} from "@/lib/prayerTimes";
import { supabaseServer } from "@/lib/supabaseServer";

export const revalidate = 300;

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "https://www.salahnearme.com";

const cleanSiteUrl = siteUrl.replace(/\/+$/, "");

export const metadata: Metadata = {
  title: "SalahNearMe | Find Mosques, Prayer Times & Halal Places Near You",
  description:
    "Find mosques near you, prayer times, iqamah times, halal businesses, Hajj guides, Umrah guides, Muslim travel essentials, and pray-near-me recommendations with SalahNearMe.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "SalahNearMe | Find Mosques, Prayer Times & Halal Places Near You",
    description:
      "Find mosques, prayer times, halal businesses, Muslim travel, Hajj and Umrah guidance, and live community signals in one intelligent Muslim platform.",
    url: cleanSiteUrl,
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
    title: "SalahNearMe | Mosques, Prayer Times & Halal Businesses",
    description:
      "Find mosques, prayer times, halal businesses, Hajj, Umrah and Muslim travel essentials.",
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

type PrayerTimesRow = PrayerTimesResult;

type PrayerTimesOverrideRow = PrayerTimesRow & {
  created_at?: string | null;
};

type HadithRow = {
  id: string;
  collection?: string | null;
  provider?: string | null;
  external_id?: string | null;
  arabic_text?: string | null;
  english_text?: string | null;
  text?: string | null;
  translation_text?: string | null;
  source?: string | null;
};

type StatCardProps = {
  label: string;
  value: string;
  helper: string;
};

function getHadithText(hadith: HadithRow | null) {
  if (!hadith) {
    return null;
  }

  return (
    hadith.english_text ||
    hadith.translation_text ||
    hadith.text ||
    hadith.arabic_text ||
    null
  );
}

function getHadithSource(hadith: HadithRow | null) {
  if (!hadith) {
    return null;
  }

  if (hadith.source) {
    return hadith.source;
  }

  const collection = hadith.collection?.replace(/_/g, " ");

  if (collection && hadith.external_id) {
    return `${collection} · ${hadith.external_id}`;
  }

  if (collection) {
    return collection;
  }

  if (hadith.provider) {
    return hadith.provider;
  }

  return "Hadith";
}

function StatCard({ label, value, helper }: StatCardProps) {
  return (
    <div className="rounded-3xl border border-yellow-500/20 bg-[#050B1A]/80 p-6">
      <div className="text-xs font-bold uppercase tracking-[0.35em] text-yellow-400">
        {label}
      </div>

      <div className="mt-4 text-4xl font-black text-white">{value}</div>

      <p className="mt-2 text-sm text-white/60">{helper}</p>
    </div>
  );
}

function FeatureCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-3xl border border-yellow-500/20 bg-[#050B1A]/80 p-6">
      <h3 className="text-xl font-black text-yellow-400">{title}</h3>

      <p className="mt-3 text-sm leading-7 text-white/70">{description}</p>
    </div>
  );
}

async function getSelectedCity(
  cities: CityRow[],
  selectedCitySlug: string | null
) {
  if (!selectedCitySlug) {
    return null;
  }

  return cities.find((city) => city.slug === selectedCitySlug) ?? null;
}

async function getPrayerTimesForSelectedCity(selectedCity: CityRow | null) {
  if (!selectedCity) {
    return {
      prayerTimes: null,
      prayerTimesSource: "unavailable" as const,
      prayerTimesUpdatedAt: null,
    };
  }

  const supabase = await supabaseServer();
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const { data: prayerTimesRow, error } = await supabase
    .from("city_prayer_times")
    .select(
      "fajr_start,sunrise,dhuhr_start,asr_start,maghrib_start,isha_start,created_at"
    )
    .eq("city_id", selectedCity.id)
    .eq("month", month)
    .eq("year", year)
    .maybeSingle();

  if (error) {
    console.error("homepage prayer times error:", error.message);
  }

  if (prayerTimesRow) {
    const override = prayerTimesRow as PrayerTimesOverrideRow;

    return {
      prayerTimes: {
        fajr_start: override.fajr_start,
        sunrise: override.sunrise,
        dhuhr_start: override.dhuhr_start,
        asr_start: override.asr_start,
        maghrib_start: override.maghrib_start,
        isha_start: override.isha_start,
      },
      prayerTimesSource: "manual_override" as const,
      prayerTimesUpdatedAt: override.created_at ?? null,
    };
  }

  const calculated = calculatePrayerTimesForCity({
    timezone: selectedCity.timezone,
    latitude: selectedCity.latitude,
    longitude: selectedCity.longitude,
  });

  return {
    prayerTimes: calculated,
    prayerTimesSource: calculated ? ("calculated" as const) : ("unavailable" as const),
    prayerTimesUpdatedAt: null,
  };
}

async function getDailyHadith() {
  const supabase = await supabaseServer();

  const { data: hadithRows, error } = await supabase
    .from("hadiths")
    .select(
      "id,collection,provider,external_id,arabic_text,english_text,text,translation_text,source"
    )
    .limit(200);

  if (error) {
    console.error("homepage hadith error:", error.message);
    return null;
  }

  if (!hadithRows || hadithRows.length === 0) {
    return null;
  }

  const rows = hadithRows as HadithRow[];
  const todayIndex = Math.floor(Date.now() / 86400000);

  return rows[todayIndex % rows.length] ?? null;
}

export default async function Home() {
  const supabase = await supabaseServer();
  const cookieStore = await cookies();
  const selectedCitySlug = cookieStore.get("snm_city")?.value ?? null;

  const { data: cities, error: citiesError } = await supabase
    .from("cities")
    .select("id,slug,name,timezone,country,latitude,longitude")
    .eq("is_active", true)
    .order("country", { ascending: true })
    .order("name", { ascending: true });

  if (citiesError) {
    console.error("homepage cities error:", citiesError.message);

    return (
      <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-8 text-red-100">
        Could not load cities. Please refresh the page.
      </div>
    );
  }

  const cityList = ((cities ?? []) as CityRow[]).filter((city) => {
    return Boolean(city.slug && city.name);
  });

  const selectedCity = await getSelectedCity(cityList, selectedCitySlug);

  const { prayerTimes, prayerTimesSource, prayerTimesUpdatedAt } =
    await getPrayerTimesForSelectedCity(selectedCity);

  const dailyHadith = await getDailyHadith();
  const hadithText = getHadithText(dailyHadith);
  const hadithSource = getHadithSource(dailyHadith);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "SalahNearMe",
    url: cleanSiteUrl,
    description:
      "Find mosques, prayer times, halal businesses, Hajj, Umrah and Muslim travel essentials.",
    potentialAction: {
      "@type": "SearchAction",
      target: `${cleanSiteUrl}/businesses?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <div className="space-y-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd),
        }}
      />

      <section className="relative overflow-hidden rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8 shadow-2xl shadow-black/30 md:p-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.20),transparent_40%)]" />

        <div className="relative flex flex-col items-center space-y-8 text-center">
          <Image
            src="/logo-horizontal.png"
            alt="SalahNearMe"
            width={520}
            height={220}
            priority
            className="h-auto w-[240px] object-contain sm:w-[340px]"
          />

          <div className="rounded-full border border-yellow-500/20 bg-yellow-500/10 px-4 py-2 text-xs font-black uppercase tracking-[0.28em] text-yellow-400">
            Muslim life, prayer, halal business & travel intelligence
          </div>

          <h1 className="mx-auto max-w-6xl text-4xl font-black tracking-tight text-white md:text-7xl">
            Find Mosques, Pray On Time & Discover Halal Places Near You
          </h1>

          <p className="mx-auto max-w-3xl text-base leading-8 text-white/70 md:text-xl">
            SalahNearMe connects mosques, prayer timetables, halal businesses,
            Muslim travel, Hajj and Umrah guidance, and live community signals
            into one intelligent Muslim ecosystem.
          </p>

          <CitySearch
            cities={cityList.map(({ slug, name, country }) => ({
              slug,
              name,
              country: country ?? null,
            }))}
          />

          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/near-me/pray"
              className="rounded-2xl bg-yellow-500 px-6 py-3 font-bold text-black transition hover:bg-yellow-400"
            >
              Pray near me
            </Link>

            <Link
              href="/businesses"
              className="rounded-2xl border border-yellow-500/30 px-6 py-3 font-semibold text-yellow-400 transition hover:bg-yellow-500/10"
            >
              Find halal businesses
            </Link>

            <Link
              href="/travel"
              className="rounded-2xl border border-yellow-500/30 px-6 py-3 font-semibold text-yellow-400 transition hover:bg-yellow-500/10"
            >
              Travel mode
            </Link>

            <Link
              href="/hajj"
              className="rounded-2xl border border-yellow-500/30 px-6 py-3 font-semibold text-yellow-400 transition hover:bg-yellow-500/10"
            >
              Hajj guide
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Mosques"
          value="Prayer-aware"
          helper="City pages, mosque profiles, timetables and live iqamah signals."
        />

        <StatCard
          label="Businesses"
          value="Halal places"
          helper="Restaurants, butchers, groceries, services and sponsored listings."
        />

        <StatCard
          label="Travel"
          value="Muslim-ready"
          helper="Find mosques and halal essentials while travelling."
        />
      </section>

      <section className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-8">
        <div className="text-sm font-bold uppercase tracking-[0.3em] text-emerald-300">
          Pray Now Intelligence
        </div>

        <div className="mt-4 grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <h2 className="text-3xl font-black text-white md:text-5xl">
              Find the best mosque to pray at right now
            </h2>

            <p className="mt-4 max-w-3xl leading-8 text-white/70">
              The Pray Near Me engine checks your location, nearby mosques,
              today’s prayer context, timetable data, live community reports,
              distance, travel time, and facilities to recommend the best prayer
              option near you.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/near-me/pray"
                className="rounded-2xl bg-yellow-500 px-6 py-3 font-bold text-black transition hover:bg-yellow-400"
              >
                Open Pray Near Me
              </Link>

              <Link
                href="/how-it-works"
                className="rounded-2xl border border-yellow-500/30 px-6 py-3 font-semibold text-yellow-400 transition hover:bg-yellow-500/10"
              >
                How it works
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/30 p-6">
            <div className="text-sm font-bold text-emerald-300">
              Example recommendation
            </div>

            <div className="mt-4 text-2xl font-black text-white">
              Best mosque now
            </div>

            <div className="mt-4 space-y-3 text-sm text-white/70">
              <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4">
                Current salah context checked
              </div>

              <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4">
                Distance and travel time compared
              </div>

              <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4">
                Facilities and live reports included
              </div>

              <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4">
                Salah Score calculated from trust signals
              </div>
            </div>
          </div>
        </div>
      </section>

      <HomeHajjHijriBanner />

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
              timezone: selectedCity.timezone ?? "Europe/London",
            }}
            prayerTimes={prayerTimes}
            prayerTimesSource={prayerTimesSource}
            prayerTimesUpdatedAt={prayerTimesUpdatedAt}
          />

          <HomeDailyPanel cityId={selectedCity.id} cityName={selectedCity.name} />
        </>
      ) : (
        <HomeDailyPanel />
      )}

      <section className="rounded-3xl border border-yellow-500/20 bg-black/30 p-8 text-center">
        <div className="text-sm font-bold uppercase tracking-[0.25em] text-yellow-400">
          Daily Hadith
        </div>

        <p className="mx-auto mt-4 max-w-4xl text-lg leading-9 text-white md:text-3xl">
          {hadithText
            ? `“${hadithText}”`
            : "Daily hadith will appear here soon."}
        </p>

        <div className="mt-4 text-sm text-white/60">
          {hadithSource ?? "Hadith"}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-yellow-500/30 bg-black/40 p-10">
          <div className="text-3xl font-black text-yellow-400">
            Hajj & Umrah Hub
          </div>

          <p className="mt-4 max-w-2xl leading-8 text-white/70">
            Prepare with step-by-step Hajj and Umrah guides, reminders,
            checklists, duas, rituals, and travel support.
          </p>

          <div className="mt-6 flex flex-wrap gap-4">
            <Link
              href="/hajj"
              className="rounded-2xl bg-yellow-500 px-6 py-3 font-semibold text-black transition hover:bg-yellow-400"
            >
              Open Hajj guide
            </Link>

            <Link
              href="/umrah"
              className="rounded-2xl border border-yellow-500/30 px-6 py-3 text-yellow-400 transition hover:bg-yellow-500/10"
            >
              Open Umrah guide
            </Link>
          </div>
        </div>

        <div className="rounded-3xl border border-yellow-500/30 bg-black/40 p-10">
          <div className="text-3xl font-black text-yellow-400">
            Travel & Muslim Essentials
          </div>

          <p className="mt-4 max-w-2xl leading-8 text-white/70">
            Travelling abroad or exploring another city? Use SalahNearMe to find
            mosques, halal essentials, and Muslim-friendly places with
            prayer-aware guidance.
          </p>

          <div className="mt-6 flex flex-wrap gap-4">
            <Link
              href="/travel"
              className="rounded-2xl bg-yellow-500 px-6 py-3 font-semibold text-black transition hover:bg-yellow-400"
            >
              Explore travel mode
            </Link>

            <Link
              href="/travel/map"
              className="rounded-2xl border border-yellow-500/30 px-6 py-3 text-yellow-400 transition hover:bg-yellow-500/10"
            >
              Open map view
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <FeatureCard
          title="Community First"
          description="Built respectfully for mosques, halal businesses, travellers, families, and the wider Muslim community."
        />

        <FeatureCard
          title="Prayer-Aware"
          description="Mosque timetables, city prayer times, live reports, and intelligent pray-near-me recommendations."
        />

        <FeatureCard
          title="Trust & Live Signals"
          description="Official mosque management, community-powered live activity, halal business visibility, and sponsor analytics."
        />
      </section>
    </div>
  );
}