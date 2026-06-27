import type { ReactNode } from "react";

import Link from "next/link";
import { notFound } from "next/navigation";

import MosqueCorrectionRecommendedActions from "@/components/MosqueCorrectionRecommendedActions";
import MosqueCorrectionReportActions from "@/components/MosqueCorrectionReportActions";
import { requireMosqueManager } from "@/lib/mosqueManagerAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    mosqueId: string;
  }>;
  searchParams?: Promise<{
    status?: string;
    type?: string;
    q?: string;
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
};

type CorrectionReportRow = {
  id: string;
  mosque_id: string;
  report_type: string;
  report_message: string;
  reporter_name: string | null;
  reporter_email: string | null;
  page_url: string | null;
  metadata: Record<string, unknown> | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
};

const STATUS_OPTIONS = ["all", "new", "reviewing", "resolved", "rejected"];

function formatLabel(value: string | null | undefined) {
  if (!value) {
    return "Unknown";
  }

  return value
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "Unknown";
  }

  try {
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/London",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function getMosqueLocation(mosque: MosqueRow) {
  return (
    [mosque.area, mosque.city, mosque.postcode].filter(Boolean).join(" • ") ||
    "Location not available"
  );
}

function getStatusClass(status: string | null | undefined) {
  const value = (status ?? "").toLowerCase();

  if (value === "resolved") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }

  if (value === "reviewing") {
    return "border-cyan-500/30 bg-cyan-500/10 text-cyan-300";
  }

  if (value === "rejected") {
    return "border-red-500/30 bg-red-500/10 text-red-300";
  }

  return "border-yellow-500/30 bg-yellow-500/10 text-yellow-300";
}

function getTypeClass(reportType: string | null | undefined) {
  const value = (reportType ?? "").toLowerCase();

  if (
    value.includes("wrong") ||
    value.includes("missing") ||
    value.includes("closed")
  ) {
    return "border-yellow-500/30 bg-yellow-500/10 text-yellow-300";
  }

  if (value.includes("duplicate")) {
    return "border-purple-500/30 bg-purple-500/10 text-purple-300";
  }

  return "border-white/10 bg-white/5 text-white/70";
}

function getReportCardClass(status: string | null | undefined) {
  const value = (status ?? "").toLowerCase();

  if (value === "resolved") {
    return "rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-6";
  }

  if (value === "rejected") {
    return "rounded-3xl border border-red-500/20 bg-red-500/5 p-6";
  }

  if (value === "reviewing") {
    return "rounded-3xl border border-cyan-500/20 bg-cyan-500/5 p-6";
  }

  return "rounded-3xl border border-white/10 bg-black/25 p-6";
}

