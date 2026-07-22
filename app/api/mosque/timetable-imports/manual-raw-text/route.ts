import { NextResponse } from "next/server";

import { requireMosqueManager } from "@/lib/mosqueManagerAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Body = {
  import_id?: unknown;
  raw_text?: unknown;
};

type TimetableImportLookup = {
  id: string;
  mosque_id: string | null;
  source_id: string | null;
  status: string | null;
};

type UpdatedImportRow = {
  id: string;
  mosque_id: string | null;
  source_id: string | null;
  status: string | null;
  confidence_score: number | null;
  updated_at: string | null;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MIN_RAW_TEXT_LENGTH = 20;
const MAX_RAW_TEXT_LENGTH = 100_000;

const LOCKED_STATUSES = new Set([
  "approved",
]);

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
    },
  });
}

function cleanString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.trim();

  return cleaned.length > 0 ? cleaned : null;
}

function isUuid(value: string | null): value is string {
  return Boolean(value && UUID_REGEX.test(value));
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

function isJsonRequest(request: Request): boolean {
  const contentType =
    request.headers.get("content-type")?.toLowerCase() ?? "";

  return contentType.includes("application/json");
}

function calculateConfidenceScore(rawText: string): number {
  if (rawText.length >= 2_000) {
    return 55;
  }

  if (rawText.length >= 500) {
    return 50;
  }

  return 40;
}

async function readBody(request: Request): Promise<Body | null> {
  try {
    const value: unknown = await request.json();

    if (!isPlainObject(value)) {
      return null;
    }

    return value as Body;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    if (!isJsonRequest(request)) {
      return jsonResponse(
        {
          ok: false,
          error: "Content-Type must be application/json.",
        },
        415
      );
    }

    const body = await readBody(request);

    if (!body) {
      return jsonResponse(
        {
          ok: false,
          error: "Invalid JSON body.",
        },
        400
      );
    }

    const importId = cleanString(body.import_id);
    const rawText = cleanString(body.raw_text);

    if (!isUuid(importId)) {
      return jsonResponse(
        {
          ok: false,
          error: "Missing or invalid import_id.",
        },
        400
      );
    }

    if (!rawText) {
      return jsonResponse(
        {
          ok: false,
          error: "Raw timetable text is required.",
        },
        400
      );
    }

    if (rawText.length < MIN_RAW_TEXT_LENGTH) {
      return jsonResponse(
        {
          ok: false,
          error: `Paste at least ${MIN_RAW_TEXT_LENGTH} characters of timetable text.`,
        },
        400
      );
    }

    if (rawText.length > MAX_RAW_TEXT_LENGTH) {
      return jsonResponse(
        {
          ok: false,
          error: `Raw timetable text must not exceed ${MAX_RAW_TEXT_LENGTH.toLocaleString()} characters.`,
        },
        413
      );
    }

    const { data: importRowRaw, error: lookupError } =
      await supabaseAdmin
        .from("mosque_timetable_imports")
        .select("id,mosque_id,source_id,status")
        .eq("id", importId)
        .maybeSingle();

    if (lookupError) {
      console.error(
        "Manual raw text import lookup failed:",
        {
          importId,
          code: lookupError.code,
          message: lookupError.message,
        }
      );

      return jsonResponse(
        {
          ok: false,
          error: "Could not load the timetable import.",
        },
        500
      );
    }

    if (!importRowRaw) {
      return jsonResponse(
        {
          ok: false,
          error: "Import record not found.",
        },
        404
      );
    }

    const importRow =
      importRowRaw as TimetableImportLookup;

    const mosqueId = cleanString(importRow.mosque_id);

    if (!isUuid(mosqueId)) {
      return jsonResponse(
        {
          ok: false,
          error:
            "The timetable import is not linked to a valid mosque.",
        },
        409
      );
    }

    const permission =
      await requireMosqueManager(mosqueId);

    if (!permission.ok) {
      return jsonResponse(
        {
          ok: false,
          error: permission.error,
        },
        permission.status
      );
    }

    const currentStatus =
      cleanString(importRow.status)?.toLowerCase() ?? null;

    if (
      currentStatus &&
      LOCKED_STATUSES.has(currentStatus)
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            "This timetable has already been approved. Create a new import before replacing its raw text.",
        },
        409
      );
    }

    const now = new Date().toISOString();
    const confidenceScore =
      calculateConfidenceScore(rawText);

    let updateQuery = supabaseAdmin
      .from("mosque_timetable_imports")
      .update({
        raw_text: rawText,
        extracted_json: null,
        status: "extracted",
        confidence_score: confidenceScore,
        error_message: null,
        reviewed_by: null,
        reviewed_at: null,
        updated_at: now,
      })
      .eq("id", importId)
      .eq("mosque_id", mosqueId);

    if (currentStatus) {
      updateQuery = updateQuery.eq(
        "status",
        currentStatus
      );
    } else {
      updateQuery = updateQuery.is("status", null);
    }

    const {
      data: updatedImportRaw,
      error: updateError,
    } = await updateQuery
      .select(
        "id,mosque_id,source_id,status,confidence_score,updated_at"
      )
      .maybeSingle();

    if (updateError) {
      console.error(
        "Manual raw text import update failed:",
        {
          importId,
          mosqueId,
          code: updateError.code,
          message: updateError.message,
        }
      );

      return jsonResponse(
        {
          ok: false,
          error:
            "Could not save the manual timetable text.",
        },
        500
      );
    }

    if (!updatedImportRaw) {
      return jsonResponse(
        {
          ok: false,
          error:
            "The timetable import changed while it was being edited. Refresh the page and try again.",
        },
        409
      );
    }

    const updatedImport =
      updatedImportRaw as UpdatedImportRow;

    const sourceId = cleanString(importRow.source_id);

    if (isUuid(sourceId)) {
      const { error: sourceUpdateError } =
        await supabaseAdmin
          .from("mosque_timetable_sources")
          .update({
            last_checked_at: now,
            last_success_at: now,
            last_error: null,
            updated_at: now,
          })
          .eq("id", sourceId)
          .eq("mosque_id", mosqueId);

      if (sourceUpdateError) {
        console.error(
          "Manual raw text source update failed:",
          {
            importId,
            mosqueId,
            sourceId,
            code: sourceUpdateError.code,
            message: sourceUpdateError.message,
          }
        );
      }
    }

    return jsonResponse({
      ok: true,
      message:
        "Raw timetable text saved successfully. It is ready to be parsed.",
      raw_text_length: rawText.length,
      import: updatedImport,
    });
  } catch (error) {
    console.error(
      "Manual raw text route failed:",
      error
    );

    return jsonResponse(
      {
        ok: false,
        error:
          "Could not save manual raw timetable text.",
      },
      500
    );
  }
}