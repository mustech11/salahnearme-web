import Link from "next/link";
import { notFound } from "next/navigation";

import { requireMosqueManager } from "@/lib/mosqueManagerAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    mosqueId: string;
  }>;
};

type MosqueRow = {
  id: string;
  name: string | null;
  slug: string | null;
  city: string | null;
  area: string | null;
  postcode: string | null;
  timezone: string | null;
  verified_status: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
};

type PrayerTimeRow = {
  id: string;
  mosque_id: string;
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
  notes: string | null;
};

type JumuahRow = {
  id: string;
  mosque_id: string;
  label?: string | null;
  title?: string | null;
  start_time?: string | null;
  khutbah_time?: string | null;
  salah_time?: string | null;
  prayer_time?: string | null;
  active?: boolean | null;
  is_active?: boolean | null;
};

type TimetableSourceRow = {
  id: string;
  source_url?: string | null;
  source_type?: string | null;
  auto_import_enabled?: boolean | null;
  last_checked_at?: string | null;
  last_success_at?: string | null;
  last_error?: string | null;
};

type CorrectionReportRow = {
  id: string;
  status: string | null;
  report_type: string | null;
  created_at: string | null;
};

type Issue = {
  label: string;
  description: string;
  severity: "good" | "warning" | "danger";
  href?: string;
};

const PRAYER_IQAMAH_FIELDS = [
  "fajr_iqamah",
  "dhuhr_iqamah",
  "asr_iqamah",
  "maghrib_iqamah",
  "isha_iqamah",
] as const;

const PRAYER_BEGINS_FIELDS = [
  "fajr_begins",
  "sunrise",
  "dhuhr_begins",
  "asr_begins",
  "maghrib_begins",
  "isha_begins",
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

function buildDateRange(startDate: string, days: number) {
  return Array.from({ length: days }, (_, index) => addDays(startDate, index));
}

function formatDateLabel(dateString: string) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      day: "2-digit",
      month: "short",
    }).format(new Date(`${dateString}T00:00:00.000Z`));
  } catch {
    return dateString;
  }
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
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

function isMissing(value: string | null | undefined) {
  return !value || value.trim().length === 0;
}

function getMissingBeginsCount(row: PrayerTimeRow) {
  return PRAYER_BEGINS_FIELDS.filter((field) => isMissing(row[field])).length;
}

function getMissingIqamahCount(row: PrayerTimeRow) {
  return PRAYER_IQAMAH_FIELDS.filter((field) => isMissing(row[field])).length;
}

function getConfidenceStatus(row: PrayerTimeRow) {
  const text = `${row.confidence ?? ""} ${row.source ?? ""} ${
    row.notes ?? ""
  }`.toLowerCase();

  if (
    text.includes("official") ||
    text.includes("verified") ||
    text.includes("mosque") ||
    text.includes("manual")
  ) {
    return "good";
  }

  if (
    text.includes("needs") ||
    text.includes("low") ||
    text.includes("unverified") ||
    text.includes("unknown") ||
    text.includes("failed")
  ) {
    return "danger";
  }

  return "warning";
}

function jumuahHasTime(row: JumuahRow) {
  return Boolean(
    row.salah_time || row.prayer_time || row.start_time || row.khutbah_time
  );
}

function jumuahIsActive(row: JumuahRow) {
  if (row.active === false || row.is_active === false) {
    return false;
  }

  return jumuahHasTime(row);
}

