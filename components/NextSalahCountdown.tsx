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
  timezone?: string | null;
};

type PrayerKey =
  | "fajr_start"
  | "sunrise"
  | "dhuhr_start"
  | "asr_start"
  | "maghrib_start"
  | "isha_start";

type PrayerItem = {
  key: PrayerKey;
  label: string;
  timeText: string;
  date: Date;
  isPrayer: boolean;
};

type PrayerWindow = {
  current: PrayerItem | null;
  next: PrayerItem;
  previous: PrayerItem | null;
  progress: number;
  remaining: number;
  dayLabel: "today" | "tomorrow";
};

const PRAYERS: ReadonlyArray<{
  key: PrayerKey;
  label: string;
  isPrayer: boolean;
}> = [
  {
    key: "fajr_start",
    label: "Fajr",
    isPrayer: true,
  },
  {
    key: "sunrise",
    label: "Sunrise",
    isPrayer: false,
  },
  {
    key: "dhuhr_start",
    label: "Dhuhr",
    isPrayer: true,
  },
  {
    key: "asr_start",
    label: "Asr",
    isPrayer: true,
  },
  {
    key: "maghrib_start",
    label: "Maghrib",
    isPrayer: true,
  },
  {
    key: "isha_start",
    label: "Isha",
    isPrayer: true,
  },
];

function cleanTime(
  value: string | null | undefined
): string | null {
  const trimmed = String(value ?? "").trim();

  return trimmed || null;
}

function parseTimeForDate(
  value: string | null | undefined,
  baseDate: Date,
  dayOffset = 0
): Date | null {
  const cleaned = cleanTime(value);

  if (!cleaned) {
    return null;
  }

  const match = cleaned.match(
    /^(\d{1,2}):(\d{2})(?::(\d{2}))?/
  );

  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] ?? "0");

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    !Number.isInteger(seconds) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
  ) {
    return null;
  }

  const date = new Date(baseDate);
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hours, minutes, seconds, 0);

  return date;
}

