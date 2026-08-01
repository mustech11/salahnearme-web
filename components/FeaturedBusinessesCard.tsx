"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import BusinessTrackedLink from "@/components/BusinessTrackedLink";

type FeaturedBusiness = {
  id: string;
  name: string | null;
  slug: string | null;
  category: string | null;
  city?: string | null;
  area?: string | null;
  address: string | null;
  postcode: string | null;
  website: string | null;
  phone: string | null;
  maps_url: string | null;
  logo_url?: string | null;
  cover_image_url?: string | null;
  gallery_urls?: string[] | null;
  distanceMi?: number | null;
  sponsor_label?: string | null;
  is_verified?: boolean | null;
  featured?: boolean | null;
};

type ApiResponse = {
  ok?: boolean;
  items?: FeaturedBusiness[];
  error?: string;
};

type Props = {
  mosqueId: string;
  limit?: number;
  initialItems?: FeaturedBusiness[];
};

type LoadState =
  | "idle"
  | "loading"
  | "success"
  | "error";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const REQUEST_TIMEOUT_MS = 20_000;
const MAX_LIMIT = 12;

function cleanText(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function formatLabel(
  value: string | null | undefined
): string {
  const cleaned = cleanText(value);

  if (!cleaned) {
    return "Business";
  }

  return cleaned
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}

function normaliseExternalUrl(
  value: string | null | undefined
): string | null {
  const raw = cleanText(value);

  if (!raw) {
    return null;
  }

  const candidate =
    /^https?:\/\//i.test(raw)
      ? raw
      : `https://${raw}`;

  try {
    const url = new URL(candidate);

    if (
      url.protocol !== "http:" &&
      url.protocol !== "https:"
    ) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function getCardImage(
  business: FeaturedBusiness
): string | null {
  const candidates = [
    business.cover_image_url,
    business.logo_url,
    ...(Array.isArray(business.gallery_urls)
      ? business.gallery_urls
      : []),
  ];

  for (const candidate of candidates) {
    const url = normaliseExternalUrl(candidate);

    if (url) {
      return url;
    }
  }

  return null;
}

function getSafeLimit(value: number): number {
  if (!Number.isFinite(value)) {
    return 6;
  }

  return Math.min(
    MAX_LIMIT,
    Math.max(1, Math.trunc(value))
  );
}

function normaliseItems(
  items: FeaturedBusiness[]
): FeaturedBusiness[] {
  const seen = new Set<string>();

  return (items ?? []).filter((item) => {
    const id = cleanText(item.id);

    if (
      !UUID_REGEX.test(id) ||
      seen.has(id)
    ) {
      return false;
    }

    seen.add(id);
    return true;
  });
}

export default function FeaturedBusinessesCard({
  mosqueId,
  limit = 6,
  initialItems = [],
}: Props) {
  const headingId = useId();
  const feedbackId = useId();

  const abortControllerRef =
    useRef<AbortController | null>(null);

  const cleanMosqueId = useMemo(
    () => cleanText(mosqueId),
    [mosqueId]
  );

  const safeLimit = useMemo(
    () => getSafeLimit(limit),
    [limit]
  );

  const [items, setItems] = useState<
    FeaturedBusiness[]
  >(() => normaliseItems(initialItems));

  const [loadState, setLoadState] =
    useState<LoadState>(
      initialItems.length > 0
        ? "success"
        : "idle"
    );

  const [errorMessage, setErrorMessage] =
    useState("");

  const [lastUpdatedAt, setLastUpdatedAt] =
    useState<Date | null>(null);

  const load = useCallback(async () => {
    if (!UUID_REGEX.test(cleanMosqueId)) {
      setLoadState("error");
      setErrorMessage(
        "A valid mosque is required to load nearby featured businesses."
      );
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

    setLoadState("loading");
    setErrorMessage("");

    try {
      const params = new URLSearchParams({
        mosque_id: cleanMosqueId,
        limit: String(safeLimit),
      });

      const response = await fetch(
        `/api/businesses/featured?${params.toString()}`,
        {
          headers: {
            Accept: "application/json",
          },
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        }
      );

      const data = (await response
        .json()
        .catch(() => ({}))) as ApiResponse;

      if (
        !response.ok ||
        data.ok !== true
      ) {
        setLoadState("error");
        setErrorMessage(
          cleanText(data.error) ||
            "Failed to load featured businesses."
        );
        return;
      }

      setItems(
        normaliseItems(
          Array.isArray(data.items)
            ? data.items
            : []
        )
      );

      setLastUpdatedAt(new Date());
      setLoadState("success");
    } catch (error) {
      setLoadState("error");

      setErrorMessage(
        error instanceof DOMException &&
          error.name === "AbortError"
          ? timedOut
            ? "The featured-business request timed out."
            : "The featured-business request was cancelled."
          : "Failed to load featured businesses."
      );
    } finally {
      window.clearTimeout(timeoutId);

      if (
        abortControllerRef.current === controller
      ) {
        abortControllerRef.current = null;
      }
    }
  }, [cleanMosqueId, safeLimit]);

  useEffect(() => {
    void load();

    return () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, [load]);

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-sm font-black text-yellow-400">
            Featured halal businesses
          </div>

          <h2
            id={headingId}
            className="mt-1 text-xl font-black text-white"
          >
            Support businesses near this mosque
          </h2>

          <p className="mt-2 max-w-2xl text-xs leading-6 text-white/60">
            Sponsored and featured listings may appear here.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-yellow-500/20 bg-yellow-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-yellow-400">
            Near mosque
          </span>

          <button
            type="button"
            onClick={() => void load()}
            disabled={loadState === "loading"}
            className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white/60 transition hover:border-yellow-500/30 hover:text-yellow-300 disabled:opacity-50"
          >
            {loadState === "loading"
              ? "Refreshing"
              : "Refresh"}
          </button>
        </div>
      </div>

      <div
        id={feedbackId}
        aria-live="polite"
      >
        {loadState === "loading" &&
        items.length === 0 ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map(
              (_, index) => (
                <SkeletonCard key={index} />
              )
            )}
          </div>
        ) : null}

        {errorMessage ? (
          <div
            role="alert"
            className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-200"
          >
            {errorMessage}
          </div>
        ) : null}

        {lastUpdatedAt ? (
          <p className="mt-3 text-xs text-white/35">
            Updated{" "}
            {lastUpdatedAt.toLocaleTimeString(
              "en-GB",
              {
                hour: "2-digit",
                minute: "2-digit",
              }
            )}
          </p>
        ) : null}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {items.map((business) => {
          const cardImage =
            getCardImage(business);

          const websiteUrl =
            normaliseExternalUrl(
              business.website
            );

          const mapsUrl =
            normaliseExternalUrl(
              business.maps_url
            );

          const slug =
            cleanText(business.slug);

          const name =
            cleanText(business.name) ||
            "Unnamed business";

          const address = [
            cleanText(business.address),
            cleanText(business.postcode),
          ]
            .filter(Boolean)
            .join(", ");

          return (
            <article
              key={business.id}
              className="group overflow-hidden rounded-2xl border border-yellow-500/20 bg-black/30 transition hover:-translate-y-0.5 hover:border-yellow-400/50"
            >
              {cardImage ? (
                <div className="relative h-36 overflow-hidden">
                  <Image
                    src={cardImage}
                    alt={`${name} image`}
                    fill
                    sizes="(min-width: 768px) 50vw, 100vw"
                    className="object-cover transition duration-300 group-hover:scale-[1.02]"
                  />

                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                </div>
              ) : null}

              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {slug ? (
                      <BusinessTrackedLink
                        businessId={business.id}
                        href={`/business/${encodeURIComponent(
                          slug
                        )}`}
                        eventType="profile_click"
                        source="featured_business_card"
                        pageType="mosque_featured_businesses"
                        className="text-sm font-black text-white transition hover:text-yellow-400"
                        metadata={{
                          mosque_id: cleanMosqueId,
                        }}
                      >
                        {name}
                      </BusinessTrackedLink>
                    ) : (
                      <div className="text-sm font-black text-white">
                        {name}
                      </div>
                    )}

                    <div className="mt-1 text-xs text-white/60">
                      {formatLabel(
                        business.category
                      )}

                      {typeof business.distanceMi ===
                        "number" &&
                      Number.isFinite(
                        business.distanceMi
                      )
                        ? ` • ${Math.max(
                            0,
                            business.distanceMi
                          ).toFixed(1)} mi`
                        : ""}
                    </div>

                    {address ? (
                      <div
                        dir="auto"
                        className="mt-2 text-xs leading-5 text-white/50"
                      >
                        {address}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2 py-1 text-[10px] font-black text-yellow-400">
                      {cleanText(
                        business.sponsor_label
                      ) || "Featured"}
                    </span>

                    {business.is_verified ? (
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-black text-emerald-300">
                        Verified
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {slug ? (
                    <BusinessTrackedLink
                      businessId={business.id}
                      href={`/business/${encodeURIComponent(
                        slug
                      )}`}
                      eventType="profile_click"
                      source="featured_business_card"
                      pageType="mosque_featured_businesses"
                      className="rounded-xl bg-yellow-500 px-3 py-2 text-xs font-black text-black transition hover:bg-yellow-400"
                      metadata={{
                        mosque_id: cleanMosqueId,
                      }}
                    >
                      View
                    </BusinessTrackedLink>
                  ) : null}

                  {websiteUrl ? (
                    <BusinessTrackedLink
                      businessId={business.id}
                      href={websiteUrl}
                      eventType="website_click"
                      source="featured_business_card"
                      pageType="mosque_featured_businesses"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/10"
                      metadata={{
                        mosque_id: cleanMosqueId,
                      }}
                    >
                      Website
                    </BusinessTrackedLink>
                  ) : null}

                  {mapsUrl ? (
                    <BusinessTrackedLink
                      businessId={business.id}
                      href={mapsUrl}
                      eventType="maps_click"
                      source="featured_business_card"
                      pageType="mosque_featured_businesses"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-xl border border-yellow-500/30 bg-black px-3 py-2 text-xs font-bold text-yellow-400 transition hover:bg-yellow-500/10"
                      metadata={{
                        mosque_id: cleanMosqueId,
                      }}
                    >
                      Maps
                    </BusinessTrackedLink>
                  ) : null}

                  {cleanText(business.phone) ? (
                    <BusinessTrackedLink
                      businessId={business.id}
                      href={`tel:${cleanText(
                        business.phone
                      )}`}
                      eventType="phone_click"
                      source="featured_business_card"
                      pageType="mosque_featured_businesses"
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/10"
                      metadata={{
                        mosque_id: cleanMosqueId,
                      }}
                    >
                      Call
                    </BusinessTrackedLink>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {loadState !== "loading" &&
      !errorMessage &&
      items.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-5 text-center">
          <div className="font-bold text-white">
            No featured businesses yet
          </div>

          <p className="mt-2 text-xs leading-5 text-white/50">
            Nearby sponsored businesses will appear here when available.
          </p>
        </div>
      ) : null}
    </section>
  );
}

function SkeletonCard() {
  return (
    <div
      aria-hidden="true"
      className="animate-pulse overflow-hidden rounded-2xl border border-white/10 bg-black/30"
    >
      <div className="h-36 bg-white/10" />

      <div className="p-4">
        <div className="h-4 w-2/3 rounded bg-white/10" />
        <div className="mt-3 h-3 w-1/2 rounded bg-white/10" />
        <div className="mt-5 h-8 w-full rounded bg-white/10" />
      </div>
    </div>
  );
}