"use client";

import { useMemo, useState } from "react";

import BusinessTrackedLink from "@/components/BusinessTrackedLink";

type Business = {
  id: string;
  name: string | null;
  slug: string | null;
  category: string | null;
  city: string | null;
  area: string | null;
  address: string | null;
  postcode: string | null;
  phone: string | null;
  website: string | null;
  maps_url: string | null;
  logo_url?: string | null;
  cover_image_url?: string | null;
  gallery_urls?: string[] | null;
  latitude: number | null;
  longitude: number | null;
  is_verified: boolean | null;
  featured: boolean | null;
  pricing_tier: string | null;
  halal_confidence: string | null;
  halal_score: number | null;
  distance_meters: number | null;
};

type ApiResponse = {
  ok?: boolean;
  count?: number;
  businesses?: Business[];
  error?: string;
};

function distanceMiles(meters: number | null) {
  if (meters === null) {
    return "—";
  }

  return `${(meters / 1609.344).toFixed(1)} miles`;
}

function categoryLabel(value: string | null) {
  if (!value) {
    return "Halal business";
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

function getCardImage(business: Business) {
  return (
    business.cover_image_url ||
    business.logo_url ||
    business.gallery_urls?.[0] ||
    null
  );
}

function categoryMatches(category: string | null, filter: string) {
  if (filter === "all") {
    return true;
  }

  const value = (category ?? "").toLowerCase();

  if (filter === "restaurant") {
    return (
      value.includes("restaurant") ||
      value.includes("food") ||
      value.includes("takeaway") ||
      value.includes("cafe")
    );
  }

  if (filter === "butcher") {
    return value.includes("butcher");
  }

  if (filter === "grocery") {
    return value.includes("grocery") || value.includes("supermarket");
  }

  if (filter === "shop") {
    return (
      value.includes("book") ||
      value.includes("clothing") ||
      value.includes("shop") ||
      value.includes("business")
    );
  }

  return true;
}

export default function NearMeHalalBusinessesClient() {
  const [loading, setLoading] = useState(false);
  const [radius, setRadius] = useState("5000");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  function getPosition(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Location is not supported on this device."));
        return;
      }

      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 300000,
      });
    });
  }

  async function findBusinesses() {
    try {
      setLoading(true);
      setErrorMessage("");
      setBusinesses([]);

      const position = await getPosition();

      const params = new URLSearchParams({
        lat: String(position.coords.latitude),
        lng: String(position.coords.longitude),
        radius,
        limit: "60",
      });

      const res = await fetch(`/api/businesses/near?${params.toString()}`, {
        cache: "no-store",
      });

      const data = (await res.json().catch(() => ({}))) as ApiResponse;

      if (!res.ok || !data.ok) {
        setErrorMessage(data.error ?? "Could not find nearby businesses.");
        return;
      }

      setBusinesses(data.businesses ?? []);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Location access failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  const filteredBusinesses = useMemo(() => {
    return businesses.filter((business) =>
      categoryMatches(business.category, categoryFilter)
    );
  }, [businesses, categoryFilter]);

  const topPicks = useMemo(() => {
    return filteredBusinesses
      .filter((business) => business.halal_confidence === "high")
      .slice(0, 3);
  }, [filteredBusinesses]);

  return (
    <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
      <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
        Halal Businesses Near Me
      </div>

      <h2 className="mt-3 text-3xl font-bold text-white">
        Find halal food and Muslim-friendly businesses nearby
      </h2>

      <p className="mt-3 max-w-3xl text-white/70">
        Use your current location to find nearby halal restaurants, butchers,
        groceries, Islamic shops, and trusted Muslim community businesses.
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
        <div>
          <label className="text-sm font-semibold text-yellow-400">
            Search radius
          </label>

          <select
            value={radius}
            onChange={(e) => setRadius(e.target.value)}
            className="mt-2 w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none"
          >
            <option value="2000">2 km</option>
            <option value="5000">5 km</option>
            <option value="10000">10 km</option>
            <option value="15000">15 km</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-semibold text-yellow-400">
            Category
          </label>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="mt-2 w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none"
          >
            <option value="all">All businesses</option>
            <option value="restaurant">Restaurants & takeaways</option>
            <option value="grocery">Groceries & supermarkets</option>
            <option value="butcher">Butchers</option>
            <option value="shop">Islamic shops</option>
          </select>
        </div>

        <div className="flex items-end">
          <button
            type="button"
            onClick={findBusinesses}
            disabled={loading}
            className="w-full rounded-2xl bg-yellow-500 px-6 py-3 font-semibold text-black transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-50 lg:w-auto"
          >
            {loading ? "Searching..." : "Find businesses near me"}
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-yellow-500/20 bg-black/30 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-lg font-semibold text-yellow-400">
              Own a halal business?
            </div>

            <p className="mt-1 text-sm text-white/60">
              Promote your business near mosques, city pages, and travel
              searches.
            </p>
          </div>

          <BusinessTrackedLink
            businessId="platform"
            href="/advertise"
            eventType="sponsor_click"
            source="near_me_halal_businesses"
            pageType="near_me"
            className="rounded-xl bg-yellow-500 px-4 py-3 text-sm font-semibold text-black hover:bg-yellow-400"
          >
            Promote your business
          </BusinessTrackedLink>
        </div>
      </div>

      {errorMessage ? (
        <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {errorMessage}
        </div>
      ) : null}

      {!loading && businesses.length === 0 && !errorMessage ? (
        <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-5 text-white/60">
          No search yet. Click the button above to find nearby halal businesses.
        </div>
      ) : null}

      {topPicks.length > 0 ? (
        <div className="mt-8">
          <div className="text-xl font-semibold text-yellow-400">
            Top picks near you
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {topPicks.map((business) => (
              <BusinessCard
                key={business.id}
                business={business}
                topPick
              />
            ))}
          </div>
        </div>
      ) : null}

      {filteredBusinesses.length > 0 ? (
        <div className="mt-8">
          <div className="mb-4 text-lg font-semibold text-yellow-400">
            Found {filteredBusinesses.length} nearby businesses
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredBusinesses.map((business) => (
              <BusinessCard key={business.id} business={business} />
            ))}
          </div>
        </div>
      ) : null}

      {businesses.length > 0 && filteredBusinesses.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-5 text-white/60">
          No businesses match this filter. Try another category.
        </div>
      ) : null}
    </section>
  );
}

