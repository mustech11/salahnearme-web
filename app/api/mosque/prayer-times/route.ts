import { NextResponse } from "next/server";

import { requireMosqueManager } from "@/lib/mosqueManagerAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DATE_REGEX =
  /^\d{4}-\d{2}-\d{2}$/;

const MAX_NOTES_LENGTH = 1_200;
const MAX_RANGE_DAYS = 370;
const MAX_REQUEST_BODY_BYTES = 20_000;

const SOURCES = [
  "manual",
  "imported",
  "official",
  "community",
] as const;

const CONFIDENCES = [
  "official",
  "verified",
  "needs_review",
  "community",
  "low",
  "medium",
  "high",
] as const;

const TIME_FIELDS = [
  "fajr_begins",
  "fajr_iqamah",
  "sunrise",
  "dhuhr_begins",
  "dhuhr_iqamah",
  "asr_begins",
  "asr_iqamah",
  "maghrib_begins",
  "maghrib_iqamah",
  "isha_begins",
  "isha_iqamah",
] as const;

type Source =
  (typeof SOURCES)[number];

type Confidence =
  (typeof CONFIDENCES)[number];

type TimeField =
  (typeof TIME_FIELDS)[number];

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

type TimeResult =
  | {
      ok: true;
      value: string | null;
    }
  | {
      ok: false;
    };

function jsonResponse(
  body: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control":
        "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function cleanString(
  value: unknown,
  maxLength = 300
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, maxLength);

  return cleaned || null;
}

function isUuid(
  value: string | null
): value is string {
  return Boolean(
    value &&
      UUID_REGEX.test(value)
  );
}

function isPlainObject(
  value: unknown
): value is Record<string, unknown> {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value)
  );
}

function isJsonRequest(
  request: Request
): boolean {
  return Boolean(
    request.headers
      .get("content-type")
      ?.toLowerCase()
      .includes("application/json")
  );
}

function cleanDate(
  value: unknown
): string | null {
  const cleaned =
    cleanString(value, 20);

  if (
    !cleaned ||
    !DATE_REGEX.test(cleaned)
  ) {
    return null;
  }

  const [year, month, day] =
    cleaned
      .split("-")
      .map(Number);

  const date = new Date(
    Date.UTC(
      year,
      month - 1,
      day
    )
  );

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return cleaned;
}

function parseTime(
  value: unknown
): TimeResult {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return {
      ok: true,
      value: null,
    };
  }

  const cleaned =
    cleanString(value, 20);

  if (!cleaned) {
    return {
      ok: true,
      value: null,
    };
  }

  const match = cleaned.match(
    /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/
  );

  if (!match) {
    return {
      ok: false,
    };
  }

  return {
    ok: true,
    value: `${match[1]}:${match[2]}:${
      match[3] ?? "00"
    }`,
  };
}

function cleanSource(
  value: unknown
): Source | null {
  const cleaned =
    cleanString(value, 40)
      ?.toLowerCase();

  return cleaned &&
    SOURCES.includes(
      cleaned as Source
    )
    ? (cleaned as Source)
    : null;
}

function cleanConfidence(
  value: unknown
): Confidence | null {
  const cleaned =
    cleanString(value, 40)
      ?.toLowerCase();

  return cleaned &&
    CONFIDENCES.includes(
      cleaned as Confidence
    )
    ? (cleaned as Confidence)
    : null;
}

function getDayDifference(
  startDate: string,
  endDate: string
): number {
  const start = Date.parse(
    `${startDate}T00:00:00.000Z`
  );

  const end = Date.parse(
    `${endDate}T00:00:00.000Z`
  );

  return Math.round(
    (end - start) / 86_400_000
  );
}

async function readBody(
  request: Request
): Promise<Body | null> {
  const contentLength = Number(
    request.headers.get(
      "content-length"
    )
  );

  if (
    Number.isFinite(contentLength) &&
    contentLength >
      MAX_REQUEST_BODY_BYTES
  ) {
    return null;
  }

  try {
    const value: unknown =
      await request.json();

    return isPlainObject(value)
      ? (value as Body)
      : null;
  } catch {
    return null;
  }
}

