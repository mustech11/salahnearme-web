import type { Metadata } from "next";
import type { ReactNode } from "react";

import Link from "next/link";
import { notFound } from "next/navigation";

import MosqueBusinessSponsors from "@/components/MosqueBusinessSponsors";
import MosqueCorrectionReportForm from "@/components/MosqueCorrectionReportForm";
import MosqueFacilitiesGrid from "@/components/MosqueFacilitiesGrid";
import MosqueLiveReporter from "@/components/MosqueLiveReporter";
import MosqueMapEmbed from "@/components/MosqueMapEmbed";
import MosqueNearbyBusinesses from "@/components/MosqueNearbyBusinesses";
import MosqueTrustBadges from "@/components/MosqueTrustBadges";

import { sortBusinessesByRank } from "@/lib/businessRanking";
import { getSiteUrl } from "@/lib/env";
import { buildLiveStatus } from "@/lib/mosqueLive";
import { supabasePublic } from "@/lib/supabaseServer";

export const revalidate = 300;
export const dynamicParams = true;

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

type MosqueCityJoin = {
  slug: string | null;
  name: string | null;
  country?: string | null;
} | null;

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

type MosquePrayerTimeRow = {
  id: string;
  mosque_id: string;
  prayer_date: string;
  fajr_begins: string | null;
  fajr_iqamah: string | null;
  sunrise: string | null;
  dhuhr_begins: string | null;
  dhuhr_iqamah: string | null;
  asr_begins: string | null;
  asr_iqamah: string | null;
  maghrib_begins: string | null;
  maghrib_iqamah: string | null;
  isha_begins: string | null;
  isha_iqamah: string | null;
  source: string | null;
  confidence: string | null;
  notes: string | null;
};

type MosqueJumuahTimeRow = {
  id: string;
  mosque_id: string;
  label: string | null;
  khutbah_time: string | null;
  salah_time: string | null;
  active: boolean | null;
  notes: string | null;
};

type MosqueRow = {
  id: string;
  name: string | null;
  slug: string | null;
  area: string | null;
  city: string | null;
  postcode: string | null;
  address: string | null;
  maps_url: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  website: string | null;
  country: string | null;
  timezone: string | null;
  womens_space: boolean | null;
  parking: boolean | null;
  wheelchair_access: boolean | null;
  verified_status: string | null;
  source: string | null;
  area_hint: string | null;
  children_classes: boolean | null;
  nikah_service: boolean | null;
  janazah_service: boolean | null;
  wudu_facilities: boolean | null;
  sisters_entrance: boolean | null;
  imam_name: string | null;
  languages: string[] | null;
  facilities_notes: string | null;
  jumuah_enabled: boolean | null;
  jumuah_khutbah_1: string | null;
  jumuah_salah_1: string | null;
  jumuah_khutbah_2: string | null;
  jumuah_salah_2: string | null;
  jumuah_khutbah_3: string | null;
  jumuah_salah_3: string | null;
  jumuah_notes: string | null;
  city_id: number | null;
  cities?: MosqueCityJoin;
};

type MosqueLiveReportType =
  | "iqamah"
  | "khutbah"
  | "full"
  | "correction"
  | "parking_full"
  | "jumuah_first"
  | "jumuah_second"
  | "jumuah_third";

type LiveReportRow = {
  report_type: MosqueLiveReportType;
  created_at: string;
};

type LiveTone =
  | "green"
  | "purple"
  | "red"
  | "yellow"
  | "orange"
  | "cyan"
  | "blue"
  | "indigo";

type LiveSummaryItem = {
  key: MosqueLiveReportType;
  label: string;
  count: number;
  tone: LiveTone;
};

type MonthRange = {
  year: number;
  month: number;
  startDate: string;
  endDate: string;
  daysInMonth: number;
};

type LoadWarning = {
  key: string;
  message: string;
};

const DEFAULT_TIMEZONE = "Europe/London";
const DEFAULT_COUNTRY = "United Kingdom";
const MAX_LIVE_REPORTS = 50;
const MAX_SPONSORED_BUSINESSES = 6;
const MAX_FALLBACK_BUSINESSES = 12;

function cleanText(
  value: string | null | undefined,
  maxLength = 500
): string | null {
  const cleaned = String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);

  return cleaned || null;
}

function isSafeSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
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
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatTimeValue(
  value: string | null | undefined
): string {
  const cleaned = cleanText(value, 20);

  if (!cleaned) {
    return "—";
  }

  if (/^\d{2}:\d{2}:\d{2}$/.test(cleaned)) {
    return cleaned.slice(0, 5);
  }

  return cleaned;
}

