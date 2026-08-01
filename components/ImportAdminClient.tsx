"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Papa from "papaparse";

type ImportType = "mosques" | "businesses";

const REQUEST_TIMEOUT_MS = 60_000;
const MAX_CSV_FILE_SIZE_MB = 8;
const MAX_IMPORT_ROWS = 5_000;
type ImportMode = "dry-run" | "confirm";

type ImportSummary = {
  type: ImportType;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  insertCount: number;
  updateCount: number;
  duplicateCandidatesQueued?: number;
  errors: Array<{
    row: number;
    message: string;
    data: Record<string, unknown>;
  }>;
  rows: Record<string, unknown>[];
};

export default function ImportAdminClient() {
  const feedbackId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [type, setType] = useState<ImportType>("mosques");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [fileName, setFileName] = useState("");
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [lastMode, setLastMode] = useState<ImportMode | null>(null);
  const [dryRunPassed, setDryRunPassed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const hasRows = rows.length > 0;
  const largeBatch = rows.length > 500;
  const exceedsMaximumRows = rows.length > MAX_IMPORT_ROWS;

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const sampleColumns = useMemo(() => {
    if (type === "mosques") {
      return [
        "name",
        "slug",
        "city",
        "area",
        "postcode",
        "address",
        "maps_url",
        "latitude",
        "longitude",
        "verified_status",
      ];
    }

    return [
      "name",
      "slug",
      "category",
      "city",
      "area",
      "address",
      "postcode",
      "website",
      "phone",
      "email",
      "maps_url",
      "latitude",
      "longitude",
      "status",
      "can_advertise",
      "is_verified",
    ];
  }, [type]);

  function resetImportState() {
    abortControllerRef.current?.abort();
    setRows([]);
    setSummary(null);
    setFileName("");
    setErrorMessage("");
    setDryRunPassed(false);
    setLastMode(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleFileChange(file: File | null) {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setErrorMessage("Please upload a CSV file.");
      return;
    }

    if (file.size > MAX_CSV_FILE_SIZE_MB * 1024 * 1024) {
      setErrorMessage(`CSV file must be ${MAX_CSV_FILE_SIZE_MB}MB or smaller.`);
      return;
    }

    setErrorMessage("");
    setSummary(null);
    setDryRunPassed(false);
    setLastMode(null);
    setFileName(file.name);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsedRows = (results.data ?? []) as Record<string, unknown>[];
        const safeRows = parsedRows
          .filter((row) => row && typeof row === "object")
          .slice(0, MAX_IMPORT_ROWS + 1);

        setRows(safeRows);

        if (safeRows.length > MAX_IMPORT_ROWS) {
          setErrorMessage(
            `This file exceeds the ${MAX_IMPORT_ROWS.toLocaleString("en-GB")} row safety limit.`
          );
        } else if (results.errors.length > 0) {
          setErrorMessage(
            `CSV parsed with ${results.errors.length.toLocaleString("en-GB")} parser warning(s).`
          );
        }
      },
      error: () => {
        setErrorMessage("Could not parse CSV file.");
      },
    });
  }

  async function runImport(mode: ImportMode) {
    if (!hasRows) {
      setErrorMessage("Please upload a CSV file first.");
      return;
    }

    if (exceedsMaximumRows) {
      setErrorMessage(
        `Reduce the file to ${MAX_IMPORT_ROWS.toLocaleString("en-GB")} rows or fewer.`
      );
      return;
    }

    if (mode === "confirm" && !dryRunPassed) {
      setErrorMessage("Run a dry run first before confirming import.");
      return;
    }

    if (mode === "confirm") {
      const confirmed = window.confirm(
        `Confirm import?\n\nThis will write ${rows.length} ${type} rows to Supabase.\n\nContinue?`
      );

      if (!confirmed) return;
    }

    abortControllerRef.current?.abort();

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let timedOut = false;
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    try {
      setLoading(true);
      setErrorMessage("");
      setLastMode(mode);

      const res = await fetch("/api/admin/import", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
        body: JSON.stringify({
          type,
          mode,
          file_name: fileName || null,
          rows,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.summary) {
        setErrorMessage(data.error ?? "Import failed.");
        return;
      }

      const nextSummary = data.summary as ImportSummary;
      setSummary(nextSummary);

      if (mode === "dry-run") {
        setDryRunPassed(nextSummary.invalidRows === 0);
      }

      if (mode === "confirm") {
        setDryRunPassed(false);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof DOMException && error.name === "AbortError"
          ? timedOut
            ? "The import request timed out."
            : "The import request was cancelled."
          : "Something went wrong during import."
      );
    } finally {
      window.clearTimeout(timeoutId);

      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }

      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="luxe-card rounded-3xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xl font-semibold text-yellow-400">
              Bulk import
            </div>

            <p className="mt-2 text-white/70">
              Upload CSV files, validate rows, run a safe dry run, then confirm
              the import only when the preview looks correct.
            </p>
          </div>

          <Link
            href="/admin/import/history"
            className="rounded-xl border border-yellow-500/30 bg-black px-5 py-3 text-sm font-semibold text-yellow-400 hover:bg-yellow-500/10"
          >
            View import history
          </Link>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-white/80">
              Import type
            </label>

            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value as ImportType);
                resetImportState();
              }}
              className="w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none focus:border-yellow-400"
            >
              <option value="mosques">Mosques</option>
              <option value="businesses">Businesses</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-white/80">
              CSV file
            </label>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              className="block w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white file:mr-4 file:rounded-xl file:border-0 file:bg-yellow-500 file:px-4 file:py-2 file:font-semibold file:text-black"
            />
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-5">
          <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
            Expected CSV columns
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {sampleColumns.map((column) => (
              <span
                key={column}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80"
              >
                {column}
              </span>
            ))}
          </div>
        </div>

        {fileName && (
          <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-5 text-sm text-white/70">
            Loaded file:{" "}
            <span className="font-semibold text-yellow-400">{fileName}</span>{" "}
            ({rows.length} rows)
          </div>
        )}

        {largeBatch && (
          <div className="mt-4 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-200">
            Large batch warning: this file has {rows.length} rows. For safer
            imports, split large files into batches of around 200–500 rows.
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => runImport("dry-run")}
            disabled={!hasRows || loading || exceedsMaximumRows}
            className="luxe-button text-sm disabled:opacity-50"
          >
            {loading && lastMode === "dry-run" ? "Processing..." : "Run dry run"}
          </button>

          <button
            type="button"
            onClick={() => runImport("confirm")}
            disabled={!hasRows || loading || !dryRunPassed || exceedsMaximumRows}
            className="rounded-xl border border-green-500/30 bg-green-500/10 px-5 py-3 text-sm font-semibold text-green-300 hover:bg-green-500/20 disabled:opacity-50"
          >
            {loading && lastMode === "confirm"
              ? "Importing..."
              : "Confirm import"}
          </button>

          <button
            type="button"
            onClick={resetImportState}
            disabled={loading}
            className="rounded-xl border border-white/10 bg-black px-5 py-3 text-sm font-semibold text-white/70 hover:border-yellow-500/30 hover:text-yellow-400 disabled:opacity-50"
          >
            Reset
          </button>
        </div>

        {!dryRunPassed && hasRows && (
          <div className="mt-4 text-sm text-white/50">
            Confirm import unlocks only after a dry run passes with zero invalid
            rows.
          </div>
        )}

        <div id={feedbackId} aria-live="polite">
          {errorMessage ? (
            <div
              role="alert"
              className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200"
            >
              {errorMessage}
            </div>
          ) : null}
        </div>
      </section>

      {summary && (
        <>
          <section className="grid gap-4 md:grid-cols-6">
            <StatCard title="Rows" value={summary.totalRows} />
            <StatCard title="Valid" value={summary.validRows} />
            <StatCard title="Invalid" value={summary.invalidRows} />
            <StatCard title="Insert" value={summary.insertCount} />
            <StatCard title="Update" value={summary.updateCount} />
            <StatCard
              title="Duplicates"
              value={summary.duplicateCandidatesQueued ?? 0}
            />
          </section>

          <section
            className={`rounded-3xl border p-6 ${
              summary.invalidRows === 0
                ? "border-green-500/20 bg-green-500/10"
                : "border-red-500/20 bg-red-500/10"
            }`}
          >
            <div
              className={`text-lg font-semibold ${
                summary.invalidRows === 0 ? "text-green-300" : "text-red-200"
              }`}
            >
              {lastMode === "confirm"
                ? "Import completed"
                : summary.invalidRows === 0
                ? "Dry run passed"
                : "Dry run found issues"}
            </div>

            <p className="mt-2 text-sm text-white/70">
              {lastMode === "confirm"
                ? "Rows have been written to Supabase. Check duplicate review if candidates were queued."
                : summary.invalidRows === 0
                ? "You can now confirm the import if the preview looks correct."
                : "Fix validation errors in your CSV, then upload again and rerun dry run."}
            </p>
          </section>

          {(summary.duplicateCandidatesQueued ?? 0) > 0 && (
            <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6">
              <div className="text-lg font-semibold text-yellow-400">
                Duplicate candidates detected
              </div>

              <p className="mt-2 text-white/70">
                {summary.duplicateCandidatesQueued} possible duplicates were
                added to the review queue.
              </p>

              <Link
                href="/admin/duplicates"
                className="mt-4 inline-flex rounded-xl border border-yellow-500/30 bg-black px-4 py-3 text-sm font-semibold text-yellow-400 hover:bg-yellow-500/10"
              >
                Open duplicate review
              </Link>
            </section>
          )}

          <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
            <div className="text-2xl font-semibold text-yellow-400">
              Validation errors
            </div>

            <div className="mt-6 space-y-3">
              {summary.errors.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-white/60">
                  No validation errors found.
                </div>
              ) : (
                summary.errors.map((error, index) => (
                  <details
                    key={`${error.row}-${index}`}
                    className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4"
                  >
                    <summary className="cursor-pointer font-semibold text-red-200">
                      Row {error.row}: {error.message}
                    </summary>

                    <pre className="mt-3 max-h-52 overflow-auto whitespace-pre-wrap text-xs text-red-100/80">
                      {JSON.stringify(error.data, null, 2)}
                    </pre>
                  </details>
                ))
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
            <div className="text-2xl font-semibold text-yellow-400">
              Preview rows
            </div>

            <p className="mt-2 text-sm text-white/60">
              Showing first 20 normalised rows.
            </p>

            <div className="mt-6 space-y-3">
              {summary.rows.slice(0, 20).map((row, index) => (
                <div
                  key={index}
                  className="rounded-2xl border border-white/10 bg-black/30 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-white">
                      {(row.name as string) ?? "Untitled"}
                    </div>

                    <div
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                        row.action === "update"
                          ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-400"
                          : "border-green-500/30 bg-green-500/10 text-green-300"
                      }`}
                    >
                      {String(row.action)}
                    </div>
                  </div>

                  <div className="mt-2 text-sm text-white/60">
                    {[
                      (row.city as string) ?? null,
                      (row.category as string) ?? null,
                      (row.postcode as string) ?? null,
                    ]
                      .filter(Boolean)
                      .join(" • ")}
                  </div>

                  {typeof row.existing_id === "string" && row.existing_id.length > 0 ? (
                  <div className="mt-2 text-xs text-white/40">
                  Existing ID: {row.existing_id}
                  </div>
                    ) : null}
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <div className="text-xs uppercase tracking-[0.2em] text-yellow-400">
        {title}
      </div>
      <div className="mt-2 text-2xl font-bold text-white">{value}</div>
    </div>
  );
}
