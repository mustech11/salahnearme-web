"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

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

type SortMode = "default" | "near" | "name" | "verified";
type Confidence = "none" | "low" | "medium" | "strong";
type LiveStatus = "none" | "started" | "delayed" | "full" | "parking_full";

type LiveItem = {
  status: LiveStatus;
  total: number;
  confidence: Confidence;
};

type LiveResponse = {
  ok?: boolean;
  error?: string;
  map?: Record<string, unknown>;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const LIVE_REFRESH_MS = 60_000;
const REQUEST_TIMEOUT_MS = 12_000;

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getCurrentPrayer(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  const total = hour * 60 + minute;

  if (total < 720) return "fajr";
  if (total < 900) return "dhuhr";
  if (total < 1080) return "asr";
  if (total < 1260) return "maghrib";
  return "isha";
}

function haversineMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const radius = 3959;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const value =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  return 2 * radius * Math.asin(Math.sqrt(value));
}

function normaliseLiveItem(value: unknown): LiveItem {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { status: "none", total: 0, confidence: "none" };
  }

  const item = value as Partial<LiveItem>;
  const statuses: LiveStatus[] = [
    "none",
    "started",
    "delayed",
    "full",
    "parking_full",
  ];
  const confidences: Confidence[] = ["none", "low", "medium", "strong"];

  const total =
    typeof item.total === "number" && Number.isFinite(item.total)
      ? Math.max(0, Math.trunc(item.total))
      : 0;

  return {
    status: statuses.includes(item.status as LiveStatus)
      ? (item.status as LiveStatus)
      : "none",
    total,
    confidence: confidences.includes(item.confidence as Confidence)
      ? (item.confidence as Confidence)
      : total >= 5
        ? "strong"
        : total >= 3
          ? "medium"
          : total >= 1
            ? "low"
            : "none",
  };
}

