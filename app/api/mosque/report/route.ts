import { createHash } from "crypto";

import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const REPORT_TYPES = [
  "iqamah_started",
  "khutbah_live",
  "full",
  "parking_full",
  "correction",
  "jumuah_first",
  "jumuah_second",
  "jumuah_third",
] as const;

const PRAYERS = [
  "fajr",
  "dhuhr",
  "asr",
  "maghrib",
  "isha",
  "jumuah",
] as const;

type ReportType =
  (typeof REPORT_TYPES)[number];

type Prayer =
  (typeof PRAYERS)[number];

type Body = {
  mosque_id?: unknown;
  report_type?: unknown;
  prayer?: unknown;
  message?: unknown;
  website?: unknown;
};

const DUPLICATE_WINDOW_MINUTES = 10;
const RATE_LIMIT_WINDOW_MINUTES = 30;
const MAX_REPORTS_PER_WINDOW = 8;
const MAX_MESSAGE_LENGTH = 300;
const MAX_REQUEST_BODY_BYTES = 8_000;
const MAX_USER_AGENT_LENGTH = 500;

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
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

  return cleaned || null;
}

function cleanMessage(
  value: unknown
): string | null {
  return cleanString(
    value,
    MAX_MESSAGE_LENGTH
  );
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

function isReportType(
  value: unknown
): value is ReportType {
  return (
    typeof value === "string" &&
    REPORT_TYPES.includes(
      value as ReportType
    )
  );
}

function cleanPrayer(
  value: unknown
): Prayer | null {
  const cleaned =
    cleanString(value, 20)
      ?.toLowerCase();

  if (!cleaned) {
    return null;
  }

  return PRAYERS.includes(
    cleaned as Prayer
  )
    ? (cleaned as Prayer)
    : null;
}

function minutesAgoIso(
  minutes: number
): string {
  return new Date(
    Date.now() -
      minutes * 60 * 1000
  ).toISOString();
}

function sha256(
  input: string
): string {
  return createHash("sha256")
    .update(input)
    .digest("hex");
}

function getClientIp(
  request: Request
): string | null {
  const cfIp =
    request.headers.get(
      "cf-connecting-ip"
    );

  const forwardedFor =
    request.headers.get(
      "x-forwarded-for"
    );

  const realIp =
    request.headers.get(
      "x-real-ip"
    );

  if (cfIp) {
    return (
      cfIp.split(",")[0]?.trim() ||
      null
    );
  }

  if (forwardedFor) {
    return (
      forwardedFor
        .split(",")[0]
        ?.trim() || null
    );
  }

  return realIp?.trim() || null;
}

function getFingerprint(
  request: Request
): string | null {
  const clientIp =
    getClientIp(request);

  const userAgent =
    request.headers
      .get("user-agent")
      ?.slice(
        0,
        MAX_USER_AGENT_LENGTH
      ) ?? "";

  const acceptLanguage =
    request.headers.get(
      "accept-language"
    ) ?? "";

  const raw = [
    clientIp ?? "",
    userAgent,
    acceptLanguage,
  ]
    .map((value) =>
      value.trim()
    )
    .join("|");

  return raw.replace(/\|/g, "")
    ? sha256(raw)
    : null;
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
    Number.isFinite(
      contentLength
    ) &&
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

export async function GET() {
  return jsonResponse({
    ok: true,
    route:
      "/api/mosque/report",
    method: "POST",
    report_types:
      REPORT_TYPES,
    prayers: PRAYERS,
    limits: {
      duplicate_window_minutes:
        DUPLICATE_WINDOW_MINUTES,
      rate_limit_window_minutes:
        RATE_LIMIT_WINDOW_MINUTES,
      max_reports_per_window:
        MAX_REPORTS_PER_WINDOW,
      max_message_length:
        MAX_MESSAGE_LENGTH,
    },
  });
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

    if (
      cleanString(
        body.website,
        200
      )
    ) {
      return jsonResponse(
        {
          ok: true,
          accepted: true,
          ignored: true,
        },
        202
      );
    }

    const mosqueId =
      cleanString(
        body.mosque_id,
        80
      );

    const reportType =
      body.report_type;

    const prayer =
      cleanPrayer(
        body.prayer
      );

    const message =
      cleanMessage(
        body.message
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

    if (!isReportType(reportType)) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Missing or invalid report_type.",
          allowed_report_types:
            REPORT_TYPES,
        },
        400
      );
    }

    if (
      body.prayer !== null &&
      body.prayer !== undefined &&
      body.prayer !== "" &&
      !prayer
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Invalid prayer value.",
          allowed_prayers:
            PRAYERS,
        },
        400
      );
    }

    const {
      data: mosque,
      error: mosqueError,
    } = await supabaseAdmin
      .from("mosques")
      .select("id")
      .eq("id", mosqueId)
      .maybeSingle();

    if (mosqueError) {
      console.error(
        "Mosque live report mosque lookup failed:",
        {
          mosqueId,
          code: mosqueError.code,
          message:
            mosqueError.message,
        }
      );

      return jsonResponse(
        {
          ok: false,
          error:
            "Could not verify mosque.",
        },
        500
      );
    }

    if (!mosque) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Mosque not found.",
        },
        404
      );
    }

    const userFingerprint =
      getFingerprint(request);

    if (userFingerprint) {
      const duplicateSince =
        minutesAgoIso(
          DUPLICATE_WINDOW_MINUTES
        );

      const {
        count: duplicateCount,
        error: duplicateError,
      } = await supabaseAdmin
        .from(
          "mosque_live_reports"
        )
        .select("*", {
          count: "exact",
          head: true,
        })
        .eq(
          "mosque_id",
          mosqueId
        )
        .eq(
          "report_type",
          reportType
        )
        .eq(
          "user_fingerprint",
          userFingerprint
        )
        .gte(
          "created_at",
          duplicateSince
        );

      if (duplicateError) {
        console.error(
          "Mosque live report duplicate check failed:",
          {
            mosqueId,
            reportType,
            code:
              duplicateError.code,
            message:
              duplicateError.message,
          }
        );

        return jsonResponse(
          {
            ok: false,
            error:
              "Could not validate this report.",
          },
          500
        );
      }

      if (
        (duplicateCount ?? 0) >
        0
      ) {
        return jsonResponse(
          {
            ok: false,
            error:
              "You already submitted this report recently. Please wait before sending it again.",
          },
          429
        );
      }

      const rateLimitSince =
        minutesAgoIso(
          RATE_LIMIT_WINDOW_MINUTES
        );

      const {
        count: recentCount,
        error: recentError,
      } = await supabaseAdmin
        .from(
          "mosque_live_reports"
        )
        .select("*", {
          count: "exact",
          head: true,
        })
        .eq(
          "user_fingerprint",
          userFingerprint
        )
        .gte(
          "created_at",
          rateLimitSince
        );

      if (recentError) {
        console.error(
          "Mosque live report rate-limit check failed:",
          {
            code:
              recentError.code,
            message:
              recentError.message,
          }
        );

        return jsonResponse(
          {
            ok: false,
            error:
              "Could not validate this report.",
          },
          500
        );
      }

      if (
        (recentCount ?? 0) >=
        MAX_REPORTS_PER_WINDOW
      ) {
        return jsonResponse(
          {
            ok: false,
            error:
              "Too many reports were submitted recently. Please wait before sending more.",
          },
          429
        );
      }
    }

    const {
      data,
      error,
    } = await supabaseAdmin
      .from(
        "mosque_live_reports"
      )
      .insert({
        mosque_id: mosqueId,
        report_type:
          reportType,
        prayer,
        message,
        user_fingerprint:
          userFingerprint,
      })
      .select(
        "id,mosque_id,report_type,prayer,created_at"
      )
      .single();

    if (error) {
      console.error(
        "Mosque live report insert failed:",
        {
          mosqueId,
          reportType,
          code: error.code,
          message: error.message,
        }
      );

      return jsonResponse(
        {
          ok: false,
          error:
            "Could not submit mosque report.",
        },
        500
      );
    }

    return jsonResponse(
      {
        ok: true,
        message:
          "Mosque report submitted successfully.",
        report_id:
          typeof data?.id ===
          "string"
            ? data.id
            : null,
        report: data,
      },
      201
    );
  } catch (error) {
    console.error(
      "Mosque report route failed:",
      error
    );

    return jsonResponse(
      {
        ok: false,
        error:
          "Could not submit mosque report.",
      },
      500
    );
  }
}