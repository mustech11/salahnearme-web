"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

type PrayerItem = {
  name: string;
  shortName: string;
  value: string | null;
};

type LocationState =
  | {
      type: "idle";
      message: null;
    }
  | {
      type: "loading" | "success" | "error";
      message: string;
    };

const DEFAULT_TIMEZONE = "Europe/London";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
const REQUEST_TIMEOUT_MS = 15_000;

function cleanString(value: unknown, maxLength = 180): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function cleanSlug(value: unknown): string {
  return cleanString(value, 160)
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

function formatDisplayTime(value: string | null | undefined): string {
  const cleaned = cleanString(value, 20);

  return cleaned ? cleaned.slice(0, 5) : "—";
}

function getPrayerItems(prayerTimes: PrayerTimes): PrayerItem[] {
  return [
    {
      name: "Fajr",
      shortName: "Fajr",
      value: prayerTimes?.fajr_start ?? null,
    },
    {
      name: "Sunrise",
      shortName: "Rise",
      value: prayerTimes?.sunrise ?? null,
    },
    {
      name: "Dhuhr",
      shortName: "Dhuhr",
      value: prayerTimes?.dhuhr_start ?? null,
    },
    {
      name: "Asr",
      shortName: "Asr",
      value: prayerTimes?.asr_start ?? null,
    },
    {
      name: "Maghrib",
      shortName: "Maghrib",
      value: prayerTimes?.maghrib_start ?? null,
    },
    {
      name: "Isha",
      shortName: "Isha",
      value: prayerTimes?.isha_start ?? null,
    },
  ];
}

function getSourceDetails(source: PrayerTimesSource) {
  if (source === "manual_override") {
    return {
      label: "Verified local timetable",
      description: "Local timetable data is available for this city.",
      className:
        "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    };
  }

  if (source === "calculated") {
    return {
      label: "Calculated automatically",
      description: "Calculated from the city coordinates and timezone.",
      className:
        "border-yellow-500/30 bg-yellow-500/10 text-yellow-300",
    };
  }

  return {
    label: "Times unavailable",
    description: "Choose a supported city to display prayer times.",
    className: "border-white/10 bg-white/5 text-white/55",
  };
}

function formatUpdatedAt(
  value: string | null | undefined,
  timezone: string
): string | null {
  const cleaned = cleanString(value, 80);

  if (!cleaned) {
    return null;
  }

  const date = new Date(cleaned);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: timezone,
    }).format(date);
  } catch {
    return null;
  }
}

function setSelectedCityCookie(slug: string) {
  document.cookie = [
    `snm_city=${encodeURIComponent(slug)}`,
    "path=/",
    `max-age=${COOKIE_MAX_AGE_SECONDS}`,
    "samesite=lax",
    window.location.protocol === "https:" ? "secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

function getNearestCityFromResponse(
  data: NearestCityApiResponse
): City | null {
  const nestedCity = data.city ?? data.nearest_city ?? null;

  const slug =
    cleanSlug(nestedCity?.slug) ||
    cleanSlug(data.slug);

  if (!slug) {
    return null;
  }

  const name =
    cleanString(nestedCity?.name, 180) ||
    cleanString(data.name, 180) ||
    slug
      .split("-")
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

  const timezone =
    cleanString(nestedCity?.timezone, 120) ||
    cleanString(data.timezone, 120) ||
    DEFAULT_TIMEZONE;

  return {
    slug,
    name,
    timezone,
  };
}

function getGeolocationErrorMessage(
  error: GeolocationPositionError
): string {
  if (error.code === error.PERMISSION_DENIED) {
    return "Location permission was blocked. Choose your city from the menu instead.";
  }

  if (error.code === error.POSITION_UNAVAILABLE) {
    return "Your location could not be detected. Choose your city manually.";
  }

  if (error.code === error.TIMEOUT) {
    return "Location detection timed out. Please try again.";
  }

  return "Your location could not be detected.";
}

function getNextPrayer(
  items: PrayerItem[],
  timezone: string
): PrayerItem | null {
  const validItems = items.filter((item) => {
    return /^\d{1,2}:\d{2}/.test(cleanString(item.value, 20));
  });

  if (validItems.length === 0) {
    return null;
  }

  let currentMinutes = 0;

  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: timezone,
    }).formatToParts(new Date());

    const hour = Number(
      parts.find((part) => part.type === "hour")?.value ?? 0
    );

    const minute = Number(
      parts.find((part) => part.type === "minute")?.value ?? 0
    );

    currentMinutes = hour * 60 + minute;
  } catch {
    const now = new Date();
    currentMinutes = now.getHours() * 60 + now.getMinutes();
  }

  const next = validItems.find((item) => {
    const [hourText, minuteText] = cleanString(item.value, 20).split(":");
    const hour = Number(hourText);
    const minute = Number(minuteText);

    return hour * 60 + minute > currentMinutes;
  });

  return next ?? validItems[0] ?? null;
}