function verificationLabel(value: string | null | undefined): string | null {
  const cleaned = cleanText(value);
  if (!cleaned) return null;

  return cleaned
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isVerified(value: string | null | undefined): boolean {
  const status = cleanText(value).toLowerCase();
  return status === "verified" || status === "approved" || status === "active";
}

export default function CityMosquesClient({
  cityName,
  initialMosques,
}: Props) {
  const searchId = useId();
  const statusId = useId();
  const liveAbortRef = useRef<AbortController | null>(null);

  const [search, setSearch] = useState("");
  const [userLoc, setUserLoc] = useState<{ lat: number; lon: number } | null>(
    null
  );
  const [locError, setLocError] = useState("");
  const [locationLoading, setLocationLoading] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("default");
  const [liveMap, setLiveMap] = useState<Record<string, LiveItem>>({});
  const [liveError, setLiveError] = useState("");
  const [liveUpdatedAt, setLiveUpdatedAt] = useState<Date | null>(null);

  const mosques = useMemo(
    () =>
      (initialMosques ?? []).filter(
        (mosque) => UUID_REGEX.test(cleanText(mosque.id))
      ),
    [initialMosques]
  );

  const loadLive = useCallback(async () => {
    if (mosques.length === 0) return;

    liveAbortRef.current?.abort();
    const controller = new AbortController();
    liveAbortRef.current = controller;

    const timeoutId = window.setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS
    );

    try {
      const params = new URLSearchParams({
        mosque_ids: mosques.map((mosque) => mosque.id).join(","),
        prayer: getCurrentPrayer(),
      });

      const response = await fetch(`/api/iqamah/live?${params.toString()}`, {
        headers: { Accept: "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
      });

      const data = (await response.json().catch(() => ({}))) as LiveResponse;

      if (!response.ok || data.ok === false) {
        setLiveError(cleanText(data.error) || "Live signals are unavailable.");
        return;
      }

      const nextMap: Record<string, LiveItem> = {};

      for (const mosque of mosques) {
        nextMap[mosque.id] = normaliseLiveItem(data.map?.[mosque.id]);
      }

      setLiveMap(nextMap);
      setLiveUpdatedAt(new Date());
      setLiveError("");
    } catch (error) {
      if (
        !(error instanceof DOMException && error.name === "AbortError")
      ) {
        setLiveError("Live signals are temporarily unavailable.");
      }
    } finally {
      window.clearTimeout(timeoutId);

      if (liveAbortRef.current === controller) {
        liveAbortRef.current = null;
      }
    }
  }, [mosques]);

  useEffect(() => {
    void loadLive();

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadLive();
      }
    }, LIVE_REFRESH_MS);

    return () => {
      window.clearInterval(intervalId);
      liveAbortRef.current?.abort();
    };
  }, [loadLive]);

  const useMyLocation = useCallback(() => {
    setLocError("");

    if (!navigator.geolocation) {
      setLocError("Your browser does not support location access.");
      return;
    }

    setLocationLoading(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLoc({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
        setSortMode("near");
        setLocationLoading(false);
      },
      (error) => {
        setLocationLoading(false);
        setLocError(
          error.code === error.PERMISSION_DENIED
            ? "Location permission was denied."
            : error.code === error.TIMEOUT
              ? "Location detection timed out."
              : "Your location could not be detected."
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 12_000,
        maximumAge: 60_000,
      }
    );
  }, []);

  const results = useMemo(() => {
    const term = search.trim().toLowerCase();

    const filtered = mosques.filter((mosque) => {
      if (!term) return true;

      return [
        mosque.name,
        mosque.postcode,
        mosque.area,
        mosque.address,
      ].some((value) => cleanText(value).toLowerCase().includes(term));
    });

    return [...filtered].sort((first, second) => {
      if (sortMode === "name") {
        return cleanText(first.name).localeCompare(cleanText(second.name));
      }

      if (sortMode === "verified") {
        return Number(isVerified(second.verified_status)) -
          Number(isVerified(first.verified_status));
      }

      if (sortMode === "near" && userLoc) {
        const firstHasCoords =
          typeof first.latitude === "number" &&
          typeof first.longitude === "number";
        const secondHasCoords =
          typeof second.latitude === "number" &&
          typeof second.longitude === "number";

        if (!firstHasCoords && secondHasCoords) return 1;
        if (firstHasCoords && !secondHasCoords) return -1;
        if (!firstHasCoords || !secondHasCoords) return 0;

        return (
          haversineMiles(
            userLoc.lat,
            userLoc.lon,
            first.latitude as number,
            first.longitude as number
          ) -
          haversineMiles(
            userLoc.lat,
            userLoc.lon,
            second.latitude as number,
            second.longitude as number
          )
        );
      }

      return 0;
    });
  }, [mosques, search, sortMode, userLoc]);

  const liveCount = useMemo(
    () =>
      Object.values(liveMap).filter(
        (item) => item.status !== "none" || item.confidence !== "none"
      ).length,
    [liveMap]
  );

  return (
    <div className="space-y-6">
      <section className="premium-panel overflow-hidden rounded-[2rem] p-5 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="section-kicker">City mosques</div>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">
              Mosques in {cleanText(cityName) || "this city"}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/60">
              Search local mosques, view current community signals and sort
              nearby listings using your location.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <SummaryBadge label={`${results.length} shown`} />
            <SummaryBadge label={`${liveCount} live`} tone="live" />
          </div>
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_auto]">
          <label htmlFor={searchId} className="sr-only">
            Search mosques
          </label>
          <input
            id={searchId}
            type="search"
            placeholder="Search by name, postcode, area or address"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="min-h-12 w-full rounded-xl border border-yellow-500/25 bg-black px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/15"
          />

          <select
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as SortMode)}
            className="min-h-12 rounded-xl border border-white/10 bg-black px-4 py-3 text-sm font-semibold text-white outline-none focus:border-yellow-400"
          >
            <option value="default">Recommended</option>
            <option value="near">Nearest first</option>
            <option value="name">Name A–Z</option>
            <option value="verified">Verified first</option>
          </select>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={useMyLocation}
              disabled={locationLoading}
              className="premium-button min-h-12 flex-1 px-4 py-3 text-sm disabled:cursor-wait disabled:opacity-60"
            >
              {locationLoading ? "Locating…" : "Near me"}
            </button>

            <button
              type="button"
              onClick={() => {
                setSortMode("default");
                setUserLoc(null);
                setLocError("");
                setSearch("");
              }}
              className="premium-button-outline min-h-12 px-4 py-3 text-sm"
            >
              Reset
            </button>
          </div>
        </div>

        <div id={statusId} aria-live="polite">
          {locError ? (
            <Feedback tone="error">{locError}</Feedback>
          ) : null}

          {liveError ? (
            <Feedback tone="warning">{liveError}</Feedback>
          ) : null}

          {liveUpdatedAt ? (
            <p className="mt-3 text-xs text-white/35">
              Live signals refreshed{" "}
              {liveUpdatedAt.toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          ) : null}
        </div>
      </section>

      {results.length > 0 ? (
        <section
          aria-label={`Mosques in ${cityName}`}
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
        >
          {results.map((mosque) => {
            const hasCoordinates =
              userLoc &&
              typeof mosque.latitude === "number" &&
              typeof mosque.longitude === "number";

            const distance =
              hasCoordinates && userLoc
                ? haversineMiles(
                    userLoc.lat,
                    userLoc.lon,
                    mosque.latitude as number,
                    mosque.longitude as number
                  )
                : null;

            return (
              <MosqueCard
                key={mosque.id}
                mosque={mosque}
                live={liveMap[mosque.id] ?? null}
                distance={distance}
              />
            );
          })}
        </section>
      ) : (
        <section className="rounded-2xl border border-white/10 bg-[rgb(var(--card))] p-6 text-sm text-white/60">
          No mosques match your current search and filters.
        </section>
      )}
    </div>
  );
}

