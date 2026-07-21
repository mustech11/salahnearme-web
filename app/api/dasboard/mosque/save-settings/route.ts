import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { canManageMosque } from "@/lib/mosquePermissions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_NAME_LENGTH = 180;
const MAX_SHORT_TEXT_LENGTH = 300;
const MAX_ADDRESS_LENGTH = 500;
const MAX_NOTES_LENGTH = 1200;
const MAX_URL_LENGTH = 800;

type Body = {
  mosque_id?: unknown;
  payload?: {
    name?: unknown;
    area?: unknown;
    city?: unknown;
    postcode?: unknown;
    address?: unknown;
    maps_url?: unknown;

    jumuah_enabled?: unknown;
    jumuah_khutbah_1?: unknown;
    jumuah_salah_1?: unknown;
    jumuah_khutbah_2?: unknown;
    jumuah_salah_2?: unknown;
    jumuah_khutbah_3?: unknown;
    jumuah_salah_3?: unknown;
    jumuah_notes?: unknown;

    fajr_start?: unknown;
    sunrise?: unknown;
    dhuhr_start?: unknown;
    asr_start?: unknown;
    maghrib_start?: unknown;
    isha_start?: unknown;
  };
};

type MosqueRow = {
  id: string;
  city: string | null;
};

type CityRow = {
  id: number;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function cleanString(value: unknown, maxLength = MAX_SHORT_TEXT_LENGTH) {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.trim().replace(/\s+/g, " ").slice(0, maxLength);

  return cleaned.length > 0 ? cleaned : null;
}

function cleanPostcode(value: unknown) {
  const postcode = cleanString(value, 40);

  return postcode ? postcode.toUpperCase() : null;
}

function cleanTime(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const cleaned = cleanString(value, 20);

  if (!cleaned) {
    return null;
  }

  if (/^\d{2}:\d{2}$/.test(cleaned)) {
    const [hourRaw, minuteRaw] = cleaned.split(":");
    const hour = Number(hourRaw);
    const minute = Number(minuteRaw);

    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return cleaned;
    }
  }

  if (/^\d{2}:\d{2}:\d{2}$/.test(cleaned)) {
    const [hourRaw, minuteRaw, secondRaw] = cleaned.split(":");
    const hour = Number(hourRaw);
    const minute = Number(minuteRaw);
    const second = Number(secondRaw);

    if (
      hour >= 0 &&
      hour <= 23 &&
      minute >= 0 &&
      minute <= 59 &&
      second >= 0 &&
      second <= 59
    ) {
      return `${hourRaw}:${minuteRaw}`;
    }
  }

  return null;
}

function cleanUrl(value: unknown) {
  const raw = cleanString(value, MAX_URL_LENGTH);

  if (!raw) {
    return null;
  }

  const withProtocol =
    raw.startsWith("http://") || raw.startsWith("https://")
      ? raw
      : `https://${raw}`;

  try {
    const url = new URL(withProtocol);

    if (!["http:", "https:"].includes(url.protocol)) {
      return null;
    }

    return url.toString().slice(0, MAX_URL_LENGTH);
  } catch {
    return null;
  }
}

function isUuid(value: string | null): value is string {
  return Boolean(value && UUID_REGEX.test(value));
}

function hasAnyPrayerTime(payload: Body["payload"]) {
  if (!payload) {
    return false;
  }

  return Boolean(
    cleanTime(payload.fajr_start) ||
      cleanTime(payload.sunrise) ||
      cleanTime(payload.dhuhr_start) ||
      cleanTime(payload.asr_start) ||
      cleanTime(payload.maghrib_start) ||
      cleanTime(payload.isha_start)
  );
}

async function findCityByName(cityName: string) {
  const { data, error } = await supabaseAdmin
    .from("cities")
    .select("id")
    .ilike("name", cityName)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as CityRow | null;
}

