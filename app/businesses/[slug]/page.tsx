import type { Metadata } from "next";
import type { ReactNode } from "react";

import Link from "next/link";
import { notFound } from "next/navigation";

import BusinessAnalyticsTracker from "@/components/BusinessAnalyticsTracker";
import BusinessLeadForm from "@/components/BusinessLeadForm";
import BusinessOpeningHoursDisplay, {
  type OpeningHours,
} from "@/components/BusinessOpeningHoursDisplay";
import BusinessTrackedLink from "@/components/BusinessTrackedLink";
import { sortBusinessesByRank } from "@/lib/businessRanking";
import { supabasePublic } from "@/lib/supabaseServer";

export const revalidate = 300;

const DEFAULT_SITE_URL = "https://www.salahnearme.com";
const MAX_STATIC_BUSINESSES = 1000;
const MAX_RELATED_BUSINESSES = 6;
const MAX_RELATED_FETCH = 30;
const MAX_PUBLIC_MEDIA_ITEMS = 18;
const MAX_PUBLIC_IMAGES = 12;
const MAX_PUBLIC_VIDEOS = 2;
const DESCRIPTION_MAX_LENGTH = 165;

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
  opening_hours?: OpeningHours | null;
  opening_hours_note?: string | null;
  logo_url?: string | null;
  cover_image_url?: string | null;
  gallery_urls?: string[] | null;
  trust_score?: number | null;
  quality_score?: number | null;
  halal_score?: number | null;
  ranking_score?: number | null;
};

type CityRow = {
  id: number;
  slug: string;
  name: string;
  country?: string | null;
  country_code?: string | null;
  timezone?: string | null;
};

type SponsorMosqueRow = {
  id: string;
  name: string | null;
  slug: string | null;
  city: string | null;
};

type PublicMediaItem = {
  url: string;
  type: "image" | "video";
  label: string;
  purpose: "menu" | "building" | "facility" | "food" | "promo" | "general";
};

const IMAGE_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".avif",
];

const VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov", ".m4v"];

function getSiteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    DEFAULT_SITE_URL
  ).replace(/\/+$/, "");
}

function cleanText(value: string | null | undefined) {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
}

function truncateText(value: string, maxLength = DESCRIPTION_MAX_LENGTH) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trim()}…`;
}

function slugify(value: string | null | undefined) {
  return (
    cleanText(value)
      ?.toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") ?? null
  );
}

function formatLabel(value: string | null | undefined) {
  const cleaned = cleanText(value);

  if (!cleaned) {
    return null;
  }

  return cleaned
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function buildLocationLine(
  item: Pick<BusinessRow, "area" | "city" | "postcode">
) {
  return [item.area, item.city, item.postcode]
    .map(cleanText)
    .filter(Boolean)
    .join(" • ");
}

function isPaidActive(value: string | null | undefined) {
  const cleaned = cleanText(value);

  if (!cleaned) {
    return false;
  }

  const time = new Date(cleaned).getTime();

  return Number.isFinite(time) && time > Date.now();
}

function isTruthySponsorFlag(value: boolean | null | undefined) {
  return value === true;
}

function safeHttpUrl(value: string | null | undefined) {
  const trimmed = cleanText(value);

  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(
      trimmed.startsWith("http://") || trimmed.startsWith("https://")
        ? trimmed
        : `https://${trimmed}`
    );

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

function safeTelHref(value: string | null | undefined) {
  const cleaned = cleanText(value);

  if (!cleaned) {
    return null;
  }

  const dial = cleaned.replace(/[^\d+]/g, "");

  return dial.length >= 7 ? `tel:${dial}` : null;
}

function getUrlPathname(value: string) {
  try {
    return new URL(value).pathname.toLowerCase();
  } catch {
    return value.toLowerCase().split("?")[0] ?? value.toLowerCase();
  }
}

function isImageUrl(value: string) {
  const pathname = getUrlPathname(value);

  return IMAGE_EXTENSIONS.some((extension) => pathname.endsWith(extension));
}

