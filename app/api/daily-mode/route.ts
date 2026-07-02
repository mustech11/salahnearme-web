import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CityRow = {
  id: string;
  name: string;
  slug: string;
  country?: string | null;
  timezone?: string | null;
};

type PrayerTimesRow = {
  id: string;
  city_id: string;
  date: string;
  fajr?: string | null;
  sunrise?: string | null;
  dhuhr?: string | null;
  asr?: string | null;
  maghrib?: string | null;
  isha?: string | null;
};

type MosqueRow = {
  id: string;
  name: string;
  slug: string;
  city_id?: string | null;
  address?: string | null;
  area?: string | null;
  postcode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  is_verified?: boolean | null;
  is_active?: boolean | null;
  facilities?: unknown;
  updated_at?: string | null;
};

type BusinessRow = {
  id: string;
  name: string;
  slug: string;
  city_id?: string | null;
  category?: string | null;
  area?: string | null;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  logo_url?: string | null;
  cover_image_url?: string | null;
  gallery_urls?: string[] | null;
  featured?: boolean | null;
  city_sponsor?: boolean | null;
  mosque_sponsor?: boolean | null;
  sponsorship_active?: boolean | null;
  paid_until?: string | null;
  is_verified?: boolean | null;
  is_active?: boolean | null;
  featured_rank?: number | null;
  updated_at?: string | null;
};

type HadithRow = {
  id: string;
  text?: string | null;
  hadith_text?: string | null;
  translation?: string | null;
  source?: string | null;
  reference?: string | null;
};

type PrayerKey = "fajr" | "dhuhr" | "asr" | "maghrib" | "isha";

