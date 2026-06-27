import type { Metadata } from "next";
import type { ReactNode } from "react";

import Link from "next/link";
import { notFound } from "next/navigation";

import BusinessAnalyticsTracker from "@/components/BusinessAnalyticsTracker";
import BusinessLeadForm from "@/components/BusinessLeadForm";
import BusinessOpeningHoursDisplay from "@/components/BusinessOpeningHoursDisplay";
import BusinessTrackedLink from "@/components/BusinessTrackedLink";
import { sortBusinessesByRank } from "@/lib/businessRanking";
import { supabasePublic } from "@/lib/supabaseServer";

export const revalidate = 300;

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

type BusinessRow = {
  id: string;
  name: string | null;
  slug: string | null;
  category: string | null;
  city: string | null;
  area: string | null;
  address: string | null;
  postcode: string | null;
  website: string | null;
  maps_url: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  email?: string | null;
  description: string | null;
  pricing_tier: string | null;
  subscription_type?: string | null;
  subscription_status?: string | null;
  billing_provider?: string | null;
  paid_until: string | null;
  is_verified: boolean | null;
  featured: boolean | null;
  featured_rank?: number | null;
  country: string | null;
  sponsor_mosque_id: string | null;
  sponsor_city_id?: number | null;
  sponsorship_active?: boolean | null;
  city_sponsor?: boolean | null;
  mosque_sponsor?: boolean | null;
  opening_hours?: Record<string, unknown> | null;
  opening_hours_note?: string | null;
  trust_score?: number | null;
  quality_score?: number | null;
  halal_score?: number | null;
  ranking_score?: number | null;
};

type CityRow = {
  id?: number;
  slug: string;
  name: string;
};

type SponsorMosqueRow = {
  id: string;
  name: string | null;
  slug: string | null;
  city: string | null;
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

function buildLocationLine(
  item: Pick<BusinessRow, "area" | "city" | "postcode">
) {
  return [item.area, item.city, item.postcode].filter(Boolean).join(" • ");
}

function isPaidActive(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  const time = new Date(value).getTime();

  return Number.isFinite(time) && time > Date.now();
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

function buildPlaceQuery(
  business: Pick<
    BusinessRow,
    "name" | "address" | "area" | "city" | "postcode" | "country"
  >
) {
  return [
    business.name,
    business.address,
    business.area,
    business.city,
    business.postcode,
    business.country,
  ]
    .filter(Boolean)
    .join(", ");
}

function buildGoogleMapsUrl(
  business: Pick<
    BusinessRow,
    | "maps_url"
    | "latitude"
    | "longitude"
    | "name"
    | "address"
    | "area"
    | "city"
    | "postcode"
    | "country"
  >
) {
  const savedMapsUrl = normaliseExternalUrl(business.maps_url);

  if (savedMapsUrl) {
    return savedMapsUrl;
  }

  if (
    typeof business.latitude === "number" &&
    typeof business.longitude === "number"
  ) {
    return `https://www.google.com/maps/search/?api=1&query=${business.latitude},${business.longitude}`;
  }

  const query = buildPlaceQuery(business);

  return query
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        query
      )}`
    : null;
}

function buildAppleMapsUrl(
  business: Pick<
    BusinessRow,
    | "latitude"
    | "longitude"
    | "name"
    | "address"
    | "area"
    | "city"
    | "postcode"
    | "country"
  >
) {
  const query = buildPlaceQuery(business);

  if (
    typeof business.latitude === "number" &&
    typeof business.longitude === "number"
  ) {
    return `https://maps.apple.com/?q=${encodeURIComponent(
      business.name ?? "Business"
    )}&ll=${business.latitude},${business.longitude}`;
  }

  return query
    ? `https://maps.apple.com/?q=${encodeURIComponent(query)}`
    : null;
}