export async function GET(
  request: Request
) {
  try {
    const url =
      new URL(request.url);

    const mosqueId =
      cleanString(
        url.searchParams.get(
          "mosque_id"
        ),
        80
      );

    const date =
      cleanDate(
        url.searchParams.get(
          "date"
        )
      );

    const from =
      cleanDate(
        url.searchParams.get(
          "from"
        )
      );

    const to =
      cleanDate(
        url.searchParams.get(
          "to"
        )
      );

    if (!isUuid(mosqueId)) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Missing or invalid mosque_id.",
        },
        400
      );
    }

    if (
      (from && !to) ||
      (!from && to)
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Both from and to dates are required for a date range.",
        },
        400
      );
    }

    let query = supabaseAdmin
      .from(
        "mosque_prayer_times"
      )
      .select("*")
      .eq(
        "mosque_id",
        mosqueId
      )
      .order("prayer_date", {
        ascending: true,
      })
      .limit(MAX_RANGE_DAYS);

    if (date) {
      query = query.eq(
        "prayer_date",
        date
      );
    } else if (
      from &&
      to
    ) {
      const difference =
        getDayDifference(
          from,
          to
        );

      if (
        difference < 0 ||
        difference >
          MAX_RANGE_DAYS
      ) {
        return jsonResponse(
          {
            ok: false,
            error: `Date range must be between 0 and ${MAX_RANGE_DAYS} days.`,
          },
          400
        );
      }

      query = query
        .gte(
          "prayer_date",
          from
        )
        .lte(
          "prayer_date",
          to
        );
    }

    const {
      data,
      error,
    } = await query;

    if (error) {
      console.error(
        "Mosque prayer-time query failed:",
        {
          mosqueId,
          code: error.code,
          message: error.message,
        }
      );

      return jsonResponse(
        {
          ok: false,
          error:
            "Could not load mosque prayer times.",
        },
        500
      );
    }

    return jsonResponse({
      ok: true,
      mosque_id: mosqueId,
      count:
        data?.length ?? 0,
      prayer_times:
        data ?? [],
    });
  } catch (error) {
    console.error(
      "Mosque prayer-time GET route failed:",
      error
    );

    return jsonResponse(
      {
        ok: false,
        error:
          "Could not load mosque prayer times.",
      },
      500
    );
  }
}

export async function POST(
  request: Request
) {
  try {
    if (!isJsonRequest(request)) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Content-Type must be application/json.",
        },
        415
      );
    }

    const body =
      await readBody(request);

    if (!body) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Invalid JSON body.",
        },
        400
      );
    }

    const mosqueId =
      cleanString(
        body.mosque_id,
        80
      );

    const prayerDate =
      cleanDate(
        body.prayer_date
      );

    if (!isUuid(mosqueId)) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Missing or invalid mosque_id.",
        },
        400
      );
    }

    if (!prayerDate) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Missing or invalid prayer_date.",
        },
        400
      );
    }

    const permission =
      await requireMosqueManager(
        mosqueId
      );

    if (!permission.ok) {
      return jsonResponse(
        {
          ok: false,
          error:
            permission.error,
        },
        permission.status
      );
    }

    const parsedTimes: Record<
      TimeField,
      string | null
    > = {
      fajr_begins: null,
      fajr_iqamah: null,
      sunrise: null,
      dhuhr_begins: null,
      dhuhr_iqamah: null,
      asr_begins: null,
      asr_iqamah: null,
      maghrib_begins: null,
      maghrib_iqamah: null,
      isha_begins: null,
      isha_iqamah: null,
    };

    for (const field of TIME_FIELDS) {
      const parsed =
        parseTime(body[field]);

      if (!parsed.ok) {
        return jsonResponse(
          {
            ok: false,
            error: `${field.replace(
              /_/g,
              " "
            )} must use a valid 24-hour HH:MM time.`,
          },
          400
        );
      }

      parsedTimes[field] =
        parsed.value;
    }

    const hasPrayerTime =
      TIME_FIELDS.some(
        (field) =>
          Boolean(
            parsedTimes[field]
          )
      );

    if (!hasPrayerTime) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Enter at least one prayer time.",
        },
        400
      );
    }

    const source =
      body.source ===
        undefined
        ? "manual"
        : cleanSource(
            body.source
          );

    const confidence =
      body.confidence ===
        undefined
        ? "official"
        : cleanConfidence(
            body.confidence
          );

    if (!source) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Invalid prayer-time source.",
          allowed_sources:
            SOURCES,
        },
        400
      );
    }

    if (!confidence) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Invalid prayer-time confidence.",
          allowed_confidences:
            CONFIDENCES,
        },
        400
      );
    }

    const notes =
      cleanString(
        body.notes,
        MAX_NOTES_LENGTH
      );

    const now =
      new Date().toISOString();

    const payload = {
      mosque_id: mosqueId,
      prayer_date:
        prayerDate,
      ...parsedTimes,
      source,
      confidence,
      notes,
      updated_at: now,
    };

    const {
      data,
      error,
    } = await supabaseAdmin
      .from(
        "mosque_prayer_times"
      )
      .upsert(payload, {
        onConflict:
          "mosque_id,prayer_date",
      })
      .select("*")
      .single();

    if (error) {
      console.error(
        "Mosque prayer-time save failed:",
        {
          mosqueId,
          prayerDate,
          code: error.code,
          message: error.message,
        }
      );

      return jsonResponse(
        {
          ok: false,
          error:
            error.code ===
            "23503"
              ? "The selected mosque could not be found."
              : "Could not save mosque prayer times.",
        },
        error.code ===
        "23503"
          ? 400
          : 500
      );
    }

    return jsonResponse({
      ok: true,
      message:
        "Prayer times saved successfully.",
      mosque_id: mosqueId,
      prayer_date:
        prayerDate,
      prayer_time: data,
      created_or_updated: true,
    });
  } catch (error) {
    console.error(
      "Mosque prayer-time POST route failed:",
      error
    );

    return jsonResponse(
      {
        ok: false,
        error:
          "Could not save mosque prayer times.",
      },
      500
    );
  }
}