function BusinessCard({
  business,
  topPick = false,
}: {
  business: Business;
  topPick?: boolean;
}) {
  const cardImage = getCardImage(business);
  const websiteUrl = normaliseExternalUrl(business.website);
  const mapsUrl = normaliseExternalUrl(business.maps_url);

  return (
    <article
      className={`overflow-hidden rounded-2xl border ${
        topPick
          ? "border-yellow-500/40 bg-yellow-500/[0.06]"
          : "border-yellow-500/20 bg-black/30"
      }`}
    >
      {cardImage ? (
        <div className="relative h-36 overflow-hidden">
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
              className="absolute bottom-3 left-3 h-14 w-14 rounded-2xl border border-yellow-500/30 bg-black object-cover p-1"
            />
          ) : null}
        </div>
      ) : null}

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            {business.slug ? (
              <BusinessTrackedLink
                businessId={business.id}
                href={`/business/${business.slug}`}
                eventType="profile_click"
                source="near_me_halal_businesses"
                pageType="near_me"
                className="text-lg font-semibold text-white hover:text-yellow-400"
              >
                {business.name ?? "Unnamed business"}
              </BusinessTrackedLink>
            ) : (
              <div className="text-lg font-semibold text-white">
                {business.name ?? "Unnamed business"}
              </div>
            )}

            <div className="mt-1 text-sm text-white/60">
              {categoryLabel(business.category)}
            </div>
          </div>

          <div className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-400">
            {distanceMiles(business.distance_meters)}
          </div>
        </div>

        <div className="mt-4 text-sm text-white/70">
          {[business.area, business.city, business.postcode]
            .filter(Boolean)
            .join(" • ")}
        </div>

        {business.address ? (
          <div className="mt-2 text-sm text-white/60">
            {business.address}
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {topPick ? (
            <Badge>Top pick</Badge>
          ) : null}

          {business.is_verified ? (
            <Badge variant="green">Verified</Badge>
          ) : null}

          {business.featured ? (
            <Badge>Sponsored</Badge>
          ) : null}

          {business.halal_confidence ? (
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/70">
              {business.halal_confidence} confidence
            </span>
          ) : null}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {business.slug ? (
            <BusinessTrackedLink
              businessId={business.id}
              href={`/business/${business.slug}`}
              eventType="profile_click"
              source="near_me_halal_businesses"
              pageType="near_me"
              className="rounded-xl bg-yellow-500 px-4 py-2 text-sm font-semibold text-black hover:bg-yellow-400"
            >
              View
            </BusinessTrackedLink>
          ) : null}

          {mapsUrl ? (
            <BusinessTrackedLink
              businessId={business.id}
              href={mapsUrl}
              eventType="maps_click"
              source="near_me_halal_businesses"
              pageType="near_me"
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-yellow-500/30 bg-black px-4 py-2 text-sm font-semibold text-yellow-400 hover:bg-yellow-500/10"
            >
              Map
            </BusinessTrackedLink>
          ) : null}

          {websiteUrl ? (
            <BusinessTrackedLink
              businessId={business.id}
              href={websiteUrl}
              eventType="website_click"
              source="near_me_halal_businesses"
              pageType="near_me"
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-white/10 bg-black px-4 py-2 text-sm font-semibold text-white hover:border-yellow-500/30"
            >
              Website
            </BusinessTrackedLink>
          ) : null}

          {business.phone ? (
            <BusinessTrackedLink
              businessId={business.id}
              href={`tel:${business.phone}`}
              eventType="phone_click"
              source="near_me_halal_businesses"
              pageType="near_me"
              className="rounded-xl border border-white/10 bg-black px-4 py-2 text-sm font-semibold text-white hover:border-yellow-500/30"
            >
              Call
            </BusinessTrackedLink>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function Badge({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "green";
}) {
  const className =
    variant === "green"
      ? "border-green-500/30 bg-green-500/10 text-green-300"
      : "border-yellow-500/30 bg-yellow-500/10 text-yellow-400";

  return (
    <span
      className={`rounded-full border px-2 py-1 text-xs font-semibold ${className}`}
    >
      {children}
    </span>
  );
}

