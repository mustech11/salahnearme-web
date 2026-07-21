import { NextResponse } from "next/server";

import { requireMosqueManager } from "@/lib/mosqueManagerAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_NOTES_LENGTH = 1200;
const MAX_RANGE_DAYS = 370;

const SOURCES = ["manual", "imported", "official", "community"] as const;
const CONFIDENCES = [
  "official",
  "verified",
  "needs_review",
  "community",
  "low",
  "medium",
  "high",
] as const;

type Source = (typeof SOURCES)[number];
type Confidence = (typeof CONFIDENCES)[number];

type Body = {
  mosque_id?: unknown;
  prayer_date?: unknown;

  fajr_begins?: unknown;
  fajr_iqamah?: unknown;
  sunrise?: unknown;
  dhuhr_begins?: unknown;
  dhuhr_iqamah?: unknown;
  asr_begins?: unknown;
  asr_iqamah?: unknown;
  maghrib_begins?: unknown;
  maghrib_iqamah?: unknown;
  isha_begins?: unknown;
  isha_iqamah?: unknown;

  source?: unknown;
  confidence?: unknown;
  notes?: unknown;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function cleanString(value: unknown, maxLength = 300) {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.trim().replace(/\s+/g, " ").slice(0, maxLength);

  return cleaned.length > 0 ? cleaned : null;
}

function isUuid(value: string | null): value is string {
  return Boolean(value && UUID_REGEX.test(value));
}

function cleanDate(value: unknown) {
  const cleaned = cleanString(value, 20);

  if (!cleaned || !/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    return null;
  }

  const date = new Date(`${cleaned}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return cleaned;
}

function cleanTime(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const cleaned = cleanString(value, 20);

  if (!cleaned) {
    return null;
  }

  const match = cleaned.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);

  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] ?? "0");

  if (
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59
  ) {
    return null;
  }

  return `${match[1]}:${match[2]}:00`;
}

function cleanSource(value: unknown): Source {
  const cleaned = cleanString(value, 40);

  if (!cleaned) {
    return "manual";
  }

  return SOURCES.includes(cleaned as Source) ? (cleaned as Source) : "manual";
}

function cleanConfidence(value: unknown): Confidence {
  const cleaned = cleanString(value, 40);

  if (!cleaned) {
    return "official";
  }

  return CONFIDENCES.includes(cleaned as Confidence)
    ? (cleaned as Confidence)
    : "official";
}

function parseRangeDate(value: string | null) {
  const cleaned = cleanDate(value);

  if (!cleaned) {
    return null;
  }

  return cleaned;
}

function getDayDifference(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00.000Z`).getTime();
  const end = new Date(`${endDate}T00:00:00.000Z`).getTime();

  return Math.round((end - start) / 86_400_000);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const mosqueId = cleanString(searchParams.get("mosque_id"), 80);
    const date = cleanDate(searchParams.get("date"));

    const from = parseRangeDate(searchParams.get("from"));
    const to = parseRangeDate(searchParams.get("to"));

    if (!isUuid(mosqueId)) {
      return jsonResponse(
        {
          ok: false,
          error: "Missing or invalid mosque_id.",
        },
        400
      );
    }

    let query = supabaseAdmin
      .from("mosque_prayer_times")
      .select("*")
      .eq("mosque_id", mosqueId)
      .order("prayer_date", {
        ascending: true,
      })
      .limit(MAX_RANGE_DAYS);

    if (date) {
      query = query.eq("prayer_date", date);
    } else if (from && to) {
      const dayDifference = getDayDifference(from, to);

      if (dayDifference < 0 || dayDifference > MAX_RANGE_DAYS) {
        return jsonResponse(
          {
            ok: false,
            error: `Date range must be between 0 and ${MAX_RANGE_DAYS} days.`,
          },
          400
        );
      }

      query = query.gte("prayer_date", from).lte("prayer_date", to);
    }

    const { data, error } = await query;

    if (error) {
      console.error("mosque prayer times GET database error:", error);

      return jsonResponse(
        {
          ok: false,
          error: error.message,
        },
        500
      );
    }

    return jsonResponse({
      ok: true,
      count: data?.length ?? 0,
      prayer_times: data ?? [],
    });
  } catch (error) {
    console.error("mosque prayer times GET error:", error);

    return jsonResponse(
      {
        ok: false,
        error: "Could not load mosque prayer times.",
      },
      500
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as Body | null;

    if (!body || typeof body !== "object") {
      return jsonResponse(
        {
          ok: false,
          error: "Invalid JSON body.",
        },
        400
      );
    }

    const mosqueId = cleanString(body.mosque_id, 80);
    const prayerDate = cleanDate(body.prayer_date);

    if (!isUuid(mosqueId)) {
      return jsonResponse(
        {
          ok: false,
          error: "Missing or invalid mosque_id.",
        },
        400
      );
    }

    const permission = await requireMosqueManager(mosqueId);

    if (!permission.ok) {
      return jsonResponse(
        {
          ok: false,
          error: permission.error,
        },
        permission.status
      );
    }

    if (!prayerDate) {
      return jsonResponse(
        {
          ok: false,
          error: "Missing or invalid prayer_date.",
        },
        400
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
      notes: cleanString(body.notes, MAX_NOTES_LENGTH),
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
      console.error("mosque prayer times POST database error:", error);

      return jsonResponse(
        {
          ok: false,
          error: error.message,
        },
        500
      );
    }

    return jsonResponse({
      ok: true,
      prayer_time: data,
      message: "Prayer times saved.",
    });
  } catch (error) {
    console.error("mosque prayer times POST error:", error);

    return jsonResponse(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not save mosque prayer times.",
      },
      500
    );
  }
}