export async function GET() {
  return jsonResponse({
    ok: true,
    route: "/api/dashboard/mosque/save-settings",
    method: "POST",
    body: {
      mosque_id: "required UUID",
      payload: {
        name: "optional",
        area: "optional",
        city: "optional",
        postcode: "optional",
        address: "optional",
        maps_url: "optional",
        jumuah_enabled: "optional boolean",
        jumuah_khutbah_1: "HH:MM optional",
        jumuah_salah_1: "HH:MM optional",
        jumuah_khutbah_2: "HH:MM optional",
        jumuah_salah_2: "HH:MM optional",
        jumuah_khutbah_3: "HH:MM optional",
        jumuah_salah_3: "HH:MM optional",
        jumuah_notes: "optional",
        fajr_start: "HH:MM optional city fallback",
        sunrise: "HH:MM optional city fallback",
        dhuhr_start: "HH:MM optional city fallback",
        asr_start: "HH:MM optional city fallback",
        maghrib_start: "HH:MM optional city fallback",
        isha_start: "HH:MM optional city fallback",
      },
    },
  });
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const email = (user.email ?? "").trim().toLowerCase();

    if (!email) {
      return jsonResponse(
        {
          ok: false,
          error: "Unauthorised.",
        },
        401
      );
    }

    const body = (await req.json().catch(() => null)) as Body | null;

    if (!body || typeof body !== "object") {
      return jsonResponse(
        {
          ok: false,
          error: "Invalid request body.",
        },
        400
      );
    }

    const mosqueId = cleanString(body.mosque_id, 80);
    const payload = body.payload ?? {};

    if (!isUuid(mosqueId)) {
      return jsonResponse(
        {
          ok: false,
          error: "Missing or invalid mosque_id.",
        },
        400
      );
    }

    const allowed = await canManageMosque(mosqueId, email);

    if (!allowed) {
      return jsonResponse(
        {
          ok: false,
          error: "You do not have permission to manage this mosque.",
        },
        403
      );
    }

    const { data: mosqueRaw, error: mosqueError } = await supabaseAdmin
      .from("mosques")
      .select("id, city")
      .eq("id", mosqueId)
      .maybeSingle();

    if (mosqueError) {
      console.error("save-settings mosque lookup error:", mosqueError);

      return jsonResponse(
        {
          ok: false,
          error: mosqueError.message,
        },
        500
      );
    }

    if (!mosqueRaw) {
      return jsonResponse(
        {
          ok: false,
          error: "Mosque not found.",
        },
        404
      );
    }

    const mosque = mosqueRaw as MosqueRow;

    const mosqueUpdate = {
      name: cleanString(payload.name, MAX_NAME_LENGTH),
      area: cleanString(payload.area, 120),
      city: cleanString(payload.city, 120),
      postcode: cleanPostcode(payload.postcode),
      address: cleanString(payload.address, MAX_ADDRESS_LENGTH),
      maps_url: cleanUrl(payload.maps_url),

      jumuah_enabled: payload.jumuah_enabled === true,

      jumuah_khutbah_1: cleanTime(payload.jumuah_khutbah_1),
      jumuah_salah_1: cleanTime(payload.jumuah_salah_1),
      jumuah_khutbah_2: cleanTime(payload.jumuah_khutbah_2),
      jumuah_salah_2: cleanTime(payload.jumuah_salah_2),
      jumuah_khutbah_3: cleanTime(payload.jumuah_khutbah_3),
      jumuah_salah_3: cleanTime(payload.jumuah_salah_3),
      jumuah_notes: cleanString(payload.jumuah_notes, MAX_NOTES_LENGTH),

      updated_at: new Date().toISOString(),
    };

    const { error: updateMosqueError } = await supabaseAdmin
      .from("mosques")
      .update(mosqueUpdate)
      .eq("id", mosqueId);

    if (updateMosqueError) {
      console.error("save-settings mosque update error:", updateMosqueError);

      return jsonResponse(
        {
          ok: false,
          error: updateMosqueError.message,
        },
        500
      );
    }

    let cityPrayerTimesSaved = false;
    const effectiveCity = mosqueUpdate.city ?? mosque.city;

    if (effectiveCity && hasAnyPrayerTime(payload)) {
      const cityRow = await findCityByName(effectiveCity);

      if (cityRow?.id) {
        const now = new Date();

        const { error: upsertPrayerError } = await supabaseAdmin
          .from("city_prayer_times")
          .upsert(
            {
              city_id: cityRow.id,
              month: now.getMonth() + 1,
              year: now.getFullYear(),

              fajr_start: cleanTime(payload.fajr_start),
              sunrise: cleanTime(payload.sunrise),
              dhuhr_start: cleanTime(payload.dhuhr_start),
              asr_start: cleanTime(payload.asr_start),
              maghrib_start: cleanTime(payload.maghrib_start),
              isha_start: cleanTime(payload.isha_start),

              source: "mosque_manager",
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: "city_id,month,year",
            }
          );

        if (upsertPrayerError) {
          console.error(
            "save-settings city prayer upsert error:",
            upsertPrayerError
          );

          return jsonResponse(
            {
              ok: false,
              error: upsertPrayerError.message,
            },
            500
          );
        }

        cityPrayerTimesSaved = true;
      }
    }

    return jsonResponse({
      ok: true,
      mosque_id: mosqueId,
      city_prayer_times_saved: cityPrayerTimesSaved,
      message: "Mosque settings saved.",
    });
  } catch (error) {
    console.error("save mosque settings error:", error);

    return jsonResponse(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not save mosque settings.",
      },
      500
    );
  }
}