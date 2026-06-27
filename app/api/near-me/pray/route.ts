import { NextResponse } from "next/server";

import { buildLiveStatus } from "@/lib/mosqueLive";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_RADIUS_METERS = 5000;
const MIN_RADIUS_METERS = 500;
const MAX_RADIUS_METERS = 30000;
const MAX_MOSQUE_CANDIDATES = 80;
const MAX_RETURNED_MOSQUES = 12;
const MAX_LIVE_ROWS = 250;
const BUSINESS_RADIUS_METERS = 2500;
const MAX_BUSINESS_CANDIDATES = 40;
const MAX_BUSINESS_RETURNED = 4;
const MAX_BUSINESS_LOOKUP_MOSQUES = 8;

type MosqueRow = {
  id: string;
  name: string | null;
  slug: string | null;
  area: string | null;
  city: string | null;
  postcode: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  verified_status: string | null;
  parking: boolean | null;
  womens_space: boolean | null;
  wheelchair_access: boolean | null;
};

type PrayerTimeRow = {
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
  latitude: number | null;
  longitude: number | null;
  featured: boolean | null;
  featured_rank: number | null;
  pricing_tier: string | null;
  paid_until: string | null;
  is_verified: boolean | null;
  sponsor_mosque_id: string | null;
  phone: string | null;
  website: string | null;
  maps_url: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
};

type MosqueWithDistance = MosqueRow & {
  distance_meters: number;
};

type BusinessWithDistance = BusinessRow & {
  distance_meters: number;
  distance_label: string;
};

type NextIqamah = ReturnType<typeof getNextIqamah>;

type ScoreInputSnapshot = {
  distance_meters: number;
  has_prayer_times: boolean;
  has_next_iqamah: boolean;
  next_iqamah_minutes_until: number | null;
  live_confidence: string;
  verified_status: string | null;
  has_parking: boolean;
  has_womens_space: boolean;
  has_wheelchair_access: boolean;
  nearby_business_count: number;
  timetable_confidence: string | null;
  timetable_source: string | null;
};

type LiveStatusInput = Parameters<typeof buildLiveStatus>[0];

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function cleanNumber(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return null;
  }

  return number;
}

function cleanText(value: string | null, maxLength = 80): string | null {
  if (!value) {
    return null;
  }

  const cleaned = value
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return null;
  }

  return cleaned.slice(0, maxLength);
}

function isValidLatitude(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value >= -90 && value <= 90;
}

function isValidLongitude(value: number | null): value is number {
  return (
    value !== null &&
    Number.isFinite(value) &&
    value >= -180 &&
    value <= 180
  );
}

function cleanRadius(value: number | null): number {
  if (value === null) {
    return DEFAULT_RADIUS_METERS;
  }

  if (value < MIN_RADIUS_METERS) {
    return MIN_RADIUS_METERS;
  }

  if (value > MAX_RADIUS_METERS) {
    return MAX_RADIUS_METERS;
  }

  return Math.round(value);
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getLngWindow(radiusMeters: number, latitude: number): number {
  const cosine = Math.cos((latitude * Math.PI) / 180);
  const safeCosine = Math.max(Math.abs(cosine), 0.15);

  return radiusMeters / (111000 * safeCosine);
}

function getDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const earthRadiusMeters = 6371000;
  const toRadians = (value: number) => (value * Math.PI) / 180;

  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(earthRadiusMeters * c);
}

function distanceLabel(meters: number): string {
  if (meters < 1000) {
    return `${meters}m`;
  }

  return `${(meters / 1000).toFixed(1)}km`;
}

function getTodayDateForTimezone(timezone: string | null | undefined): string {
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

function timeToMinutes(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const match = value.match(/^(\d{2}):(\d{2})/);

  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  return hour * 60 + minute;
}

function getNowMinutesForTimezone(timezone: string | null | undefined): number {
  const safeTimezone = timezone || "Europe/London";

  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: safeTimezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date());

    const hour = Number(parts.find((part) => part.type === "hour")?.value);
    const minute = Number(parts.find((part) => part.type === "minute")?.value);

    if (Number.isInteger(hour) && Number.isInteger(minute)) {
      return hour * 60 + minute;
    }
  } catch {
    // Fallback below.
  }

  const now = new Date();

  return now.getHours() * 60 + now.getMinutes();
}

