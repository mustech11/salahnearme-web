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

type HadithRow = {
  english_text?: string | null;
  arabic_text?: string | null;
  collection?: string | null;
  source?: string | null;
  reference?: string | null;
};

function getToday() {
  const now = new Date();

  return {
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  };
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function formatTime(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  return value.slice(0, 5);
}

function getHadithText(row: HadithRow | null) {
  return (
    cleanString(row?.english_text) ||
    cleanString(row?.arabic_text) ||
    null
  );
}

function getHadithSource(row: HadithRow | null) {
  return (
    cleanString(row?.source) ||
    cleanString(row?.reference) ||
    cleanString(row?.collection).replace(/_/g, " ") ||
    "Hadith"
  );
}

function getPrayerRows(prayerTimes: PrayerTimes) {
  return [
    ["Fajr", prayerTimes?.fajr_start],
    ["Sunrise", prayerTimes?.sunrise],
    ["Dhuhr", prayerTimes?.dhuhr_start],
    ["Asr", prayerTimes?.asr_start],
    ["Maghrib", prayerTimes?.maghrib_start],
    ["Isha", prayerTimes?.isha_start],
  ] as const;
}

export default async function HomeDailyPanel({
  cityId = null,
  cityName = null,
  citySlug = null,
  prayerTimes: initialPrayerTimes,
}: Props) {
  const supabase = supabasePublic();
  const { month, year } = getToday();

  let prayerTimes: PrayerTimes = initialPrayerTimes ?? null;

  if (!prayerTimes && cityId) {
    const { data, error } = await supabase
      .from("city_prayer_times")
      .select(
        "fajr_start,sunrise,dhuhr_start,asr_start,maghrib_start,isha_start"
      )
      .eq("city_id", cityId)
      .eq("month", month)
      .eq("year", year)
      .maybeSingle();

    if (error) {
      console.error("home daily prayer panel error:", error.message);
    }

    if (data) {
      prayerTimes = {
        fajr_start: data.fajr_start ?? null,
        sunrise: data.sunrise ?? null,
        dhuhr_start: data.dhuhr_start ?? null,
        asr_start: data.asr_start ?? null,
        maghrib_start: data.maghrib_start ?? null,
        isha_start: data.isha_start ?? null,
      };
    }
  }

  const { data: hadithRows, error: hadithError } = await supabase
    .from("hadiths")
    .select("english_text,arabic_text,collection,source,reference")
    .limit(100);

  if (hadithError) {
    console.error("home daily hadith panel error:", hadithError.message);
  }

  const usableHadiths = ((hadithRows ?? []) as HadithRow[]).filter((row) =>
    Boolean(getHadithText(row))
  );

  const todayIndex = Math.floor(Date.now() / 86400000);
  const hadith =
    usableHadiths.length > 0
      ? usableHadiths[todayIndex % usableHadiths.length] ?? null
      : null;

  const prayerRows = getPrayerRows(prayerTimes);
  const hasPrayerTimes = prayerRows.some(([, value]) => Boolean(value));
  const cityLabel = cityName ?? "Your city";

  return (
    <section className="grid gap-6 lg:grid-cols-3">
      <div className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6 shadow-xl shadow-black/20">
        <div className="text-xs font-bold uppercase tracking-[0.25em] text-yellow-400">
          Daily Salah
        </div>

        <h3 className="mt-3 text-2xl font-black text-white">{cityLabel}</h3>

        {hasPrayerTimes ? (
          <div className="mt-5 grid grid-cols-2 gap-3">
            {prayerRows.map(([label, value]) => (
              <div
                key={label}
                className="rounded-2xl border border-white/10 bg-black/30 p-4"
              >
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-yellow-400">
                  {label}
                </div>

                <div className="mt-2 text-2xl font-black text-white">
                  {formatTime(value)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm leading-6 text-white/60">
            Choose your city or use your location to show daily salah times on
            the homepage.
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-3">
          {citySlug ? (
            <Link
              href={`/${citySlug}/prayer-times`}
              className="rounded-xl bg-yellow-500 px-4 py-3 text-sm font-bold text-black transition hover:bg-yellow-400"
            >
              Full prayer times
            </Link>
          ) : (
            <Link
              href="/near-me/pray"
              className="rounded-xl bg-yellow-500 px-4 py-3 text-sm font-bold text-black transition hover:bg-yellow-400"
            >
              Pray near me
            </Link>
          )}

          {citySlug && (
            <Link
              href={`/${citySlug}/mosques`}
              className="rounded-xl border border-yellow-500/30 px-4 py-3 text-sm font-semibold text-yellow-400 transition hover:bg-yellow-500/10"
            >
              Nearby mosques
            </Link>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-yellow-500/20 bg-black/30 p-6 shadow-xl shadow-black/20">
        <div className="text-xs font-bold uppercase tracking-[0.25em] text-yellow-400">
          Daily Hadith
        </div>

        {hadith ? (
          <>
            <p className="mt-5 text-base leading-8 text-white/80 italic">
              “{getHadithText(hadith)}”
            </p>

            {cleanString(hadith.arabic_text) &&
              cleanString(hadith.arabic_text) !== getHadithText(hadith) && (
                <p className="mt-4 text-right text-lg leading-9 text-white/70">
                  {hadith.arabic_text}
                </p>
              )}

            <div className="mt-4 text-xs text-white/50">
              {getHadithSource(hadith)}
            </div>
          </>
        ) : (
          <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/60">
            No hadith available yet.
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6 shadow-xl shadow-black/20">
        <div className="text-xs font-bold uppercase tracking-[0.25em] text-yellow-400">
          Quick Actions
        </div>

        <div className="mt-5 grid gap-3">
          <Link
            href="/near-me/pray"
            className="rounded-xl bg-yellow-500 px-4 py-3 text-center text-sm font-bold text-black transition hover:bg-yellow-400"
          >
            Find best mosque now
          </Link>

          <Link
            href="/businesses"
            className="rounded-xl border border-yellow-500/30 px-4 py-3 text-center text-sm font-semibold text-yellow-400 transition hover:bg-yellow-500/10"
          >
            Find halal businesses
          </Link>

          <Link
            href="/travel/near-me"
            className="rounded-xl border border-yellow-500/30 px-4 py-3 text-center text-sm font-semibold text-yellow-400 transition hover:bg-yellow-500/10"
          >
            Travel near me
          </Link>

          <Link
            href="/hajj"
            className="rounded-xl border border-yellow-500/30 px-4 py-3 text-center text-sm font-semibold text-yellow-400 transition hover:bg-yellow-500/10"
          >
            Hajj guide
          </Link>
        </div>
      </div>
    </section>
  );
}