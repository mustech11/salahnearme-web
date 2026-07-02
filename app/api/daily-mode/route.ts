import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DbRow = Record<string, unknown>;

const PRAYER_KEYS = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;

type PrayerKey = (typeof PRAYER_KEYS)[number];

type CityPayload = {
  id: string | number;
  name: string;
  slug: string;
  country: string | null;
  timezone: string | null;
};

type PrayerInfo = {
  current_prayer: PrayerKey | null;
  current_prayer_label: string | null;
  next_prayer: PrayerKey | null;
  next_prayer_label: string | null;
  next_prayer_time: string | null;
  minutes_until_next: number | null;
};

type DailyContext = {
  mode: "jummah" | "morning" | "evening" | "normal";
  message: string;
  is_friday: boolean;
  is_ramadan: boolean;
};

type ScoredMosque = {
  id: unknown;
  name: string;
  slug: string | null;
  address: string | null;
  area: string | null;
  postcode: string | null;
  latitude: number | null;
  longitude: number | null;
  distance_km: number | null;
  smart_score: number;
};

type ScoredBusiness = {
  id: unknown;
  name: string;
  slug: string | null;
  city: string | null;
  category: string | null;
  area: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  gallery_urls: string[];
  media_urls: string[];
  paid_active: boolean;
  smart_score: number;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function asBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const clean = value.toLowerCase().trim();

    return clean === "true" || clean === "1" || clean === "yes";
  }

  if (typeof value === "number") {
    return value === 1;
  }

  return false;
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function cleanSlug(value: string | null) {
  if (!value) {
    return null;
  }

  const cleaned = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return cleaned.length > 0 ? cleaned : null;
}

function parseNumber(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function isValidLatitude(value: number | null) {
  return value !== null && value >= -90 && value <= 90;
}

function isValidLongitude(value: number | null) {
  return value !== null && value >= -180 && value <= 180;
}

function getDateParts(timezone?: string | null) {
  const now = new Date();

  try {
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone ?? "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const parts = formatter.formatToParts(now);

    const get = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((part) => part.type === type)?.value ?? "";

    const year = get("year");
    const month = get("month");
    const day = get("day");
    const hour = Number(get("hour"));
    const minute = Number(get("minute"));
    const weekday = get("weekday").toLowerCase();

    return {
      isoDate: `${year}-${month}-${day}`,
      hour: Number.isFinite(hour) ? hour : now.getHours(),
      minute: Number.isFinite(minute) ? minute : now.getMinutes(),
      isFriday: weekday.startsWith("fri"),
    };
  } catch {
    return {
      isoDate: now.toISOString().slice(0, 10),
      hour: now.getHours(),
      minute: now.getMinutes(),
      isFriday: now.getDay() === 5,
    };
  }
}

function parseTimeToMinutes(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const match = value.trim().match(/^(\d{1,2}):(\d{2})/);

  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return hours * 60 + minutes;
}

function formatPrayerName(prayer: PrayerKey | null) {
  if (!prayer) {
    return null;
  }

  const labels: Record<PrayerKey, string> = {
    fajr: "Fajr",
    dhuhr: "Dhuhr",
    asr: "Asr",
    maghrib: "Maghrib",
    isha: "Isha",
  };

  return labels[prayer];
}

function getPrayerValue(row: DbRow | null, key: PrayerKey) {
  if (!row) {
    return null;
  }

  const possibleKeys = [
    key,
    `${key}_time`,
    `${key}_begins`,
    `${key}_begin`,
    `${key}_start`,
    `${key}_adhan`,
  ];

  for (const possibleKey of possibleKeys) {
    const value = asString(row[possibleKey]);

    if (value) {
      return value;
    }
  }

  return null;
}

function emptyPrayerInfo(): PrayerInfo {
  return {
    current_prayer: null,
    current_prayer_label: null,
    next_prayer: null,
    next_prayer_label: null,
    next_prayer_time: null,
    minutes_until_next: null,
  };
}

function calculatePrayerInfo(row: DbRow | null, timezone?: string | null): PrayerInfo {
  if (!row) {
    return emptyPrayerInfo();
  }

  const dateParts = getDateParts(timezone);
  const currentMinutes = dateParts.hour * 60 + dateParts.minute;

  const prayerItems = PRAYER_KEYS.map((key) => {
    const value = getPrayerValue(row, key);
    const minutes = parseTimeToMinutes(value);

    return {
      key,
      value,
      minutes,
    };
  });

  const prayers: Array<{
    key: PrayerKey;
    value: string | null;
    minutes: number;
  }> = prayerItems.filter(
    (
      item
    ): item is {
      key: PrayerKey;
      value: string | null;
      minutes: number;
    } => item.minutes !== null
  );

  if (prayers.length === 0) {
    return emptyPrayerInfo();
  }

  const nextToday = prayers.find((item) => item.minutes > currentMinutes);

  if (nextToday) {
    const previousPrayer =
      [...prayers].reverse().find((item) => item.minutes <= currentMinutes) ??
      null;

    return {
      current_prayer: previousPrayer?.key ?? null,
      current_prayer_label: formatPrayerName(previousPrayer?.key ?? null),
      next_prayer: nextToday.key,
      next_prayer_label: formatPrayerName(nextToday.key),
      next_prayer_time: nextToday.value,
      minutes_until_next: nextToday.minutes - currentMinutes,
    };
  }

  const tomorrowFajr = prayers[0];

  return {
    current_prayer: "isha",
    current_prayer_label: "Isha",
    next_prayer: tomorrowFajr.key,
    next_prayer_label: formatPrayerName(tomorrowFajr.key),
    next_prayer_time: tomorrowFajr.value,
    minutes_until_next: 24 * 60 - currentMinutes + tomorrowFajr.minutes,
  };
}

function getDistanceKm(
  lat1: number | null,
  lon1: number | null,
  lat2: number | null,
  lon2: number | null
) {
  if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) {
    return null;
  }

  const earthRadiusKm = 6371;
  const toRadians = (value: number) => (value * Math.PI) / 180;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
}

