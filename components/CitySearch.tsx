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

type SafeCity = {
  slug: string;
  name: string;
  country: string;
};

function cleanText(
  value: string | null | undefined
): string {
  return String(value ?? "").trim();
}

function isSafeSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(value);
}

function normaliseCities(cities: City[]): SafeCity[] {
  const seen = new Set<string>();
  const normalised: SafeCity[] = [];

  for (const city of cities ?? []) {
    const slug = cleanText(city.slug).toLowerCase();
    const name = cleanText(city.name);
    const country = cleanText(city.country);

    if (
      !slug ||
      !name ||
      !country ||
      !isSafeSlug(slug) ||
      seen.has(slug)
    ) {
      continue;
    }

    seen.add(slug);
    normalised.push({
      slug,
      name,
      country,
    });
  }

  return normalised.sort((first, second) => {
    const countryComparison =
      first.country.localeCompare(
        second.country,
        "en-GB",
        { sensitivity: "base" }
      );

    if (countryComparison !== 0) {
      return countryComparison;
    }

    return first.name.localeCompare(
      second.name,
      "en-GB",
      { sensitivity: "base" }
    );
  });
}

export default function CitySearch({ cities }: Props) {
  const [selectedCountry, setSelectedCountry] =
    useState("");
  const [selectedCity, setSelectedCity] =
    useState("");
  const [navigating, setNavigating] =
    useState(false);

  const usableCities = useMemo(
    () => normaliseCities(cities),
    [cities]
  );

  const countries = useMemo(() => {
    return Array.from(
      new Set(
        usableCities.map((city) => city.country)
      )
    ).sort((first, second) =>
      first.localeCompare(second, "en-GB", {
        sensitivity: "base",
      })
    );
  }, [usableCities]);

  const filteredCities = useMemo(() => {
    if (!selectedCountry) {
      return [];
    }

    return usableCities.filter(
      (city) =>
        city.country === selectedCountry
    );
  }, [selectedCountry, usableCities]);

  useEffect(() => {
    setSelectedCity("");
  }, [selectedCountry]);

  function handleCityChange(citySlug: string) {
    setSelectedCity(citySlug);

    const city = usableCities.find(
      (item) => item.slug === citySlug
    );

    if (!city || navigating) {
      return;
    }

    setNavigating(true);

    try {
      localStorage.setItem("snm_city", city.slug);
    } catch {
      // Local storage is optional.
    }

    document.cookie = [
      `snm_city=${encodeURIComponent(city.slug)}`,
      "path=/",
      `max-age=${60 * 60 * 24 * 365}`,
      "samesite=lax",
    ].join("; ");

    window.location.assign(
      `/${encodeURIComponent(city.slug)}`
    );
  }

  const citySelectDisabled =
    navigating ||
    !selectedCountry ||
    filteredCities.length === 0;

  return (
    <div className="w-full">
      <div className="grid w-full grid-cols-1 gap-3 lg:grid-cols-2">
        <label className="min-w-0">
          <span className="sr-only">
            Choose country
          </span>

          <div className="relative">
            <select
              value={selectedCountry}
              disabled={navigating}
              onChange={(event) => {
                setSelectedCountry(
                  event.target.value
                );
              }}
              className="h-16 w-full min-w-0 appearance-none rounded-2xl border border-yellow-500/40 bg-black/90 px-6 pr-12 text-base font-medium text-white outline-none transition duration-200 hover:border-yellow-400/60 focus:border-yellow-300 focus:ring-4 focus:ring-yellow-400/10 disabled:cursor-wait disabled:opacity-60"
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
        </label>

        <label className="min-w-0">
          <span className="sr-only">
            Choose city
          </span>

          <div className="relative">
            <select
              value={selectedCity}
              disabled={citySelectDisabled}
              aria-busy={navigating}
              onChange={(event) =>
                handleCityChange(
                  event.target.value
                )
              }
              className="h-16 w-full min-w-0 appearance-none rounded-2xl border border-yellow-500/30 bg-black/90 px-6 pr-12 text-base font-medium text-white outline-none transition duration-200 hover:border-yellow-400/55 focus:border-yellow-300 focus:ring-4 focus:ring-yellow-400/10 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-white/40"
            >
              <option value="">
                {navigating
                  ? "Opening city…"
                  : !selectedCountry
                    ? "Choose country first"
                    : filteredCities.length === 0
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
              {navigating ? (
                <span className="block size-4 animate-spin rounded-full border-2 border-yellow-300/30 border-t-yellow-300" />
              ) : (
                "▾"
              )}
            </span>
          </div>
        </label>
      </div>

      <div
        aria-live="polite"
        className="mt-4 min-h-6 text-sm text-white/55"
      >
        {usableCities.length === 0 ? (
          <p>
            No active cities are currently available.
          </p>
        ) : !selectedCountry ? (
          <p>
            Select a country first to view available
            cities.
          </p>
        ) : filteredCities.length === 0 ? (
          <p>
            No active cities are currently available for
            this country.
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