function formatClockTime(
  value: string | null | undefined
): string {
  const cleaned = cleanTime(value);

  if (!cleaned) {
    return "—";
  }

  return cleaned.slice(0, 5);
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(
    0,
    Math.floor(ms / 1000)
  );

  const hours = Math.floor(
    totalSeconds / 3600
  );

  const minutes = Math.floor(
    (totalSeconds % 3600) / 60
  );

  const seconds =
    totalSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(
      2,
      "0"
    )}:${String(minutes).padStart(
      2,
      "0"
    )}:${String(seconds).padStart(
      2,
      "0"
    )}`;
  }

  return `${String(minutes).padStart(
    2,
    "0"
  )}:${String(seconds).padStart(
    2,
    "0"
  )}`;
}

function buildPrayerItems(
  prayerTimes: PrayerTimes,
  baseDate: Date
): PrayerItem[] {
  return PRAYERS.map(
    (prayer): PrayerItem | null => {
      const timeText =
        prayerTimes[prayer.key];

      const date = parseTimeForDate(
        timeText,
        baseDate
      );

      if (!date || !timeText) {
        return null;
      }

      return {
        key: prayer.key,
        label: prayer.label,
        timeText,
        date,
        isPrayer: prayer.isPrayer,
      };
    }
  ).filter(
    (
      value
    ): value is PrayerItem =>
      value !== null
  );
}

function getPrayerWindow(
  prayerTimes: PrayerTimes | null,
  now: Date | null
): PrayerWindow | null {
  if (!prayerTimes || !now) {
    return null;
  }

  const items = buildPrayerItems(
    prayerTimes,
    now
  );

  if (items.length === 0) {
    return null;
  }

  const upcoming =
    items.find(
      (item) =>
        item.date.getTime() >
        now.getTime()
    ) ?? null;

  const previous =
    [...items]
      .reverse()
      .find(
        (item) =>
          item.date.getTime() <=
          now.getTime()
      ) ?? null;

  let next = upcoming;
  let dayLabel: "today" | "tomorrow" =
    "today";

  if (!next) {
    const tomorrowFajr =
      parseTimeForDate(
        prayerTimes.fajr_start,
        now,
        1
      );

    if (
      !tomorrowFajr ||
      !prayerTimes.fajr_start
    ) {
      return null;
    }

    next = {
      key: "fajr_start",
      label: "Fajr",
      timeText:
        prayerTimes.fajr_start,
      date: tomorrowFajr,
      isPrayer: true,
    };

    dayLabel = "tomorrow";
  }

  let progress = 0;

  if (previous) {
    const total =
      next.date.getTime() -
      previous.date.getTime();

    const elapsed =
      now.getTime() -
      previous.date.getTime();

    if (total > 0) {
      progress = Math.min(
        100,
        Math.max(
          0,
          Math.round(
            (elapsed / total) * 100
          )
        )
      );
    }
  }

  return {
    current: previous,
    previous,
    next,
    progress,
    remaining:
      next.date.getTime() -
      now.getTime(),
    dayLabel,
  };
}

function getCurrentStatusLabel(
  current: PrayerItem | null
): string {
  if (!current) {
    return "Before Fajr";
  }

  if (current.label === "Sunrise") {
    return "Morning";
  }

  return `Current: ${current.label}`;
}

export default function NextSalahCountdown({
  prayerTimes,
  cityName,
}: Props) {
  const [now, setNow] =
    useState<Date | null>(null);

  useEffect(() => {
    const update = () =>
      setNow(new Date());

    update();

    const timer =
      window.setInterval(
        update,
        1000
      );

    return () =>
      window.clearInterval(timer);
  }, []);

  const prayerWindow =
    useMemo(
      () =>
        getPrayerWindow(
          prayerTimes,
          now
        ),
      [prayerTimes, now]
    );

  if (!now) {
    return null;
  }

  if (
    !prayerTimes ||
    !prayerWindow
  ) {
    return (
      <section className="premium-panel relative overflow-hidden rounded-[2rem] p-6 sm:p-8">
        <div
          aria-hidden="true"
          className="absolute -right-24 -top-24 h-72 w-72 rounded-full border border-yellow-400/10 bg-yellow-400/[0.025]"
        />

        <div className="relative">
          <div className="section-kicker">
            Next Salah
          </div>

          <h2 className="mt-3 text-3xl font-black text-white">
            Choose a city to activate
            the live prayer countdown.
          </h2>

          <p className="mt-3 max-w-2xl text-sm leading-7 text-white/55">
            SalahNearMe will show the
            current prayer window, the
            next salah and a live
            second-by-second countdown.
          </p>
        </div>
      </section>
    );
  }

  const currentStatus =
    getCurrentStatusLabel(
      prayerWindow.current
    );

  return (
    <section
      aria-labelledby="next-salah-heading"
      className="premium-panel relative overflow-hidden rounded-[2rem] p-5 sm:p-7 lg:p-8"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_88%_18%,rgba(212,175,55,0.13),transparent_31rem)]"
      />

      <div
        aria-hidden="true"
        className="absolute -right-32 -top-32 h-96 w-96 rounded-full border border-yellow-300/[0.08]"
      />

      <div className="relative">
        <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="premium-badge">
                Live prayer clock
              </span>

              {cityName ? (
                <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs text-white/60">
                  {cityName}
                </span>
              ) : null}

              <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-200">
                {currentStatus}
              </span>
            </div>

            <div className="mt-6 text-xs font-black uppercase tracking-[0.22em] text-yellow-300/80">
              Next salah
            </div>

            <h2
              id="next-salah-heading"
              className="dashboard-hero-glow mt-2 text-5xl font-black tracking-[-0.045em] text-white sm:text-6xl lg:text-7xl"
            >
              {prayerWindow.next.label}
            </h2>

            <p className="mt-3 text-base text-white/60 sm:text-lg">
              Begins{" "}
              {prayerWindow.dayLabel ===
              "tomorrow"
                ? "tomorrow "
                : ""}
              at{" "}
              <span className="font-black text-yellow-300">
                {formatClockTime(
                  prayerWindow.next
                    .timeText
                )}
              </span>
            </p>
          </div>

          <div className="min-w-[260px] rounded-[1.75rem] border border-yellow-400/25 bg-yellow-400/[0.08] px-6 py-5 shadow-[0_24px_60px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:px-8 sm:py-6">
            <div className="text-xs font-black uppercase tracking-[0.22em] text-yellow-300/80">
              Time remaining
            </div>

            <div
              aria-live="polite"
              className="dashboard-hero-glow mt-3 font-mono text-4xl font-black tracking-[-0.04em] text-white sm:text-5xl"
            >
              {formatDuration(
                prayerWindow.remaining
              )}
            </div>
          </div>
        </div>

        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between gap-3 text-xs font-bold uppercase tracking-[0.14em] text-white/40">
            <span>
              {prayerWindow.previous
                ?.label ?? "Start"}
            </span>

            <span className="rounded-full border border-yellow-400/20 bg-yellow-400/[0.08] px-3 py-1 text-yellow-200">
              {prayerWindow.progress}%
            </span>

            <span>
              {prayerWindow.next.label}
            </span>
          </div>

          <div className="relative h-3 overflow-hidden rounded-full border border-yellow-400/15 bg-black/45">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#8f6506_0%,#d4af37_35%,#fff0a8_52%,#d4af37_75%,#8f6506_100%)] shadow-[0_0_24px_rgba(212,175,55,0.42)] transition-[width] duration-1000 ease-linear"
              style={{
                width: `${prayerWindow.progress}%`,
              }}
            />
          </div>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {PRAYERS.map((prayer) => {
            const isNext =
              prayer.label ===
              prayerWindow.next.label;

            const isCurrent =
              prayer.label ===
              prayerWindow.current
                ?.label;

            return (
              <div
                key={prayer.key}
                className={[
                  "relative overflow-hidden rounded-2xl border p-4 transition duration-300",
                  isNext
                    ? "border-yellow-400/35 bg-yellow-400/[0.09] shadow-[0_0_30px_rgba(212,175,55,0.10)]"
                    : isCurrent
                      ? "border-emerald-400/25 bg-emerald-400/[0.06]"
                      : "border-white/10 bg-black/25 hover:border-yellow-400/20",
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={[
                      "text-sm font-black",
                      isNext
                        ? "text-yellow-200"
                        : isCurrent
                          ? "text-emerald-200"
                          : "text-white/70",
                    ].join(" ")}
                  >
                    {prayer.label}
                  </span>

                  {isNext ? (
                    <span className="rounded-full border border-yellow-400/25 bg-yellow-400/10 px-2 py-1 text-[0.58rem] font-black uppercase tracking-[0.12em] text-yellow-200">
                      Next
                    </span>
                  ) : isCurrent ? (
                    <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-1 text-[0.58rem] font-black uppercase tracking-[0.12em] text-emerald-200">
                      Current
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 text-2xl font-black tracking-tight text-white">
                  {formatClockTime(
                    prayerTimes[
                      prayer.key
                    ]
                  )}
                </div>

                <div className="mt-1 text-[0.62rem] font-bold uppercase tracking-[0.15em] text-white/35">
                  {prayer.isPrayer
                    ? "Begins"
                    : "Solar time"}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}