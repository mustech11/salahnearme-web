import { NextResponse } from "next/server";

import { requireMosqueManager } from "@/lib/mosqueManagerAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALLOWED_STATUSES = ["new", "reviewing", "resolved", "rejected"] as const;

const MAX_ADMIN_NOTES_LENGTH = 2000;

type AllowedStatus = (typeof ALLOWED_STATUSES)[number];

type RequestBody = {
  report_id?: unknown;
  mosque_id?: unknown;
  status?: unknown;
  admin_notes?: unknown;
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

function cleanStatus(value: unknown): AllowedStatus | null {
  const cleaned = cleanString(value, 40);

  if (!cleaned) {
    return null;
  }

  return ALLOWED_STATUSES.includes(cleaned as AllowedStatus)
    ? (cleaned as AllowedStatus)
    : null;
}

function cleanOptionalNotes(value: unknown) {
  return cleanString(value, MAX_ADMIN_NOTES_LENGTH);
}

export async function GET() {
  return jsonResponse({
    ok: true,
    route: "/api/mosque/correction-report/update",
    method: "POST",
    allowed_statuses: ALLOWED_STATUSES,
    body: {
      report_id: "required UUID",
      mosque_id: "required UUID",
      status: ALLOWED_STATUSES,
      admin_notes: "optional notes",
    },
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as RequestBody | null;

    if (!body || typeof body !== "object") {
      return jsonResponse(
        {
          ok: false,
          error: "Invalid JSON body.",
        },
        400
      );
    }

    const reportId = cleanString(body.report_id, 80);
    const mosqueId = cleanString(body.mosque_id, 80);
    const status = cleanStatus(body.status);
    const adminNotes = cleanOptionalNotes(body.admin_notes);

    if (!isUuid(reportId)) {
      return jsonResponse(
        {
          ok: false,
          error: "Missing or invalid report_id.",
        },
        400
      );
    }

    if (!isUuid(mosqueId)) {
      return jsonResponse(
        {
          ok: false,
          error: "Missing or invalid mosque_id.",
        },
        400
      );
    }

    if (!status) {
      return jsonResponse(
        {
          ok: false,
          error: "Missing or invalid status.",
          allowed_statuses: ALLOWED_STATUSES,
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

    const { data: existingReport, error: existingError } = await supabaseAdmin
      .from("mosque_correction_reports")
      .select("id, mosque_id, status")
      .eq("id", reportId)
      .eq("mosque_id", mosqueId)
      .maybeSingle();

    if (existingError) {
      console.error("correction report lookup error:", existingError);

      return jsonResponse(
        {
          ok: false,
          error: existingError.message,
        },
        500
      );
    }

    if (!existingReport) {
      return jsonResponse(
        {
          ok: false,
          error: "Correction report not found for this mosque.",
        },
        404
      );
    }

    const now = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from("mosque_correction_reports")
      .update({
        status,
        admin_notes: adminNotes,
        reviewed_at: status === "new" ? null : now,
        resolved_at: status === "resolved" ? now : null,
        updated_at: now,
      })
      .eq("id", reportId)
      .eq("mosque_id", mosqueId)
      .select(
        [
          "id",
          "mosque_id",
          "report_type",
          "status",
          "admin_notes",
          "reviewed_at",
          "resolved_at",
          "updated_at",
        ].join(",")
      )
      .maybeSingle();

    if (error) {
      console.error("correction report update error:", error);

      return jsonResponse(
        {
          ok: false,
          error: error.message,
        },
        500
      );
    }

    if (!data) {
      return jsonResponse(
        {
          ok: false,
          error: "Correction report could not be updated.",
        },
        404
      );
    }

    return jsonResponse({
      ok: true,
      report: data,
      message: "Correction report updated.",
    });
  } catch (error) {
    console.error("correction report update error:", error);

    return jsonResponse(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not update correction report.",
      },
      500
    );
  }
}