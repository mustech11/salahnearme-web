import Link from "next/link";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Props = {
  mosqueId: string;
  mosqueSlug?: string | null;
  timezone?: string | null;
  verifiedStatus?: string | null;
  showManagerLink?: boolean;
};

type PrayerTimeRow = {
  prayer_date: string;
  fajr_begins: string | null;
  fajr_iqamah: string | null;
  sunrise: string | null;
  dhuhr_begins: string | null;
  dhuhr_iqamah: string | null;
  asr_begins: string | null;
  asr_iqamah: string | null;
  maghrib_begins: string | null;
  maghrib_iqamah: string | null;
  isha_begins: string | null;
  isha_iqamah: string | null;
  source: string | null;
  confidence: string | null;
};

type JumuahRow = {
  is_active: boolean | null;
  start_time: string | null;
  khutbah_time: string | null;
  prayer_time: string | null;
};

type BadgeTone =
  | "good"
  | "warning"
  | "danger"
  | "neutral";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DAYS_TO_CHECK = 30;

const BEGINS_FIELDS = [
  "fajr_begins",
  "sunrise",
  "dhuhr_begins",
  "asr_begins",
  "maghrib_begins",
  "isha_begins",
] as const;

const IQAMAH_FIELDS = [
  "fajr_iqamah",
  "dhuhr_iqamah",
  "asr_iqamah",
  "maghrib_iqamah",
  "isha_iqamah",
] as const;

function cleanString(
  value: string | null | undefined
): string {
  return value?.trim() ?? "";
}

function getSafeTimezone(
  value: string | null | undefined
): string {
  const timezone = cleanString(value);

  if (!timezone) {
    return "Europe/London";
  }

  try {
    new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
    }).format(new Date());

    return timezone;
  } catch {
    return "Europe/London";
  }
}