function normaliseExternalUrl(
  value: string | null | undefined
): string | null {
  const cleaned = cleanText(value, 2_000);

  if (!cleaned) {
    return null;
  }

  const candidate = /^https?:\/\//i.test(cleaned)
    ? cleaned
    : `https://${cleaned}`;

  try {
    const url = new URL(candidate);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function buildTelephoneHref(
  value: string | null | undefined
): string | null {
  const cleaned = cleanText(value, 80);

  if (!cleaned) {
    return null;
  }

  const telephone = cleaned.replace(/[^\d+*#]/g, "");

  return telephone ? `tel:${telephone}` : null;
}

function getSafeTimezone(
  value: string | null | undefined
): string {
  const timezone = cleanText(value, 120) ?? DEFAULT_TIMEZONE;

  try {
    new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
    }).format(new Date());

    return timezone;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

function getTodayDateForTimezone(
  timezone: string | null | undefined
): string {
  const safeTimezone = getSafeTimezone(timezone);

  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: safeTimezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());

    const year = parts.find(
      (part) => part.type === "year"
    )?.value;

    const month = parts.find(
      (part) => part.type === "month"
    )?.value;

    const day = parts.find(
      (part) => part.type === "day"
    )?.value;

    if (year && month && day) {
      return `${year}-${month}-${day}`;
    }
  } catch {
    // UTC fallback below.
  }

  return new Date().toISOString().slice(0, 10);
}

function getCurrentMonthRange(
  dateValue: string
): MonthRange {
  const [yearRaw, monthRaw] = dateValue.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    const fallback = new Date();
    const fallbackYear = fallback.getUTCFullYear();
    const fallbackMonth = fallback.getUTCMonth() + 1;
    const daysInMonth = new Date(
      Date.UTC(fallbackYear, fallbackMonth, 0)
    ).getUTCDate();

    return {
      year: fallbackYear,
      month: fallbackMonth,
      startDate: `${fallbackYear}-${String(
        fallbackMonth
      ).padStart(2, "0")}-01`,
      endDate: `${fallbackYear}-${String(
        fallbackMonth
      ).padStart(2, "0")}-${String(
        daysInMonth
      ).padStart(2, "0")}`,
      daysInMonth,
    };
  }

  const daysInMonth = new Date(
    Date.UTC(year, month, 0)
  ).getUTCDate();

  return {
    year,
    month,
    startDate: `${year}-${String(month).padStart(
      2,
      "0"
    )}-01`,
    endDate: `${year}-${String(month).padStart(
      2,
      "0"
    )}-${String(daysInMonth).padStart(2, "0")}`,
    daysInMonth,
  };
}

function formatDisplayDate(
  dateValue: string,
  timezone: string
): string {
  try {
    const date = new Date(`${dateValue}T12:00:00.000Z`);

    return new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  } catch {
    return dateValue;
  }
}

function getCitySlug(mosque: MosqueRow): string | null {
  return cleanText(mosque.cities?.slug, 160);
}

function getCityName(mosque: MosqueRow): string | null {
  return (
    cleanText(mosque.cities?.name, 160) ??
    cleanText(mosque.city, 160)
  );
}

function getCityCountry(mosque: MosqueRow): string {
  return (
    cleanText(mosque.cities?.country, 160) ??
    cleanText(mosque.country, 160) ??
    DEFAULT_COUNTRY
  );
}

function buildLocationLabel(
  mosque: Pick<MosqueRow, "area" | "city" | "postcode">,
  cityName?: string | null
): string {
  return [
    mosque.area,
    cityName ?? mosque.city,
    mosque.postcode,
  ]
    .map((value) => cleanText(value, 160))
    .filter((value): value is string => Boolean(value))
    .join(" • ");
}

function buildPlaceQuery(
  mosque: MosqueRow,
  cityName?: string | null
): string {
  return [
    mosque.name,
    mosque.address,
    mosque.area,
    cityName ?? mosque.city,
    mosque.postcode,
    mosque.country,
  ]
    .map((value) => cleanText(value, 500))
    .filter((value): value is string => Boolean(value))
    .join(", ");
}

function buildGoogleMapsUrl(
  mosque: MosqueRow,
  cityName?: string | null
): string | null {
  const savedMapsUrl = normaliseExternalUrl(mosque.maps_url);

  if (savedMapsUrl) {
    return savedMapsUrl;
  }

  if (
    typeof mosque.latitude === "number" &&
    Number.isFinite(mosque.latitude) &&
    typeof mosque.longitude === "number" &&
    Number.isFinite(mosque.longitude)
  ) {
    return `https://www.google.com/maps/search/?api=1&query=${mosque.latitude},${mosque.longitude}`;
  }

  const query = buildPlaceQuery(mosque, cityName);

  return query
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        query
      )}`
    : null;
}

function buildAppleMapsUrl(
  mosque: MosqueRow,
  cityName?: string | null
): string | null {
  if (
    typeof mosque.latitude === "number" &&
    Number.isFinite(mosque.latitude) &&
    typeof mosque.longitude === "number" &&
    Number.isFinite(mosque.longitude)
  ) {
    return `https://maps.apple.com/?q=${encodeURIComponent(
      mosque.name ?? "Mosque"
    )}&ll=${mosque.latitude},${mosque.longitude}`;
  }

  const query = buildPlaceQuery(mosque, cityName);

  return query
    ? `https://maps.apple.com/?q=${encodeURIComponent(query)}`
    : null;
}

function buildMosqueDescription(
  mosqueName: string,
  place: string | null
): string {
  return `View ${mosqueName}${
    place ? ` in ${place}` : ""
  } on SalahNearMe. Find prayer and iqamah times, Jumu’ah sessions, directions, facilities, live community updates and nearby halal businesses.`;
}

function getFallbackJumuahCards(
  mosque: MosqueRow
): Array<{
  label: string;
  khutbah: string | null;
  salah: string | null;
}> {
  if (mosque.jumuah_enabled === false) {
    return [];
  }

  return [
    {
      label: "Jumu’ah 1",
      khutbah: mosque.jumuah_khutbah_1,
      salah: mosque.jumuah_salah_1,
    },
    {
      label: "Jumu’ah 2",
      khutbah: mosque.jumuah_khutbah_2,
      salah: mosque.jumuah_salah_2,
    },
    {
      label: "Jumu’ah 3",
      khutbah: mosque.jumuah_khutbah_3,
      salah: mosque.jumuah_salah_3,
    },
  ].filter(
    (slot) =>
      cleanText(slot.khutbah, 20) ||
      cleanText(slot.salah, 20)
  );
}

function buildMosqueJsonLd({
  mosque,
  cityName,
  cityCountry,
  pageUrl,
  googleMapsUrl,
}: {
  mosque: MosqueRow;
  cityName: string | null;
  cityCountry: string;
  pageUrl: string;
  googleMapsUrl: string | null;
}): Record<string, unknown> {
  const address: Record<string, string> = {};

  const streetAddress = cleanText(mosque.address, 500);
  const addressRegion = cleanText(mosque.area, 160);
  const postalCode = cleanText(mosque.postcode, 40);

  if (streetAddress) {
    address.streetAddress = streetAddress;
  }

  if (cityName) {
    address.addressLocality = cityName;
  }

  if (addressRegion) {
    address.addressRegion = addressRegion;
  }

  if (postalCode) {
    address.postalCode = postalCode;
  }

  address.addressCountry = cityCountry;

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Mosque",
    "@id": `${pageUrl}#mosque`,
    name: mosque.name ?? "Mosque",
    url: pageUrl,
    address: {
      "@type": "PostalAddress",
      ...address,
    },
  };

  const telephone = cleanText(mosque.phone, 80);
  const website = normaliseExternalUrl(mosque.website);

  if (telephone) {
    jsonLd.telephone = telephone;
  }

  if (website) {
    jsonLd.sameAs = [website];
  }

  if (googleMapsUrl) {
    jsonLd.hasMap = googleMapsUrl;
  }

  if (
    typeof mosque.latitude === "number" &&
    Number.isFinite(mosque.latitude) &&
    typeof mosque.longitude === "number" &&
    Number.isFinite(mosque.longitude)
  ) {
    jsonLd.geo = {
      "@type": "GeoCoordinates",
      latitude: mosque.latitude,
      longitude: mosque.longitude,
    };
  }

  return jsonLd;
}

