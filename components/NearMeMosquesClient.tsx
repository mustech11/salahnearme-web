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

type NearbyMosque = {
  id: string;
  name: string | null;
  slug: string | null;
  area: string | null;
  city: string | null;
  postcode: string | null;
  address: string | null;
  parking: boolean | null;
  womens_space: boolean | null;
  wheelchair_access: boolean | null;
  distance_miles: number;
};

type ApiResponse = {
  ok?: boolean;
  error?: string;
  mosques?: NearbyMosque[];
  count?: number;
};

const REQUEST_TIMEOUT_MS = 20_000;
const MAX_RADIUS_MILES = 50;
const MIN_RADIUS_MILES = 1;

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normaliseRadius(value: string): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) return 10;

  return Math.min(
    MAX_RADIUS_MILES,
    Math.max(MIN_RADIUS_MILES, Math.trunc(parsed))
  );
}

function formatMiles(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "Distance unavailable";
  return `${value.toFixed(value < 10 ? 1 : 0)} mi`;
}

function getGeolocationError(error: GeolocationPositionError): string {
  if (error.code === error.PERMISSION_DENIED) {
    return "Location permission was denied. Allow location access and try again.";
  }

  if (error.code === error.POSITION_UNAVAILABLE) {
    return "Your current location could not be detected.";
  }

  if (error.code === error.TIMEOUT) {
    return "Location detection timed out. Please try again.";
  }

  return "Could not access your location.";
}

export default function NearMeMosquesClient() {
  const headingId = useId();
  const statusId = useId();
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastPositionRef = useRef<{ lat: number; lng: number } | null>(null);

  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [radius, setRadius] = useState("10");
  const [mosques, setMosques] = useState<NearbyMosque[]>([]);
  const [searched, setSearched] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const safeRadius = useMemo(() => normaliseRadius(radius), [radius]);

  const searchAtPosition = useCallback(
    async (lat: number, lng: number) => {
      abortControllerRef.current?.abort();

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const timeoutId = window.setTimeout(
        () => controller.abort(),
        REQUEST_TIMEOUT_MS
      );

      setLoading(true);
      setErrorText("");
      setSearched(true);

      try {
        const params = new URLSearchParams({
          lat: String(lat),
          lng: String(lng),
          radius: String(safeRadius),
          limit: "30",
        });

        const response = await fetch(
          `/api/nearby-mosques?${params.toString()}`,
          {
            headers: { Accept: "application/json" },
            credentials: "same-origin",
            cache: "no-store",
            signal: controller.signal,
          }
        );

        const data = (await response.json().catch(() => ({}))) as ApiResponse;

        if (!response.ok || data.ok === false) {
          setMosques([]);
          setErrorText(cleanText(data.error) || "Could not load nearby mosques.");
          return;
        }

        const safeMosques = Array.isArray(data.mosques)
          ? data.mosques
              .filter((mosque) => cleanText(mosque.id))
              .sort(
                (first, second) =>
                  (Number(first.distance_miles) || 0) -
                  (Number(second.distance_miles) || 0)
              )
          : [];

        setMosques(safeMosques);
        setUpdatedAt(new Date());
      } catch (error) {
        setMosques([]);

        if (error instanceof DOMException && error.name === "AbortError") {
          setErrorText("The nearby mosque search timed out. Please try again.");
        } else {
          setErrorText("Could not load nearby mosques.");
        }
      } finally {
        window.clearTimeout(timeoutId);

        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }

        setLoading(false);
      }
    },
    [safeRadius]
  );

  const detectAndSearch = useCallback(() => {
    setErrorText("");

    if (!navigator.geolocation) {
      setErrorText("Your browser does not support location access.");
      return;
    }

    setLoading(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coordinates = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        lastPositionRef.current = coordinates;
        void searchAtPosition(coordinates.lat, coordinates.lng);
      },
      (error) => {
        setLoading(false);
        setErrorText(getGeolocationError(error));
      },
      {
        enableHighAccuracy: true,
        timeout: 12_000,
        maximumAge: 60_000,
      }
    );
  }, [searchAtPosition]);

  const refreshSearch = useCallback(() => {
    const coordinates = lastPositionRef.current;

    if (coordinates) {
      void searchAtPosition(coordinates.lat, coordinates.lng);
      return;
    }

    detectAndSearch();
  }, [detectAndSearch, searchAtPosition]);

  return (
    <div className="space-y-6">
      <section
        aria-labelledby={headingId}
        className="premium-panel rounded-[2rem] p-5 sm:p-7"
      >
        <div className="section-kicker">Near me</div>

        <h1
          id={headingId}
          className="mt-3 max-w-4xl text-3xl font-black tracking-tight text-white sm:text-5xl"
        >
          Find mosques near your current location
        </h1>

        <p className="mt-4 max-w-3xl text-sm leading-7 text-white/65 sm:text-base">
          Discover nearby mosques sorted by distance, with essential facility
          information for planning your visit.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-yellow-300">
              Radius in miles
            </span>

            <input
              type="number"
              min={MIN_RADIUS_MILES}
              max={MAX_RADIUS_MILES}
              step={1}
              value={radius}
              onChange={(event) => setRadius(event.target.value)}
              className="min-h-12 w-full rounded-xl border border-yellow-500/25 bg-black px-4 py-3 text-white outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/15 sm:w-36"
            />
          </label>

          <button
            type="button"
            onClick={detectAndSearch}
            disabled={loading}
            className="premium-button min-h-12 px-5 py-3 text-sm disabled:cursor-wait disabled:opacity-60"
          >
            {loading ? "Finding mosques…" : "Use my location"}
          </button>

          {searched ? (
            <button
              type="button"
              onClick={refreshSearch}
              disabled={loading}
              className="premium-button-outline min-h-12 px-5 py-3 text-sm disabled:cursor-wait disabled:opacity-60"
            >
              Refresh
            </button>
          ) : null}
        </div>

        <div id={statusId} aria-live="polite">
          {errorText ? (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-200"
            >
              {errorText}
            </div>
          ) : null}

          {updatedAt ? (
            <p className="mt-3 text-xs text-white/35">
              Updated{" "}
              {updatedAt.toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          ) : null}
        </div>
      </section>

      {loading ? <LoadingCards /> : null}

      {!loading && searched && mosques.length === 0 && !errorText ? (
        <section className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-6">
          <h2 className="text-lg font-black text-white">No mosques found</h2>
          <p className="mt-2 text-sm leading-6 text-yellow-100/75">
            Increase the search radius and try again.
          </p>
        </section>
      ) : null}

      {!loading && mosques.length > 0 ? (
        <section aria-label="Nearby mosques" className="grid gap-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-black text-white">
              {mosques.length.toLocaleString("en-GB")} nearby mosque
              {mosques.length === 1 ? "" : "s"}
            </h2>

            <span className="text-xs text-white/40">
              Within {safeRadius} miles
            </span>
          </div>

          {mosques.map((mosque) => (
            <MosqueResultCard key={mosque.id} mosque={mosque} />
          ))}
        </section>
      ) : null}

      {!searched && !loading ? (
        <section className="rounded-2xl border border-white/10 bg-black/20 p-6 text-sm leading-6 text-white/50">
          Use your location to find the nearest mosques.
        </section>
      ) : null}
    </div>
  );
}

