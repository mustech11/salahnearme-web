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
};

type PrayerTimesOverrideRow = PrayerTimesResult & {
  created_at?: string | null;
};

function formatTime(value: string | null | undefined) {
  if (!value) return "—";
  return value.slice(0, 5);
}

function getTodayLabel(timezone: string | null) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: timezone ?? "Europe/London",
  }).format(new Date());
}

function getMinutesFromTime(value: string | null | undefined) {
  if (!value) return null;

  const [hoursRaw, minutesRaw] = value.slice(0, 5).split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;

  return hours * 60 + minutes;
}

function getCurrentMinutes(timezone: string | null) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone ?? "Europe/London",
  }).formatToParts(new Date());

  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");

  return hour * 60 + minute;
}

function getNextPrayer(
  prayers: { name: string; time: string; raw: string | null | undefined }[],
  timezone: string | null
) {
  const currentMinutes = getCurrentMinutes(timezone);

  for (const prayer of prayers) {
    const prayerMinutes = getMinutesFromTime(prayer.raw);

    if (prayerMinutes !== null && prayerMinutes > currentMinutes) {
      return prayer;
    }
  }

  return prayers[0] ?? null;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { city } = await params;
  const supabase = supabasePublic();

  const { data } = await supabase
    .from("cities")
    .select("name,slug,country")
    .eq("slug", city)
    .eq("is_active", true)
    .maybeSingle();

  if (!data) return { title: "Prayer Times Not Found" };

  return {
    title: `${data.name} Prayer Times Today | Fajr, Dhuhr, Asr, Maghrib, Isha`,
    description: `View today's salah beginning times in ${data.name}, including Fajr, Sunrise, Dhuhr, Asr, Maghrib, and Isha. Find nearby mosques and halal businesses on SalahNearMe.`,
    alternates: {
      canonical: `/${data.slug}/prayer-times`,
    },
    openGraph: {
      title: `${data.name} Prayer Times Today | SalahNearMe`,
      description: `Accurate daily prayer times for ${data.name}, including Fajr, Dhuhr, Asr, Maghrib, and Isha.`,
      url: `/${data.slug}/prayer-times`,
    },
  };
}

