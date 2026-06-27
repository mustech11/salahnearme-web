"use client";

import { useEffect, useState } from "react";

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

function formatLabel(value: string | null | undefined) {
  if (!value) {
    return "Business";
  }

  return value
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function normaliseExternalUrl(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://")
  ) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

function getCardImage(business: FeaturedBusiness) {
  return (
    business.cover_image_url ||
    business.logo_url ||
    business.gallery_urls?.[0] ||
    null
  );
}

export default function FeaturedBusinessesCard({
  mosqueId,
  limit = 6,
  initialItems = [],
}: Props) {
  const [items, setItems] = useState<FeaturedBusiness[]>(initialItems);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    if (!mosqueId) {
      return;
    }

    setLoading(true);
    setErr(null);

    try {
      const params = new URLSearchParams({
        mosque_id: mosqueId,
        limit: String(limit),
      });

      const response = await fetch(
        `/api/businesses/featured?${params.toString()}`,
        {
          cache: "no-store",
        }
      );

      const data = (await response.json().catch(() => ({}))) as ApiResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Failed to load featured businesses.");
      }

      setItems(data.items ?? []);
    } catch (error) {
      setErr(
        error instanceof Error
          ? error.message
          : "Failed to load featured businesses."
      );

      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mosqueId, limit]);

  return (
    <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-yellow-400">
            Featured Halal Businesses
          </div>

          <div className="mt-1 text-xs text-white/60">
            Support the local halal economy. Some listings may be sponsored.
          </div>
        </div>

        <div className="rounded-full border border-yellow-500/20 bg-yellow-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-yellow-400">
          Near mosque
        </div>
      </div>

      {loading ? (
        <div className="mt-4 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-xs text-yellow-200">
          Loading featured businesses...
        </div>
      ) : null}

      {err ? (
        <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-200">
          {err}
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {items.map((business) => {
          const cardImage = getCardImage(business);
          const websiteUrl = normaliseExternalUrl(business.website);
          const mapsUrl = normaliseExternalUrl(business.maps_url);

          return (
            <article
              key={business.id}
              className="overflow-hidden rounded-2xl border border-yellow-500/20 bg-black/30 transition hover:border-yellow-400/50"
            >
              {cardImage ? (
                <div className="relative h-28 overflow-hidden">
                  <img
                    src={cardImage}
                    alt={`${business.name ?? "Business"} image`}
                    className="h-full w-full object-cover"
                  />

                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                  {business.logo_url && business.cover_image_url ? (
                    <img
                      src={business.logo_url}
                      alt={`${business.name ?? "Business"} logo`}
                      className="absolute bottom-2 left-2 h-12 w-12 rounded-xl border border-yellow-500/30 bg-black object-cover p-1"
                    />
                  ) : null}
                </div>
              ) : null}

              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {business.slug ? (
                      <BusinessTrackedLink
                        businessId={business.id}
                        href={`/business/${business.slug}`}
                        eventType="profile_click"
                        source="featured_business_card"
                        pageType="mosque_featured_businesses"
                        className="text-sm font-semibold text-white hover:text-yellow-400"
                        metadata={{
                          mosque_id: mosqueId,
                        }}
                      >
                        {business.name ?? "Unnamed business"}
                      </BusinessTrackedLink>
                    ) : (
                      <div className="text-sm font-semibold text-white">
                        {business.name ?? "Unnamed business"}
                      </div>
                    )}

                    <div className="mt-1 text-xs text-white/60">
                      {formatLabel(business.category)}
                      {business.distanceMi != null
                        ? ` • ${business.distanceMi.toFixed(1)} mi`
                        : ""}
                    </div>

                    <div className="mt-2 text-xs text-white/50">
                      {[business.address, business.postcode]
                        .filter(Boolean)
                        .join(", ")}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2 py-1 text-[10px] font-semibold text-yellow-400">
                      {business.sponsor_label ?? "Featured"}
                    </span>

                    {business.is_verified ? (
                      <span className="rounded-full border border-green-500/30 bg-green-500/10 px-2 py-1 text-[10px] font-semibold text-green-300">
                        Verified
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {business.slug ? (
                    <BusinessTrackedLink
                      businessId={business.id}
                      href={`/business/${business.slug}`}
                      eventType="profile_click"
                      source="featured_business_card"
                      pageType="mosque_featured_businesses"
                      className="rounded-xl bg-yellow-500 px-3 py-2 text-xs font-semibold text-black hover:bg-yellow-400"
                      metadata={{
                        mosque_id: mosqueId,
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
                      rel="noreferrer"
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10"
                      metadata={{
                        mosque_id: mosqueId,
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
                      rel="noreferrer"
                      className="rounded-xl border border-yellow-500/30 bg-black px-3 py-2 text-xs font-semibold text-yellow-400 hover:bg-yellow-500/10"
                      metadata={{
                        mosque_id: mosqueId,
                      }}
                    >
                      Maps
                    </BusinessTrackedLink>
                  ) : null}

                  {business.phone ? (
                    <BusinessTrackedLink
                      businessId={business.id}
                      href={`tel:${business.phone}`}
                      eventType="phone_click"
                      source="featured_business_card"
                      pageType="mosque_featured_businesses"
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10"
                      metadata={{
                        mosque_id: mosqueId,
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

      {!loading && !err && items.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4 text-xs text-white/60">
          No featured businesses yet.
        </div>
      ) : null}
    </section>
  );
}

