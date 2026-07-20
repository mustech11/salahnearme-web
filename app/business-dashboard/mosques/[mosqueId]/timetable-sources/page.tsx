import Link from "next/link";
import { notFound } from "next/navigation";

import MosqueTimetableApproveButton from "@/components/MosqueTimetableApproveButton";
import MosqueTimetableExtractButton from "@/components/MosqueTimetableExtractButton";
import MosqueTimetableManualRawTextEditor from "@/components/MosqueTimetableManualRawTextEditor";
import MosqueTimetableParseButton from "@/components/MosqueTimetableParseButton";
import MosqueTimetableParsedRowsEditor from "@/components/MosqueTimetableParsedRowsEditor";
import MosqueTimetableSourcesEditor from "@/components/MosqueTimetableSourcesEditor";
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
};

type TimetableSourceRow = {
  id?: string;
  mosque_id: string;
  source_url: string;
  source_type: string;
  auto_import_enabled: boolean;
  last_checked_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type TimetableImportRow = {
  id: string;
  mosque_id: string;
  source_id: string | null;
  source_url: string | null;
  source_type: string | null;
  import_month: number | null;
  import_year: number | null;
  raw_text: string | null;
  extracted_json: unknown | null;
  confidence_score: number | null;
  status: string | null;
  error_message: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at?: string | null;
};

type ImportCounts = {
  total: number;
  pending: number;
  extracted: number;
  parsed: number;
  approved: number;
  failed: number;
};

function formatStatus(value: string | null | undefined) {
  if (!value) {
    return "Pending Review";
  }

  return value
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatSourceType(value: string | null | undefined) {
  if (!value) {
    return "Source";
  }

  return value
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDateTime(value: string | null | undefined, timezone?: string | null) {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  try {
    return date.toLocaleString("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: timezone || "Europe/London",
    });
  } catch {
    return date.toLocaleString("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/London",
    });
  }
}

function statusClassName(status: string | null | undefined) {
  if (status === "extracted") {
    return "border-green-500/30 bg-green-500/10 text-green-300";
  }

  if (status === "extracting") {
    return "border-blue-500/30 bg-blue-500/10 text-blue-300";
  }

  if (status === "parsed_pending_review") {
    return "border-purple-500/30 bg-purple-500/10 text-purple-300";
  }

  if (
    status === "parse_failed" ||
    status === "failed" ||
    status === "extract_failed"
  ) {
    return "border-red-500/30 bg-red-500/10 text-red-300";
  }

  if (status === "approved" || status === "auto_approved") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }

  return "border-yellow-500/30 bg-yellow-500/10 text-yellow-400";
}

function confidenceClassName(value: number | null | undefined) {
  const score = Number(value ?? 0);

  if (score >= 85) {
    return "text-emerald-300";
  }

  if (score >= 60) {
    return "text-yellow-300";
  }

  return "text-red-300";
}

function rawTextPreview(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return value.slice(0, 3000);
}

function jsonPreview(value: unknown) {
  if (!value) {
    return "";
  }

  try {
    return JSON.stringify(value, null, 2).slice(0, 4000);
  } catch {
    return "Could not preview extracted JSON.";
  }
}

function getParsedRowsCount(value: unknown) {
  if (!value || typeof value !== "object") {
    return 0;
  }

  const maybeRows = (value as { rows?: unknown }).rows;

  if (!Array.isArray(maybeRows)) {
    return 0;
  }

  return maybeRows.length;
}

function getParsedWarnings(value: unknown) {
  if (!value || typeof value !== "object") {
    return [];
  }

  const maybeWarnings = (value as { warnings?: unknown }).warnings;

  if (!Array.isArray(maybeWarnings)) {
    return [];
  }

  return maybeWarnings.filter(
    (warning): warning is string => typeof warning === "string"
  );
}

function canParse(status: string | null | undefined, rawText: string | null) {
  if (!rawText) {
    return false;
  }

  return (
    status === "extracted" ||
    status === "parse_failed" ||
    status === "parsed_pending_review" ||
    status === "manual_raw_text"
  );
}

