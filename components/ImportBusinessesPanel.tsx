"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

type City = {
  slug: string;
  name: string;
  country: string | null;
};

type Props = {
  cities: City[];
};

type ImportResponse = {
  ok?: boolean;
  error?: string;
  city?: string;
  raw_matches?: number;
  found?: number;
  inserted?: number;
  skipped?: number;
  invalid?: number;
};

type SubmitState = "idle" | "loading" | "success" | "error";

const REQUEST_TIMEOUT_MS = 30_000;
const MIN_RADIUS_METRES = 1_000;
const MAX_RADIUS_METRES = 50_000;
const DEFAULT_RADIUS_METRES = 7_000;

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normaliseRadius(value: string): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_RADIUS_METRES;
  }

  return Math.min(
    MAX_RADIUS_METRES,
    Math.max(MIN_RADIUS_METRES, Math.trunc(parsed))
  );
}

async function readJson(response: Response): Promise<ImportResponse> {
  try {
    const value: unknown = await response.json();

    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }

    return value as ImportResponse;
  } catch {
    return {};
  }
}

export default function ImportBusinessesPanel({ cities }: Props) {
  const feedbackId = useId();
  const abortControllerRef = useRef<AbortController | null>(null);

  const [selectedCity, setSelectedCity] = useState("");
  const [radius, setRadius] = useState(String(DEFAULT_RADIUS_METRES));
  const [minConfidence, setMinConfidence] = useState("medium");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [result, setResult] = useState("");
  const [lastRunAt, setLastRunAt] = useState<Date | null>(null);

  const loading = submitState === "loading";

  const sortedCities = useMemo(() => {
    const seen = new Set<string>();

    return (cities ?? [])
      .filter((city) => {
        const slug = cleanText(city.slug);

        if (!slug || seen.has(slug)) return false;

        seen.add(slug);
        return true;
      })
      .sort((a, b) => {
        const countryCompare = cleanText(a.country).localeCompare(
          cleanText(b.country),
          "en-GB",
          { sensitivity: "base" }
        );

        if (countryCompare !== 0) return countryCompare;

        return cleanText(a.name).localeCompare(cleanText(b.name), "en-GB", {
          sensitivity: "base",
        });
      });
  }, [cities]);

  const selectedCityRecord = useMemo(
    () => sortedCities.find((city) => city.slug === selectedCity) ?? null,
    [selectedCity, sortedCities]
  );

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const handleImport = useCallback(async () => {
    if (!selectedCityRecord) {
      setSubmitState("error");
      setResult("Choose a valid city first.");
      return;
    }

    abortControllerRef.current?.abort();

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let timedOut = false;
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    setSubmitState("loading");
    setResult("");

    try {
      const params = new URLSearchParams({
        city: selectedCityRecord.slug,
        radius: String(normaliseRadius(radius)),
        min_confidence: minConfidence,
      });

      const response = await fetch(`/api/import-businesses?${params.toString()}`, {
        method: "GET",
        headers: { Accept: "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
      });

      const data = await readJson(response);

      if (!response.ok || data.ok === false) {
        setSubmitState("error");
        setResult(cleanText(data.error) || "Business import failed.");
        return;
      }

      setSubmitState("success");
      setLastRunAt(new Date());
      setResult(
        `Import complete for ${cleanText(data.city) || selectedCityRecord.name}. Raw matches: ${
          data.raw_matches ?? 0
        }, accepted: ${data.found ?? 0}, inserted: ${data.inserted ?? 0}, skipped: ${
          data.skipped ?? 0
        }, invalid: ${data.invalid ?? 0}.`
      );
    } catch (error) {
      setSubmitState("error");
      setResult(
        error instanceof DOMException && error.name === "AbortError"
          ? timedOut
            ? "The business import timed out. Try a smaller radius."
            : "The business import was cancelled."
          : error instanceof Error
            ? error.message
            : "Unexpected business import error."
      );
    } finally {
      window.clearTimeout(timeoutId);

      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  }, [minConfidence, radius, selectedCityRecord]);

  return (
    <section
      aria-labelledby="import-businesses-heading"
      className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6 md:p-8"
    >
      <div>
        <div className="text-sm uppercase tracking-[0.22em] text-yellow-400">
          Admin import
        </div>

        <h2
          id="import-businesses-heading"
          className="mt-2 text-2xl font-black text-white md:text-3xl"
        >
          Import halal businesses by city
        </h2>

        <p className="mt-2 max-w-3xl text-sm leading-6 text-white/60">
          Run the smart business importer for one city with a controlled radius
          and minimum halal-confidence threshold.
        </p>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_220px_auto]">
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-yellow-300">
            City
          </span>

          <select
            value={selectedCity}
            disabled={loading}
            onChange={(event) => {
              setSelectedCity(event.target.value);
              setSubmitState("idle");
              setResult("");
            }}
            className="min-h-12 w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none focus:border-yellow-400 disabled:opacity-60"
          >
            <option value="">Choose city</option>

            {sortedCities.map((city) => (
              <option key={city.slug} value={city.slug}>
                {city.name}
                {city.country ? `, ${city.country}` : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-bold text-yellow-300">
            Radius (metres)
          </span>

          <input
            type="number"
            min={MIN_RADIUS_METRES}
            max={MAX_RADIUS_METRES}
            step={1_000}
            value={radius}
            disabled={loading}
            onChange={(event) => setRadius(event.target.value)}
            onBlur={() => setRadius(String(normaliseRadius(radius)))}
            className="min-h-12 w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none focus:border-yellow-400 disabled:opacity-60"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-bold text-yellow-300">
            Minimum confidence
          </span>

          <select
            value={minConfidence}
            disabled={loading}
            onChange={(event) => setMinConfidence(event.target.value)}
            className="min-h-12 w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none focus:border-yellow-400 disabled:opacity-60"
          >
            <option value="high">High only</option>
            <option value="medium">Medium and high</option>
            <option value="low">Low, medium and high</option>
          </select>
        </label>

        <div className="flex items-end">
          <button
            type="button"
            onClick={() => void handleImport()}
            disabled={loading || !selectedCityRecord}
            className="min-h-12 w-full rounded-2xl bg-yellow-500 px-5 py-3 font-black text-black transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Importing…" : "Import businesses"}
          </button>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-white/55">
        Wider radiuses may include neighbouring towns. Start with 7,000 metres,
        inspect the results, then increase only when needed.
      </div>

      <div id={feedbackId} aria-live="polite">
        {result ? (
          <div
            role={submitState === "error" ? "alert" : "status"}
            className={`mt-5 rounded-2xl border p-4 text-sm ${
              submitState === "error"
                ? "border-red-500/30 bg-red-500/10 text-red-200"
                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
            }`}
          >
            {result}
          </div>
        ) : null}

        {lastRunAt ? (
          <p className="mt-3 text-xs text-white/35">
            Last completed{" "}
            {lastRunAt.toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        ) : null}
      </div>
    </section>
  );
}