"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type CityReadiness = {
  id: number;
  name: string;
  slug: string;
  country: string | null;
  timezone: string | null;
  hasCoordinates: boolean;
  hasPrayerTimes: boolean;
  mosqueCount: number;
  businessCount: number;
  status: "ready" | "needs-data" | "do-not-launch";
  missing: string[];
};

type ResponseData = {
  month: number;
  year: number;
  totals: {
    cities: number;
    ready: number;
    needsData: number;
    doNotLaunch: number;
  };
  cities: CityReadiness[];
};

function statusClass(status: CityReadiness["status"]) {
  if (status === "ready") return "border-green-500/30 bg-green-500/10 text-green-300";
  if (status === "needs-data") return "border-yellow-500/30 bg-yellow-500/10 text-yellow-400";
  return "border-red-500/30 bg-red-500/10 text-red-200";
}

function statusLabel(status: CityReadiness["status"]) {
  if (status === "ready") return "Ready";
  if (status === "needs-data") return "Needs data";
  return "Do not launch";
}

export default function CityLaunchReadinessClient() {
  const [password, setPassword] = useState("");
  const [data, setData] = useState<ResponseData | null>(null);
  const [filter, setFilter] = useState<"all" | CityReadiness["status"]>("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const filteredCities = useMemo(() => {
    if (!data) return [];
    if (filter === "all") return data.cities;
    return data.cities.filter((city) => city.status === filter);
  }, [data, filter]);

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(
        `/api/admin/city-launch-readiness?password=${encodeURIComponent(password)}`
      );

      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? "Failed to load city readiness.");
        return;
      }

      setData(json);
    } catch {
      setError("Failed to load city readiness.");
    } finally {
      setLoading(false);
    }
  }

  function exportCsv() {
    if (!data) return;

    const rows = [
      [
        "City",
        "Slug",
        "Country",
        "Status",
        "Has Coordinates",
        "Has Prayer Times",
        "Mosques",
        "Businesses",
        "Missing",
      ],
      ...filteredCities.map((city) => [
        city.name,
        city.slug,
        city.country ?? "",
        statusLabel(city.status),
        city.hasCoordinates ? "yes" : "no",
        city.hasPrayerTimes ? "yes" : "no",
        String(city.mosqueCount),
        String(city.businessCount),
        city.missing.join("; "),
      ]),
    ];

    const csv = rows
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `city-launch-readiness-${Date.now()}.csv`;
    link.click();

    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
        <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
          Admin
        </div>

        <h1 className="mt-3 text-4xl font-bold text-white">
          City Launch Readiness
        </h1>

        <p className="mt-4 max-w-3xl text-white/70">
          Check which cities are ready to launch based on coordinates, prayer
          times, mosque count, and halal business count.
        </p>
      </section>

      <section className="rounded-3xl border border-yellow-500/20 bg-black/30 p-6">
        <label className="block text-sm font-semibold text-yellow-400">
          Admin password
        </label>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-2 w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none focus:border-yellow-400"
          placeholder="Enter ADMIN_AI_PASSWORD"
        />

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={loadData}
            disabled={loading || !password}
            className="rounded-2xl bg-yellow-500 px-6 py-4 font-semibold text-black hover:bg-yellow-400 disabled:opacity-50"
          >
            {loading ? "Loading..." : "Load readiness"}
          </button>

          <button
            type="button"
            onClick={exportCsv}
            disabled={!data}
            className="rounded-2xl border border-white/10 bg-black px-6 py-4 font-semibold text-white/70 hover:border-yellow-500/30 hover:text-yellow-400 disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>
      </section>

      {error && (
        <section className="rounded-3xl border border-red-500/20 bg-red-500/10 p-6 text-red-200">
          {error}
        </section>
      )}

      {data && (
        <>
          <section className="grid gap-4 md:grid-cols-4">
            <Metric title="Cities" value={data.totals.cities} />
            <Metric title="Ready" value={data.totals.ready} />
            <Metric title="Needs Data" value={data.totals.needsData} />
            <Metric title="Do Not Launch" value={data.totals.doNotLaunch} />
          </section>

          <section className="flex flex-wrap gap-3">
            {(["all", "ready", "needs-data", "do-not-launch"] as const).map(
              (item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setFilter(item)}
                  className={
                    filter === item
                      ? "rounded-xl bg-yellow-500 px-4 py-2 text-sm font-semibold text-black"
                      : "rounded-xl border border-yellow-500/30 bg-black px-4 py-2 text-sm font-semibold text-yellow-400 hover:bg-yellow-500/10"
                  }
                >
                  {item}
                </button>
              )
            )}
          </section>

          <section className="grid gap-4">
            {filteredCities.map((city) => (
              <div
                key={city.id}
                className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(
                          city.status
                        )}`}
                      >
                        {statusLabel(city.status)}
                      </span>

                      {city.country && (
                        <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/60">
                          {city.country}
                        </span>
                      )}

                      {city.timezone && (
                        <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/60">
                          {city.timezone}
                        </span>
                      )}
                    </div>

                    <h2 className="mt-4 text-2xl font-bold text-white">
                      {city.name}
                    </h2>

                    <div className="mt-3 flex flex-wrap gap-3 text-sm">
                      <Check label="Coordinates" ok={city.hasCoordinates} />
                      <Check label="Prayer times" ok={city.hasPrayerTimes} />
                      <Check label={`${city.mosqueCount} mosques`} ok={city.mosqueCount >= 3} />
                      <Check label={`${city.businessCount} businesses`} ok={city.businessCount >= 3} />
                    </div>

                    {city.missing.length > 0 && (
                      <p className="mt-3 text-sm text-white/60">
                        Missing: {city.missing.join(", ")}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/${city.slug}`}
                      className="rounded-xl border border-yellow-500/30 bg-black px-4 py-3 text-sm font-semibold text-yellow-400 hover:bg-yellow-500/10"
                    >
                      View city
                    </Link>

                    <Link
                      href={`/${city.slug}/prayer-times`}
                      className="rounded-xl bg-yellow-500 px-4 py-3 text-sm font-semibold text-black hover:bg-yellow-400"
                    >
                      Prayer page
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}

function Metric({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-3xl border border-yellow-500/20 bg-black/30 p-6">
      <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
        {title}
      </div>
      <div className="mt-3 text-4xl font-bold text-white">{value}</div>
    </div>
  );
}

function Check({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span
      className={
        ok
          ? "rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-green-300"
          : "rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-red-200"
      }
    >
      {ok ? "✓" : "!"} {label}
    </span>
  );
}

