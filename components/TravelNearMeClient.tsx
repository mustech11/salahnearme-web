"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

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

type NearbyBusiness = {
  id: string;
  name: string | null;
  slug: string | null;
  category: string | null;
  city: string | null;
  address: string | null;
  postcode: string | null;
  website: string | null;
  maps_url: string | null;
  is_verified: boolean | null;
  featured: boolean | null;
  distance_miles: number;
};

const REQUEST_TIMEOUT_MS = 20_000;
const MIN_RADIUS = 1;
const MAX_RADIUS = 50;

function safeRadius(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, Math.trunc(parsed)))
    : 10;
}

function safeExternalUrl(value: string | null): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function miles(value: number) {
  return `${value.toFixed(1)} mi`;
}

function badge(label: string) {
  return (
    <div className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-400">
      {label}
    </div>
  );
}

export default function TravelNearMeClient() {
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastPositionRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [radius, setRadius] = useState("10");
  const [mosques, setMosques] = useState<NearbyMosque[]>([]);
  const [businesses, setBusinesses] = useState<NearbyBusiness[]>([]);
  const [searched, setSearched] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const normalisedRadius = useMemo(() => safeRadius(radius), [radius]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  function getCurrentPosition(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported on this device."));
        return;
      }

      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 300000,
      });
    });
  }

  const searchAtLocation = useCallback(
    async (latitude: number, longitude: number) => {
      abortControllerRef.current?.abort();

      const controller = new AbortController();
      abortControllerRef.current = controller;

      let timedOut = false;
      const timeoutId = window.setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, REQUEST_TIMEOUT_MS);

      try {
        setLoading(true);
        setErrorMessage("");
        setSearched(true);

        const common = new URLSearchParams({
          lat: String(latitude),
          lng: String(longitude),
          radius: String(normalisedRadius),
          limit: "30",
        });

        const [mosquesRes, businessesRes] = await Promise.all([
          fetch(`/api/nearby-mosques?${common.toString()}`, {
            headers: { Accept: "application/json" },
            credentials: "same-origin",
            cache: "no-store",
            signal: controller.signal,
          }),
          fetch(`/api/nearby-businesses?${common.toString()}`, {
            headers: { Accept: "application/json" },
            credentials: "same-origin",
            cache: "no-store",
            signal: controller.signal,
          }),
        ]);

        const mosquesData = await mosquesRes.json().catch(() => ({}));
        const businessesData = await businessesRes.json().catch(() => ({}));

        if (!mosquesRes.ok) {
          throw new Error(
            mosquesData.error ?? "Could not load nearby mosques."
          );
        }

        if (!businessesRes.ok) {
          throw new Error(
            businessesData.error ??
              "Could not load nearby halal businesses."
          );
        }

        const nextMosques = Array.isArray(mosquesData.mosques)
          ? mosquesData.mosques
          : [];
        const nextBusinesses = Array.isArray(businessesData.businesses)
          ? businessesData.businesses
          : [];

        setMosques(
          [...nextMosques].sort(
            (first, second) =>
              Number(first.distance_miles) - Number(second.distance_miles)
          )
        );
        setBusinesses(
          [...nextBusinesses].sort(
            (first, second) =>
              Number(first.distance_miles) - Number(second.distance_miles)
          )
        );
        setLastUpdatedAt(new Date());
      } catch (error) {
        setMosques([]);
        setBusinesses([]);
        setErrorMessage(
          error instanceof DOMException && error.name === "AbortError"
            ? timedOut
              ? "The nearby search timed out."
              : "The nearby search was cancelled."
            : error instanceof Error
              ? error.message
              : "Location search failed."
        );
      } finally {
        window.clearTimeout(timeoutId);

        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }

        setLoading(false);
      }
    },
    [normalisedRadius]
  );

  const detectNearby = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      const position = await getCurrentPosition();
      const coordinates = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };

      lastPositionRef.current = coordinates;
      await searchAtLocation(coordinates.latitude, coordinates.longitude);
    } catch (error) {
      setLoading(false);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Location access failed. Please try again."
      );
    }
  }, [searchAtLocation]);

  function refreshNearby() {
    const position = lastPositionRef.current;

    if (position) {
      void searchAtLocation(position.latitude, position.longitude);
      return;
    }

    void detectNearby();
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
        <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
          Near Me
        </div>

        <h2 className="mt-3 text-3xl font-bold text-white">Use my location</h2>

        <p className="mt-3 max-w-3xl text-white/70">
          Detect nearby mosques and halal businesses around your current location.
        </p>

        <div className="mt-6 flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-yellow-400">
              Radius (miles)
            </label>
            <input
              type="number"
              min={MIN_RADIUS}
              max={MAX_RADIUS}
              step="1"
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
              onBlur={() => setRadius(String(normalisedRadius))}
              className="w-32 rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none focus:border-yellow-400"
            />
          </div>

          <button
            type="button"
            onClick={detectNearby}
            disabled={loading}
            className="rounded-xl bg-yellow-500 px-5 py-3 text-sm font-semibold text-black hover:bg-yellow-400 disabled:opacity-50"
          >
            {loading ? "Finding nearby results..." : "Find near me"}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          {searched ? (
            <button
              type="button"
              onClick={refreshNearby}
              disabled={loading}
              className="rounded-xl border border-white/10 bg-black px-4 py-3 text-sm font-bold text-white/70 transition hover:border-yellow-500/30 hover:text-yellow-300 disabled:opacity-50"
            >
              Refresh results
            </button>
          ) : null}

          {lastUpdatedAt ? (
            <span className="self-center text-xs text-white/35">
              Updated {lastUpdatedAt.toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          ) : null}
        </div>

        {errorMessage && (
          <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {errorMessage}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="text-2xl font-semibold text-yellow-400">
          Nearby Mosques
        </div>

        {mosques.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-[rgb(var(--card))] p-6 text-white/60">
            No nearby mosques loaded yet.
          </div>
        ) : (
          mosques.map((mosque) => (
            <div
              key={mosque.id}
              className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6"
            >
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <Link
                    href={`/mosque/${mosque.slug}`}
                    className="text-2xl font-semibold text-white hover:text-yellow-400"
                  >
                    {mosque.name}
                  </Link>

                  <div className="mt-2 text-white/70">
                    {[mosque.area, mosque.city, mosque.postcode]
                      .filter(Boolean)
                      .join(" • ")}
                  </div>

                  {mosque.address ? (
                    <div className="mt-2 text-sm text-white/60">{mosque.address}</div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {mosque.womens_space ? badge("Women’s Space") : null}
                    {mosque.parking ? badge("Parking") : null}
                    {mosque.wheelchair_access ? badge("Wheelchair Access") : null}
                  </div>
                </div>

                <div className="flex flex-col items-start gap-3 lg:items-end">
                  <div className="rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-semibold text-green-300">
                    {miles(mosque.distance_miles)}
                  </div>

                  <Link
                    href={`/mosque/${mosque.slug}`}
                    className="rounded-xl bg-yellow-500 px-4 py-3 text-sm font-semibold text-black hover:bg-yellow-400"
                  >
                    View mosque
                  </Link>
                </div>
              </div>
            </div>
          ))
        )}
      </section>

      <section className="space-y-4">
        <div className="text-2xl font-semibold text-yellow-400">
          Nearby Halal Businesses
        </div>

        {businesses.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-[rgb(var(--card))] p-6 text-white/60">
            No nearby halal businesses loaded yet.
          </div>
        ) : (
          businesses.map((business) => (
            <div
              key={business.id}
              className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6"
            >
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  {business.slug ? (
                    <Link
                      href={`/business/${business.slug}`}
                      className="text-2xl font-semibold text-white hover:text-yellow-400"
                    >
                      {business.name}
                    </Link>
                  ) : (
                    <div className="text-2xl font-semibold text-white">
                      {business.name}
                    </div>
                  )}

                  <div className="mt-2 text-white/70">
                    {[business.category, business.city, business.postcode]
                      .filter(Boolean)
                      .join(" • ")}
                  </div>

                  {business.address ? (
                    <div className="mt-2 text-sm text-white/60">{business.address}</div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {business.featured ? badge("Featured") : null}
                    {business.is_verified ? badge("Verified") : null}
                  </div>
                </div>

                <div className="flex flex-col items-start gap-3 lg:items-end">
                  <div className="rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-semibold text-green-300">
                    {miles(business.distance_miles)}
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {business.slug ? (
                      <Link
                        href={`/business/${business.slug}`}
                        className="rounded-xl bg-yellow-500 px-4 py-3 text-sm font-semibold text-black hover:bg-yellow-400"
                      >
                        View business
                      </Link>
                    ) : null}

                    {safeExternalUrl(business.maps_url) ? (
                      <a
                        href={safeExternalUrl(business.maps_url) ?? undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-xl border border-yellow-500/30 bg-black px-4 py-3 text-sm font-semibold text-yellow-400 hover:bg-yellow-500/10"
                      >
                        Open map
                      </a>
                    ) : null}

                    {safeExternalUrl(business.website) ? (
                      <a
                        href={safeExternalUrl(business.website) ?? undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-xl border border-white/10 bg-black px-4 py-3 text-sm font-semibold text-white hover:border-yellow-500/30"
                      >
                        Website
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
