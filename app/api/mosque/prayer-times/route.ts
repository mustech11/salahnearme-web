import { NextResponse } from "next/server";

import { requireMosqueManager } from "@/lib/mosqueManagerAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  mosque_id?: string;
  prayer_date?: string;

  fajr_begins?: string | null;
  fajr_iqamah?: string | null;

  sunrise?: string | null;

  dhuhr_begins?: string | null;
  dhuhr_iqamah?: string | null;

  asr_begins?: string | null;
  asr_iqamah?: string | null;

  maghrib_begins?: string | null;
  maghrib_iqamah?: string | null;

  isha_begins?: string | null;
  isha_iqamah?: string | null;

  source?: string | null;
  confidence?: string | null;
  notes?: string | null;
};

function cleanString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function isUuid(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function cleanDate(value: unknown) {
  const cleaned = cleanString(value);

  if (!cleaned) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    return null;
  }

  return cleaned;
}

function cleanTime(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const cleaned = cleanString(value);

  if (!cleaned) {
    return null;
  }

  if (/^\d{2}:\d{2}:\d{2}$/.test(cleaned)) {
    return cleaned;
  }

  if (/^\d{2}:\d{2}$/.test(cleaned)) {
    return `${cleaned}:00`;
  }

  return null;
}

function cleanSource(value: unknown) {
  const cleaned = cleanString(value);

  if (!cleaned) {
    return "manual";
  }

  const allowed = new Set(["manual", "imported", "official", "community"]);

  return allowed.has(cleaned) ? cleaned : "manual";
}

function cleanConfidence(value: unknown) {
  const cleaned = cleanString(value);

  if (!cleaned) {
    return "official";
  }

  const allowed = new Set([
    "official",
    "verified",
    "needs_review",
    "community",
    "low",
    "medium",
    "high",
  ]);

  return allowed.has(cleaned) ? cleaned : "official";
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const mosqueId = cleanString(searchParams.get("mosque_id"));
    const date = cleanDate(searchParams.get("date"));

    if (!isUuid(mosqueId)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing or invalid mosque_id.",
        },
        {
          status: 400,
        }
      );
    }

    let query = supabaseAdmin
      .from("mosque_prayer_times")
      .select("*")
      .eq("mosque_id", mosqueId)
      .order("prayer_date", {
        ascending: true,
      });

    if (date) {
      query = query.eq("prayer_date", date);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        count: data?.length ?? 0,
        prayer_times: data ?? [],
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error("mosque prayer times GET error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Could not load mosque prayer times.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as Body | null;

    if (!body) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid JSON body.",
        },
        {
          status: 400,
        }
      );
    }

    const mosqueId = cleanString(body.mosque_id);
    const prayerDate = cleanDate(body.prayer_date);

    if (!isUuid(mosqueId)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing or invalid mosque_id.",
        },
        {
          status: 400,
        }
      );
    }

    const permission = await requireMosqueManager(mosqueId);

    if (!permission.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: permission.error,
        },
        {
          status: permission.status,
        }
      );
    }

    if (!prayerDate) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing or invalid prayer_date.",
        },
        {
          status: 400,
        }
      );
    }

    const now = new Date().toISOString();

    const payload = {
      mosque_id: mosqueId,
      prayer_date: prayerDate,

      fajr_begins: cleanTime(body.fajr_begins),
      fajr_iqamah: cleanTime(body.fajr_iqamah),

      sunrise: cleanTime(body.sunrise),

      dhuhr_begins: cleanTime(body.dhuhr_begins),
      dhuhr_iqamah: cleanTime(body.dhuhr_iqamah),

      asr_begins: cleanTime(body.asr_begins),
      asr_iqamah: cleanTime(body.asr_iqamah),

      maghrib_begins: cleanTime(body.maghrib_begins),
      maghrib_iqamah: cleanTime(body.maghrib_iqamah),

      isha_begins: cleanTime(body.isha_begins),
      isha_iqamah: cleanTime(body.isha_iqamah),

      source: cleanSource(body.source),
      confidence: cleanConfidence(body.confidence),
      notes: cleanString(body.notes),
      updated_at: now,
    };

    const { data, error } = await supabaseAdmin
      .from("mosque_prayer_times")
      .upsert(payload, {
        onConflict: "mosque_id,prayer_date",
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        prayer_time: data,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error("mosque prayer times POST error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Could not save mosque prayer times.",
      },
      {
        status: 500,
      }
    );
  }
}

