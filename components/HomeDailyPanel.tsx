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

type PrayerRow = {
  label: string;
  value: string | null | undefined;
  accent?: boolean;
};

type CityPrayerTimesRow = {
  fajr_start: string | null;
  sunrise: string | null;
  dhuhr_start: string | null;
  asr_start: string | null;
  maghrib_start: string | null;
  isha_start: string | null;
};

const HADITH_LIMIT = 200;

function getCurrentMonthAndYear() {
  const now = new Date();

  return {
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  };
}

function cleanString(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function formatTime(
  value: string | null | undefined
): string {
  const cleaned = cleanString(value);

  if (!cleaned) {
    return "—";
  }

  return cleaned.slice(0, 5);
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
    cleanString(row.collection) ||
    cleanString(row.book)
  ).replace(/_/g, " ");

  const reference =
    cleanString(row.reference) ||
    cleanString(row.hadith_number);

  if (collection && reference) {
    return `${collection} • ${reference}`;
  }

  return reference || collection || "Hadith";
}

function getPrayerRows(
  prayerTimes: PrayerTimes
): PrayerRow[] {
  return [
    {
      label: "Fajr",
      value: prayerTimes?.fajr_start,
    },
    {
      label: "Sunrise",
      value: prayerTimes?.sunrise,
    },
    {
      label: "Dhuhr",
      value: prayerTimes?.dhuhr_start,
    },
    {
      label: "Asr",
      value: prayerTimes?.asr_start,
    },
    {
      label: "Maghrib",
      value: prayerTimes?.maghrib_start,
      accent: true,
    },
    {
      label: "Isha",
      value: prayerTimes?.isha_start,
    },
  ];
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
    (row) => Boolean(getHadithText(row))
  );

  if (usableRows.length === 0) {
    return null;
  }

  const index =
    getUtcDayNumber() % usableRows.length;

  return usableRows[index] ?? null;
}

async function loadPrayerTimes(
  cityId: number
): Promise<PrayerTimes> {
  const supabase = supabasePublic();
  const { month, year } =
    getCurrentMonthAndYear();

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
      ].join(",")
    )
    .eq("city_id", cityId)
    .eq("month", month)
    .eq("year", year)
    .maybeSingle();

  if (error) {
    console.error(
      "HomeDailyPanel prayer-times query failed:",
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
    fajr_start: row.fajr_start ?? null,
    sunrise: row.sunrise ?? null,
    dhuhr_start:
      row.dhuhr_start ?? null,
    asr_start: row.asr_start ?? null,
    maghrib_start:
      row.maghrib_start ?? null,
    isha_start: row.isha_start ?? null,
  };
}