function isVideoUrl(value: string) {
  const pathname = getUrlPathname(value);

  return VIDEO_EXTENSIONS.some((extension) => pathname.endsWith(extension));
}

function detectMediaPurpose(url: string): PublicMediaItem["purpose"] {
  const lower = decodeURIComponent(url).toLowerCase();

  if (
    lower.includes("menu") ||
    lower.includes("price") ||
    lower.includes("dish-list")
  ) {
    return "menu";
  }

  if (
    lower.includes("building") ||
    lower.includes("front") ||
    lower.includes("outside") ||
    lower.includes("shopfront") ||
    lower.includes("premises")
  ) {
    return "building";
  }

  if (
    lower.includes("facility") ||
    lower.includes("facilities") ||
    lower.includes("seating") ||
    lower.includes("room") ||
    lower.includes("inside") ||
    lower.includes("interior")
  ) {
    return "facility";
  }

  if (
    lower.includes("food") ||
    lower.includes("meal") ||
    lower.includes("burger") ||
    lower.includes("chicken") ||
    lower.includes("rice") ||
    lower.includes("dessert")
  ) {
    return "food";
  }

  if (
    lower.includes("promo") ||
    lower.includes("advert") ||
    lower.includes("video") ||
    lower.includes("reel")
  ) {
    return "promo";
  }

  return "general";
}

function buildMediaLabel(
  businessName: string | null,
  item: Pick<PublicMediaItem, "type" | "purpose">,
  index: number
) {
  const name = cleanText(businessName) ?? "Business";

  if (item.type === "video") {
    return `${name} promotional video ${index + 1}`;
  }

  switch (item.purpose) {
    case "menu":
      return `${name} menu image`;
    case "building":
      return `${name} building or shopfront image`;
    case "facility":
      return `${name} facilities image`;
    case "food":
      return `${name} food or product image`;
    case "promo":
      return `${name} promotional image`;
    default:
      return `${name} business image ${index + 1}`;
  }
}

function buildPublicMediaItems(
  galleryUrls: string[] | null | undefined,
  businessName: string | null
): PublicMediaItem[] {
  if (!Array.isArray(galleryUrls)) {
    return [];
  }

  const seen = new Set<string>();
  const items: PublicMediaItem[] = [];

  for (const rawItem of galleryUrls) {
    if (items.length >= MAX_PUBLIC_MEDIA_ITEMS) {
      break;
    }

    const url = safeHttpUrl(rawItem);

    if (!url || seen.has(url)) {
      continue;
    }

    const isVideo = isVideoUrl(url);
    const isImage = isImageUrl(url);

    if (!isVideo && !isImage) {
      continue;
    }

    const type: PublicMediaItem["type"] = isVideo ? "video" : "image";
    const purpose = detectMediaPurpose(url);

    seen.add(url);

    items.push({
      url,
      type,
      purpose,
      label: buildMediaLabel(businessName, { type, purpose }, items.length),
    });
  }

  return items;
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
    .map(cleanText)
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
  const savedMapsUrl = safeHttpUrl(business.maps_url);

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
      cleanText(business.name) ?? "Business"
    )}&ll=${business.latitude},${business.longitude}`;
  }

  return query ? `https://maps.apple.com/?q=${encodeURIComponent(query)}` : null;
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

function getPrimaryImage(
  business: Pick<BusinessRow, "cover_image_url" | "logo_url">,
  mediaItems: PublicMediaItem[]
) {
  return (
    safeHttpUrl(business.cover_image_url) ||
    safeHttpUrl(business.logo_url) ||
    mediaItems.find((item) => item.type === "image")?.url ||
    null
  );
}

function uniqueList(values: Array<string | null | undefined>) {
  const seen = new Set<string>();

  return values
    .map(cleanText)
    .filter((value): value is string => {
      if (!value || seen.has(value)) {
        return false;
      }

      seen.add(value);
      return true;
    });
}

