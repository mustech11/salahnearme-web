import Link from "next/link";

import AdminGate from "@/components/AdminGate";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
  updated_at: string | null;
  mosques?: {
    id: string;
    name: string | null;
    slug: string | null;
    city: string | null;
    area: string | null;
    postcode: string | null;
  } | null;
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

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date.toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function statusClassName(status: string | null | undefined) {
  if (status === "approved" || status === "auto_approved") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }

  if (status === "parsed_pending_review") {
    return "border-purple-500/30 bg-purple-500/10 text-purple-300";
  }

  if (status === "extracted") {
    return "border-green-500/30 bg-green-500/10 text-green-300";
  }

  if (status === "extracting") {
    return "border-blue-500/30 bg-blue-500/10 text-blue-300";
  }

  if (status === "failed" || status === "parse_failed") {
    return "border-red-500/30 bg-red-500/10 text-red-300";
  }

  return "border-yellow-500/30 bg-yellow-500/10 text-yellow-400";
}

function getParsedRowsCount(value: unknown) {
  if (!value || typeof value !== "object") {
    return 0;
  }

  const rows = (value as { rows?: unknown }).rows;

  if (!Array.isArray(rows)) {
    return 0;
  }

  return rows.length;
}

function getParsedWarnings(value: unknown) {
  if (!value || typeof value !== "object") {
    return [];
  }

  const warnings = (value as { warnings?: unknown }).warnings;

  if (!Array.isArray(warnings)) {
    return [];
  }

  return warnings.filter(
    (warning): warning is string => typeof warning === "string"
  );
}

function rawTextLength(value: string | null) {
  if (!value) {
    return "None";
  }

  return `${value.length.toLocaleString("en-GB")} chars`;
}

