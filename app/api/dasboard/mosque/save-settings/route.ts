import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUser } from "@/lib/auth";
import { canManageMosque } from "@/lib/mosquePermissions";

export const runtime = "nodejs";

type Body = {
  mosque_id?: string;
  payload?: {
    name?: string | null;
    area?: string | null;
    city?: string | null;
    postcode?: string | null;
    address?: string | null;
    maps_url?: string | null;
    jumuah_enabled?: boolean;
    jumuah_khutbah_1?: string | null;
    jumuah_salah_1?: string | null;
    jumuah_khutbah_2?: string | null;
    jumuah_salah_2?: string | null;
    jumuah_khutbah_3?: string | null;
    jumuah_salah_3?: string | null;
    jumuah_notes?: string | null;
    fajr_start?: string | null;
    sunrise?: string | null;
    dhuhr_start?: string | null;
    asr_start?: string | null;
    maghrib_start?: string | null;
    isha_start?: string | null;
  };
};

function cleanString(value: unknown) {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return v.length ? v : null;
}

function cleanTime(value: unknown) {
  const v = cleanString(value);
  if (!v) return null;
  return /^\d{2}:\d{2}$/.test(v) ? v : null;
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const email = (user.email ?? "").trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }

    const body = (await req.json()) as Body;
    const mosqueId = cleanString(body.mosque_id);
    const payload = body.payload ?? {};

    if (!mosqueId) {
      return NextResponse.json({ error: "Missing mosque_id" }, { status: 400 });
    }

    const allowed = await canManageMosque(mosqueId, email);

    if (!allowed) {
      return NextResponse.json(
        { error: "You do not have permission to manage this mosque." },
        { status: 403 }
      );
    }

    const { data: mosque, error: mosqueError } = await supabaseAdmin
      .from("mosques")
      .select("id, city")
      .eq("id", mosqueId)
      .maybeSingle();

    if (mosqueError) {
      return NextResponse.json({ error: mosqueError.message }, { status: 500 });
    }

    if (!mosque) {
      return NextResponse.json({ error: "Mosque not found" }, { status: 404 });
    }

    const mosqueUpdate = {
      name: cleanString(payload.name),
      area: cleanString(payload.area),
      city: cleanString(payload.city),
      postcode: cleanString(payload.postcode),
      address: cleanString(payload.address),
      maps_url: cleanString(payload.maps_url),
      jumuah_enabled: Boolean(payload.jumuah_enabled),
      jumuah_khutbah_1: cleanTime(payload.jumuah_khutbah_1),
      jumuah_salah_1: cleanTime(payload.jumuah_salah_1),
      jumuah_khutbah_2: cleanTime(payload.jumuah_khutbah_2),
      jumuah_salah_2: cleanTime(payload.jumuah_salah_2),
      jumuah_khutbah_3: cleanTime(payload.jumuah_khutbah_3),
      jumuah_salah_3: cleanTime(payload.jumuah_salah_3),
      jumuah_notes: cleanString(payload.jumuah_notes),
    };

    const { error: updateMosqueError } = await supabaseAdmin
      .from("mosques")
      .update(mosqueUpdate)
      .eq("id", mosqueId);

    if (updateMosqueError) {
      return NextResponse.json(
        { error: updateMosqueError.message },
        { status: 500 }
      );
    }

    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const effectiveCity = cleanString(payload.city) ?? mosque.city ?? null;

    if (effectiveCity) {
      const { data: cityRow } = await supabaseAdmin
        .from("cities")
        .select("id")
        .eq("name", effectiveCity)
        .maybeSingle();

      if (cityRow?.id) {
        const { error: upsertPrayerError } = await supabaseAdmin
          .from("city_prayer_times")
          .upsert(
            {
              city_id: cityRow.id,
              month,
              year,
              fajr_start: cleanTime(payload.fajr_start),
              sunrise: cleanTime(payload.sunrise),
              dhuhr_start: cleanTime(payload.dhuhr_start),
              asr_start: cleanTime(payload.asr_start),
              maghrib_start: cleanTime(payload.maghrib_start),
              isha_start: cleanTime(payload.isha_start),
            },
            {
              onConflict: "city_id,month,year",
            }
          );

        if (upsertPrayerError) {
          return NextResponse.json(
            { error: upsertPrayerError.message },
            { status: 500 }
          );
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("save mosque settings error:", error);
    return NextResponse.json(
      { error: "Could not save mosque settings" },
      { status: 500 }
    );
  }
}

