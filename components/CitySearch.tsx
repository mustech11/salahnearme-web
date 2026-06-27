"use client";

import { useEffect, useMemo, useState } from "react";

type City = {
  slug: string;
  name: string;
  country: string | null;
};

type Props = {
  cities: City[];
};

function normalizeCountry(value: string | null | undefined) {
  return (value ?? "").trim();
}

export default function CitySearch({ cities }: Props) {
  const [selectedCountry, setSelectedCountry] = useState("");
  const [selectedCity, setSelectedCity] = useState("");

  const countries = useMemo(() => {
    const uniqueCountries = Array.from(
      new Set(
        cities
          .map((city) => normalizeCountry(city.country))
          .filter(Boolean)
      )
    );

    return uniqueCountries.sort((a, b) => a.localeCompare(b));
  }, [cities]);

  const filteredCities = useMemo(() => {
    if (!selectedCountry) return [];

    return [...cities]
      .filter((city) => normalizeCountry(city.country) === selectedCountry)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [cities, selectedCountry]);

  useEffect(() => {
    setSelectedCity("");
  }, [selectedCountry]);

  function handleCountryChange(country: string) {
    setSelectedCountry(country);
  }

  function handleCityChange(citySlug: string) {
    setSelectedCity(citySlug);

    if (!citySlug) return;

    localStorage.setItem("snm_city", citySlug);

    document.cookie = `snm_city=${encodeURIComponent(
      citySlug
    )}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;

    window.location.href = `/${citySlug}`;
  }

  return (
    <div className="w-full max-w-2xl space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="homepage-country-select" className="sr-only">
            Choose country
          </label>

          <select
            id="homepage-country-select"
            value={selectedCountry}
            onChange={(e) => handleCountryChange(e.target.value)}
            className="w-full rounded-2xl border border-yellow-500/30 bg-black px-5 py-4 text-base text-white outline-none focus:border-yellow-400"
          >
            <option value="">Choose country</option>
            {countries.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="homepage-city-select" className="sr-only">
            Choose city
          </label>

          <select
            id="homepage-city-select"
            value={selectedCity}
            onChange={(e) => handleCityChange(e.target.value)}
            disabled={!selectedCountry}
            className="w-full rounded-2xl border border-yellow-500/30 bg-black px-5 py-4 text-base text-white outline-none focus:border-yellow-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">
              {selectedCountry ? "Choose city" : "Choose country first"}
            </option>

            {filteredCities.map((city) => (
              <option key={city.slug} value={city.slug}>
                {city.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!selectedCountry && (
        <p className="text-sm text-white/60">
          Select a country first to view available cities.
        </p>
      )}
    </div>
  );
}