function buildEmbedMapUrl(business: BusinessRow) {
  if (
    typeof business.latitude === "number" &&
    typeof business.longitude === "number"
  ) {
    return `https://maps.google.com/maps?q=${business.latitude},${business.longitude}&z=16&output=embed`;
  }

  const query = buildPlaceQuery(business);

  return query
    ? `https://maps.google.com/maps?q=${encodeURIComponent(
        query
      )}&z=16&output=embed`
    : null;
}

export async function generateStaticParams() {
  const supabase = supabasePublic();

  const { data } = await supabase
    .from("businesses")
    .select("slug")
    .not("slug", "is", null)
    .eq("is_live", true);

  return (data ?? [])
    .filter((item) => Boolean(item.slug))
    .map((item) => ({
      slug: item.slug as string,
    }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = supabasePublic();

  const { data } = await supabase
    .from("businesses")
    .select("name,category,city,description,slug")
    .eq("slug", slug)
    .maybeSingle();

  if (!data) {
    return {
      title: "Business Not Found | SalahNearMe",
    };
  }

  const title = `${data.name}${data.city ? ` | ${data.city}` : ""} | SalahNearMe`;

  const description =
    data.description ||
    `View ${data.name}${data.city ? ` in ${data.city}` : ""}: halal business profile, map, contact details, opening hours, sponsorship, and nearby listings.`;

  return {
    title,
    description,
    alternates: {
      canonical: `/business/${slug}`,
    },
    openGraph: {
      title,
      description,
      url: `/business/${slug}`,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function BusinessPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = supabasePublic();

  const { data: businessRaw, error } = await supabase
    .from("businesses")
    .select(
      `
      id,
      name,
      slug,
      category,
      city,
      area,
      address,
      postcode,
      website,
      maps_url,
      latitude,
      longitude,
      phone,
      email,
      description,
      pricing_tier,
      subscription_type,
      subscription_status,
      billing_provider,
      paid_until,
      is_verified,
      featured,
      featured_rank,
      country,
      sponsor_mosque_id,
      sponsor_city_id,
      sponsorship_active,
      city_sponsor,
      mosque_sponsor,
      opening_hours,
      opening_hours_note,
      trust_score,
      quality_score,
      halal_score,
      ranking_score
    `
    )
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    return <pre className="text-white/80">{error.message}</pre>;
  }

  const business = businessRaw as BusinessRow | null;

  if (!business) {
    notFound();
  }

  const { data: cityRowRaw } = business.city
    ? await supabase
        .from("cities")
        .select("id,slug,name")
        .eq("name", business.city)
        .eq("is_active", true)
        .maybeSingle()
    : { data: null };

  const cityRow = (cityRowRaw ?? null) as CityRow | null;

  const { data: sponsorMosqueRaw } = business.sponsor_mosque_id
    ? await supabase
        .from("mosques")
        .select("id,name,slug,city")
        .eq("id", business.sponsor_mosque_id)
        .maybeSingle()
    : { data: null };

  const sponsorMosque = (sponsorMosqueRaw ?? null) as SponsorMosqueRow | null;

  const { data: relatedRaw } = business.city
    ? await supabase
        .from("businesses")
        .select(
          `
          id,
          name,
          slug,
          category,
          city,
          area,
          address,
          postcode,
          website,
          maps_url,
          latitude,
          longitude,
          phone,
          email,
          description,
          pricing_tier,
          subscription_type,
          subscription_status,
          billing_provider,
          paid_until,
          is_verified,
          featured,
          featured_rank,
          country,
          sponsor_mosque_id,
          sponsor_city_id,
          sponsorship_active,
          city_sponsor,
          mosque_sponsor,
          opening_hours,
          opening_hours_note,
          trust_score,
          quality_score,
          halal_score,
          ranking_score
        `
        )
        .eq("city", business.city)
        .neq("id", business.id)
        .order("featured", {
          ascending: false,
        })
        .order("is_verified", {
          ascending: false,
        })
        .order("name", {
          ascending: true,
        })
        .limit(20)
    : { data: [] };

  const relatedBusinesses = sortBusinessesByRank(
    (relatedRaw ?? []) as BusinessRow[],
    {
      cityId: cityRow?.id ?? null,
      cityName: business.city,
      mosqueId: business.sponsor_mosque_id,
    }
  ).slice(0, 6);

  const googleMapsUrl = buildGoogleMapsUrl(business);
  const appleMapsUrl = buildAppleMapsUrl(business);
  const embedMapUrl = buildEmbedMapUrl(business);
  const websiteUrl = normaliseExternalUrl(business.website);
  const paidActive = isPaidActive(business.paid_until);

  const premiumActive =
    paidActive &&
    Boolean(
      business.featured ||
        business.city_sponsor ||
        business.mosque_sponsor ||
        business.sponsorship_active
    );

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: business.name ?? "Business",
    description: business.description ?? undefined,
    url: `https://www.salahnearme.com/business/${business.slug}`,
    telephone: business.phone ?? undefined,
    address: {
      "@type": "PostalAddress",
      streetAddress: business.address ?? undefined,
      addressLocality: business.city ?? undefined,
      postalCode: business.postcode ?? undefined,
      addressCountry: business.country ?? undefined,
    },
    geo:
      typeof business.latitude === "number" &&
      typeof business.longitude === "number"
        ? {
            "@type": "GeoCoordinates",
            latitude: business.latitude,
            longitude: business.longitude,
          }
        : undefined,
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: "https://www.salahnearme.com",
      },
      ...(cityRow
        ? [
            {
              "@type": "ListItem",
              position: 2,
              name: cityRow.name,
              item: `https://www.salahnearme.com/${cityRow.slug}`,
            },
            {
              "@type": "ListItem",
              position: 3,
              name: "Businesses",
              item: `https://www.salahnearme.com/${cityRow.slug}/businesses`,
            },
            {
              "@type": "ListItem",
              position: 4,
              name: business.name ?? "Business",
              item: `https://www.salahnearme.com/business/${business.slug}`,
            },
          ]
        : [
            {
              "@type": "ListItem",
              position: 2,
              name: business.name ?? "Business",
              item: `https://www.salahnearme.com/business/${business.slug}`,
            },
          ]),
    ],
  };

  return (
    <div className="space-y-8">
      <BusinessAnalyticsTracker
        businessId={business.id}
        source="business_page"
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd),
        }}
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd),
        }}
      />

      <section
        className={`luxe-card relative overflow-hidden rounded-3xl p-8 md:p-10 ${
          premiumActive ? "border-yellow-500/40" : ""
        }`}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,0.16),transparent_38%)]" />

        <div className="relative z-10 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
              Business Profile
            </div>

            <h1 className="dashboard-hero-glow mt-4 text-4xl font-black tracking-[-0.04em] text-white md:text-6xl">
              {business.name ?? "Business"}
            </h1>

            <div className="mt-4 text-lg text-white/70">
              {[formatLabel(business.category), buildLocationLine(business)]
                .filter(Boolean)
                .join(" • ")}
            </div>

            {(business.address || business.postcode) && (
              <div className="mt-4 max-w-3xl text-white/80">
                {[business.address, business.postcode]
                  .filter(Boolean)
                  .join(" • ")}
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-2">
              {business.city_sponsor && paidActive && (
                <Badge>City Sponsor</Badge>
              )}

              {business.mosque_sponsor && paidActive && (
                <Badge>Mosque Sponsor</Badge>
              )}

              {business.featured && paidActive && <Badge>Featured</Badge>}

              {business.is_verified && (
                <Badge variant="green">Verified Business</Badge>
              )}

              {business.pricing_tier &&
                business.pricing_tier !== "free" &&
                paidActive && <Badge>{formatLabel(business.pricing_tier)}</Badge>}

              {business.country && <Badge>{business.country}</Badge>}
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              {cityRow && (
                <Link
                  href={`/${cityRow.slug}`}
                  className="luxe-button text-sm"
                >
                  View {cityRow.name}
                </Link>
              )}

              {cityRow && (
                <Link
                  href={`/${cityRow.slug}/businesses`}
                  className="luxe-button-outline text-sm"
                >
                  All businesses in {cityRow.name}
                </Link>
              )}

              {googleMapsUrl && (
                <BusinessTrackedLink
                  businessId={business.id}
                  href={googleMapsUrl}
                  eventType="maps_click"
                  target="_blank"
                  rel="noreferrer"
                  source="business_page"
                  className="luxe-button-outline text-sm"
                  metadata={{
                    map: "google",
                  }}
                >
                  Google Maps
                </BusinessTrackedLink>
              )}

              {appleMapsUrl && (
                <BusinessTrackedLink
                  businessId={business.id}
                  href={appleMapsUrl}
                  eventType="maps_click"
                  target="_blank"
                  rel="noreferrer"
                  source="business_page"
                  className="luxe-button-outline text-sm"
                  metadata={{
                    map: "apple",
                  }}
                >
                  Apple Maps
                </BusinessTrackedLink>
              )}

              {websiteUrl && (
                <BusinessTrackedLink
                  businessId={business.id}
                  href={websiteUrl}
                  eventType="website_click"
                  target="_blank"
                  rel="noreferrer"
                  source="business_page"
                  className="luxe-button-outline text-sm"
                >
                  Website
                </BusinessTrackedLink>
              )}

              {business.phone && (
                <BusinessTrackedLink
                  businessId={business.id}
                  href={`tel:${business.phone}`}
                  eventType="phone_click"
                  source="business_page"
                  className="luxe-button-outline text-sm"
                >
                  Call
                </BusinessTrackedLink>
              )}
            </div>
          </div>

          <aside className="luxe-card-soft rounded-3xl p-6">
            <div className="text-2xl font-bold text-yellow-400">
              Contact & Info
            </div>

            <div className="mt-6 space-y-5">
              <InfoRow
                label="Category"
                value={formatLabel(business.category) ?? "Not available"}
              />

              <InfoRow
                label="Phone"
                value={
                  business.phone ? (
                    <BusinessTrackedLink
                      businessId={business.id}
                      href={`tel:${business.phone}`}
                      eventType="phone_click"
                      source="business_page_sidebar"
                      className="hover:text-yellow-400"
                    >
                      {business.phone}
                    </BusinessTrackedLink>
                  ) : (
                    "Not available"
                  )
                }
              />

              <InfoRow
                label="Website"
                value={
                  websiteUrl ? (
                    <BusinessTrackedLink
                      businessId={business.id}
                      href={websiteUrl}
                      eventType="website_click"
                      target="_blank"
                      rel="noreferrer"
                      source="business_page_sidebar"
                      className="break-all hover:text-yellow-400"
                    >
                      {business.website}
                    </BusinessTrackedLink>
                  ) : (
                    "Not available"
                  )
                }
              />

              <InfoRow
                label="City"
                value={cityRow?.name ?? business.city ?? "Not available"}
              />

              <InfoRow
                label="Listing"
                value={business.is_verified ? "Verified" : "Community listing"}
              />

              <InfoRow
                label="Visibility"
                value={premiumActive ? "Premium active" : "Standard listing"}
              />
            </div>
          </aside>
        </div>
      </section>

      <section className="luxe-card rounded-3xl p-8">
        <div className="text-2xl font-bold text-yellow-400">
          About this business
        </div>

        <div className="luxe-card-soft mt-5 rounded-2xl p-5 text-white/80">
          {business.description ||
            "More business details will appear here as this listing is enriched."}
        </div>
      </section>

      <BusinessOpeningHoursDisplay
        openingHours={business.opening_hours}
        note={business.opening_hours_note}
      />

      <BusinessLeadForm businessId={business.id} />

      {embedMapUrl && (
        <section className="luxe-card rounded-3xl p-8">
          <div className="text-2xl font-bold text-yellow-400">
            Map & Directions
          </div>

          <p className="mt-2 text-white/70">
            View the approximate business location below and open directions in
            your preferred maps app.
          </p>

          <div className="mt-6 overflow-hidden rounded-2xl border border-yellow-500/20">
            <iframe
              title="Business location map"
              src={embedMapUrl}
              className="h-[380px] w-full"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </section>
      )}

      {sponsorMosque && (
        <section className="luxe-card rounded-3xl p-8">
          <div className="text-2xl font-bold text-yellow-400">
            Community Connection
          </div>

          <div className="luxe-card-soft mt-5 rounded-2xl p-5">
            <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
              Supporting mosque
            </div>

            <div className="mt-3 text-xl font-bold text-white">
              {sponsorMosque.name}
            </div>

            <div className="mt-2 text-sm text-white/60">
              {sponsorMosque.city ?? "Mosque page"}
            </div>

            {sponsorMosque.slug && (
              <div className="mt-5">
                <Link
                  href={`/mosque/${sponsorMosque.slug}`}
                  className="luxe-button text-sm"
                >
                  View mosque
                </Link>
              </div>
            )}
          </div>
        </section>
      )}

      {relatedBusinesses.length > 0 && (
        <section className="luxe-card rounded-3xl p-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-2xl font-bold text-yellow-400">
                More halal businesses nearby
              </div>

              <p className="mt-2 text-sm text-white/60">
                Explore more businesses in the same city.
              </p>
            </div>

            {cityRow && (
              <Link
                href={`/${cityRow.slug}/businesses`}
                className="text-sm font-semibold text-yellow-400 hover:text-yellow-300"
              >
                View all →
              </Link>
            )}
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {relatedBusinesses.map((item) => {
              const itemPaidActive = isPaidActive(item.paid_until);

              if (!item.slug) {
                return null;
              }

              return (
                <BusinessTrackedLink
                  key={item.id}
                  businessId={item.id}
                  href={`/business/${item.slug}`}
                  eventType="profile_click"
                  source="business_page_related"
                  className="luxe-card-soft rounded-2xl p-5 transition hover:border-yellow-400/50"
                  metadata={{
                    from_business_id: business.id,
                  }}
                >
                  <div className="font-semibold text-white">{item.name}</div>

                  <div className="mt-2 text-sm text-white/60">
                    {[formatLabel(item.category), item.city]
                      .filter(Boolean)
                      .join(" • ")}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {item.featured && itemPaidActive && <Badge>Featured</Badge>}
                    {item.is_verified && <Badge variant="green">Verified</Badge>}
                  </div>
                </BusinessTrackedLink>
              );
            })}
          </div>
        </section>
      )}

      <section className="luxe-card rounded-3xl p-8">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="luxe-card-soft rounded-2xl p-6">
            <div className="text-xl font-bold text-yellow-400">
              Claim this business
            </div>

            <p className="mt-3 text-white/70">
              Own or manage this halal business? Claim the page to improve your
              listing, update details, and increase visibility.
            </p>

            {business.slug && (
              <div className="mt-5">
                <Link
                  href={`/claim/business/${business.slug}`}
                  className="luxe-button text-sm"
                >
                  Claim this business
                </Link>
              </div>
            )}
          </div>

          <div className="luxe-card-soft rounded-2xl p-6">
            <div className="text-xl font-bold text-yellow-400">
              Advertise on SalahNearMe
            </div>

            <p className="mt-3 text-white/70">
              Promote this business across mosque pages and city listings to
              reach more halal-conscious customers.
            </p>

            <div className="mt-5">
              <BusinessTrackedLink
                businessId={business.id}
                href="/advertise"
                eventType="sponsor_click"
                source="business_page_advertise_cta"
                className="luxe-button text-sm"
              >
                Advertise this business
              </BusinessTrackedLink>
            </div>
          </div>
        </div>
      </section>
    </div>
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
      className={`rounded-full border px-3 py-1 text-xs font-semibold ${className}`}
    >
      {children}
    </span>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-[0.2em] text-white/50">
        {label}
      </div>

      <div className="mt-1 text-white">{value}</div>
    </div>
  );
}