function buildBreadcrumbJsonLd({
  siteUrl,
  mosqueName,
  cityName,
  citySlug,
  pageUrl,
}: {
  siteUrl: string;
  mosqueName: string;
  cityName: string | null;
  citySlug: string | null;
  pageUrl: string;
}): Record<string, unknown> {
  const items: Array<Record<string, unknown>> = [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: siteUrl,
    },
  ];

  if (cityName && citySlug) {
    items.push({
      "@type": "ListItem",
      position: items.length + 1,
      name: cityName,
      item: `${siteUrl}/${citySlug}`,
    });

    items.push({
      "@type": "ListItem",
      position: items.length + 1,
      name: `${cityName} mosques`,
      item: `${siteUrl}/${citySlug}/mosques`,
    });
  }

  items.push({
    "@type": "ListItem",
    position: items.length + 1,
    name: mosqueName,
    item: pageUrl,
  });

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items,
  };
}

function serialiseJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function getLiveSummaryItems(
  live: ReturnType<typeof buildLiveStatus>
): LiveSummaryItem[] {
  const candidates: LiveSummaryItem[] = [
    {
      key: "iqamah",
      label: "Iqamah started",
      count: live.counts.iqamah,
      tone: "green",
    },
    {
      key: "khutbah",
      label: "Khutbah live",
      count: live.counts.khutbah,
      tone: "purple",
    },
    {
      key: "full",
      label: "Prayer space full",
      count: live.counts.full,
      tone: "red",
    },
    {
      key: "correction",
      label: "Time correction reported",
      count: live.counts.correction,
      tone: "yellow",
    },
    {
      key: "parking_full",
      label: "Parking full",
      count: live.counts.parking_full,
      tone: "orange",
    },
    {
      key: "jumuah_first",
      label: "First Jumu’ah",
      count: live.counts.jumuah_first,
      tone: "cyan",
    },
    {
      key: "jumuah_second",
      label: "Second Jumu’ah",
      count: live.counts.jumuah_second,
      tone: "blue",
    },
    {
      key: "jumuah_third",
      label: "Third Jumu’ah",
      count: live.counts.jumuah_third,
      tone: "indigo",
    },
  ];

  return candidates.filter((item) => item.count > 0);
}

function getPrayerDataCompletion(
  prayerTimes: MosquePrayerTimeRow | null
): {
  available: number;
  total: number;
  percentage: number;
} {
  const values = prayerTimes
    ? [
        prayerTimes.fajr_begins,
        prayerTimes.fajr_iqamah,
        prayerTimes.sunrise,
        prayerTimes.dhuhr_begins,
        prayerTimes.dhuhr_iqamah,
        prayerTimes.asr_begins,
        prayerTimes.asr_iqamah,
        prayerTimes.maghrib_begins,
        prayerTimes.maghrib_iqamah,
        prayerTimes.isha_begins,
        prayerTimes.isha_iqamah,
      ]
    : [];

  const available = values.filter((value) =>
    Boolean(cleanText(value, 20))
  ).length;

  const total = 11;

  return {
    available,
    total,
    percentage: Math.round((available / total) * 100),
  };
}

