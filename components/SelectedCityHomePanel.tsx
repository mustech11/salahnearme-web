"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type City = {
  name: string;
  slug: string;
  timezone?: string | null;
};

type PrayerTimes = {
  fajr_start: string | null;
  sunrise: string | null;
  dhuhr_start: string | null;
  asr_start: string | null;
  maghrib_start: string | null;
  isha_start: string | null;
} | null;

type PrayerTimesSource = "manual_override" | "calculated" | "unavailable";

type Props = {
  city?: City | null;
  prayerTimes: PrayerTimes;
  prayerTimesSource?: PrayerTimesSource;
  prayerTimesUpdatedAt?: string | null;
};

type NearestCityApiResponse = {
  ok?: boolean;
  city?: {
    name?: unknown;
    slug?: unknown;
    timezone?: unknown;
  } | null;
  nearest_city?: {
    name?: unknown;
    slug?: unknown;
    timezone?: unknown;
  } | null;
  slug?: unknown;
  name?: unknown;
  timezone?: unknown;
  error?: unknown;
};

const DEFAULT_TIMEZONE = "Europe/London";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function formatDisplayTime(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  return value.slice(0, 5);
}

function getPrayerItems(prayerTimes: PrayerTimes) {
  return [
    { name: "Fajr", value: prayerTimes?.fajr_start ?? null },
    { name: "Sunrise", value: prayerTimes?.sunrise ?? null },
    { name: "Dhuhr", value: prayerTimes?.dhuhr_start ?? null },
    { name: "Asr", value: prayerTimes?.asr_start ?? null },
    { name: "Maghrib", value: prayerTimes?.maghrib_start ?? null },
    { name: "Isha", value: prayerTimes?.isha_start ?? null },
  ];
}

