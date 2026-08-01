"use client";

import { useEffect, useMemo, useState } from "react";

export type DayHours = {
  open?: string | null;
  close?: string | null;
  closed?: boolean | null;
};

export type OpeningHours = Partial<
  Record<
    | "monday"
    | "tuesday"
    | "wednesday"
    | "thursday"
    | "friday"
    | "saturday"
    | "sunday",
    DayHours | null
  >
>;

type DayKey = keyof OpeningHours;

type DayDefinition = {
  key: DayKey;
  label: string;
  jsDay: number;
};

type DayStatus = {
  text: string;
  tone: string;
  isOpen: boolean | null;
  nextChange?: string | null;
};

const DAYS: DayDefinition[] = [
  { key: "monday", label: "Monday", jsDay: 1 },
  { key: "tuesday", label: "Tuesday", jsDay: 2 },
  { key: "wednesday", label: "Wednesday", jsDay: 3 },
  { key: "thursday", label: "Thursday", jsDay: 4 },
  { key: "friday", label: "Friday", jsDay: 5 },
  { key: "saturday", label: "Saturday", jsDay: 6 },
  { key: "sunday", label: "Sunday", jsDay: 0 },
];

const CURRENT_TIME_REFRESH_MS = 60_000;

function cleanTime(value?: string | null): string | null {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(trimmed);

  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function formatTime(value?: string | null): string {
  const cleaned = cleanTime(value);

  if (!cleaned) {
    return "Not set";
  }

  const [hour, minute] = cleaned.split(":").map(Number);
  const date = new Date();
  date.setHours(hour, minute, 0, 0);

  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function toMinutes(value?: string | null): number | null {
  const cleaned = cleanTime(value);

  if (!cleaned) {
    return null;
  }

  const [hour, minute] = cleaned.split(":").map(Number);
  return hour * 60 + minute;
}

function hasMeaningfulDay(day?: DayHours | null): boolean {
  return Boolean(
    day &&
      (day.closed === true ||
        cleanTime(day.open) ||
        cleanTime(day.close))
  );
}

function hasAnyOpeningHours(openingHours: OpeningHours): boolean {
  return DAYS.some(({ key }) =>
    hasMeaningfulDay(openingHours[key])
  );
}

function getTodayKey(timeZone: string, now: Date): DayKey {
  try {
    const weekday = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      weekday: "long",
    })
      .format(now)
      .toLowerCase() as DayKey;

    return DAYS.some(({ key }) => key === weekday)
      ? weekday
      : "monday";
  } catch {
    return (
      DAYS.find(({ jsDay }) => jsDay === now.getDay())?.key ??
      "monday"
    );
  }
}

function getCurrentMinutes(timeZone: string, now: Date): number {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now);

    const hour = Number(
      parts.find((part) => part.type === "hour")?.value ?? "0"
    );
    const minute = Number(
      parts.find((part) => part.type === "minute")?.value ?? "0"
    );

    return hour * 60 + minute;
  } catch {
    return now.getHours() * 60 + now.getMinutes();
  }
}

function getDayStatus(
  day: DayHours | null | undefined,
  isToday: boolean,
  currentMinutes: number
): DayStatus {
  if (!day || !hasMeaningfulDay(day)) {
    return {
      text: "Hours not provided",
      tone: "text-white/45",
      isOpen: null,
    };
  }

  if (day.closed) {
    return {
      text: "Closed",
      tone: "text-red-300",
      isOpen: false,
    };
  }

  const open = formatTime(day.open);
  const close = formatTime(day.close);
  const openMinutes = toMinutes(day.open);
  const closeMinutes = toMinutes(day.close);

  if (
    openMinutes === null ||
    closeMinutes === null
  ) {
    return {
      text: `${open} – ${close}`,
      tone: "text-yellow-300",
      isOpen: null,
    };
  }

  let isOpen = false;

  if (closeMinutes > openMinutes) {
    isOpen =
      currentMinutes >= openMinutes &&
      currentMinutes < closeMinutes;
  } else if (closeMinutes < openMinutes) {
    isOpen =
      currentMinutes >= openMinutes ||
      currentMinutes < closeMinutes;
  }

  return {
    text: `${open} – ${close}`,
    tone: isToday
      ? isOpen
        ? "text-emerald-300"
        : "text-red-300"
      : "text-white/75",
    isOpen: isToday ? isOpen : null,
    nextChange: isToday
      ? isOpen
        ? `Closes ${close}`
        : currentMinutes < openMinutes
          ? `Opens ${open}`
          : null
      : null,
  };
}

export default function BusinessOpeningHoursDisplay({
  openingHours,
  note,
  timeZone = "Europe/London",
}: {
  openingHours?: OpeningHours | null;
  note?: string | null;
  timeZone?: string;
}) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const intervalId = window.setInterval(
      () => setNow(new Date()),
      CURRENT_TIME_REFRESH_MS
    );

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const hasHours = useMemo(
    () =>
      Boolean(
        openingHours &&
          hasAnyOpeningHours(openingHours)
      ),
    [openingHours]
  );

  if (!openingHours || !hasHours) {
    return null;
  }

  const todayKey = getTodayKey(timeZone, now);
  const today = DAYS.find(({ key }) => key === todayKey);
  const currentMinutes = getCurrentMinutes(timeZone, now);
  const todayStatus = getDayStatus(
    openingHours[todayKey],
    true,
    currentMinutes
  );

  return (
    <section
      aria-labelledby="business-opening-hours-heading"
      className="luxe-card rounded-3xl p-6 md:p-8"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-yellow-400">
            Opening hours
          </div>

          <h2
            id="business-opening-hours-heading"
            className="mt-2 text-2xl font-black text-white"
          >
            Weekly business hours
          </h2>

          <p className="mt-2 text-sm text-white/50">
            Times shown in {timeZone.replace(/_/g, " ")}.
          </p>
        </div>

        <div className="w-fit rounded-2xl border border-yellow-500/20 bg-yellow-500/10 px-4 py-3 text-sm">
          <div className="text-xs uppercase tracking-[0.16em] text-white/40">
            Today
          </div>

          <div className={`mt-1 font-black ${todayStatus.tone}`}>
            {today?.label ?? "Today"} · {todayStatus.text}
          </div>

          {todayStatus.nextChange ? (
            <div className="mt-1 text-xs text-white/45">
              {todayStatus.nextChange}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-6 grid gap-3">
        {DAYS.map(({ key, label }) => {
          const isToday = key === todayKey;
          const status = getDayStatus(
            openingHours[key],
            isToday,
            currentMinutes
          );

          return (
            <article
              key={key}
              className={`flex flex-col gap-3 rounded-2xl border px-5 py-4 sm:flex-row sm:items-center sm:justify-between ${
                isToday
                  ? "border-yellow-500/30 bg-yellow-500/10"
                  : "border-white/10 bg-black/30"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="font-bold text-white">
                  {label}
                </div>

                {isToday ? (
                  <span className="rounded-full border border-yellow-500/30 bg-black/20 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-yellow-300">
                    Today
                  </span>
                ) : null}
              </div>

              <div className="text-left sm:text-right">
                <div
                  className={`text-sm font-bold ${status.tone}`}
                >
                  {status.text}
                </div>

                {isToday && status.nextChange ? (
                  <div className="mt-1 text-xs text-white/40">
                    {status.nextChange}
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      {note?.trim() ? (
        <aside className="mt-5 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm leading-6 text-yellow-100">
          <span className="font-black">Please note:</span>{" "}
          <span dir="auto">{note.trim()}</span>
        </aside>
      ) : null}
    </section>
  );
}