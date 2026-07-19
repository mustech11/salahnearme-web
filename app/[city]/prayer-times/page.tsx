import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { supabasePublic } from "@/lib/supabaseServer";
import {
  calculatePrayerTimesForCity,
  type PrayerTimesResult,
} from "@/lib/prayerTimes";

export const revalidate = 3600;

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
  is_active?: boolean | null;
};

type CityPrayerTimesRow = {
  fajr_start: string | null;
  sunrise: string | null;
  dhuhr_start: string | null;
  asr_start: string | null;
  maghrib_start: string | null;
  isha_start: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  source?: string | null;
};

type PrayerCard = {
  key: keyof PrayerTimesResult;
  name: string;
  time: string;
  raw: string | null;
};

const DEFAULT_TIMEZONE = "Europe/London";
const SITE_URL = "https://www.salahnearme.com";

function normaliseSlug(value: string) {
  return decodeURIComponent(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function formatTime(value: string | null | undefined) {
  if (!value) return "—";

  const clean = String(value).trim();
  const match = clean.match(/^(\d{1,2}):(\d{2})/);

  if (!match) return "—";

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return "—";
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function getSafeTimezone(timezone: string | null | undefined) {
  const value = timezone || DEFAULT_TIMEZONE;

  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: value }).format(new Date());
    return value;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

function getTodayLabel(timezone: string | null | undefined) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: getSafeTimezone(timezone),
  }).format(new Date());
}

function getCurrentMonthYear(timezone: string | null | undefined) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    month: "numeric",
    year: "numeric",
    timeZone: getSafeTimezone(timezone),
  }).formatToParts(new Date());

  const month = Number(parts.find((part) => part.type === "month")?.value);
  const year = Number(parts.find((part) => part.type === "year")?.value);

  return {
    month: Number.isFinite(month) ? month : new Date().getMonth() + 1,
    year: Number.isFinite(year) ? year : new Date().getFullYear(),
  };
}

function getCurrentMinutes(timezone: string | null | undefined) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: getSafeTimezone(timezone),
  }).formatToParts(new Date());

  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(
    parts.find((part) => part.type === "minute")?.value ?? "0"
  );

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return 0;

  return hour * 60 + minute;
}

function getMinutesFromTime(value: string | null | undefined) {
  const formatted = formatTime(value);

  if (formatted === "—") return null;

  const [hoursRaw, minutesRaw] = formatted.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;

  return hours * 60 + minutes;
}

function getNextPrayer(prayers: PrayerCard[], timezone: string | null | undefined) {
  const validPrayers = prayers.filter((prayer) => prayer.time !== "—");

  if (validPrayers.length === 0) return null;

  const currentMinutes = getCurrentMinutes(timezone);

  for (const prayer of validPrayers) {
    const prayerMinutes = getMinutesFromTime(prayer.raw);

    if (prayerMinutes !== null && prayerMinutes > currentMinutes) {
      return prayer;
    }
  }

  return validPrayers[0] ?? null;
}

function hasPrayerTimes(prayerTimes: PrayerTimesResult | null) {
  if (!prayerTimes) return false;

  return Boolean(
    prayerTimes.fajr_start ||
      prayerTimes.sunrise ||
      prayerTimes.dhuhr_start ||
      prayerTimes.asr_start ||
      prayerTimes.maghrib_start ||
      prayerTimes.isha_start
  );
}

function buildPrayerCards(prayerTimes: PrayerTimesResult | null): PrayerCard[] {
  return [
    {
      key: "fajr_start",
      name: "Fajr",
      time: formatTime(prayerTimes?.fajr_start),
      raw: prayerTimes?.fajr_start ?? null,
    },
    {
      key: "sunrise",
      name: "Sunrise",
      time: formatTime(prayerTimes?.sunrise),
      raw: prayerTimes?.sunrise ?? null,
    },
    {
      key: "dhuhr_start",
      name: "Dhuhr",
      time: formatTime(prayerTimes?.dhuhr_start),
      raw: prayerTimes?.dhuhr_start ?? null,
    },
    {
      key: "asr_start",
      name: "Asr",
      time: formatTime(prayerTimes?.asr_start),
      raw: prayerTimes?.asr_start ?? null,
    },
    {
      key: "maghrib_start",
      name: "Maghrib",
      time: formatTime(prayerTimes?.maghrib_start),
      raw: prayerTimes?.maghrib_start ?? null,
    },
    {
      key: "isha_start",
      name: "Isha",
      time: formatTime(prayerTimes?.isha_start),
      raw: prayerTimes?.isha_start ?? null,
    },
  ];
}

function getSourceLabel(source: string) {
  if (source === "verified") return "Verified local timetable";
  if (source === "calculated") return "Calculated automatically";
  return "Times unavailable";
}

function getSourceDescription(source: string, cityName: string) {
  if (source === "verified") {
    return `These prayer times for ${cityName} are coming from a saved local timetable in SalahNearMe.`;
  }

  if (source === "calculated") {
    return `These prayer times for ${cityName} are calculated automatically using the city coordinates and timezone.`;
  }

  return `Prayer times for ${cityName} are not available yet because this city does not currently have enough location data or a verified local timetable.`;
}

