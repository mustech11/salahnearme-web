import { NextResponse } from "next/server";

import { requireMosqueManager } from "@/lib/mosqueManagerAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALLOWED_STATUSES = [
  "new",
  "reviewing",
  "resolved",
  "rejected",
] as const;

const MAX_REQUEST_BODY_BYTES =
  12_000;

const MAX_ADMIN_NOTES_LENGTH =
  2_000;

type AllowedStatus =
  (typeof ALLOWED_STATUSES)[number];

type RequestBody = {
  report_id?: unknown;
  mosque_id?: unknown;
  status?: unknown;
  admin_notes?: unknown;
};

type ExistingReportRow = {
  id: string;
  mosque_id: string;
  status: string | null;
  admin_notes: string | null;
  reviewed_at: string | null;
  resolved_at: string | null;
};

function jsonResponse(
  body: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control":
        "no-store, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
      "X-Content-Type-Options":
        "nosniff",
    },
  });
}

function cleanString(
  value: unknown
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned =
    value.trim();

  return cleaned || null;
}

function normaliseNotes(
  value: unknown
): string | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();

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

function cleanStatus(
  value: unknown
): AllowedStatus | null {
  const cleaned =
    cleanString(value)?.toLowerCase();

  if (!cleaned) {
    return null;
  }

  return ALLOWED_STATUSES.includes(
    cleaned as AllowedStatus
  )
    ? (cleaned as AllowedStatus)
    : null;
}

function isJsonRequest(
  request: Request
): boolean {
  return Boolean(
    request.headers
      .get("content-type")
      ?.toLowerCase()
      .includes(
        "application/json"
      )
  );
}

function isSameValue(
  first: string | null,
  second: string | null
): boolean {
  return (
    (first ?? "").trim() ===
    (second ?? "").trim()
  );
}

async function readRequestBody(
  request: Request
): Promise<
  | {
      ok: true;
      body: RequestBody;
    }
  | {
      ok: false;
      status: number;
      error: string;
    }
> {
  if (!isJsonRequest(request)) {
    return {
      ok: false,
      status: 415,
      error:
        "Content-Type must be application/json.",
    };
  }

  const contentLength =
    request.headers.get(
      "content-length"
    );

  if (contentLength) {
    const parsedLength =
      Number(contentLength);

    if (
      Number.isFinite(
        parsedLength
      ) &&
      parsedLength >
        MAX_REQUEST_BODY_BYTES
    ) {
      return {
        ok: false,
        status: 413,
        error:
          "Request body is too large.",
      };
    }
  }

  const rawBody =
    await request.text();

  if (
    new TextEncoder().encode(
      rawBody
    ).length >
    MAX_REQUEST_BODY_BYTES
  ) {
    return {
      ok: false,
      status: 413,
      error:
        "Request body is too large.",
    };
  }

  if (!rawBody.trim()) {
    return {
      ok: false,
      status: 400,
      error:
        "Request body is required.",
    };
  }

  try {
    const parsed: unknown =
      JSON.parse(rawBody);

    if (
      !parsed ||
      typeof parsed !==
        "object" ||
      Array.isArray(parsed)
    ) {
      return {
        ok: false,
        status: 400,
        error:
          "Invalid JSON body.",
      };
    }

    return {
      ok: true,
      body:
        parsed as RequestBody,
    };
  } catch {
    return {
      ok: false,
      status: 400,
      error:
        "Invalid JSON body.",
    };
  }
}

export async function GET() {
  return jsonResponse({
    ok: true,
    route:
      "/api/mosque/correction-report/update",
    method: "POST",
    allowed_statuses:
      ALLOWED_STATUSES,
    requirements: {
      content_type:
        "application/json",
      maximum_body_bytes:
        MAX_REQUEST_BODY_BYTES,
      maximum_admin_notes_length:
        MAX_ADMIN_NOTES_LENGTH,
    },
    body: {
      report_id:
        "required UUID",
      mosque_id:
        "required UUID",
      status:
        ALLOWED_STATUSES,
      admin_notes:
        "optional except when resolving or rejecting",
    },
  });
}