function getDailyContext(timezone?: string | null): DailyContext {
  const dateParts = getDateParts(timezone);
  const hour = dateParts.hour;

  if (dateParts.isFriday) {
    return {
      mode: "jummah",
      message: "It is Friday. Check Jummah times, leave early, and support nearby halal places.",
      is_friday: true,
      is_ramadan: false,
    };
  }

  if (hour >= 4 && hour < 8) {
    return {
      mode: "morning",
      message: "Start your day with salah, dhikr, and good intentions.",
      is_friday: false,
      is_ramadan: false,
    };
  }

  if (hour >= 17 && hour < 22) {
    return {
      mode: "evening",
      message: "Check Maghrib, Isha, and nearby halal places.",
      is_friday: false,
      is_ramadan: false,
    };
  }

  return {
    mode: "normal",
    message: "Prepare for your next salah and discover what is nearby.",
    is_friday: false,
    is_ramadan: false,
  };
}

function scoreMosque(
  row: DbRow,
  userLat: number | null,
  userLng: number | null
): ScoredMosque {
  const latitude = asNumber(row.latitude ?? row.lat);
  const longitude = asNumber(row.longitude ?? row.lng);

  const distanceKm = getDistanceKm(userLat, userLng, latitude, longitude);

  let score = 0;

  if (asBoolean(row.is_verified) || asBoolean(row.verified)) {
    score += 30;
  }

  if (asBoolean(row.is_active) || row.is_active === undefined) {
    score += 10;
  }

  if (latitude !== null && longitude !== null) {
    score += 20;
  }

  if (asString(row.address)) {
    score += 10;
  }

  if (asString(row.postcode)) {
    score += 5;
  }

  if (asString(row.jummah_time) || asString(row.jumuah_time)) {
    score += 15;
  }

  if (asString(row.updated_at)) {
    score += 5;
  }

  if (distanceKm !== null) {
    if (distanceKm <= 1) {
      score += 50;
    } else if (distanceKm <= 3) {
      score += 40;
    } else if (distanceKm <= 5) {
      score += 30;
    } else if (distanceKm <= 10) {
      score += 15;
    } else if (distanceKm <= 20) {
      score += 5;
    }
  }

  return {
    id: row.id,
    name: asString(row.name) ?? "Mosque",
    slug: asString(row.slug),
    address: asString(row.address),
    area: asString(row.area),
    postcode: asString(row.postcode),
    latitude,
    longitude,
    distance_km: distanceKm !== null ? Number(distanceKm.toFixed(2)) : null,
    smart_score: score,
  };
}

