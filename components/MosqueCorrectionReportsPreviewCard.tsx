import Link from "next/link";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Props = {
  mosqueId: string;
};

type CorrectionStatus =
  | "new"
  | "reviewing"
  | "resolved"
  | "rejected";

type CorrectionReportRow = {
  id: string;
  report_type: string | null;
  status: string | null;
  created_at: string | null;
};

type ReportCounts = {
  total: number;
  open: number;
  new: number;
  reviewing: number;
  resolved: number;
  rejected: number;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PREVIEW_LIMIT = 20;

function cleanText(
  value: string | null | undefined
): string | null {
  const cleaned = value?.trim();

  return cleaned ? cleaned : null;
}

function normaliseStatus(
  value: string | null | undefined
): CorrectionStatus | null {
  const status = cleanText(value)?.toLowerCase();

  if (
    status === "new" ||
    status === "reviewing" ||
    status === "resolved" ||
    status === "rejected"
  ) {
    return status;
  }

  return null;
}

function formatLabel(
  value: string | null | undefined
): string {
  const cleaned = cleanText(value);

  if (!cleaned) {
    return "Unknown";
  }

  return cleaned
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

function formatShortDate(
  value: string | null | undefined
): string {
  if (!value) {
    return "Unknown date";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  }).format(date);
}

function getCounts(
  reports: CorrectionReportRow[]
): ReportCounts {
  const counts: ReportCounts = {
    total: reports.length,
    open: 0,
    new: 0,
    reviewing: 0,
    resolved: 0,
    rejected: 0,
  };

  for (const report of reports) {
    const status = normaliseStatus(report.status);

    if (!status) {
      continue;
    }

    counts[status] += 1;

    if (
      status === "new" ||
      status === "reviewing"
    ) {
      counts.open += 1;
    }
  }

  return counts;
}

function getOpenTone(count: number): string {
  return count > 0
    ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-300"
    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
}

function getOpenMessage(count: number): string {
  if (count === 0) {
    return "All correction reports are currently clear.";
  }

  if (count === 1) {
    return "1 correction report needs attention.";
  }

  return `${count.toLocaleString()} correction reports need attention.`;
}

function getStatusTone(
  value: string | null | undefined
): string {
  const status = normaliseStatus(value);

  if (status === "new") {
    return "border-yellow-500/30 bg-yellow-500/10 text-yellow-300";
  }

  if (status === "reviewing") {
    return "border-cyan-500/30 bg-cyan-500/10 text-cyan-300";
  }

  if (status === "resolved") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }

  if (status === "rejected") {
    return "border-red-500/30 bg-red-500/10 text-red-300";
  }

  return "border-white/10 bg-white/5 text-white/60";
}

export default async function MosqueCorrectionReportsPreviewCard({
  mosqueId,
}: Props) {
  if (!UUID_REGEX.test(mosqueId)) {
    return (
      <ErrorPanel message="A valid mosque is required to load correction reports." />
    );
  }

  const { data, error } = await supabaseAdmin
    .from("mosque_correction_reports")
    .select("id,report_type,status,created_at")
    .eq("mosque_id", mosqueId)
    .order("created_at", {
      ascending: false,
    })
    .limit(PREVIEW_LIMIT);

  if (error) {
    console.error(
      "Correction report preview load failed:",
      {
        mosqueId,
        code: error.code,
        message: error.message,
      }
    );

    return (
      <ErrorPanel message="Could not load the correction-report summary." />
    );
  }

  const reports =
    (data ?? []) as CorrectionReportRow[];

  const counts = getCounts(reports);
  const latest = reports[0] ?? null;

  return (
    <section
      aria-labelledby="correction-reports-preview-heading"
      className="mt-5 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-5"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-cyan-300">
            Correction reports
          </div>

          <h3
            id="correction-reports-preview-heading"
            className="mt-2 text-lg font-bold text-white"
          >
            Public issue reports
          </h3>

          <p className="mt-1 text-sm leading-6 text-white/60">
            Review reports submitted about mosque details,
            facilities, prayer times and public information.
          </p>
        </div>

        <Link
          href={`/business-dashboard/mosques/${mosqueId}/correction-reports`}
          className="w-fit rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-xs font-black text-cyan-300 transition hover:bg-cyan-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
        >
          View reports
        </Link>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MiniMetric
          label="Open"
          value={counts.open}
          tone={getOpenTone(counts.open)}
        />

        <MiniMetric
          label="New"
          value={counts.new}
        />

        <MiniMetric
          label="Reviewing"
          value={counts.reviewing}
        />

        <MiniMetric
          label="Resolved"
          value={counts.resolved}
        />
      </div>

      <div
        className={`mt-4 rounded-xl border p-4 text-sm font-medium ${getOpenTone(
          counts.open
        )}`}
      >
        {getOpenMessage(counts.open)}
      </div>

      {latest ? (
        <article className="mt-4 rounded-xl border border-white/10 bg-black/25 p-4 text-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-white/40">
                Latest report
              </div>

              <div className="mt-1 font-bold text-white">
                {formatLabel(latest.report_type)}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusTone(
                  latest.status
                )}`}
              >
                {formatLabel(latest.status)}
              </span>

              <time
                dateTime={
                  latest.created_at ?? undefined
                }
                className="text-xs text-white/45"
              >
                {formatShortDate(latest.created_at)}
              </time>
            </div>
          </div>
        </article>
      ) : (
        <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">
          No correction reports have been submitted yet.
        </div>
      )}

      {counts.total >= PREVIEW_LIMIT ? (
        <p className="mt-3 text-xs text-white/40">
          Showing the latest {PREVIEW_LIMIT} reports.
        </p>
      ) : null}
    </section>
  );
}

function ErrorPanel({
  message,
}: {
  message: string;
}) {
  return (
    <section
      role="alert"
      className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-200"
    >
      {message}
    </section>
  );
}

function MiniMetric({
  label,
  value,
  tone = "border-white/10 bg-black/30 text-white",
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${tone}`}
    >
      <div className="text-xs uppercase tracking-[0.18em] opacity-60">
        {label}
      </div>

      <div className="mt-2 text-2xl font-black">
        {value.toLocaleString("en-GB")}
      </div>
    </div>
  );
}