function MosqueCard({
  mosque,
  live,
  distance,
}: {
  mosque: Mosque;
  live: LiveItem | null;
  distance: number | null;
}) {
  const name = cleanText(mosque.name) || "Mosque";
  const slug = cleanText(mosque.slug);
  const href = slug ? `/mosque/${slug}` : null;
  const status = verificationLabel(mosque.verified_status);

  return (
    <article className="group rounded-2xl border border-yellow-500/20 bg-[rgb(var(--card))] p-5 transition hover:-translate-y-0.5 hover:border-yellow-400/40">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {href ? (
            <Link
              href={href}
              className="block truncate text-lg font-black text-white transition group-hover:text-yellow-300"
            >
              {name}
            </Link>
          ) : (
            <h2 className="truncate text-lg font-black text-white">{name}</h2>
          )}

          <p className="mt-1 text-sm text-white/55">
            {[mosque.area, mosque.postcode].map(cleanText).filter(Boolean).join(" • ") ||
              "Location details pending"}
          </p>
        </div>

        {distance !== null ? (
          <span className="shrink-0 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-300">
            {distance.toFixed(1)} mi
          </span>
        ) : null}
      </div>

      {mosque.address ? (
        <p className="mt-3 line-clamp-2 text-xs leading-5 text-white/45">
          {mosque.address}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {status ? <Pill>{status}</Pill> : null}
        <LiveBadge item={live} />
      </div>

      {href ? (
        <Link
          href={href}
          className="mt-5 inline-flex text-sm font-bold text-yellow-300 transition hover:text-yellow-100"
        >
          View mosque →
        </Link>
      ) : null}
    </article>
  );
}

function LiveBadge({ item }: { item: LiveItem | null }) {
  if (!item || (item.status === "none" && item.confidence === "none")) {
    return <Pill muted>No recent reports</Pill>;
  }

  const label =
    item.status === "started"
      ? "Iqamah started"
      : item.status === "delayed"
        ? "Delayed"
        : item.status === "full"
          ? "Hall full"
          : item.status === "parking_full"
            ? "Parking full"
            : `${item.confidence} signal`;

  const tone =
    item.status === "started"
      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
      : item.status === "delayed"
        ? "border-amber-500/25 bg-amber-500/10 text-amber-300"
        : item.status === "full"
          ? "border-red-500/25 bg-red-500/10 text-red-300"
          : item.status === "parking_full"
            ? "border-sky-500/25 bg-sky-500/10 text-sky-300"
            : "border-yellow-500/25 bg-yellow-500/10 text-yellow-300";

  return (
    <span className={`rounded-full border px-3 py-1 text-[11px] font-bold ${tone}`}>
      {label}
      {item.total > 0 ? ` • ${item.total}` : ""}
    </span>
  );
}

function Pill({
  children,
  muted = false,
}: {
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <span
      className={`rounded-full border px-3 py-1 text-[11px] font-bold ${
        muted
          ? "border-white/10 bg-white/5 text-white/45"
          : "border-yellow-500/25 bg-yellow-500/10 text-yellow-300"
      }`}
    >
      {children}
    </span>
  );
}

function SummaryBadge({
  label,
  tone = "default",
}: {
  label: string;
  tone?: "default" | "live";
}) {
  return (
    <span
      className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
        tone === "live"
          ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
          : "border-white/10 bg-white/5 text-white/60"
      }`}
    >
      {label}
    </span>
  );
}

function Feedback({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "error" | "warning";
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`mt-4 rounded-xl border p-4 text-sm ${
        tone === "error"
          ? "border-red-500/25 bg-red-500/10 text-red-200"
          : "border-amber-500/25 bg-amber-500/10 text-amber-100"
      }`}
    >
      {children}
    </div>
  );
}