function getMonthCoveragePercentage(
  publishedRows: number,
  daysInMonth: number
): number {
  if (daysInMonth <= 0) {
    return 0;
  }

  return Math.min(
    100,
    Math.round((publishedRows / daysInMonth) * 100)
  );
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;

  if (!isSafeSlug(slug)) {
    return {
      title: "Mosque Not Found | SalahNearMe",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const supabase = supabasePublic();

  const { data, error } = await supabase
    .from("mosques")
    .select(
      `
      name,
      slug,
      city,
      area,
      postcode,
      cities:city_id (
        slug,
        name,
        country
      )
    `
    )
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) {
    return {
      title: "Mosque Not Found | SalahNearMe",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const mosque = data as unknown as Pick<
    MosqueRow,
    "name" | "slug" | "city" | "area" | "postcode" | "cities"
  >;

  const cityName =
    cleanText(mosque.cities?.name, 160) ??
    cleanText(mosque.city, 160);

  const mosqueName =
    cleanText(mosque.name, 200) ?? "Mosque";

  const place = [
    mosque.area,
    cityName,
    mosque.postcode,
  ]
    .map((value) => cleanText(value, 160))
    .filter((value): value is string => Boolean(value))
    .join(", ");

  const title = `${mosqueName}${
    place ? ` | ${place}` : ""
  } | SalahNearMe`;

  const description = buildMosqueDescription(
    mosqueName,
    place || null
  );

  const siteUrl = getSiteUrl();
  const canonicalPath = `/mosque/${slug}`;
  const canonicalUrl = `${siteUrl}${canonicalPath}`;

  return {
    metadataBase: new URL(siteUrl),
    title,
    description,
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: "website",
      siteName: "SalahNearMe",
      locale: "en_GB",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function MosquePage({
  params,
}: PageProps) {
  const { slug } = await params;

  if (!isSafeSlug(slug)) {
    notFound();
  }

  const supabase = supabasePublic();

  const { data: mosqueRaw, error: mosqueError } =
    await supabase
      .from("mosques")
      .select(
        `
        id,
        name,
        slug,
        area,
        city,
        postcode,
        address,
        maps_url,
        latitude,
        longitude,
        phone,
        website,
        country,
        timezone,
        womens_space,
        parking,
        wheelchair_access,
        verified_status,
        source,
        area_hint,
        children_classes,
        nikah_service,
        janazah_service,
        wudu_facilities,
        sisters_entrance,
        imam_name,
        languages,
        facilities_notes,
        jumuah_enabled,
        jumuah_khutbah_1,
        jumuah_salah_1,
        jumuah_khutbah_2,
        jumuah_salah_2,
        jumuah_khutbah_3,
        jumuah_salah_3,
        jumuah_notes,
        city_id,
        cities:city_id (
          slug,
          name,
          country
        )
      `
      )
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();

  if (mosqueError) {
    console.error("Mosque profile load failed:", {
      slug,
      code: mosqueError.code,
      message: mosqueError.message,
    });

    return (
      <ErrorPanel
        title="Mosque profile temporarily unavailable"
        message="We could not load this mosque profile at the moment. Please try again shortly."
      />
    );
  }

  if (!mosqueRaw) {
    notFound();
  }

  const mosque = mosqueRaw as unknown as MosqueRow;
  const mosqueName =
    cleanText(mosque.name, 200) ?? "Mosque";

  const citySlug = getCitySlug(mosque);
  const cityName = getCityName(mosque);
  const cityCountry = getCityCountry(mosque);
  const safeTimezone = getSafeTimezone(mosque.timezone);

  const googleMapsUrl = buildGoogleMapsUrl(
    mosque,
    cityName
  );

  const appleMapsUrl = buildAppleMapsUrl(
    mosque,
    cityName
  );

  const mosqueWebsiteUrl = normaliseExternalUrl(
    mosque.website
  );

  const telephoneHref = buildTelephoneHref(
    mosque.phone
  );

  const today = getTodayDateForTimezone(
    safeTimezone
  );

  const displayDate = formatDisplayDate(
    today,
    safeTimezone
  );

  const currentMonthRange =
    getCurrentMonthRange(today);

  const [
    liveReportsResult,
    todaysPrayerTimesResult,
    currentMonthPublishedCountResult,
    jumuahTimesResult,
    sponsoredBusinessesResult,
  ] = await Promise.all([
    supabase
      .from("mosque_live_reports")
      .select("report_type, created_at")
      .eq("mosque_id", mosque.id)
      .order("created_at", {
        ascending: false,
      })
      .limit(MAX_LIVE_REPORTS),

    supabase
      .from("mosque_prayer_times")
      .select("*")
      .eq("mosque_id", mosque.id)
      .eq("prayer_date", today)
      .maybeSingle(),

    supabase
      .from("mosque_prayer_times")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("mosque_id", mosque.id)
      .gte(
        "prayer_date",
        currentMonthRange.startDate
      )
      .lte(
        "prayer_date",
        currentMonthRange.endDate
      ),

    supabase
      .from("mosque_jumuah_times")
      .select("*")
      .eq("mosque_id", mosque.id)
      .eq("active", true)
      .order("salah_time", {
        ascending: true,
      }),

    supabase
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
        featured,
        featured_rank,
        website,
        maps_url,
        phone,
        pricing_tier,
        paid_until,
        is_verified,
        sponsor_mosque_id,
        logo_url,
        cover_image_url,
        gallery_urls
      `
      )
      .eq("sponsor_mosque_id", mosque.id)
      .eq("is_active", true)
      .eq("is_live", true)
      .order("name", {
        ascending: true,
      })
      .limit(MAX_SPONSORED_BUSINESSES),
  ]);

  const loadWarnings: LoadWarning[] = [];

  if (liveReportsResult.error) {
    loadWarnings.push({
      key: "live",
      message:
        "Live community updates are temporarily unavailable.",
    });

    console.warn("Mosque live reports unavailable:", {
      mosqueId: mosque.id,
      code: liveReportsResult.error.code,
      message: liveReportsResult.error.message,
    });
  }

  if (todaysPrayerTimesResult.error) {
    loadWarnings.push({
      key: "today",
      message:
        "Today’s mosque timetable could not be loaded.",
    });

    console.warn("Today timetable unavailable:", {
      mosqueId: mosque.id,
      date: today,
      code: todaysPrayerTimesResult.error.code,
      message: todaysPrayerTimesResult.error.message,
    });
  }

  if (currentMonthPublishedCountResult.error) {
    loadWarnings.push({
      key: "month",
      message:
        "Monthly timetable coverage could not be checked.",
    });

    console.warn("Monthly timetable count unavailable:", {
      mosqueId: mosque.id,
      code: currentMonthPublishedCountResult.error.code,
      message:
        currentMonthPublishedCountResult.error.message,
    });
  }

  if (jumuahTimesResult.error) {
    loadWarnings.push({
      key: "jumuah",
      message:
        "Official Jumu’ah sessions could not be loaded.",
    });

    console.warn("Jumuah timetable unavailable:", {
      mosqueId: mosque.id,
      code: jumuahTimesResult.error.code,
      message: jumuahTimesResult.error.message,
    });
  }

  if (sponsoredBusinessesResult.error) {
    console.warn("Mosque sponsors unavailable:", {
      mosqueId: mosque.id,
      code: sponsoredBusinessesResult.error.code,
      message: sponsoredBusinessesResult.error.message,
    });
  }

  const liveReports = (
    liveReportsResult.data ?? []
  )
    .filter(
      (report): report is LiveReportRow =>
        typeof report.report_type === "string" &&
        typeof report.created_at === "string"
    )
    .map((report) => ({
      report_type: report.report_type,
      created_at: report.created_at,
    }));

  const live = buildLiveStatus(liveReports);
  const liveSummaryItems =
    getLiveSummaryItems(live);

  const prayerTimes = todaysPrayerTimesResult.error
    ? null
    : ((todaysPrayerTimesResult.data as
        | MosquePrayerTimeRow
        | null) ?? null);

  const currentMonthPublishedCount =
    currentMonthPublishedCountResult.error
      ? 0
      : currentMonthPublishedCountResult.count ?? 0;

  const officialJumuahTimes =
    jumuahTimesResult.error
      ? []
      : ((jumuahTimesResult.data ??
          []) as MosqueJumuahTimeRow[]);

  let businessesToShow =
    sponsoredBusinessesResult.error
      ? []
      : ((sponsoredBusinessesResult.data ??
          []) as unknown as BusinessCard[]);

  let sectionTitle =
    "Sponsored Halal Businesses";

  let sectionDescription =
    "These businesses support this mosque page and are ranked by active sponsorship level and placement.";

  if (
    businessesToShow.length === 0 &&
    cityName
  ) {
    const {
      data: fallbackBusinesses,
      error: fallbackBusinessesError,
    } = await supabase
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
        featured,
        featured_rank,
        website,
        maps_url,
        phone,
        pricing_tier,
        paid_until,
        is_verified,
        sponsor_mosque_id,
        logo_url,
        cover_image_url,
        gallery_urls
      `
      )
      .eq("city", cityName)
      .eq("is_active", true)
      .eq("is_live", true)
      .order("name", {
        ascending: true,
      })
      .limit(MAX_FALLBACK_BUSINESSES);

    if (fallbackBusinessesError) {
      console.warn(
        "Fallback city businesses unavailable:",
        {
          mosqueId: mosque.id,
          cityName,
          code: fallbackBusinessesError.code,
          message: fallbackBusinessesError.message,
        }
      );
    } else {
      businessesToShow =
        (fallbackBusinesses ??
          []) as unknown as BusinessCard[];

      sectionTitle = `Halal Businesses in ${cityName}`;

      sectionDescription =
        "Approved halal businesses near this mosque. Sponsored and featured placements receive stronger visibility.";
    }
  }

  businessesToShow = sortBusinessesByRank(
    businessesToShow,
    {
      mosqueId: mosque.id,
      cityName,
    }
  ).slice(0, MAX_SPONSORED_BUSINESSES);

  const fallbackJumuahCards =
    getFallbackJumuahCards(mosque);

  const monthlyTimetableHref = mosque.slug
    ? `/mosque/${mosque.slug}/timetable?month=${currentMonthRange.month}&year=${currentMonthRange.year}`
    : null;

  const siteUrl = getSiteUrl();
  const pageUrl = `${siteUrl}/mosque/${mosque.slug}`;

  const mosqueJsonLd = buildMosqueJsonLd({
    mosque,
    cityName,
    cityCountry,
    pageUrl,
    googleMapsUrl,
  });

  const breadcrumbJsonLd =
    buildBreadcrumbJsonLd({
      siteUrl,
      mosqueName,
      cityName,
      citySlug,
      pageUrl,
    });

  const locationLabel = buildLocationLabel(
    {
      area: mosque.area,
      city: mosque.city,
      postcode: mosque.postcode,
    },
    cityName
  );

  const prayerCompletion =
    getPrayerDataCompletion(prayerTimes);

  const monthCoverage =
    getMonthCoveragePercentage(
      currentMonthPublishedCount,
      currentMonthRange.daysInMonth
    );

  const verificationLabel =
    formatLabel(mosque.verified_status) ??
    "Awaiting verification";

  const sourceLabel =
    formatLabel(mosque.source);

  return (
    <main className="space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serialiseJsonLd(mosqueJsonLd),
        }}
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serialiseJsonLd(
            breadcrumbJsonLd
          ),
        }}
      />

      <Breadcrumbs
        mosqueName={mosqueName}
        cityName={cityName}
        citySlug={citySlug}
      />

      <section className="luxe-card relative isolate overflow-hidden rounded-[2rem] border border-yellow-500/20 p-6 sm:p-8 lg:p-10">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,0.18),transparent_36%),radial-gradient(circle_at_bottom_left,rgba(6,182,212,0.08),transparent_30%)]"
        />

        <div
          aria-hidden="true"
          className="absolute -right-24 -top-24 -z-10 h-72 w-72 rounded-full border border-yellow-400/10"
        />

        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_21rem] xl:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>
                Mosque profile
              </Badge>

              <Badge
                variant={
                  verificationLabel
                    .toLowerCase()
                    .includes("verified")
                    ? "green"
                    : "yellow"
                }
              >
                {verificationLabel}
              </Badge>

              {live.hasLive ? (
                <Badge variant="cyan">
                  Live updates active
                </Badge>
              ) : null}
            </div>

            <h1
              dir="auto"
              className="mt-5 max-w-5xl text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl"
            >
              {mosqueName}
            </h1>

            {locationLabel ? (
              <p className="mt-4 text-base font-medium text-white/70 sm:text-lg">
                {locationLabel}
              </p>
            ) : (
              <p className="mt-4 text-base text-white/55">
                Location details are being verified.
              </p>
            )}

            {cleanText(mosque.address, 500) ? (
              <p
                dir="auto"
                className="mt-4 max-w-3xl text-sm leading-7 text-white/70 sm:text-base"
              >
                {cleanText(mosque.address, 500)}
              </p>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-2">
              {cityName ? (
                <Badge>{cityName}</Badge>
              ) : null}

              {sourceLabel ? (
                <Badge>{sourceLabel}</Badge>
              ) : null}

              <Badge>{safeTimezone}</Badge>

              {mosque.area_hint ? (
                <Badge>
                  {cleanText(mosque.area_hint, 160)}
                </Badge>
              ) : null}
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              {monthlyTimetableHref ? (
                <Link
                  href={monthlyTimetableHref}
                  className="luxe-button min-h-11 px-5 py-3 text-sm"
                >
                  View monthly timetable
                </Link>
              ) : null}

              {googleMapsUrl ? (
                <ExternalActionLink
                  href={googleMapsUrl}
                  label="Google Maps"
                />
              ) : null}

              {appleMapsUrl ? (
                <ExternalActionLink
                  href={appleMapsUrl}
                  label="Apple Maps"
                />
              ) : null}

              {mosqueWebsiteUrl ? (
                <ExternalActionLink
                  href={mosqueWebsiteUrl}
                  label="Mosque website"
                />
              ) : null}

              {telephoneHref ? (
                <a
                  href={telephoneHref}
                  className="luxe-button-outline inline-flex min-h-11 items-center justify-center px-5 py-3 text-sm"
                >
                  Call mosque
                </a>
              ) : null}
            </div>
          </div>

          <aside className="rounded-3xl border border-white/10 bg-black/25 p-5 backdrop-blur-sm">
            <div className="text-xs font-black uppercase tracking-[0.2em] text-yellow-300">
              Today at this mosque
            </div>

            <div className="mt-3 text-xl font-black text-white">
              {displayDate}
            </div>

            <div className="mt-1 text-xs text-white/45">
              Local timezone: {safeTimezone}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <HeroMetric
                label="Today’s data"
                value={
                  prayerTimes
                    ? `${prayerCompletion.percentage}%`
                    : "Pending"
                }
                helper={
                  prayerTimes
                    ? `${prayerCompletion.available}/${prayerCompletion.total} fields`
                    : "No row published"
                }
              />

              <HeroMetric
                label="Month coverage"
                value={`${monthCoverage}%`}
                helper={`${currentMonthPublishedCount}/${currentMonthRange.daysInMonth} days`}
              />

              <HeroMetric
                label="Live confidence"
                value={formatLabel(live.confidence) ?? "None"}
                helper={
                  live.hasLive
                    ? `${liveSummaryItems.length} active signal${
                        liveSummaryItems.length === 1
                          ? ""
                          : "s"
                      }`
                    : "No recent signal"
                }
              />

              <HeroMetric
                label="Jumu’ah"
                value={String(
                  officialJumuahTimes.length ||
                    fallbackJumuahCards.length
                )}
                helper="Published sessions"
              />
            </div>
          </aside>
        </div>
      </section>

      <SectionNavigation
        hasMap={Boolean(
          googleMapsUrl ||
            (mosque.latitude !== null &&
              mosque.longitude !== null)
        )}
      />

      {loadWarnings.length > 0 ? (
        <DataNotice warnings={loadWarnings} />
      ) : null}

      <section
        id="today"
        aria-labelledby="today-heading"
        className="scroll-mt-24"
      >
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)]">
          <section className="luxe-card rounded-[2rem] p-6 sm:p-8">
            <SectionHeader
              kicker="Prayer intelligence"
              title="Today’s prayer timetable"
              description={`Mosque-specific beginning and congregation times for ${displayDate}.`}
              action={
                monthlyTimetableHref ? (
                  <Link
                    href={monthlyTimetableHref}
                    className="luxe-button shrink-0 px-5 py-3 text-sm"
                  >
                    Full timetable
                  </Link>
                ) : null
              }
            />

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <PrayerTimeCard
                prayer="Fajr"
                begins={prayerTimes?.fajr_begins}
                iqamah={prayerTimes?.fajr_iqamah}
              />

              <SingleTimeCard
                label="Sunrise"
                value={prayerTimes?.sunrise}
              />

              <PrayerTimeCard
                prayer="Dhuhr"
                begins={prayerTimes?.dhuhr_begins}
                iqamah={prayerTimes?.dhuhr_iqamah}
              />

              <PrayerTimeCard
                prayer="Asr"
                begins={prayerTimes?.asr_begins}
                iqamah={prayerTimes?.asr_iqamah}
              />

              <PrayerTimeCard
                prayer="Maghrib"
                begins={prayerTimes?.maghrib_begins}
                iqamah={prayerTimes?.maghrib_iqamah}
              />

              <PrayerTimeCard
                prayer="Isha"
                begins={prayerTimes?.isha_begins}
                iqamah={prayerTimes?.isha_iqamah}
              />
            </div>

            {prayerTimes ? (
              <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.08] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="font-bold text-emerald-200">
                      Today’s mosque timetable is available
                    </div>

                    <p className="mt-1 text-sm leading-6 text-emerald-100/65">
                      Source:{" "}
                      <span className="font-semibold text-emerald-100">
                        {formatLabel(
                          prayerTimes.source
                        ) ?? "Manual"}
                      </span>{" "}
                      · Confidence:{" "}
                      <span className="font-semibold text-emerald-100">
                        {formatLabel(
                          prayerTimes.confidence
                        ) ?? "Official"}
                      </span>
                    </p>
                  </div>

                  <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-200">
                    {prayerCompletion.percentage}% complete
                  </span>
                </div>

                {cleanText(
                  prayerTimes.notes,
                  1_000
                ) ? (
                  <p
                    dir="auto"
                    className="mt-3 border-t border-emerald-500/15 pt-3 text-sm leading-6 text-emerald-100/70"
                  >
                    {cleanText(
                      prayerTimes.notes,
                      1_000
                    )}
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-yellow-500/20 bg-yellow-500/[0.08] p-4 text-sm leading-7 text-yellow-100/80">
                No mosque-specific timetable is published for today. Check the
                full monthly timetable or confirm the prayer time directly with
                the mosque before travelling.
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-xs text-white/45">
              <span>
                Monthly coverage:{" "}
                <strong className="text-white/70">
                  {currentMonthPublishedCount} of{" "}
                  {currentMonthRange.daysInMonth} days
                </strong>
              </span>

              <span>
                Mosque date:{" "}
                <strong className="text-white/70">
                  {today}
                </strong>
              </span>
            </div>
          </section>

          <section className="luxe-card rounded-[2rem] p-6 sm:p-8">
            <SectionHeader
              kicker="Friday worship"
              title="Jumu’ah sessions"
              description="Published khutbah and salah times for Friday prayer."
            />

            <div className="mt-6 grid gap-4">
              {officialJumuahTimes.length > 0
                ? officialJumuahTimes.map(
                    (slot, index) => (
                      <JumuahCard
                        key={slot.id}
                        label={
                          slot.label ??
                          `Jumu’ah ${index + 1}`
                        }
                        khutbah={slot.khutbah_time}
                        salah={slot.salah_time}
                        notes={slot.notes}
                      />
                    )
                  )
                : fallbackJumuahCards.length > 0
                  ? fallbackJumuahCards.map(
                      (slot) => (
                        <JumuahCard
                          key={slot.label}
                          label={slot.label}
                          khutbah={slot.khutbah}
                          salah={slot.salah}
                        />
                      )
                    )
                  : (
                    <EmptyState>
                      Jumu’ah times have not been
                      added for this mosque yet.
                    </EmptyState>
                  )}
            </div>

            {cleanText(
              mosque.jumuah_notes,
              1_000
            ) ? (
              <div
                dir="auto"
                className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm leading-7 text-white/65"
              >
                {cleanText(
                  mosque.jumuah_notes,
                  1_000
                )}
              </div>
            ) : null}

            <p className="mt-4 text-xs leading-5 text-white/35">
              Friday times may change for holidays,
              special events or seasonal arrangements.
              Confirm important details directly with
              the mosque.
            </p>
          </section>
        </div>
      </section>

      <section
        id="live"
        aria-labelledby="live-heading"
        className="luxe-card scroll-mt-24 rounded-[2rem] p-6 sm:p-8"
      >
        <SectionHeader
          kicker="Community signals"
          title="Live mosque status"
          description="Recent visitor reports can help you understand whether iqamah has started, prayer space is full or parking is limited."
          trailing={
            <ConfidenceBadge
              value={live.confidence}
              active={live.hasLive}
            />
          }
        />

        {live.hasLive &&
        liveSummaryItems.length > 0 ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {liveSummaryItems.map((item) => (
              <LiveCard
                key={item.key}
                text={item.label}
                count={item.count}
                colour={item.tone}
              />
            ))}
          </div>
        ) : (
          <div className="mt-6">
            <EmptyState>
              No recent live community updates are
              available. Visitors can submit a quick
              report below.
            </EmptyState>
          </div>
        )}

        <div className="mt-6 border-t border-white/10 pt-6">
          <MosqueLiveReporter mosqueId={mosque.id} />
        </div>

        <p className="mt-4 text-xs leading-5 text-white/35">
          Live reports are community-submitted signals
          and are not official mosque announcements.
          Confirm critical information directly with
          the mosque.
        </p>
      </section>

      <section
        id="trust"
        className="scroll-mt-24"
      >
        <MosqueTrustBadges
          mosqueId={mosque.id}
          mosqueSlug={mosque.slug}
          timezone={safeTimezone}
          verifiedStatus={mosque.verified_status}
        />
      </section>

      <section
        id="location"
        className="scroll-mt-24"
      >
        <MosqueMapEmbed
          name={mosque.name}
          address={mosque.address}
          area={mosque.area}
          city={cityName}
          postcode={mosque.postcode}
          country={cityCountry}
          latitude={mosque.latitude}
          longitude={mosque.longitude}
          googleMapsUrl={googleMapsUrl}
          appleMapsUrl={appleMapsUrl}
        />
      </section>

      <section
        id="facilities"
        className="scroll-mt-24"
      >
        <MosqueFacilitiesGrid
          womens_space={mosque.womens_space}
          parking={mosque.parking}
          wheelchair_access={
            mosque.wheelchair_access
          }
          children_classes={
            mosque.children_classes
          }
          nikah_service={mosque.nikah_service}
          janazah_service={
            mosque.janazah_service
          }
          wudu_facilities={
            mosque.wudu_facilities
          }
          sisters_entrance={
            mosque.sisters_entrance
          }
          imam_name={mosque.imam_name}
          languages={mosque.languages}
          facilities_notes={
            mosque.facilities_notes
          }
        />
      </section>

      <section
        id="nearby"
        className="scroll-mt-24"
      >
        <MosqueNearbyBusinesses
          mosqueId={mosque.id}
          mosqueName={mosque.name}
          mosqueSlug={mosque.slug}
          cityName={cityName}
          latitude={mosque.latitude}
          longitude={mosque.longitude}
        />
      </section>

      <MosqueBusinessSponsors
        businesses={businessesToShow}
        title={sectionTitle}
        description={sectionDescription}
        mosqueId={mosque.id}
        mosqueSlug={mosque.slug}
        citySlug={citySlug}
      />

      <section
        id="correction"
        className="scroll-mt-24"
      >
        <MosqueCorrectionReportForm
          mosqueId={mosque.id}
          mosqueName={mosque.name}
          mosqueSlug={mosque.slug}
          source="mosque_page"
        />
      </section>

      <section className="luxe-card rounded-[2rem] p-6 sm:p-8">
        <SectionHeader
          kicker="Keep this page useful"
          title="Manage or support this mosque profile"
          description="Mosque representatives can maintain official information, while halal businesses can support local discovery through sponsorship."
        />

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <ActionPanel
            title="Claim this mosque"
            description="Are you part of this mosque’s management team? Claim the profile to update prayer times, Jumu’ah sessions, facilities and public information."
            action={
              mosque.slug ? (
                <Link
                  href={`/claim/mosque/${mosque.slug}`}
                  className="luxe-button px-5 py-3 text-sm"
                >
                  Start mosque claim
                </Link>
              ) : null
            }
          />

          <ActionPanel
            title="Support this mosque page"
            description="Sponsor this mosque profile to place your halal business in front of local visitors looking for nearby services."
            action={
              <div className="flex flex-wrap gap-3">
                {mosque.slug ? (
                  <Link
                    href={`/sponsor/mosque/${mosque.slug}`}
                    className="luxe-button px-5 py-3 text-sm"
                  >
                    Sponsor this mosque
                  </Link>
                ) : null}

                {cityName && citySlug ? (
                  <Link
                    href={`/${citySlug}/businesses`}
                    className="luxe-button-outline px-5 py-3 text-sm"
                  >
                    Browse {cityName} businesses
                  </Link>
                ) : null}
              </div>
            }
          />
        </div>
      </section>

      <RelatedLinks
        cityName={cityName}
        citySlug={citySlug}
        mosqueSlug={mosque.slug}
      />
    </main>
  );
}

