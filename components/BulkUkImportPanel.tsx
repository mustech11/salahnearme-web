"use client";

import { useState } from "react";

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

export default function BulkUkImportPanel() {
  const [radius, setRadius] = useState("5000");
  const [delayMs, setDelayMs] = useState("1500");
  const [limit, setLimit] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [result, setResult] = useState<BulkResponse | null>(null);

  async function handleBulkImport() {
    setLoading(true);
    setErrorText("");
    setResult(null);

    try {
      const query = new URLSearchParams({
        radius,
        delayMs,
      });

      if (limit.trim()) {
        query.set("limit", limit.trim());
      }

      const response = await fetch(`/api/admin/import-all-uk?${query.toString()}`, {
        method: "GET",
        cache: "no-store",
      });

      const data = (await response.json()) as BulkResponse;

      if (!response.ok) {
        setErrorText(data.error ?? "Bulk import failed.");
        return;
      }

      setResult(data);
    } catch (error) {
      setErrorText(
        error instanceof Error ? error.message : "Unexpected bulk import error."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-3xl border border-green-500/20 bg-[rgb(var(--card))] p-8">
      <div className="text-sm uppercase tracking-[0.2em] text-green-300">
        Phase 5.2
      </div>

      <h2 className="mt-3 text-3xl font-bold text-white">
        Bulk UK mosque importer
      </h2>

      <p className="mt-3 max-w-3xl text-white/70">
        Import mosques for all active UK cities using your existing OpenStreetMap
        importer, with a delay between cities to reduce overload.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-yellow-400">
            Radius (meters)
          </label>
          <input
            type="number"
            min="1000"
            step="1000"
            value={radius}
            onChange={(e) => setRadius(e.target.value)}
            className="w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none focus:border-yellow-400"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-yellow-400">
            Delay per city (ms)
          </label>
          <input
            type="number"
            min="0"
            step="250"
            value={delayMs}
            onChange={(e) => setDelayMs(e.target.value)}
            className="w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none focus:border-yellow-400"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-yellow-400">
            Limit cities
          </label>
          <input
            type="number"
            min="1"
            step="1"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            placeholder="Optional"
            className="w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none focus:border-yellow-400"
          />
        </div>

        <div className="flex items-end">
          <button
            onClick={handleBulkImport}
            disabled={loading}
            className="w-full rounded-2xl bg-green-500/90 px-4 py-3 font-semibold text-black transition hover:bg-green-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Importing UK cities..." : "Import all UK mosques"}
          </button>
        </div>
      </div>

      <div className="mt-4 text-sm text-white/60">
        Start with limit 3 to 5 for testing, then remove the limit for full UK import.
      </div>

      {errorText && (
        <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
          {errorText}
        </div>
      )}

      {result && (
        <div className="mt-6 space-y-6">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
            <div className="text-lg font-semibold text-yellow-400">
              Bulk import summary
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <div className="rounded-xl border border-white/10 bg-[rgb(var(--card))] p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-white/50">
                  Cities
                </div>
                <div className="mt-2 text-2xl font-bold text-white">
                  {result.totals.citiesProcessed}
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-[rgb(var(--card))] p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-white/50">
                  Found
                </div>
                <div className="mt-2 text-2xl font-bold text-white">
                  {result.totals.found}
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-[rgb(var(--card))] p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-white/50">
                  Inserted
                </div>
                <div className="mt-2 text-2xl font-bold text-green-300">
                  {result.totals.inserted}
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-[rgb(var(--card))] p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-white/50">
                  Skipped
                </div>
                <div className="mt-2 text-2xl font-bold text-yellow-400">
                  {result.totals.skipped}
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-[rgb(var(--card))] p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-white/50">
                  Invalid
                </div>
                <div className="mt-2 text-2xl font-bold text-white">
                  {result.totals.invalid}
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-[rgb(var(--card))] p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-white/50">
                  Failed
                </div>
                <div className="mt-2 text-2xl font-bold text-red-300">
                  {result.totals.failed}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
            <div className="text-lg font-semibold text-yellow-400">
              Per-city results
            </div>

            <div className="mt-4 space-y-3">
              {result.results.map((row) => (
                <div
                  key={row.city}
                  className="rounded-xl border border-white/10 bg-[rgb(var(--card))] p-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="font-semibold text-white">{row.city}</div>

                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full border border-white/10 px-3 py-1 text-white/70">
                        Found: {row.found}
                      </span>
                      <span className="rounded-full border border-green-500/20 bg-green-500/10 px-3 py-1 text-green-300">
                        Inserted: {row.inserted}
                      </span>
                      <span className="rounded-full border border-yellow-500/20 bg-yellow-500/10 px-3 py-1 text-yellow-400">
                        Skipped: {row.skipped}
                      </span>
                      <span className="rounded-full border border-white/10 px-3 py-1 text-white/70">
                        Invalid: {row.invalid}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 ${
                          row.success
                            ? "border border-green-500/20 bg-green-500/10 text-green-300"
                            : "border border-red-500/20 bg-red-500/10 text-red-300"
                        }`}
                      >
                        {row.success ? "Success" : "Failed"}
                      </span>
                    </div>
                  </div>

                  {row.error && (
                    <div className="mt-3 text-sm text-red-300">{row.error}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