function scoreBusiness(row: DbRow): ScoredBusiness {
  const paidUntilRaw = asString(row.paid_until);
  const paidUntil = paidUntilRaw ? new Date(paidUntilRaw) : null;

  const paidActive =
    paidUntil instanceof Date &&
    Number.isFinite(paidUntil.getTime()) &&
    paidUntil.getTime() > Date.now();

  const gallery = asStringArray(row.gallery_urls);
  const media = asStringArray(row.media_urls);

  let score = 0;

  if (asBoolean(row.featured) || asBoolean(row.is_featured)) {
    score += 35;
  }

  if (asBoolean(row.city_sponsor)) {
    score += 30;
  }

  if (asBoolean(row.mosque_sponsor)) {
    score += 25;
  }

  if (asBoolean(row.sponsorship_active) || paidActive) {
    score += 25;
  }

  if (asBoolean(row.is_verified) || asBoolean(row.verified)) {
    score += 20;
  }

  if (asBoolean(row.is_active) || row.is_active === undefined) {
    score += 10;
  }

  if (asString(row.phone)) {
    score += 8;
  }

  if (asString(row.website)) {
    score += 8;
  }

  if (asString(row.logo_url)) {
    score += 8;
  }

  if (asString(row.cover_image_url)) {
    score += 8;
  }

  score += Math.min(20, gallery.length * 4);
  score += Math.min(20, media.length * 4);

  const rank = asNumber(row.featured_rank ?? row.rank);

  if (rank !== null) {
    score += Math.max(0, 20 - rank);
  }

  return {
    id: row.id,
    name: asString(row.name) ?? "Business",
    slug: asString(row.slug),
    city: asString(row.city),
    category: asString(row.category),
    area: asString(row.area),
    address: asString(row.address),
    phone: asString(row.phone),
    website: asString(row.website),
    logo_url: asString(row.logo_url),
    cover_image_url: asString(row.cover_image_url),
    gallery_urls: gallery,
    media_urls: media,
    paid_active: paidActive,
    smart_score: score,
  };
}

function normaliseHadith(row: DbRow | null) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    text:
      asString(row.hadith_text) ??
      asString(row.translation) ??
      asString(row.body) ??
      asString(row.content) ??
      asString(row.english) ??
      asString(row.meaning) ??
      null,
    arabic: asString(row.arabic) ?? asString(row.arabic_text),
    source: asString(row.source) ?? asString(row.book),
    reference: asString(row.reference) ?? asString(row.ref),
  };
}

type SupabaseSingleResult = {
  data: unknown;
  error: unknown;
};

type SupabaseListResult = {
  data: unknown[] | null;
  error: unknown;
};

type SupabaseSingleAttempt = () => PromiseLike<SupabaseSingleResult>;
type SupabaseListAttempt = () => PromiseLike<SupabaseListResult>;

async function runFirstSuccessfulSingle(attempts: SupabaseSingleAttempt[]) {
  for (const attempt of attempts) {
    const result = await attempt();

    if (!result.error && result.data) {
      return result.data as DbRow;
    }
  }

  return null;
}

async function runFirstSuccessfulList(attempts: SupabaseListAttempt[]) {
  for (const attempt of attempts) {
    const result = await attempt();

    if (!result.error && Array.isArray(result.data) && result.data.length > 0) {
      return result.data as DbRow[];
    }
  }

  return [];
}

async function loadPrayerTimes(city: CityPayload) {
  const today = getDateParts(city.timezone).isoDate;

  return runFirstSuccessfulSingle([
    () =>
      supabaseAdmin
        .from("city_prayer_times")
        .select("*")
        .eq("city_id", city.id)
        .eq("prayer_date", today)
        .limit(1)
        .maybeSingle(),

    () =>
      supabaseAdmin
        .from("city_prayer_times")
        .select("*")
        .eq("city_slug", city.slug)
        .eq("prayer_date", today)
        .limit(1)
        .maybeSingle(),

    () =>
      supabaseAdmin
        .from("city_prayer_times")
        .select("*")
        .eq("city_id", city.id)
        .limit(1)
        .maybeSingle(),

    () =>
      supabaseAdmin
        .from("city_prayer_times")
        .select("*")
        .eq("city_slug", city.slug)
        .limit(1)
        .maybeSingle(),

    () =>
      supabaseAdmin
        .from("city_prayer_times")
        .select("*")
        .ilike("city", city.name)
        .limit(1)
        .maybeSingle(),
  ]);
}

