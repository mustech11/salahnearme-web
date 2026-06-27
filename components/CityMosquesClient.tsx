"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Mosque = {
  id: string;
  name: string | null;
  slug: string | null;
  postcode: string | null;
  area: string | null;
  address?: string | null;
  verified_status?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

type Props = {
  cityName: string;
  initialMosques: Mosque[];
};

function getCurrentPrayer() {
  const now = new Date(
    new Date().toLocaleString("en-GB", { timeZone: "Europe/London" })
  );

  const total = now.getHours() * 60 + now.getMinutes();

  if (total >= 300 && total < 720) return "fajr";
  if (total >= 720 && total < 900) return "dhuhr";
  if (total >= 900 && total < 1080) return "asr";
  if (total >= 1080 && total < 1260) return "maghrib";
  return "isha";
}

function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 3959;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(a));
}

export default function CityMosquesClient({
  cityName,
  initialMosques,
}: Props) {
  const [search, setSearch] = useState("");
  const [userLoc, setUserLoc] = useState<{ lat: number; lon: number } | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<"default" | "near">("default");

  const [liveMap, setLiveMap] = useState<
    Record<
      string,
      {
        status: string;
        total: number;
        confidence?: "none" | "low" | "medium" | "strong";
      }
    >
  >({});

  useEffect(() => {
    const ids = (initialMosques ?? []).map((m) => m.id).filter(Boolean);
    if (!ids.length) return;

    const qs = ids.join(",");

    async function loadLive() {
      const prayer = getCurrentPrayer();

      try {
        const r = await fetch(
          `/api/iqamah/live?mosque_ids=${encodeURIComponent(qs)}&prayer=${prayer}`
        );
        const d = await r.json();
        setLiveMap(d?.map ?? {});
      } catch {
        setLiveMap({});
      }
    }

    loadLive();
    const interval = setInterval(loadLive, 60000);

    return () => clearInterval(interval);
  }, [initialMosques]);

  function LiveBadge({ mosqueId }: { mosqueId: string }) {
    const item = liveMap[mosqueId];
    const s = item?.status ?? "none";
    const total = item?.total ?? 0;
    const conf =
      item?.confidence ??
      (total >= 5 ? "strong" : total >= 3 ? "medium" : total >= 1 ? "low" : "none");

    if (s === "started") {
  return (
    <span className="rounded-full bg-green-500 px-2 py-1 text-[10px] font-semibold text-black">
      🟢 Iqamah started
    </span>
  );
}

if (conf === "strong") {
  return (
    <span className="rounded-full border border-green-500/30 bg-green-500/20 px-2 py-1 text-[10px] font-semibold text-green-300">
      Live • {total}
    </span>
  );
}

    if (s === "delayed") {
      return (
        <span className="rounded-full bg-amber-300 px-2 py-1 text-[10px] font-semibold text-neutral-950">
          🟡 Delayed
        </span>
      );
    }

    if (s === "full") {
      return (
        <span className="rounded-full bg-fuchsia-300 px-2 py-1 text-[10px] font-semibold text-neutral-950">
          🟣 Hall full
        </span>
      );
    }

    if (s === "parking_full") {
      return (
        <span className="rounded-full bg-sky-300 px-2 py-1 text-[10px] font-semibold text-neutral-950">
          🔵 Parking full
        </span>
      );
    }

    if (conf === "medium") {
      return (
        <span className="rounded-full border border-amber-300/30 bg-amber-300/20 px-2 py-1 text-[10px] font-semibold text-amber-200">
          Medium signal • {total}
        </span>
      );
    }

    if (conf === "low") {
      return (
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-white/70">
          Low signal • {total} report{total === 1 ? "" : "s"}
        </span>
      );
    }

    return (
      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-white/60">
        No recent reports
      </span>
    );
  }

  async function useMyLocation() {
    setLocError(null);

    if (!navigator.geolocation) {
      setLocError("Your browser does not support location.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLoc({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setSortMode("near");
      },
      (err) => {
        setLocError(
          err.code === 1 ? "Location permission denied." : "Could not get your location."
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();

    const base = (initialMosques ?? []).filter((m) => {
      if (!term) return true;

      return (
        m.name?.toLowerCase().includes(term) ||
        m.postcode?.toLowerCase().includes(term) ||
        m.area?.toLowerCase().includes(term) ||
        m.address?.toLowerCase().includes(term)
      );
    });

    if (sortMode !== "near" || !userLoc) return base;

    return [...base].sort((a, b) => {
      const aOk = typeof a.latitude === "number" && typeof a.longitude === "number";
      const bOk = typeof b.latitude === "number" && typeof b.longitude === "number";

      if (!aOk && bOk) return 1;
      if (aOk && !bOk) return -1;
      if (!aOk && !bOk) return 0;

      const da = haversineMiles(userLoc.lat, userLoc.lon, a.latitude!, a.longitude!);
      const db = haversineMiles(userLoc.lat, userLoc.lon, b.latitude!, b.longitude!);

      return da - db;
    });
  }, [initialMosques, search, sortMode, userLoc]);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
        <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
          City Mosques
        </div>

        <h1 className="mt-3 text-3xl font-bold text-white">
          Mosques in {cityName}
        </h1>

        <p className="mt-2 text-white/70">
          Browse local mosques in {cityName}, see live signals, and sort by what is near you.
        </p>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <input
            type="text"
            placeholder="Search by name, postcode, area or address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="md:col-span-2 w-full rounded-xl border border-yellow-500/30 bg-black px-4 py-3 text-sm text-white outline-none focus:border-yellow-400"
          />

          <div className="flex gap-2">
            <button
              onClick={useMyLocation}
              className="flex-1 rounded-xl bg-yellow-500 px-4 py-3 text-sm font-semibold text-black hover:bg-yellow-400"
            >
              📍 Near me
            </button>

            <button
              onClick={() => {
                setSortMode("default");
                setUserLoc(null);
                setLocError(null);
              }}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10"
              title="Reset sorting"
            >
              Reset
            </button>
          </div>
        </div>

        {locError && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {locError}
          </div>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((m) => {
          let distMi: number | null = null;
          const hasCoords =
            userLoc && typeof m.latitude === "number" && typeof m.longitude === "number";

          if (hasCoords) {
            distMi = haversineMiles(
              userLoc!.lat,
              userLoc!.lon,
              m.latitude!,
              m.longitude!
            );
          }

          return (
            <Link
              key={m.id}
              href={m.slug ? `/mosque/${m.slug}` : "#"}
              className="rounded-2xl border border-yellow-500/20 bg-[rgb(var(--card))] p-5 transition hover:border-yellow-400/40 hover:bg-yellow-500/[0.03]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-white">{m.name}</div>

                  <div className="mt-1 text-sm text-white/60">
                    {[m.area, m.postcode].filter(Boolean).join(" • ")}
                    {distMi !== null && (
                      <span className="ml-2 text-xs text-white/50">
                        • {distMi.toFixed(1)} mi
                      </span>
                    )}
                  </div>

                  {m.address && (
                    <div className="mt-2 text-xs text-white/50">{m.address}</div>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2">
                  {m.verified_status && (
                    <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2 py-1 text-[10px] font-semibold text-yellow-400 whitespace-nowrap">
                      {m.verified_status}
                    </span>
                  )}

                  <LiveBadge mosqueId={m.id} />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {!filtered.length && (
        <div className="rounded-2xl border border-white/10 bg-[rgb(var(--card))] p-6 text-sm text-white/60">
          No mosques match your search.
        </div>
      )}
    </div>
  );
}

