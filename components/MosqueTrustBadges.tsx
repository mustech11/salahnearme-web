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
  is_active?: boolean | null;
  start_time?: string | null;
  khutbah_time?: string | null;
  prayer_time?: string | null;
};

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

function getTodayDateForTimezone(timezone: string | null | undefined) {
  try {
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone || "Europe/London",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

    const parts = formatter.formatToParts(new Date());

    const day = parts.find((part) => part.type === "day")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const year = parts.find((part) => part.type === "year")?.value;

    if (!day || !month || !year) {
      return new Date().toISOString().slice(0, 10);
    }

    return `${year}-${month}-${day}`;
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function addDays(dateString: string, days: number) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function isMissing(value: string | null | undefined) {
  return !value || value.trim().length === 0;
}

function formatLabel(value: string | null | undefined) {
  if (!value) {
    return "Unknown";
  }

  return value
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getMissingBeginsCount(row: PrayerTimeRow) {
  return BEGINS_FIELDS.filter((field) => isMissing(row[field])).length;
}

function getMissingIqamahCount(row: PrayerTimeRow) {
  return IQAMAH_FIELDS.filter((field) => isMissing(row[field])).length;
}

function getConfidenceStatus(row: PrayerTimeRow) {
  const text = `${row.confidence ?? ""} ${row.source ?? ""}`.toLowerCase();

  if (
    text.includes("official") ||
    text.includes("verified") ||
    text.includes("mosque")
  ) {
    return "good";
  }

  if (
    text.includes("needs") ||
    text.includes("low") ||
    text.includes("unverified")
  ) {
    return "danger";
  }

  return "warning";
}

function jumuahHasTime(row: JumuahRow) {
  return Boolean(row.start_time || row.khutbah_time || row.prayer_time);
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
}) {
  let score = 100;

  const missingDays = Math.max(0, totalDays - existingRows);

  score -= missingDays * 3;
  score -= missingBegins * 2;
  score -= Math.ceil(missingIqamah * 0.8);
  score -= lowConfidenceRows * 2;

  if (activeJumuahRows === 0) {
    score -= 10;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function scoreLabel(score: number) {
  if (score >= 85) return "Strong";
  if (score >= 70) return "Good";
  if (score >= 50) return "Needs attention";
  return "Weak";
}

function badgeClass(type: "good" | "warning" | "danger" | "neutral") {
  if (type === "good") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }

  if (type === "danger") {
    return "border-red-500/30 bg-red-500/10 text-red-300";
  }

  if (type === "warning") {
    return "border-yellow-500/30 bg-yellow-500/10 text-yellow-300";
  }

  return "border-white/10 bg-white/5 text-white/70";
}

function healthType(score: number) {
  if (score >= 70) return "good";
  if (score >= 50) return "warning";
  return "danger";
}

export default async function MosqueTrustBadges({
  mosqueId,
  mosqueSlug,
  timezone,
  verifiedStatus,
  showManagerLink = false,
}: Props) {
  const today = getTodayDateForTimezone(timezone);
  const days = 30;
  const endDate = addDays(today, days - 1);

  const { data: prayerRowsRaw } = await supabaseAdmin
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
    .eq("mosque_id", mosqueId)
    .gte("prayer_date", today)
    .lte("prayer_date", endDate);

  const { data: jumuahRowsRaw } = await supabaseAdmin
    .from("mosque_jumuah_times")
    .select("is_active, start_time, khutbah_time, prayer_time")
    .eq("mosque_id", mosqueId);

  const prayerRows = (prayerRowsRaw ?? []) as PrayerTimeRow[];
  const jumuahRows = (jumuahRowsRaw ?? []) as JumuahRow[];

  const missingBegins = prayerRows.reduce(
    (total, row) => total + getMissingBeginsCount(row),
    0
  );

  const missingIqamah = prayerRows.reduce(
    (total, row) => total + getMissingIqamahCount(row),
    0
  );

  const lowConfidenceRows = prayerRows.filter(
    (row) => getConfidenceStatus(row) === "danger"
  ).length;

  const activeJumuahRows = jumuahRows.filter((row) => {
    if (row.is_active === false) {
      return false;
    }

    return jumuahHasTime(row);
  }).length;

  const healthScore = calculateHealthScore({
    totalDays: days,
    existingRows: prayerRows.length,
    missingBegins,
    missingIqamah,
    lowConfidenceRows,
    activeJumuahRows,
  });

  const health = scoreLabel(healthScore);
  const coverageType =
    prayerRows.length >= 25 ? "good" : prayerRows.length >= 15 ? "warning" : "danger";

  const iqamahType =
    missingIqamah === 0 ? "good" : missingIqamah <= 10 ? "warning" : "danger";

  const jumuahType = activeJumuahRows > 0 ? "good" : "warning";

  return (
    <section className="rounded-3xl border border-white/10 bg-black/20 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-yellow-400">
            Mosque data trust
          </div>

          <h2 className="mt-2 text-xl font-black text-white">
            Timetable reliability
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-7 text-white/55">
            These badges help users understand whether the timetable is complete,
            verified, imported, or still needs mosque review.
          </p>
        </div>

        {showManagerLink ? (
          <Link
            href={`/business-dashboard/mosques/${mosqueId}/data-quality`}
            className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-500/20"
          >
            View data quality
          </Link>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <TrustBadge
          label={`Timetable health: ${health}`}
          className={badgeClass(healthType(healthScore))}
        />

        <TrustBadge
          label={`30-day coverage: ${prayerRows.length}/${days}`}
          className={badgeClass(coverageType)}
        />

        <TrustBadge
          label={
            missingIqamah === 0
              ? "Iqamah data complete"
              : `Iqamah gaps: ${missingIqamah}`
          }
          className={badgeClass(iqamahType)}
        />

        <TrustBadge
          label={
            activeJumuahRows > 0
              ? `${activeJumuahRows} Jumuʿah session${
                  activeJumuahRows === 1 ? "" : "s"
                }`
              : "Jumuʿah time not confirmed"
          }
          className={badgeClass(jumuahType)}
        />

        <TrustBadge
          label={formatLabel(verifiedStatus)}
          className={badgeClass(
            (verifiedStatus ?? "").toLowerCase().includes("verified") ||
              (verifiedStatus ?? "").toLowerCase().includes("approved")
              ? "good"
              : (verifiedStatus ?? "").toLowerCase().includes("auto")
                ? "warning"
                : "neutral"
          )}
        />

        {lowConfidenceRows > 0 ? (
          <TrustBadge
            label={`${lowConfidenceRows} low-confidence rows`}
            className={badgeClass("warning")}
          />
        ) : (
          <TrustBadge
            label="No low-confidence rows"
            className={badgeClass("good")}
          />
        )}
      </div>

      {mosqueSlug ? (
        <div className="mt-4 text-xs text-white/40">
          Public timetable:{" "}
          <Link
            href={`/mosque/${mosqueSlug}/timetable`}
            className="text-yellow-300 underline hover:text-yellow-200"
          >
            view monthly timetable
          </Link>
        </div>
      ) : null}
    </section>
  );
}

function TrustBadge({
  label,
  className,
}: {
  label: string;
  className: string;
}) {
  return (
    <span className={`rounded-full border px-3 py-2 text-xs font-bold ${className}`}>
      {label}
    </span>
  );
}

