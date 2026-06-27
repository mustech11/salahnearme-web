import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_REPORT_TYPES = [
  "prayer_time_wrong",
  "iqamah_missing",
  "jumuah_time_wrong",
  "location_wrong",
  "facilities_wrong",
  "mosque_closed_or_moved",
  "duplicate_mosque",
  "other",
] as const;

const MAX_MESSAGE_LENGTH = 2000;
const MIN_MESSAGE_LENGTH = 5;
const MAX_NAME_LENGTH = 120;
const MAX_EMAIL_LENGTH = 160;
const MAX_URL_LENGTH = 700;
const MAX_METADATA_KEYS = 20;
const DUPLICATE_WINDOW_MINUTES = 10;

type ReportType = (typeof ALLOWED_REPORT_TYPES)[number];

type RequestBody = {
  mosque_id?: unknown;
  report_type?: unknown;
  report_message?: unknown;
  reporter_name?: unknown;
  reporter_email?: unknown;
  page_url?: unknown;
  metadata?: unknown;

  /**
   * Honeypot spam fields.
   * Real users should never fill these.
   * Bots sometimes fill hidden fields.
   */
  website?: unknown;
  company?: unknown;
  phone_number?: unknown;
};

type PublicMetadata = Record<
  string,
  string | number | boolean | null | undefined
>;

function jsonResponse(
  body: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function isValidUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value.trim()
    )
  );
}

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, maxLength);
}

function cleanLongText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.replace(/\u0000/g, "").trim();

  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, maxLength);
}

function cleanOptionalText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, maxLength);
}

function isValidReportType(value: unknown): value is ReportType {
  return (
    typeof value === "string" &&
    ALLOWED_REPORT_TYPES.includes(value as ReportType)
  );
}

function isLikelyValidEmail(value: string | null) {
  if (!value) {
    return true;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function cleanPageUrl(value: unknown) {
  const cleaned = cleanOptionalText(value, MAX_URL_LENGTH);

  if (!cleaned) {
    return null;
  }

  try {
    const url = new URL(cleaned);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return url.toString().slice(0, MAX_URL_LENGTH);
  } catch {
    if (cleaned.startsWith("/")) {
      return cleaned.slice(0, MAX_URL_LENGTH);
    }

    return null;
  }
}

function cleanMetadata(value: unknown): PublicMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const input = value as Record<string, unknown>;
  const output: PublicMetadata = {};

  for (const [key, rawValue] of Object.entries(input).slice(
    0,
    MAX_METADATA_KEYS
  )) {
    const safeKey = key.trim().slice(0, 80);

    if (!safeKey) {
      continue;
    }

    if (
      typeof rawValue === "string" ||
      typeof rawValue === "number" ||
      typeof rawValue === "boolean" ||
      rawValue === null
    ) {
      output[safeKey] =
        typeof rawValue === "string" ? rawValue.slice(0, 300) : rawValue;
    }
  }

  return output;
}

function getClientIp(req: Request) {
  const forwardedFor = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  const cfIp = req.headers.get("cf-connecting-ip");

  if (cfIp) {
    return cfIp.split(",")[0]?.trim() || null;
  }

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || null;
  }

  if (realIp) {
    return realIp.trim();
  }

  return null;
}

function hasHoneypotValue(body: RequestBody) {
  return Boolean(
    cleanOptionalText(body.website, 200) ||
      cleanOptionalText(body.company, 200) ||
      cleanOptionalText(body.phone_number, 200)
  );
}

function normaliseReportMessageForDuplicateCheck(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 300);
}

function getDuplicateSinceIso() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - DUPLICATE_WINDOW_MINUTES);
  return date.toISOString();
}

async function findRecentDuplicateReport({
  mosqueId,
  reportType,
  reportMessage,
  clientIp,
}: {
  mosqueId: string;
  reportType: ReportType;
  reportMessage: string;
  clientIp: string | null;
}) {
  const since = getDuplicateSinceIso();
  const normalisedMessage =
    normaliseReportMessageForDuplicateCheck(reportMessage);

  let query = supabaseAdmin
    .from("mosque_correction_reports")
    .select("id, report_message, metadata, created_at")
    .eq("mosque_id", mosqueId)
    .eq("report_type", reportType)
    .gte("created_at", since)
    .order("created_at", {
      ascending: false,
    })
    .limit(10);

  const { data, error } = await query;

  if (error || !data) {
    return false;
  }

  return data.some((report) => {
    const existingMessage = normaliseReportMessageForDuplicateCheck(
      String(report.report_message ?? "")
    );

    const metadata = report.metadata as Record<string, unknown> | null;
    const existingIp =
      typeof metadata?.ip_hint === "string" ? metadata.ip_hint : null;

    const sameMessage = existingMessage === normalisedMessage;
    const sameIp = clientIp && existingIp && clientIp === existingIp;

    return sameMessage || sameIp;
  });
}

