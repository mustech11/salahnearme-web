import Link from "next/link";
import { notFound } from "next/navigation";

import MosqueTimetableApproveButton from "@/components/MosqueTimetableApproveButton";
import MosqueTimetableExtractButton from "@/components/MosqueTimetableExtractButton";
import MosqueTimetableManualRawTextEditor from "@/components/MosqueTimetableManualRawTextEditor";
import MosqueTimetableParseButton from "@/components/MosqueTimetableParseButton";
import MosqueTimetableParsedRowsEditor from "@/components/MosqueTimetableParsedRowsEditor";
import MosqueTimetableSourcesEditor from "@/components/MosqueTimetableSourcesEditor";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { supabaseServer } from "@/lib/supabaseServer";

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
  if (status === "extracted") {
    return "border-green-500/30 bg-green-500/10 text-green-300";
  }

  if (status === "extracting") {
    return "border-blue-500/30 bg-blue-500/10 text-blue-300";
  }

  if (status === "parsed_pending_review") {
    return "border-purple-500/30 bg-purple-500/10 text-purple-300";
  }

  if (status === "parse_failed" || status === "failed") {
    return "border-red-500/30 bg-red-500/10 text-red-300";
  }

  if (status === "approved" || status === "auto_approved") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }

  return "border-yellow-500/30 bg-yellow-500/10 text-yellow-400";
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
    status === "parsed_pending_review"
  );
}

function canApprove(status: string | null | undefined, extractedJson: unknown) {
  if (status !== "parsed_pending_review") {
    return false;
  }

  return getParsedRowsCount(extractedJson) > 0;
}

export default async function MosqueTimetableSourcesDashboardPage({
  params,
}: PageProps) {
  const { mosqueId } = await params;

  const supabase = await supabaseServer();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10">
        <section className="rounded-3xl border border-red-500/20 bg-red-500/10 p-8 text-red-200">
          You must be signed in to manage timetable sources.
        </section>
      </main>
    );
  }

  const { data: mosqueRaw, error: mosqueError } = await supabaseAdmin
    .from("mosques")
    .select("id, name, slug, city, area, postcode")
    .eq("id", mosqueId)
    .maybeSingle();

  if (mosqueError) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <section className="rounded-3xl border border-red-500/20 bg-red-500/10 p-8 text-red-200">
          {mosqueError.message}
        </section>
      </main>
    );
  }

  if (!mosqueRaw) {
    notFound();
  }

  const mosque = mosqueRaw as MosqueRow;

  /*
    Permission check stays with supabaseServer/auth.
    This confirms the signed-in user has an approved claim for this mosque.
  */
  const { data: claimRaw, error: claimError } = await supabase
    .from("mosque_claims")
    .select("id, status, role")
    .eq("mosque_id", mosque.id)
    .eq("user_id", user.id)
    .in("status", ["approved", "active", "verified"])
    .maybeSingle();

  if (claimError) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <section className="rounded-3xl border border-red-500/20 bg-red-500/10 p-8 text-red-200">
          {claimError.message}
        </section>
      </main>
    );
  }

  if (!claimRaw) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <section className="rounded-3xl border border-red-500/20 bg-red-500/10 p-8 text-red-200">
          You do not have permission to manage timetable sources for this
          mosque.
        </section>
      </main>
    );
  }

  /*
    These reads use supabaseAdmin AFTER permission is confirmed.
    This avoids RLS hiding existing sources/imports from the dashboard.
  */
  const { data: sourceRowsRaw, error: sourceError } = await supabaseAdmin
    .from("mosque_timetable_sources")
    .select("*")
    .eq("mosque_id", mosque.id)
    .order("created_at", {
      ascending: false,
    });

  if (sourceError) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <section className="rounded-3xl border border-red-500/20 bg-red-500/10 p-8 text-red-200">
          {sourceError.message}
        </section>
      </main>
    );
  }

  const sourceRows = (sourceRowsRaw ?? []) as TimetableSourceRow[];

  const { data: importRowsRaw, error: importError } = await supabaseAdmin
    .from("mosque_timetable_imports")
    .select("*")
    .eq("mosque_id", mosque.id)
    .order("created_at", {
      ascending: false,
    })
    .limit(10);

  if (importError) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <section className="rounded-3xl border border-red-500/20 bg-red-500/10 p-8 text-red-200">
          {importError.message}
        </section>
      </main>
    );
  }

  const importRows = (importRowsRaw ?? []) as TimetableImportRow[];

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/business-dashboard/mosques"
            className="text-sm font-semibold text-yellow-400 hover:text-yellow-300"
          >
            ← Back to mosque dashboard
          </Link>

          <h1 className="mt-4 text-3xl font-black text-white">
            Timetable import sources
          </h1>

          <div className="mt-3 text-sm text-white/50">
            {[mosque.name, mosque.area, mosque.city, mosque.postcode]
              .filter(Boolean)
              .join(" • ") || "Location not available"}
          </div>

          {mosque.slug ? (
            <div className="mt-3">
              <Link
                href={`/mosque/${mosque.slug}`}
                className="text-sm text-white/60 underline hover:text-white"
              >
                View public mosque page
              </Link>
            </div>
          ) : null}
        </div>
      </div>

      <MosqueTimetableSourcesEditor
        mosqueId={mosque.id}
        mosqueName={mosque.name ?? "Mosque"}
        initialSources={sourceRows}
      />

      <section className="mt-8 rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
        <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
          Import History
        </div>

        <h2 className="mt-3 text-2xl font-black text-white">
          Recent timetable imports
        </h2>

        <p className="mt-3 max-w-3xl text-sm text-white/60">
          Queued imports are stored here. First extract raw text, then parse it
          into structured JSON. If the source website hides its timetable, paste
          the raw timetable text manually. Only approve after checking the
          extracted rows are correct.
        </p>

        {importRows.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-5 text-white/60">
            No timetable imports yet.
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
                        Created: {formatDateTime(row.created_at)}
                      </div>

                      {row.updated_at ? (
                        <div className="mt-1 text-xs text-white/40">
                          Updated: {formatDateTime(row.updated_at)}
                        </div>
                      ) : null}

                      {row.reviewed_at ? (
                        <div className="mt-1 text-xs text-emerald-300/80">
                          Reviewed: {formatDateTime(row.reviewed_at)}
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

                  <div className="mt-4 grid gap-3 text-xs text-white/60 sm:grid-cols-4">
                    <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                      <div className="font-semibold text-yellow-400">
                        Confidence
                      </div>
                      <div className="mt-1">{row.confidence_score ?? 0}%</div>
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

                  {row.status === "approved" ? (
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