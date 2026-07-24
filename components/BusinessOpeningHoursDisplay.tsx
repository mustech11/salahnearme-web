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

const DAYS: DayDefinition[] = [
  { key: "monday", label: "Monday", jsDay: 1 },
  { key: "tuesday", label: "Tuesday", jsDay: 2 },
  { key: "wednesday", label: "Wednesday", jsDay: 3 },
  { key: "thursday", label: "Thursday", jsDay: 4 },
  { key: "friday", label: "Friday", jsDay: 5 },
  { key: "saturday", label: "Saturday", jsDay: 6 },
  { key: "sunday", label: "Sunday", jsDay: 0 },
];

function cleanTime(value?: string | null): string | null {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(trimmed);

  if (!match) {
    return trimmed;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return trimmed;
  }

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function formatTime(value?: string | null): string {
  const cleaned = cleanTime(value);

  if (!cleaned) {
    return "Not set";
  }

  const match = /^(\d{2}):(\d{2})$/.exec(cleaned);

  if (!match) {
    return cleaned;
  }

  const date = new Date();
  date.setHours(Number(match[1]), Number(match[2]), 0, 0);

  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function hasMeaningfulDay(day?: DayHours | null): boolean {
  return Boolean(day && (day.closed === true || cleanTime(day.open) || cleanTime(day.close)));
}

function hasAnyOpeningHours(openingHours: OpeningHours): boolean {
  return DAYS.some(({ key }) => hasMeaningfulDay(openingHours[key]));
}

function getTodayKey(timeZone: string): DayKey {
  try {
    const weekday = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      weekday: "long",
    })
      .format(new Date())
      .toLowerCase() as DayKey;

    return DAYS.some(({ key }) => key === weekday) ? weekday : "monday";
  } catch {
    return DAYS.find(({ jsDay }) => jsDay === new Date().getDay())?.key ?? "monday";
  }
}

function getDayStatus(day?: DayHours | null): {
  text: string;
  tone: string;
} {
  if (!day || !hasMeaningfulDay(day)) {
    return {
      text: "Hours not provided",
      tone: "text-white/45",
    };
  }

  if (day.closed) {
    return {
      text: "Closed",
      tone: "text-red-300",
    };
  }

  const open = formatTime(day.open);
  const close = formatTime(day.close);

  if (open === "Not set" || close === "Not set") {
    return {
      text: `${open} – ${close}`,
      tone: "text-yellow-300",
    };
  }

  return {
    text: `${open} – ${close}`,
    tone: "text-white/75",
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
  if (!openingHours || !hasAnyOpeningHours(openingHours)) {
    return null;
  }

  const todayKey = getTodayKey(timeZone);
  const today = DAYS.find(({ key }) => key === todayKey);
  const todayStatus = getDayStatus(openingHours[todayKey]);

  return (
    <section
      aria-labelledby="business-opening-hours-heading"
      className="luxe-card rounded-3xl p-6 md:p-8"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-yellow-400">
            Opening hours
          </div>

          <h2 id="business-opening-hours-heading" className="mt-2 text-2xl font-bold text-white">
            Weekly business hours
          </h2>
        </div>

        <div className="w-fit rounded-2xl border border-yellow-500/20 bg-yellow-500/10 px-4 py-3 text-sm">
          <span className="text-white/50">Today:</span>{" "}
          <span className={`font-bold ${todayStatus.tone}`}>
            {today?.label ?? "Today"} · {todayStatus.text}
          </span>
        </div>
      </div>

      <div className="mt-6 grid gap-3">
        {DAYS.map(({ key, label }) => {
          const status = getDayStatus(openingHours[key]);
          const isToday = key === todayKey;

          return (
            <div
              key={key}
              className={`flex items-center justify-between gap-4 rounded-2xl border px-5 py-4 ${
                isToday
                  ? "border-yellow-500/30 bg-yellow-500/10"
                  : "border-white/10 bg-black/30"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="font-semibold text-white">{label}</div>
                {isToday ? (
                  <span className="rounded-full border border-yellow-500/30 bg-black/20 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-yellow-300">
                    Today
                  </span>
                ) : null}
              </div>

              <div className={`text-right text-sm font-semibold ${status.tone}`}>
                {status.text}
              </div>
            </div>
          );
        })}
      </div>

      {note?.trim() ? (
        <div className="mt-5 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm leading-6 text-yellow-100">
          <span className="font-bold">Please note:</span> {note.trim()}
        </div>
      ) : null}
    </section>
  );
}