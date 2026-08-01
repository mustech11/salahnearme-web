"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type EntityType = "mosques" | "businesses";

const REQUEST_TIMEOUT_MS = 60_000;
const MAX_RADIUS_METRES = 50_000;
const MAX_DELAY_MS = 10_000;
const MAX_CITY_LIMIT = 500;

type City = {
  slug: string;
  name: string;
  country: string | null;
};

type Props = {
  entity: EntityType;
  cities: City[];
};

type ImportResult = {
  city: string;
  raw_matches?: number;
  found: number;
  inserted: number;
  skipped: number;
  invalid: number;
  status: "success" | "failed";
  error?: string;
};

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timeoutId = window.setTimeout(resolve, ms);

    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timeoutId);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true }
    );
  });
}

function safeInteger(
  value: string,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) return fallback;

  return Math.min(maximum, Math.max(minimum, Math.trunc(parsed)));
}

export default function OsmBulkImportPanel({ entity, cities }: Props) {
  const abortControllerRef = useRef<AbortController | null>(null);
  const [selectedCountry, setSelectedCountry] = useState("all");
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [radius, setRadius] = useState(entity === "mosques" ? "15000" : "7000");
  const [delayMs, setDelayMs] = useState("1500");
  const [limit, setLimit] = useState("");
  const [minConfidence, setMinConfidence] = useState("medium");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [errorText, setErrorText] = useState("");
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [lastCompletedAt, setLastCompletedAt] = useState<Date | null>(null);

  const title =
    entity === "mosques"
      ? "Bulk worldwide mosque importer"
      : "Bulk worldwide halal business importer";

  const description =
    entity === "mosques"
      ? "Import mosques from OpenStreetMap for one city, selected cities, or all active SalahNearMe cities worldwide."
      : "Import likely halal businesses from OpenStreetMap for one city, selected cities, or all active SalahNearMe cities worldwide.";

  const endpoint =
    entity === "mosques" ? "/api/import-mosques" : "/api/import-businesses";

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const countries = useMemo(() => {
    return Array.from(
      new Set(cities.map((city) => city.country).filter(Boolean) as string[])
    ).sort((a, b) => a.localeCompare(b));
  }, [cities]);

  const filteredCities = useMemo(() => {
    return cities
      .filter((city) =>
        selectedCountry === "all" ? true : city.country === selectedCountry
      )
      .sort((a, b) => {
        const countryCompare = (a.country ?? "").localeCompare(b.country ?? "");
        if (countryCompare !== 0) return countryCompare;
        return a.name.localeCompare(b.name);
      });
  }, [cities, selectedCountry]);

  const summary = useMemo(() => {
    return results.reduce(
      (acc, item) => {
        acc.cities += 1;
        acc.raw_matches += item.raw_matches ?? 0;
        acc.found += item.found ?? 0;
        acc.inserted += item.inserted ?? 0;
        acc.skipped += item.skipped ?? 0;
        acc.invalid += item.invalid ?? 0;
        if (item.status === "failed") acc.failed += 1;
        return acc;
      },
      {
        cities: 0,
        raw_matches: 0,
        found: 0,
        inserted: 0,
        skipped: 0,
        invalid: 0,
        failed: 0,
      }
    );
  }, [results]);

  function toggleCity(slug: string) {
    setSelectedCities((current) =>
      current.includes(slug)
        ? current.filter((item) => item !== slug)
        : [...current, slug]
    );
  }

  function selectFilteredCities() {
    setSelectedCities((current) =>
      Array.from(
        new Set([...current, ...filteredCities.map((city) => city.slug)])
      )
    );
  }

  function clearSelectedCities() {
    setSelectedCities([]);
  }

  async function importOneCity(
    citySlug: string,
    signal: AbortSignal,
    safeRadius: number
  ): Promise<ImportResult> {
    const params = new URLSearchParams();

    params.set("city", citySlug);
    params.set("radius", String(safeRadius));

    if (entity === "businesses") {
      params.set("min_confidence", minConfidence);
    }

    const response = await fetch(`${endpoint}?${params.toString()}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      signal,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        city: citySlug,
        raw_matches: 0,
        found: 0,
        inserted: 0,
        skipped: 0,
        invalid: 0,
        status: "failed",
        error: data.error ?? "Import failed.",
      };
    }

    return {
      city: data.city ?? citySlug,
      raw_matches: data.raw_matches ?? data.raw ?? 0,
      found: data.found ?? 0,
      inserted: data.inserted ?? 0,
      skipped: data.skipped ?? 0,
      invalid: data.invalid ?? 0,
      status: "success",
    };
  }

  async function handleImport(mode: "selected" | "filtered") {
    const safeRadius = safeInteger(
      radius,
      entity === "mosques" ? 15_000 : 7_000,
      1_000,
      MAX_RADIUS_METRES
    );
    const safeDelay = safeInteger(delayMs, 1_500, 0, MAX_DELAY_MS);
    const safeLimit = limit.trim()
      ? safeInteger(limit, 1, 1, MAX_CITY_LIMIT)
      : null;

    let targetCities =
      mode === "selected"
        ? selectedCities
        : filteredCities.map((city) => city.slug);

    targetCities = Array.from(new Set(targetCities));

    if (safeLimit !== null) {
      targetCities = targetCities.slice(0, safeLimit);
    }

    if (targetCities.length === 0) {
      setErrorText("Choose at least one city first.");
      return;
    }

    const confirmed = window.confirm(
      `Start ${entity} import?\n\nCities: ${targetCities.length}\nRadius: ${safeRadius}m\nDelay: ${safeDelay}ms\n\nContinue?`
    );

    if (!confirmed) return;

    abortControllerRef.current?.abort();

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setLoading(true);
      setErrorText("");
      setResults([]);
      setProgress({ completed: 0, total: targetCities.length });

      const nextResults: ImportResult[] = [];

      for (let index = 0; index < targetCities.length; index += 1) {
        if (controller.signal.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }

        const result = await importOneCity(
          targetCities[index],
          controller.signal,
          safeRadius
        );

        nextResults.push(result);
        setResults([...nextResults]);
        setProgress({
          completed: index + 1,
          total: targetCities.length,
        });

        if (index < targetCities.length - 1 && safeDelay > 0) {
          await wait(safeDelay, controller.signal);
        }
      }

      setLastCompletedAt(new Date());
    } catch (error) {
      setErrorText(
        error instanceof DOMException && error.name === "AbortError"
          ? "The bulk import was cancelled."
          : error instanceof Error
            ? error.message
            : "Unexpected bulk import error."
      );
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }

      setLoading(false);
    }
  }

  return (
    <section className="luxe-card rounded-3xl p-8">
      <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
        OpenStreetMap Import
      </div>

      <h2 className="mt-3 text-4xl font-black text-white">{title}</h2>

      <p className="mt-3 max-w-4xl text-white/70">{description}</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-5">
        <div>
          <label className="mb-2 block text-sm font-medium text-yellow-400">
            Country
          </label>

          <select
            value={selectedCountry}
            onChange={(e) => {
              setSelectedCountry(e.target.value);
              setSelectedCities([]);
            }}
            className="w-full rounded-2xl border border-yellow-500/30 bg-[#020826]/80 px-4 py-4 text-white outline-none focus:border-yellow-400"
          >
            <option value="all">All countries</option>

            {countries.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-yellow-400">
            Radius metres
          </label>

          <input
            type="number"
            min="1000"
            max={MAX_RADIUS_METRES}
            step="1000"
            value={radius}
            onChange={(e) => setRadius(e.target.value)}
            className="w-full rounded-2xl border border-yellow-500/30 bg-[#020826]/80 px-4 py-4 text-white outline-none focus:border-yellow-400"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-yellow-400">
            Delay per city ms
          </label>

          <input
            type="number"
            min="0"
            max={MAX_DELAY_MS}
            step="250"
            value={delayMs}
            onChange={(e) => setDelayMs(e.target.value)}
            className="w-full rounded-2xl border border-yellow-500/30 bg-[#020826]/80 px-4 py-4 text-white outline-none focus:border-yellow-400"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-yellow-400">
            Limit cities
          </label>

          <input
            type="number"
            min="1"
            max={MAX_CITY_LIMIT}
            step="1"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            placeholder="Optional"
            className="w-full rounded-2xl border border-yellow-500/30 bg-[#020826]/80 px-4 py-4 text-white outline-none focus:border-yellow-400"
          />
        </div>

        {entity === "businesses" && (
          <div>
            <label className="mb-2 block text-sm font-medium text-yellow-400">
              Min confidence
            </label>

            <select
              value={minConfidence}
              onChange={(e) => setMinConfidence(e.target.value)}
              className="w-full rounded-2xl border border-yellow-500/30 bg-[#020826]/80 px-4 py-4 text-white outline-none focus:border-yellow-400"
            >
              <option value="high">High only</option>
              <option value="medium">Medium and high</option>
              <option value="low">Low, medium and high</option>
            </select>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={selectFilteredCities}
          disabled={loading}
          className="luxe-button-outline text-sm disabled:opacity-50"
        >
          Select visible cities
        </button>

        <button
          type="button"
          onClick={clearSelectedCities}
          disabled={loading}
          className="luxe-button-outline text-sm disabled:opacity-50"
        >
          Clear selected
        </button>

        <button
          type="button"
          onClick={() => handleImport("selected")}
          disabled={loading || selectedCities.length === 0}
          className="luxe-button text-sm disabled:opacity-50"
        >
          {loading
            ? "Importing..."
            : `Import selected (${selectedCities.length})`}
        </button>

        <button
          type="button"
          onClick={() => handleImport("filtered")}
          disabled={loading || filteredCities.length === 0}
          className="luxe-button text-sm disabled:opacity-50"
        >
          {loading ? "Importing..." : "Import all visible/worldwide"}
        </button>

        {loading ? (
          <button
            type="button"
            onClick={() => abortControllerRef.current?.abort()}
            className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200"
          >
            Cancel import
          </button>
        ) : null}
      </div>

      {progress.total > 0 ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="flex items-center justify-between gap-3 text-xs text-white/50">
            <span>Progress</span>
            <span>
              {progress.completed}/{progress.total} cities
            </span>
          </div>

          <div className="mt-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-2 rounded-full bg-yellow-500 transition-[width]"
              style={{
                width: `${Math.round(
                  (progress.completed / progress.total) * 100
                )}%`,
              }}
            />
          </div>
        </div>
      ) : null}

      {lastCompletedAt ? (
        <p className="mt-3 text-xs text-white/35">
          Last completed {lastCompletedAt.toLocaleString("en-GB")}
        </p>
      ) : null}

      <p className="mt-4 text-sm text-white/50">
        Start with a limit of 3–5 cities for testing. Then increase gradually.
        All imports use cities already present and active in SalahNearMe.
      </p>

      <div className="luxe-card-soft mt-6 max-h-[360px] overflow-auto rounded-2xl p-4">
        <div className="mb-3 text-sm font-semibold text-yellow-400">
          Active cities shown: {filteredCities.length}
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filteredCities.map((city) => (
            <label
              key={city.slug}
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white/80 hover:border-yellow-500/30"
            >
              <input
                type="checkbox"
                checked={selectedCities.includes(city.slug)}
                onChange={() => toggleCity(city.slug)}
              />

              <span>
                {city.name}
                {city.country ? `, ${city.country}` : ""}
              </span>
            </label>
          ))}
        </div>
      </div>

      {errorText && (
        <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {errorText}
        </div>
      )}

      {results.length > 0 && (
        <div className="mt-8 space-y-6">
          <section className="luxe-card-soft rounded-3xl p-6">
            <div className="text-2xl font-bold text-yellow-400">
              Import summary
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3 xl:grid-cols-7">
              <Stat title="Cities" value={summary.cities} />
              <Stat title="Raw" value={summary.raw_matches} />
              <Stat title="Found" value={summary.found} />
              <Stat title="Inserted" value={summary.inserted} green />
              <Stat title="Skipped" value={summary.skipped} />
              <Stat title="Invalid" value={summary.invalid} />
              <Stat title="Failed" value={summary.failed} red />
            </div>
          </section>

          <section className="luxe-card-soft rounded-3xl p-6">
            <div className="text-2xl font-bold text-yellow-400">
              Per-city results
            </div>

            <div className="mt-5 space-y-3">
              {results.map((item, index) => (
                <div
                  key={`${item.city}-${index}`}
                  className="rounded-2xl border border-white/10 bg-black/30 p-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="text-lg font-semibold text-white">
                        {item.city}
                      </div>

                      {item.error && (
                        <div className="mt-1 text-sm text-red-300">
                          {item.error}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 text-sm">
                      <Pill text={`Raw: ${item.raw_matches ?? 0}`} />
                      <Pill text={`Found: ${item.found}`} />
                      <Pill text={`Inserted: ${item.inserted}`} green />
                      <Pill text={`Skipped: ${item.skipped}`} />
                      <Pill text={`Invalid: ${item.invalid}`} />
                      <Pill
                        text={item.status === "success" ? "Success" : "Failed"}
                        green={item.status === "success"}
                        red={item.status === "failed"}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

function Stat({
  title,
  value,
  green,
  red,
}: {
  title: string;
  value: number;
  green?: boolean;
  red?: boolean;
}) {
  return (
    <div className="luxe-card-soft rounded-2xl p-4">
      <div className="text-xs uppercase tracking-[0.2em] text-white/50">
        {title}
      </div>
      <div
        className={`mt-2 text-2xl font-black ${
          green ? "text-green-300" : red ? "text-red-300" : "text-white"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function Pill({
  text,
  green,
  red,
}: {
  text: string;
  green?: boolean;
  red?: boolean;
}) {
  return (
    <span
      className={`rounded-full border px-3 py-1 ${
        green
          ? "border-green-500/30 bg-green-500/10 text-green-300"
          : red
            ? "border-red-500/30 bg-red-500/10 text-red-300"
            : "border-white/10 text-white/70"
      }`}
    >
      {text}
    </span>
  );
}