async function loadDailyHadith(): Promise<HadithRow | null> {
  const supabase = supabasePublic();

  const { data, error } = await supabase
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

  const prayerRows =
    getPrayerRows(prayerTimes);

  const hasPrayerTimes =
    prayerRows.some(
      (item) => Boolean(item.value)
    );

  const cityLabel =
    cleanString(cityName) || "Your city";

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
              Everything you need today
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">
              Prayer information, daily guidance
              and quick access to the tools you
              use most.
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

        <div className="mt-6 grid gap-5 xl:grid-cols-[1.25fr_0.9fr_0.72fr]">
          <article className="premium-inset rounded-3xl p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.24em] text-yellow-400">
                  Today&apos;s Salah
                </div>

                <h3 className="mt-2 text-xl font-black text-white">
                  {cityLabel}
                </h3>
              </div>

              {citySlug ? (
                <Link
                  href={`/${citySlug}/prayer-times`}
                  className="text-xs font-bold text-yellow-300 transition hover:text-yellow-100"
                >
                  Full timetable →
                </Link>
              ) : null}
            </div>

            {hasPrayerTimes ? (
              <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6 xl:grid-cols-3 2xl:grid-cols-6">
                {prayerRows.map(
                  (item) => (
                    <div
                      key={item.label}
                      className={[
                        "rounded-2xl border px-3 py-3 text-center transition duration-300",
                        item.accent
                          ? "border-yellow-400/35 bg-yellow-400/10 shadow-[0_0_26px_rgba(212,175,55,0.06)]"
                          : "border-white/10 bg-black/30 hover:border-yellow-400/20",
                      ].join(" ")}
                    >
                      <div className="text-[0.64rem] font-black uppercase tracking-[0.16em] text-yellow-400">
                        {item.label}
                      </div>

                      <div className="mt-1.5 text-lg font-black text-white">
                        {formatTime(
                          item.value
                        )}
                      </div>
                    </div>
                  )
                )}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
                <p className="text-sm leading-7 text-white/60">
                  Choose your city or use
                  location detection to display
                  today&apos;s prayer times.
                </p>

                <Link
                  href="/near-me/pray"
                  className="mt-4 inline-flex text-sm font-bold text-yellow-300 hover:text-yellow-100"
                >
                  Use Pray Near Me →
                </Link>
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/near-me/pray"
                className="premium-button px-4 py-2.5 text-sm"
              >
                Find best mosque now
              </Link>

              {citySlug ? (
                <Link
                  href={`/${citySlug}/mosques`}
                  className="premium-button-outline px-4 py-2.5 text-sm"
                >
                  Nearby mosques
                </Link>
              ) : null}
            </div>
          </article>

          <article className="premium-inset relative overflow-hidden rounded-3xl p-5">
            <div
              aria-hidden="true"
              className="absolute -right-12 -top-12 h-32 w-32 rounded-full border border-yellow-400/10 bg-yellow-400/[0.025]"
            />

            <div className="relative flex items-center justify-between gap-3">
              <div className="text-xs font-black uppercase tracking-[0.24em] text-yellow-400">
                Daily Hadith
              </div>

              <span
                aria-hidden="true"
                className="text-2xl text-yellow-300"
              >
                ❝
              </span>
            </div>

            {hadithText ? (
              <div className="relative">
                <blockquote className="mt-4 line-clamp-6 text-sm leading-7 text-white/80 sm:text-base">
                  “{hadithText}”
                </blockquote>

                {hadithArabic &&
                hadithArabic !==
                  hadithText ? (
                  <p
                    lang="ar"
                    dir="rtl"
                    className="mt-4 line-clamp-3 text-right text-base leading-8 text-white/65"
                  >
                    {hadithArabic}
                  </p>
                ) : null}

                <footer className="mt-4 border-t border-white/10 pt-3 text-xs font-semibold capitalize text-yellow-300/80">
                  {getHadithSource(
                    hadith
                  )}
                </footer>
              </div>
            ) : (
              <div className="relative mt-4 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm leading-6 text-white/60">
                Daily hadith will appear
                here when one becomes
                available.
              </div>
            )}
          </article>

          <aside className="premium-inset rounded-3xl p-5">
            <div className="text-xs font-black uppercase tracking-[0.24em] text-yellow-400">
              Quick access
            </div>

            <div className="mt-4 grid gap-2.5">
              <QuickLink
                href="/businesses"
                icon="✦"
                title="Halal businesses"
                description="Food, shops and services"
              />

              <QuickLink
                href="/travel/near-me"
                icon="⌖"
                title="Travel near me"
                description="Mosques and halal places"
              />

              <QuickLink
                href="/hajj"
                icon="◈"
                title="Hajj guide"
                description="Step-by-step guidance"
              />

              <QuickLink
                href="/umrah"
                icon="◆"
                title="Umrah guide"
                description="Prepare and perform Umrah"
              />
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

function QuickLink({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-black/25 px-3 py-3 transition duration-300 hover:-translate-y-0.5 hover:border-yellow-400/35 hover:bg-yellow-400/[0.06]"
    >
      <span
        aria-hidden="true"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-yellow-500/25 bg-yellow-500/10 text-sm text-yellow-300 transition group-hover:border-yellow-400/45"
      >
        {icon}
      </span>

      <span className="min-w-0">
        <span className="block text-sm font-bold text-white transition group-hover:text-yellow-200">
          {title}
        </span>

        <span className="mt-0.5 block truncate text-xs text-white/45">
          {description}
        </span>
      </span>

      <span
        aria-hidden="true"
        className="ml-auto text-yellow-400/60 transition group-hover:translate-x-1 group-hover:text-yellow-200"
      >
        →
      </span>
    </Link>
  );
}