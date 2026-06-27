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
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [radius, setRadius] = useState("10");
  const [mosques, setMosques] = useState<NearbyMosque[]>([]);
  const [businesses, setBusinesses] = useState<NearbyBusiness[]>([]);

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

  async function detectNearby() {
    try {
      setLoading(true);
      setErrorMessage("");
      setMosques([]);
      setBusinesses([]);

      const position = await getCurrentPosition();
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;

      const [mosquesRes, businessesRes] = await Promise.all([
        fetch(
          `/api/nearby-mosques?lat=${encodeURIComponent(
            String(latitude)
          )}&lng=${encodeURIComponent(String(longitude))}&radius=${encodeURIComponent(
            radius
          )}&limit=20`
        ),
        fetch(
          `/api/nearby-businesses?lat=${encodeURIComponent(
            String(latitude)
          )}&lng=${encodeURIComponent(String(longitude))}&radius=${encodeURIComponent(
            radius
          )}&limit=20`
        ),
      ]);

      const mosquesData = await mosquesRes.json().catch(() => ({}));
      const businessesData = await businessesRes.json().catch(() => ({}));

      if (!mosquesRes.ok) {
        setErrorMessage(mosquesData.error ?? "Could not load nearby mosques.");
        return;
      }

      if (!businessesRes.ok) {
        setErrorMessage(
          businessesData.error ?? "Could not load nearby halal businesses."
        );
        return;
      }

      setMosques(mosquesData.mosques ?? []);
      setBusinesses(businessesData.businesses ?? []);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Location access failed. Please try again.";
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
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
              min="1"
              max="50"
              step="1"
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
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

                    {business.maps_url ? (
                      <a
                        href={business.maps_url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl border border-yellow-500/30 bg-black px-4 py-3 text-sm font-semibold text-yellow-400 hover:bg-yellow-500/10"
                      >
                        Open map
                      </a>
                    ) : null}

                    {business.website ? (
                      <a
                        href={business.website}
                        target="_blank"
                        rel="noreferrer"
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