function Breadcrumbs({
  mosqueName,
  cityName,
  citySlug,
}: {
  mosqueName: string;
  cityName: string | null;
  citySlug: string | null;
}) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex flex-wrap items-center gap-2 text-xs text-white/45"
    >
      <Link
        href="/"
        className="transition hover:text-yellow-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"
      >
        Home
      </Link>

      <span aria-hidden="true">/</span>

      {cityName && citySlug ? (
        <>
          <Link
            href={`/${citySlug}`}
            className="transition hover:text-yellow-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"
          >
            {cityName}
          </Link>

          <span aria-hidden="true">/</span>

          <Link
            href={`/${citySlug}/mosques`}
            className="transition hover:text-yellow-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"
          >
            Mosques
          </Link>

          <span aria-hidden="true">/</span>
        </>
      ) : null}

      <span
        aria-current="page"
        className="max-w-[18rem] truncate font-semibold text-white/70 sm:max-w-md"
      >
        {mosqueName}
      </span>
    </nav>
  );
}

function SectionNavigation({
  hasMap,
}: {
  hasMap: boolean;
}) {
  const links = [
    {
      href: "#today",
      label: "Prayer times",
    },
    {
      href: "#live",
      label: "Live status",
    },
    {
      href: "#trust",
      label: "Data trust",
    },
    ...(hasMap
      ? [
          {
            href: "#location",
            label: "Location",
          },
        ]
      : []),
    {
      href: "#facilities",
      label: "Facilities",
    },
    {
      href: "#nearby",
      label: "Nearby halal",
    },
    {
      href: "#correction",
      label: "Report correction",
    },
  ];

  return (
    <nav
      aria-label="Mosque profile sections"
      className="sticky top-2 z-20 overflow-x-auto rounded-2xl border border-white/10 bg-black/75 p-2 shadow-2xl backdrop-blur-xl"
    >
      <div className="flex min-w-max gap-2">
        {links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="rounded-xl px-4 py-2.5 text-xs font-bold text-white/60 transition hover:bg-yellow-500/10 hover:text-yellow-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"
          >
            {link.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

function DataNotice({
  warnings,
}: {
  warnings: LoadWarning[];
}) {
  return (
    <aside
      role="status"
      className="rounded-2xl border border-yellow-500/20 bg-yellow-500/[0.07] p-4"
    >
      <div className="font-bold text-yellow-100">
        Some mosque information could not be refreshed
      </div>

      <ul className="mt-2 space-y-1 text-sm leading-6 text-yellow-100/65">
        {warnings.map((warning) => (
          <li key={warning.key}>
            {warning.message}
          </li>
        ))}
      </ul>
    </aside>
  );
}

function SectionHeader({
  kicker,
  title,
  description,
  action,
  trailing,
}: {
  kicker: string;
  title: string;
  description: string;
  action?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-start sm:justify-between">
      <div className="max-w-3xl">
        <div className="text-xs font-black uppercase tracking-[0.2em] text-yellow-300">
          {kicker}
        </div>

        <h2 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">
          {title}
        </h2>

        <p className="mt-2 text-sm leading-7 text-white/55">
          {description}
        </p>
      </div>

      {action ?? trailing}
    </div>
  );
}

function HeroMetric({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-white/40">
        {label}
      </div>

      <div className="mt-2 text-xl font-black text-white">
        {value}
      </div>

      <div className="mt-1 text-[0.7rem] leading-5 text-white/40">
        {helper}
      </div>
    </div>
  );
}

function ExternalActionLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="luxe-button-outline inline-flex min-h-11 items-center justify-center px-5 py-3 text-sm"
    >
      {label}
      <span
        aria-hidden="true"
        className="ml-2 text-white/45"
      >
        ↗
      </span>
    </a>
  );
}

function ErrorPanel({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <section className="luxe-card rounded-[2rem] p-8">
      <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
        SalahNearMe
      </div>

      <h1 className="mt-4 text-3xl font-black text-white">
        {title}
      </h1>

      <p className="mt-3 max-w-2xl leading-7 text-white/70">
        {message}
      </p>

      <div className="mt-6">
        <Link
          href="/"
          className="luxe-button px-5 py-3 text-sm"
        >
          Return home
        </Link>
      </div>
    </section>
  );
}

function Badge({
  children,
  variant = "default",
}: {
  children: ReactNode;
  variant?:
    | "default"
    | "green"
    | "yellow"
    | "cyan";
}) {
  const className =
    variant === "green"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
      : variant === "yellow"
        ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-300"
        : variant === "cyan"
          ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
          : "border-white/10 bg-white/[0.045] text-white/65";

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-semibold ${className}`}
    >
      {children}
    </span>
  );
}

function ConfidenceBadge({
  value,
  active,
}: {
  value: string;
  active: boolean;
}) {
  return (
    <div
      className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-black ${
        active
          ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-200"
          : "border-white/10 bg-white/[0.04] text-white/50"
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-2 w-2 rounded-full ${
          active
            ? "bg-emerald-400"
            : "bg-white/30"
        }`}
      />

      Confidence:{" "}
      {formatLabel(value) ?? "None"}
    </div>
  );
}

