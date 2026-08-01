import Link from "next/link";

import { supabasePublic } from "@/lib/supabaseServer";

type PrayerTimes = {
  fajr_start: string | null;
  sunrise: string | null;
  dhuhr_start: string | null;
  asr_start: string | null;
  maghrib_start: string | null;
  isha_start: string | null;
} | null;

type Props = {
  cityId?: number | null;
  cityName?: string | null;
  citySlug?: string | null;
  prayerTimes?: PrayerTimes;
};

type HadithRow = Record<string, unknown> & {
  id?: string | number | null;
  english_text?: string | null;
  english?: string | null;
  text?: string | null;
  hadith_text?: string | null;
  arabic_text?: string | null;
  arabic?: string | null;
  collection?: string | null;
  book?: string | null;
  reference?: string | null;
  hadith_number?: string | number | null;
};

type CityPrayerTimesRow = {
  fajr_start: string | null;
  sunrise: string | null;
  dhuhr_start: string | null;
  asr_start: string | null;
  maghrib_start: string | null;
  isha_start: string | null;
};

type DailyActionProps = {
  href: string;
  icon: string;
  eyebrow: string;
  title: string;
  description: string;
};

const HADITH_LIMIT = 200;

function cleanString(
  value: unknown,
  maxLength = 10_000
): string {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function cleanSlug(value: unknown): string {
  return cleanString(value, 160)
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

function getCurrentMonthAndYear() {
  const now = new Date();

  return {
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  };
}

function getHadithText(
  row: HadithRow | null
): string | null {
  if (!row) {
    return null;
  }

  return (
    cleanString(row.english_text) ||
    cleanString(row.english) ||
    cleanString(row.text) ||
    cleanString(row.hadith_text) ||
    cleanString(row.arabic_text) ||
    cleanString(row.arabic) ||
    null
  );
}

function getHadithArabic(
  row: HadithRow | null
): string {
  if (!row) {
    return "";
  }

  return (
    cleanString(row.arabic_text) ||
    cleanString(row.arabic)
  );
}

function getHadithSource(
  row: HadithRow | null
): string {
  if (!row) {
    return "Hadith";
  }

  const collection = (
    cleanString(row.collection, 180) ||
    cleanString(row.book, 180)
  )
    .replace(/_/g, " ")
    .replace(/\s+/g, " ");

  const reference =
    cleanString(row.reference, 180) ||
    cleanString(
      row.hadith_number,
      80
    );

  if (collection && reference) {
    return `${collection} • ${reference}`;
  }

  return (
    reference ||
    collection ||
    "Hadith"
  );
}

function getUtcDayNumber(): number {
  const now = new Date();

  const utcMidnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );

  return Math.floor(
    utcMidnight / 86_400_000
  );
}

function selectDailyHadith(
  rows: HadithRow[]
): HadithRow | null {
  const usableRows = rows.filter(
    (row) =>
      Boolean(getHadithText(row))
  );

  if (usableRows.length === 0) {
    return null;
  }

  const index =
    getUtcDayNumber() %
    usableRows.length;

  return usableRows[index] ?? null;
}

function getAvailablePrayerCount(
  prayerTimes: PrayerTimes
): number {
  if (!prayerTimes) {
    return 0;
  }

  return [
    prayerTimes.fajr_start,
    prayerTimes.sunrise,
    prayerTimes.dhuhr_start,
    prayerTimes.asr_start,
    prayerTimes.maghrib_start,
    prayerTimes.isha_start,
  ].filter(
    (value) =>
      cleanString(value, 20).length > 0
  ).length;
}

async function loadPrayerTimes(
  cityId: number
): Promise<PrayerTimes> {
  const supabase =
    supabasePublic();

  const { month, year } =
    getCurrentMonthAndYear();

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
        ].join(",")
      )
      .eq("city_id", cityId)
      .eq("month", month)
      .eq("year", year)
      .maybeSingle();

  if (error) {
    console.warn(
      "HomeDailyPanel prayer-times query unavailable:",
      {
        cityId,
        code: error.code,
        message: error.message,
      }
    );

    return null;
  }

  if (!data) {
    return null;
  }

  const row =
    data as unknown as CityPrayerTimesRow;

  return {
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
  };
}

async function loadDailyHadith(): Promise<HadithRow | null> {
  const supabase =
    supabasePublic();

  const { data, error } =
    await supabase
      .from("hadiths")
      .select("*")
      .limit(HADITH_LIMIT);

  if (error) {
    console.warn(
      "HomeDailyPanel hadith unavailable:",
      {
        code: error.code,
        message: error.message,
      }
    );

    return null;
  }

  return selectDailyHadith(
    (data ?? []) as unknown as HadithRow[]
  );
}

