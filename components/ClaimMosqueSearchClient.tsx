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

type MosqueSearchRow = {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  area: string | null;
  postcode: string | null;
  address: string | null;
  verified_status: string | null;
};

type SearchResponse = {
  ok?: boolean;
  error?: string;
  results?: MosqueSearchRow[];
  count?: number;
};

type Props = {
  initialCity?: string;
  initialQuery?: string;
};

type SearchState =
  | "idle"
  | "loading"
  | "success"
  | "error";

const REQUEST_TIMEOUT_MS = 15_000;
const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 160;
const MAX_CITY_LENGTH = 120;

function cleanText(
  value: string | null | undefined
): string {
  return value?.trim() ?? "";
}

async function readJson(
  response: Response
): Promise<SearchResponse> {
  try {
    const value: unknown = await response.json();

    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value)
    ) {
      return {};
    }

    return value as SearchResponse;
  } catch {
    return {};
  }
}

function formatStatus(
  value: string | null
): string {
  const cleaned = cleanText(value);

  if (!cleaned) {
    return "Community listing";
  }

  return cleaned
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}

export default function ClaimMosqueSearchClient({
  initialCity = "",
  initialQuery = "",
}: Props) {
  const statusId = useId();

  const abortControllerRef =
    useRef<AbortController | null>(null);

  const [query, setQuery] = useState(
    initialQuery.slice(0, MAX_QUERY_LENGTH)
  );

  const [city, setCity] = useState(
    initialCity.slice(0, MAX_CITY_LENGTH)
  );

  const [results, setResults] = useState<
    MosqueSearchRow[]
  >([]);

  const [searchState, setSearchState] =
    useState<SearchState>("idle");

  const [errorMessage, setErrorMessage] =
    useState("");

  const cleanQuery = useMemo(
    () => query.trim().slice(0, MAX_QUERY_LENGTH),
    [query]
  );

  const cleanCity = useMemo(
    () => city.trim().slice(0, MAX_CITY_LENGTH),
    [city]
  );

  const canSearch =
    cleanQuery.length >= MIN_QUERY_LENGTH ||
    cleanCity.length >= MIN_QUERY_LENGTH;

  const runSearch = useCallback(async () => {
    if (!canSearch) {
      abortControllerRef.current?.abort();
      setResults([]);
      setSearchState("idle");
      setErrorMessage("");
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

    setSearchState("loading");
    setErrorMessage("");

    try {
      const params = new URLSearchParams();

      if (cleanQuery) {
        params.set("q", cleanQuery);
      }

      if (cleanCity) {
        params.set("city", cleanCity);
      }

      const response = await fetch(
        `/api/claim-mosque/search?${params.toString()}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        }
      );

      const data = await readJson(response);

      if (!response.ok || data.ok !== true) {
        setResults([]);
        setSearchState("error");
        setErrorMessage(
          cleanText(data.error) ||
            "Mosque search could not be completed."
        );
        return;
      }

      setResults(
        Array.isArray(data.results)
          ? data.results
          : []
      );

      setSearchState("success");
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        if (timedOut) {
          setSearchState("error");
          setErrorMessage(
            "The mosque search timed out. Please try again."
          );
        }

        return;
      }

      console.error("Claim mosque search error:", error);

      setResults([]);
      setSearchState("error");
      setErrorMessage(
        "Mosque search could not be completed."
      );
    } finally {
      window.clearTimeout(timeoutId);

      if (
        abortControllerRef.current === controller
      ) {
        abortControllerRef.current = null;
      }
    }
  }, [canSearch, cleanCity, cleanQuery]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void runSearch();
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [runSearch]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  function clearSearch() {
    abortControllerRef.current?.abort();

    setQuery("");
    setCity("");
    setResults([]);
    setSearchState("idle");
    setErrorMessage("");
  }

  return (
    <section
      aria-labelledby="claim-mosque-search-heading"
      className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6 md:p-8"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.25em] text-yellow-400">
            Mosque search
          </div>

          <h2
            id="claim-mosque-search-heading"
            className="mt-2 text-3xl font-black text-white"
          >
            Find the mosque you manage
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/60">
            Enter at least two characters. Combining a mosque name with a city
            produces the most accurate results.
          </p>
        </div>

        {query || city ? (
          <button
            type="button"
            onClick={clearSearch}
            className="w-fit rounded-xl border border-white/10 bg-black px-4 py-3 text-sm font-bold text-white/70 transition hover:border-red-500/30 hover:text-red-300"
          >
            Clear search
          </button>
        ) : null}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.5fr_0.8fr_auto]">
        <div>
          <label
            htmlFor="claim-mosque-query"
            className="mb-2 block text-sm font-bold text-white/80"
          >
            Mosque name, postcode or area
          </label>

          <input
            id="claim-mosque-query"
            type="search"
            value={query}
            maxLength={MAX_QUERY_LENGTH}
            autoComplete="off"
            placeholder="e.g. Manchester Central Mosque"
            onChange={(event) =>
              setQuery(event.target.value)
            }
            className="w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-500/20"
          />
        </div>

        <div>
          <label
            htmlFor="claim-mosque-city"
            className="mb-2 block text-sm font-bold text-white/80"
          >
            City
          </label>

          <input
            id="claim-mosque-city"
            type="search"
            value={city}
            maxLength={MAX_CITY_LENGTH}
            autoComplete="address-level2"
            placeholder="e.g. Manchester"
            onChange={(event) =>
              setCity(event.target.value)
            }
            className="w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-500/20"
          />
        </div>

        <button
          type="button"
          disabled={!canSearch || searchState === "loading"}
          onClick={() => {
            void runSearch();
          }}
          className="self-end rounded-2xl bg-yellow-500 px-6 py-3 font-black text-black transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {searchState === "loading"
            ? "Searching..."
            : "Search"}
        </button>
      </div>

      <div
        id={statusId}
        aria-live="polite"
        aria-atomic="true"
      >
        {searchState === "loading" ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <SearchSkeleton />
            <SearchSkeleton />
            <SearchSkeleton />
            <SearchSkeleton />
          </div>
        ) : null}

        {searchState === "error" ? (
          <div
            role="alert"
            className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200"
          >
            {errorMessage}
          </div>
        ) : null}

        {searchState === "success" &&
        results.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-6">
            <div className="font-bold text-white">
              No matching mosque was found.
            </div>

            <p className="mt-2 text-sm leading-6 text-white/60">
              Try a shorter mosque name, a postcode or a different spelling of
              the city.
            </p>
          </div>
        ) : null}

        {searchState === "success" &&
        results.length > 0 ? (
          <div className="mt-6">
            <div className="mb-4 text-sm text-white/55">
              {results.length} matching mosque
              {results.length === 1 ? "" : "s"} found
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {results.map((mosque) => {
                const location = [
                  mosque.area,
                  mosque.city,
                  mosque.postcode,
                ]
                  .map(cleanText)
                  .filter(Boolean)
                  .join(" • ");

                return (
                  <article
                    key={mosque.id}
                    className="rounded-2xl border border-white/10 bg-black/30 p-5 transition hover:border-yellow-500/40"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="break-words text-xl font-black text-white">
                          {mosque.name}
                        </h3>

                        {location ? (
                          <div className="mt-2 text-sm text-white/60">
                            {location}
                          </div>
                        ) : null}
                      </div>

                      <span className="rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-[10px] font-bold text-green-300">
                        {formatStatus(
                          mosque.verified_status
                        )}
                      </span>
                    </div>

                    {mosque.address ? (
                      <p className="mt-3 text-sm leading-6 text-white/55">
                        {mosque.address}
                      </p>
                    ) : null}

                    <div className="mt-5 flex flex-wrap gap-3">
                      <Link
                        href={`/claim/mosque/${mosque.slug}`}
                        className="rounded-xl bg-yellow-500 px-4 py-3 text-sm font-black text-black transition hover:bg-yellow-400"
                      >
                        Claim this mosque
                      </Link>

                      <Link
                        href={`/mosque/${mosque.slug}`}
                        className="rounded-xl border border-white/10 bg-black px-4 py-3 text-sm font-bold text-white transition hover:border-yellow-500/30 hover:text-yellow-300"
                      >
                        View public page
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function SearchSkeleton() {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
      <div className="h-5 w-2/3 animate-pulse rounded bg-white/10" />
      <div className="mt-3 h-4 w-1/2 animate-pulse rounded bg-white/10" />
      <div className="mt-5 h-10 w-36 animate-pulse rounded-xl bg-white/10" />
    </div>
  );
}