function MosqueResultCard({ mosque }: { mosque: NearbyMosque }) {
  const slug = cleanText(mosque.slug);
  const href = slug ? `/mosque/${slug}` : null;
  const name = cleanText(mosque.name) || "Nearby mosque";
  const location = [mosque.area, mosque.city, mosque.postcode]
    .map(cleanText)
    .filter(Boolean)
    .join(" • ");

  return (
    <article className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-5 transition hover:border-yellow-400/35 sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          {href ? (
            <Link
              href={href}
              className="text-xl font-black text-white transition hover:text-yellow-300 sm:text-2xl"
            >
              {name}
            </Link>
          ) : (
            <h3 className="text-xl font-black text-white sm:text-2xl">{name}</h3>
          )}

          <p className="mt-2 text-sm text-white/60">
            {location || "Location details unavailable"}
          </p>

          {mosque.address ? (
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/45">
              {mosque.address}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            {mosque.womens_space ? <FacilityBadge>Women’s space</FacilityBadge> : null}
            {mosque.parking ? <FacilityBadge>Parking</FacilityBadge> : null}
            {mosque.wheelchair_access ? (
              <FacilityBadge>Wheelchair access</FacilityBadge>
            ) : null}

            {!mosque.womens_space &&
            !mosque.parking &&
            !mosque.wheelchair_access ? (
              <FacilityBadge muted>Facilities not confirmed</FacilityBadge>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-row items-center gap-3 lg:flex-col lg:items-end">
          <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-300">
            {formatMiles(Number(mosque.distance_miles))}
          </span>

          {href ? (
            <Link
              href={href}
              className="premium-button px-4 py-2.5 text-sm"
            >
              View mosque
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function FacilityBadge({
  children,
  muted = false,
}: {
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-bold ${
        muted
          ? "border-white/10 bg-white/5 text-white/45"
          : "border-yellow-500/25 bg-yellow-500/10 text-yellow-300"
      }`}
    >
      {children}
    </span>
  );
}

function LoadingCards() {
  return (
    <section aria-busy="true" aria-label="Loading nearby mosques" className="space-y-4">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="animate-pulse rounded-3xl border border-white/10 bg-black/20 p-6"
        >
          <div className="h-6 w-48 rounded bg-white/10" />
          <div className="mt-3 h-4 w-64 rounded bg-white/10" />
          <div className="mt-5 h-8 w-32 rounded bg-white/10" />
        </div>
      ))}
    </section>
  );
}