export async function POST(
  request: Request
) {
  try {
    const parsedRequest =
      await readRequestBody(
        request
      );

    if (!parsedRequest.ok) {
      return jsonResponse(
        {
          ok: false,
          error:
            parsedRequest.error,
        },
        parsedRequest.status
      );
    }

    const {
      report_id,
      mosque_id,
      status: requestedStatus,
      admin_notes,
    } = parsedRequest.body;

    const reportId =
      cleanString(report_id);

    const mosqueId =
      cleanString(mosque_id);

    const status =
      cleanStatus(
        requestedStatus
      );

    const adminNotes =
      normaliseNotes(
        admin_notes
      );

    if (!isUuid(reportId)) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Missing or invalid report_id.",
        },
        400
      );
    }

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

    if (!status) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Missing or invalid status.",
          allowed_statuses:
            ALLOWED_STATUSES,
        },
        400
      );
    }

    if (
      adminNotes &&
      adminNotes.length >
        MAX_ADMIN_NOTES_LENGTH
    ) {
      return jsonResponse(
        {
          ok: false,
          error: `Manager notes must not exceed ${MAX_ADMIN_NOTES_LENGTH.toLocaleString(
            "en-GB"
          )} characters.`,
        },
        400
      );
    }

    if (
      (status === "resolved" ||
        status === "rejected") &&
      !adminNotes
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Manager notes are required before resolving or rejecting a correction report.",
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

    const {
      data: existingReportRaw,
      error: existingError,
    } = await supabaseAdmin
      .from(
        "mosque_correction_reports"
      )
      .select(
        [
          "id",
          "mosque_id",
          "status",
          "admin_notes",
          "reviewed_at",
          "resolved_at",
        ].join(",")
      )
      .eq("id", reportId)
      .eq(
        "mosque_id",
        mosqueId
      )
      .maybeSingle();

    if (existingError) {
      console.error(
        "Correction report lookup failed:",
        {
          reportId,
          mosqueId,
          code:
            existingError.code,
          message:
            existingError.message,
        }
      );

      return jsonResponse(
        {
          ok: false,
          error:
            "Could not load the correction report.",
        },
        500
      );
    }

    if (!existingReportRaw) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Correction report not found for this mosque.",
        },
        404
      );
    }

    const rawReport =
  existingReportRaw as unknown as Record<string, unknown>;

const existingReport: ExistingReportRow = {
  id:
    typeof rawReport.id === "string"
      ? rawReport.id
      : reportId,

  mosque_id:
    typeof rawReport.mosque_id === "string"
      ? rawReport.mosque_id
      : mosqueId,

  status:
    typeof rawReport.status === "string"
      ? rawReport.status
      : null,

  admin_notes:
    typeof rawReport.admin_notes === "string"
      ? rawReport.admin_notes
      : null,

  reviewed_at:
    typeof rawReport.reviewed_at === "string"
      ? rawReport.reviewed_at
      : null,

  resolved_at:
    typeof rawReport.resolved_at === "string"
      ? rawReport.resolved_at
      : null,
};

    const existingStatus =
  cleanStatus(existingReport.status) ?? "new";

const existingNotes =
  normaliseNotes(existingReport.admin_notes);

    if (
      existingStatus === status &&
      isSameValue(
        existingNotes,
        adminNotes
      )
    ) {
      return jsonResponse({
        ok: true,
        unchanged: true,
        report: {
          ...existingReport,
          status:
            existingStatus,
          admin_notes:
            existingNotes,
        },
        message:
          "No correction-report changes were required.",
      });
    }

    const now =
      new Date().toISOString();

    let reviewedAt =
      existingReport.reviewed_at;

    let resolvedAt =
      existingReport.resolved_at;

    if (status === "new") {
      reviewedAt = null;
      resolvedAt = null;
    }

    if (
      status === "reviewing"
    ) {
      reviewedAt =
        reviewedAt ?? now;
      resolvedAt = null;
    }

    if (
      status === "resolved"
    ) {
      reviewedAt =
        reviewedAt ?? now;

      resolvedAt =
        existingStatus ===
          "resolved" &&
        resolvedAt
          ? resolvedAt
          : now;
    }

    if (
      status === "rejected"
    ) {
      reviewedAt =
        reviewedAt ?? now;

      /*
       * Rejection is a reviewed outcome,
       * but not a resolved correction.
       */
      resolvedAt = null;
    }

    const {
      data: updatedReport,
      error: updateError,
    } = await supabaseAdmin
      .from(
        "mosque_correction_reports"
      )
      .update({
        status,
        admin_notes:
          adminNotes,
        reviewed_at:
          reviewedAt,
        resolved_at:
          resolvedAt,
        updated_at: now,
      })
      .eq("id", reportId)
      .eq(
        "mosque_id",
        mosqueId
      )
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

    if (updateError) {
      console.error(
        "Correction report update failed:",
        {
          reportId,
          mosqueId,
          status,
          code:
            updateError.code,
          message:
            updateError.message,
        }
      );

      return jsonResponse(
        {
          ok: false,
          error:
            "Could not update the correction report.",
        },
        500
      );
    }

    if (!updatedReport) {
      return jsonResponse(
        {
          ok: false,
          error:
            "The correction report changed or could no longer be updated.",
        },
        409
      );
    }

    return jsonResponse({
      ok: true,
      unchanged: false,
      report: updatedReport,
      message:
        "Correction report updated successfully.",
    });
  } catch (error) {
    console.error(
      "Correction report update exception:",
      error
    );

    return jsonResponse(
      {
        ok: false,
        error:
          "Could not update the correction report.",
      },
      500
    );
  }
}