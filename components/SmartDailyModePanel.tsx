"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

type CityPayload = {
  id?: number | string;
  name?: string | null;
  slug?: string | null;
  country?: string | null;
  timezone?: string | null;
};

type DailyContext = {
  mode?: string | null;
  message?: string | null;
  is_friday?: boolean;
  is_ramadan?: boolean;
};

type PrayerPayload = {
  current_prayer?: string | null;
  current_prayer_label?: string | null;
  next_prayer?: string | null;
  next_prayer_label?: string | null;
  next_prayer_time?: string | null;
  minutes_until_next?: number | null;
};

type MosquePayload = {
  id?: string | number;
  name?: string | null;
  slug?: string | null;
  city?: string | null;
  area?: string | null;
  address?: string | null;
  distance_km?: number | null;
  trust_score?: number | null;
};

type BusinessPayload = {
  id?: string | number;
  name?: string | null;
  slug?: string | null;
  category?: string | null;
  city?: string | null;
  area?: string | null;
  distance_km?: number | null;
  is_featured?: boolean | null;
};

type HadithPayload = {
  text?: string | null;
  source?: string | null;
  reference?: string | null;
};

type DailyModeResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  city?: CityPayload | null;
  daily_context?: DailyContext | null;
  prayer?: PrayerPayload | null;
  recommended_mosque?: MosquePayload | null;
  nearby_mosques?: MosquePayload[] | null;
  featured_business?: BusinessPayload | null;
  recommended_businesses?: BusinessPayload[] | null;
  daily_hadith?: HadithPayload | null;
  generated_at?: string | null;
};

type Props = {
  citySlug?: string | null;
  className?: string;
};

type LoadState =
  | "idle"
  | "loading"
  | "success"
  | "error";

const REQUEST_TIMEOUT_MS = 20_000;
const REFRESH_INTERVAL_MS = 60_000;

function cleanText(
  value: unknown,
  maxLength = 500
): string {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function isSafeSlug(
  value: string
): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(
    value
  );
}

function buildApiUrl(
  citySlug?: string | null
): string {
  const params =
    new URLSearchParams();

  const cleanSlug =
    cleanText(
      citySlug,
      160
    ).toLowerCase();

  if (
    cleanSlug &&
    isSafeSlug(cleanSlug)
  ) {
    params.set(
      "city",
      cleanSlug
    );
  }

  const query =
    params.toString();

  return query
    ? `/api/daily-mode?${query}`
    : "/api/daily-mode";
}

function formatPrayer(
  value?: string | null
): string {
  const cleaned =
    cleanText(
      value,
      100
    );

  if (!cleaned) {
    return "Prayer";
  }

  return cleaned
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map(
      (part) =>
        part.charAt(0).toUpperCase() +
        part.slice(1)
    )
    .join(" ");
}

function formatDistance(
  value?: number | null
): string | null {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0
  ) {
    return null;
  }

  return `${value.toFixed(
    value < 10 ? 1 : 0
  )} km`;
}

function firstUsefulBusiness(
  items?: BusinessPayload[] | null
): BusinessPayload | null {
  if (
    !Array.isArray(items) ||
    items.length === 0
  ) {
    return null;
  }

  return (
    items.find(
      (item) =>
        item.is_featured === true
    ) ??
    items.find(
      (item) =>
        Boolean(
          cleanText(
            item.slug,
            200
          )
        )
    ) ??
    items[0] ??
    null
  );
}

function getSafeHref(
  slug: string,
  prefix: string,
  fallback: string
): string {
  if (
    !slug ||
    !isSafeSlug(slug)
  ) {
    return fallback;
  }

  return `${prefix}${encodeURIComponent(
    slug
  )}`;
}

function formatUpdatedTime(
  value: string | null
): string | null {
  if (!value) {
    return null;
  }

  const parsed =
    new Date(value);

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return null;
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }
  ).format(parsed);
}

async function readResponse(
  response: Response
): Promise<DailyModeResponse | null> {
  try {
    const value: unknown =
      await response.json();

    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value)
    ) {
      return null;
    }

    return value as DailyModeResponse;
  } catch {
    return null;
  }
}

