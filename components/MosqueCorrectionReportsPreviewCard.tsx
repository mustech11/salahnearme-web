import Link from "next/link";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Props = {
  mosqueId: string;
};

type CorrectionReportRow = {
  id: string;
  report_type: string;
  status: string;
  created_at: string;
};

function formatLabel(value: string | null | undefined) {
  if (!value) {
    return "Unknown";
  }

  return value
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatShortDate(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/London",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function getCounts(reports: CorrectionReportRow[]) {
  const openReports = reports.filter(
    (report) => report.status === "new" || report.status === "reviewing"
  );

  return {
    total: reports.length,
    open: openReports.length,
    new: reports.filter((report) => report.status === "new").length,
    reviewing: reports.filter((report) => report.status === "reviewing").length,
    resolved: reports.filter((report) => report.status === "resolved").length,
    rejected: reports.filter((report) => report.status === "rejected").length,
  };
}

function openTone(count: number) {
  if (count > 0) {
    return "border-yellow-500/30 bg-yellow-500/10 text-yellow-300";
  }

  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
}

function getOpenMessage(count: number) {
  if (count === 0) {
    return "All correction reports are currently clear.";
  }

  if (count === 1) {
    return "1 correction report needs attention.";
  }

  return `${count} correction reports need attention.`;
}

export default async function MosqueCorrectionReportsPreviewCard({
  mosqueId,
}: Props) {
  const { data, error } = await supabaseAdmin
    .from("mosque_correction_reports")
    .select("id, report_type, status, created_at")
    .eq("mosque_id", mosqueId)
    .order("created_at", {
      ascending: false,
    })
    .limit(20);

  if (error) {
    return (
      <section className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-200">
        Could not load correction report summary.
      </section>
    );
  }

  const reports = (data ?? []) as CorrectionReportRow[];
  const counts = getCounts(reports);
  const latest = reports[0] ?? null;

  return (
    <section className="mt-5 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-cyan-300">
            Correction reports
          </div>

          <p className="mt-2 text-sm text-white/60">
            Public user issue reports for this mosque.
          </p>
        </div>

        <Link
          href={`/business-dashboard/mosques/${mosqueId}/correction-reports`}
          className="w-fit rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-xs font-black text-cyan-300 hover:bg-cyan-500/20"
        >
          View reports
        </Link>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        <MiniMetric
          label="Open"
          value={counts.open}
          tone={openTone(counts.open)}
        />

        <MiniMetric label="New" value={counts.new} />
        <MiniMetric label="Reviewing" value={counts.reviewing} />
        <MiniMetric label="Resolved" value={counts.resolved} />
      </div>

      <div
        className={`mt-4 rounded-xl border p-4 text-sm ${openTone(
          counts.open
        )}`}
      >
        {getOpenMessage(counts.open)}
      </div>

      {latest ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/25 p-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-white/40">Latest:</span>{" "}
              <span className="font-bold text-white">
                {formatLabel(latest.report_type)}
              </span>
            </div>

            <div className="text-white/45">
              {formatShortDate(latest.created_at)}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">
          No correction reports have been submitted yet.
        </div>
      )}
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
    <div className={`rounded-xl border p-4 ${tone}`}>
      <div className="text-xs uppercase tracking-[0.18em] opacity-60">
        {label}
      </div>

      <div className="mt-2 text-2xl font-black">{value}</div>
    </div>
  );
}

