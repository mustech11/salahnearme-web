"use client";

import { useMemo, useState } from "react";

type City = {
  slug: string;
  name: string;
  country: string | null;
};

type Props = {
  cities: City[];
};

export default function ImportBusinessesPanel({ cities }: Props) {
  const [selectedCity, setSelectedCity] = useState("");
  const [radius, setRadius] = useState("7000");
  const [minConfidence, setMinConfidence] = useState("medium");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");

  const sortedCities = useMemo(() => {
    return [...cities].sort((a, b) => {
      const countryCompare = (a.country ?? "").localeCompare(b.country ?? "");
      if (countryCompare !== 0) return countryCompare;
      return a.name.localeCompare(b.name);
    });
  }, [cities]);

  async function handleImport() {
    if (!selectedCity) {
      setResult("Choose a city first.");
      return;
    }

    setLoading(true);
    setResult("");

    try {
      const response = await fetch(
        `/api/import-businesses?city=${encodeURIComponent(
          selectedCity
        )}&radius=${encodeURIComponent(radius)}&min_confidence=${encodeURIComponent(
          minConfidence
        )}`,
        { method: "GET" }
      );

      const data = await response.json();

      if (!response.ok) {
        setResult(data.error ?? "Import failed.");
        return;
      }

      setResult(
        `Import complete for ${data.city}. Raw matches: ${data.raw_matches ?? 0}, accepted: ${data.found}, inserted: ${data.inserted}, skipped: ${data.skipped}, invalid: ${data.invalid}.`
      );
    } catch (error) {
      setResult(
        error instanceof Error ? error.message : "Unexpected import error."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_220px_220px_220px]">
        <div>
          <label className="mb-2 block text-sm font-medium text-yellow-400">
            City
          </label>

          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className="w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-4 text-white outline-none focus:border-yellow-400"
          >
            <option value="">Choose city</option>
            {sortedCities.map((city) => (
              <option key={city.slug} value={city.slug}>
                {city.name}
                {city.country ? `, ${city.country}` : ""}
              </option>
            ))}
          </select>
        </div>

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

        <div className="flex items-end">
          <button
            onClick={handleImport}
            disabled={loading}
            className="w-full rounded-2xl bg-yellow-500 px-5 py-4 font-semibold text-black transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Importing..." : "Import businesses"}
          </button>
        </div>
      </div>

      <p className="mt-6 text-white/60">
        Use this for admin imports only. Wider radiuses can return more results
        but may also include nearby surrounding areas.
      </p>

      {result && (
        <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/80">
          {result}
        </div>
      )}
    </section>
  );
}

