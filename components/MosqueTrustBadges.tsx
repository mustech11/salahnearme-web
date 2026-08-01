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
  prayer_date: string | null;
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
  active: boolean | null;
  khutbah_time: string | null;
  salah_time: string | null;
};

type BadgeTone =
  | "good"
  | "warning"
  | "danger"
  | "neutral";

type TrustIndicator = {
  key: string;
  label: string;
  description: string;
  tone: BadgeTone;
  value?: string;
};

type JumuahLoadResult = {
  rows: JumuahRow[];
  available: boolean;
};

type TimetableMetrics = {
  existingDays: number;
  missingDays: number;
  missingBegins: number;
  missingIqamah: number;
  lowConfidenceRows: number;
  trustedRows: number;
  activeJumuahRows: number;
  timetableAvailable: boolean;
  jumuahAvailable: boolean;
  healthScore: number;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SLUG_REGEX =
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const DAYS_TO_CHECK = 30;
const DEFAULT_TIMEZONE = "Europe/London";

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
  value: string | null | undefined,
  maxLength = 300
): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function cleanSlug(
  value: string | null | undefined
): string | null {
  const cleaned = cleanString(value, 160)
    .toLowerCase();

  return SLUG_REGEX.test(cleaned)
    ? cleaned
    : null;
}

function getSafeTimezone(
  value: string | null | undefined
): string {
  const timezone = cleanString(value, 120);

  if (!timezone) {
    return DEFAULT_TIMEZONE;
  }

  try {
    new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
    }).format(new Date());

    return timezone;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

function getTodayDateForTimezone(
  timezone: string
): string {
  try {
    const parts =
      new Intl.DateTimeFormat("en-GB", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(new Date());

    const year = parts.find(
      (part) => part.type === "year"
    )?.value;

    const month = parts.find(
      (part) => part.type === "month"
    )?.value;

    const day = parts.find(
      (part) => part.type === "day"
    )?.value;

    if (year && month && day) {
      return `${year}-${month}-${day}`;
    }
  } catch {
    // Use UTC fallback below.
  }

  return new Date()
    .toISOString()
    .slice(0, 10);
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

  date.setUTCDate(
    date.getUTCDate() + days
  );

  return date
    .toISOString()
    .slice(0, 10);
}

function isMissing(
  value: string | null | undefined
): boolean {
  return cleanString(value).length === 0;
}

function formatLabel(
  value: string | null | undefined,
  fallback = "Not confirmed"
): string {
  const cleaned = cleanString(value);

  if (!cleaned) {
    return fallback;
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

function getRowConfidenceTone(
  row: PrayerTimeRow
): BadgeTone {
  const confidence = cleanString(
    row.confidence
  ).toLowerCase();

  const source = cleanString(
    row.source
  ).toLowerCase();

  const combined =
    `${confidence} ${source}`;

  if (
    combined.includes("low") ||
    combined.includes("needs_review") ||
    combined.includes("needs review") ||
    combined.includes("unverified") ||
    combined.includes("failed") ||
    combined.includes("rejected")
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
    cleanString(row.khutbah_time) ||
      cleanString(row.salah_time)
  );
}

function calculateHealthScore({
  totalDays,
  existingRows,
  missingBegins,
  missingIqamah,
  lowConfidenceRows,
  trustedRows,
  activeJumuahRows,
  jumuahAvailable,
}: {
  totalDays: number;
  existingRows: number;
  missingBegins: number;
  missingIqamah: number;
  lowConfidenceRows: number;
  trustedRows: number;
  activeJumuahRows: number;
  jumuahAvailable: boolean;
}): number {
  if (existingRows === 0) {
    return 0;
  }

  const missingDays = Math.max(
    0,
    totalDays - existingRows
  );

  let score = 100;

  score -= missingDays * 2.5;
  score -= missingBegins * 1.6;
  score -= missingIqamah * 0.7;
  score -= lowConfidenceRows * 2.5;

  if (trustedRows > 0) {
    score += Math.min(
      5,
      Math.round(
        (trustedRows / existingRows) * 5
      )
    );
  }

  if (
    jumuahAvailable &&
    activeJumuahRows === 0
  ) {
    score -= 8;
  }

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(score)
    )
  );
}

function getHealthLabel(
  score: number,
  hasTimetable: boolean
): string {
  if (!hasTimetable) {
    return "Not uploaded";
  }

  if (score >= 90) {
    return "Excellent";
  }

  if (score >= 80) {
    return "Strong";
  }

  if (score >= 65) {
    return "Good";
  }

  if (score >= 45) {
    return "Needs attention";
  }

  return "Weak";
}

function getHealthTone(
  score: number,
  hasTimetable: boolean
): BadgeTone {
  if (!hasTimetable) {
    return "neutral";
  }

  if (score >= 80) {
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
  if (rowCount >= 27) {
    return "good";
  }

  if (rowCount >= 18) {
    return "warning";
  }

  if (rowCount > 0) {
    return "danger";
  }

  return "neutral";
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
    cleaned.includes("approved") ||
    cleaned.includes("official")
  ) {
    return "good";
  }

  if (
    cleaned.includes("pending") ||
    cleaned.includes("community") ||
    cleaned.includes("auto")
  ) {
    return "warning";
  }

  if (
    cleaned.includes("rejected") ||
    cleaned.includes("failed") ||
    cleaned.includes("unverified")
  ) {
    return "danger";
  }

  return "neutral";
}

function badgeClass(
  tone: BadgeTone
): string {
  if (tone === "good") {
    return [
      "border-emerald-500/30",
      "bg-emerald-500/10",
      "text-emerald-200",
    ].join(" ");
  }

  if (tone === "warning") {
    return [
      "border-yellow-500/30",
      "bg-yellow-500/10",
      "text-yellow-200",
    ].join(" ");
  }

  if (tone === "danger") {
    return [
      "border-red-500/30",
      "bg-red-500/10",
      "text-red-200",
    ].join(" ");
  }

  return [
    "border-white/10",
    "bg-white/[0.04]",
    "text-white/60",
  ].join(" ");
}

function iconClass(
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

  return "border-white/10 bg-white/[0.04] text-white/50";
}

function getToneIcon(
  tone: BadgeTone
) {
  if (tone === "good") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
        aria-hidden="true"
      >
        <path d="m5 12 4 4L19 6" />
      </svg>
    );
  }

  if (tone === "danger") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className="h-4 w-4"
        aria-hidden="true"
      >
        <path d="M6 6l12 12M18 6 6 18" />
      </svg>
    );
  }

  if (tone === "warning") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
        aria-hidden="true"
      >
        <path d="M12 3 2.8 20h18.4L12 3Z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </svg>
  );
}

