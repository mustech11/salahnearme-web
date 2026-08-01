type Props = {
  jumuah_sittings?: number | string | null;
  khutbah_language?: string | null;
  typical_full_by?: string | null;
  notes?: string | null;
};

function cleanText(
  value: unknown,
  maxLength = 1_000
): string {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value)
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function formatSittings(
  value: number | string | null | undefined
): string {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    const count = Math.max(
      0,
      Math.trunc(value)
    );

    return count > 0
      ? `${count} sitting${count === 1 ? "" : "s"}`
      : "Unknown";
  }

  return cleanText(value, 120) || "Unknown";
}

function formatTimeLikeValue(
  value: string | null | undefined
): string {
  const cleaned = cleanText(value, 120);

  if (!cleaned) {
    return "Not listed";
  }

  const match =
    /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(
      cleaned
    );

  if (!match) {
    return cleaned;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return cleaned;
  }

  const date = new Date();
  date.setHours(hour, minute, 0, 0);

  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export default function FridaySmartCard({
  jumuah_sittings,
  khutbah_language,
  typical_full_by,
  notes,
}: Props) {
  const sittings = formatSittings(
    jumuah_sittings
  );

  const khutbah =
    cleanText(khutbah_language, 200) ||
    "Not listed";

  const fullBy = formatTimeLikeValue(
    typical_full_by
  );

  const cleanNotes = cleanText(
    notes,
    2_000
  );

  return (
    <section
      aria-labelledby="friday-smart-mode-heading"
      className="rounded-2xl border border-white/10 bg-[rgb(var(--card))] p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.18em] text-yellow-400">
            Friday guidance
          </div>

          <h2
            id="friday-smart-mode-heading"
            className="mt-1 text-sm font-black text-white"
          >
            Friday Smart Mode
          </h2>

          <p className="mt-1 text-xs leading-5 text-white/55">
            Community guidance that may vary each week.
          </p>
        </div>

        <span className="w-fit rounded-full border border-yellow-500/20 bg-yellow-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-yellow-300">
          Jumu&apos;ah
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <MetricCard
          label="Sittings"
          value={sittings}
        />

        <MetricCard
          label="Khutbah language"
          value={khutbah}
        />

        <MetricCard
          label="Often busy by"
          value={fullBy}
        />
      </div>

      {cleanNotes ? (
        <aside className="mt-4 rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-yellow-300">
            Community note
          </div>

          <p
            dir="auto"
            className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-white/75"
          >
            {cleanNotes}
          </p>
        </aside>
      ) : null}

      <p className="mt-4 text-[10px] leading-5 text-white/40">
        Confirm current Jumu&apos;ah times directly with the mosque before travelling.
      </p>
    </section>
  );
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">
        {label}
      </div>

      <div
        dir="auto"
        className="mt-2 break-words font-black text-white"
      >
        {value}
      </div>
    </article>
  );
}