type PrayerInfo = {
  current_prayer: PrayerKey | null;
  next_prayer: PrayerKey | null;
  next_prayer_time: string | null;
  minutes_until_next: number | null;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function cleanSlug(value: string | null) {
  if (!value) {
    return null;
  }

  const cleaned = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, "")
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

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function parseTimeToMinutes(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const match = value.match(/^(\d{1,2}):(\d{2})/);

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

function getCurrentMinutes() {
  const now = new Date();

  return now.getHours() * 60 + now.getMinutes();
}

function formatPrayerName(prayer: PrayerKey | null) {
  if (!prayer) {
    return null;
  }

  const names: Record<PrayerKey, string> = {
    fajr: "Fajr",
    dhuhr: "Dhuhr",
    asr: "Asr",
    maghrib: "Maghrib",
    isha: "Isha",
  };

  return names[prayer];
}

function calculatePrayerInfo(prayerTimes: PrayerTimesRow | null): PrayerInfo {
  if (!prayerTimes) {
    return {
      current_prayer: null,
      next_prayer: null,
      next_prayer_time: null,
      minutes_until_next: null,
    };
  }

  const currentMinutes = getCurrentMinutes();

  const prayers: Array<{
    key: PrayerKey;
    value: string | null | undefined;
    minutes: number | null;
  }> = [
    {
      key: "fajr",
      value: prayerTimes.fajr,
      minutes: parseTimeToMinutes(prayerTimes.fajr),
    },
    {
      key: "dhuhr",
      value: prayerTimes.dhuhr,
      minutes: parseTimeToMinutes(prayerTimes.dhuhr),
    },
    {
      key: "asr",
      value: prayerTimes.asr,
      minutes: parseTimeToMinutes(prayerTimes.asr),
    },
    {
      key: "maghrib",
      value: prayerTimes.maghrib,
      minutes: parseTimeToMinutes(prayerTimes.maghrib),
    },
    {
      key: "isha",
      value: prayerTimes.isha,
      minutes: parseTimeToMinutes(prayerTimes.isha),
    },
  ].filter((item) => item.minutes !== null);

  if (prayers.length === 0) {
    return {
      current_prayer: null,
      next_prayer: null,
      next_prayer_time: null,
      minutes_until_next: null,
    };
  }

  const nextToday = prayers.find(
    (item) => item.minutes !== null && item.minutes > currentMinutes
  );

  if (nextToday) {
    const previousPrayer =
      [...prayers]
        .reverse()
        .find(
          (item) => item.minutes !== null && item.minutes <= currentMinutes
        ) ?? null;

    return {
      current_prayer: previousPrayer?.key ?? null,
      next_prayer: nextToday.key,
      next_prayer_time: nextToday.value ?? null,
      minutes_until_next:
        nextToday.minutes !== null ? nextToday.minutes - currentMinutes : null,
    };
  }

  const tomorrowFajr = prayers[0];

  return {
    current_prayer: "isha",
    next_prayer: tomorrowFajr.key,
    next_prayer_time: tomorrowFajr.value ?? null,
    minutes_until_next:
      tomorrowFajr.minutes !== null
        ? 24 * 60 - currentMinutes + tomorrowFajr.minutes
        : null,
  };
}

function getDistanceKm(
  lat1: number | null,
  lon1: number | null,
  lat2: number | null,
  lon2: number | null
) {
  if (
    lat1 === null ||
    lon1 === null ||
    lat2 === null ||
    lon2 === null ||
    !Number.isFinite(lat1) ||
    !Number.isFinite(lon1) ||
    !Number.isFinite(lat2) ||
    !Number.isFinite(lon2)
  ) {
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

function scoreMosque(mosque: MosqueRow, userLat: number | null, userLng: number | null) {
  let score = 0;

  if (mosque.is_verified) {
    score += 30;
  }

  if (mosque.latitude && mosque.longitude) {
    score += 15;
  }

  if (mosque.address) {
    score += 10;
  }

  if (mosque.updated_at) {
    score += 5;
  }

  const distanceKm = getDistanceKm(
    userLat,
    userLng,
    mosque.latitude ?? null,
    mosque.longitude ?? null
  );

  if (distanceKm !== null) {
    if (distanceKm <= 1) {
      score += 40;
    } else if (distanceKm <= 3) {
      score += 30;
    } else if (distanceKm <= 5) {
      score += 20;
    } else if (distanceKm <= 10) {
      score += 10;
    }
  }

  return {
    ...mosque,
    distance_km: distanceKm !== null ? Number(distanceKm.toFixed(2)) : null,
    smart_score: score,
  };
}

function scoreBusiness(business: BusinessRow) {
  let score = 0;

  const paidUntil = business.paid_until ? new Date(business.paid_until) : null;
  const paidActive =
    paidUntil instanceof Date &&
    Number.isFinite(paidUntil.getTime()) &&
    paidUntil.getTime() > Date.now();

  if (business.featured) {
    score += 35;
  }

  if (business.city_sponsor) {
    score += 30;
  }

  if (business.mosque_sponsor) {
    score += 25;
  }

  if (business.sponsorship_active || paidActive) {
    score += 25;
  }

  if (business.is_verified) {
    score += 20;
  }

  if (business.phone) {
    score += 8;
  }

  if (business.website) {
    score += 8;
  }

  if (business.logo_url) {
    score += 8;
  }

  if (business.cover_image_url) {
    score += 8;
  }

  if (Array.isArray(business.gallery_urls) && business.gallery_urls.length > 0) {
    score += Math.min(20, business.gallery_urls.length * 4);
  }

  if (typeof business.featured_rank === "number") {
    score += Math.max(0, 20 - business.featured_rank);
  }

  return {
    ...business,
    paid_active: paidActive,
    smart_score: score,
  };
}

function getDailyContext() {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();

  if (day === 5) {
    return {
      mode: "jummah",
      message: "It is Friday. Check Jummah times and plan early.",
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

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    const citySlug = cleanSlug(url.searchParams.get("city"));
    const lat = parseNumber(url.searchParams.get("lat"));
    const lng = parseNumber(url.searchParams.get("lng"));
    const today = getTodayIsoDate();

    let city: CityRow | null = null;

    if (citySlug) {
      const cityResult = await supabaseAdmin
        .from("cities")
        .select("id,name,slug,country,timezone")
        .eq("slug", citySlug)
        .eq("is_active", true)
        .maybeSingle();

      if (cityResult.error) {
        console.error("daily-mode city lookup error:", cityResult.error);
      }

      city = (cityResult.data as CityRow | null) ?? null;
    }

    if (!city) {
      const fallbackCityResult = await supabaseAdmin
        .from("cities")
        .select("id,name,slug,country,timezone")
        .eq("is_active", true)
        .order("name", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (fallbackCityResult.error) {
        console.error(
          "daily-mode fallback city lookup error:",
          fallbackCityResult.error
        );
      }

      city = (fallbackCityResult.data as CityRow | null) ?? null;
    }

    if (!city) {
      return jsonResponse(
        {
          ok: false,
          error: "No active city found.",
        },
        404
      );
    }

    const [prayerResult, mosquesResult, businessesResult, hadithResult] =
      await Promise.all([
        supabaseAdmin
          .from("city_prayer_times")
          .select("id,city_id,date,fajr,sunrise,dhuhr,asr,maghrib,isha")
          .eq("city_id", city.id)
          .eq("date", today)
          .maybeSingle(),

        supabaseAdmin
          .from("mosques")
          .select(
            "id,name,slug,city_id,address,area,postcode,latitude,longitude,is_verified,is_active,facilities,updated_at"
          )
          .eq("city_id", city.id)
          .eq("is_active", true)
          .limit(12),

        supabaseAdmin
          .from("businesses")
          .select(
            "id,name,slug,city_id,category,area,address,phone,website,logo_url,cover_image_url,gallery_urls,featured,city_sponsor,mosque_sponsor,sponsorship_active,paid_until,is_verified,is_active,featured_rank,updated_at"
          )
          .eq("city_id", city.id)
          .eq("is_active", true)
          .limit(12),

        supabaseAdmin
          .from("hadiths")
          .select("id,text,hadith_text,translation,source,reference")
          .limit(50),
      ]);

    if (prayerResult.error) {
      console.error("daily-mode prayer lookup error:", prayerResult.error);
    }

    if (mosquesResult.error) {
      console.error("daily-mode mosques lookup error:", mosquesResult.error);
    }

    if (businessesResult.error) {
      console.error(
        "daily-mode businesses lookup error:",
        businessesResult.error
      );
    }

    if (hadithResult.error) {
      console.error("daily-mode hadith lookup error:", hadithResult.error);
    }

    const prayerTimes = (prayerResult.data as PrayerTimesRow | null) ?? null;
    const prayerInfo = calculatePrayerInfo(prayerTimes);

    const mosques = ((mosquesResult.data ?? []) as MosqueRow[])
      .map((mosque) => scoreMosque(mosque, lat, lng))
      .sort((a, b) => b.smart_score - a.smart_score);

    const businesses = ((businessesResult.data ?? []) as BusinessRow[])
      .map(scoreBusiness)
      .sort((a, b) => b.smart_score - a.smart_score);

    const hadiths = (hadithResult.data ?? []) as HadithRow[];
    const hadithIndex =
      hadiths.length > 0 ? new Date().getDate() % hadiths.length : -1;

    const dailyHadith = hadithIndex >= 0 ? hadiths[hadithIndex] : null;

    return jsonResponse({
      ok: true,
      city: {
        id: city.id,
        name: city.name,
        slug: city.slug,
        country: city.country ?? null,
        timezone: city.timezone ?? null,
      },
      daily_context: getDailyContext(),
      prayer: {
        current_prayer: prayerInfo.current_prayer,
        current_prayer_label: formatPrayerName(prayerInfo.current_prayer),
        next_prayer: prayerInfo.next_prayer,
        next_prayer_label: formatPrayerName(prayerInfo.next_prayer),
        next_prayer_time: prayerInfo.next_prayer_time,
        minutes_until_next: prayerInfo.minutes_until_next,
      },
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