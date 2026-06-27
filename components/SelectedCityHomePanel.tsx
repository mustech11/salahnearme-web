"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Props = {
  city: {
    name: string;
    slug: string;
    timezone?: string | null;
  };
  prayerTimes: {
    fajr_start: string | null;
    sunrise: string | null;
    dhuhr_start: string | null;
    asr_start: string | null;
    maghrib_start: string | null;
    isha_start: string | null;
  } | null;
  prayerTimesSource?: "manual_override" | "calculated" | "unavailable";
  prayerTimesUpdatedAt?: string | null;
};

function formatDisplayTime(value: string | null | undefined) {
  if (!value) return "—";
  return value.slice(0, 5);
}

function getPrayerItems(
  prayerTimes: Props["prayerTimes"]
): Array<{ name: string; value: string | null }> {
  return [
    { name: "Fajr", value: prayerTimes?.fajr_start ?? null },
    { name: "Sunrise", value: prayerTimes?.sunrise ?? null },
    { name: "Dhuhr", value: prayerTimes?.dhuhr_start ?? null },
    { name: "Asr", value: prayerTimes?.asr_start ?? null },
    { name: "Maghrib", value: prayerTimes?.maghrib_start ?? null },
    { name: "Isha", value: prayerTimes?.isha_start ?? null },
  ];
}

function getSourceLabel(source: Props["prayerTimesSource"]) {
  if (source === "manual_override") {
    return {
      text: "Verified local override",
      className: "border-green-500/30 bg-green-500/10 text-green-300",
    };
  }

  if (source === "calculated") {
    return {
      text: "Calculated automatically",
      className: "border-yellow-500/30 bg-yellow-500/10 text-yellow-400",
    };
  }

  return {
    text: "Times unavailable",
    className: "border-white/10 bg-black/30 text-white/60",
  };
}

function getSourceDescription(source: Props["prayerTimesSource"]) {
  if (source === "manual_override") {
    return "Uses a locally stored monthly timetable for this city.";
  }

  if (source === "calculated") {
    return "Uses city coordinates and timezone when no local monthly override is available.";
  }

  return "Prayer times are not currently available for this city.";
}

function formatUpdatedAt(value: string | null | undefined, timezone: string) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
  }).format(date);
}

export default function SelectedCityHomePanel({
  city,
  prayerTimes,
  prayerTimesSource = "unavailable",
  prayerTimesUpdatedAt = null,
}: Props) {
  const timezone = city.timezone || "Europe/London";
  const [timeString, setTimeString] = useState("");
  const [dateString, setDateString] = useState("");

  useEffect(() => {
    function updateClock() {
      const now = new Date();

      setTimeString(
        new Intl.DateTimeFormat("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
          timeZone: timezone,
        }).format(now)
      );

      setDateString(
        new Intl.DateTimeFormat("en-GB", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
          timeZone: timezone,
        }).format(now)
      );
    }

    updateClock();
    const timer = window.setInterval(updateClock, 1000);

    return () => window.clearInterval(timer);
  }, [timezone]);

  const prayerItems = useMemo(() => getPrayerItems(prayerTimes), [prayerTimes]);
  const hasAnyPrayerTime = prayerItems.some((item) => item.value);
  const sourceBadge = getSourceLabel(prayerTimesSource);
  const sourceDescription = getSourceDescription(prayerTimesSource);
  const formattedUpdatedAt = formatUpdatedAt(prayerTimesUpdatedAt, timezone);

  return (
    <section className="rounded-3xl border border-green-500/20 bg-[rgb(var(--card))] p-8">
      <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
        <div>
          <div className="inline-flex rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-green-300">
            Selected city
          </div>

          <h2 className="mt-4 text-3xl font-bold text-white md:text-4xl">
            {city.name}
          </h2>

          <p className="mt-3 max-w-2xl text-white/70">
            Quick daily access for prayer times, mosques, halal businesses, and
            trusted Muslim community information in {city.name}.
          </p>

          <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-yellow-400">
                  Local time
                </div>
                <div className="mt-2 text-3xl font-bold text-white md:text-4xl">
                  {timeString || "—"}
                </div>
                <div className="mt-2 text-sm text-white/60">
                  {dateString || "—"}
                </div>
              </div>

              <div className="rounded-full border border-white/10 bg-[rgb(var(--card))] px-3 py-1 text-xs text-white/60">
                {timezone}
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`/${city.slug}`}
              className="rounded-xl bg-yellow-500 px-4 py-3 text-sm font-semibold text-black transition hover:bg-yellow-400"
            >
              Open city page
            </Link>

            <Link
              href={`/${city.slug}/mosques`}
              className="rounded-xl border border-yellow-500/30 bg-black px-4 py-3 text-sm font-semibold text-yellow-400 transition hover:bg-yellow-500/10"
            >
              Browse mosques
            </Link>

            <Link
              href={`/${city.slug}/businesses`}
              className="rounded-xl border border-yellow-500/30 bg-black px-4 py-3 text-sm font-semibold text-yellow-400 transition hover:bg-yellow-500/10"
            >
              Browse halal businesses
            </Link>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-2xl font-semibold text-yellow-400">
                Today’s beginning times
              </div>
              <p className="mt-2 text-sm text-white/60">
                Daily salah beginning times for {city.name}.
              </p>
            </div>

            <div className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-400">
              Home view
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${sourceBadge.className}`}
            >
              {sourceBadge.text}
            </div>

            {prayerTimesSource === "manual_override" && formattedUpdatedAt && (
              <div className="text-xs text-white/60">
                Last updated: {formattedUpdatedAt}
              </div>
            )}
          </div>

          <div className="mt-2 text-xs text-white/50">
            {sourceDescription}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {prayerItems.map((item) => (
              <div
                key={item.name}
                className="rounded-2xl border border-white/10 bg-black/30 p-4 text-center"
              >
                <div className="text-sm font-semibold text-yellow-400">
                  {item.name}
                </div>
                <div className="mt-2 text-xl font-bold text-white">
                  {formatDisplayTime(item.value)}
                </div>
                <div className="mt-1 text-xs text-white/50">Begins</div>
              </div>
            ))}
          </div>

          {!hasAnyPrayerTime && (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/60">
              Prayer times for this city are not available yet. You can still
              browse the city page, mosques, and halal businesses while this is
              being populated.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

