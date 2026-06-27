import type { Metadata } from "next";
import type { ReactNode } from "react";

import Link from "next/link";
import { notFound } from "next/navigation";

import BusinessTrackedLink from "@/components/BusinessTrackedLink";
import MosqueBusinessSponsors from "@/components/MosqueBusinessSponsors";
import MosqueCorrectionReportForm from "@/components/MosqueCorrectionReportForm";
import MosqueFacilitiesGrid from "@/components/MosqueFacilitiesGrid";
import MosqueLiveReporter from "@/components/MosqueLiveReporter";
import MosqueMapEmbed from "@/components/MosqueMapEmbed";
import MosqueNearbyBusinesses from "@/components/MosqueNearbyBusinesses";
import MosqueTrustBadges from "@/components/MosqueTrustBadges";

import { sortBusinessesByRank } from "@/lib/businessRanking";
import { buildLiveStatus } from "@/lib/mosqueLive";
import { supabasePublic } from "@/lib/supabaseServer";

export const revalidate = 300;

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

function formatLabel(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return value
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function formatTimeValue(value: string | null | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return "—";
  }

  if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed.slice(0, 5);
  }

  return trimmed;
}

function normaliseExternalUrl(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

function getTodayDateForTimezone(timezone: string | null | undefined) {
  const safeTimezone = timezone || "Europe/London";

  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: safeTimezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());

    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;

    if (year && month && day) {
      return `${year}-${month}-${day}`;
    }
  } catch {
    // Fallback below.
  }

  return new Date().toISOString().slice(0, 10);
}

function getCurrentMonthRange(dateValue: string) {
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
    const fallbackYear = fallback.getFullYear();
    const fallbackMonth = fallback.getMonth() + 1;
    const lastDay = new Date(fallbackYear, fallbackMonth, 0).getDate();

    return {
      year: fallbackYear,
      month: fallbackMonth,
      startDate: `${fallbackYear}-${String(fallbackMonth).padStart(2, "0")}-01`,
      endDate: `${fallbackYear}-${String(fallbackMonth).padStart(
        2,
        "0"
      )}-${String(lastDay).padStart(2, "0")}`,
    };
  }

  const lastDay = new Date(year, month, 0).getDate();

  return {
    year,
    month,
    startDate: `${year}-${String(month).padStart(2, "0")}-01`,
    endDate: `${year}-${String(month).padStart(2, "0")}-${String(
      lastDay
    ).padStart(2, "0")}`,
  };
}

function buildDirectionsLabel(
  mosque: Pick<MosqueRow, "area" | "city" | "postcode">
) {
  return [mosque.area, mosque.city, mosque.postcode]
    .filter(Boolean)
    .join(" • ");
}

function buildPlaceQuery(mosque: MosqueRow, cityName?: string | null) {
  return [
    mosque.name,
    mosque.address,
    mosque.area,
    cityName ?? mosque.city,
    mosque.postcode,
    mosque.country,
  ]
    .filter(Boolean)
    .join(", ");
}