function canApprove(status: string | null | undefined, extractedJson: unknown) {
  if (status !== "parsed_pending_review") {
    return false;
  }

  return getParsedRowsCount(extractedJson) > 0;
}

function getImportCounts(rows: TimetableImportRow[]): ImportCounts {
  return {
    total: rows.length,
    pending: rows.filter((row) => {
      const status = row.status ?? "pending";
      return status === "pending" || status === "queued" || status === "draft";
    }).length,
    extracted: rows.filter((row) => row.status === "extracted").length,
    parsed: rows.filter((row) => row.status === "parsed_pending_review").length,
    approved: rows.filter(
      (row) => row.status === "approved" || row.status === "auto_approved"
    ).length,
    failed: rows.filter((row) => {
      const status = row.status ?? "";
      return status.includes("failed");
    }).length,
  };
}

function getSourceHealth(sourceRows: TimetableSourceRow[]) {
  const enabled = sourceRows.filter((source) => source.auto_import_enabled).length;
  const successful = sourceRows.filter((source) => source.last_success_at).length;
  const failing = sourceRows.filter((source) => source.last_error).length;

  return {
    total: sourceRows.length,
    enabled,
    successful,
    failing,
  };
}

function getMosqueLocation(mosque: MosqueRow) {
  return (
    [mosque.area, mosque.city, mosque.postcode].filter(Boolean).join(" • ") ||
    "Location not available"
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <section className="rounded-3xl border border-red-500/20 bg-red-500/10 p-8 text-red-200">
        <div className="text-sm uppercase tracking-[0.22em] text-red-300">
          Could not load timetable sources
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

function SourceHealthPanel({
  sourceRows,
  mosque,
}: {
  sourceRows: TimetableSourceRow[];
  mosque: MosqueRow;
}) {
  const sourceHealth = getSourceHealth(sourceRows);

  return (
    <section className="rounded-3xl border border-cyan-500/20 bg-cyan-500/10 p-6">
      <div className="text-sm uppercase tracking-[0.25em] text-cyan-300">
        Source health
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Sources"
          value={String(sourceHealth.total)}
          description="Saved timetable sources"
        />

        <MetricCard
          label="Auto import"
          value={String(sourceHealth.enabled)}
          description="Sources enabled for automated checks"
        />

        <MetricCard
          label="Successful"
          value={String(sourceHealth.successful)}
          description="Sources with at least one success"
        />

        <MetricCard
          label="Errors"
          value={String(sourceHealth.failing)}
          description="Sources with latest error messages"
        />
      </div>

      {sourceRows.length > 0 ? (
        <div className="mt-6 grid gap-3">
          {sourceRows.slice(0, 5).map((source, index) => (
            <div
              key={source.id ?? `${source.source_url}-${index}`}
              className="rounded-2xl border border-white/10 bg-black/30 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-bold text-white">
                    {formatSourceType(source.source_type)}
                  </div>

                  <div className="mt-1 break-all text-sm text-white/50">
                    {source.source_url || "No URL saved"}
                  </div>
                </div>

                <div
                  className={`rounded-full border px-3 py-1 text-xs font-bold ${
                    source.auto_import_enabled
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                      : "border-white/10 bg-white/5 text-white/50"
                  }`}
                >
                  {source.auto_import_enabled ? "Auto import on" : "Manual"}
                </div>
              </div>

              <div className="mt-3 grid gap-3 text-xs text-white/50 sm:grid-cols-3">
                <div>
                  Last checked:{" "}
                  <span className="text-white/70">
                    {formatDateTime(source.last_checked_at, mosque.timezone)}
                  </span>
                </div>

                <div>
                  Last success:{" "}
                  <span className="text-white/70">
                    {formatDateTime(source.last_success_at, mosque.timezone)}
                  </span>
                </div>

                <div>
                  Error:{" "}
                  <span
                    className={
                      source.last_error ? "text-red-300" : "text-emerald-300"
                    }
                  >
                    {source.last_error ? "Yes" : "No"}
                  </span>
                </div>
              </div>

              {source.last_error ? (
                <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-200">
                  {source.last_error}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export default async function MosqueTimetableSourcesDashboardPage({
  params,
}: PageProps) {
  const { mosqueId } = await params;

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

  const { data: sourceRowsRaw, error: sourceError } = await supabaseAdmin
    .from("mosque_timetable_sources")
    .select("*")
    .eq("mosque_id", mosque.id)
    .order("created_at", {
      ascending: false,
    });

  if (sourceError) {
    return <ErrorPanel message={sourceError.message} />;
  }

  const sourceRows = ((sourceRowsRaw ?? []) as unknown) as TimetableSourceRow[];

  const { data: importRowsRaw, error: importError } = await supabaseAdmin
    .from("mosque_timetable_imports")
    .select("*")
    .eq("mosque_id", mosque.id)
    .order("created_at", {
      ascending: false,
    })
    .limit(20);

  if (importError) {
    return <ErrorPanel message={importError.message} />;
  }

  const importRows = ((importRowsRaw ?? []) as unknown) as TimetableImportRow[];
  const importCounts = getImportCounts(importRows);

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
            Timetable import sources
          </h1>

          <div className="mt-3 text-sm text-white/50">
            {[mosque.name, getMosqueLocation(mosque)].filter(Boolean).join(" • ")}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href={`/business-dashboard/mosques/${mosque.id}/data-quality`}
            className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-500/20"
          >
            Data quality
          </Link>

          <Link
            href={`/business-dashboard/mosques/${mosque.id}/prayer-times`}
            className="rounded-xl border border-yellow-500/30 bg-black px-4 py-2 text-xs font-bold text-yellow-400 hover:bg-yellow-500/10"
          >
            Prayer times
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
          Timetable automation
        </div>

        <h2 className="mt-3 text-3xl font-black text-white">
          Add, extract, parse, and approve timetable data
        </h2>

        <p className="mt-3 max-w-4xl text-sm leading-7 text-white/60">
          Timetable sources help SalahNearMe keep mosque prayer data fresh. Add
          official source links, extract raw text, parse structured rows, review
          warnings, and approve only after checking the data.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <MetricCard
            label="Imports"
            value={String(importCounts.total)}
            description="Recent import jobs"
          />

          <MetricCard
            label="Pending"
            value={String(importCounts.pending)}
            description="Waiting for extraction"
          />

          <MetricCard
            label="Extracted"
            value={String(importCounts.extracted)}
            description="Raw text available"
          />

          <MetricCard
            label="Ready review"
            value={String(importCounts.parsed)}
            description="Parsed rows awaiting approval"
          />

          <MetricCard
            label="Approved"
            value={String(importCounts.approved)}
            description="Published timetable imports"
          />
        </div>
      </section>

      <section className="mt-8">
        <MosqueTimetableSourcesEditor
          mosqueId={mosque.id}
          mosqueName={mosque.name ?? "Mosque"}
          initialSources={sourceRows}
        />
      </section>

      <section className="mt-8">
        <SourceHealthPanel sourceRows={sourceRows} mosque={mosque} />
      </section>

      <section className="mt-8 rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
              Import History
            </div>

            <h2 className="mt-3 text-2xl font-black text-white">
              Recent timetable imports
            </h2>

            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/60">
              First extract raw text, then parse it into structured JSON. If the
              source website hides its timetable, paste the raw timetable text
              manually. Only approve after checking rows, dates, warnings, and
              confidence.
            </p>
          </div>

          {importCounts.failed > 0 ? (
            <div className="rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-bold text-red-300">
              {importCounts.failed} failed import
              {importCounts.failed === 1 ? "" : "s"}
            </div>
          ) : (
            <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-300">
              No failed imports
            </div>
          )}
        </div>

        {importRows.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-5 text-white/60">
            No timetable imports yet. Add a source above, then create or run an
            import from the timetable workflow.
          </div>
        ) : (
          <div className="mt-5 grid gap-4">
            {importRows.map((row) => {
              const parsedRowsCount = getParsedRowsCount(row.extracted_json);
              const warnings = getParsedWarnings(row.extracted_json);

              return (
                <article
                  key={row.id}
                  className="rounded-2xl border border-white/10 bg-black/30 p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="font-semibold text-white">
                        {row.import_month ?? "?"}/{row.import_year ?? "?"}
                      </div>

                      <div className="mt-1 break-all text-xs text-white/50">
                        {formatSourceType(row.source_type)} •{" "}
                        {row.source_url ?? "No URL"}
                      </div>

                      <div className="mt-2 text-xs text-white/40">
                        Created: {formatDateTime(row.created_at, mosque.timezone)}
                      </div>

                      {row.updated_at ? (
                        <div className="mt-1 text-xs text-white/40">
                          Updated:{" "}
                          {formatDateTime(row.updated_at, mosque.timezone)}
                        </div>
                      ) : null}

                      {row.reviewed_at ? (
                        <div className="mt-1 text-xs text-emerald-300/80">
                          Reviewed:{" "}
                          {formatDateTime(row.reviewed_at, mosque.timezone)}
                        </div>
                      ) : null}
                    </div>

                    <div
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClassName(
                        row.status
                      )}`}
                    >
                      {formatStatus(row.status)}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 text-xs text-white/60 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                      <div className="font-semibold text-yellow-400">
                        Confidence
                      </div>
                      <div
                        className={`mt-1 font-bold ${confidenceClassName(
                          row.confidence_score
                        )}`}
                      >
                        {row.confidence_score ?? 0}%
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                      <div className="font-semibold text-yellow-400">
                        Raw text
                      </div>
                      <div className="mt-1">
                        {row.raw_text
                          ? `${row.raw_text.length} chars`
                          : "None"}
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                      <div className="font-semibold text-yellow-400">
                        Extracted JSON
                      </div>
                      <div className="mt-1">
                        {row.extracted_json ? "Available" : "Not yet"}
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                      <div className="font-semibold text-yellow-400">
                        Parsed rows
                      </div>
                      <div className="mt-1">{parsedRowsCount}</div>
                    </div>
                  </div>

                  {warnings.length > 0 ? (
                    <div className="mt-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4">
                      <div className="text-xs font-bold text-yellow-300">
                        Parser warnings
                      </div>

                      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-yellow-100/80">
                        {warnings.map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-3">
                    <MosqueTimetableExtractButton importId={row.id} />

                    {canParse(row.status, row.raw_text) ? (
                      <MosqueTimetableParseButton importId={row.id} />
                    ) : null}

                    {canApprove(row.status, row.extracted_json) ? (
                      <MosqueTimetableApproveButton importId={row.id} />
                    ) : null}
                  </div>

                  <MosqueTimetableManualRawTextEditor
                    importId={row.id}
                    initialRawText={row.raw_text}
                  />

                  {row.status === "approved" || row.status === "auto_approved" ? (
                    <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
                      This import has been approved and published into the
                      mosque prayer times table.
                    </div>
                  ) : null}

                  {row.error_message ? (
                    <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
                      {row.error_message}
                    </div>
                  ) : null}

                  {row.raw_text ? (
                    <details className="mt-4 rounded-xl border border-white/10 bg-black/40 p-4">
                      <summary className="cursor-pointer text-xs font-bold text-yellow-400">
                        Preview extracted raw text
                      </summary>

                      <pre className="mt-3 max-h-60 overflow-auto whitespace-pre-wrap text-xs text-white/60">
                        {rawTextPreview(row.raw_text)}
                      </pre>
                    </details>
                  ) : null}

                  {row.extracted_json ? (
                    <MosqueTimetableParsedRowsEditor
                      importId={row.id}
                      extractedJson={row.extracted_json}
                    />
                  ) : null}

                  {row.extracted_json ? (
                    <details className="mt-4 rounded-xl border border-white/10 bg-black/40 p-4">
                      <summary className="cursor-pointer text-xs font-bold text-yellow-400">
                        Preview extracted JSON
                      </summary>

                      <pre className="mt-3 max-h-60 overflow-auto whitespace-pre-wrap text-xs text-white/60">
                        {jsonPreview(row.extracted_json)}
                      </pre>
                    </details>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}