export default function SmartDailyModePanel({
  citySlug,
  className = "",
}: Props) {
  const headingId =
    useId();

  const statusId =
    useId();

  const abortControllerRef =
    useRef<AbortController | null>(
      null
    );

  const mountedRef =
    useRef(false);

  /*
   * Keep the server render and first client render identical.
   * The request starts inside useEffect after hydration.
   */
  const [
    loadState,
    setLoadState,
  ] =
    useState<LoadState>(
      "idle"
    );

  const [
    data,
    setData,
  ] =
    useState<DailyModeResponse | null>(
      null
    );

  const [
    errorText,
    setErrorText,
  ] =
    useState("");

  const [
    lastUpdatedIso,
    setLastUpdatedIso,
  ] =
    useState<string | null>(
      null
    );

  const apiUrl =
    useMemo(
      () =>
        buildApiUrl(
          citySlug
        ),
      [citySlug]
    );

  const isLoading =
    loadState === "loading";

  const hasLoaded =
    loadState === "success";

  const hasError =
    loadState === "error";

  const loadDailyMode =
    useCallback(
      async () => {
        abortControllerRef.current?.abort();

        const controller =
          new AbortController();

        abortControllerRef.current =
          controller;

        let timedOut =
          false;

        const timeoutId =
          window.setTimeout(
            () => {
              timedOut = true;
              controller.abort();
            },
            REQUEST_TIMEOUT_MS
          );

        if (
          mountedRef.current
        ) {
          setLoadState(
            "loading"
          );

          setErrorText(
            ""
          );
        }

        try {
          const response =
            await fetch(
              apiUrl,
              {
                method: "GET",
                headers: {
                  Accept:
                    "application/json",
                },
                credentials:
                  "same-origin",
                cache:
                  "no-store",
                signal:
                  controller.signal,
              }
            );

          const json =
            await readResponse(
              response
            );

          if (
            !mountedRef.current ||
            controller.signal.aborted
          ) {
            return;
          }

          if (
            !response.ok ||
            json?.ok !== true
          ) {
            setData(null);

            setErrorText(
              cleanText(
                json?.error,
                300
              ) ||
                cleanText(
                  json?.message,
                  300
                ) ||
                "Smart Daily Mode is warming up."
            );

            setLoadState(
              "error"
            );

            return;
          }

          setData(json);

          setErrorText(
            ""
          );

          setLastUpdatedIso(
            new Date().toISOString()
          );

          setLoadState(
            "success"
          );
        } catch (error) {
          if (
            !mountedRef.current
          ) {
            return;
          }

          if (
            error instanceof DOMException &&
            error.name ===
              "AbortError"
          ) {
            if (!timedOut) {
              return;
            }

            setErrorText(
              "Smart Daily Mode took too long to load."
            );
          } else {
            console.error(
              "Smart Daily Mode request failed:",
              error
            );

            setErrorText(
              "Smart Daily Mode is temporarily unavailable."
            );
          }

          setData(null);

          setLoadState(
            "error"
          );
        } finally {
          window.clearTimeout(
            timeoutId
          );

          if (
            abortControllerRef.current ===
            controller
          ) {
            abortControllerRef.current =
              null;
          }
        }
      },
      [apiUrl]
    );

  useEffect(() => {
    mountedRef.current =
      true;

    void loadDailyMode();

    const intervalId =
      window.setInterval(
        () => {
          if (
            document.visibilityState ===
            "visible"
          ) {
            void loadDailyMode();
          }
        },
        REFRESH_INTERVAL_MS
      );

    function handleVisibilityChange() {
      if (
        document.visibilityState ===
        "visible"
      ) {
        void loadDailyMode();
      }
    }

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    return () => {
      mountedRef.current =
        false;

      window.clearInterval(
        intervalId
      );

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );

      abortControllerRef.current?.abort();

      abortControllerRef.current =
        null;
    };
  }, [loadDailyMode]);

  const city =
    data?.city;

  const dailyContext =
    data?.daily_context;

  const prayer =
    data?.prayer;

  const mosque =
    data?.recommended_mosque ??
    data?.nearby_mosques?.[0] ??
    null;

  const business =
    data?.featured_business ??
    firstUsefulBusiness(
      data?.recommended_businesses
    );

  const cityName =
    cleanText(
      city?.name,
      160
    ) ||
    "your area";

  const citySlugSafe =
    cleanText(
      city?.slug,
      160
    ).toLowerCase();

  const mosqueSlugSafe =
    cleanText(
      mosque?.slug,
      200
    ).toLowerCase();

  const businessSlugSafe =
    cleanText(
      business?.slug,
      200
    ).toLowerCase();

  const cityHref =
    getSafeHref(
      citySlugSafe,
      "/",
      "/near-me/pray"
    );

  const mosqueHref =
    getSafeHref(
      mosqueSlugSafe,
      "/mosque/",
      "/near-me/pray"
    );

  const businessHref =
    getSafeHref(
      businessSlugSafe,
      "/business/",
      "/businesses"
    );

  const currentPrayer =
    cleanText(
      prayer?.current_prayer_label,
      100
    ) ||
    formatPrayer(
      prayer?.current_prayer
    );

  const nextPrayer =
    cleanText(
      prayer?.next_prayer_label,
      100
    ) ||
    formatPrayer(
      prayer?.next_prayer
    );

  const mosqueDistance =
    formatDistance(
      mosque?.distance_km
    );

  const businessDistance =
    formatDistance(
      business?.distance_km
    );

  const updatedTime =
    formatUpdatedTime(
      lastUpdatedIso
    );

  return (
    <section
      aria-labelledby={
        headingId
      }
      className={[
        "rounded-[2rem] border border-yellow-500/20",
        "bg-[#020617]/80 p-6 shadow-2xl shadow-black/30 md:p-8",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch lg:justify-between">
        <div className="max-w-3xl">
          <div className="text-xs font-black uppercase tracking-[0.35em] text-yellow-400">
            Smart Daily Mode
          </div>

          <h2
            id={headingId}
            className="mt-4 text-3xl font-black tracking-tight text-white md:text-5xl"
          >
            Your Muslim day,
            intelligently organised
          </h2>

          <p className="mt-4 max-w-2xl text-base leading-8 text-white/70 md:text-lg">
            SalahNearMe checks prayer
            context, city signals,
            nearby mosques, halal
            businesses, Friday
            guidance and daily
            reminders.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/near-me/pray"
              className="rounded-2xl bg-yellow-400 px-5 py-3 text-sm font-black text-black transition hover:bg-yellow-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-200"
            >
              Find mosque near me
            </Link>

            <Link
              href={cityHref}
              className="rounded-2xl border border-yellow-500/30 bg-black px-5 py-3 text-sm font-black text-yellow-400 transition hover:border-yellow-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"
            >
              View {cityName}
            </Link>

            <Link
              href="/businesses"
              className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              Halal businesses
            </Link>
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-yellow-500/20 bg-black/40 p-5 lg:w-[360px]">
          <div className="text-sm font-black text-yellow-400">
            Today&apos;s signal
          </div>

          <div
            id={statusId}
            aria-live="polite"
            aria-atomic="true"
          >
            {loadState ===
            "idle" ? (
              <div
                className="mt-4 space-y-3"
                aria-hidden="true"
              >
                <div className="h-4 w-3/4 rounded bg-white/10" />

                <div className="h-4 w-1/2 rounded bg-white/10" />

                <div className="h-4 w-2/3 rounded bg-white/10" />
              </div>
            ) : null}

            {isLoading ? (
              <div
                className="mt-4 space-y-3"
                aria-busy="true"
              >
                <div className="h-4 w-3/4 animate-pulse rounded bg-white/10" />

                <div className="h-4 w-1/2 animate-pulse rounded bg-white/10" />

                <div className="h-4 w-2/3 animate-pulse rounded bg-white/10" />
              </div>
            ) : null}

            {hasError ? (
              <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
                <p className="text-sm leading-7 text-red-100">
                  {errorText}
                </p>
              </div>
            ) : null}

            {hasLoaded ? (
              <div className="mt-4 space-y-4">
                <SignalCard
                  label="Area"
                  value={cityName}
                />

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="text-xs uppercase tracking-[0.25em] text-white/40">
                    Prayer context
                  </div>

                  <div className="mt-1 text-lg font-black text-white">
                    {currentPrayer}
                  </div>

                  <div className="mt-1 text-sm text-white/60">
                    Next:{" "}
                    {nextPrayer}

                    {prayer?.next_prayer_time
                      ? ` at ${cleanText(
                          prayer.next_prayer_time,
                          40
                        )}`
                      : ""}
                  </div>

                  {typeof prayer?.minutes_until_next ===
                    "number" &&
                  Number.isFinite(
                    prayer.minutes_until_next
                  ) &&
                  prayer.minutes_until_next >=
                    0 ? (
                    <div className="mt-2 text-xs font-bold text-yellow-300">
                      {Math.trunc(
                        prayer.minutes_until_next
                      )}{" "}
                      minutes until{" "}
                      {nextPrayer}
                    </div>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="text-xs uppercase tracking-[0.25em] text-white/40">
                    Daily mode
                  </div>

                  <div className="mt-1 text-sm leading-7 text-white/70">
                    {cleanText(
                      dailyContext?.message,
                      1_000
                    ) ||
                      "Prepare for your next salah and discover what is nearby."}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {dailyContext?.is_friday ===
                    true ? (
                      <StatusBadge>
                        Jumuʿah
                      </StatusBadge>
                    ) : null}

                    {dailyContext?.is_ramadan ===
                    true ? (
                      <StatusBadge>
                        Ramadan
                      </StatusBadge>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {updatedTime ? (
            <p className="mt-4 text-xs text-white/35">
              Updated{" "}
              {updatedTime}
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => {
              void loadDailyMode();
            }}
            disabled={
              isLoading === true
            }
            aria-disabled={
              isLoading === true
            }
            aria-busy={
              isLoading === true
            }
            className="mt-4 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white/65 transition hover:border-yellow-500/30 hover:text-yellow-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading
              ? "Refreshing…"
              : hasError
                ? "Retry daily mode"
                : "Refresh daily mode"}
          </button>
        </div>
      </div>

      {hasLoaded ? (
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Link
            href={mosqueHref}
            className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-yellow-400/50 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"
          >
            <div className="text-xs font-black uppercase tracking-[0.3em] text-yellow-400">
              Recommended mosque
            </div>

            <div className="mt-3 text-xl font-black text-white">
              {cleanText(
                mosque?.name,
                200
              ) ||
                "Find a mosque near you"}
            </div>

            <div className="mt-2 text-sm text-white/60">
              {cleanText(
                mosque?.area,
                120
              ) ||
                cleanText(
                  mosque?.city,
                  120
                ) ||
                cityName}

              {mosqueDistance
                ? ` • ${mosqueDistance}`
                : ""}
            </div>

            {typeof mosque?.trust_score ===
              "number" &&
            Number.isFinite(
              mosque.trust_score
            ) ? (
              <div className="mt-3 text-xs font-bold text-emerald-300">
                Trust score:{" "}
                {Math.max(
                  0,
                  Math.min(
                    100,
                    Math.round(
                      mosque.trust_score
                    )
                  )
                )}
                /100
              </div>
            ) : null}
          </Link>

          <Link
            href={businessHref}
            className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-yellow-400/50 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"
          >
            <div className="text-xs font-black uppercase tracking-[0.3em] text-yellow-400">
              Halal nearby
            </div>

            <div className="mt-3 text-xl font-black text-white">
              {cleanText(
                business?.name,
                200
              ) ||
                "Discover halal places"}
            </div>

            <div className="mt-2 text-sm text-white/60">
              {cleanText(
                business?.category,
                120
              ) ||
                "Halal business"}

              {businessDistance
                ? ` • ${businessDistance}`
                : ""}
            </div>

            {business?.is_featured ===
            true ? (
              <div className="mt-3">
                <StatusBadge>
                  Featured
                </StatusBadge>
              </div>
            ) : null}
          </Link>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="text-xs font-black uppercase tracking-[0.3em] text-yellow-400">
              Daily reminder
            </div>

            <div className="mt-3 text-sm leading-7 text-white/70">
              {cleanText(
                data?.daily_hadith?.text,
                2_000
              ) ||
                "Return daily for prayer-aware guidance, local halal discovery and community signals."}
            </div>

            {data?.daily_hadith?.source ? (
              <div className="mt-3 text-xs font-bold text-white/40">
                {cleanText(
                  data.daily_hadith.source,
                  300
                )}

                {data.daily_hadith.reference
                  ? ` • ${cleanText(
                      data.daily_hadith.reference,
                      200
                    )}`
                  : ""}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function SignalCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="text-xs uppercase tracking-[0.25em] text-white/40">
        {label}
      </div>

      <div className="mt-1 text-lg font-black text-white">
        {value}
      </div>
    </div>
  );
}

function StatusBadge({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex rounded-full border border-yellow-500/25 bg-yellow-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-yellow-200">
      {children}
    </span>
  );
}