function getNextIqamah(
  prayerTimes: PrayerTimeRow | null,
  timezone: string | null
) {
  if (!prayerTimes) {
    return null;
  }

  const nowMinutes = getNowMinutesForTimezone(timezone);

  const candidates = [
    {
      prayer: "Fajr",
      time: prayerTimes.fajr_iqamah ?? prayerTimes.fajr_begins,
    },
    {
      prayer: "Dhuhr",
      time: prayerTimes.dhuhr_iqamah ?? prayerTimes.dhuhr_begins,
    },
    {
      prayer: "Asr",
      time: prayerTimes.asr_iqamah ?? prayerTimes.asr_begins,
    },
    {
      prayer: "Maghrib",
      time: prayerTimes.maghrib_iqamah ?? prayerTimes.maghrib_begins,
    },
    {
      prayer: "Isha",
      time: prayerTimes.isha_iqamah ?? prayerTimes.isha_begins,
    },
  ];

  const future = candidates
    .map((candidate) => ({
      ...candidate,
      minutes: timeToMinutes(candidate.time),
    }))
    .filter(
      (
        candidate
      ): candidate is {
        prayer: string;
        time: string;
        minutes: number;
      } =>
        typeof candidate.minutes === "number" &&
        candidate.minutes >= nowMinutes
    )
    .sort((a, b) => a.minutes - b.minutes);

  const next = future[0];

  if (!next) {
    return null;
  }

  return {
    prayer: next.prayer,
    time: next.time,
    minutes_until: next.minutes - nowMinutes,
  };
}

function estimateTravelMinutes(distanceMeters: number) {
  const distanceKm = Math.max(0, distanceMeters / 1000);

  return {
    walking_minutes: Math.max(1, Math.ceil((distanceKm / 5) * 60)),
    driving_minutes: Math.max(1, Math.ceil((distanceKm / 24) * 60)),
  };
}

