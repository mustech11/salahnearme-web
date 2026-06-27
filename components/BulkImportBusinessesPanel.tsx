"use client";

import { useState } from "react";

type BulkResult = {
  city: string;
  raw_matches: number;
  found: number;
  inserted: number;
  skipped: number;
  invalid: number;
  status: "success" | "failed";
  error?: string;
};

type BulkResponse = {
  success?: boolean;
  summary?: {
    cities: number;
    raw_matches: number;
    found: number;
    inserted: number;
    skipped: number;
    invalid: number;
    failed: number;
  };
  results?: BulkResult[];
  error?: string;
};

export default function BulkImportBusinessesPanel() {
  const [radius, setRadius] = useState("7000");
  const [delayMs, setDelayMs] = useState("1500");
  const [limit, setLimit] = useState("");
  const [minConfidence, setMinConfidence] = useState("medium");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<BulkResponse | null>(null);
  const [errorText, setErrorText] = useState("");

  async function handleBulkImport() {
    try {
      setLoading(true);
      setErrorText("");
      setResponse(null);

      const params = new URLSearchParams();
      params.set("radius", radius);
      params.set("delay_ms", delayMs);
      params.set("min_confidence", minConfidence);

      if (limit.trim()) {
        params.set("limit", limit.trim());
      }

      const res = await fetch(`/api/import-businesses-bulk?${params.toString()}`, {
        method: "GET",
      });

      const data = (await res.json().catch(() => ({}))) as BulkResponse;

      if (!res.ok) {
        setErrorText(data.error ?? "Bulk import failed.");
        return;
      }

      setResponse(data);
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
        Phase Smart Bulk
      </div>

      <h2 className="mt-3 text-4xl font-bold text-white">
        Bulk UK halal business importer
      </h2>

      <p className="mt-3 max-w-4xl text-white/70">
        Import likely halal businesses for all active UK cities using your smart
        OpenStreetMap importer, with a delay between cities to reduce overload.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-yellow-400">
            Radius (meters)
          </label>
          <input
            value={radius}
            onChange={(e) => setRadius(e.target.value)}
            className="w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-4 text-white outline-none focus:border-yellow-400"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-yellow-400">
            Delay per city (ms)
          </label>
          <input
            value={delayMs}
            onChange={(e) => setDelayMs(e.target.value)}
            className="w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-4 text-white outline-none focus:border-yellow-400"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-yellow-400">
            Limit cities
          </label>
          <input
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            placeholder="Optional"
            className="w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-4 text-white outline-none focus:border-yellow-400"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-yellow-400">
            Minimum confidence
          </label>
          <select
            value={minConfidence}
            onChange={(e) => setMinConfidence(e.target.value)}
            className="w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-4 text-white outline-none focus:border-yellow-400"
          >
            <option value="high">High only</option>
            <option value="medium">Medium and high</option>
            <option value="low">Low, medium, and high</option>
          </select>
        </div>
      </div>

      <div className="mt-6">
        <button
          onClick={handleBulkImport}
          disabled={loading}
          className="rounded-2xl bg-green-500 px-6 py-4 font-semibold text-black transition hover:bg-green-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Importing all UK businesses..." : "Import all UK businesses"}
        </button>
      </div>

      <p className="mt-6 text-white/60">
        Start with limit 3 to 5 for testing, then remove the limit for full UK import.
      </p>

      {errorText && (
        <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {errorText}
        </div>
      )}

      {response?.summary && (
        <div className="mt-8 space-y-6">
          <div className="rounded-3xl border border-white/10 bg-black/30 p-6">
            <div className="text-2xl font-semibold text-yellow-400">
              Bulk import summary
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3 xl:grid-cols-7">
              <div className="rounded-2xl border border-white/10 bg-[rgb(var(--card))] p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-white/50">
                  Cities
                </div>
                <div className="mt-2 text-2xl font-bold text-white">
                  {response.summary.cities}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[rgb(var(--card))] p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-white/50">
                  Raw
                </div>
                <div className="mt-2 text-2xl font-bold text-white">
                  {response.summary.raw_matches}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[rgb(var(--card))] p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-white/50">
                  Accepted
                </div>
                <div className="mt-2 text-2xl font-bold text-white">
                  {response.summary.found}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[rgb(var(--card))] p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-white/50">
                  Inserted
                </div>
                <div className="mt-2 text-2xl font-bold text-green-300">
                  {response.summary.inserted}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[rgb(var(--card))] p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-white/50">
                  Skipped
                </div>
                <div className="mt-2 text-2xl font-bold text-yellow-300">
                  {response.summary.skipped}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[rgb(var(--card))] p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-white/50">
                  Invalid
                </div>
                <div className="mt-2 text-2xl font-bold text-white">
                  {response.summary.invalid}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[rgb(var(--card))] p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-white/50">
                  Failed
                </div>
                <div className="mt-2 text-2xl font-bold text-red-300">
                  {response.summary.failed}
                </div>
              </div>
            </div>
          </div>

          {response.results && response.results.length > 0 && (
            <div className="rounded-3xl border border-white/10 bg-black/30 p-6">
              <div className="text-2xl font-semibold text-yellow-400">
                Per-city results
              </div>

              <div className="mt-5 space-y-3">
                {response.results.map((item) => (
                  <div
                    key={item.city}
                    className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-[rgb(var(--card))] p-4 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="text-lg font-semibold text-white">
                      {item.city}
                    </div>

                    <div className="flex flex-wrap gap-2 text-sm">
                      <div className="rounded-full border border-white/10 px-3 py-1 text-white/70">
                        Raw: {item.raw_matches}
                      </div>
                      <div className="rounded-full border border-white/10 px-3 py-1 text-white/70">
                        Accepted: {item.found}
                      </div>
                      <div className="rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-green-300">
                        Inserted: {item.inserted}
                      </div>
                      <div className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-yellow-300">
                        Skipped: {item.skipped}
                      </div>
                      <div className="rounded-full border border-white/10 px-3 py-1 text-white/70">
                        Invalid: {item.invalid}
                      </div>
                      <div
                        className={`rounded-full px-3 py-1 ${
                          item.status === "success"
                            ? "border border-green-500/30 bg-green-500/10 text-green-300"
                            : "border border-red-500/30 bg-red-500/10 text-red-300"
                        }`}
                      >
                        {item.status === "success" ? "Success" : "Failed"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

