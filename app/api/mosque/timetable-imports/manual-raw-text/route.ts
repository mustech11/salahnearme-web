import { NextResponse } from "next/server";

import { requireMosqueManager } from "@/lib/mosqueManagerAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  import_id?: unknown;
  raw_text?: unknown;
};

type TimetableImportLookup = {
  id: string;
  mosque_id: string | null;
  source_id: string | null;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MIN_RAW_TEXT_LENGTH = 20;
const MAX_RAW_TEXT_LENGTH = 100_000;

function jsonResponse(
  body: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
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

function isJsonRequest(request: Request): boolean {
  const contentType = request.headers.get("content-type");

  return Boolean(
    contentType?.toLowerCase().includes("application/json")
  );
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

    const body = (await request
      .json()
      .catch(() => null)) as Body | null;

    if (!body || typeof body !== "object") {
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

    const {
      data: importRowRaw,
      error: lookupError,
    } = await supabaseAdmin
      .from("mosque_timetable_imports")
      .select("id, mosque_id, source_id")
      .eq("id", importId)
      .maybeSingle();

    if (lookupError) {
      console.error(
        "manual raw text import lookup error:",
        lookupError
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
        400
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

    const now = new Date().toISOString();

    const { data: updatedImport, error: updateError } =
      await supabaseAdmin
        .from("mosque_timetable_imports")
        .update({
          raw_text: rawText,
          extracted_json: null,
          status: "extracted",
          confidence_score:
            rawText.length >= 500 ? 50 : 40,
          error_message: null,
          updated_at: now,
        })
        .eq("id", importId)
        .eq("mosque_id", mosqueId)
        .select("*")
        .maybeSingle();

    if (updateError) {
      console.error(
        "manual raw text import update error:",
        updateError
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

    if (!updatedImport) {
      return jsonResponse(
        {
          ok: false,
          error:
            "The timetable import could not be updated.",
        },
        409
      );
    }

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
          "manual raw text source update error:",
          sourceUpdateError
        );
      }
    }

    return jsonResponse({
      ok: true,
      message:
        "Raw timetable text saved successfully.",
      raw_text_length: rawText.length,
      import: updatedImport,
    });
  } catch (error) {
    console.error(
      "manual raw text route error:",
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