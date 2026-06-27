import BusinessTrackedLink from "@/components/BusinessTrackedLink";
import BusinessSponsorImpressionTracker from "@/components/BusinessSponsorImpressionTracker";

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

function formatLabel(value: string | null | undefined) {
  if (!value) {
    return null;
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

function isPaidActive(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  const time = new Date(value).getTime();

  return Number.isFinite(time) && time > Date.now();
}

function getCardImage(business: BusinessCard) {
  return (
    business.cover_image_url ||
    business.logo_url ||
    business.gallery_urls?.[0] ||
    null
  );
}

export default function MosqueBusinessSponsors({
  businesses,
  title,
  description,
  mosqueId,
  mosqueSlug,
  citySlug,
}: Props) {
  const safeMosqueId = mosqueId ?? undefined;
  const safeMosqueSlug = mosqueSlug ?? undefined;
  const safeCitySlug = citySlug ?? undefined;

  return (
    <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
            Mosque Sponsors
          </div>

          <h2 className="mt-2 text-2xl font-black text-white">
            {title}
          </h2>

          <p className="mt-2 max-w-3xl text-white/70">
            {description}
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
            className="rounded-xl bg-yellow-500 px-5 py-3 text-sm font-bold text-black hover:bg-yellow-400"
            metadata={{
              mosque_id: safeMosqueId,
              mosque_slug: safeMosqueSlug,
            }}
          >
            Sponsor this mosque
          </BusinessTrackedLink>
        ) : null}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {businesses.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/30 p-6 text-white/60 md:col-span-2 xl:col-span-3">
            No businesses found nearby yet.
          </div>
        ) : (
          businesses.map((business, index) => {
            const cardImage = getCardImage(business);
            const websiteUrl = normaliseExternalUrl(business.website);
            const mapsUrl = normaliseExternalUrl(business.maps_url);
            const paidActive = isPaidActive(business.paid_until);

            const premium =
              paidActive &&
              Boolean(
                business.featured ||
                  business.sponsor_mosque_id === safeMosqueId ||
                  business.pricing_tier !== "free"
              );

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
                  mosque_slug: safeMosqueSlug,
                  sponsor_mosque_id: business.sponsor_mosque_id,
                  }}
                />
                {cardImage ? (
                  <div className="relative h-40 overflow-hidden">
                    <img
                      src={cardImage}
                      alt={`${business.name ?? "Business"} image`}
                      className="h-full w-full object-cover"
                    />

                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

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
                  <div className="mb-3 flex flex-wrap gap-2">
                    {business.sponsor_mosque_id === safeMosqueId ? (
                      <Badge>Sponsor</Badge>
                    ) : null}

                    {business.featured ? <Badge>Featured</Badge> : null}

                    {index < 3 && premium ? (
                      <Badge>Top Placement</Badge>
                    ) : null}

                    {business.is_verified ? (
                      <Badge variant="green">Verified</Badge>
                    ) : null}

                    {business.pricing_tier &&
                    business.pricing_tier !== "free" ? (
                      <Badge>{formatLabel(business.pricing_tier)}</Badge>
                    ) : null}
                  </div>

                  {business.slug ? (
                    <BusinessTrackedLink
                      businessId={business.id}
                      href={`/business/${business.slug}`}
                      eventType="profile_click"
                      source="mosque_business_sponsors"
                      pageType="mosque_page"
                      citySlug={safeCitySlug}
                      className="text-lg font-bold text-white hover:text-yellow-400"
                      metadata={{
                        mosque_id: safeMosqueId,
                        mosque_slug: safeMosqueSlug,
                      }}
                    >
                      {business.name ?? "Unnamed business"}
                    </BusinessTrackedLink>
                  ) : (
                    <div className="text-lg font-bold text-white">
                      {business.name ?? "Unnamed business"}
                    </div>
                  )}

                  <div className="mt-2 text-sm text-white/60">
                    {[
                      formatLabel(business.category) ?? "Business",
                      business.area,
                      business.city,
                    ]
                      .filter(Boolean)
                      .join(" • ")}
                  </div>

                  {business.address || business.postcode ? (
                    <div className="mt-2 text-xs text-white/50">
                      {[business.address, business.postcode]
                        .filter(Boolean)
                        .join(" • ")}
                    </div>
                  ) : null}

                  {typeof business.featured_rank === "number" ? (
                    <div className="mt-3 text-xs text-white/40">
                      Placement rank #{business.featured_rank}
                    </div>
                  ) : null}

                  <div className="mt-5 flex flex-wrap gap-2">
                    {business.slug ? (
                      <BusinessTrackedLink
                        businessId={business.id}
                        href={`/business/${business.slug}`}
                        eventType="profile_click"
                        source="mosque_business_sponsors"
                        pageType="mosque_page"
                        citySlug={safeCitySlug}
                        className="rounded-xl bg-yellow-500 px-4 py-2 text-xs font-bold text-black hover:bg-yellow-400"
                        metadata={{
                          mosque_id: safeMosqueId,
                          mosque_slug: safeMosqueSlug,
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
                        rel="noreferrer"
                        className="rounded-xl border border-white/10 bg-black px-4 py-2 text-xs font-bold text-white hover:border-yellow-500/30"
                        metadata={{
                          mosque_id: safeMosqueId,
                          mosque_slug: safeMosqueSlug,
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
                        rel="noreferrer"
                        className="rounded-xl border border-yellow-500/30 bg-black px-4 py-2 text-xs font-bold text-yellow-400 hover:bg-yellow-500/10"
                        metadata={{
                          mosque_id: safeMosqueId,
                          mosque_slug: safeMosqueSlug,
                        }}
                      >
                        Map
                      </BusinessTrackedLink>
                    ) : null}

                    {business.phone ? (
                      <BusinessTrackedLink
                        businessId={business.id}
                        href={`tel:${business.phone}`}
                        eventType="phone_click"
                        source="mosque_business_sponsors"
                        pageType="mosque_page"
                        citySlug={safeCitySlug}
                        className="rounded-xl border border-white/10 bg-black px-4 py-2 text-xs font-bold text-white hover:border-yellow-500/30"
                        metadata={{
                          mosque_id: safeMosqueId,
                          mosque_slug: safeMosqueSlug,
                        }}
                      >
                        Call
                      </BusinessTrackedLink>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
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
      className={`rounded-full border px-3 py-1 text-[10px] font-semibold ${className}`}
    >
      {children}
    </span>
  );
}

