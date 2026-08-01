"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

type CityResult = {
  city: string;
  found: number;
  inserted: number;
  skipped: number;
  invalid: number;
  success: boolean;
  error?: string;
};

type BulkResponse = {
  success: boolean;
  radius: number;
  delayMs: number;
  totals: {
    citiesProcessed: number;
    found: number;
    inserted: number;
    skipped: number;
    invalid: number;
    failed: number;
  };
  results: CityResult[];
  error?: string;
};

type RunState = "idle" | "running" | "success" | "error";

const REQUEST_TIMEOUT_MS = 15 * 60_000;
const MIN_RADIUS = 1_000;
const MAX_RADIUS = 50_000;
const MIN_DELAY_MS = 0;
const MAX_DELAY_MS = 10_000;
const MAX_CITY_LIMIT = 500;

function clampInteger(
  value: string,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) return fallback;

  return Math.min(maximum, Math.max(minimum, Math.trunc(parsed)));
}

async function readJson(response: Response): Promise<BulkResponse | null> {
  try {
    const value: unknown = await response.json();

    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }

    return value as BulkResponse;
  } catch {
    return null;
  }
}

export default function BulkUkImportPanel() {
  const statusId = useId();
  const abortControllerRef = useRef<AbortController | null>(null);

  const [radius, setRadius] = useState("5000");
  const [delayMs, setDelayMs] = useState("1500");
  const [limit, setLimit] = useState("");
  const [runState, setRunState] = useState<RunState>("idle");
  const [errorText, setErrorText] = useState("");
  const [result, setResult] = useState<BulkResponse | null>(null);
  const [lastCompletedAt, setLastCompletedAt] = useState<Date | null>(null);

  const loading = runState === "running";

  const estimatedCities = useMemo(
    () =>
      limit.trim()
        ? clampInteger(limit, 1, 1, MAX_CITY_LIMIT)
        : null,
    [limit]
  );

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const handleBulkImport = useCallback(async () => {
    const safeRadius = clampInteger(radius, 5_000, MIN_RADIUS, MAX_RADIUS);
    const safeDelay = clampInteger(
      delayMs,
      1_500,
      MIN_DELAY_MS,
      MAX_DELAY_MS
    );
    const safeLimit = limit.trim()
      ? clampInteger(limit, 1, 1, MAX_CITY_LIMIT)
      : null;

    const confirmed = window.confirm(
      safeLimit
        ? `Import mosques for up to ${safeLimit} UK cities?`
        : "Start the full UK mosque import for every active city?"
    );

    if (!confirmed) return;

    abortControllerRef.current?.abort();

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let timedOut = false;
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    setRunState("running");
    setErrorText("");
    setResult(null);

    try {
      const query = new URLSearchParams({
        radius: String(safeRadius),
        delayMs: String(safeDelay),
      });

      if (safeLimit !== null) {
        query.set("limit", String(safeLimit));
      }

      const response = await fetch(
        `/api/admin/import-all-uk?${query.toString()}`,
        {
          method: "GET",
          headers: { Accept: "application/json" },
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        }
      );

      const data = await readJson(response);

      if (!response.ok || !data || data.success === false) {
        setRunState("error");
        setErrorText(data?.error ?? "Bulk mosque import failed.");
        return;
      }

      setResult(data);
      setRunState("success");
      setLastCompletedAt(new Date());
    } catch (error) {
      setRunState("error");
      setErrorText(
        error instanceof DOMException && error.name === "AbortError"
          ? timedOut
            ? "The bulk mosque import exceeded the allowed time."
            : "The bulk mosque import was cancelled."
          : error instanceof Error
            ? error.message
            : "Unexpected bulk mosque import error."
      );
    } finally {
      window.clearTimeout(timeoutId);

      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  }, [delayMs, limit, radius]);

  return (
    <section
      aria-labelledby="bulk-uk-mosque-import-heading"
      className="rounded-3xl border border-emerald-500/20 bg-[rgb(var(--card))] p-6 md:p-8"
    >
      <div className="text-sm uppercase tracking-[0.22em] text-emerald-300">
        UK bulk operations
      </div>

      <h2
        id="bulk-uk-mosque-import-heading"
        className="mt-3 text-3xl font-black text-white"
      >
        Bulk UK mosque importer
      </h2>

      <p className="mt-3 max-w-3xl text-sm leading-7 text-white/65">
        Import mosques for active UK cities using the existing OpenStreetMap
        importer, with a configurable delay to reduce API and database load.
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-4">
        <NumberField
          label="Radius (metres)"
          value={radius}
          min={MIN_RADIUS}
          max={MAX_RADIUS}
          step={1000}
          disabled={loading}
          onChange={setRadius}
        />

        <NumberField
          label="Delay per city (ms)"
          value={delayMs}
          min={MIN_DELAY_MS}
          max={MAX_DELAY_MS}
          step={250}
          disabled={loading}
          onChange={setDelayMs}
        />

        <NumberField
          label="Limit cities"
          value={limit}
          min={1}
          max={MAX_CITY_LIMIT}
          step={1}
          disabled={loading}
          placeholder="Optional"
          onChange={setLimit}
        />

        <div className="flex items-end">
          <button
            type="button"
            onClick={() => void handleBulkImport()}
            disabled={loading}
            className="min-h-12 w-full rounded-2xl bg-emerald-500 px-5 py-3 font-black text-black transition hover:bg-emerald-400 disabled:cursor-wait disabled:opacity-50"
          >
            {loading ? "Importing UK cities…" : "Start bulk mosque import"}
          </button>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm leading-6 text-yellow-100">
        Test with a limit of 3–5 cities before running the full UK import.
        {estimatedCities ? ` Current test limit: ${estimatedCities}.` : ""}
      </div>

      <div id={statusId} aria-live="polite">
        {errorText ? (
          <div
            role="alert"
            className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200"
          >
            {errorText}
          </div>
        ) : null}

        {lastCompletedAt ? (
          <p className="mt-3 text-xs text-white/35">
            Last completed{" "}
            {lastCompletedAt.toLocaleString("en-GB")}
          </p>
        ) : null}
      </div>

      {result ? <BulkMosqueResult result={result} /> : null}
    </section>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step,
  disabled,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  min: number;
  max: number;
  step: number;
  disabled: boolean;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="mb-2 block text-sm font-bold text-yellow-300">
        {label}
      </span>

      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-12 w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none focus:border-yellow-400 disabled:opacity-60"
      />
    </label>
  );
}

function BulkMosqueResult({ result }: { result: BulkResponse }) {
  return (
    <div className="mt-6 space-y-6">
      <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
        <div className="text-lg font-black text-yellow-300">
          Bulk import summary
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <Metric label="Cities" value={result.totals.citiesProcessed} />
          <Metric label="Found" value={result.totals.found} />
          <Metric label="Inserted" value={result.totals.inserted} tone="good" />
          <Metric label="Skipped" value={result.totals.skipped} tone="warning" />
          <Metric label="Invalid" value={result.totals.invalid} />
          <Metric label="Failed" value={result.totals.failed} tone="danger" />
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
        <div className="text-lg font-black text-yellow-300">
          Per-city results
        </div>

        <div className="mt-4 space-y-3">
          {(result.results ?? []).map((row, index) => (
            <article
              key={`${row.city}-${index}`}
              className="rounded-xl border border-white/10 bg-[rgb(var(--card))] p-4"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="font-bold text-white">{row.city}</div>

                <div className="flex flex-wrap gap-2 text-xs">
                  <Pill>Found: {row.found}</Pill>
                  <Pill tone="good">Inserted: {row.inserted}</Pill>
                  <Pill tone="warning">Skipped: {row.skipped}</Pill>
                  <Pill>Invalid: {row.invalid}</Pill>
                  <Pill tone={row.success ? "good" : "danger"}>
                    {row.success ? "Success" : "Failed"}
                  </Pill>
                </div>
              </div>

              {row.error ? (
                <p className="mt-3 text-sm text-red-300">{row.error}</p>
              ) : null}
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "good" | "warning" | "danger";
}) {
  const toneClass =
    tone === "good"
      ? "text-emerald-300"
      : tone === "warning"
        ? "text-yellow-300"
        : tone === "danger"
          ? "text-red-300"
          : "text-white";

  return (
    <div className="rounded-xl border border-white/10 bg-[rgb(var(--card))] p-4">
      <div className="text-xs uppercase tracking-[0.18em] text-white/45">
        {label}
      </div>
      <div className={`mt-2 text-2xl font-black ${toneClass}`}>{value}</div>
    </div>
  );
}

function Pill({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "good" | "warning" | "danger";
}) {
  const toneClass =
    tone === "good"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
      : tone === "warning"
        ? "border-yellow-500/20 bg-yellow-500/10 text-yellow-300"
        : tone === "danger"
          ? "border-red-500/20 bg-red-500/10 text-red-300"
          : "border-white/10 text-white/65";

  return (
    <span className={`rounded-full border px-3 py-1 ${toneClass}`}>
      {children}
    </span>
  );
}