function sourceTypeLabel(value: string | null) {
  if (!value) {
    return "Source";
  }

  return value
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function AdminMosqueTimetableImportsPage() {
  return (
    <AdminGate>
      <AdminMosqueTimetableImportsContent />
    </AdminGate>
  );
}

async function AdminMosqueTimetableImportsContent() {
  const supabase = await supabaseServer();

  const [
    { count: totalImports },
    { count: pendingReviews },
    { count: approvedImports },
    { count: failedImports },
    { data: importsRaw, error: importsError },
  ] = await Promise.all([
    supabase
      .from("mosque_timetable_imports")
      .select("*", { count: "exact", head: true }),

    supabase
      .from("mosque_timetable_imports")
      .select("*", { count: "exact", head: true })
      .eq("status", "parsed_pending_review"),

    supabase
      .from("mosque_timetable_imports")
      .select("*", { count: "exact", head: true })
      .eq("status", "approved"),

    supabase
      .from("mosque_timetable_imports")
      .select("*", { count: "exact", head: true })
      .in("status", ["failed", "parse_failed"]),

    supabase
      .from("mosque_timetable_imports")
      .select(
        `
        id,
        mosque_id,
        source_id,
        source_url,
        source_type,
        import_month,
        import_year,
        raw_text,
        extracted_json,
        confidence_score,
        status,
        error_message,
        reviewed_by,
        reviewed_at,
        created_at,
        updated_at,
        mosques:mosque_id (
          id,
          name,
          slug,
          city,
          area,
          postcode
        )
      `
      )
      .order("created_at", {
        ascending: false,
      })
      .limit(50),
  ]);

  const imports = (importsRaw ?? []) as unknown as TimetableImportRow[];

  return (
    <div className="space-y-8">
      <section className="luxe-card rounded-3xl p-8 md:p-10">
        <Link
          href="/admin"
          className="text-sm font-semibold text-yellow-400 hover:text-yellow-300"
        >
          ← Back to admin
        </Link>

        <div className="mt-6 text-sm uppercase tracking-[0.25em] text-yellow-400">
          Mosque Timetable Engine
        </div>

        <h1 className="dashboard-hero-glow mt-4 text-4xl font-black tracking-[-0.04em] text-white md:text-5xl">
          Timetable Imports
        </h1>

        <p className="mt-4 max-w-3xl text-white/70">
          Review timetable imports, parser status, raw text extraction, parsed
          rows, failed imports, and approved mosque timetable publishing.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/admin/mosque-timetable-sources"
            className="luxe-button-outline text-sm"
          >
            Timetable sources
          </Link>

          <Link
            href="/admin/mosque-prayer-times"
            className="luxe-button-outline text-sm"
          >
            Published prayer rows
          </Link>

          <Link href="/admin/mosque-claims" className="luxe-button text-sm">
            Mosque claims
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card title="Total Imports" value={totalImports ?? 0} />
        <Card title="Pending Review" value={pendingReviews ?? 0} tone="purple" />
        <Card title="Approved" value={approvedImports ?? 0} tone="green" />
        <Card title="Failed" value={failedImports ?? 0} tone="red" />
      </section>

      {importsError ? (
        <section className="rounded-3xl border border-red-500/20 bg-red-500/10 p-6 text-red-200">
          {importsError.message}
        </section>
      ) : null}

      <section className="luxe-card rounded-3xl p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-black text-white">Recent imports</h2>

            <p className="mt-2 text-sm text-white/60">
              Showing the latest 50 mosque timetable imports.
            </p>
          </div>
        </div>

        {imports.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-6 text-white/60">
            No timetable imports found yet.
          </div>
        ) : (
          <div className="mt-6 grid gap-4">
            {imports.map((item) => {
              const parsedRows = getParsedRowsCount(item.extracted_json);
              const warnings = getParsedWarnings(item.extracted_json);
              const mosque = item.mosques;

              return (
                <article
                  key={item.id}
                  className="rounded-2xl border border-white/10 bg-black/30 p-5"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-xl font-bold text-white">
                          {item.import_month ?? "?"}/{item.import_year ?? "?"}
                        </div>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-bold ${statusClassName(
                            item.status
                          )}`}
                        >
                          {formatStatus(item.status)}
                        </span>
                      </div>

                      <div className="mt-3 text-sm font-semibold text-yellow-400">
                        {mosque?.name ?? "Unknown mosque"}
                      </div>

                      <div className="mt-1 text-xs text-white/50">
                        {[mosque?.area, mosque?.city, mosque?.postcode]
                          .filter(Boolean)
                          .join(" • ") || "Location not available"}
                      </div>

                      <div className="mt-3 break-all text-xs text-white/50">
                        {sourceTypeLabel(item.source_type)} •{" "}
                        {item.source_url ?? "No URL"}
                      </div>

                      <div className="mt-3 grid gap-2 text-xs text-white/40 sm:grid-cols-2 xl:grid-cols-4">
                        <div>Created: {formatDateTime(item.created_at)}</div>
                        <div>Updated: {formatDateTime(item.updated_at)}</div>
                        <div>Reviewed: {formatDateTime(item.reviewed_at)}</div>
                        <div>Confidence: {item.confidence_score ?? 0}%</div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {mosque?.slug ? (
                        <Link
                          href={`/mosque/${mosque.slug}`}
                          className="rounded-xl border border-yellow-500/30 px-4 py-2 text-xs font-bold text-yellow-400 hover:bg-yellow-500/10"
                        >
                          Public page
                        </Link>
                      ) : null}

                      {mosque?.slug ? (
                        <Link
                          href={`/mosque/${mosque.slug}/timetable?month=${
                            item.import_month ?? new Date().getMonth() + 1
                          }&year=${item.import_year ?? new Date().getFullYear()}`}
                          className="rounded-xl border border-white/10 px-4 py-2 text-xs font-bold text-white/70 hover:border-yellow-400 hover:text-yellow-400"
                        >
                          Monthly table
                        </Link>
                      ) : null}

                      <Link
                        href={`/business-dashboard/mosques/${item.mosque_id}/timetable-sources`}
                        className="rounded-xl border border-white/10 px-4 py-2 text-xs font-bold text-white/70 hover:border-yellow-400 hover:text-yellow-400"
                      >
                        Manager view
                      </Link>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 text-xs text-white/60 md:grid-cols-4">
                    <Metric title="Raw text" value={rawTextLength(item.raw_text)} />
                    <Metric
                      title="Extracted JSON"
                      value={item.extracted_json ? "Available" : "None"}
                    />
                    <Metric title="Parsed rows" value={parsedRows} />
                    <Metric
                      title="Source ID"
                      value={item.source_id ? "Linked" : "None"}
                    />
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

                  {item.error_message ? (
                    <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-300">
                      {item.error_message}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Card({
  title,
  value,
  tone = "yellow",
}: {
  title: string;
  value: number;
  tone?: "yellow" | "green" | "red" | "purple";
}) {
  const toneClass =
    tone === "green"
      ? "text-green-300"
      : tone === "red"
        ? "text-red-300"
        : tone === "purple"
          ? "text-purple-300"
          : "text-yellow-400";

  return (
    <div className="luxe-card-soft rounded-2xl p-5">
      <div className={`text-sm font-medium ${toneClass}`}>{title}</div>
      <div className="mt-3 text-4xl font-black text-white">{value}</div>
    </div>
  );
}

function Metric({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-3">
      <div className="font-semibold text-yellow-400">{title}</div>
      <div className="mt-1">{value}</div>
    </div>
  );
}