function LiveCard({
  text,
  count,
  colour = "green",
}: {
  text: string;
  count: number;
  colour?: LiveTone;
}) {
  const styles: Record<
    LiveTone,
    string
  > = {
    green:
      "border-emerald-500/20 bg-emerald-500/10 text-emerald-200",
    purple:
      "border-purple-500/20 bg-purple-500/10 text-purple-200",
    red:
      "border-red-500/20 bg-red-500/10 text-red-200",
    yellow:
      "border-yellow-500/20 bg-yellow-500/10 text-yellow-200",
    orange:
      "border-orange-500/20 bg-orange-500/10 text-orange-200",
    cyan:
      "border-cyan-500/20 bg-cyan-500/10 text-cyan-200",
    blue:
      "border-blue-500/20 bg-blue-500/10 text-blue-200",
    indigo:
      "border-indigo-500/20 bg-indigo-500/10 text-indigo-200",
  };

  return (
    <article
      className={`rounded-2xl border p-4 ${styles[colour]}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="text-sm font-bold leading-6">
          {text}
        </div>

        <span className="rounded-full border border-current/20 bg-black/15 px-2.5 py-1 text-xs font-black">
          {count}
        </span>
      </div>
    </article>
  );
}

function PrayerTimeCard({
  prayer,
  begins,
  iqamah,
}: {
  prayer: string;
  begins: string | null | undefined;
  iqamah: string | null | undefined;
}) {
  return (
    <article className="group rounded-2xl border border-white/10 bg-black/25 p-4 transition hover:border-yellow-500/25 hover:bg-yellow-500/[0.035]">
      <div className="text-sm font-black text-yellow-300">
        {prayer}
      </div>

      <div className="mt-4">
        <TimeBlock
          label="Begins"
          value={begins}
          compact
        />
      </div>

      <div className="mt-4 border-t border-white/10 pt-4">
        <TimeBlock
          label="Iqamah"
          value={iqamah}
          compact
        />
      </div>
    </article>
  );
}

function SingleTimeCard({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <article className="group rounded-2xl border border-white/10 bg-black/25 p-4 transition hover:border-yellow-500/25 hover:bg-yellow-500/[0.035]">
      <div className="text-sm font-black text-yellow-300">
        {label}
      </div>

      <div className="mt-4">
        <TimeBlock
          label="Time"
          value={value}
          compact
        />
      </div>

      <p className="mt-4 border-t border-white/10 pt-4 text-xs leading-5 text-white/35">
        Beginning of daylight; no iqamah.
      </p>
    </article>
  );
}

function TimeBlock({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string | null | undefined;
  compact?: boolean;
}) {
  return (
    <div>
      <div className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-white/40">
        {label}
      </div>

      <div
        className={`mt-1 font-black tabular-nums text-white ${
          compact ? "text-xl" : "text-2xl"
        }`}
      >
        {formatTimeValue(value)}
      </div>
    </div>
  );
}

function JumuahCard({
  label,
  khutbah,
  salah,
  notes,
}: {
  label: string;
  khutbah: string | null | undefined;
  salah: string | null | undefined;
  notes?: string | null;
}) {
  const cleanNotes = cleanText(notes, 1_000);

  return (
    <article className="rounded-2xl border border-white/10 bg-black/25 p-5">
      <div className="text-xs font-black uppercase tracking-[0.2em] text-yellow-300">
        {label}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <TimeBlock
          label="Khutbah"
          value={khutbah}
        />

        <TimeBlock
          label="Salah"
          value={salah}
        />
      </div>

      {cleanNotes ? (
        <p
          dir="auto"
          className="mt-4 border-t border-white/10 pt-4 text-sm leading-6 text-white/55"
        >
          {cleanNotes}
        </p>
      ) : null}
    </article>
  );
}

function EmptyState({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-5 text-sm leading-7 text-white/55">
      {children}
    </div>
  );
}

function ActionPanel({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action: ReactNode;
}) {
  return (
    <article className="rounded-3xl border border-white/10 bg-black/25 p-6">
      <h3 className="text-xl font-black text-yellow-300">
        {title}
      </h3>

      <p className="mt-3 text-sm leading-7 text-white/60">
        {description}
      </p>

      <div className="mt-5">{action}</div>
    </article>
  );
}

function RelatedLinks({
  cityName,
  citySlug,
  mosqueSlug,
}: {
  cityName: string | null;
  citySlug: string | null;
  mosqueSlug: string | null;
}) {
  const links: Array<{
    href: string;
    label: string;
    description: string;
  }> = [];

  if (cityName && citySlug) {
    links.push(
      {
        href: `/${citySlug}/mosques`,
        label: `Mosques in ${cityName}`,
        description:
          "Compare mosque profiles, locations and available timetable information.",
      },
      {
        href: `/${citySlug}/prayer-times`,
        label: `${cityName} prayer times`,
        description:
          "See city-wide beginning times and prayer guidance.",
      },
      {
        href: `/${citySlug}/businesses`,
        label: `Halal businesses in ${cityName}`,
        description:
          "Discover approved Muslim-friendly businesses and services.",
      }
    );
  }

  if (mosqueSlug) {
    links.push({
      href: `/mosque/${mosqueSlug}/timetable`,
      label: "Mosque monthly timetable",
      description:
        "Browse the mosque’s published prayer and iqamah schedule by month.",
    });
  }

  if (links.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="related-links-heading"
      className="luxe-card rounded-[2rem] p-6 sm:p-8"
    >
      <div className="text-xs font-black uppercase tracking-[0.2em] text-yellow-300">
        Continue exploring
      </div>

      <h2
        id="related-links-heading"
        className="mt-2 text-2xl font-black text-white"
      >
        Related local pages
      </h2>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="group rounded-2xl border border-white/10 bg-black/25 p-5 transition hover:-translate-y-0.5 hover:border-yellow-500/25 hover:bg-yellow-500/[0.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"
          >
            <div className="font-black text-white transition group-hover:text-yellow-200">
              {link.label}
            </div>

            <p className="mt-2 text-xs leading-6 text-white/45">
              {link.description}
            </p>

            <div className="mt-4 text-xs font-bold text-yellow-300">
              Open page →
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}