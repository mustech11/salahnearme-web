import type { ReactNode } from "react";

import BusinessSponsorImpressionTracker from "@/components/BusinessSponsorImpressionTracker";
import BusinessTrackedLink from "@/components/BusinessTrackedLink";

type BusinessCard = {
  id: string;
  name: string | null;
  slug: string | null;
  category: string | null;
  city: string | null;
  area?: string | null;
  address?: string | null;
  postcode?: string | null;
  featured: boolean | null;
  featured_rank?: number | null;
  website: string | null;
  maps_url: string | null;
  phone?: string | null;
  pricing_tier?: string | null;
  paid_until?: string | null;
  is_verified?: boolean | null;
  sponsor_mosque_id?: string | null;
  logo_url?: string | null;
  cover_image_url?: string | null;
  gallery_urls?: string[] | null;
};

type Props = {
  businesses: BusinessCard[];
  title: string;
  description: string;
  mosqueId?: string | null;
  mosqueSlug?: string | null;
  citySlug?: string | null;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SLUG_REGEX =
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function cleanText(
  value: string | null | undefined
): string | null {
  const cleaned = value?.trim();

  return cleaned ? cleaned : null;
}

function formatLabel(
  value: string | null | undefined
): string | null {
  const cleaned = cleanText(value);

  if (!cleaned) {
    return null;
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
  const cleaned = cleanText(value);

  if (!cleaned) {
    return null;
  }

  const candidate = /^https?:\/\//i.test(
    cleaned
  )
    ? cleaned
    : `https://${cleaned}`;

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

function normalisePhone(
  value: string | null | undefined
): string | null {
  const cleaned = cleanText(value);

  if (!cleaned) {
    return null;
  }

  const phone = cleaned.replace(
    /[^\d+]/g,
    ""
  );

  return phone.length >= 6 ? phone : null;
}

function isPaidActive(
  value: string | null | undefined
): boolean {
  if (!value) {
    return false;
  }

  const time = new Date(value).getTime();

  return (
    Number.isFinite(time) &&
    time > Date.now()
  );
}

function getCardImage(
  business: BusinessCard
): string | null {
  const candidates = [
    business.cover_image_url,
    business.logo_url,
    ...(business.gallery_urls ?? []),
  ];

  for (const candidate of candidates) {
    const url =
      normaliseExternalUrl(candidate);

    if (url) {
      return url;
    }
  }

  return null;
}

function getSafeBusinesses(
  businesses: BusinessCard[]
): BusinessCard[] {
  const seen = new Set<string>();

  return businesses.filter((business) => {
    if (
      !UUID_REGEX.test(business.id) ||
      seen.has(business.id)
    ) {
      return false;
    }

    seen.add(business.id);
    return true;
  });
}

export default function MosqueBusinessSponsors({
  businesses,
  title,
  description,
  mosqueId,
  mosqueSlug,
  citySlug,
}: Props) {
  const safeMosqueId =
    mosqueId && UUID_REGEX.test(mosqueId)
      ? mosqueId
      : undefined;

  const safeMosqueSlug =
    mosqueSlug &&
    SLUG_REGEX.test(mosqueSlug)
      ? mosqueSlug
      : undefined;

  const safeCitySlug =
    citySlug && SLUG_REGEX.test(citySlug)
      ? citySlug
      : undefined;

  const safeBusinesses =
    getSafeBusinesses(businesses);

  return (
    <section
      aria-labelledby="mosque-sponsors-heading"
      className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6 md:p-8"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
            Mosque sponsors
          </div>

          <h2
            id="mosque-sponsors-heading"
            className="mt-2 text-2xl font-black text-white"
          >
            {cleanText(title) ||
              "Businesses supporting this mosque"}
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/70">
            {cleanText(description) ||
              "Discover local halal businesses supporting the mosque community."}
          </p>
        </div>

        {safeMosqueSlug ? (
          <BusinessTrackedLink
            businessId="platform"
            href={`/sponsor/mosque/${safeMosqueSlug}`}
            eventType="sponsor_click"
            source="mosque_business_sponsors_header"
            pageType="mosque_page"
            citySlug={safeCitySlug}
            className="rounded-xl bg-yellow-500 px-5 py-3 text-sm font-bold text-black transition hover:bg-yellow-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"
            metadata={{
              mosque_id: safeMosqueId,
              mosque_slug: safeMosqueSlug,
            }}
          >
            Sponsor this mosque
          </BusinessTrackedLink>
        ) : null}
      </div>

      {safeBusinesses.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-6 text-sm text-white/60">
          No mosque sponsors or nearby businesses are
          available yet.
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {safeBusinesses.map(
            (business, index) => {
              const cardImage =
                getCardImage(business);

              const logoUrl =
                normaliseExternalUrl(
                  business.logo_url
                );

              const websiteUrl =
                normaliseExternalUrl(
                  business.website
                );

              const mapsUrl =
                normaliseExternalUrl(
                  business.maps_url
                );

              const phone =
                normalisePhone(business.phone);

              const paidActive =
                isPaidActive(
                  business.paid_until
                );

              const isSponsor =
                Boolean(
                  safeMosqueId &&
                    business.sponsor_mosque_id ===
                      safeMosqueId
                );

              const premium =
                paidActive &&
                Boolean(
                  business.featured ||
                    isSponsor ||
                    (business.pricing_tier &&
                      business.pricing_tier !==
                        "free")
                );

              const safeBusinessSlug =
                business.slug &&
                SLUG_REGEX.test(business.slug)
                  ? business.slug
                  : null;

              const location = [
                cleanText(business.area),
                cleanText(business.city),
              ]
                .filter(Boolean)
                .join(" • ");

              const address = [
                cleanText(business.address),
                cleanText(business.postcode),
              ]
                .filter(Boolean)
                .join(" • ");

              return (
                <article
                  key={business.id}
                  className={`overflow-hidden rounded-3xl border transition ${
                    premium
                      ? "border-yellow-500/40 bg-yellow-500/[0.04] shadow-[0_0_35px_rgba(212,175,55,0.08)]"
                      : "border-yellow-500/20 bg-black/30 hover:border-yellow-400/40"
                  }`}
                >
                  <BusinessSponsorImpressionTracker
                    businessId={business.id}
                    source="mosque_business_sponsors"
                    pageType="mosque_page"
                    citySlug={safeCitySlug}
                    metadata={{
                      mosque_id: safeMosqueId,
                      mosque_slug:
                        safeMosqueSlug,
                      sponsor_mosque_id:
                        business.sponsor_mosque_id,
                    }}
                  />

                  {cardImage ? (
                    <div className="relative h-40 overflow-hidden bg-black">
                      <img
                        src={cardImage}
                        alt={`${cleanText(
                          business.name
                        ) ?? "Business"} image`}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover"
                      />

                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

                      {logoUrl &&
                      business.cover_image_url ? (
                        <img
                          src={logoUrl}
                          alt={`${cleanText(
                            business.name
                          ) ?? "Business"} logo`}
                          loading="lazy"
                          decoding="async"
                          className="absolute bottom-3 left-3 h-14 w-14 rounded-2xl border border-yellow-500/30 bg-black object-cover p-1"
                        />
                      ) : null}
                    </div>
                  ) : null}

                  <div className="p-5">
                    <div className="mb-3 flex flex-wrap gap-2">
                      {isSponsor ? (
                        <Badge>
                          Mosque sponsor
                        </Badge>
                      ) : null}

                      {business.featured &&
                      paidActive ? (
                        <Badge>
                          Featured
                        </Badge>
                      ) : null}

                      {index < 3 && premium ? (
                        <Badge>
                          Top placement
                        </Badge>
                      ) : null}

                      {business.is_verified ? (
                        <Badge variant="green">
                          Verified
                        </Badge>
                      ) : null}

                      {business.pricing_tier &&
                      business.pricing_tier !==
                        "free" ? (
                        <Badge>
                          {formatLabel(
                            business.pricing_tier
                          )}
                        </Badge>
                      ) : null}
                    </div>

                    {safeBusinessSlug ? (
                      <BusinessTrackedLink
                        businessId={business.id}
                        href={`/business/${safeBusinessSlug}`}
                        eventType="profile_click"
                        source="mosque_business_sponsors"
                        pageType="mosque_page"
                        citySlug={safeCitySlug}
                        className="text-lg font-bold text-white transition hover:text-yellow-400"
                        metadata={{
                          mosque_id:
                            safeMosqueId,
                          mosque_slug:
                            safeMosqueSlug,
                        }}
                      >
                        {cleanText(
                          business.name
                        ) ?? "Unnamed business"}
                      </BusinessTrackedLink>
                    ) : (
                      <div className="text-lg font-bold text-white">
                        {cleanText(
                          business.name
                        ) ?? "Unnamed business"}
                      </div>
                    )}

                    <div className="mt-2 text-sm text-white/60">
                      {[
                        formatLabel(
                          business.category
                        ) ?? "Business",
                        location,
                      ]
                        .filter(Boolean)
                        .join(" • ")}
                    </div>

                    {address ? (
                      <div className="mt-2 text-xs leading-5 text-white/50">
                        {address}
                      </div>
                    ) : null}

                    {typeof business.featured_rank ===
                      "number" &&
                    Number.isFinite(
                      business.featured_rank
                    ) ? (
                      <div className="mt-3 text-xs text-white/40">
                        Placement rank #
                        {Math.max(
                          0,
                          Math.trunc(
                            business.featured_rank
                          )
                        )}
                      </div>
                    ) : null}

                    <div className="mt-5 flex flex-wrap gap-2">
                      {safeBusinessSlug ? (
                        <BusinessTrackedLink
                          businessId={business.id}
                          href={`/business/${safeBusinessSlug}`}
                          eventType="profile_click"
                          source="mosque_business_sponsors"
                          pageType="mosque_page"
                          citySlug={safeCitySlug}
                          className="rounded-xl bg-yellow-500 px-4 py-2 text-xs font-bold text-black transition hover:bg-yellow-400"
                          metadata={{
                            mosque_id:
                              safeMosqueId,
                            mosque_slug:
                              safeMosqueSlug,
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
                          source="mosque_business_sponsors"
                          pageType="mosque_page"
                          citySlug={safeCitySlug}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-xl border border-white/10 bg-black px-4 py-2 text-xs font-bold text-white transition hover:border-yellow-500/30"
                          metadata={{
                            mosque_id:
                              safeMosqueId,
                            mosque_slug:
                              safeMosqueSlug,
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
                          source="mosque_business_sponsors"
                          pageType="mosque_page"
                          citySlug={safeCitySlug}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-xl border border-yellow-500/30 bg-black px-4 py-2 text-xs font-bold text-yellow-400 transition hover:bg-yellow-500/10"
                          metadata={{
                            mosque_id:
                              safeMosqueId,
                            mosque_slug:
                              safeMosqueSlug,
                          }}
                        >
                          Map
                        </BusinessTrackedLink>
                      ) : null}

                      {phone ? (
                        <BusinessTrackedLink
                          businessId={business.id}
                          href={`tel:${phone}`}
                          eventType="phone_click"
                          source="mosque_business_sponsors"
                          pageType="mosque_page"
                          citySlug={safeCitySlug}
                          className="rounded-xl border border-white/10 bg-black px-4 py-2 text-xs font-bold text-white transition hover:border-yellow-500/30"
                          metadata={{
                            mosque_id:
                              safeMosqueId,
                            mosque_slug:
                              safeMosqueSlug,
                          }}
                        >
                          Call
                        </BusinessTrackedLink>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            }
          )}
        </div>
      )}
    </section>
  );
}

function Badge({
  children,
  variant = "default",
}: {
  children: ReactNode;
  variant?: "default" | "green";
}) {
  const className =
    variant === "green"
      ? "border-green-500/30 bg-green-500/10 text-green-300"
      : "border-yellow-500/30 bg-yellow-500/10 text-yellow-400";

  return (
    <span
      className={`rounded-full border px-3 py-1 text-[10px] font-semibold ${className}`}
    >
      {children}
    </span>
  );
}