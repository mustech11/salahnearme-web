import type { Metadata } from "next";

import Link from "next/link";
import { cookies } from "next/headers";

import CitySearch from "@/components/CitySearch";
import HomeDailyPanel from "@/components/HomeDailyPanel";
import HomeHajjHijriBanner from "@/components/HomeHajjHijriBanner";
import NextSalahCountdown from "@/components/NextSalahCountdown";
import SelectedCityHomePanel from "@/components/SelectedCityHomePanel";
import { calculatePrayerTimesForCity, type PrayerTimesResult } from "@/lib/prayerTimes";
import { supabaseServer } from "@/lib/supabaseServer";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "SalahNearMe | Mosques, Halal Businesses & Muslim Travel",
  description:
    "Find mosques, halal businesses, prayer times, Hajj guides, Umrah guides, Muslim travel essentials, and intelligent pray-near-me recommendations with SalahNearMe.",
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

export default async function Home() {
  const supabase = await supabaseServer();
  const cookieStore = await cookies();
  const selectedCitySlug = cookieStore.get("snm_city")?.value ?? null;

  const { data: cities, error: citiesError } = await supabase
    .from("cities")
    .select("id,slug,name,timezone,country,latitude,longitude")
    .eq("is_active", true)
    .order("country", {
      ascending: true,
    })
    .order("name", {
      ascending: true,
    });

  if (citiesError) {
    return <pre className="text-white/80">{citiesError.message}</pre>;
  }

  const cityList = (cities ?? []) as CityRow[];

  let selectedCity: CityRow | null = null;
  let prayerTimes: PrayerTimesRow | null = null;
  let prayerTimesSource: "manual_override" | "calculated" | "unavailable" =
    "unavailable";
  let prayerTimesUpdatedAt: string | null = null;

  if (selectedCitySlug) {
    const { data: selectedCityRow } = await supabase
      .from("cities")
      .select("id,slug,name,timezone,country,latitude,longitude")
      .eq("slug", selectedCitySlug)
      .eq("is_active", true)
      .maybeSingle();

    selectedCity = (selectedCityRow as CityRow | null) ?? null;

    if (selectedCity) {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      const { data: prayerTimesRow } = await supabase
        .from("city_prayer_times")
        .select(
          "fajr_start,sunrise,dhuhr_start,asr_start,maghrib_start,isha_start,created_at"
        )
        .eq("city_id", selectedCity.id)
        .eq("month", month)
        .eq("year", year)
        .maybeSingle();

      if (prayerTimesRow) {
        const override = prayerTimesRow as PrayerTimesOverrideRow;

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
          timezone: selectedCity.timezone,
          latitude: selectedCity.latitude,
          longitude: selectedCity.longitude,
        });

        prayerTimesSource = prayerTimes ? "calculated" : "unavailable";
      }
    }
  }

  const todayIndex = Math.floor(Date.now() / 86400000);

  const { data: hadithRows, error: hadithError } = await supabase
    .from("hadiths")
    .select("*")
    .limit(200);

  let dailyHadith: HadithRow | null = null;

  if (!hadithError && hadithRows && hadithRows.length > 0) {
    const rows = hadithRows as HadithRow[];
    dailyHadith = rows[todayIndex % rows.length] ?? null;
  }

  const hadithText = getHadithText(dailyHadith);
  const hadithSource = getHadithSource(dailyHadith);

  return (
    <div className="space-y-12">
      <section className="relative overflow-hidden rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8 md:p-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.18),transparent_42%)]" />

        <div className="relative flex flex-col items-center space-y-8 text-center">
          <img
            src="/logo-horizontal.png"
            alt="SalahNearMe"
            className="block h-auto w-[240px] object-contain sm:w-[320px]"
          />

          <div className="rounded-full border border-yellow-500/20 bg-yellow-500/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.25em] text-yellow-400">
            Muslim life, prayer, halal business & travel intelligence
          </div>

          <h1 className="mx-auto max-w-5xl text-4xl font-bold tracking-tight text-white md:text-6xl">
            Find Mosques, Pray On Time & Discover Halal Places Near You
          </h1>

          <p className="mx-auto max-w-3xl text-base text-white/70 md:text-xl">
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
              href="/travel/near-me"
              className="rounded-2xl border border-yellow-500/30 px-6 py-3 font-semibold text-yellow-400 transition hover:bg-yellow-500/10"
            >
              Use my location
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

      <section className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-8">
        <div className="text-sm uppercase tracking-[0.25em] text-emerald-300">
          Pray Now Intelligence
        </div>

        <div className="mt-4 grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <h2 className="text-3xl font-black text-white md:text-4xl">
              Find the best mosque to pray at right now
            </h2>

            <p className="mt-4 max-w-3xl text-white/70">
              Our Pray Near Me engine checks your location, nearby mosques,
              mosque-specific timetables, live community reports, distance, and
              facilities to recommend the best prayer option near you.
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

            <div className="mt-3 space-y-3 text-sm text-white/70">
              <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4">
                Dhuhr jamaʿah soon
              </div>

              <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4">
                1.3km away
              </div>

              <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4">
                Parking, women’s space, wheelchair access
              </div>

              <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4">
                Salah Score calculated from live signals
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
        <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
          Daily Hadith
        </div>

        <p className="mx-auto mt-4 max-w-4xl text-lg text-white md:text-3xl">
          {hadithText
            ? `“${hadithText}”`
            : "Daily hadith will appear here soon."}
        </p>

        <div className="mt-3 text-sm text-white/60">
          {hadithSource ?? "Hadith"}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-yellow-500/30 bg-black p-10">
          <div className="text-3xl font-bold text-yellow-400">
            Hajj & Umrah Hub
          </div>

          <p className="mt-4 max-w-2xl text-white/70">
            Prepare for Dhul Hijjah with step-by-step Hajj and Umrah guides,
            Qur’an reminders, Sunnah-based rituals, checklists, duas, and travel
            support.
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

        <div className="rounded-3xl border border-yellow-500/30 bg-black p-10">
          <div className="text-3xl font-bold text-yellow-400">
            Travel & Muslim Essentials
          </div>

          <p className="mt-4 max-w-2xl text-white/70">
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
        <div className="rounded-2xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6">
          <div className="font-semibold text-yellow-400">Community First</div>
          <p className="mt-2 text-sm text-white/70">
            Built respectfully for mosques, halal businesses, travellers,
            families, and the wider Muslim community.
          </p>
        </div>

        <div className="rounded-2xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6">
          <div className="font-semibold text-yellow-400">Prayer-Aware</div>
          <p className="mt-2 text-sm text-white/70">
            Mosque timetables, city prayer times, live reports, and intelligent
            pray-near-me recommendations.
          </p>
        </div>

        <div className="rounded-2xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6">
          <div className="font-semibold text-yellow-400">
            Trust & Live Signals
          </div>
          <p className="mt-2 text-sm text-white/70">
            Official mosque management, community-powered live activity, halal
            business visibility, and sponsor analytics.
          </p>
        </div>
      </section>
    </div>
  );
}

