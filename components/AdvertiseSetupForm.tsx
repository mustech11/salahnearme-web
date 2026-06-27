"use client";

import { useMemo, useState } from "react";

type City = {
  id: number;
  name: string;
  slug: string;
};

type Mosque = {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  area: string | null;
};

type AdvertisingType =
  | "city_featured"
  | "mosque_sponsor"
  | "multi_mosque"
  | "multi_city";

type Props = {
  advertisingType: AdvertisingType;
  cities: City[];
  mosques: Mosque[];
};

export default function AdvertiseSetupForm({
  advertisingType,
  cities,
  mosques,
}: Props) {
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedMosque, setSelectedMosque] = useState("");
  const [selectedMosques, setSelectedMosques] = useState<string[]>([]);
  const [selectedCities, setSelectedCities] = useState<number[]>([]);
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const cityName = useMemo(() => {
    return cities.find((c) => String(c.id) === selectedCity)?.name ?? "";
  }, [cities, selectedCity]);

  const filteredMosques = useMemo(() => {
    if (!cityName) return mosques;
    return mosques.filter((m) => m.city === cityName);
  }, [mosques, cityName]);

  function toggleCity(id: number) {
    setSelectedCities((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    );
  }

  function toggleMosque(id: string) {
    setSelectedMosques((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    );
  }

  async function handleSave(e: React.FormEvent) {
  e.preventDefault();

  setLoading(true);
  setErrorMessage("");
  setSuccessMessage("");

  try {
    // 1. Save campaign
    const res = await fetch("/api/advertise/setup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        advertising_type: advertisingType,
        selected_city_id: selectedCity ? Number(selectedCity) : null,
        selected_mosque_id: selectedMosque || null,
        selected_mosque_ids: selectedMosques,
        selected_city_ids: selectedCities,
        notes,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setErrorMessage(data?.error ?? "Failed to save campaign.");
      return;
    }

    // 2. Redirect to checkout
    const checkout = await fetch("/api/checkout/create-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        campaign_id: data.id,
        business_id: null, // later: connect selected business
        pricing_tier: "silver",
        duration_days: 30,
        advertising_type: advertisingType,
        selected_city_ids: selectedCities,
        selected_mosque_ids: selectedMosques,
      }),
    });

    const checkoutData = await checkout.json();

    if (!checkout.ok) {
      setErrorMessage("Could not start checkout.");
      return;
    }

    if (checkoutData.url) {
      window.location.href = checkoutData.url;
    }
  } catch {
    setErrorMessage("Something went wrong.");
  } finally {
    setLoading(false);
  }
}

  return (
    <form onSubmit={handleSave} className="mt-6 grid gap-5">
      {advertisingType === "city_featured" && (
        <div>
          <label
            htmlFor="setup-city-featured"
            className="mb-2 block text-sm font-medium text-white/80"
          >
            Choose city
          </label>
          <select
            id="setup-city-featured"
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className="w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none focus:border-yellow-400"
          >
            <option value="">Select a city</option>
            {cities.map((city) => (
              <option key={city.id} value={String(city.id)}>
                {city.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {advertisingType === "mosque_sponsor" && (
        <>
          <div>
            <label
              htmlFor="setup-city-single-mosque"
              className="mb-2 block text-sm font-medium text-white/80"
            >
              Choose city
            </label>
            <select
              id="setup-city-single-mosque"
              value={selectedCity}
              onChange={(e) => {
                setSelectedCity(e.target.value);
                setSelectedMosque("");
              }}
              className="w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none focus:border-yellow-400"
            >
              <option value="">Select a city</option>
              {cities.map((city) => (
                <option key={city.id} value={String(city.id)}>
                  {city.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="setup-single-mosque"
              className="mb-2 block text-sm font-medium text-white/80"
            >
              Choose mosque
            </label>
            <select
              id="setup-single-mosque"
              value={selectedMosque}
              onChange={(e) => setSelectedMosque(e.target.value)}
              className="w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none focus:border-yellow-400"
            >
              <option value="">Select a mosque</option>
              {filteredMosques.map((mosque) => (
                <option key={mosque.id} value={mosque.id}>
                  {mosque.name}
                  {mosque.area ? ` • ${mosque.area}` : ""}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      {advertisingType === "multi_mosque" && (
        <>
          <div>
            <label
              htmlFor="setup-city-multi-mosque"
              className="mb-2 block text-sm font-medium text-white/80"
            >
              Choose city
            </label>
            <select
              id="setup-city-multi-mosque"
              value={selectedCity}
              onChange={(e) => {
                setSelectedCity(e.target.value);
                setSelectedMosques([]);
              }}
              className="w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none focus:border-yellow-400"
            >
              <option value="">Select a city</option>
              {cities.map((city) => (
                <option key={city.id} value={String(city.id)}>
                  {city.name}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-2xl border border-yellow-500/20 bg-black/30 p-5">
            <div className="text-sm font-medium text-white/80">
              Select multiple mosques
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {filteredMosques.map((mosque) => (
                <label
                  key={mosque.id}
                  className="flex items-start gap-3 rounded-2xl border border-white/10 bg-[rgb(var(--card))] p-4 text-white/80"
                >
                  <input
                    type="checkbox"
                    checked={selectedMosques.includes(mosque.id)}
                    onChange={() => toggleMosque(mosque.id)}
                  />
                  <span>
                    {mosque.name}
                    {mosque.area ? (
                      <span className="block text-xs text-white/50">
                        {mosque.area}
                      </span>
                    ) : null}
                  </span>
                </label>
              ))}
            </div>

            {selectedCity && filteredMosques.length === 0 && (
              <div className="mt-4 text-sm text-white/50">
                No mosques found for this city yet.
              </div>
            )}
          </div>
        </>
      )}

      {advertisingType === "multi_city" && (
        <div className="rounded-2xl border border-yellow-500/20 bg-black/30 p-5">
          <div className="text-sm font-medium text-white/80">
            Select multiple cities
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {cities.map((city) => (
              <label
                key={city.id}
                className="flex items-start gap-3 rounded-2xl border border-white/10 bg-[rgb(var(--card))] p-4 text-white/80"
              >
                <input
                  type="checkbox"
                  checked={selectedCities.includes(city.id)}
                  onChange={() => toggleCity(city.id)}
                />
                <span>{city.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div>
        <label
          htmlFor="setup-notes"
          className="mb-2 block text-sm font-medium text-white/80"
        >
          Campaign notes
        </label>
        <textarea
          id="setup-notes"
          rows={5}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none focus:border-yellow-400"
          placeholder="Tell us about your preferred locations, audience, or campaign goals."
        />
      </div>

      {errorMessage && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-200">
          {successMessage}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-yellow-500 px-5 py-3 text-sm font-semibold text-black hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Saving..." : "Save campaign setup"}
        </button>
      </div>
    </form>
  );
}