async function getCityBySlug(slug: string) {
  const supabase = supabasePublic();

  const { data } = await supabase
    .from("cities")
    .select("id,name,slug,country,timezone,latitude,longitude,is_active")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  return data as CityRow | null;
}

async function getStoredPrayerTimes(cityId: number, month: number, year: number) {
  const supabase = supabasePublic();

  const { data } = await supabase
    .from("city_prayer_times")
    .select(
      "fajr_start,sunrise,dhuhr_start,asr_start,maghrib_start,isha_start,created_at,updated_at,source"
    )
    .eq("city_id", cityId)
    .eq("month", month)
    .eq("year", year)
    .maybeSingle();

  return data as CityPrayerTimesRow | null;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { city } = await params;
  const slug = normaliseSlug(city);
  const cityRow = await getCityBySlug(slug);

  if (!cityRow) {
    return {
      title: "Prayer Times Not Found | SalahNearMe",
      description:
        "This SalahNearMe prayer-times city page could not be found.",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const title = `${cityRow.name} Prayer Times Today | Fajr, Dhuhr, Asr, Maghrib, Isha`;
  const description = `View today's salah beginning times in ${cityRow.name}, including Fajr, Sunrise, Dhuhr, Asr, Maghrib, and Isha. Find nearby mosques and halal businesses on SalahNearMe.`;

  return {
    title,
    description,
    alternates: {
      canonical: `${SITE_URL}/${cityRow.slug}/prayer-times`,
    },
    openGraph: {
      title: `${cityRow.name} Prayer Times Today | SalahNearMe`,
      description,
      url: `${SITE_URL}/${cityRow.slug}/prayer-times`,
      siteName: "SalahNearMe",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${cityRow.name} Prayer Times Today | SalahNearMe`,
      description,
    },
  };
}

export default async function CityPrayerTimesPage({ params }: PageProps) {
  const { city } = await params;
  const slug = normaliseSlug(city);
  const cityRow = await getCityBySlug(slug);

  if (!cityRow) notFound();

  const { month, year } = getCurrentMonthYear(cityRow.timezone);

  const storedPrayerTimes = await getStoredPrayerTimes(cityRow.id, month, year);

  let prayerTimes: PrayerTimesResult | null = null;
  let source: "verified" | "calculated" | "unavailable" = "unavailable";

  if (storedPrayerTimes && hasPrayerTimes(storedPrayerTimes)) {
    prayerTimes = {
      fajr_start: storedPrayerTimes.fajr_start,
      sunrise: storedPrayerTimes.sunrise,
      dhuhr_start: storedPrayerTimes.dhuhr_start,
      asr_start: storedPrayerTimes.asr_start,
      maghrib_start: storedPrayerTimes.maghrib_start,
      isha_start: storedPrayerTimes.isha_start,
    };

    source = "verified";
  } else {
    const calculatedPrayerTimes = calculatePrayerTimesForCity({
      timezone: cityRow.timezone,
      latitude: cityRow.latitude,
      longitude: cityRow.longitude,
    });

    if (hasPrayerTimes(calculatedPrayerTimes)) {
      prayerTimes = calculatedPrayerTimes;
      source = "calculated";
    }
  }

  const prayers = buildPrayerCards(prayerTimes);
  const nextPrayer = getNextPrayer(prayers, cityRow.timezone);
  const todayLabel = getTodayLabel(cityRow.timezone);
  const sourceLabel = getSourceLabel(source);
  const sourceDescription = getSourceDescription(source, cityRow.name);
  const canonicalUrl = `${SITE_URL}/${cityRow.slug}/prayer-times`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `${cityRow.name} Prayer Times Today`,
    description: `Today's salah beginning times in ${cityRow.name}, including Fajr, Sunrise, Dhuhr, Asr, Maghrib, and Isha.`,
    url: canonicalUrl,
    isPartOf: {
      "@type": "WebSite",
      name: "SalahNearMe",
      url: SITE_URL,
    },
    about: {
      "@type": "Place",
      name: cityRow.name,
      address: {
        "@type": "PostalAddress",
        addressCountry: cityRow.country ?? "United Kingdom",
      },
    },
  };

  return (
    <div className="space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="rounded-3xl border border-yellow-500/20 bg-gradient-to-br from-[#07122f] via-[#071026] to-[#242424] p-8 shadow-2xl md:p-10">
        <div className="text-sm uppercase tracking-[0.28em] text-yellow-400">
          SalahNearMe Prayer Times
        </div>

        <div className="mt-4 grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <h1 className="text-4xl font-black leading-tight text-white md:text-6xl">
              {cityRow.name} Prayer Times Today
            </h1>

            <p className="mt-5 max-w-3xl text-lg leading-8 text-white/70">
              View today’s salah beginning times in {cityRow.name}, including
              Fajr, Sunrise, Dhuhr, Asr, Maghrib, and Isha.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-sm font-bold text-yellow-300">
                {sourceLabel}
              </span>

              <span className="rounded-full border border-white/10 bg-black/30 px-4 py-2 text-sm text-white/70">
                {todayLabel}
              </span>

              <span className="rounded-full border border-white/10 bg-black/30 px-4 py-2 text-sm text-white/70">
                {getSafeTimezone(cityRow.timezone)}
              </span>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/30 p-6">
            <div className="text-sm uppercase tracking-[0.22em] text-yellow-400">
              Next Salah
            </div>

            {nextPrayer ? (
              <>
                <h2 className="mt-3 text-4xl font-black text-white">
                  {nextPrayer.name}
                </h2>

                <div className="mt-4 text-6xl font-black text-yellow-400">
                  {nextPrayer.time}
                </div>

                <p className="mt-4 text-sm leading-6 text-white/60">
                  The next salah time in {cityRow.name} is {nextPrayer.name}.
                </p>
              </>
            ) : (
              <>
                <h2 className="mt-3 text-3xl font-black text-white">
                  Times unavailable
                </h2>

                <p className="mt-4 text-sm leading-6 text-white/60">
                  We do not yet have verified or calculated prayer times for{" "}
                  {cityRow.name}. Add coordinates or upload a timetable to show
                  live daily times.
                </p>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6 md:p-8">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-3xl font-black text-white">
              Today’s Salah Times
            </h2>

            <p className="mt-2 text-white/60">{sourceDescription}</p>
          </div>

          <div className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-sm font-bold text-yellow-300">
            {month}/{year}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {prayers.map((prayer) => {
            const isNextPrayer = nextPrayer?.name === prayer.name;

            return (
              <div
                key={prayer.key}
                className={`rounded-2xl border p-6 text-center transition ${
                  isNextPrayer
                    ? "border-yellow-500/50 bg-yellow-500/10 shadow-lg shadow-yellow-500/10"
                    : "border-white/10 bg-black/30"
                }`}
              >
                <div className="text-sm font-bold text-yellow-400">
                  {prayer.name}
                </div>

                <div className="mt-3 text-4xl font-black text-white">
                  {prayer.time}
                </div>

                <div className="mt-2 text-xs text-white/50">Begins</div>

                {isNextPrayer && (
                  <div className="mx-auto mt-4 w-fit rounded-full bg-yellow-500 px-3 py-1 text-xs font-black text-black">
                    Next prayer
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {source === "unavailable" && (
        <section className="rounded-3xl border border-yellow-500/20 bg-black/30 p-8">
          <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
            Help improve {cityRow.name}
          </div>

          <h2 className="mt-3 text-3xl font-black text-white">
            Prayer times are not available yet.
          </h2>

          <p className="mt-4 max-w-4xl leading-8 text-white/70">
            SalahNearMe can show prayer times when a verified local timetable is
            added or when the city has usable coordinates for automatic
            calculation. This page is live and ready for {cityRow.name}; it just
            needs prayer-time data.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`/${cityRow.slug}/mosques`}
              className="rounded-full bg-yellow-500 px-5 py-3 font-black text-black hover:bg-yellow-400"
            >
              View mosques in {cityRow.name}
            </Link>

            <Link
              href="/admin/mosque-timetable-imports"
              className="rounded-full border border-yellow-500/30 px-5 py-3 font-bold text-yellow-300 hover:border-yellow-400"
            >
              Import timetable
            </Link>
          </div>
        </section>
      )}

      <section className="rounded-3xl border border-yellow-500/20 bg-black/30 p-8">
        <h2 className="text-3xl font-black text-yellow-400">
          Salah times in {cityRow.name}
        </h2>

        <div className="mt-4 space-y-4 leading-8 text-white/70">
          <p>
            These prayer times show the daily beginning times for the five daily
            prayers in {cityRow.name}. Muslims use these times to plan Fajr,
            Dhuhr, Asr, Maghrib, and Isha throughout the day.
          </p>

          <p>
            When a verified mosque or local city timetable is available,
            SalahNearMe prioritises that local timetable. If no verified
            timetable exists yet, SalahNearMe can use the city’s coordinates and
            timezone to calculate a helpful fallback.
          </p>

          <p className="text-sm text-white/50">
            Always follow your local mosque timetable where there is a
            difference, especially for Ramadan, Jumuah, Eid, and local moonsighting
            announcements.
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Link
          href={`/${cityRow.slug}`}
          className="rounded-2xl border border-yellow-500/20 bg-black/30 p-5 font-bold text-yellow-400 hover:border-yellow-400/50"
        >
          Back to {cityRow.name}
        </Link>

        <Link
          href={`/${cityRow.slug}/mosques`}
          className="rounded-2xl border border-yellow-500/20 bg-black/30 p-5 font-bold text-yellow-400 hover:border-yellow-400/50"
        >
          Mosques in {cityRow.name}
        </Link>

        <Link
          href={`/${cityRow.slug}/businesses`}
          className="rounded-2xl border border-yellow-500/20 bg-black/30 p-5 font-bold text-yellow-400 hover:border-yellow-400/50"
        >
          Halal businesses in {cityRow.name}
        </Link>
      </section>
    </div>
  );
}