function getMediaSummary(
  imageItems: PublicMediaItem[],
  videoItems: PublicMediaItem[]
) {
  if (imageItems.length === 0 && videoItems.length === 0) {
    return "No media yet";
  }

  const photoText = `${imageItems.length} photo${
    imageItems.length === 1 ? "" : "s"
  }`;

  const videoText =
    videoItems.length > 0
      ? ` • ${videoItems.length} video${videoItems.length === 1 ? "" : "s"}`
      : "";

  return `${photoText}${videoText}`;
}

function getSmartBusinessAdvice({
  business,
  paidActive,
  mediaItems,
  videoItems,
}: {
  business: BusinessRow;
  paidActive: boolean;
  mediaItems: PublicMediaItem[];
  videoItems: PublicMediaItem[];
}) {
  if (paidActive && videoItems.length > 0) {
    return "This premium listing includes a video showcase, making it easier for visitors to understand the business before contacting or visiting.";
  }

  if (paidActive && mediaItems.length > 0) {
    return "This active listing includes business media and premium visibility signals, helping customers preview the place before visiting.";
  }

  if (mediaItems.length > 0) {
    return "This listing includes business media, helping customers preview the menu, premises, facilities, or services before visiting.";
  }

  if (business.is_verified) {
    return "This verified listing has key business details available. More photos, videos, and opening hours can improve customer confidence.";
  }

  return "This is a community listing. The business can claim this page to add photos, videos, opening hours, and stronger trust signals.";
}

function getBusinessProfileUrl(slug: string | null | undefined) {
  return slug ? `/businesses/${slug}` : "/businesses";
}

function getBusinessType(category: string | null | undefined) {
  const lower = cleanText(category)?.toLowerCase() ?? "";

  if (
    lower.includes("restaurant") ||
    lower.includes("takeaway") ||
    lower.includes("food") ||
    lower.includes("cafe")
  ) {
    return "Restaurant";
  }

  if (lower.includes("butcher")) {
    return "Butcher";
  }

  if (
    lower.includes("grocery") ||
    lower.includes("shop") ||
    lower.includes("store") ||
    lower.includes("bookstore")
  ) {
    return "Store";
  }

  if (
    lower.includes("clinic") ||
    lower.includes("dental") ||
    lower.includes("doctor")
  ) {
    return "MedicalBusiness";
  }

  return "LocalBusiness";
}

function buildBusinessDescription(business: {
  name: string | null;
  category: string | null;
  city: string | null;
  description: string | null;
}) {
  const savedDescription = cleanText(business.description);

  if (savedDescription) {
    return truncateText(savedDescription);
  }

  const name = cleanText(business.name) ?? "this halal business";
  const category = formatLabel(business.category);
  const city = cleanText(business.city);

  return truncateText(
    `View ${name}${category ? `, a ${category.toLowerCase()}` : ""}${
      city ? ` in ${city}` : ""
    } on SalahNearMe. Find contact details, directions, opening hours, media, and trusted halal business information.`
  );
}

function buildBusinessTitle(business: {
  name: string | null;
  city: string | null;
  category: string | null;
}) {
  const name = cleanText(business.name) ?? "Halal Business";
  const city = cleanText(business.city);
  const category = formatLabel(business.category);

  return `${name}${city ? ` in ${city}` : ""}${
    category ? ` | ${category}` : ""
  } | SalahNearMe`;
}

function compactJsonLd<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .map((item) => compactJsonLd(item))
      .filter((item) => item !== undefined && item !== null) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .map(([key, item]) => [key, compactJsonLd(item)])
        .filter(([, item]) => {
          if (item === undefined || item === null || item === "") {
            return false;
          }

          if (Array.isArray(item) && item.length === 0) {
            return false;
          }

          if (
            typeof item === "object" &&
            !Array.isArray(item) &&
            Object.keys(item).length === 0
          ) {
            return false;
          }

          return true;
        })
    ) as T;
  }

  return value;
}

