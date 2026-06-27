"use client";

import { useMemo, useState } from "react";

type CityRow = {
  id: number;
  name: string;
  slug: string;
  country: string | null;
  timezone: string | null;
  latitude: number | null;
  longitude: number | null;
  is_active: boolean | null;
};

type ResponseData = {
  totals: {
    cities: number;
    missingCoordinates: number;
    missingTimezone: number;
    possibleDuplicateGroups: number;
  };
  issues: {
    missingCoordinates: CityRow[];
    missingTimezone: CityRow[];
    possibleDuplicateCities: CityRow[][];
  };
};

function escapeSql(value: string | null | undefined) {
  return (value ?? "").replace(/'/g, "''");
}

function buildSqlTemplate(city: CityRow) {
  return `update cities
set
  latitude = 0,
  longitude = 0,
  timezone = '${escapeSql(city.timezone ?? "Europe/London")}'
where id = ${city.id};`;
}

export default function CityDataFixClient() {
  const [password, setPassword] = useState("");
  const [data, setData] = useState<ResponseData | null>(null);
  const [tab, setTab] = useState<
    "coordinates" | "timezone" | "duplicates" | "sql"
  >("coordinates");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const allProblemCities = useMemo(() => {
    if (!data) return [];

    const map = new Map<number, CityRow>();

    for (const city of data.issues.missingCoordinates) {
      map.set(city.id, city);
    }

    for (const city of data.issues.missingTimezone) {
      map.set(city.id, city);
    }

    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(
        `/api/admin/city-data-fix?password=${encodeURIComponent(password)}`
      );

      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? "Failed to load city data.");
        return;
      }

      setData(json);
    } catch {
      setError("Failed to load city data.");
    } finally {
      setLoading(false);
    }
  }

  function exportCsv() {
    if (!data) return;

    const rows = [
      [
        "id",
        "name",
        "slug",
        "country",
        "timezone",
        "latitude",
        "longitude",
        "missing_coordinates",
        "missing_timezone",
      ],
      ...allProblemCities.map((city) => [
        String(city.id),
        city.name,
        city.slug,
        city.country ?? "",
        city.timezone ?? "",
        city.latitude?.toString() ?? "",
        city.longitude?.toString() ?? "",
        city.latitude === null || city.longitude === null ? "yes" : "no",
        !city.timezone ? "yes" : "no",
      ]),
    ];

    const csv = rows
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `salahnearme-city-data-fix-${Date.now()}.csv`;
    link.click();

    URL.revokeObjectURL(url);
  }

  function copySql() {
    const sql = allProblemCities.map(buildSqlTemplate).join("\n\n");
    navigator.clipboard?.writeText(sql).catch(() => {});
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
        <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
          Admin
        </div>

        <h1 className="mt-3 text-4xl font-bold text-white">
          City Data Fix Dashboard
        </h1>

        <p className="mt-4 max-w-3xl text-white/70">
          Find cities missing coordinates, missing timezones, and possible
          duplicate city records before launch. This page is read-only and gives
          you export helpers.
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
          placeholder="Enter ADMIN_AI_PASSWORD"
          className="mt-2 w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none focus:border-yellow-400"
        />

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={loadData}
            disabled={loading || !password}
            className="rounded-2xl bg-yellow-500 px-6 py-4 font-semibold text-black hover:bg-yellow-400 disabled:opacity-50"
          >
            {loading ? "Loading..." : "Load city issues"}
          </button>

          <button
            type="button"
            onClick={exportCsv}
            disabled={!data}
            className="rounded-2xl border border-white/10 bg-black px-6 py-4 font-semibold text-white/70 hover:border-yellow-500/30 hover:text-yellow-400 disabled:opacity-50"
          >
            Export CSV
          </button>

          <button
            type="button"
            onClick={copySql}
            disabled={!data}
            className="rounded-2xl border border-yellow-500/30 bg-black px-6 py-4 font-semibold text-yellow-400 hover:bg-yellow-500/10 disabled:opacity-50"
          >
            Copy SQL template
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
            <Metric
              title="Missing Coordinates"
              value={data.totals.missingCoordinates}
            />
            <Metric
              title="Missing Timezone"
              value={data.totals.missingTimezone}
            />
            <Metric
              title="Duplicate Groups"
              value={data.totals.possibleDuplicateGroups}
            />
          </section>

          <section className="flex flex-wrap gap-3">
            {[
              ["coordinates", "Missing coordinates"],
              ["timezone", "Missing timezone"],
              ["duplicates", "Duplicate cities"],
              ["sql", "SQL helper"],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key as typeof tab)}
                className={
                  tab === key
                    ? "rounded-xl bg-yellow-500 px-4 py-2 text-sm font-semibold text-black"
                    : "rounded-xl border border-yellow-500/30 bg-black px-4 py-2 text-sm font-semibold text-yellow-400 hover:bg-yellow-500/10"
                }
              >
                {label}
              </button>
            ))}
          </section>

          {tab === "coordinates" && (
            <CityList
              title="Cities missing coordinates"
              cities={data.issues.missingCoordinates}
              empty="No cities missing coordinates."
            />
          )}

          {tab === "timezone" && (
            <CityList
              title="Cities missing timezone"
              cities={data.issues.missingTimezone}
              empty="No cities missing timezone."
            />
          )}

          {tab === "duplicates" && (
            <section className="grid gap-4">
              {data.issues.possibleDuplicateCities.length === 0 ? (
                <Empty text="No possible duplicate city groups found." />
              ) : (
                data.issues.possibleDuplicateCities.map((group, index) => (
                  <div
                    key={index}
                    className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6"
                  >
                    <div className="text-lg font-bold text-yellow-400">
                      Duplicate group {index + 1}
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {group.map((city) => (
                        <CityMiniCard key={city.id} city={city} />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </section>
          )}

          {tab === "sql" && (
            <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6">
              <div className="text-xl font-bold text-yellow-400">
                SQL update template
              </div>

              <p className="mt-2 text-sm text-white/60">
                Replace <span className="text-yellow-400">0</span> latitude and
                longitude values manually before running in Supabase.
              </p>

              <pre className="mt-5 max-h-[520px] overflow-auto rounded-2xl border border-white/10 bg-black/40 p-4 text-xs leading-relaxed text-white/70">
                {allProblemCities.map(buildSqlTemplate).join("\n\n") ||
                  "No SQL needed."}
              </pre>
            </section>
          )}
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

function CityList({
  title,
  cities,
  empty,
}: {
  title: string;
  cities: CityRow[];
  empty: string;
}) {
  return (
    <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6">
      <div className="text-xl font-bold text-yellow-400">{title}</div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {cities.length === 0 ? (
          <Empty text={empty} />
        ) : (
          cities.map((city) => <CityMiniCard key={city.id} city={city} />)
        )}
      </div>
    </section>
  );
}

function CityMiniCard({ city }: { city: CityRow }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <div className="text-lg font-bold text-white">{city.name}</div>

      <div className="mt-1 text-sm text-white/50">
        {city.slug} {city.country ? `· ${city.country}` : ""}
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <Badge ok={typeof city.latitude === "number" && typeof city.longitude === "number"}>
          Coordinates:{" "}
          {typeof city.latitude === "number" && typeof city.longitude === "number"
            ? `${city.latitude}, ${city.longitude}`
            : "missing"}
        </Badge>

        <Badge ok={!!city.timezone}>
          Timezone: {city.timezone ?? "missing"}
        </Badge>
      </div>
    </div>
  );
}

function Badge({ children, ok }: { children: React.ReactNode; ok: boolean }) {
  return (
    <span
      className={
        ok
          ? "rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-green-300"
          : "rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-red-200"
      }
    >
      {children}
    </span>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-5 text-white/60">
      {text}
    </div>
  );
}