function getTodayDateForTimezone(
  timezone: string
): string {
  try {
    const formatter = new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }
    );

    const parts = formatter.formatToParts(
      new Date()
    );

    const day = parts.find(
      (part) => part.type === "day"
    )?.value;

    const month = parts.find(
      (part) => part.type === "month"
    )?.value;

    const year = parts.find(
      (part) => part.type === "year"
    )?.value;

    if (!day || !month || !year) {
      return new Date()
        .toISOString()
        .slice(0, 10);
    }

    return `${year}-${month}-${day}`;
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function addDays(
  dateString: string,
  days: number
): string {
  const date = new Date(
    `${dateString}T00:00:00.000Z`
  );

  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

function isMissing(
  value: string | null | undefined
): boolean {
  return cleanString(value).length === 0;
}

function formatLabel(
  value: string | null | undefined
): string {
  const cleaned = cleanString(value);

  if (!cleaned) {
    return "Verification not confirmed";
  }

  return cleaned
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

function getMissingBeginsCount(
  row: PrayerTimeRow
): number {
  return BEGINS_FIELDS.filter((field) =>
    isMissing(row[field])
  ).length;
}

function getMissingIqamahCount(
  row: PrayerTimeRow
): number {
  return IQAMAH_FIELDS.filter((field) =>
    isMissing(row[field])
  ).length;
}

function getConfidenceStatus(
  row: PrayerTimeRow
): BadgeTone {
  const confidence =
    cleanString(row.confidence).toLowerCase();

  const source =
    cleanString(row.source).toLowerCase();

  const combined = `${confidence} ${source}`;

  if (
    combined.includes("low") ||
    combined.includes("needs_review") ||
    combined.includes("needs review") ||
    combined.includes("unverified") ||
    combined.includes("failed")
  ) {
    return "danger";
  }

  if (
    combined.includes("official") ||
    combined.includes("verified") ||
    combined.includes("approved") ||
    combined.includes("manager") ||
    combined.includes("mosque")
  ) {
    return "good";
  }

  return "warning";
}

function jumuahHasTime(
  row: JumuahRow
): boolean {
  return Boolean(
    cleanString(row.start_time) ||
      cleanString(row.khutbah_time) ||
      cleanString(row.prayer_time)
  );
}

function calculateHealthScore({
  totalDays,
  existingRows,
  missingBegins,
  missingIqamah,
  lowConfidenceRows,
  activeJumuahRows,
}: {
  totalDays: number;
  existingRows: number;
  missingBegins: number;
  missingIqamah: number;
  lowConfidenceRows: number;
  activeJumuahRows: number;
}): number {
  const missingDays = Math.max(
    0,
    totalDays - existingRows
  );

  let score = 100;

  score -= missingDays * 3;
  score -= missingBegins * 2;
  score -= Math.ceil(missingIqamah * 0.8);
  score -= lowConfidenceRows * 2;

  if (activeJumuahRows === 0) {
    score -= 10;
  }

  return Math.max(
    0,
    Math.min(100, Math.round(score))
  );
}

function scoreLabel(score: number): string {
  if (score >= 85) {
    return "Strong";
  }

  if (score >= 70) {
    return "Good";
  }

  if (score >= 50) {
    return "Needs attention";
  }

  return "Weak";
}

function healthTone(score: number): BadgeTone {
  if (score >= 70) {
    return "good";
  }

  if (score >= 50) {
    return "warning";
  }

  return "danger";
}

function coverageTone(
  rowCount: number
): BadgeTone {
  if (rowCount >= 25) {
    return "good";
  }

  if (rowCount >= 15) {
    return "warning";
  }

  return "danger";
}

function gapTone(
  gapCount: number,
  warningLimit: number
): BadgeTone {
  if (gapCount === 0) {
    return "good";
  }

  if (gapCount <= warningLimit) {
    return "warning";
  }

  return "danger";
}

function verificationTone(
  value: string | null | undefined
): BadgeTone {
  const cleaned =
    cleanString(value).toLowerCase();

  if (
    cleaned.includes("verified") ||
    cleaned.includes("approved")
  ) {
    return "good";
  }

  if (
    cleaned.includes("auto") ||
    cleaned.includes("pending") ||
    cleaned.includes("community")
  ) {
    return "warning";
  }

  return "neutral";
}

function badgeClass(
  tone: BadgeTone
): string {
  if (tone === "good") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }

  if (tone === "warning") {
    return "border-yellow-500/30 bg-yellow-500/10 text-yellow-300";
  }

  if (tone === "danger") {
    return "border-red-500/30 bg-red-500/10 text-red-300";
  }

  return "border-white/10 bg-white/5 text-white/70";
}

export default async function MosqueTrustBadges({
  mosqueId,
  mosqueSlug,
  timezone,
  verifiedStatus,
  showManagerLink = false,
}: Props) {
  const cleanMosqueId = mosqueId.trim();

  if (!UUID_REGEX.test(cleanMosqueId)) {
    return (
      <TrustUnavailable
        mosqueSlug={mosqueSlug}
        message="Timetable reliability information is unavailable for this mosque."
      />
    );
  }

  const safeTimezone =
    getSafeTimezone(timezone);

  const today =
    getTodayDateForTimezone(safeTimezone);

  const endDate = addDays(
    today,
    DAYS_TO_CHECK - 1
  );

  const [
    prayerTimesResult,
    jumuahTimesResult,
  ] = await Promise.all([
    supabaseAdmin
      .from("mosque_prayer_times")
      .select(
        `
        prayer_date,
        fajr_begins,
        fajr_iqamah,
        sunrise,
        dhuhr_begins,
        dhuhr_iqamah,
        asr_begins,
        asr_iqamah,
        maghrib_begins,
        maghrib_iqamah,
        isha_begins,
        isha_iqamah,
        source,
        confidence
      `
      )
      .eq("mosque_id", cleanMosqueId)
      .gte("prayer_date", today)
      .lte("prayer_date", endDate)
      .order("prayer_date", {
        ascending: true,
      }),

    supabaseAdmin
      .from("mosque_jumuah_times")
      .select(
        `
        is_active,
        start_time,
        khutbah_time,
        prayer_time
      `
      )
      .eq("mosque_id", cleanMosqueId),
  ]);

  if (prayerTimesResult.error) {
    console.error(
      "MosqueTrustBadges prayer-time query error:",
      {
        mosqueId: cleanMosqueId,
        code: prayerTimesResult.error.code,
        message:
          prayerTimesResult.error.message,
      }
    );
  }

  if (jumuahTimesResult.error) {
    console.error(
      "MosqueTrustBadges Jumuah query error:",
      {
        mosqueId: cleanMosqueId,
        code: jumuahTimesResult.error.code,
        message:
          jumuahTimesResult.error.message,
      }
    );
  }

  if (
    prayerTimesResult.error &&
    jumuahTimesResult.error
  ) {
    return (
      <TrustUnavailable
        mosqueSlug={mosqueSlug}
        message="Timetable reliability information is temporarily unavailable."
      />
    );
  }

  const prayerRows = (
    prayerTimesResult.data ?? []
  ) as PrayerTimeRow[];

  const jumuahRows = (
    jumuahTimesResult.data ?? []
  ) as JumuahRow[];

  const uniquePrayerDates = new Set(
    prayerRows
      .map((row) =>
        cleanString(row.prayer_date)
      )
      .filter(Boolean)
  );

  const existingDays =
    uniquePrayerDates.size;

  const missingBegins = prayerRows.reduce(
    (total, row) =>
      total + getMissingBeginsCount(row),
    0
  );

  const missingIqamah = prayerRows.reduce(
    (total, row) =>
      total + getMissingIqamahCount(row),
    0
  );

  const lowConfidenceRows =
    prayerRows.filter(
      (row) =>
        getConfidenceStatus(row) === "danger"
    ).length;

  const activeJumuahRows =
    jumuahRows.filter((row) => {
      if (row.is_active === false) {
        return false;
      }

      return jumuahHasTime(row);
    }).length;

  const healthScore = calculateHealthScore({
    totalDays: DAYS_TO_CHECK,
    existingRows: existingDays,
    missingBegins,
    missingIqamah,
    lowConfidenceRows,
    activeJumuahRows,
  });

  const health = scoreLabel(healthScore);

  return (
    <section
      aria-labelledby="mosque-trust-heading"
      className="rounded-3xl border border-white/10 bg-black/20 p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-yellow-400">
            Mosque data trust
          </div>

          <h2
            id="mosque-trust-heading"
            className="mt-2 text-xl font-black text-white"
          >
            Timetable reliability
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-7 text-white/55">
            These indicators show timetable coverage,
            iqamah completeness, Jumu’ah availability
            and data confidence for the next{" "}
            {DAYS_TO_CHECK} days.
          </p>
        </div>

        {showManagerLink ? (
          <Link
            href={`/business-dashboard/mosques/${cleanMosqueId}/data-quality`}
            className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-xs font-bold text-cyan-300 transition hover:bg-cyan-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            View data quality
          </Link>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <TrustBadge
          label={`Timetable health: ${health}`}
          title={`Calculated health score: ${healthScore}/100`}
          tone={healthTone(healthScore)}
        />

        <TrustBadge
          label={`${DAYS_TO_CHECK}-day coverage: ${existingDays}/${DAYS_TO_CHECK}`}
          tone={coverageTone(existingDays)}
        />

        <TrustBadge
          label={
            missingBegins === 0
              ? "Beginning times complete"
              : `Beginning-time gaps: ${missingBegins}`
          }
          tone={gapTone(missingBegins, 8)}
        />

        <TrustBadge
          label={
            missingIqamah === 0
              ? "Iqamah data complete"
              : `Iqamah gaps: ${missingIqamah}`
          }
          tone={gapTone(missingIqamah, 10)}
        />

        <TrustBadge
          label={
            activeJumuahRows > 0
              ? `${activeJumuahRows} Jumu’ah session${
                  activeJumuahRows === 1
                    ? ""
                    : "s"
                } confirmed`
              : "Jumu’ah time not confirmed"
          }
          tone={
            activeJumuahRows > 0
              ? "good"
              : "warning"
          }
        />

        <TrustBadge
          label={formatLabel(verifiedStatus)}
          tone={verificationTone(
            verifiedStatus
          )}
        />

        <TrustBadge
          label={
            lowConfidenceRows === 0
              ? "No low-confidence rows"
              : `${lowConfidenceRows} low-confidence row${
                  lowConfidenceRows === 1
                    ? ""
                    : "s"
                }`
          }
          tone={
            lowConfidenceRows === 0
              ? "good"
              : "warning"
          }
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-white/40">
        <span>
          Window: {today} to {endDate} ·{" "}
          {safeTimezone}
        </span>

        {mosqueSlug ? (
          <Link
            href={`/mosque/${cleanString(
              mosqueSlug
            )}/timetable`}
            className="font-bold text-yellow-300 underline underline-offset-4 transition hover:text-yellow-200"
          >
            View monthly timetable
          </Link>
        ) : null}
      </div>
    </section>
  );
}

function TrustBadge({
  label,
  tone,
  title,
}: {
  label: string;
  tone: BadgeTone;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`rounded-full border px-3 py-2 text-xs font-bold ${badgeClass(
        tone
      )}`}
    >
      {label}
    </span>
  );
}

function TrustUnavailable({
  mosqueSlug,
  message,
}: {
  mosqueSlug?: string | null;
  message: string;
}) {
  const cleanSlug = cleanString(mosqueSlug);

  return (
    <section className="rounded-3xl border border-white/10 bg-black/20 p-5">
      <div className="text-xs font-semibold uppercase tracking-[0.22em] text-yellow-400">
        Mosque data trust
      </div>

      <h2 className="mt-2 text-xl font-black text-white">
        Timetable reliability
      </h2>

      <p className="mt-3 text-sm leading-7 text-white/55">
        {message}
      </p>

      {cleanSlug ? (
        <Link
          href={`/mosque/${cleanSlug}/timetable`}
          className="mt-4 inline-flex rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-xs font-bold text-yellow-300 transition hover:bg-yellow-500/20"
        >
          View public timetable
        </Link>
      ) : null}
    </section>
  );
}