export async function GET() {
  return jsonResponse({
    ok: true,
    route: "/api/mosque/correction-report",
    method: "POST",
    allowed_report_types: ALLOWED_REPORT_TYPES,
    limits: {
      min_message_length: MIN_MESSAGE_LENGTH,
      max_message_length: MAX_MESSAGE_LENGTH,
      max_name_length: MAX_NAME_LENGTH,
      max_email_length: MAX_EMAIL_LENGTH,
      max_url_length: MAX_URL_LENGTH,
      duplicate_window_minutes: DUPLICATE_WINDOW_MINUTES,
    },
    body: {
      mosque_id: "uuid",
      report_type: "prayer_time_wrong",
      report_message: "Message from user",
      reporter_name: "optional",
      reporter_email: "optional",
      page_url: "optional",
      metadata: {},
      website: "honeypot optional; leave empty",
    },
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as RequestBody;

    /**
     * Honeypot: return success-looking response but do not save.
     * This avoids teaching spam bots what failed.
     */
    if (hasHoneypotValue(body)) {
      return jsonResponse(
        {
          ok: true,
          report: null,
        },
        201
      );
    }

    const mosqueIdRaw = cleanText(body.mosque_id, 80);
    const reportMessage = cleanLongText(
      body.report_message,
      MAX_MESSAGE_LENGTH
    );

    if (!isValidUuid(mosqueIdRaw)) {
      return jsonResponse(
        {
          ok: false,
          error: "Missing or invalid mosque_id.",
        },
        400
      );
    }

    const mosqueId = mosqueIdRaw;

    if (!isValidReportType(body.report_type)) {
      return jsonResponse(
        {
          ok: false,
          error: "Missing or invalid report_type.",
          allowed_report_types: ALLOWED_REPORT_TYPES,
        },
        400
      );
    }

    const reportType = body.report_type;

    if (!reportMessage || reportMessage.length < MIN_MESSAGE_LENGTH) {
      return jsonResponse(
        {
          ok: false,
          error: `Please describe the issue in at least ${MIN_MESSAGE_LENGTH} characters.`,
        },
        400
      );
    }

    const reporterName = cleanOptionalText(
      body.reporter_name,
      MAX_NAME_LENGTH
    );

    const reporterEmail = cleanOptionalText(
      body.reporter_email,
      MAX_EMAIL_LENGTH
    );

    if (!isLikelyValidEmail(reporterEmail)) {
      return jsonResponse(
        {
          ok: false,
          error: "Please enter a valid email address or leave it blank.",
        },
        400
      );
    }

    const pageUrl = cleanPageUrl(body.page_url);
    const clientIp = getClientIp(req);
    const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? null;

    const { data: mosque, error: mosqueError } = await supabaseAdmin
      .from("mosques")
      .select("id, name, slug, city, area")
      .eq("id", mosqueId)
      .maybeSingle();

    if (mosqueError) {
      console.error("correction-report mosque lookup error:", mosqueError);

      return jsonResponse(
        {
          ok: false,
          error: "Could not verify mosque.",
        },
        500
      );
    }

    if (!mosque) {
      return jsonResponse(
        {
          ok: false,
          error: "Mosque not found.",
        },
        404
      );
    }

    const isDuplicate = await findRecentDuplicateReport({
      mosqueId,
      reportType,
      reportMessage,
      clientIp,
    });

    if (isDuplicate) {
      return jsonResponse(
        {
          ok: false,
          error:
            "A similar report was submitted recently. Please wait before submitting again.",
        },
        429
      );
    }

    const metadata = {
      ...cleanMetadata(body.metadata),
      mosque_name: mosque.name ?? null,
      mosque_slug: mosque.slug ?? null,
      mosque_city: mosque.city ?? null,
      mosque_area: mosque.area ?? null,
      user_agent: userAgent,
      ip_hint: clientIp,
      submitted_at: new Date().toISOString(),
      anti_spam: {
        duplicate_window_minutes: DUPLICATE_WINDOW_MINUTES,
        honeypot_checked: true,
      },
    };

    const { data, error } = await supabaseAdmin
      .from("mosque_correction_reports")
      .insert({
        mosque_id: mosqueId,
        report_type: reportType,
        report_message: reportMessage,
        reporter_name: reporterName,
        reporter_email: reporterEmail,
        page_url: pageUrl,
        metadata,
        status: "new",
      })
      .select("id, mosque_id, report_type, status, created_at")
      .single();

    if (error) {
      console.error("correction-report insert error:", error);

      return jsonResponse(
        {
          ok: false,
          error: "Could not submit correction report.",
        },
        500
      );
    }

    return jsonResponse(
      {
        ok: true,
        report: data,
      },
      201
    );
  } catch (error) {
    console.error("mosque correction report error:", error);

    return jsonResponse(
      {
        ok: false,
        error: "Could not submit correction report.",
      },
      500
    );
  }
}