function hasCoordinates(mosque: MosqueRow) {
  const latitude = Number(mosque.latitude);
  const longitude = Number(mosque.longitude);

  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function calculateHealthScore({
  totalDays,
  existingRows,
  missingBegins,
  missingIqamah,
  lowConfidenceRows,
  activeJumuahRows,
  sourceRows,
  openCorrectionReports,
  hasLocationCoordinates,
}: {
  totalDays: number;
  existingRows: number;
  missingBegins: number;
  missingIqamah: number;
  lowConfidenceRows: number;
  activeJumuahRows: number;
  sourceRows: number;
  openCorrectionReports: number;
  hasLocationCoordinates: boolean;
}) {
  let score = 100;

  const missingDays = Math.max(0, totalDays - existingRows);

  score -= missingDays * 3;
  score -= missingBegins * 2;
  score -= Math.ceil(missingIqamah * 0.8);
  score -= lowConfidenceRows * 2;
  score -= Math.min(openCorrectionReports * 3, 15);

  if (activeJumuahRows === 0) {
    score -= 10;
  }

  if (sourceRows === 0) {
    score -= 6;
  }

  if (!hasLocationCoordinates) {
    score -= 8;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function scoreLabel(score: number) {
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

function scoreClass(score: number) {
  if (score >= 85) {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }

  if (score >= 70) {
    return "border-cyan-500/30 bg-cyan-500/10 text-cyan-300";
  }

  if (score >= 50) {
    return "border-yellow-500/30 bg-yellow-500/10 text-yellow-300";
  }

  return "border-red-500/30 bg-red-500/10 text-red-300";
}

function buildIssues({
  mosque,
  missingDates,
  missingBegins,
  missingIqamah,
  lowConfidenceRows,
  activeJumuahRows,
  sourceRows,
  openCorrectionReports,
}: {
  mosque: MosqueRow;
  missingDates: string[];
  missingBegins: number;
  missingIqamah: number;
  lowConfidenceRows: number;
  activeJumuahRows: number;
  sourceRows: number;
  openCorrectionReports: number;
}) {
  const issues: Issue[] = [];
  const base = `/business-dashboard/mosques/${mosque.id}`;

  if (missingDates.length === 0) {
    issues.push({
      label: "30-day coverage complete",
      description: "There is a timetable row for every day in the next 30 days.",
      severity: "good",
    });
  } else {
    issues.push({
      label: `${missingDates.length} missing timetable days`,
      description: `First missing day: ${formatDateLabel(missingDates[0])}.`,
      severity: missingDates.length >= 7 ? "danger" : "warning",
      href: `${base}/prayer-times`,
    });
  }

  if (missingBegins === 0) {
    issues.push({
      label: "Beginning times complete",
      description: "All beginning-time fields are filled in the next 30 days.",
      severity: "good",
    });
  } else {
    issues.push({
      label: `${missingBegins} missing beginning-time fields`,
      description: "Some rows are missing prayer beginning times.",
      severity: missingBegins >= 10 ? "danger" : "warning",
      href: `${base}/prayer-times`,
    });
  }

  if (missingIqamah === 0) {
    issues.push({
      label: "Iqamah times complete",
      description: "All iqamah fields are filled in the next 30 days.",
      severity: "good",
    });
  } else {
    issues.push({
      label: `${missingIqamah} missing iqamah fields`,
      description:
        "Iqamah gaps reduce Pray Near Me accuracy and live prayer guidance.",
      severity: missingIqamah >= 15 ? "danger" : "warning",
      href: `${base}/prayer-times`,
    });
  }

  if (lowConfidenceRows === 0) {
    issues.push({
      label: "No low-confidence rows detected",
      description: "No obvious low-confidence timetable rows were found.",
      severity: "good",
    });
  } else {
    issues.push({
      label: `${lowConfidenceRows} low-confidence rows`,
      description:
        "Rows marked low confidence, needs review, or unverified should be checked.",
      severity: lowConfidenceRows >= 5 ? "danger" : "warning",
      href: `${base}/prayer-times`,
    });
  }

  if (activeJumuahRows > 0) {
    issues.push({
      label: `${activeJumuahRows} Jumuʿah session${
        activeJumuahRows === 1 ? "" : "s"
      } found`,
      description: "Jumuʿah data is available for the public mosque page.",
      severity: "good",
    });
  } else {
    issues.push({
      label: "No active Jumuʿah session found",
      description:
        "Add at least one Jumuʿah time so users can rely on the mosque page.",
      severity: "warning",
      href: `${base}/jumuah-times`,
    });
  }

  if (sourceRows > 0) {
    issues.push({
      label: `${sourceRows} timetable source${
        sourceRows === 1 ? "" : "s"
      } saved`,
      description:
        "Timetable source records help managers and admins audit where data came from.",
      severity: "good",
    });
  } else {
    issues.push({
      label: "No timetable source saved",
      description:
        "Add a timetable source URL or upload/manual source so future reviews are easier.",
      severity: "warning",
      href: `${base}/timetable-sources`,
    });
  }

  if (openCorrectionReports === 0) {
    issues.push({
      label: "No open correction reports",
      description: "No unresolved public correction reports are pending.",
      severity: "good",
    });
  } else {
    issues.push({
      label: `${openCorrectionReports} open correction report${
        openCorrectionReports === 1 ? "" : "s"
      }`,
      description:
        "Review public reports before marking this mosque data as fully reliable.",
      severity: openCorrectionReports >= 5 ? "danger" : "warning",
      href: `${base}/correction-reports`,
    });
  }

  if (hasCoordinates(mosque)) {
    issues.push({
      label: "Coordinates available",
      description:
        "This mosque has usable coordinates for maps and Pray Near Me distance checks.",
      severity: "good",
    });
  } else {
    issues.push({
      label: "Coordinates missing",
      description:
        "Add latitude and longitude so maps, distance ranking, and nearby recommendations are more accurate.",
      severity: "warning",
    });
  }

  return issues;
}

function issueClass(severity: Issue["severity"]) {
  if (severity === "good") {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-100";
  }

  if (severity === "danger") {
    return "border-red-500/20 bg-red-500/10 text-red-100";
  }

  return "border-yellow-500/20 bg-yellow-500/10 text-yellow-100";
}

function rowStatusClass(status: "good" | "warning" | "danger") {
  if (status === "good") {
    return "text-emerald-300";
  }

  if (status === "danger") {
    return "text-red-300";
  }

  return "text-yellow-300";
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <section className="rounded-3xl border border-red-500/20 bg-red-500/10 p-8 text-red-200">
        <div className="text-sm uppercase tracking-[0.22em] text-red-300">
          Could not load data quality
        </div>
        <div className="mt-3 text-sm leading-7">{message}</div>
      </section>
    </main>
  );
}

function MetricCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
      <div className="text-xs uppercase tracking-[0.18em] text-white/40">
        {label}
      </div>

      <div className="mt-3 text-3xl font-black text-white">{value}</div>

      <p className="mt-2 text-sm leading-6 text-white/50">{description}</p>
    </div>
  );
}

function IssueCard({ issue }: { issue: Issue }) {
  const content = (
    <>
      <div className="font-bold">{issue.label}</div>
      <p className="mt-2 text-sm leading-6 opacity-80">{issue.description}</p>
    </>
  );

  if (!issue.href) {
    return (
      <div className={`rounded-2xl border p-4 ${issueClass(issue.severity)}`}>
        {content}
      </div>
    );
  }

  return (
    <Link
      href={issue.href}
      className={`rounded-2xl border p-4 transition hover:brightness-110 ${issueClass(
        issue.severity
      )}`}
    >
      {content}
    </Link>
  );
}

export default async function MosqueDataQualityPage({ params }: PageProps) {
  const { mosqueId } = await params;

  const { data: mosqueRaw, error: mosqueError } = await supabaseAdmin
    .from("mosques")
    .select(
      "id, name, slug, city, area, postcode, timezone, verified_status, latitude, longitude"
    )
    .eq("id", mosqueId)
    .maybeSingle();

  if (mosqueError) {
    return <ErrorPanel message={mosqueError.message} />;
  }

  if (!mosqueRaw) {
    notFound();
  }

  const mosque = mosqueRaw as MosqueRow;

  const permission = await requireMosqueManager(mosque.id);

  if (!permission.ok) {
    return <ErrorPanel message={permission.error} />;
  }

  const today = getTodayDateForTimezone(mosque.timezone);
  const days = 30;
  const endDate = addDays(today, days - 1);
  const dateRange = buildDateRange(today, days);

  const [
    prayerResult,
    jumuahResult,
    sourcesResult,
    correctionReportsResult,
  ] = await Promise.all([
    supabaseAdmin
      .from("mosque_prayer_times")
      .select(
        `
        id,
        mosque_id,
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
        confidence,
        notes
      `
      )
      .eq("mosque_id", mosque.id)
      .gte("prayer_date", today)
      .lte("prayer_date", endDate)
      .order("prayer_date", {
        ascending: true,
      }),

    supabaseAdmin
      .from("mosque_jumuah_times")
      .select("*")
      .eq("mosque_id", mosque.id),

    supabaseAdmin
      .from("mosque_timetable_sources")
      .select("*")
      .eq("mosque_id", mosque.id)
      .order("created_at", {
        ascending: false,
      }),

    supabaseAdmin
      .from("mosque_correction_reports")
      .select("id, status, report_type, created_at")
      .eq("mosque_id", mosque.id)
      .order("created_at", {
        ascending: false,
      })
      .limit(100),
  ]);

  if (prayerResult.error) {
    return <ErrorPanel message={prayerResult.error.message} />;
  }

  if (jumuahResult.error) {
    return <ErrorPanel message={jumuahResult.error.message} />;
  }

  if (sourcesResult.error) {
    return <ErrorPanel message={sourcesResult.error.message} />;
  }

  if (correctionReportsResult.error) {
    return <ErrorPanel message={correctionReportsResult.error.message} />;
  }

  const prayerRows = ((prayerResult.data ?? []) as unknown) as PrayerTimeRow[];
  const jumuahRows = ((jumuahResult.data ?? []) as unknown) as JumuahRow[];
  const sourceRows = ((sourcesResult.data ?? []) as unknown) as TimetableSourceRow[];
  const correctionReports = ((
    correctionReportsResult.data ?? []
  ) as unknown) as CorrectionReportRow[];

  const prayerRowsByDate = new Map(
    prayerRows.map((row) => [row.prayer_date, row])
  );

  const missingDates = dateRange.filter((date) => !prayerRowsByDate.has(date));

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

  const activeJumuahRows = jumuahRows.filter(jumuahIsActive).length;

  const openCorrectionReports = correctionReports.filter((report) => {
    const status = report.status ?? "new";
    return status === "new" || status === "reviewing" || status === "pending";
  }).length;

  const healthScore = calculateHealthScore({
    totalDays: days,
    existingRows: prayerRows.length,
    missingBegins,
    missingIqamah,
    lowConfidenceRows,
    activeJumuahRows,
    sourceRows: sourceRows.length,
    openCorrectionReports,
    hasLocationCoordinates: hasCoordinates(mosque),
  });

  const issues = buildIssues({
    mosque,
    missingDates,
    missingBegins,
    missingIqamah,
    lowConfidenceRows,
    activeJumuahRows,
    sourceRows: sourceRows.length,
    openCorrectionReports,
  });

  const latestSource = sourceRows[0] ?? null;
  const latestCorrectionReport = correctionReports[0] ?? null;

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/business-dashboard/mosques"
            className="text-sm font-semibold text-yellow-400 hover:text-yellow-300"
          >
            ← Back to mosque dashboard
          </Link>

          <h1 className="mt-4 text-4xl font-black text-white">
            Timetable data quality
          </h1>

          <div className="mt-3 text-sm text-white/50">
            {[mosque.name, mosque.area, mosque.city, mosque.postcode]
              .filter(Boolean)
              .join(" • ") || "Location not available"}
          </div>
        </div>

        <div
          className={`rounded-full border px-4 py-2 text-sm font-bold ${scoreClass(
            healthScore
          )}`}
        >
          {scoreLabel(healthScore)} • {healthScore}/100
        </div>
      </div>

      <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6">
        <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-3xl border border-white/10 bg-black/30 p-6">
            <div className="text-sm uppercase tracking-[0.24em] text-yellow-400">
              Timetable health
            </div>

            <div className="mt-4 text-7xl font-black text-white">
              {healthScore}
            </div>

            <div className="mt-2 text-lg font-bold text-yellow-300">
              {scoreLabel(healthScore)}
            </div>

            <p className="mt-4 text-sm leading-7 text-white/60">
              This score estimates how complete and reliable this mosque’s data
              is for public timetable pages, Pray Near Me recommendations, map
              results, and live community guidance.
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href={`/business-dashboard/mosques/${mosque.id}/prayer-times`}
                className="rounded-xl bg-yellow-500 px-4 py-3 text-xs font-black text-black hover:bg-yellow-400"
              >
                Fix prayer times
              </Link>

              <Link
                href={`/business-dashboard/mosques/${mosque.id}/correction-reports`}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-black text-white/80 hover:bg-white/10"
              >
                View reports
              </Link>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <MetricCard
              label="Days covered"
              value={`${prayerRows.length}/${days}`}
              description={`${formatDateLabel(today)} to ${formatDateLabel(
                endDate
              )}`}
            />

            <MetricCard
              label="Missing days"
              value={String(missingDates.length)}
              description={
                missingDates.length > 0
                  ? `First: ${formatDateLabel(missingDates[0])}`
                  : "No missing days in this period"
              }
            />

            <MetricCard
              label="Missing begins"
              value={String(missingBegins)}
              description="Fajr, sunrise, Dhuhr, Asr, Maghrib, and Isha"
            />

            <MetricCard
              label="Missing iqamah"
              value={String(missingIqamah)}
              description="Fajr, Dhuhr, Asr, Maghrib, and Isha jamaʿah fields"
            />

            <MetricCard
              label="Low confidence"
              value={String(lowConfidenceRows)}
              description="Rows that may need review"
            />

            <MetricCard
              label="Jumuʿah sessions"
              value={String(activeJumuahRows)}
              description="Active sessions with a time"
            />

            <MetricCard
              label="Timetable sources"
              value={String(sourceRows.length)}
              description={
                latestSource?.last_success_at
                  ? `Latest success: ${formatDateTime(
                      latestSource.last_success_at
                    )}`
                  : "Saved import/source records"
              }
            />

            <MetricCard
              label="Open reports"
              value={String(openCorrectionReports)}
              description={
                latestCorrectionReport?.created_at
                  ? `Latest: ${formatDateTime(latestCorrectionReport.created_at)}`
                  : "Unresolved public reports"
              }
            />
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-3xl border border-white/10 bg-black/20 p-6">
        <div className="text-sm uppercase tracking-[0.24em] text-yellow-400">
          Recommended fixes
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {issues.map((issue) => (
            <IssueCard key={issue.label} issue={issue} />
          ))}
        </div>
      </section>

      <section className="mt-8 rounded-3xl border border-cyan-500/20 bg-cyan-500/10 p-6">
        <div className="text-sm uppercase tracking-[0.24em] text-cyan-300">
          Audit summary
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-white/40">
              Mosque status
            </div>
            <div className="mt-3 text-lg font-bold text-white">
              {formatLabel(mosque.verified_status)}
            </div>
            <p className="mt-2 text-sm text-white/50">
              Public trust label currently attached to this mosque.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-white/40">
              Timezone
            </div>
            <div className="mt-3 text-lg font-bold text-white">
              {mosque.timezone || "Europe/London"}
            </div>
            <p className="mt-2 text-sm text-white/50">
              Used for today’s date and prayer-time display.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-white/40">
              Coordinates
            </div>
            <div className="mt-3 text-lg font-bold text-white">
              {hasCoordinates(mosque) ? "Available" : "Missing"}
            </div>
            <p className="mt-2 text-sm text-white/50">
              Needed for maps, nearby sorting, and Pray Near Me.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-3xl border border-white/10 bg-black/20 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm uppercase tracking-[0.24em] text-yellow-400">
              Next 30 days
            </div>

            <p className="mt-2 text-sm text-white/50">
              A quick day-by-day check of timetable completeness.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href={`/business-dashboard/mosques/${mosque.id}/prayer-times`}
              className="rounded-xl border border-yellow-500/30 bg-black px-4 py-2 text-xs font-bold text-yellow-400 hover:bg-yellow-500/10"
            >
              Edit prayer times
            </Link>

            <Link
              href={`/business-dashboard/mosques/${mosque.id}/jumuah-times`}
              className="rounded-xl border border-yellow-500/30 bg-black px-4 py-2 text-xs font-bold text-yellow-400 hover:bg-yellow-500/10"
            >
              Edit Jumuʿah
            </Link>

            <Link
              href={`/business-dashboard/mosques/${mosque.id}/timetable-sources`}
              className="rounded-xl border border-yellow-500/30 bg-black px-4 py-2 text-xs font-bold text-yellow-400 hover:bg-yellow-500/10"
            >
              Sources
            </Link>

            {mosque.slug ? (
              <Link
                href={`/mosque/${mosque.slug}/timetable`}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-white/80 hover:bg-white/10"
              >
                Public timetable
              </Link>
            ) : null}
          </div>
        </div>

        <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10">
          <div className="min-w-[760px]">
            <div className="grid grid-cols-[1.2fr_0.9fr_0.9fr_1fr_1fr] bg-white/5 px-4 py-3 text-xs font-bold uppercase tracking-[0.18em] text-white/40">
              <div>Date</div>
              <div>Begins</div>
              <div>Iqamah</div>
              <div>Confidence</div>
              <div>Source</div>
            </div>

            <div className="divide-y divide-white/10">
              {dateRange.map((date) => {
                const row = prayerRowsByDate.get(date);

                if (!row) {
                  return (
                    <div
                      key={date}
                      className="grid grid-cols-[1.2fr_0.9fr_0.9fr_1fr_1fr] px-4 py-3 text-sm text-white/70"
                    >
                      <div>{formatDateLabel(date)}</div>
                      <div className="text-red-300">Missing</div>
                      <div className="text-red-300">Missing</div>
                      <div className="text-red-300">No row</div>
                      <div className="text-red-300">No source</div>
                    </div>
                  );
                }

                const missingBeginsForDay = getMissingBeginsCount(row);
                const missingIqamahForDay = getMissingIqamahCount(row);
                const confidence = getConfidenceStatus(row);

                return (
                  <div
                    key={date}
                    className="grid grid-cols-[1.2fr_0.9fr_0.9fr_1fr_1fr] px-4 py-3 text-sm text-white/70"
                  >
                    <div>{formatDateLabel(date)}</div>

                    <div
                      className={
                        missingBeginsForDay === 0
                          ? "text-emerald-300"
                          : "text-yellow-300"
                      }
                    >
                      {missingBeginsForDay === 0
                        ? "Complete"
                        : `${missingBeginsForDay} missing`}
                    </div>

                    <div
                      className={
                        missingIqamahForDay === 0
                          ? "text-emerald-300"
                          : "text-yellow-300"
                      }
                    >
                      {missingIqamahForDay === 0
                        ? "Complete"
                        : `${missingIqamahForDay} missing`}
                    </div>

                    <div className={rowStatusClass(confidence)}>
                      {formatLabel(row.confidence ?? "Needs review")}
                    </div>

                    <div className="text-white/50">
                      {formatLabel(row.source ?? "Unknown")}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}