async function loadJumuahRows(
  mosqueId: string
): Promise<JumuahLoadResult> {
  try {
    const result =
      await supabaseAdmin
        .from("mosque_jumuah_times")
        .select(
          `
          active,
          khutbah_time,
          salah_time
        `
        )
        .eq("mosque_id", mosqueId);

    if (result.error) {
      console.warn(
        "MosqueTrustBadges Jumuah data unavailable:",
        {
          mosqueId,
          code: result.error.code,
          message: result.error.message,
        }
      );

      return {
        rows: [],
        available: false,
      };
    }

    return {
      rows:
        (result.data ??
          []) as unknown as JumuahRow[],
      available: true,
    };
  } catch (error) {
    console.warn(
      "MosqueTrustBadges Jumuah lookup failed:",
      {
        mosqueId,
        message:
          error instanceof Error
            ? error.message
            : "Unknown error",
      }
    );

    return {
      rows: [],
      available: false,
    };
  }
}

function buildMetrics({
  prayerRows,
  jumuahRows,
  jumuahAvailable,
}: {
  prayerRows: PrayerTimeRow[];
  jumuahRows: JumuahRow[];
  jumuahAvailable: boolean;
}): TimetableMetrics {
  const uniquePrayerDates =
    new Set(
      prayerRows
        .map((row) =>
          cleanString(
            row.prayer_date,
            20
          )
        )
        .filter(Boolean)
    );

  const existingDays =
    uniquePrayerDates.size;

  const missingDays =
    Math.max(
      0,
      DAYS_TO_CHECK - existingDays
    );

  const missingBegins =
    prayerRows.reduce(
      (total, row) =>
        total +
        getMissingBeginsCount(row),
      0
    );

  const missingIqamah =
    prayerRows.reduce(
      (total, row) =>
        total +
        getMissingIqamahCount(row),
      0
    );

  const lowConfidenceRows =
    prayerRows.filter(
      (row) =>
        getRowConfidenceTone(row) ===
        "danger"
    ).length;

  const trustedRows =
    prayerRows.filter(
      (row) =>
        getRowConfidenceTone(row) ===
        "good"
    ).length;

  const activeJumuahRows =
    jumuahRows.filter((row) => {
      if (row.active === false) {
        return false;
      }

      return jumuahHasTime(row);
    }).length;

  const timetableAvailable =
    existingDays > 0;

  const healthScore =
    calculateHealthScore({
      totalDays: DAYS_TO_CHECK,
      existingRows: existingDays,
      missingBegins,
      missingIqamah,
      lowConfidenceRows,
      trustedRows,
      activeJumuahRows,
      jumuahAvailable,
    });

  return {
    existingDays,
    missingDays,
    missingBegins,
    missingIqamah,
    lowConfidenceRows,
    trustedRows,
    activeJumuahRows,
    timetableAvailable,
    jumuahAvailable,
    healthScore,
  };
}

