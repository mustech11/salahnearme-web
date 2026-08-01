"use client";

import { type FormEvent, useEffect, useId, useMemo, useRef, useState } from "react";

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

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const REQUEST_TIMEOUT_MS = 25_000;
const MAX_NOTES_LENGTH = 2_000;
const MAX_MULTI_SELECTION = 50;

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getCheckoutUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;

  try {
    const url = new URL(value);

    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

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
  const feedbackId = useId();
  const abortControllerRef = useRef<AbortController | null>(null);
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedMosque, setSelectedMosque] = useState("");
  const [selectedMosques, setSelectedMosques] = useState<string[]>([]);
  const [selectedCities, setSelectedCities] = useState<number[]>([]);
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const safeCities = useMemo(
    () =>
      (cities ?? [])
        .filter(
          (city) =>
            Number.isInteger(city.id) &&
            city.id > 0 &&
            cleanText(city.name)
        )
        .sort((first, second) =>
          first.name.localeCompare(second.name, "en-GB", {
            sensitivity: "base",
          })
        ),
    [cities]
  );

  const safeMosques = useMemo(
    () =>
      (mosques ?? [])
        .filter(
          (mosque) =>
            UUID_REGEX.test(cleanText(mosque.id)) &&
            cleanText(mosque.name) &&
            cleanText(mosque.slug)
        )
        .sort((first, second) =>
          first.name.localeCompare(second.name, "en-GB", {
            sensitivity: "base",
          })
        ),
    [mosques]
  );

  const cityName = useMemo(() => {
    return (
      safeCities.find(
        (city) => String(city.id) === selectedCity
      )?.name ?? ""
    );
  }, [safeCities, selectedCity]);

  const filteredMosques = useMemo(() => {
    if (!cityName) return safeMosques;

    return safeMosques.filter(
      (mosque) => cleanText(mosque.city) === cityName
    );
  }, [safeMosques, cityName]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  function toggleCity(id: number) {
    setSelectedCities((previous) => {
      if (previous.includes(id)) {
        return previous.filter((value) => value !== id);
      }

      if (previous.length >= MAX_MULTI_SELECTION) {
        setErrorMessage(
          `Select no more than ${MAX_MULTI_SELECTION} cities.`
        );
        return previous;
      }

      return [...previous, id];
    });
  }

  function toggleMosque(id: string) {
    setSelectedMosques((previous) => {
      if (previous.includes(id)) {
        return previous.filter((value) => value !== id);
      }

      if (previous.length >= MAX_MULTI_SELECTION) {
        setErrorMessage(
          `Select no more than ${MAX_MULTI_SELECTION} mosques.`
        );
        return previous;
      }

      return [...previous, id];
    });
  }

  function validateSelection(): string | null {
    if (
      advertisingType === "city_featured" &&
      !selectedCity
    ) {
      return "Choose a city.";
    }

    if (
      advertisingType === "mosque_sponsor" &&
      !UUID_REGEX.test(selectedMosque)
    ) {
      return "Choose a valid mosque.";
    }

    if (
      advertisingType === "multi_mosque" &&
      selectedMosques.length === 0
    ) {
      return "Select at least one mosque.";
    }

    if (
      advertisingType === "multi_city" &&
      selectedCities.length === 0
    ) {
      return "Select at least one city.";
    }

    return null;
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    setErrorMessage("");
    setSuccessMessage("");

    const validationError = validateSelection();

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

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

      const campaignResponse = await fetch(
        "/api/advertise/setup",
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
          body: JSON.stringify({
            advertising_type: advertisingType,
            selected_city_id: selectedCity
              ? Number(selectedCity)
              : null,
            selected_mosque_id:
              selectedMosque || null,
            selected_mosque_ids:
              selectedMosques,
            selected_city_ids:
              selectedCities,
            notes: notes.trim(),
          }),
        }
      );

      const campaignData = (await campaignResponse
        .json()
        .catch(() => ({}))) as {
        ok?: boolean;
        id?: string;
        error?: string;
      };

      if (
        !campaignResponse.ok ||
        campaignData.ok === false
      ) {
        setErrorMessage(
          cleanText(campaignData.error) ||
            "Failed to save campaign."
        );
        return;
      }

      const campaignId = cleanText(campaignData.id);

      if (!campaignId) {
        setErrorMessage(
          "Campaign ID was not returned."
        );
        return;
      }

      setSuccessMessage(
        "Campaign saved. Preparing secure checkout…"
      );

      const checkoutResponse = await fetch(
        "/api/checkout/create-session",
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
          body: JSON.stringify({
            campaign_id: campaignId,
            business_id: null,
            pricing_tier: "silver",
            duration_days: 30,
            advertising_type: advertisingType,
            selected_city_ids: selectedCities,
            selected_mosque_ids: selectedMosques,
            selected_city_id: selectedCity
              ? Number(selectedCity)
              : null,
            selected_mosque_id:
              selectedMosque || null,
          }),
        }
      );

      const checkoutData = (await checkoutResponse
        .json()
        .catch(() => ({}))) as {
        ok?: boolean;
        url?: string;
        error?: string;
      };

      if (
        !checkoutResponse.ok ||
        checkoutData.ok === false
      ) {
        setErrorMessage(
          cleanText(checkoutData.error) ||
            "Could not start checkout."
        );
        return;
      }

      const checkoutUrl = getCheckoutUrl(
        checkoutData.url
      );

      if (!checkoutUrl) {
        setErrorMessage(
          "A valid checkout URL was not returned."
        );
        return;
      }

      window.location.assign(checkoutUrl);
    } catch (error) {
      setErrorMessage(
        error instanceof DOMException &&
          error.name === "AbortError"
          ? timedOut
            ? "Campaign setup timed out. Please try again."
            : "Campaign setup was cancelled."
          : "Something went wrong."
      );
    } finally {
      window.clearTimeout(timeoutId);

      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }

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
            {safeCities.map((city) => (
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
              {safeCities.map((city) => (
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
              {safeCities.map((city) => (
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
            {safeCities.map((city) => (
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
          maxLength={MAX_NOTES_LENGTH}
          disabled={loading}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none focus:border-yellow-400"
          placeholder="Tell us about your preferred locations, audience, or campaign goals."
        />

        <p className="mt-2 text-right text-xs text-white/40">
          {notes.length}/{MAX_NOTES_LENGTH}
        </p>
      </div>

      <div id={feedbackId} aria-live="polite" aria-atomic="true">
        {errorMessage ? (
          <div
            role="alert"
            className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200"
          >
            {errorMessage}
          </div>
        ) : null}

        {successMessage ? (
          <div
            role="status"
            className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200"
          >
            {successMessage}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={loading}
          aria-busy={loading}
          className="rounded-xl bg-yellow-500 px-5 py-3 text-sm font-semibold text-black hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Saving and opening checkout…" : "Save campaign setup"}
        </button>
      </div>
    </form>
  );
}
