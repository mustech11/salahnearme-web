"use client";

import { useMemo, useState } from "react";

type EntityType = "mosques" | "businesses";

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

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function OsmBulkImportPanel({ entity, cities }: Props) {
  const [selectedCountry, setSelectedCountry] = useState("all");
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [radius, setRadius] = useState(entity === "mosques" ? "15000" : "7000");
  const [delayMs, setDelayMs] = useState("1500");
  const [limit, setLimit] = useState("");
  const [minConfidence, setMinConfidence] = useState("medium");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [errorText, setErrorText] = useState("");

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
    setSelectedCities(filteredCities.map((city) => city.slug));
  }

  function clearSelectedCities() {
    setSelectedCities([]);
  }

  async function importOneCity(citySlug: string): Promise<ImportResult> {
    const params = new URLSearchParams();

    params.set("city", citySlug);
    params.set("radius", radius);

    if (entity === "businesses") {
      params.set("min_confidence", minConfidence);
    }

    const response = await fetch(`${endpoint}?${params.toString()}`, {
      method: "GET",
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
    try {
      setLoading(true);
      setErrorText("");
      setResults([]);

      let targetCities =
        mode === "selected"
          ? selectedCities
          : filteredCities.map((city) => city.slug);

      if (targetCities.length === 0) {
        setErrorText("Choose at least one city first.");
        return;
      }

      if (limit.trim()) {
        const safeLimit = Math.max(1, Number(limit));
        targetCities = targetCities.slice(0, safeLimit);
      }

      const confirmed = window.confirm(
        `Start ${entity} import?\n\nCities: ${targetCities.length}\nRadius: ${radius}m\nDelay: ${delayMs}ms\n\nContinue?`
      );

      if (!confirmed) return;

      const nextResults: ImportResult[] = [];

      for (let i = 0; i < targetCities.length; i++) {
        const citySlug = targetCities[i];

        const result = await importOneCity(citySlug);

        nextResults.push(result);
        setResults([...nextResults]);

        if (i < targetCities.length - 1) {
          await wait(Math.max(0, Number(delayMs)));
        }
      }
    } catch (error) {
      setErrorText(
        error instanceof Error ? error.message : "Unexpected bulk import error."
      );
    } finally {
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
      </div>

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

