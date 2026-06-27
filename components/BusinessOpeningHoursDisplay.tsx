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

const DAYS = [
  ["monday", "Monday"],
  ["tuesday", "Tuesday"],
  ["wednesday", "Wednesday"],
  ["thursday", "Thursday"],
  ["friday", "Friday"],
  ["saturday", "Saturday"],
  ["sunday", "Sunday"],
] as const;

function formatTime(value?: string | null) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return "—";
  }

  return trimmed;
}

function hasAnyOpeningHours(openingHours: OpeningHours) {
  return DAYS.some(([key]) => Boolean(openingHours[key]));
}

export default function BusinessOpeningHoursDisplay({
  openingHours,
  note,
}: {
  openingHours?: OpeningHours | null;
  note?: string | null;
}) {
  if (!openingHours || !hasAnyOpeningHours(openingHours)) {
    return null;
  }

  return (
    <section className="luxe-card rounded-3xl p-8">
      <div className="text-2xl font-bold text-yellow-400">
        Opening Hours
      </div>

      <div className="mt-6 grid gap-3">
        {DAYS.map(([key, label]) => {
          const day = openingHours[key];

          if (!day) {
            return null;
          }

          const closed = Boolean(day.closed);

          return (
            <div
              key={key}
              className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/30 px-5 py-4"
            >
              <div className="font-semibold text-white">{label}</div>

              <div
                className={`text-right text-sm ${
                  closed ? "text-red-300" : "text-white/70"
                }`}
              >
                {closed
                  ? "Closed"
                  : `${formatTime(day.open)} - ${formatTime(day.close)}`}
              </div>
            </div>
          );
        })}
      </div>

      {note ? (
        <div className="mt-5 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm leading-6 text-yellow-100">
          {note}
        </div>
      ) : null}
    </section>
  );
}

