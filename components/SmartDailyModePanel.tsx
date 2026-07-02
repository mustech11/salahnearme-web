"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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

function buildApiUrl(citySlug?: string | null) {
  const params = new URLSearchParams();

  if (citySlug) {
    params.set("city", citySlug);
  }

  const query = params.toString();

  return query ? `/api/daily-mode?${query}` : "/api/daily-mode";
}

function formatPrayer(value?: string | null) {
  if (!value) {
    return "Prayer";
  }

  return value
    .replace(/_/g, " ")
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDistance(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }

  return `${value.toFixed(value < 10 ? 1 : 0)} km`;
}

function firstUsefulBusiness(items?: BusinessPayload[] | null) {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    items.find((item) => item.is_featured) ??
    items.find((item) => item.slug) ??
    items[0]
  );
}

export default function SmartDailyModePanel({ citySlug, className = "" }: Props) {
  const [data, setData] = useState<DailyModeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);

  const apiUrl = useMemo(() => buildApiUrl(citySlug), [citySlug]);

  useEffect(() => {
    let cancelled = false;

    async function loadDailyMode() {
      try {
        setLoading(true);
        setErrorText(null);

        const response = await fetch(apiUrl, {
          method: "GET",
          cache: "no-store",
        });

        const json = (await response.json().catch(() => null)) as
          | DailyModeResponse
          | null;

        if (cancelled) {
          return;
        }

        if (!response.ok || !json?.ok) {
          setData(null);
          setErrorText("Smart Daily Mode is warming up.");
          return;
        }

        setData(json);
      } catch {
        if (!cancelled) {
          setData(null);
          setErrorText("Smart Daily Mode is temporarily unavailable.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDailyMode();

    const interval = window.setInterval(loadDailyMode, 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [apiUrl]);

  const city = data?.city;
  const dailyContext = data?.daily_context;
  const prayer = data?.prayer;
  const mosque = data?.recommended_mosque ?? data?.nearby_mosques?.[0] ?? null;
  const business =
    data?.featured_business ?? firstUsefulBusiness(data?.recommended_businesses);

  const cityName = city?.name ?? "your area";
  const cityHref = city?.slug ? `/${city.slug}` : "/near-me/pray";
  const mosqueHref = mosque?.slug ? `/mosque/${mosque.slug}` : "/near-me/pray";
  const businessHref = business?.slug
    ? `/businesses/${business.slug}`
    : "/businesses";

  const currentPrayer =
    prayer?.current_prayer_label ?? formatPrayer(prayer?.current_prayer);

  const nextPrayer =
    prayer?.next_prayer_label ?? formatPrayer(prayer?.next_prayer);

  const mosqueDistance = formatDistance(mosque?.distance_km);
  const businessDistance = formatDistance(business?.distance_km);

  return (
    <section
      className={`rounded-[2rem] border border-yellow-500/20 bg-[#020617]/80 p-6 shadow-2xl shadow-black/30 md:p-8 ${className}`}
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch lg:justify-between">
        <div className="max-w-3xl">
          <div className="text-xs font-black uppercase tracking-[0.35em] text-yellow-400">
            Smart Daily Mode
          </div>

          <h2 className="mt-4 text-3xl font-black tracking-tight text-white md:text-5xl">
            Your Muslim day, intelligently organised
          </h2>

          <p className="mt-4 max-w-2xl text-base leading-8 text-white/70 md:text-lg">
            SalahNearMe checks prayer context, city signals, nearby mosques,
            halal businesses, Friday guidance, and daily reminders to help users
            return every day.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/near-me/pray"
              className="rounded-2xl bg-yellow-400 px-5 py-3 text-sm font-black text-black transition hover:bg-yellow-300"
            >
              Find mosque near me
            </Link>

            <Link
              href={cityHref}
              className="rounded-2xl border border-yellow-500/30 bg-black px-5 py-3 text-sm font-black text-yellow-400 transition hover:border-yellow-400"
            >
              View {cityName}
            </Link>

            <Link
              href="/businesses"
              className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10"
            >
              Halal businesses
            </Link>
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-yellow-500/20 bg-black/40 p-5 lg:w-[360px]">
          <div className="text-sm font-black text-yellow-400">
            Today&apos;s signal
          </div>

          {loading ? (
            <div className="mt-4 space-y-3">
              <div className="h-4 w-3/4 animate-pulse rounded bg-white/10" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-white/10" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-white/10" />
            </div>
          ) : errorText ? (
            <p className="mt-4 text-sm leading-7 text-white/60">{errorText}</p>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-xs uppercase tracking-[0.25em] text-white/40">
                  Area
                </div>
                <div className="mt-1 text-lg font-black text-white">
                  {cityName}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-xs uppercase tracking-[0.25em] text-white/40">
                  Prayer context
                </div>
                <div className="mt-1 text-lg font-black text-white">
                  {currentPrayer}
                </div>
                <div className="mt-1 text-sm text-white/60">
                  Next: {nextPrayer}
                  {prayer?.next_prayer_time ? ` at ${prayer.next_prayer_time}` : ""}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-xs uppercase tracking-[0.25em] text-white/40">
                  Daily mode
                </div>
                <div className="mt-1 text-sm leading-7 text-white/70">
                  {dailyContext?.message ??
                    "Prepare for your next salah and discover what is nearby."}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {!loading && !errorText ? (
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Link
            href={mosqueHref}
            className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-yellow-400/50 hover:bg-white/[0.06]"
          >
            <div className="text-xs font-black uppercase tracking-[0.3em] text-yellow-400">
              Recommended mosque
            </div>

            <div className="mt-3 text-xl font-black text-white">
              {mosque?.name ?? "Find a mosque near you"}
            </div>

            <div className="mt-2 text-sm text-white/60">
              {mosque?.area || mosque?.city || cityName}
              {mosqueDistance ? ` • ${mosqueDistance}` : ""}
            </div>
          </Link>

          <Link
            href={businessHref}
            className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-yellow-400/50 hover:bg-white/[0.06]"
          >
            <div className="text-xs font-black uppercase tracking-[0.3em] text-yellow-400">
              Halal nearby
            </div>

            <div className="mt-3 text-xl font-black text-white">
              {business?.name ?? "Discover halal places"}
            </div>

            <div className="mt-2 text-sm text-white/60">
              {business?.category ?? "Halal business"}
              {businessDistance ? ` • ${businessDistance}` : ""}
            </div>
          </Link>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="text-xs font-black uppercase tracking-[0.3em] text-yellow-400">
              Daily reminder
            </div>

            <div className="mt-3 text-sm leading-7 text-white/70">
              {data?.daily_hadith?.text
                ? data.daily_hadith.text
                : "Return daily for prayer-aware guidance, local halal discovery, and community signals."}
            </div>

            {data?.daily_hadith?.source ? (
              <div className="mt-3 text-xs font-bold text-white/40">
                {data.daily_hadith.source}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}