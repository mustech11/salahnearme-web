"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

type City = {
  slug: string;
  name: string;
  country: string | null;
};

type Props = {
  cities: City[];
};

function normaliseCountry(
  value: string | null | undefined
): string {
  return String(value ?? "").trim();
}

function normaliseCityName(
  value: string | null | undefined
): string {
  return String(value ?? "").trim();
}

function isValidCity(
  city: City
): boolean {
  return (
    city.slug.trim().length > 0 &&
    city.name.trim().length > 0 &&
    normaliseCountry(city.country).length > 0
  );
}

export default function CitySearch({
  cities,
}: Props) {
  const [selectedCountry, setSelectedCountry] =
    useState("");

  const [selectedCity, setSelectedCity] =
    useState("");

  const usableCities = useMemo(
    () =>
      cities
        .filter(isValidCity)
        .map((city) => ({
          slug: city.slug.trim(),
          name: normaliseCityName(city.name),
          country: normaliseCountry(
            city.country
          ),
        })),
    [cities]
  );

  const countries = useMemo(() => {
    const uniqueCountries = new Set<string>();

    for (const city of usableCities) {
      if (city.country) {
        uniqueCountries.add(city.country);
      }
    }

    return Array.from(uniqueCountries).sort(
      (a, b) =>
        a.localeCompare(b, "en-GB", {
          sensitivity: "base",
        })
    );
  }, [usableCities]);

  const filteredCities = useMemo(() => {
    if (!selectedCountry) {
      return [];
    }

    return usableCities
      .filter(
        (city) =>
          city.country === selectedCountry
      )
      .sort((a, b) =>
        a.name.localeCompare(
          b.name,
          "en-GB",
          {
            sensitivity: "base",
          }
        )
      );
  }, [
    usableCities,
    selectedCountry,
  ]);

  useEffect(() => {
    setSelectedCity("");
  }, [selectedCountry]);

  function handleCountryChange(
    country: string
  ) {
    setSelectedCountry(country);
  }

  function handleCityChange(
    citySlug: string
  ) {
    setSelectedCity(citySlug);

    if (!citySlug) {
      return;
    }

    try {
      localStorage.setItem(
        "snm_city",
        citySlug
      );
    } catch {
      // Local storage is optional.
    }

    document.cookie = [
      `snm_city=${encodeURIComponent(
        citySlug
      )}`,
      "path=/",
      `max-age=${60 * 60 * 24 * 365}`,
      "samesite=lax",
    ].join("; ");

    window.location.assign(
      `/${encodeURIComponent(citySlug)}`
    );
  }

  const citySelectDisabled =
    !selectedCountry ||
    filteredCities.length === 0;

  return (
    <div className="w-full">
      <div className="grid w-full grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="min-w-0">
          <label
            htmlFor="homepage-country-select"
            className="sr-only"
          >
            Choose country
          </label>

          <div className="relative">
            <select
              id="homepage-country-select"
              value={selectedCountry}
              onChange={(event) =>
                handleCountryChange(
                  event.target.value
                )
              }
              className="h-16 w-full min-w-0 appearance-none rounded-2xl border border-yellow-500/40 bg-black/90 px-6 pr-12 text-base font-medium text-white outline-none transition duration-200 hover:border-yellow-400/60 focus:border-yellow-300 focus:ring-4 focus:ring-yellow-400/10"
            >
              <option value="">
                Choose country
              </option>

              {countries.map((country) => (
                <option
                  key={country}
                  value={country}
                >
                  {country}
                </option>
              ))}
            </select>

            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-sm text-yellow-300"
            >
              ▾
            </span>
          </div>
        </div>

        <div className="min-w-0">
          <label
            htmlFor="homepage-city-select"
            className="sr-only"
          >
            Choose city
          </label>

          <div className="relative">
            <select
              id="homepage-city-select"
              value={selectedCity}
              onChange={(event) =>
                handleCityChange(
                  event.target.value
                )
              }
              disabled={citySelectDisabled}
              className="h-16 w-full min-w-0 appearance-none rounded-2xl border border-yellow-500/30 bg-black/90 px-6 pr-12 text-base font-medium text-white outline-none transition duration-200 hover:border-yellow-400/55 focus:border-yellow-300 focus:ring-4 focus:ring-yellow-400/10 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-white/40"
            >
              <option value="">
                {!selectedCountry
                  ? "Choose country first"
                  : filteredCities.length ===
                      0
                    ? "No cities available"
                    : "Choose city"}
              </option>

              {filteredCities.map(
                (city) => (
                  <option
                    key={city.slug}
                    value={city.slug}
                  >
                    {city.name}
                  </option>
                )
              )}
            </select>

            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-sm text-yellow-300"
            >
              ▾
            </span>
          </div>
        </div>
      </div>

      <div
        aria-live="polite"
        className="mt-4 min-h-6 text-sm text-white/55"
      >
        {!selectedCountry ? (
          <p>
            Select a country first to view
            available cities.
          </p>
        ) : filteredCities.length === 0 ? (
          <p>
            No active cities are currently
            available for this country.
          </p>
        ) : (
          <p>
            {filteredCities.length}{" "}
            {filteredCities.length === 1
              ? "city"
              : "cities"}{" "}
            available in {selectedCountry}.
          </p>
        )}
      </div>
    </div>
  );
}