export default async function HomeDailyPanel({
  cityId = null,
  cityName = null,
  citySlug = null,
  prayerTimes: initialPrayerTimes,
}: Props) {
  let prayerTimes: PrayerTimes =
    initialPrayerTimes ?? null;

  if (!prayerTimes && cityId) {
    prayerTimes =
      await loadPrayerTimes(cityId);
  }

  const hadith =
    await loadDailyHadith();

  const hadithText =
    getHadithText(hadith);

  const hadithArabic =
    getHadithArabic(hadith);

  const cityLabel =
    cleanString(cityName, 180) ||
    "Your city";

  const safeCitySlug =
    cleanSlug(citySlug);

  const prayerDataCount =
    getAvailablePrayerCount(
      prayerTimes
    );

  const cityMosquesHref =
    safeCitySlug
      ? `/${safeCitySlug}/mosques`
      : "/near-me/pray";

  const cityBusinessesHref =
    safeCitySlug
      ? `/${safeCitySlug}/businesses`
      : "/businesses";

  const cityPrayerHref =
    safeCitySlug
      ? `/${safeCitySlug}/prayer-times`
      : "/near-me/pray";

  return (
    <section
      aria-labelledby="daily-home-heading"
      className="premium-panel relative overflow-hidden rounded-[2rem] p-5 sm:p-7"
    >
      <div
        aria-hidden="true"
        className="absolute -right-24 -top-24 h-72 w-72 rounded-full border border-yellow-400/10 bg-yellow-400/[0.025]"
      />

      <div
        aria-hidden="true"
        className="absolute -bottom-32 -left-24 h-72 w-72 rounded-full border border-sky-400/[0.07] bg-sky-400/[0.02]"
      />

      <div className="relative">
        <div className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="section-kicker">
              Your daily essentials
            </div>

            <h2
              id="daily-home-heading"
              className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl"
            >
              Guidance and useful
              shortcuts for today
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">
              Daily Islamic guidance and
              direct access to the local
              tools you are most likely to
              need.
            </p>
          </div>

          <div className="premium-badge">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-yellow-300"
            />

            {cityName
              ? cityLabel
              : "Personalise your homepage"}
          </div>
        </div>

        <div className="mt-6 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <article className="premium-inset relative overflow-hidden rounded-3xl p-5 sm:p-6">
            <div
              aria-hidden="true"
              className="absolute -right-12 -top-12 h-36 w-36 rounded-full border border-yellow-400/10 bg-yellow-400/[0.025]"
            />

            <div className="relative flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.24em] text-yellow-400">
                  Daily Hadith
                </div>

                <h3 className="mt-2 text-xl font-black text-white">
                  A reminder for today
                </h3>
              </div>

              <span
                aria-hidden="true"
                className="text-3xl leading-none text-yellow-300"
              >
                ❝
              </span>
            </div>

            {hadithText ? (
              <div className="relative">
                <blockquote className="mt-5 text-base leading-8 text-white/80 sm:text-lg">
                  “{hadithText}”
                </blockquote>

                {hadithArabic &&
                hadithArabic !==
                  hadithText ? (
                  <p
                    lang="ar"
                    dir="rtl"
                    className="mt-5 border-t border-white/10 pt-5 text-right text-lg leading-9 text-white/68 sm:text-xl"
                  >
                    {hadithArabic}
                  </p>
                ) : null}

                <footer className="mt-5 text-xs font-semibold capitalize tracking-wide text-yellow-300/80">
                  {getHadithSource(
                    hadith
                  )}
                </footer>
              </div>
            ) : (
              <div className="relative mt-5 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm leading-7 text-white/60">
                Today&apos;s hadith could
                not be loaded. Prayer and
                local discovery tools
                remain available.
              </div>
            )}
          </article>

          <aside className="premium-inset rounded-3xl p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.24em] text-yellow-400">
                  Quick access
                </div>

                <h3 className="mt-2 text-xl font-black text-white">
                  Continue with one tap
                </h3>
              </div>

              {cityName ? (
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-white/55">
                  {prayerDataCount > 0
                    ? `${prayerDataCount} times available`
                    : "City selected"}
                </span>
              ) : null}
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <DailyAction
                href={cityPrayerHref}
                icon="◷"
                eyebrow="Prayer"
                title={
                  safeCitySlug
                    ? `${cityLabel} timetable`
                    : "Choose prayer location"
                }
                description={
                  safeCitySlug
                    ? "View the complete local prayer timetable."
                    : "Detect your location or choose a city."
                }
              />

              <DailyAction
                href={cityMosquesHref}
                icon="⌖"
                eyebrow="Mosques"
                title="Find a place to pray"
                description="Discover nearby mosques and community information."
              />

              <DailyAction
                href={cityBusinessesHref}
                icon="✦"
                eyebrow="Halal discovery"
                title="Explore halal places"
                description="Browse food, shops and useful Muslim services."
              />

              <DailyAction
                href="/travel"
                icon="↗"
                eyebrow="Journey"
                title="Open Travel Mode"
                description="Keep prayer and halal discovery available away from home."
              />
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

function DailyAction({
  href,
  icon,
  eyebrow,
  title,
  description,
}: DailyActionProps) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-3.5 transition duration-300 hover:-translate-y-0.5 hover:border-yellow-400/35 hover:bg-yellow-400/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"
    >
      <span
        aria-hidden="true"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-yellow-500/25 bg-yellow-500/10 text-base text-yellow-300 transition group-hover:border-yellow-400/45"
      >
        {icon}
      </span>

      <span className="min-w-0">
        <span className="block text-[0.62rem] font-black uppercase tracking-[0.16em] text-yellow-400/70">
          {eyebrow}
        </span>

        <span className="mt-1 block text-sm font-bold text-white transition group-hover:text-yellow-200">
          {title}
        </span>

        <span className="mt-1 block text-xs leading-5 text-white/45">
          {description}
        </span>
      </span>

      <span
        aria-hidden="true"
        className="ml-auto shrink-0 text-yellow-400/60 transition group-hover:translate-x-1 group-hover:text-yellow-200"
      >
        →
      </span>
    </Link>
  );
}