function scoreMosque({
  distanceMeters,
  prayerTimes,
  nextIqamah,
  liveConfidence,
  verifiedStatus,
  parking,
  womensSpace,
  wheelchairAccess,
  nearbyBusinessCount,
}: {
  distanceMeters: number;
  prayerTimes: PrayerTimeRow | null;
  nextIqamah: NextIqamah;
  liveConfidence: string;
  verifiedStatus: string | null;
  parking: boolean | null;
  womensSpace: boolean | null;
  wheelchairAccess: boolean | null;
  nearbyBusinessCount: number;
}) {
  let score = 50;

  if (distanceMeters <= 300) {
    score += 25;
  } else if (distanceMeters <= 800) {
    score += 22;
  } else if (distanceMeters <= 1500) {
    score += 18;
  } else if (distanceMeters <= 3000) {
    score += 12;
  } else if (distanceMeters <= 5000) {
    score += 7;
  } else if (distanceMeters <= 10000) {
    score += 3;
  } else {
    score -= 5;
  }

  if (prayerTimes) {
    score += 14;
  } else {
    score -= 14;
  }

  if (nextIqamah) {
    if (nextIqamah.minutes_until <= 10) {
      score += 10;
    } else if (nextIqamah.minutes_until <= 25) {
      score += 14;
    } else if (nextIqamah.minutes_until <= 45) {
      score += 10;
    } else if (nextIqamah.minutes_until <= 90) {
      score += 5;
    } else {
      score -= 2;
    }
  } else {
    score -= 6;
  }

  if (nextIqamah) {
    const { walking_minutes, driving_minutes } =
      estimateTravelMinutes(distanceMeters);

    const bufferMinutes = 3;

    if (walking_minutes + bufferMinutes <= nextIqamah.minutes_until) {
      score += 8;
    } else if (driving_minutes + bufferMinutes <= nextIqamah.minutes_until) {
      score += 5;
    } else {
      score -= 8;
    }
  }

  const confidenceText = `${prayerTimes?.confidence ?? ""} ${
    prayerTimes?.source ?? ""
  }`.toLowerCase();

  if (
    confidenceText.includes("official") ||
    confidenceText.includes("verified") ||
    confidenceText.includes("mosque")
  ) {
    score += 8;
  }

  if (
    confidenceText.includes("auto") ||
    confidenceText.includes("imported") ||
    confidenceText.includes("osm")
  ) {
    score += 2;
  }

  if (
    confidenceText.includes("needs") ||
    confidenceText.includes("low") ||
    confidenceText.includes("unverified")
  ) {
    score -= 5;
  }

  const verified = (verifiedStatus ?? "").toLowerCase();

  if (
    verified.includes("verified") ||
    verified.includes("approved") ||
    verified.includes("claimed")
  ) {
    score += 8;
  } else if (verified.includes("auto")) {
    score += 2;
  }

  if (parking) {
    score += 3;
  }

  if (womensSpace) {
    score += 4;
  }

  if (wheelchairAccess) {
    score += 3;
  }

  if (liveConfidence === "strong") {
    score += 8;
  } else if (liveConfidence === "medium") {
    score += 5;
  } else if (liveConfidence === "low") {
    score += 2;
  }

  if (nearbyBusinessCount >= 4) {
    score += 5;
  } else if (nearbyBusinessCount >= 2) {
    score += 3;
  } else if (nearbyBusinessCount === 1) {
    score += 1;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function createScoreInputs({
  mosque,
  prayerTimes,
  nextIqamah,
  liveConfidence,
  nearbyBusinessCount,
}: {
  mosque: MosqueWithDistance;
  prayerTimes: PrayerTimeRow | null;
  nextIqamah: NextIqamah;
  liveConfidence: string;
  nearbyBusinessCount: number;
}): ScoreInputSnapshot {
  return {
    distance_meters: mosque.distance_meters,
    has_prayer_times: Boolean(prayerTimes),
    has_next_iqamah: Boolean(nextIqamah),
    next_iqamah_minutes_until: nextIqamah?.minutes_until ?? null,
    live_confidence: liveConfidence,
    verified_status: mosque.verified_status,
    has_parking: Boolean(mosque.parking),
    has_womens_space: Boolean(mosque.womens_space),
    has_wheelchair_access: Boolean(mosque.wheelchair_access),
    nearby_business_count: nearbyBusinessCount,
    timetable_confidence: prayerTimes?.confidence ?? null,
    timetable_source: prayerTimes?.source ?? null,
  };
}

function categoryPriority(category: string | null): number {
  const value = (category ?? "").toLowerCase();

  if (value.includes("restaurant")) return 1;
  if (value.includes("takeaway")) return 2;
  if (value.includes("grocery") || value.includes("supermarket")) return 3;
  if (value.includes("butcher")) return 4;
  if (value.includes("book") || value.includes("islamic")) return 5;
  if (value.includes("barber") || value.includes("salon")) return 6;

  return 10;
}

function isPaidFeaturedBusiness(business: BusinessRow): boolean {
  if (!business.featured) {
    return false;
  }

  if (!business.paid_until) {
    return true;
  }

  const paidUntil = new Date(business.paid_until).getTime();

  if (!Number.isFinite(paidUntil)) {
    return false;
  }

  return paidUntil >= Date.now();
}

function businessRankScore(
  business: BusinessWithDistance,
  mosqueId: string
): number {
  let score = 0;

  if (business.sponsor_mosque_id === mosqueId) {
    score += 10000;
  }

  if (isPaidFeaturedBusiness(business)) {
    score += 5000;
  }

  if (business.is_verified) {
    score += 1000;
  }

  score -= categoryPriority(business.category) * 100;
  score -= Math.min(500, business.distance_meters / 5);

  if (typeof business.featured_rank === "number") {
    score += Math.max(0, 100 - business.featured_rank);
  }

  return score;
}

async function getNearbyBusinessesForMosque(mosque: MosqueWithDistance) {
  if (!isNumber(mosque.latitude) || !isNumber(mosque.longitude)) {
    return [];
  }

  const lat = mosque.latitude;
  const lng = mosque.longitude;
  const latWindow = BUSINESS_RADIUS_METERS / 111000;
  const lngWindow = getLngWindow(BUSINESS_RADIUS_METERS, lat);

  const { data, error } = await supabaseAdmin
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
      latitude,
      longitude,
      featured,
      featured_rank,
      pricing_tier,
      paid_until,
      is_verified,
      sponsor_mosque_id,
      phone,
      website,
      maps_url,
      logo_url,
      cover_image_url
    `
    )
    .eq("is_active", true)
    .eq("is_live", true)
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .gte("latitude", lat - latWindow)
    .lte("latitude", lat + latWindow)
    .gte("longitude", lng - lngWindow)
    .lte("longitude", lng + lngWindow)
    .limit(MAX_BUSINESS_CANDIDATES);

  if (error) {
    console.error("nearby business lookup error:", error);
    return [];
  }

  const businesses = ((data ?? []) as BusinessRow[])
    .filter(
      (business) =>
        isNumber(business.latitude) && isNumber(business.longitude)
    )
    .map((business) => {
      const distanceMeters = getDistanceMeters(
        lat,
        lng,
        business.latitude as number,
        business.longitude as number
      );

      return {
        ...business,
        distance_meters: distanceMeters,
        distance_label: distanceLabel(distanceMeters),
      };
    })
    .filter((business) => business.distance_meters <= BUSINESS_RADIUS_METERS)
    .sort((a, b) => {
      const rankA = businessRankScore(a, mosque.id);
      const rankB = businessRankScore(b, mosque.id);

      if (rankA !== rankB) {
        return rankB - rankA;
      }

      return a.distance_meters - b.distance_meters;
    });

  return businesses.slice(0, MAX_BUSINESS_RETURNED).map((business) => ({
    id: business.id,
    name: business.name,
    slug: business.slug,
    category: business.category,
    city: business.city,
    area: business.area,
    address: business.address,
    postcode: business.postcode,
    latitude: business.latitude,
    longitude: business.longitude,
    phone: business.phone,
    website: business.website,
    maps_url: business.maps_url,
    is_verified: business.is_verified,
    featured: business.featured,
    sponsor_mosque_id: business.sponsor_mosque_id,
    distance_meters: business.distance_meters,
    distance_label: business.distance_label,
  }));
}

function groupLiveRowsByMosque(rows: unknown[]) {
  const liveRowsByMosque = new Map<string, unknown[]>();

  for (const row of rows) {
    const mosqueId = String((row as { mosque_id?: unknown }).mosque_id ?? "");

    if (!mosqueId) {
      continue;
    }

    const existing = liveRowsByMosque.get(mosqueId) ?? [];
    existing.push(row);
    liveRowsByMosque.set(mosqueId, existing);
  }

  return liveRowsByMosque;
}

function buildPublicMeta(radius: number) {
  return {
    radius_meters: radius,
    max_radius_meters: MAX_RADIUS_METERS,
  };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const lat = cleanNumber(searchParams.get("lat"));
    const lng = cleanNumber(searchParams.get("lng"));
    const radius = cleanRadius(cleanNumber(searchParams.get("radius")));
    const source = cleanText(searchParams.get("source"), 80) ?? "pray_near_me";

    if (!isValidLatitude(lat) || !isValidLongitude(lng)) {
      return jsonResponse(
        {
          ok: false,
          error: "Missing or invalid lat/lng.",
          allowed: {
            lat: "number between -90 and 90",
            lng: "number between -180 and 180",
            radius: `${MIN_RADIUS_METERS}-${MAX_RADIUS_METERS} meters`,
          },
        },
        400
      );
    }

    const latWindow = radius / 111000;
    const lngWindow = getLngWindow(radius, lat);

    const { data: mosqueRowsRaw, error: mosqueError } = await supabaseAdmin
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
        latitude,
        longitude,
        timezone,
        verified_status,
        parking,
        womens_space,
        wheelchair_access
      `
      )
      .eq("is_active", true)
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .gte("latitude", lat - latWindow)
      .lte("latitude", lat + latWindow)
      .gte("longitude", lng - lngWindow)
      .lte("longitude", lng + lngWindow)
      .limit(MAX_MOSQUE_CANDIDATES);

    if (mosqueError) {
      console.error("near me mosque lookup error:", mosqueError);

      return jsonResponse(
        {
          ok: false,
          error: "Could not load nearby mosques.",
        },
        500
      );
    }

    const mosques = ((mosqueRowsRaw ?? []) as MosqueRow[])
      .filter(
        (mosque) =>
          isNumber(mosque.latitude) && isNumber(mosque.longitude)
      )
      .map((mosque) => ({
        ...mosque,
        distance_meters: getDistanceMeters(
          lat,
          lng,
          mosque.latitude as number,
          mosque.longitude as number
        ),
      }))
      .filter((mosque) => mosque.distance_meters <= radius)
      .sort((a, b) => a.distance_meters - b.distance_meters)
      .slice(0, MAX_RETURNED_MOSQUES) as MosqueWithDistance[];

    const mosqueIds = mosques.map((mosque) => mosque.id);

    if (mosqueIds.length === 0) {
      return jsonResponse({
        ok: true,
        count: 0,
        best: null,
        mosques: [],
        meta: {
          source,
          ...buildPublicMeta(radius),
        },
      });
    }

    const todayByMosque = new Map(
      mosques.map((mosque) => [
        mosque.id,
        getTodayDateForTimezone(mosque.timezone),
      ])
    );

    const uniqueTodayDates = Array.from(new Set(todayByMosque.values()));

    const { data: prayerTimesRowsRaw, error: prayerTimesError } =
      await supabaseAdmin
        .from("mosque_prayer_times")
        .select("*")
        .in("mosque_id", mosqueIds)
        .in("prayer_date", uniqueTodayDates);

    if (prayerTimesError) {
      console.error("near me prayer times lookup error:", prayerTimesError);
    }

    const prayerTimeMap = new Map<string, PrayerTimeRow>();

    ((prayerTimesRowsRaw ?? []) as PrayerTimeRow[]).forEach((row) => {
      prayerTimeMap.set(`${row.mosque_id}:${row.prayer_date}`, row);
    });

    const { data: liveRowsRaw, error: liveRowsError } = await supabaseAdmin
      .from("mosque_live_reports")
      .select("mosque_id, report_type, created_at")
      .in("mosque_id", mosqueIds)
      .order("created_at", {
        ascending: false,
      })
      .limit(MAX_LIVE_ROWS);

    if (liveRowsError) {
      console.error("near me live reports lookup error:", liveRowsError);
    }

    const liveRowsByMosque = groupLiveRowsByMosque(liveRowsRaw ?? []);

    const businessResults = await Promise.all(
      mosques.slice(0, MAX_BUSINESS_LOOKUP_MOSQUES).map(async (mosque) => ({
        mosqueId: mosque.id,
        businesses: await getNearbyBusinessesForMosque(mosque),
      }))
    );

    const businessesByMosque = new Map(
      businessResults.map((result) => [result.mosqueId, result.businesses])
    );

    const enriched = mosques
      .map((mosque) => {
        const today =
          todayByMosque.get(mosque.id) ??
          getTodayDateForTimezone(mosque.timezone);

        const prayerTimes = prayerTimeMap.get(`${mosque.id}:${today}`) ?? null;
        const nextIqamah = getNextIqamah(prayerTimes, mosque.timezone);

        const liveInput = (liveRowsByMosque.get(mosque.id) ??
          []) as LiveStatusInput;

        const live = buildLiveStatus(liveInput);
        const nearbyBusinesses = businessesByMosque.get(mosque.id) ?? [];

        const score = scoreMosque({
          distanceMeters: mosque.distance_meters,
          prayerTimes,
          nextIqamah,
          liveConfidence: live.confidence,
          verifiedStatus: mosque.verified_status,
          parking: mosque.parking,
          womensSpace: mosque.womens_space,
          wheelchairAccess: mosque.wheelchair_access,
          nearbyBusinessCount: nearbyBusinesses.length,
        });

        const scoreInputs = createScoreInputs({
          mosque,
          prayerTimes,
          nextIqamah,
          liveConfidence: live.confidence,
          nearbyBusinessCount: nearbyBusinesses.length,
        });

        return {
          id: mosque.id,
          name: mosque.name,
          slug: mosque.slug,
          area: mosque.area,
          city: mosque.city,
          postcode: mosque.postcode,
          address: mosque.address,
          latitude: mosque.latitude,
          longitude: mosque.longitude,
          timezone: mosque.timezone,
          verified_status: mosque.verified_status,
          facilities: {
            parking: mosque.parking,
            womens_space: mosque.womens_space,
            wheelchair_access: mosque.wheelchair_access,
          },
          distance_meters: mosque.distance_meters,
          distance_label: distanceLabel(mosque.distance_meters),
          today,
          prayer_times: prayerTimes,
          next_iqamah: nextIqamah,
          live,
          salah_score: score,
          score_inputs: scoreInputs,
          nearby_businesses: nearbyBusinesses,
        };
      })
      .sort((a, b) => {
        if (b.salah_score !== a.salah_score) {
          return b.salah_score - a.salah_score;
        }

        return a.distance_meters - b.distance_meters;
      });

    return jsonResponse({
      ok: true,
      count: enriched.length,
      best: enriched[0] ?? null,
      mosques: enriched,
      meta: {
        source,
        ...buildPublicMeta(radius),
      },
    });
  } catch (error) {
    console.error("near me pray route error:", error);

    return jsonResponse(
      {
        ok: false,
        error: "Could not load nearby prayer recommendations.",
      },
      500
    );
  }
}