export default function SelectedCityHomePanel({
  city = null,
  prayerTimes,
  prayerTimesSource = "unavailable",
  prayerTimesUpdatedAt = null,
}: Props) {
  const router = useRouter();
  const mountedRef = useRef(true);

  const cityName = cleanString(city?.name, 180) || "Your nearest city";
  const citySlug = cleanSlug(city?.slug);
  const timezone =
    cleanString(city?.timezone, 120) || DEFAULT_TIMEZONE;

  const [timeString, setTimeString] = useState("");
  const [dateString, setDateString] = useState("");
  const [locationState, setLocationState] = useState<LocationState>({
    type: "idle",
    message: null,
  });

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    function updateClock() {
      try {
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
      } catch {
        const now = new Date();

        setTimeString(
          now.toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })
        );

        setDateString(
          now.toLocaleDateString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })
        );
      }
    }

    updateClock();

    const timer = window.setInterval(updateClock, 1_000);

    return () => window.clearInterval(timer);
  }, [timezone]);

  const useMyLocation = useCallback(() => {
    if (locationState.type === "loading") {
      return;
    }

    if (!("geolocation" in navigator)) {
      setLocationState({
        type: "error",
        message:
          "Your browser does not support location detection. Choose your city manually.",
      });

      return;
    }

    setLocationState({
      type: "loading",
      message: "Finding your nearest SalahNearMe city...",
    });

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const controller = new AbortController();
        const timeout = window.setTimeout(
          () => controller.abort(),
          REQUEST_TIMEOUT_MS
        );

        try {
          const params = new URLSearchParams({
            lat: position.coords.latitude.toString(),
            lng: position.coords.longitude.toString(),
          });

          const response = await fetch(
            `/api/travel/nearest-city?${params.toString()}`,
            {
              method: "GET",
              headers: {
                Accept: "application/json",
              },
              cache: "no-store",
              credentials: "same-origin",
              signal: controller.signal,
            }
          );

          const data = (await response.json().catch(() => null)) as
            | NearestCityApiResponse
            | null;

          if (!mountedRef.current) {
            return;
          }

          if (!response.ok || !data) {
            setLocationState({
              type: "error",
              message:
                cleanString(data?.error, 300) ||
                "Your nearest city could not be found.",
            });

            return;
          }

          const nearestCity = getNearestCityFromResponse(data);

          if (!nearestCity) {
            setLocationState({
              type: "error",
              message:
                "No supported city was found near your location.",
            });

            return;
          }

          setSelectedCityCookie(nearestCity.slug);

          setLocationState({
            type: "success",
            message: `Nearest city selected: ${nearestCity.name}`,
          });

          router.refresh();
        } catch (error) {
          if (!mountedRef.current) {
            return;
          }

          setLocationState({
            type: "error",
            message:
              error instanceof DOMException &&
              error.name === "AbortError"
                ? "Location lookup timed out. Please try again."
                : "Your nearest city could not be loaded.",
          });
        } finally {
          window.clearTimeout(timeout);
        }
      },
      (error) => {
        if (!mountedRef.current) {
          return;
        }

        setLocationState({
          type: "error",
          message: getGeolocationErrorMessage(error),
        });
      },
      {
        enableHighAccuracy: false,
        timeout: 12_000,
        maximumAge: 10 * 60 * 1_000,
      }
    );
  }, [locationState.type, router]);

  const prayerItems = useMemo(
    () => getPrayerItems(prayerTimes),
    [prayerTimes]
  );

  const hasAnyPrayerTime = prayerItems.some((item) => Boolean(item.value));

  const sourceDetails = useMemo(
    () => getSourceDetails(prayerTimesSource),
    [prayerTimesSource]
  );

  const formattedUpdatedAt = useMemo(
    () => formatUpdatedAt(prayerTimesUpdatedAt, timezone),
    [prayerTimesUpdatedAt, timezone]
  );

  const nextPrayer = useMemo(
    () => getNextPrayer(prayerItems, timezone),
    [prayerItems, timezone, timeString]
  );

  const isLocationLoading = locationState.type === "loading";

  return (
    <section
      aria-labelledby="selected-city-heading"
      className="premium-panel rounded-[2rem] p-5 sm:p-7"
    >
      <div className="grid gap-5 lg:grid-cols-[0.82fr_1.18fr]">
        <div className="premium-inset rounded-3xl p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="section-kicker">Your local SalahNearMe</div>

              <h2
                id="selected-city-heading"
                className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl"
              >
                {city ? cityName : "Personalise your homepage"}
              </h2>
            </div>

            <span className="premium-badge">
              {city ? timezone : "Location ready"}
            </span>
          </div>

          <p className="mt-3 max-w-xl text-sm leading-7 text-white/60">
            {city
              ? `Prayer times, mosques and halal places for ${cityName}, presented in one compact daily view.`
              : "Use your location once or choose a city from the navigation to personalise SalahNearMe."}
          </p>

          <div className="mt-5 grid grid-cols-[1fr_auto] gap-3 rounded-2xl border border-white/10 bg-black/30 p-4">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.18em] text-yellow-400">
                Local time
              </div>

              <div className="mt-1 text-3xl font-black text-white">
                {timeString || "—"}
              </div>

              <div className="mt-1 text-xs text-white/45">
                {dateString || "—"}
              </div>
            </div>

            {nextPrayer ? (
              <div className="min-w-[110px] rounded-2xl border border-yellow-400/25 bg-yellow-400/10 px-4 py-3 text-right">
                <div className="text-[0.65rem] font-black uppercase tracking-[0.17em] text-yellow-300">
                  Next
                </div>

                <div className="mt-1 text-sm font-black text-white">
                  {nextPrayer.name}
                </div>

                <div className="mt-0.5 text-xl font-black text-yellow-300">
                  {formatDisplayTime(nextPrayer.value)}
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={useMyLocation}
              disabled={isLocationLoading}
              className="premium-button px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLocationLoading ? "Finding city..." : "Use my location"}
            </button>

            {citySlug ? (
              <>
                <Link
                  href={`/${citySlug}`}
                  className="premium-button-outline px-4 py-2.5 text-sm"
                >
                  City page
                </Link>

                <Link
                  href={`/${citySlug}/mosques`}
                  className="premium-button-outline px-4 py-2.5 text-sm"
                >
                  Mosques
                </Link>

                <Link
                  href={`/${citySlug}/businesses`}
                  className="premium-button-outline px-4 py-2.5 text-sm"
                >
                  Halal places
                </Link>
              </>
            ) : (
              <Link
                href="/near-me/pray"
                className="premium-button-outline px-4 py-2.5 text-sm"
              >
                Pray Near Me
              </Link>
            )}
          </div>

          {locationState.message ? (
            <div
              role={locationState.type === "error" ? "alert" : "status"}
              className={[
                "mt-4 rounded-2xl border p-3 text-sm leading-6",
                locationState.type === "success"
                  ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-200"
                  : locationState.type === "error"
                    ? "border-red-500/25 bg-red-500/10 text-red-200"
                    : "border-yellow-500/20 bg-yellow-500/10 text-yellow-100",
              ].join(" ")}
            >
              {locationState.message}
            </div>
          ) : null}
        </div>

        <div className="premium-inset rounded-3xl p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.24em] text-yellow-400">
                Today&apos;s beginning times
              </div>

              <h3 className="mt-2 text-xl font-black text-white">
                {city ? `${cityName} prayer times` : "Select your city"}
              </h3>
            </div>

            <div
              className={`w-fit rounded-full border px-3 py-1.5 text-xs font-bold ${sourceDetails.className}`}
            >
              {sourceDetails.label}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {prayerItems.map((item) => {
              const isNext =
                nextPrayer?.name === item.name &&
                hasAnyPrayerTime;

              return (
                <div
                  key={item.name}
                  className={[
                    "rounded-2xl border px-2 py-3 text-center transition",
                    isNext
                      ? "border-yellow-400/45 bg-yellow-400/12 shadow-[0_0_24px_rgba(212,175,55,0.08)]"
                      : "border-white/10 bg-black/25",
                  ].join(" ")}
                >
                  <div className="text-[0.64rem] font-black uppercase tracking-[0.13em] text-yellow-400">
                    {item.shortName}
                  </div>

                  <div className="mt-1.5 text-lg font-black text-white">
                    {formatDisplayTime(item.value)}
                  </div>

                  {isNext ? (
                    <div className="mt-1 text-[0.6rem] font-bold text-yellow-300">
                      Next
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
            <div className="text-xs leading-5 text-white/45">
              {sourceDetails.description}
              {formattedUpdatedAt
                ? ` Last updated ${formattedUpdatedAt}.`
                : ""}
            </div>

            {citySlug ? (
              <Link
                href={`/${citySlug}/prayer-times`}
                className="text-xs font-bold text-yellow-300 hover:text-yellow-100"
              >
                View full timetable →
              </Link>
            ) : null}
          </div>

          {!hasAnyPrayerTime ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm leading-6 text-white/55">
              Prayer times will appear here once a city is selected or detected.
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}