function buildIndicators({
  metrics,
  verifiedStatus,
}: {
  metrics: TimetableMetrics;
  verifiedStatus:
    | string
    | null
    | undefined;
}): TrustIndicator[] {
  const healthLabel =
    getHealthLabel(
      metrics.healthScore,
      metrics.timetableAvailable
    );

  const jumuahLabel =
    !metrics.jumuahAvailable
      ? "Status unavailable"
      : metrics.activeJumuahRows > 0
        ? `${metrics.activeJumuahRows} confirmed`
        : "Not confirmed";

  return [
    {
      key: "health",
      label: "Timetable health",
      value: metrics.timetableAvailable
        ? `${metrics.healthScore}/100`
        : "No data",
      description: healthLabel,
      tone: getHealthTone(
        metrics.healthScore,
        metrics.timetableAvailable
      ),
    },
    {
      key: "coverage",
      label: "30-day coverage",
      value: `${metrics.existingDays}/${DAYS_TO_CHECK}`,
      description:
        metrics.missingDays === 0
          ? "Full upcoming coverage"
          : `${metrics.missingDays} day${
              metrics.missingDays === 1
                ? ""
                : "s"
            } missing`,
      tone: coverageTone(
        metrics.existingDays
      ),
    },
    {
      key: "begins",
      label: "Beginning times",
      value:
        metrics.missingBegins === 0
          ? "Complete"
          : `${metrics.missingBegins} gap${
              metrics.missingBegins === 1
                ? ""
                : "s"
            }`,
      description:
        metrics.missingBegins === 0
          ? "All available rows are complete"
          : "Some prayer beginnings are missing",
      tone: metrics.timetableAvailable
        ? gapTone(
            metrics.missingBegins,
            8
          )
        : "neutral",
    },
    {
      key: "iqamah",
      label: "Iqamah data",
      value:
        metrics.missingIqamah === 0
          ? "Complete"
          : `${metrics.missingIqamah} gap${
              metrics.missingIqamah === 1
                ? ""
                : "s"
            }`,
      description:
        metrics.missingIqamah === 0
          ? "All available rows include iqamah data"
          : "Some congregation times are missing",
      tone: metrics.timetableAvailable
        ? gapTone(
            metrics.missingIqamah,
            10
          )
        : "neutral",
    },
    {
      key: "jumuah",
      label: "Jumu’ah sessions",
      value: jumuahLabel,
      description:
        !metrics.jumuahAvailable
          ? "Jumu’ah information could not be checked"
          : metrics.activeJumuahRows > 0
            ? "Active Friday prayer sessions found"
            : "Friday prayer times need confirmation",
      tone:
        !metrics.jumuahAvailable
          ? "neutral"
          : metrics.activeJumuahRows > 0
            ? "good"
            : "warning",
    },
    {
      key: "verification",
      label: "Mosque verification",
      value: formatLabel(
        verifiedStatus,
        "Not confirmed"
      ),
      description:
        "Current mosque profile verification status",
      tone: verificationTone(
        verifiedStatus
      ),
    },
    {
      key: "confidence",
      label: "Data confidence",
      value:
        !metrics.timetableAvailable
          ? "No timetable"
          : metrics.lowConfidenceRows === 0
            ? "No warnings"
            : `${metrics.lowConfidenceRows} warning${
                metrics.lowConfidenceRows === 1
                  ? ""
                  : "s"
              }`,
      description:
        !metrics.timetableAvailable
          ? "Confidence will appear after timetable publication"
          : metrics.lowConfidenceRows === 0
            ? `${metrics.trustedRows} trusted row${
                metrics.trustedRows === 1
                  ? ""
                  : "s"
              } detected`
            : "Some timetable rows need review",
      tone:
        !metrics.timetableAvailable
          ? "neutral"
          : metrics.lowConfidenceRows === 0
            ? "good"
            : "warning",
    },
  ];
}