function getSourceLabel(source: PrayerTimesSource) {
  if (source === "manual_override") {
    return {
      text: "Verified local timetable",
      className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
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

function getSourceDescription(source: PrayerTimesSource, cityName: string) {
  if (source === "manual_override") {
    return `These times use a local monthly timetable stored for ${cityName}.`;
  }

  if (source === "calculated") {
    return `These times are calculated from the nearest city coordinates when no local monthly timetable is available.`;
  }

  return `Prayer times are not currently available for ${cityName}.`;
}

function formatUpdatedAt(value: string | null | undefined, timezone: string) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

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

function setSelectedCityCookie(slug: string) {
  document.cookie = [
    `snm_city=${encodeURIComponent(slug)}`,
    "path=/",
    `max-age=${COOKIE_MAX_AGE_SECONDS}`,
    "samesite=lax",
  ].join("; ");
}

function getNearestCityFromResponse(data: NearestCityApiResponse) {
  const city = data.city ?? data.nearest_city ?? null;

  const slug =
    cleanString(city?.slug) ||
    cleanString(data.slug);

  const name =
    cleanString(city?.name) ||
    cleanString(data.name) ||
    slug;

  const timezone =
    cleanString(city?.timezone) ||
    cleanString(data.timezone) ||
    DEFAULT_TIMEZONE;

  if (!slug) {
    return null;
  }

  return {
    slug,
    name,
    timezone,
  };
}

function getGeolocationErrorMessage(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) {
    return "Location permission was blocked. You can still choose your city manually.";
  }

  if (error.code === error.POSITION_UNAVAILABLE) {
    return "Your location could not be detected. Please choose your city manually.";
  }

  if (error.code === error.TIMEOUT) {
    return "Location detection timed out. Please try again or choose your city manually.";
  }

  return "Could not detect your location. Please choose your city manually.";
}

export default function SelectedCityHomePanel({
  city = null,
  prayerTimes,
  prayerTimesSource = "unavailable",
  prayerTimesUpdatedAt = null,
}: Props) {
  const router = useRouter();

  const cityName = city?.name ?? "your nearest city";
  const citySlug = city?.slug ?? "";
  const timezone = city?.timezone || DEFAULT_TIMEZONE;

  const [timeString, setTimeString] = useState("");
  const [dateString, setDateString] = useState("");
  const [locationStatus, setLocationStatus] = useState<string | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [detectedCity, setDetectedCity] = useState<City | null>(null);

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

  async function useMyLocation() {
    setLocationStatus(null);

    if (!("geolocation" in navigator)) {
      setLocationStatus(
        "Your browser does not support location detection. Please choose your city manually."
      );
      return;
    }

    setLocationLoading(true);
    setLocationStatus("Checking your nearest SalahNearMe city...");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;

          const res = await fetch(
            `/api/travel/nearest-city?lat=${encodeURIComponent(
              String(lat)
            )}&lng=${encodeURIComponent(String(lng))}`,
            {
              method: "GET",
              headers: {
                Accept: "application/json",
              },
              cache: "no-store",
            }
          );

          const data = (await res.json().catch(() => null)) as
            | NearestCityApiResponse
            | null;

          if (!res.ok || !data) {
            setLocationStatus(
              cleanString(data?.error) ||
                "Could not find your nearest city. Please choose your city manually."
            );
            setLocationLoading(false);
            return;
          }

          const nearestCity = getNearestCityFromResponse(data);

          if (!nearestCity) {
            setLocationStatus(
              "No matching city was found. Please choose your city manually."
            );
            setLocationLoading(false);
            return;
          }

          setDetectedCity(nearestCity);
          setSelectedCityCookie(nearestCity.slug);
          setLocationStatus(`Nearest city found: ${nearestCity.name}`);

          router.refresh();
        } catch (error) {
          console.error("homepage nearest city error:", error);
          setLocationStatus(
            "Could not detect your nearest city. Please choose your city manually."
          );
        } finally {
          setLocationLoading(false);
        }
      },
      (error) => {
        setLocationStatus(getGeolocationErrorMessage(error));
        setLocationLoading(false);
      },
      {
        enableHighAccuracy: false,
        timeout: 12000,
        maximumAge: 1000 * 60 * 10,
      }
    );
  }

  const prayerItems = useMemo(() => getPrayerItems(prayerTimes), [prayerTimes]);
  const hasAnyPrayerTime = prayerItems.some((item) => Boolean(item.value));
  const sourceBadge = getSourceLabel(prayerTimesSource);
  const sourceDescription = getSourceDescription(prayerTimesSource, cityName);
  const formattedUpdatedAt = formatUpdatedAt(prayerTimesUpdatedAt, timezone);

  return (
    <section className="overflow-hidden rounded-3xl border border-emerald-500/20 bg-[rgb(var(--card))] p-8 shadow-2xl shadow-black/20">
      <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
        <div>
          <div className="inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] text-emerald-300">
            Smart daily city
          </div>

          <h2 className="mt-4 text-3xl font-black text-white md:text-5xl">
            {city ? city.name : "Use SalahNearMe near you"}
          </h2>

          <p className="mt-4 max-w-2xl leading-8 text-white/70">
            {city
              ? `Quick daily access for salah times, mosques, halal businesses, and trusted Muslim community information in ${city.name}.`
              : "Allow location access once and SalahNearMe will match you to the nearest city available on the platform."}
          </p>

          <div className="mt-6 rounded-3xl border border-white/10 bg-black/30 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-yellow-400">
                  Local time
                </div>

                <div className="mt-2 text-3xl font-black text-white md:text-4xl">
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
            <button
              type="button"
              onClick={useMyLocation}
              disabled={locationLoading}
              className="rounded-xl bg-yellow-500 px-4 py-3 text-sm font-bold text-black transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {locationLoading ? "Finding nearest city..." : "Use my location"}
            </button>

            {citySlug && (
              <>
                <Link
                  href={`/${citySlug}`}
                  className="rounded-xl border border-yellow-500/30 bg-black px-4 py-3 text-sm font-semibold text-yellow-400 transition hover:bg-yellow-500/10"
                >
                  Open city page
                </Link>

                <Link
                  href={`/${citySlug}/mosques`}
                  className="rounded-xl border border-yellow-500/30 bg-black px-4 py-3 text-sm font-semibold text-yellow-400 transition hover:bg-yellow-500/10"
                >
                  Browse mosques
                </Link>

                <Link
                  href={`/${citySlug}/businesses`}
                  className="rounded-xl border border-yellow-500/30 bg-black px-4 py-3 text-sm font-semibold text-yellow-400 transition hover:bg-yellow-500/10"
                >
                  Browse halal businesses
                </Link>
              </>
            )}

            {!citySlug && (
              <Link
                href="/near-me/pray"
                className="rounded-xl border border-yellow-500/30 bg-black px-4 py-3 text-sm font-semibold text-yellow-400 transition hover:bg-yellow-500/10"
              >
                Open Pray Near Me
              </Link>
            )}
          </div>

          {(locationStatus || detectedCity) && (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/70">
              {locationStatus}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-2xl font-black text-yellow-400">
                Today’s beginning times
              </div>

              <p className="mt-2 text-sm text-white/60">
                {city
                  ? `Daily salah beginning times for ${city.name}.`
                  : "Select or detect your city to show today’s salah times."}
              </p>
            </div>

            <div className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-bold text-yellow-400">
              Home view
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div
              className={`rounded-full border px-3 py-1 text-xs font-bold ${sourceBadge.className}`}
            >
              {sourceBadge.text}
            </div>

            {prayerTimesSource === "manual_override" && formattedUpdatedAt && (
              <div className="text-xs text-white/60">
                Last updated: {formattedUpdatedAt}
              </div>
            )}
          </div>

          <div className="mt-2 text-xs leading-6 text-white/50">
            {sourceDescription}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {prayerItems.map((item) => (
              <div
                key={item.name}
                className="rounded-2xl border border-white/10 bg-black/30 p-4 text-center"
              >
                <div className="text-sm font-bold text-yellow-400">
                  {item.name}
                </div>

                <div className="mt-2 text-xl font-black text-white">
                  {formatDisplayTime(item.value)}
                </div>

                <div className="mt-1 text-xs text-white/50">Begins</div>
              </div>
            ))}
          </div>

          {!hasAnyPrayerTime && (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm leading-6 text-white/60">
              {city
                ? "Prayer times for this city are not available yet. You can still browse the city page, mosques, and halal businesses while this is being populated."
                : "Choose a city or use location detection to show a personalised salah-time panel on your homepage."}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}