async function loadMosques(city: CityPayload) {
  return runFirstSuccessfulList([
    () =>
      supabaseAdmin
        .from("mosques")
        .select("*")
        .eq("city_id", city.id)
        .limit(30),

    () =>
      supabaseAdmin
        .from("mosques")
        .select("*")
        .eq("city_slug", city.slug)
        .limit(30),

    () =>
      supabaseAdmin
        .from("mosques")
        .select("*")
        .ilike("city", city.name)
        .limit(30),
  ]);
}

async function loadBusinesses(city: CityPayload) {
  return runFirstSuccessfulList([
    () =>
      supabaseAdmin
        .from("businesses")
        .select("*")
        .eq("city_id", city.id)
        .limit(30),

    () =>
      supabaseAdmin
        .from("businesses")
        .select("*")
        .eq("city_slug", city.slug)
        .limit(30),

    () =>
      supabaseAdmin
        .from("businesses")
        .select("*")
        .ilike("city", city.name)
        .limit(30),
  ]);
}

async function loadDailyHadith() {
  const result = await supabaseAdmin.from("hadiths").select("*").limit(100);

  if (result.error || !result.data || result.data.length === 0) {
    return null;
  }

  const hadiths = result.data as DbRow[];
  const index = new Date().getDate() % hadiths.length;

  return normaliseHadith(hadiths[index]);
}

async function loadCity(citySlug: string | null) {
  if (citySlug) {
    const exact = await supabaseAdmin
      .from("cities")
      .select("*")
      .eq("slug", citySlug)
      .limit(1)
      .maybeSingle();

    if (!exact.error && exact.data) {
      return exact.data as DbRow;
    }
  }

  const fallback = await supabaseAdmin
    .from("cities")
    .select("*")
    .order("name", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!fallback.error && fallback.data) {
    return fallback.data as DbRow;
  }

  return null;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    const citySlug = cleanSlug(url.searchParams.get("city"));
    const rawLat = parseNumber(url.searchParams.get("lat"));
    const rawLng = parseNumber(url.searchParams.get("lng"));

    const lat = isValidLatitude(rawLat) ? rawLat : null;
    const lng = isValidLongitude(rawLng) ? rawLng : null;

    const cityRow = await loadCity(citySlug);

    if (!cityRow) {
      return jsonResponse(
        {
          ok: false,
          error: "No matching city found.",
        },
        404
      );
    }

    const city: CityPayload = {
      id: cityRow.id as string | number,
      name: asString(cityRow.name) ?? "Unknown city",
      slug: asString(cityRow.slug) ?? citySlug ?? "unknown",
      country: asString(cityRow.country),
      timezone: asString(cityRow.timezone),
    };

    const [prayerTimes, mosqueRows, businessRows, dailyHadith] =
      await Promise.all([
        loadPrayerTimes(city),
        loadMosques(city),
        loadBusinesses(city),
        loadDailyHadith(),
      ]);

    const prayer = calculatePrayerInfo(prayerTimes, city.timezone);

    const mosques = mosqueRows
      .map((mosque) => scoreMosque(mosque, lat, lng))
      .sort((a, b) => {
        if (a.distance_km !== null && b.distance_km !== null) {
          return b.smart_score - a.smart_score || a.distance_km - b.distance_km;
        }

        return b.smart_score - a.smart_score;
      });

    const businesses = businessRows
      .map(scoreBusiness)
      .sort((a, b) => b.smart_score - a.smart_score);

    return jsonResponse({
      ok: true,
      city,
      daily_context: getDailyContext(city.timezone),
      prayer,
      recommended_mosque: mosques[0] ?? null,
      nearby_mosques: mosques.slice(0, 5),
      featured_business: businesses[0] ?? null,
      recommended_businesses: businesses.slice(0, 6),
      daily_hadith: dailyHadith,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("daily-mode route error:", error);

    return jsonResponse(
      {
        ok: false,
        error: "Could not load Smart Daily Mode.",
      },
      500
    );
  }
}