async function getCityForBusiness(
  cityName: string | null,
  citySlug: string | null
) {
  const supabase = supabasePublic();

  if (citySlug) {
    const { data } = await supabase
      .from("cities")
      .select("id,slug,name,country,country_code,timezone")
      .eq("slug", citySlug)
      .eq("is_active", true)
      .maybeSingle();

    if (data) {
      return data as CityRow;
    }
  }

  if (!cityName) {
    return null;
  }

  const { data } = await supabase
    .from("cities")
    .select("id,slug,name,country,country_code,timezone")
    .ilike("name", cityName)
    .eq("is_active", true)
    .maybeSingle();

  return (data ?? null) as CityRow | null;
}

export async function generateStaticParams() {
  const supabase = supabasePublic();

  const { data } = await supabase
    .from("businesses")
    .select("slug")
    .not("slug", "is", null)
    .order("featured", {
      ascending: false,
    })
    .order("is_verified", {
      ascending: false,
    })
    .order("name", {
      ascending: true,
    })
    .limit(MAX_STATIC_BUSINESSES);

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
    .select(
      "name,category,city,description,slug,cover_image_url,logo_url,gallery_urls,is_verified"
    )
    .eq("slug", slug)
    .maybeSingle();

  if (!data) {
    return {
      title: "Business Not Found | SalahNearMe",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const siteUrl = getSiteUrl();
  const mediaItems = buildPublicMediaItems(
    data.gallery_urls as string[] | null | undefined,
    data.name
  );

  const image = getPrimaryImage(data, mediaItems);
  const title = buildBusinessTitle(data);
  const description = buildBusinessDescription(data);
  const canonicalPath = `/businesses/${slug}`;
  const canonicalUrl = `${siteUrl}${canonicalPath}`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalPath,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: "website",
      siteName: "SalahNearMe",
      images: image
        ? [
            {
              url: image,
              alt: data.name ?? "SalahNearMe halal business",
            },
          ]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function BusinessPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = supabasePublic();
  const siteUrl = getSiteUrl();

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
      logo_url,
      cover_image_url,
      gallery_urls,
      trust_score,
      quality_score,
      halal_score,
      ranking_score
    `
    )
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("Business profile load error:", error.message);

    return (
      <section className="luxe-card rounded-3xl p-8">
        <div className="text-sm uppercase tracking-[0.25em] text-red-300">
          Business profile error
        </div>

        <h1 className="mt-4 text-3xl font-black text-white">
          We could not load this business.
        </h1>

        <p className="mt-3 text-white/70">
          Please try again shortly or return to all halal businesses.
        </p>

        <div className="mt-6">
          <Link href="/businesses" className="luxe-button text-sm">
            View businesses
          </Link>
        </div>
      </section>
    );
  }

  const business = businessRaw as BusinessRow | null;

  if (!business) {
    notFound();
  }

  const citySlug = slugify(business.city);
  const cityRow = await getCityForBusiness(business.city, citySlug);

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
          mosque_sponsor
        `
        )
        .eq("city", business.city)
        .neq("id", business.id)
        .not("slug", "is", null)
        .order("featured", {
          ascending: false,
        })
        .order("is_verified", {
          ascending: false,
        })
        .order("name", {
          ascending: true,
        })
        .limit(MAX_RELATED_FETCH)
    : { data: [] };

  const relatedBusinesses = sortBusinessesByRank(
    (relatedRaw ?? []) as BusinessRow[],
    {
      cityId: cityRow?.id ?? null,
      cityName: business.city,
      mosqueId: business.sponsor_mosque_id,
    }
  ).slice(0, MAX_RELATED_BUSINESSES);

  const googleMapsUrl = buildGoogleMapsUrl(business);
  const appleMapsUrl = buildAppleMapsUrl(business);
  const embedMapUrl = buildEmbedMapUrl(business);
  const websiteUrl = safeHttpUrl(business.website);
  const phoneHref = safeTelHref(business.phone);
  const paidActive = isPaidActive(business.paid_until);

  const mediaItems = buildPublicMediaItems(business.gallery_urls, business.name);
  const imageItems = mediaItems.filter((item) => item.type === "image");
  const videoItems = mediaItems.filter((item) => item.type === "video");
  const primaryImage = getPrimaryImage(business, mediaItems);

  const premiumActive =
    paidActive &&
    Boolean(
      business.featured ||
        isTruthySponsorFlag(business.city_sponsor) ||
        isTruthySponsorFlag(business.mosque_sponsor) ||
        isTruthySponsorFlag(business.sponsorship_active)
    );

  const businessPath = getBusinessProfileUrl(business.slug);
  const businessUrl = `${siteUrl}${businessPath}`;
  const businessName = cleanText(business.name) ?? "Business";
  const categoryLabel = formatLabel(business.category);
  const locationLine = buildLocationLine(business);
  const description = buildBusinessDescription(business);
  const localBusinessType = getBusinessType(business.category);

  const jsonLdImages = uniqueList([
    primaryImage,
    ...imageItems.map((item) => item.url),
  ]);

  const jsonLd = compactJsonLd({
    "@context": "https://schema.org",
    "@type": localBusinessType,
    name: businessName,
    description,
    image: jsonLdImages.length > 0 ? jsonLdImages : undefined,
    url: businessUrl,
    telephone: cleanText(business.phone) ?? undefined,
    email: cleanText(business.email) ?? undefined,
    priceRange: business.pricing_tier ? formatLabel(business.pricing_tier) : undefined,
    address:
      business.address || business.city || business.postcode || business.country
        ? {
            "@type": "PostalAddress",
            streetAddress: cleanText(business.address) ?? undefined,
            addressLocality: cleanText(business.city) ?? undefined,
            postalCode: cleanText(business.postcode) ?? undefined,
            addressCountry: cleanText(business.country) ?? "United Kingdom",
          }
        : undefined,
    geo:
      typeof business.latitude === "number" &&
      typeof business.longitude === "number"
        ? {
            "@type": "GeoCoordinates",
            latitude: business.latitude,
            longitude: business.longitude,
          }
        : undefined,
    hasMap: googleMapsUrl ?? undefined,
    sameAs: websiteUrl ? [websiteUrl] : undefined,
  });

  const mediaJsonLd =
    mediaItems.length > 0
      ? compactJsonLd({
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: `${businessName} media`,
          itemListElement: mediaItems.map((item, index) => ({
            "@type": "ListItem",
            position: index + 1,
            item:
              item.type === "video"
                ? {
                    "@type": "VideoObject",
                    name: item.label,
                    description: `${businessName} video media`,
                    contentUrl: item.url,
                    thumbnailUrl: primaryImage ?? undefined,
                    uploadDate: new Date().toISOString(),
                  }
                : {
                    "@type": "ImageObject",
                    name: item.label,
                    contentUrl: item.url,
                  },
          })),
        })
      : null;

  const breadcrumbJsonLd = compactJsonLd({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: siteUrl,
      },
      ...(cityRow
        ? [
            {
              "@type": "ListItem",
              position: 2,
              name: cityRow.name,
              item: `${siteUrl}/${cityRow.slug}`,
            },
            {
              "@type": "ListItem",
              position: 3,
              name: "Businesses",
              item: `${siteUrl}/${cityRow.slug}/businesses`,
            },
            {
              "@type": "ListItem",
              position: 4,
              name: businessName,
              item: businessUrl,
            },
          ]
        : [
            {
              "@type": "ListItem",
              position: 2,
              name: "Businesses",
              item: `${siteUrl}/businesses`,
            },
            {
              "@type": "ListItem",
              position: 3,
              name: businessName,
              item: businessUrl,
            },
          ]),
    ],
  });

  const smartAdvice = getSmartBusinessAdvice({
    business,
    paidActive,
    mediaItems,
    videoItems,
  });

  return (
    <div className="space-y-8">
      <BusinessAnalyticsTracker
        businessId={business.id}
        source="business_page"
        pageType="business_profile"
        citySlug={cityRow?.slug}
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd),
        }}
      />

      {mediaJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(mediaJsonLd),
          }}
        />
      )}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd),
        }}
      />

      <section
        className={`luxe-card relative overflow-hidden rounded-3xl p-0 ${
          premiumActive ? "border-yellow-500/40" : ""
        }`}
      >
        {primaryImage ? (
          <div className="relative h-72 overflow-hidden rounded-t-3xl md:h-96">
            <img
              src={primaryImage}
              alt={`${businessName} cover`}
              className="h-full w-full object-cover"
            />

            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/15" />
          </div>
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,0.16),transparent_38%)]" />
        )}

        <div className="relative z-10 grid gap-8 p-8 md:p-10 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              {safeHttpUrl(business.logo_url) ? (
                <img
                  src={safeHttpUrl(business.logo_url) ?? ""}
                  alt={`${businessName} logo`}
                  className="h-24 w-24 rounded-3xl border border-yellow-500/30 bg-black object-cover p-1 shadow-2xl shadow-yellow-500/10"
                />
              ) : null}

              <div>
                <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
                  Business Profile
                </div>

                <h1 className="dashboard-hero-glow mt-4 text-4xl font-black tracking-[-0.04em] text-white md:text-6xl">
                  {businessName}
                </h1>
              </div>
            </div>

            {locationLine || categoryLabel ? (
              <div className="mt-4 text-lg text-white/70">
                {[categoryLabel, locationLine].filter(Boolean).join(" • ")}
              </div>
            ) : null}

            {(business.address || business.postcode) && (
              <div className="mt-4 max-w-3xl text-white/80">
                {[business.address, business.postcode]
                  .map(cleanText)
                  .filter(Boolean)
                  .join(" • ")}
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-2">
              {isTruthySponsorFlag(business.city_sponsor) && paidActive && (
                <Badge>City Sponsor</Badge>
              )}

              {isTruthySponsorFlag(business.mosque_sponsor) && paidActive && (
                <Badge>Mosque Sponsor</Badge>
              )}

              {business.featured && paidActive && <Badge>Featured</Badge>}

              {business.is_verified && (
                <Badge variant="green">Verified Business</Badge>
              )}

              {business.pricing_tier &&
                business.pricing_tier !== "free" &&
                paidActive && <Badge>{formatLabel(business.pricing_tier)}</Badge>}

              {mediaItems.length > 0 && <Badge>Media Active</Badge>}

              {videoItems.length > 0 && <Badge>Video Showcase</Badge>}

              {business.country && <Badge>{business.country}</Badge>}
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              {cityRow && (
                <Link href={`/${cityRow.slug}`} className="luxe-button text-sm">
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
                  pageType="business_profile"
                  citySlug={cityRow?.slug}
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
                  pageType="business_profile"
                  citySlug={cityRow?.slug}
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
                  pageType="business_profile"
                  citySlug={cityRow?.slug}
                  className="luxe-button-outline text-sm"
                >
                  Website
                </BusinessTrackedLink>
              )}

              {phoneHref && (
                <BusinessTrackedLink
                  businessId={business.id}
                  href={phoneHref}
                  eventType="phone_click"
                  source="business_page"
                  pageType="business_profile"
                  citySlug={cityRow?.slug}
                  className="luxe-button-outline text-sm"
                >
                  Call
                </BusinessTrackedLink>
              )}
            </div>

            <div className="mt-8 rounded-2xl border border-yellow-500/20 bg-black/30 p-5">
              <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
                Smart listing insight
              </div>

              <p className="mt-2 text-sm leading-6 text-white/70">
                {smartAdvice}
              </p>
            </div>
          </div>

          <aside className="luxe-card-soft rounded-3xl p-6">
            <div className="text-2xl font-bold text-yellow-400">
              Contact & Info
            </div>

            <div className="mt-6 space-y-5">
              <InfoRow label="Category" value={categoryLabel ?? "Not available"} />

              <InfoRow
                label="Phone"
                value={
                  phoneHref ? (
                    <BusinessTrackedLink
                      businessId={business.id}
                      href={phoneHref}
                      eventType="phone_click"
                      source="business_page_sidebar"
                      pageType="business_profile"
                      citySlug={cityRow?.slug}
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
                      pageType="business_profile"
                      citySlug={cityRow?.slug}
                      className="break-all hover:text-yellow-400"
                    >
                      {websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}
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

              <InfoRow
                label="Media"
                value={getMediaSummary(imageItems, videoItems)}
              />
            </div>
          </aside>
        </div>
      </section>

      {mediaItems.length > 0 && (
        <section className="luxe-card rounded-3xl p-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
                Business Media
              </div>

              <h2 className="mt-3 text-3xl font-black text-white">
                Photos, menu, facilities and video showcase
              </h2>

              <p className="mt-2 max-w-3xl text-white/65">
                Images and videos help customers quickly see the menu, premises,
                facilities, products, and promotional clips before visiting.
              </p>
            </div>

            <div className="rounded-full border border-yellow-500/25 bg-yellow-500/10 px-4 py-2 text-sm font-semibold text-yellow-300">
              {getMediaSummary(imageItems, videoItems)}
            </div>
          </div>

          {videoItems.length > 0 && (
            <div className="mt-7 grid gap-5 lg:grid-cols-2">
              {videoItems.slice(0, MAX_PUBLIC_VIDEOS).map((item) => (
                <div
                  key={item.url}
                  className="overflow-hidden rounded-3xl border border-yellow-500/20 bg-black/40"
                >
                  <video
                    src={item.url}
                    className="aspect-video w-full bg-black object-cover"
                    controls
                    preload="metadata"
                    playsInline
                  />

                  <div className="border-t border-yellow-500/10 p-4">
                    <div className="text-sm font-semibold text-yellow-300">
                      Promotional video
                    </div>

                    <p className="mt-1 text-sm text-white/60">
                      Short business video for customers browsing this listing.
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {imageItems.length > 0 && (
            <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {imageItems.slice(0, MAX_PUBLIC_IMAGES).map((item, index) => (
                <figure
                  key={item.url}
                  className={`group overflow-hidden rounded-3xl border border-yellow-500/20 bg-black/30 ${
                    index === 0 ? "sm:col-span-2" : ""
                  }`}
                >
                  <img
                    src={item.url}
                    alt={item.label}
                    className={`w-full object-cover transition duration-300 group-hover:scale-[1.03] ${
                      index === 0 ? "h-80" : "h-56"
                    }`}
                    loading={index < 2 ? "eager" : "lazy"}
                  />

                  <figcaption className="border-t border-yellow-500/10 px-4 py-3 text-sm text-white/60">
                    {item.purpose === "general"
                      ? index === 0
                        ? "Featured business image"
                        : `Business photo ${index + 1}`
                      : formatLabel(item.purpose)}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="luxe-card rounded-3xl p-8">
        <div className="text-2xl font-bold text-yellow-400">
          About this business
        </div>

        <div className="luxe-card-soft mt-5 rounded-2xl p-5 text-white/80">
          {cleanText(business.description) ||
            "More business details will appear here as this listing is enriched."}
        </div>
      </section>

      <BusinessOpeningHoursDisplay
        openingHours={business.opening_hours ?? null}
        note={business.opening_hours_note ?? null}
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
              title={`${businessName} location map`}
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
              {sponsorMosque.name ?? "Mosque"}
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
                  href={getBusinessProfileUrl(item.slug)}
                  eventType="profile_click"
                  source="business_page_related"
                  pageType="business_profile"
                  citySlug={cityRow?.slug}
                  className="luxe-card-soft rounded-2xl p-5 transition hover:border-yellow-400/50"
                  metadata={{
                    from_business_id: business.id,
                  }}
                >
                  <div className="font-semibold text-white">
                    {item.name ?? "Halal business"}
                  </div>

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
              listing, upload media, update details, and increase visibility.
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
              Promote this business with photos, videos, mosque page visibility,
              and city listing placement.
            </p>

            <div className="mt-5">
              <BusinessTrackedLink
                businessId={business.id}
                href="/advertise"
                eventType="sponsor_click"
                source="business_page_advertise_cta"
                pageType="business_profile"
                citySlug={cityRow?.slug}
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

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-[0.2em] text-white/50">
        {label}
      </div>

      <div className="mt-1 text-white">{value}</div>
    </div>
  );
}