export default async function CityPrayerTimesPage({ params }: PageProps) {
  const { city } = await params;
  const supabase = supabasePublic();

  const { data: cityRaw } = await supabase
    .from("cities")
    .select("id,name,slug,country,timezone,latitude,longitude")
    .eq("slug", city)
    .eq("is_active", true)
    .maybeSingle();

  const cityRow = cityRaw as CityRow | null;

  if (!cityRow) notFound();

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const { data: overrideRaw } = await supabase
    .from("city_prayer_times")
    .select(
      "fajr_start,sunrise,dhuhr_start,asr_start,maghrib_start,isha_start,created_at"
    )
    .eq("city_id", cityRow.id)
    .eq("month", month)
    .eq("year", year)
    .maybeSingle();

  let prayerTimes: PrayerTimesResult | null = null;
  let source = "Unavailable";

  if (overrideRaw) {
    const override = overrideRaw as PrayerTimesOverrideRow;

    prayerTimes = {
      fajr_start: override.fajr_start,
      sunrise: override.sunrise,
      dhuhr_start: override.dhuhr_start,
      asr_start: override.asr_start,
      maghrib_start: override.maghrib_start,
      isha_start: override.isha_start,
    };

    source = "Verified local timetable";
  } else {
    prayerTimes = calculatePrayerTimesForCity({
      timezone: cityRow.timezone,
      latitude: cityRow.latitude,
      longitude: cityRow.longitude,
    });

    source = prayerTimes ? "Calculated automatically" : "Unavailable";
  }

  const prayers = [
    { name: "Fajr", time: formatTime(prayerTimes?.fajr_start), raw: prayerTimes?.fajr_start },
    { name: "Sunrise", time: formatTime(prayerTimes?.sunrise), raw: prayerTimes?.sunrise },
    { name: "Dhuhr", time: formatTime(prayerTimes?.dhuhr_start), raw: prayerTimes?.dhuhr_start },
    { name: "Asr", time: formatTime(prayerTimes?.asr_start), raw: prayerTimes?.asr_start },
    { name: "Maghrib", time: formatTime(prayerTimes?.maghrib_start), raw: prayerTimes?.maghrib_start },
    { name: "Isha", time: formatTime(prayerTimes?.isha_start), raw: prayerTimes?.isha_start },
  ];

  const nextPrayer = getNextPrayer(prayers, cityRow.timezone);
  const todayLabel = getTodayLabel(cityRow.timezone);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `${cityRow.name} Prayer Times Today`,
    description: `Today's salah beginning times in ${cityRow.name}, including Fajr, Sunrise, Dhuhr, Asr, Maghrib, and Isha.`,
    url: `https://www.salahnearme.com/${cityRow.slug}/prayer-times`,
  };

  return (
    <div className="space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="rounded-3xl border border-yellow-500/20 bg-black p-8 md:p-10">
        <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
          Prayer Times
        </div>

        <h1 className="mt-3 text-4xl font-bold text-white md:text-5xl">
          {cityRow.name} Prayer Times Today
        </h1>

        <p className="mt-4 max-w-3xl text-white/70">
          View today’s salah beginning times in {cityRow.name}, including Fajr,
          Sunrise, Dhuhr, Asr, Maghrib, and Isha.
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-400">
            {source}
          </span>

          <span className="rounded-full border border-white/10 bg-black px-3 py-1 text-xs text-white/70">
            {todayLabel}
          </span>

          {cityRow.timezone && (
            <span className="rounded-full border border-white/10 bg-black px-3 py-1 text-xs text-white/70">
              {cityRow.timezone}
            </span>
          )}
        </div>
      </section>

      {nextPrayer && (
        <section className="rounded-3xl border border-yellow-500/30 bg-yellow-500/10 p-8">
          <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
            Next Salah
          </div>

          <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-4xl font-bold text-white">
                {nextPrayer.name}
              </h2>

              <p className="mt-2 text-white/70">
                The next salah time in {cityRow.name} is {nextPrayer.name}.
              </p>
            </div>

            <div className="text-5xl font-bold text-yellow-400">
              {nextPrayer.time}
            </div>
          </div>
        </section>
      )}

      <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {prayers.map((prayer) => (
            <div
              key={prayer.name}
              className={`rounded-2xl border p-6 text-center ${
                prayer.name === nextPrayer?.name
                  ? "border-yellow-500/40 bg-yellow-500/10"
                  : "border-white/10 bg-black/30"
              }`}
            >
              <div className="text-sm font-semibold text-yellow-400">
                {prayer.name}
              </div>

              <div className="mt-3 text-4xl font-bold text-white">
                {prayer.time}
              </div>

              <div className="mt-2 text-xs text-white/50">Begins</div>

              {prayer.name === nextPrayer?.name && (
                <div className="mt-3 rounded-full bg-yellow-500 px-3 py-1 text-xs font-bold text-black">
                  Next prayer
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-yellow-500/20 bg-black/30 p-8">
        <h2 className="text-3xl font-bold text-yellow-400">
          Salah times in {cityRow.name}
        </h2>

        <div className="mt-4 space-y-3 text-white/70">
          <p>
            These prayer times show the daily beginning times for the five daily
            prayers in {cityRow.name}. Muslims use these times to plan Fajr,
            Dhuhr, Asr, Maghrib, and Isha throughout the day.
          </p>

          <p>
            If a verified local timetable is available, SalahNearMe uses that
            local source. Otherwise, times may be calculated automatically using
            the city’s coordinates and timezone.
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Link
          href={`/${cityRow.slug}`}
          className="rounded-2xl border border-yellow-500/20 bg-black/30 p-5 text-yellow-400 hover:border-yellow-400/50"
        >
          Back to {cityRow.name}
        </Link>

        <Link
          href={`/${cityRow.slug}/mosques`}
          className="rounded-2xl border border-yellow-500/20 bg-black/30 p-5 text-yellow-400 hover:border-yellow-400/50"
        >
          Mosques in {cityRow.name}
        </Link>

        <Link
          href={`/${cityRow.slug}/businesses`}
          className="rounded-2xl border border-yellow-500/20 bg-black/30 p-5 text-yellow-400 hover:border-yellow-400/50"
        >
          Halal businesses in {cityRow.name}
        </Link>
      </section>
    </div>
  );
}