function getMetadataValue(
  metadata: Record<string, unknown> | null,
  key: string
) {
  const value = metadata?.[key];

  if (typeof value === "string" && value.trim()) {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return null;
}

function groupCounts(reports: CorrectionReportRow[]) {
  return {
    total: reports.length,
    open: reports.filter(
      (report) => report.status === "new" || report.status === "reviewing"
    ).length,
    new: reports.filter((report) => report.status === "new").length,
    reviewing: reports.filter((report) => report.status === "reviewing").length,
    resolved: reports.filter((report) => report.status === "resolved").length,
    rejected: reports.filter((report) => report.status === "rejected").length,
  };
}

function getUniqueReportTypes(reports: CorrectionReportRow[]) {
  return Array.from(new Set(reports.map((report) => report.report_type)))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

function normaliseFilter(value: string | undefined, allowedValues: string[]) {
  if (!value) {
    return "all";
  }

  return allowedValues.includes(value) ? value : "all";
}

function cleanSearch(value: string | undefined) {
  return value?.trim().slice(0, 100) ?? "";
}

function reportMatchesSearch(report: CorrectionReportRow, query: string) {
  if (!query) {
    return true;
  }

  const q = query.toLowerCase();

  const searchableText = [
    report.report_type,
    report.report_message,
    report.status,
    report.admin_notes,
    report.reporter_name,
    report.reporter_email,
    report.page_url,
    getMetadataValue(report.metadata, "source"),
    getMetadataValue(report.metadata, "mosque_name"),
    getMetadataValue(report.metadata, "mosque_slug"),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return searchableText.includes(q);
}

function filterReports({
  reports,
  statusFilter,
  typeFilter,
  searchQuery,
}: {
  reports: CorrectionReportRow[];
  statusFilter: string;
  typeFilter: string;
  searchQuery: string;
}) {
  return reports.filter((report) => {
    const statusMatches =
      statusFilter === "all" || report.status === statusFilter;

    const typeMatches =
      typeFilter === "all" || report.report_type === typeFilter;

    const searchMatches = reportMatchesSearch(report, searchQuery);

    return statusMatches && typeMatches && searchMatches;
  });
}

function buildFilterHref({
  mosqueId,
  status,
  type,
  q,
}: {
  mosqueId: string;
  status?: string;
  type?: string;
  q?: string;
}) {
  const params = new URLSearchParams();

  if (status && status !== "all") {
    params.set("status", status);
  }

  if (type && type !== "all") {
    params.set("type", type);
  }

  if (q && q.trim()) {
    params.set("q", q.trim());
  }

  const query = params.toString();

  return `/business-dashboard/mosques/${mosqueId}/correction-reports${
    query ? `?${query}` : ""
  }`;
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <section className="rounded-3xl border border-red-500/20 bg-red-500/10 p-8 text-red-200">
        {message}
      </section>
    </main>
  );
}

function MetricCard({
  label,
  value,
  description,
  href,
  active = false,
}: {
  label: string;
  value: string;
  description: string;
  href?: string;
  active?: boolean;
}) {
  const content = (
    <>
      <div className="text-xs uppercase tracking-[0.18em] text-white/40">
        {label}
      </div>

      <div className="mt-3 text-3xl font-black text-white">{value}</div>

      <p className="mt-2 text-sm leading-6 text-white/50">{description}</p>
    </>
  );

  const className = active
    ? "rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-5"
    : "rounded-2xl border border-white/10 bg-black/30 p-5 hover:bg-white/[0.03]";

  if (!href) {
    return <div className={className}>{content}</div>;
  }

  return (
    <Link href={href} className={className}>
      {content}
    </Link>
  );
}

function Badge({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-bold ${className}`}
    >
      {children}
    </span>
  );
}

export default async function MosqueCorrectionReportsPage({
  params,
  searchParams,
}: PageProps) {
  const { mosqueId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};

  const { data: mosqueRaw, error: mosqueError } = await supabaseAdmin
    .from("mosques")
    .select("id, name, slug, city, area, postcode, timezone, verified_status")
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

  const { data: reportsRaw, error: reportsError } = await supabaseAdmin
    .from("mosque_correction_reports")
    .select(
      `
      id,
      mosque_id,
      report_type,
      report_message,
      reporter_name,
      reporter_email,
      page_url,
      metadata,
      status,
      admin_notes,
      created_at,
      updated_at
    `
    )
    .eq("mosque_id", mosque.id)
    .order("created_at", {
      ascending: false,
    })
    .limit(200);

  if (reportsError) {
    return <ErrorPanel message={reportsError.message} />;
  }

  const reports = (reportsRaw ?? []) as CorrectionReportRow[];
  const reportTypes = getUniqueReportTypes(reports);

  const statusFilter = normaliseFilter(
    resolvedSearchParams.status,
    STATUS_OPTIONS
  );

  const typeFilter = normaliseFilter(resolvedSearchParams.type, [
    "all",
    ...reportTypes,
  ]);

  const searchQuery = cleanSearch(resolvedSearchParams.q);

  const filteredReports = filterReports({
    reports,
    statusFilter,
    typeFilter,
    searchQuery,
  });

  const counts = groupCounts(reports);
  const filteredCounts = groupCounts(filteredReports);
  const hasActiveFilter =
    statusFilter !== "all" || typeFilter !== "all" || searchQuery.length > 0;

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
            Correction reports
          </h1>

          <div className="mt-3 text-sm text-white/50">
            {[mosque.name, getMosqueLocation(mosque)]
              .filter(Boolean)
              .join(" • ")}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href={`/business-dashboard/mosques/${mosque.id}/data-quality`}
            className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-500/20"
          >
            Data quality
          </Link>

          {mosque.slug ? (
            <Link
              href={`/mosque/${mosque.slug}`}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-white/80 hover:bg-white/10"
            >
              Public page
            </Link>
          ) : null}
        </div>
      </div>

      <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6">
        <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
          Mosque data corrections
        </div>

        <h2 className="mt-3 text-3xl font-black text-white">
          Community-submitted issue reports
        </h2>

        <p className="mt-3 max-w-3xl text-sm leading-7 text-white/60">
          Filter, search, review, and resolve public correction reports before
          changing timetable, location, facility, or Jumuʿah data.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <MetricCard
            label="Total"
            value={String(counts.total)}
            description="All reports"
            href={buildFilterHref({ mosqueId: mosque.id })}
            active={!hasActiveFilter}
          />

          <MetricCard
            label="Open"
            value={String(counts.open)}
            description="New + reviewing"
            href={buildFilterHref({ mosqueId: mosque.id, status: "new" })}
          />

          <MetricCard
            label="New"
            value={String(counts.new)}
            description="Not reviewed"
            href={buildFilterHref({ mosqueId: mosque.id, status: "new" })}
            active={statusFilter === "new"}
          />

          <MetricCard
            label="Reviewing"
            value={String(counts.reviewing)}
            description="Being checked"
            href={buildFilterHref({ mosqueId: mosque.id, status: "reviewing" })}
            active={statusFilter === "reviewing"}
          />

          <MetricCard
            label="Resolved"
            value={String(counts.resolved)}
            description="Completed"
            href={buildFilterHref({ mosqueId: mosque.id, status: "resolved" })}
            active={statusFilter === "resolved"}
          />

          <MetricCard
            label="Rejected"
            value={String(counts.rejected)}
            description="Not accepted"
            href={buildFilterHref({ mosqueId: mosque.id, status: "rejected" })}
            active={statusFilter === "rejected"}
          />
        </div>
      </section>

      <section className="mt-8 rounded-3xl border border-cyan-500/20 bg-cyan-500/10 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-sm uppercase tracking-[0.25em] text-cyan-300">
              Filter reports
            </div>

            <p className="mt-2 text-sm text-white/60">
              Showing {filteredReports.length} of {reports.length} reports.
            </p>
          </div>

          {hasActiveFilter ? (
            <Link
              href={buildFilterHref({ mosqueId: mosque.id })}
              className="w-fit rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-xs font-black text-white/70 hover:bg-white/10"
            >
              Clear filters
            </Link>
          ) : null}
        </div>

        <form className="mt-5 grid gap-4 lg:grid-cols-[0.75fr_0.75fr_1.5fr_auto]">
          <select
            name="status"
            defaultValue={statusFilter}
            className="rounded-xl border border-white/10 bg-black px-4 py-3 text-sm font-semibold text-white outline-none focus:border-cyan-500/50"
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status === "all" ? "All statuses" : formatLabel(status)}
              </option>
            ))}
          </select>

          <select
            name="type"
            defaultValue={typeFilter}
            className="rounded-xl border border-white/10 bg-black px-4 py-3 text-sm font-semibold text-white outline-none focus:border-cyan-500/50"
          >
            <option value="all">All report types</option>

            {reportTypes.map((type) => (
              <option key={type} value={type}>
                {formatLabel(type)}
              </option>
            ))}
          </select>

          <input
            name="q"
            defaultValue={searchQuery}
            placeholder="Search message, reporter, notes, email..."
            className="rounded-xl border border-white/10 bg-black px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-white/30 focus:border-cyan-500/50"
          />

          <button
            type="submit"
            className="rounded-xl bg-cyan-500 px-5 py-3 text-sm font-black text-black hover:bg-cyan-400"
          >
            Apply filters
          </button>
        </form>

        {hasActiveFilter ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-white/60">
            Current filter result:{" "}
            <span className="font-bold text-white">
              {filteredCounts.total}
            </span>{" "}
            reports • New: {filteredCounts.new} • Reviewing:{" "}
            {filteredCounts.reviewing} • Resolved: {filteredCounts.resolved} •
            Rejected: {filteredCounts.rejected}
          </div>
        ) : null}
      </section>

      {reports.length === 0 ? (
        <section className="mt-8 rounded-3xl border border-white/10 bg-black/30 p-8">
          <div className="text-xl font-bold text-white">
            No correction reports yet
          </div>

          <p className="mt-3 max-w-2xl text-sm leading-7 text-white/60">
            When users report incorrect prayer times, location details,
            facilities, Jumuʿah times, or duplicate mosque listings, they will
            appear here.
          </p>
        </section>
      ) : filteredReports.length === 0 ? (
        <section className="mt-8 rounded-3xl border border-yellow-500/20 bg-yellow-500/10 p-8">
          <div className="text-xl font-bold text-yellow-100">
            No reports match this filter
          </div>

          <p className="mt-3 max-w-2xl text-sm leading-7 text-yellow-100/70">
            Try changing the status, report type, or search text.
          </p>
        </section>
      ) : (
        <section className="mt-8 grid gap-5">
          {filteredReports.map((report) => {
            const source = getMetadataValue(report.metadata, "source");
            const mosqueName = getMetadataValue(report.metadata, "mosque_name");
            const mosqueSlug = getMetadataValue(report.metadata, "mosque_slug");

            return (
              <article
                key={report.id}
                className={getReportCardClass(report.status)}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <Badge className={getTypeClass(report.report_type)}>
                        {formatLabel(report.report_type)}
                      </Badge>

                      <Badge className={getStatusClass(report.status)}>
                        {formatLabel(report.status)}
                      </Badge>
                    </div>

                    <h3 className="mt-4 text-2xl font-black text-white">
                      {formatLabel(report.report_type)}
                    </h3>

                    <p className="mt-3 max-w-4xl whitespace-pre-wrap text-sm leading-7 text-white/70">
                      {report.report_message}
                    </p>
                  </div>

                  <div className="shrink-0 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/60 lg:w-72">
                    <div>
                      <span className="text-white/40">Created:</span>{" "}
                      {formatDateTime(report.created_at)}
                    </div>

                    <div className="mt-2">
                      <span className="text-white/40">Updated:</span>{" "}
                      {formatDateTime(report.updated_at)}
                    </div>

                    {source ? (
                      <div className="mt-2">
                        <span className="text-white/40">Source:</span>{" "}
                        {formatLabel(source)}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-white/40">
                      Reporter
                    </div>

                    <div className="mt-2 text-sm text-white/70">
                      {report.reporter_name || "Anonymous"}
                    </div>

                    <div className="mt-1 text-sm text-white/45">
                      {report.reporter_email || "No email provided"}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-white/40">
                      Page URL
                    </div>

                    {report.page_url ? (
                      <a
                        href={report.page_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 block break-words text-sm text-yellow-300 underline hover:text-yellow-200"
                      >
                        Open submitted page
                      </a>
                    ) : (
                      <div className="mt-2 text-sm text-white/45">
                        No page URL saved
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-white/40">
                      Metadata
                    </div>

                    <div className="mt-2 text-sm text-white/70">
                      {mosqueName ?? mosque.name ?? "Mosque"}
                    </div>

                    <div className="mt-1 text-sm text-white/45">
                      {mosqueSlug ? `/${mosqueSlug}` : "No slug saved"}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-white/40">
                      Current manager notes
                    </div>

                    <div className="mt-2 text-sm leading-6 text-white/60">
                      {report.admin_notes || "No notes added yet."}
                    </div>
                  </div>
                </div>

                <div className="mt-5">
                  <MosqueCorrectionRecommendedActions
                    mosqueId={mosque.id}
                    mosqueSlug={mosque.slug}
                    reportType={report.report_type}
                  />
                </div>

                <div className="mt-5">
                  <MosqueCorrectionReportActions
                    reportId={report.id}
                    mosqueId={mosque.id}
                    currentStatus={report.status}
                    currentNotes={report.admin_notes}
                  />
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}