export default async function MosqueTrustBadges({
  mosqueId,
  mosqueSlug,
  timezone,
  verifiedStatus,
  showManagerLink = false,
}: Props) {
  const cleanMosqueId =
    cleanString(mosqueId, 80);

  const safeMosqueSlug =
    cleanSlug(mosqueSlug);

  if (
    !UUID_REGEX.test(cleanMosqueId)
  ) {
    return (
      <TrustUnavailable
        mosqueSlug={safeMosqueSlug}
        message="Timetable reliability information is unavailable because this mosque record could not be validated."
      />
    );
  }

  const safeTimezone =
    getSafeTimezone(timezone);

  const today =
    getTodayDateForTimezone(
      safeTimezone
    );

  const endDate = addDays(
    today,
    DAYS_TO_CHECK - 1
  );

  const [
    prayerTimesResult,
    jumuahResult,
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
      .eq(
        "mosque_id",
        cleanMosqueId
      )
      .gte(
        "prayer_date",
        today
      )
      .lte(
        "prayer_date",
        endDate
      )
      .order("prayer_date", {
        ascending: true,
      }),

    loadJumuahRows(
      cleanMosqueId
    ),
  ]);

  if (prayerTimesResult.error) {
    console.warn(
      "MosqueTrustBadges prayer-time data unavailable:",
      {
        mosqueId: cleanMosqueId,
        code:
          prayerTimesResult.error.code,
        message:
          prayerTimesResult.error
            .message,
      }
    );

    return (
      <TrustUnavailable
        mosqueSlug={safeMosqueSlug}
        message="Timetable reliability information is temporarily unavailable. The public mosque profile can still be used."
      />
    );
  }

  const prayerRows =
    (prayerTimesResult.data ??
      []) as unknown as PrayerTimeRow[];

  const metrics = buildMetrics({
    prayerRows,
    jumuahRows:
      jumuahResult.rows,
    jumuahAvailable:
      jumuahResult.available,
  });

  const indicators =
    buildIndicators({
      metrics,
      verifiedStatus,
    });

  const healthLabel =
    getHealthLabel(
      metrics.healthScore,
      metrics.timetableAvailable
    );

  const healthTone =
    getHealthTone(
      metrics.healthScore,
      metrics.timetableAvailable
    );

  return (
    <section
      aria-labelledby="mosque-trust-heading"
      className="premium-panel relative overflow-hidden rounded-[2rem] p-5 sm:p-7"
    >
      <div
        aria-hidden="true"
        className="absolute -right-24 -top-24 h-72 w-72 rounded-full border border-yellow-400/10 bg-yellow-400/[0.025]"
      />

      <div className="relative">
        <div className="flex flex-col gap-5 border-b border-white/10 pb-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="section-kicker">
              Mosque data trust
            </div>

            <h2
              id="mosque-trust-heading"
              className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl"
            >
              Timetable reliability
            </h2>

            <p className="mt-3 text-sm leading-7 text-white/55 sm:text-base">
              These indicators assess upcoming
              timetable coverage, beginning-time
              completeness, iqamah availability,
              Jumu’ah information and data
              confidence for the next{" "}
              {DAYS_TO_CHECK} days.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div
              className={`inline-flex min-w-40 items-center gap-3 rounded-2xl border px-4 py-3 ${badgeClass(
                healthTone
              )}`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${iconClass(
                  healthTone
                )}`}
              >
                {getToneIcon(
                  healthTone
                )}
              </span>

              <span>
                <span className="block text-[0.62rem] font-black uppercase tracking-[0.16em] opacity-70">
                  Overall status
                </span>

                <span className="mt-0.5 block text-sm font-black">
                  {healthLabel}

                  {metrics.timetableAvailable
                    ? ` · ${metrics.healthScore}/100`
                    : ""}
                </span>
              </span>
            </div>

            {showManagerLink ? (
              <Link
                href={`/business-dashboard/mosques/${cleanMosqueId}/data-quality`}
                className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-xs font-bold text-cyan-200 transition hover:bg-cyan-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              >
                View data quality
              </Link>
            ) : null}
          </div>
        </div>

        {!metrics.timetableAvailable ? (
          <div className="mt-6 rounded-3xl border border-yellow-500/20 bg-yellow-500/[0.07] p-5">
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-yellow-500/25 bg-yellow-500/10 text-yellow-300"
              >
                !
              </span>

              <div>
                <h3 className="font-black text-yellow-100">
                  No upcoming mosque timetable
                </h3>

                <p className="mt-1 text-sm leading-6 text-yellow-100/65">
                  No mosque-specific prayer rows
                  were found for the next{" "}
                  {DAYS_TO_CHECK} days. The
                  reliability score will update
                  automatically once timetable
                  information is published.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {indicators.map(
            (indicator) => (
              <TrustIndicatorCard
                key={indicator.key}
                indicator={indicator}
              />
            )
          )}
        </div>

        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/25 p-4 text-xs leading-6 text-white/45 sm:flex-row sm:items-center sm:justify-between">
          <div>
            Assessment window:{" "}
            <span className="font-semibold text-white/65">
              {today}
            </span>{" "}
            to{" "}
            <span className="font-semibold text-white/65">
              {endDate}
            </span>{" "}
            · {safeTimezone}
          </div>

          {safeMosqueSlug ? (
            <Link
              href={`/mosque/${safeMosqueSlug}/timetable`}
              className="shrink-0 font-bold text-yellow-300 transition hover:text-yellow-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"
            >
              View monthly timetable →
            </Link>
          ) : null}
        </div>

        <p className="mt-4 text-[0.7rem] leading-5 text-white/35">
          Reliability indicators describe the
          quality and completeness of information
          currently stored by SalahNearMe. They do
          not guarantee that times will remain
          unchanged. Confirm important prayer
          details directly with the mosque.
        </p>
      </div>
    </section>
  );
}

function TrustIndicatorCard({
  indicator,
}: {
  indicator: TrustIndicator;
}) {
  return (
    <article className="premium-inset group relative overflow-hidden rounded-3xl p-5 transition duration-300 hover:-translate-y-0.5 hover:border-yellow-400/25">
      <div
        aria-hidden="true"
        className="absolute -right-12 -top-12 h-28 w-28 rounded-full border border-yellow-400/[0.07] bg-yellow-400/[0.02] transition duration-500 group-hover:scale-110"
      />

      <div className="relative flex items-start justify-between gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${iconClass(
            indicator.tone
          )}`}
        >
          {getToneIcon(
            indicator.tone
          )}
        </span>

        <span
          className={`rounded-full border px-2.5 py-1 text-[0.62rem] font-black ${badgeClass(
            indicator.tone
          )}`}
        >
          {indicator.value ?? "—"}
        </span>
      </div>

      <h3 className="relative mt-4 text-sm font-black text-white">
        {indicator.label}
      </h3>

      <p className="relative mt-2 text-xs leading-6 text-white/48">
        {indicator.description}
      </p>
    </article>
  );
}

function TrustUnavailable({
  mosqueSlug,
  message,
}: {
  mosqueSlug?: string | null;
  message: string;
}) {
  return (
    <section className="premium-panel rounded-[2rem] p-5 sm:p-7">
      <div className="section-kicker">
        Mosque data trust
      </div>

      <h2 className="mt-3 text-2xl font-black text-white sm:text-3xl">
        Timetable reliability
      </h2>

      <div
        role="status"
        className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm leading-7 text-white/55"
      >
        {message}
      </div>

      {mosqueSlug ? (
        <Link
          href={`/mosque/${mosqueSlug}/timetable`}
          className="premium-button-outline mt-5 px-4 py-2.5 text-sm"
        >
          View public timetable
        </Link>
      ) : null}
    </section>
  );
}