function buildGoogleMapsUrl(mosque: MosqueRow, cityName?: string | null) {
  const savedMapsUrl = normaliseExternalUrl(mosque.maps_url);

  if (savedMapsUrl) {
    return savedMapsUrl;
  }

  if (
    typeof mosque.latitude === "number" &&
    typeof mosque.longitude === "number"
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

function buildAppleMapsUrl(mosque: MosqueRow, cityName?: string | null) {
  if (
    typeof mosque.latitude === "number" &&
    typeof mosque.longitude === "number"
  ) {
    return `https://maps.apple.com/?q=${encodeURIComponent(
      mosque.name ?? "Mosque"
    )}&ll=${mosque.latitude},${mosque.longitude}`;
  }

  const query = buildPlaceQuery(mosque, cityName);

  return query ? `https://maps.apple.com/?q=${encodeURIComponent(query)}` : null;
}

function getCitySlug(mosque: MosqueRow) {
  return mosque.cities?.slug ?? null;
}

function getCityName(mosque: MosqueRow) {
  return mosque.cities?.name ?? mosque.city ?? null;
}

function getCityCountry(mosque: MosqueRow) {
  return mosque.cities?.country ?? mosque.country ?? "United Kingdom";
}

export async function generateStaticParams() {
  const supabase = supabasePublic();

  const { data } = await supabase
    .from("mosques")
    .select("slug")
    .not("slug", "is", null)
    .eq("is_active", true);

  return (data ?? [])
    .filter((mosque) => Boolean(mosque.slug))
    .map((mosque) => ({
      slug: mosque.slug as string,
    }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = supabasePublic();

  const { data } = await supabase
    .from("mosques")
    .select(
      `
      name,
      slug,
      city,
      area,
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

  if (!data) {
    return {
      title: "Mosque Not Found | SalahNearMe",
    };
  }

  const mosque = data as unknown as Pick<
    MosqueRow,
    "name" | "slug" | "city" | "area" | "cities"
  >;

  const cityName = mosque.cities?.name ?? mosque.city ?? null;
  const place = [mosque.area, cityName].filter(Boolean).join(", ");

  const title = `${mosque.name ?? "Mosque"}${
    place ? ` | ${place}` : ""
  } | SalahNearMe`;

  const description = `View ${mosque.name ?? "this mosque"}${
    place ? ` in ${place}` : ""
  }: location, directions, live community status, facilities, Jumu’ah times, monthly timetable, trust badges, correction reports, and nearby halal businesses.`;

  return {
    title,
    description,
    alternates: {
      canonical: `/mosque/${slug}`,
    },
    openGraph: {
      title,
      description,
      url: `/mosque/${slug}`,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function MosquePage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = supabasePublic();

  const { data: mosqueRaw, error: mosqueError } = await supabase
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
    return <pre className="text-white/80">{mosqueError.message}</pre>;
  }

  if (!mosqueRaw) {
    notFound();
  }

  const mosque = mosqueRaw as unknown as MosqueRow;

  const citySlug = getCitySlug(mosque);
  const cityName = getCityName(mosque);
  const cityCountry = getCityCountry(mosque);

  const googleMapsUrl = buildGoogleMapsUrl(mosque, cityName);
  const appleMapsUrl = buildAppleMapsUrl(mosque, cityName);
  const mosqueWebsiteUrl = normaliseExternalUrl(mosque.website);

  const { data: liveReports } = await supabase
    .from("mosque_live_reports")
    .select("report_type, created_at")
    .eq("mosque_id", mosque.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const live = buildLiveStatus(liveReports ?? []);

  const today = getTodayDateForTimezone(mosque.timezone);
  const currentMonthRange = getCurrentMonthRange(today);

  const { data: todaysPrayerTimes } = await supabase
    .from("mosque_prayer_times")
    .select("*")
    .eq("mosque_id", mosque.id)
    .eq("prayer_date", today)
    .maybeSingle();

  const { count: currentMonthPublishedCount } = await supabase
    .from("mosque_prayer_times")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("mosque_id", mosque.id)
    .gte("prayer_date", currentMonthRange.startDate)
    .lte("prayer_date", currentMonthRange.endDate);

  const { data: jumuahTimes } = await supabase
    .from("mosque_jumuah_times")
    .select("*")
    .eq("mosque_id", mosque.id)
    .eq("active", true)
    .order("salah_time", {
      ascending: true,
    });

  const prayerTimes = todaysPrayerTimes as MosquePrayerTimeRow | null;
  const officialJumuahTimes = (jumuahTimes ?? []) as MosqueJumuahTimeRow[];

  const { data: sponsoredBusinesses } = await supabase
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
    .order("name", { ascending: true })
    .limit(6);

  let businessesToShow = (sponsoredBusinesses ?? []) as unknown as BusinessCard[];
  let sectionTitle = "Sponsored Halal Businesses";
  let sectionDescription =
    "These businesses are supporting this mosque and are ranked by active sponsorship level and placement.";

  if (businessesToShow.length === 0 && cityName) {
    const { data: fallbackBusinesses } = await supabase
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
      .order("name", { ascending: true })
      .limit(12);

    businessesToShow = (fallbackBusinesses ?? []) as unknown as BusinessCard[];
    sectionTitle = "Featured Halal Businesses";
    sectionDescription =
      "Approved halal businesses in this city. Sponsored and featured placements receive stronger visibility.";
  }

  businessesToShow = sortBusinessesByRank(businessesToShow, {
    mosqueId: mosque.id,
    cityName,
  }).slice(0, 6);

  const fallbackJumuahCards = [
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
  ];

  const monthlyTimetableHref = mosque.slug
    ? `/mosque/${mosque.slug}/timetable?month=${currentMonthRange.month}&year=${currentMonthRange.year}`
    : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Mosque",
    name: mosque.name ?? "Mosque",
    address: {
      "@type": "PostalAddress",
      streetAddress: mosque.address ?? undefined,
      addressLocality: cityName ?? undefined,
      postalCode: mosque.postcode ?? undefined,
      addressCountry: cityCountry ?? undefined,
    },
    geo:
      typeof mosque.latitude === "number" &&
      typeof mosque.longitude === "number"
        ? {
            "@type": "GeoCoordinates",
            latitude: mosque.latitude,
            longitude: mosque.longitude,
          }
        : undefined,
    url: `https://www.salahnearme.com/mosque/${mosque.slug}`,
    telephone: mosque.phone ?? undefined,
  };

  return (
    <div className="space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd),
        }}
      />

      <section className="luxe-card relative overflow-hidden rounded-3xl p-8 md:p-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,0.16),transparent_38%)]" />

        <div className="relative z-10">
          <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
            Mosque Profile
          </div>

          <h1
            dir="auto"
            className="mt-4 text-4xl font-black tracking-tight text-white md:text-6xl"
          >
            {mosque.name ?? "Mosque"}
          </h1>

          <div className="mt-4 text-lg text-white/70">
            {buildDirectionsLabel({
              area: mosque.area,
              city: cityName,
              postcode: mosque.postcode,
            })}
          </div>

          {mosque.address ? (
            <div className="mt-4 max-w-3xl text-white/80">
              {mosque.address}
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-2">
            {cityName ? <Badge>{cityName}</Badge> : null}

            {mosque.verified_status ? (
              <Badge variant="green">{formatLabel(mosque.verified_status)}</Badge>
            ) : null}

            {mosque.source ? <Badge>{formatLabel(mosque.source)}</Badge> : null}

            {mosque.timezone ? <Badge>{mosque.timezone}</Badge> : null}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            {cityName && citySlug ? (
              <Link href={`/${citySlug}`} className="luxe-button text-sm">
                View {cityName}
              </Link>
            ) : null}

            {cityName && citySlug ? (
              <Link
                href={`/${citySlug}/mosques`}
                className="luxe-button-outline text-sm"
              >
                All mosques in {cityName}
              </Link>
            ) : null}

            {monthlyTimetableHref ? (
              <Link href={monthlyTimetableHref} className="luxe-button text-sm">
                Monthly timetable
              </Link>
            ) : null}

            {googleMapsUrl ? (
              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noreferrer"
                className="luxe-button-outline text-sm"
              >
                Google Maps
              </a>
            ) : null}

            {appleMapsUrl ? (
              <a
                href={appleMapsUrl}
                target="_blank"
                rel="noreferrer"
                className="luxe-button-outline text-sm"
              >
                Apple Maps
              </a>
            ) : null}

            {mosqueWebsiteUrl ? (
              <a
                href={mosqueWebsiteUrl}
                target="_blank"
                rel="noreferrer"
                className="luxe-button-outline text-sm"
              >
                Website
              </a>
            ) : null}

            {mosque.phone ? (
              <a
                href={`tel:${mosque.phone}`}
                className="luxe-button-outline text-sm"
              >
                Call
              </a>
            ) : null}
          </div>
        </div>
      </section>

      <MosqueTrustBadges
        mosqueId={mosque.id}
        mosqueSlug={mosque.slug}
        timezone={mosque.timezone}
        verifiedStatus={mosque.verified_status}
      />

      <section className="luxe-card rounded-3xl p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-2xl font-bold text-yellow-400">
              Live Community Status
            </div>

            <p className="mt-2 text-sm text-white/60">
              Community-reported live updates for this mosque.
            </p>
          </div>

          <div className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-400">
            Confidence: {live.confidence}
          </div>
        </div>

        <div className="mt-5">
          {live.hasLive ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {live.counts.iqamah > 0 ? (
                <LiveCard text={`Iqamah started (${live.counts.iqamah})`} />
              ) : null}

              {live.counts.khutbah > 0 ? (
                <LiveCard
                  text={`Khutbah live (${live.counts.khutbah})`}
                  colour="purple"
                />
              ) : null}

              {live.counts.full > 0 ? (
                <LiveCard text={`Full (${live.counts.full})`} colour="red" />
              ) : null}

              {live.counts.correction > 0 ? (
                <LiveCard
                  text={`Time incorrect (${live.counts.correction})`}
                  colour="yellow"
                />
              ) : null}

              {live.counts.parking_full > 0 ? (
                <LiveCard
                  text={`Parking full (${live.counts.parking_full})`}
                  colour="orange"
                />
              ) : null}

              {live.counts.jumuah_first > 0 ? (
                <LiveCard
                  text={`1st Jumu’ah (${live.counts.jumuah_first})`}
                  colour="cyan"
                />
              ) : null}

              {live.counts.jumuah_second > 0 ? (
                <LiveCard
                  text={`2nd Jumu’ah (${live.counts.jumuah_second})`}
                  colour="blue"
                />
              ) : null}

              {live.counts.jumuah_third > 0 ? (
                <LiveCard
                  text={`3rd Jumu’ah (${live.counts.jumuah_third})`}
                  colour="indigo"
                />
              ) : null}
            </div>
          ) : (
            <div className="luxe-card-soft rounded-2xl p-5 text-white/80">
              No live updates yet.
            </div>
          )}
        </div>

        <div className="mt-6">
          <MosqueLiveReporter mosqueId={mosque.id} />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="luxe-card rounded-3xl p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-2xl font-bold text-yellow-400">
                Prayer Times & Monthly Timetable
              </div>

              <p className="mt-2 text-white/70">
                Today’s mosque-specific prayer timetable for{" "}
                <span className="font-semibold text-white">{today}</span>.
              </p>

              {typeof currentMonthPublishedCount === "number" &&
              currentMonthPublishedCount > 0 ? (
                <p className="mt-2 text-sm text-emerald-200">
                  {currentMonthPublishedCount} timetable rows are published for
                  this month.
                </p>
              ) : (
                <p className="mt-2 text-sm text-yellow-100/80">
                  No published rows were found for this month yet.
                </p>
              )}
            </div>

            {monthlyTimetableHref ? (
              <Link
                href={monthlyTimetableHref}
                className="inline-flex shrink-0 rounded-xl border border-yellow-500/30 bg-yellow-500 px-5 py-3 text-sm font-bold text-black hover:bg-yellow-400"
              >
                View full monthly timetable
              </Link>
            ) : null}
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <PrayerTimeCard
              prayer="Fajr"
              begins={prayerTimes?.fajr_begins}
              iqamah={prayerTimes?.fajr_iqamah}
            />

            <SingleTimeCard label="Sunrise" value={prayerTimes?.sunrise} />

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
            <div className="mt-5 rounded-2xl border border-green-500/20 bg-green-500/10 p-4 text-sm text-green-200">
              Today’s mosque timetable is available. Source:{" "}
              <span className="font-semibold">
                {formatLabel(prayerTimes.source) ?? "Manual"}
              </span>{" "}
              • Confidence:{" "}
              <span className="font-semibold">
                {formatLabel(prayerTimes.confidence) ?? "Official"}
              </span>
              {prayerTimes.notes ? (
                <span className="block pt-2 text-green-100/80">
                  {prayerTimes.notes}
                </span>
              ) : null}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm text-yellow-100">
              No mosque-specific timetable has been added for today yet. Use
              the monthly timetable button to check other published dates, or
              the mosque can claim this page to add official iqamah times.
            </div>
          )}
        </section>

        <section className="luxe-card rounded-3xl p-8">
          <div className="text-2xl font-bold text-yellow-400">
            Friday Prayer Sessions
          </div>

          <div className="mt-6 grid gap-4">
            {officialJumuahTimes.length > 0
              ? officialJumuahTimes.map((slot) => (
                  <div
                    key={slot.id}
                    className="luxe-card-soft rounded-2xl p-5"
                  >
                    <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
                      {slot.label ?? "Jumu’ah"}
                    </div>

                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <TimeBlock label="Khutbah" value={slot.khutbah_time} />
                      <TimeBlock label="Salah" value={slot.salah_time} />
                    </div>

                    {slot.notes ? (
                      <div className="mt-4 text-sm text-white/60">
                        {slot.notes}
                      </div>
                    ) : null}
                  </div>
                ))
              : fallbackJumuahCards.map((slot) => (
                  <div
                    key={slot.label}
                    className="luxe-card-soft rounded-2xl p-5"
                  >
                    <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
                      {slot.label}
                    </div>

                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <TimeBlock label="Khutbah" value={slot.khutbah} />
                      <TimeBlock label="Salah" value={slot.salah} />
                    </div>
                  </div>
                ))}
          </div>

          {mosque.jumuah_notes ? (
            <div className="luxe-card-soft mt-4 rounded-2xl p-5 text-white/80">
              {mosque.jumuah_notes}
            </div>
          ) : null}
        </section>
      </section>

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

      <MosqueFacilitiesGrid
        womens_space={mosque.womens_space}
        parking={mosque.parking}
        wheelchair_access={mosque.wheelchair_access}
        children_classes={mosque.children_classes}
        nikah_service={mosque.nikah_service}
        janazah_service={mosque.janazah_service}
        wudu_facilities={mosque.wudu_facilities}
        sisters_entrance={mosque.sisters_entrance}
        imam_name={mosque.imam_name}
        languages={mosque.languages}
        facilities_notes={mosque.facilities_notes}
      />

      <MosqueNearbyBusinesses
        mosqueId={mosque.id}
        mosqueName={mosque.name}
        mosqueSlug={mosque.slug}
        cityName={cityName}
        latitude={mosque.latitude}
        longitude={mosque.longitude}
      />

      <MosqueBusinessSponsors
        businesses={businessesToShow}
        title={sectionTitle}
        description={sectionDescription}
        mosqueId={mosque.id}
        mosqueSlug={mosque.slug}
        citySlug={citySlug}
      />

      <MosqueCorrectionReportForm
        mosqueId={mosque.id}
        mosqueName={mosque.name}
        mosqueSlug={mosque.slug}
        source="mosque_page"
      />

      <section className="luxe-card rounded-3xl p-8">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="luxe-card-soft rounded-2xl p-6">
            <div className="text-xl font-bold text-yellow-400">
              Claim this mosque
            </div>

            <p className="mt-3 text-white/70">
              Are you part of this mosque management team? Claim this page to
              update prayer times, Jumu’ah sessions, facilities, and live mosque
              status.
            </p>

            {mosque.slug ? (
              <div className="mt-5">
                <Link
                  href={`/claim/mosque/${mosque.slug}`}
                  className="luxe-button text-sm"
                >
                  Claim this mosque
                </Link>
              </div>
            ) : null}
          </div>

          <div className="luxe-card-soft rounded-2xl p-6">
            <div className="text-xl font-bold text-yellow-400">
              Support This Mosque
            </div>

            <p className="mt-3 text-white/70">
              Sponsor this mosque page to place your halal business in front of
              local visitors.
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              {mosque.slug ? (
                <BusinessTrackedLink
                  businessId="platform"
                  href={`/sponsor/mosque/${mosque.slug}`}
                  eventType="sponsor_click"
                  source="mosque_page_bottom_cta"
                  pageType="mosque_page"
                  citySlug={citySlug ?? undefined}
                  className="luxe-button text-sm"
                  metadata={{
                    mosque_id: mosque.id,
                    mosque_slug: mosque.slug,
                  }}
                >
                  Sponsor this mosque
                </BusinessTrackedLink>
              ) : null}

              {cityName && citySlug ? (
                <Link
                  href={`/${citySlug}/businesses`}
                  className="luxe-button-outline text-sm"
                >
                  Browse businesses in {cityName}
                </Link>
              ) : null}
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
      : "border-yellow-500/20 bg-yellow-500/10 text-yellow-300";

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-semibold ${className}`}
    >
      {children}
    </span>
  );
}

function LiveCard({
  text,
  colour = "green",
}: {
  text: string;
  colour?:
    | "green"
    | "purple"
    | "red"
    | "yellow"
    | "orange"
    | "cyan"
    | "blue"
    | "indigo";
}) {
  const styles = {
    green: "border-green-500/20 bg-green-500/10 text-green-300",
    purple: "border-purple-500/20 bg-purple-500/10 text-purple-300",
    red: "border-red-500/20 bg-red-500/10 text-red-300",
    yellow: "border-yellow-500/20 bg-yellow-500/10 text-yellow-300",
    orange: "border-orange-500/20 bg-orange-500/10 text-orange-300",
    cyan: "border-cyan-500/20 bg-cyan-500/10 text-cyan-300",
    blue: "border-blue-500/20 bg-blue-500/10 text-blue-300",
    indigo: "border-indigo-500/20 bg-indigo-500/10 text-indigo-300",
  };

  return (
    <div className={`rounded-2xl border p-4 font-semibold ${styles[colour]}`}>
      {text}
    </div>
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
    <div className="luxe-card-soft rounded-2xl p-4">
      <div className="text-sm font-semibold text-yellow-400">{prayer}</div>

      <div className="mt-3 text-sm text-white/60">Begins:</div>
      <div className="text-lg font-semibold text-white">
        {formatTimeValue(begins)}
      </div>

      <div className="mt-3 text-sm text-white/60">Iqamah:</div>
      <div className="text-lg font-semibold text-white">
        {formatTimeValue(iqamah)}
      </div>
    </div>
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
    <div className="luxe-card-soft rounded-2xl p-4">
      <div className="text-sm font-semibold text-yellow-400">{label}</div>

      <div className="mt-3 text-sm text-white/60">Time:</div>
      <div className="text-lg font-semibold text-white">
        {formatTimeValue(value)}
      </div>
    </div>
  );
}

function TimeBlock({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-[0.2em] text-white/50">
        {label}
      </div>

      <div className="mt-2 text-xl font-semibold text-white">
        {formatTimeValue(value)}
      </div>
    </div>
  );
}