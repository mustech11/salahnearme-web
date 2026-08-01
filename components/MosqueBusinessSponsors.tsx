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

type IconName =
  | "arrow"
  | "call"
  | "check"
  | "map"
  | "shield"
  | "sparkles"
  | "star"
  | "store"
  | "website";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SLUG_REGEX =
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const MAX_TEXT_LENGTH = 500;
const MAX_URL_LENGTH = 2_000;
const MAX_BUSINESSES = 12;

function cleanText(
  value: string | null | undefined,
  maxLength = MAX_TEXT_LENGTH
): string | null {
  const cleaned = String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

  return cleaned || null;
}

function formatLabel(
  value: string | null | undefined
): string | null {
  const cleaned = cleanText(value, 100);

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
  const cleaned = cleanText(
    value,
    MAX_URL_LENGTH
  );

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
  const cleaned = cleanText(value, 80);

  if (!cleaned) {
    return null;
  }

  const phone = cleaned.replace(
    /[^\d+*#]/g,
    ""
  );

  return phone.length >= 6 ? phone : null;
}

function isPaidActive(
  value: string | null | undefined
): boolean {
  const cleaned = cleanText(value, 100);

  if (!cleaned) {
    return false;
  }

  const time = new Date(cleaned).getTime();

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

  return businesses
    .filter((business) => {
      if (
        !UUID_REGEX.test(business.id) ||
        seen.has(business.id)
      ) {
        return false;
      }

      seen.add(business.id);
      return true;
    })
    .slice(0, MAX_BUSINESSES);
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

  const sponsorCount =
    safeBusinesses.filter(
      (business) =>
        Boolean(
          safeMosqueId &&
            business.sponsor_mosque_id ===
              safeMosqueId
        )
    ).length;

  const verifiedCount =
    safeBusinesses.filter(
      (business) =>
        business.is_verified === true
    ).length;

  const premiumCount =
    safeBusinesses.filter(
      (business) =>
        isPaidActive(
          business.paid_until
        ) &&
        Boolean(
          business.featured ||
            (business.pricing_tier &&
              business.pricing_tier !==
                "free")
        )
    ).length;

  return (
    <section
      aria-labelledby="mosque-sponsors-heading"
      className="luxe-card relative isolate overflow-hidden rounded-[2rem] border border-yellow-500/20 p-6 sm:p-8"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,0.12),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.05),transparent_28%)]"
      />

      <div className="flex flex-col gap-6 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-yellow-300">
            <Icon
              name="star"
              className="h-4 w-4"
            />
            Mosque sponsors
          </div>

          <h2
            id="mosque-sponsors-heading"
            className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl"
          >
            {cleanText(title, 180) ||
              "Businesses supporting this mosque"}
          </h2>

          <p className="mt-3 max-w-3xl text-sm leading-7 text-white/60 sm:text-base">
            {cleanText(description, 700) ||
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
            className="luxe-button inline-flex min-h-11 shrink-0 items-center justify-center px-5 py-3 text-sm"
            metadata={{
              mosque_id: safeMosqueId,
              mosque_slug: safeMosqueSlug,
            }}
          >
            <Icon
              name="sparkles"
              className="mr-2 h-4 w-4"
            />
            Sponsor this mosque
          </BusinessTrackedLink>
        ) : null}
      </div>

      {safeBusinesses.length > 0 ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Metric
            label="Active listings"
            value={safeBusinesses.length}
            helper="Shown in this section"
            icon="store"
          />

          <Metric
            label="Mosque sponsors"
            value={sponsorCount}
            helper="Direct profile supporters"
            icon="star"
          />

          <Metric
            label="Verified"
            value={verifiedCount}
            helper={`${premiumCount} premium placement${
              premiumCount === 1 ? "" : "s"
            }`}
            icon="check"
          />
        </div>
      ) : null}

      {safeBusinesses.length === 0 ? (
        <EmptySponsorsState
          mosqueSlug={safeMosqueSlug}
          citySlug={safeCitySlug}
        />
      ) : (
        <>
          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
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
                  normalisePhone(
                    business.phone
                  );

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
                  SLUG_REGEX.test(
                    business.slug
                  )
                    ? business.slug
                    : null;

                const name =
                  cleanText(
                    business.name,
                    200
                  ) ?? "Unnamed business";

                const category =
                  formatLabel(
                    business.category
                  ) ?? "Halal business";

                const location = [
                  cleanText(
                    business.area,
                    160
                  ),
                  cleanText(
                    business.city,
                    160
                  ),
                ]
                  .filter(Boolean)
                  .join(" • ");

                const address = [
                  cleanText(
                    business.address,
                    300
                  ),
                  cleanText(
                    business.postcode,
                    40
                  ),
                ]
                  .filter(Boolean)
                  .join(" • ");

                const showSeparateLogo =
                  Boolean(logoUrl) &&
                  Boolean(cardImage) &&
                  logoUrl !== cardImage;

                const metadata = {
                  mosque_id:
                    safeMosqueId,
                  mosque_slug:
                    safeMosqueSlug,
                  sponsor_mosque_id:
                    business.sponsor_mosque_id,
                  rank_position:
                    index + 1,
                  sponsored:
                    isSponsor,
                  premium,
                };

                return (
                  <article
                    key={business.id}
                    className={`group relative flex h-full flex-col overflow-hidden rounded-3xl border bg-black/25 transition duration-300 hover:-translate-y-1 ${
                      isSponsor
                        ? "border-yellow-400/45 shadow-[0_18px_55px_rgba(212,175,55,0.10)]"
                        : premium
                          ? "border-yellow-500/25 shadow-[0_16px_45px_rgba(0,0,0,0.22)]"
                          : "border-white/10 hover:border-yellow-500/30"
                    }`}
                  >
                    <BusinessSponsorImpressionTracker
                      businessId={business.id}
                      source="mosque_business_sponsors"
                      pageType="mosque_page"
                      citySlug={safeCitySlug}
                      metadata={metadata}
                    />

                    <div className="relative min-h-44 overflow-hidden border-b border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,0.14),transparent_40%),linear-gradient(135deg,rgba(255,255,255,0.04),rgba(0,0,0,0.16))]">
                      {cardImage ? (
                        <>
                          <img
                            src={cardImage}
                            alt={`${name} listing image`}
                            loading="lazy"
                            decoding="async"
                            referrerPolicy="no-referrer"
                            className="h-44 w-full object-cover transition duration-500 group-hover:scale-[1.035]"
                          />

                          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                        </>
                      ) : (
                        <div className="flex h-44 items-center justify-center">
                          <span className="flex h-20 w-20 items-center justify-center rounded-3xl border border-yellow-500/20 bg-yellow-500/[0.08] text-yellow-300">
                            <Icon
                              name="store"
                              className="h-10 w-10"
                            />
                          </span>
                        </div>
                      )}

                      <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                        {isSponsor ? (
                          <Badge
                            variant="gold"
                            icon="star"
                          >
                            Mosque sponsor
                          </Badge>
                        ) : null}

                        {!isSponsor &&
                        business.featured &&
                        paidActive ? (
                          <Badge
                            variant="gold"
                            icon="sparkles"
                          >
                            Featured
                          </Badge>
                        ) : null}

                        {business.is_verified ? (
                          <Badge
                            variant="green"
                            icon="check"
                          >
                            Verified
                          </Badge>
                        ) : null}
                      </div>

                      {showSeparateLogo ? (
                        <img
                          src={logoUrl ?? ""}
                          alt={`${name} logo`}
                          loading="lazy"
                          decoding="async"
                          referrerPolicy="no-referrer"
                          className="absolute bottom-4 left-4 h-16 w-16 rounded-2xl border border-white/15 bg-black object-cover p-1 shadow-xl"
                        />
                      ) : null}

                      <span className="absolute bottom-4 right-4 rounded-full border border-white/15 bg-black/75 px-3 py-1.5 text-[0.7rem] font-black text-white/70 backdrop-blur">
                        #{index + 1}
                      </span>
                    </div>

                    <div className="flex flex-1 flex-col p-5">
                      <div className="text-[0.65rem] font-black uppercase tracking-[0.17em] text-yellow-300">
                        {category}
                      </div>

                      {safeBusinessSlug ? (
                        <BusinessTrackedLink
                          businessId={business.id}
                          href={`/business/${safeBusinessSlug}`}
                          eventType="profile_click"
                          source="mosque_business_sponsors"
                          pageType="mosque_page"
                          citySlug={safeCitySlug}
                          className="mt-2 block break-words text-xl font-black tracking-tight text-white transition hover:text-yellow-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"
                          metadata={metadata}
                        >
                          {name}
                        </BusinessTrackedLink>
                      ) : (
                        <h3 className="mt-2 break-words text-xl font-black tracking-tight text-white">
                          {name}
                        </h3>
                      )}

                      {location ? (
                        <p className="mt-2 text-sm text-white/50">
                          {location}
                        </p>
                      ) : null}

                      {address ? (
                        <div
                          dir="auto"
                          className="mt-4 rounded-2xl border border-white/10 bg-white/[0.025] p-3 text-xs leading-6 text-white/55"
                        >
                          {address}
                        </div>
                      ) : null}

                      <div className="mt-4 flex flex-wrap gap-2">
                        {business.pricing_tier &&
                        business.pricing_tier !==
                          "free" ? (
                          <Badge variant="default">
                            {formatLabel(
                              business.pricing_tier
                            )}
                          </Badge>
                        ) : null}

                        {typeof business.featured_rank ===
                          "number" &&
                        Number.isFinite(
                          business.featured_rank
                        ) ? (
                          <Badge variant="default">
                            Placement #
                            {Math.max(
                              0,
                              Math.trunc(
                                business.featured_rank
                              )
                            )}
                          </Badge>
                        ) : null}
                      </div>

                      <div className="mt-auto pt-5">
                        <div className="grid grid-cols-2 gap-2">
                          {safeBusinessSlug ? (
                            <BusinessTrackedLink
                              businessId={business.id}
                              href={`/business/${safeBusinessSlug}`}
                              eventType="profile_click"
                              source="mosque_business_sponsors"
                              pageType="mosque_page"
                              citySlug={safeCitySlug}
                              className="col-span-2 inline-flex min-h-11 items-center justify-center rounded-xl border border-yellow-400/30 bg-yellow-500/15 px-4 py-2 text-sm font-black text-yellow-100 transition hover:bg-yellow-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"
                              metadata={metadata}
                            >
                              View business profile
                              <Icon
                                name="arrow"
                                className="ml-2 h-4 w-4"
                              />
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
                              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-xs font-bold text-white/70 transition hover:border-yellow-500/30 hover:text-yellow-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"
                              metadata={metadata}
                            >
                              <Icon
                                name="map"
                                className="mr-2 h-4 w-4"
                              />
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
                              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-xs font-bold text-white/70 transition hover:border-yellow-500/30 hover:text-yellow-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"
                              metadata={metadata}
                            >
                              <Icon
                                name="call"
                                className="mr-2 h-4 w-4"
                              />
                              Call
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
                              className={`${mapsUrl && phone ? "col-span-2" : ""} inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-xs font-bold text-white/70 transition hover:border-yellow-500/30 hover:text-yellow-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300`}
                              metadata={metadata}
                            >
                              <Icon
                                name="website"
                                className="mr-2 h-4 w-4"
                              />
                              Website
                            </BusinessTrackedLink>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              }
            )}
          </div>

          <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-xs leading-6 text-white/40 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2">
              <Icon
                name="shield"
                className="mt-1 h-4 w-4 shrink-0"
              />

              <p>
                Sponsorship and premium placement
                improve visibility but do not replace
                your own halal checks or due
                diligence.
              </p>
            </div>

            {safeMosqueSlug ? (
              <BusinessTrackedLink
                businessId="platform"
                href={`/sponsor/mosque/${safeMosqueSlug}`}
                eventType="sponsor_click"
                source="mosque_business_sponsors_footer"
                pageType="mosque_page"
                citySlug={safeCitySlug}
                className="shrink-0 font-bold text-yellow-300 transition hover:text-yellow-200"
                metadata={{
                  mosque_id:
                    safeMosqueId,
                  mosque_slug:
                    safeMosqueSlug,
                }}
              >
                Become a sponsor →
              </BusinessTrackedLink>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}

function Metric({
  label,
  value,
  helper,
  icon,
}: {
  label: string;
  value: number;
  helper: string;
  icon: IconName;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-white/40">
            {label}
          </div>

          <div className="mt-2 text-2xl font-black text-white">
            {value}
          </div>

          <div className="mt-1 text-[0.7rem] leading-5 text-white/40">
            {helper}
          </div>
        </div>

        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-yellow-500/20 bg-yellow-500/[0.08] text-yellow-300">
          <Icon
            name={icon}
            className="h-5 w-5"
          />
        </span>
      </div>
    </article>
  );
}

function EmptySponsorsState({
  mosqueSlug,
  citySlug,
}: {
  mosqueSlug?: string;
  citySlug?: string;
}) {
  return (
    <div className="mt-6 rounded-3xl border border-dashed border-white/15 bg-black/20 p-6 sm:p-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex max-w-2xl items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-yellow-500/20 bg-yellow-500/[0.08] text-yellow-300">
            <Icon
              name="store"
              className="h-6 w-6"
            />
          </span>

          <div>
            <h3 className="text-lg font-black text-white">
              No sponsors are shown yet
            </h3>

            <p className="mt-2 text-sm leading-7 text-white/55">
              This mosque profile is ready for an
              approved local halal business to support
              it and reach nearby visitors.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {mosqueSlug ? (
            <BusinessTrackedLink
              businessId="platform"
              href={`/sponsor/mosque/${mosqueSlug}`}
              eventType="sponsor_click"
              source="mosque_business_sponsors_empty"
              pageType="mosque_page"
              citySlug={citySlug}
              className="luxe-button px-5 py-3 text-sm"
              metadata={{
                mosque_slug: mosqueSlug,
              }}
            >
              Sponsor this mosque
            </BusinessTrackedLink>
          ) : null}

          {citySlug ? (
            <a
              href={`/${citySlug}/businesses`}
              className="luxe-button-outline inline-flex min-h-11 items-center justify-center px-5 py-3 text-sm"
            >
              Browse city businesses
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Badge({
  children,
  variant = "default",
  icon,
}: {
  children: ReactNode;
  variant?: "default" | "gold" | "green";
  icon?: IconName;
}) {
  const className =
    variant === "green"
      ? "border-emerald-400/30 bg-emerald-500/20 text-emerald-100"
      : variant === "gold"
        ? "border-yellow-400/35 bg-yellow-500/20 text-yellow-100"
        : "border-white/10 bg-white/[0.045] text-white/60";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.65rem] font-black ${className}`}
    >
      {icon ? (
        <Icon
          name={icon}
          className="h-3.5 w-3.5"
        />
      ) : null}
      {children}
    </span>
  );
}

function Icon({
  name,
  className,
}: {
  name: IconName;
  className?: string;
}) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };

  if (name === "arrow") {
    return (
      <svg {...common}>
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
      </svg>
    );
  }

  if (name === "call") {
    return (
      <svg {...common}>
        <path d="M22 16.9v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.62 2.63a2 2 0 0 1-.45 2.11L8 9.73a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.85.29 1.73.5 2.63.62A2 2 0 0 1 22 16.9Z" />
      </svg>
    );
  }

  if (name === "check") {
    return (
      <svg {...common}>
        <path d="m5 12 4 4L19 6" />
      </svg>
    );
  }

  if (name === "map") {
    return (
      <svg {...common}>
        <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" />
        <path d="M9 3v15M15 6v15" />
      </svg>
    );
  }

  if (name === "shield") {
    return (
      <svg {...common}>
        <path d="M12 3 5 6v5c0 4.8 2.9 8.1 7 10 4.1-1.9 7-5.2 7-10V6l-7-3Z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    );
  }

  if (name === "sparkles") {
    return (
      <svg {...common}>
        <path d="m12 3-1.4 3.6L7 8l3.6 1.4L12 13l1.4-3.6L17 8l-3.6-1.4L12 3Z" />
        <path d="m5 14-.8 2.2L2 17l2.2.8L5 20l.8-2.2L8 17l-2.2-.8L5 14ZM19 13l-.7 1.8-1.8.7 1.8.7L19 18l.7-1.8 1.8-.7-1.8-.7L19 13Z" />
      </svg>
    );
  }

  if (name === "star") {
    return (
      <svg {...common}>
        <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2 7.5 14 3 9.6l6.2-.9L12 3Z" />
      </svg>
    );
  }

  if (name === "website") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M4 10h16v11H4z" />
      <path d="m3 10 2-5h14l2 5" />
      <path d="M8 10v11M16 10v11" />
      <path d="M9 15h6" />
    </svg>
  );
}