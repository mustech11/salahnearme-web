"use client";

import { useEffect, useMemo, useState } from "react";

type PrayerTimes = {
  fajr_start?: string | null;
  sunrise?: string | null;
  dhuhr_start?: string | null;
  asr_start?: string | null;
  maghrib_start?: string | null;
  isha_start?: string | null;
};

type Props = {
  prayerTimes: PrayerTimes | null;
  cityName?: string | null;
};

type PrayerItem = {
  label: string;
  timeText: string;
  date: Date;
};

type PrayerWindow = {
  current: PrayerItem | null;
  next: PrayerItem;
  previous: PrayerItem | null;
  progress: number;
  remaining: number;
};

const prayers = [
  { key: "fajr_start", label: "Fajr" },
  { key: "sunrise", label: "Sunrise" },
  { key: "dhuhr_start", label: "Dhuhr" },
  { key: "asr_start", label: "Asr" },
  { key: "maghrib_start", label: "Maghrib" },
  { key: "isha_start", label: "Isha" },
] as const;

function parseTimeToday(value: string | null | undefined): Date | null {
  if (!value) return null;

  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;

  const date = new Date();
  date.setHours(Number(match[1]), Number(match[2]), 0, 0);

  return date;
}

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

function buildPrayerItems(prayerTimes: PrayerTimes): PrayerItem[] {
  return prayers
    .map((p): PrayerItem | null => {
      const timeText = prayerTimes[p.key];
      const date = parseTimeToday(timeText);

      if (!date || !timeText) {
        return null;
      }

      return {
        label: p.label,
        timeText,
        date,
      };
    })
    .filter((value): value is PrayerItem => value !== null);
}

function getPrayerWindow(
  prayerTimes: PrayerTimes | null,
  now: Date | null
): PrayerWindow | null {
  if (!prayerTimes || !now) return null;

  const items = buildPrayerItems(prayerTimes);
  if (items.length === 0) return null;

  const upcoming =
    items.find((item) => item.date.getTime() > now.getTime()) ?? null;

  const previous =
    [...items].reverse().find((item) => item.date.getTime() <= now.getTime()) ??
    null;

  let next = upcoming;

  if (!next) {
    const tomorrowFajr = parseTimeToday(prayerTimes.fajr_start);

    if (!tomorrowFajr || !prayerTimes.fajr_start) return null;

    tomorrowFajr.setDate(tomorrowFajr.getDate() + 1);

    next = {
      label: "Fajr",
      timeText: prayerTimes.fajr_start,
      date: tomorrowFajr,
    };
  }

  let progress = 0;

  if (previous) {
    const total = next.date.getTime() - previous.date.getTime();
    const elapsed = now.getTime() - previous.date.getTime();

    if (total > 0) {
      progress = Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
    }
  }

  return {
    current: previous,
    previous,
    next,
    progress,
    remaining: next.date.getTime() - now.getTime(),
  };
}

export default function NextSalahCountdown({
  prayerTimes,
  cityName,
}: Props) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());

    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const prayerWindow = useMemo(() => {
    return getPrayerWindow(prayerTimes, now);
  }, [prayerTimes, now]);

  if (!now) return null;

  if (!prayerTimes || !prayerWindow) {
    return (
      <section className="luxe-card relative overflow-hidden rounded-3xl p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,0.12),transparent_40%)]" />

        <div className="relative z-10">
          <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
            Next Salah
          </div>

          <div className="luxe-heading-font white-soft-glow mt-3 text-3xl text-white">
            Select a city to view prayer countdown
          </div>

          <p className="mt-3 max-w-xl text-white/60">
            SalahNearMe will display live prayer countdowns, current salah
            window, and prayer progression.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="luxe-card relative overflow-hidden rounded-3xl p-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,0.14),transparent_40%)]" />
      <div className="absolute inset-y-0 right-0 w-[40%] bg-[linear-gradient(to_left,rgba(212,175,55,0.04),transparent)]" />

      <div className="relative z-10">
        <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-yellow-400">
                Salah Status
              </div>

              {cityName && (
                <div className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/60">
                  {cityName}
                </div>
              )}

              <div className="rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-semibold text-green-300">
                Current: {prayerWindow.current?.label ?? "Before Fajr"}
              </div>
            </div>

            <div className="dashboard-hero-glow mt-6 text-5xl font-black tracking-[-0.04em] text-white md:text-6xl">
              {prayerWindow.next.label}
                </div>

            <div className="mt-3 text-lg text-white/70">
              Starts at{" "}
              <span className="font-semibold text-yellow-400">
                {prayerWindow.next.timeText}
              </span>
            </div>
          </div>

          <div className="rounded-3xl border border-yellow-500/30 bg-yellow-500/10 px-8 py-6 backdrop-blur-xl">
            <div className="text-xs uppercase tracking-[0.2em] text-yellow-400">
              Time Remaining
            </div>

            <div className="dashboard-hero-glow mt-3 text-4xl font-bold tracking-tight text-white md:text-5xl">
              {formatDuration(prayerWindow.remaining)}
              </div>
          </div>
        </div>

        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.15em] text-white/45">
            <span>{prayerWindow.previous?.label ?? "Start"}</span>

            <span className="rounded-full border border-yellow-500/20 bg-yellow-500/10 px-3 py-1 text-yellow-300">
              {prayerWindow.progress}%
            </span>

            <span>{prayerWindow.next.label}</span>
          </div>

          <div className="relative h-4 overflow-hidden rounded-full border border-yellow-500/20 bg-black/50 backdrop-blur-xl">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02),transparent)]" />

         <div
          className="relative h-full rounded-full bg-[linear-gradient(90deg,#b8860b_0%,#f4d675_35%,#fff4c2_50%,#f4d675_65%,#b8860b_100%)] shadow-[0_0_25px_rgba(212,175,55,0.45)] transition-all duration-1000"
          style={{
            width: `${prayerWindow.progress}%`,
          }}
              >
          <div className="absolute inset-0 animate-pulse bg-white/10" />
        </div>
      </div>
              </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {prayers.map((prayer) => {
    const isActive = prayer.label === prayerWindow.next.label;

    return (
      <div
        key={prayer.label}
        className={`group relative overflow-hidden rounded-2xl border p-4 transition-all duration-300 ${
          isActive
            ? "border-yellow-500/40 bg-yellow-500/10 shadow-[0_0_30px_rgba(212,175,55,0.12)]"
            : "border-white/10 bg-black/30 hover:border-yellow-500/20 hover:bg-white/[0.03]"
        }`}
      >
        {isActive && (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,0.14),transparent_55%)]" />
        )}

        <div className="relative z-10">
          <div className="flex items-center justify-between gap-2">
            <div
              className={`text-sm font-semibold ${
                isActive ? "text-yellow-300" : "text-yellow-400"
              }`}
            >
              {prayer.label}
            </div>

            {isActive && (
              <div className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-yellow-300">
                Next
              </div>
            )}
          </div>

          <div
            className={`mt-3 text-2xl font-black tracking-tight ${
              isActive ? "text-white" : "text-white/90"
            }`}
          >
            {prayerTimes[prayer.key] ?? "—"}
          </div>

          <div className="mt-1 text-xs uppercase tracking-[0.15em] text-white/40">
            Begins
          </div>
        </div>
      </div>
    );
  })}
</div>
</div>
</section>
);
}

