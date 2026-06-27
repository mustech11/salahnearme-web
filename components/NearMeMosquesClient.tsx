"use client";

import { useState } from "react";
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

export default function NearMeMosquesClient() {
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [radius, setRadius] = useState("10");
  const [mosques, setMosques] = useState<NearbyMosque[]>([]);

  function formatMiles(value: number) {
    return `${value.toFixed(1)} mi`;
  }

  async function detectAndSearch() {
    setLoading(true);
    setErrorText("");
    setMosques([]);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 60000,
        });
      });

      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      const res = await fetch(
        `/api/nearby-mosques?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}&radius=${encodeURIComponent(radius)}&limit=20`
      );

      const data = await res.json();

      if (!res.ok) {
        setErrorText(data.error ?? "Could not load nearby mosques.");
        return;
      }

      setMosques(data.mosques ?? []);
    } catch {
      setErrorText(
        "Could not access your location. Please allow location access and try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
        <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
          Near Me
        </div>

        <h1 className="mt-3 text-4xl font-bold text-white">
          Find mosques near your current location
        </h1>

        <p className="mt-3 max-w-3xl text-white/70">
          Discover the nearest mosques around you, sorted by distance.
        </p>

        <div className="mt-6 flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-yellow-400">
              Radius (miles)
            </label>
            <input
              type="number"
              min="1"
              max="50"
              step="1"
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
              className="w-32 rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none focus:border-yellow-400"
            />
          </div>

          <button
            onClick={detectAndSearch}
            disabled={loading}
            className="rounded-2xl bg-yellow-500 px-5 py-3 font-semibold text-black hover:bg-yellow-400 disabled:opacity-50"
          >
            {loading ? "Finding..." : "Use my location"}
          </button>
        </div>

        {errorText ? (
          <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {errorText}
          </div>
        ) : null}
      </section>

      <section className="grid gap-4">
        {mosques.map((mosque) => (
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
                  {[mosque.area, mosque.city, mosque.postcode].filter(Boolean).join(" • ")}
                </div>

                {mosque.address ? (
                  <div className="mt-2 text-sm text-white/60">{mosque.address}</div>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  {mosque.womens_space ? (
                    <div className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-400">
                      Women’s Space
                    </div>
                  ) : null}
                  {mosque.parking ? (
                    <div className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-400">
                      Parking
                    </div>
                  ) : null}
                  {mosque.wheelchair_access ? (
                    <div className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-400">
                      Wheelchair Access
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-col items-start gap-3 lg:items-end">
                <div className="rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-semibold text-green-300">
                  {formatMiles(mosque.distance_miles)}
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
        ))}
      </section>
    </div>
  );
}

