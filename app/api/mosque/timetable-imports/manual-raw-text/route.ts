import { NextResponse } from "next/server";

import { requireMosqueManager } from "@/lib/mosqueManagerAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  import_id?: string;
  raw_text?: string;
};

function cleanString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function isUuid(value: string | null) {
  if (!value) {
    return false;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function limitText(value: string, maxLength = 120000) {
  if (value.length <= maxLength) {
    return value;
  }

  return value.slice(0, maxLength);
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

    const importId = cleanString(body.import_id);
    const rawText = cleanString(body.raw_text);

    if (!isUuid(importId)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing or invalid import_id.",
        },
        {
          status: 400,
        }
      );
    }

    if (!rawText || rawText.length < 20) {
      return NextResponse.json(
        {
          ok: false,
          error: "Paste at least 20 characters of timetable text.",
        },
        {
          status: 400,
        }
      );
    }

    const { data: importRow, error: lookupError } = await supabaseAdmin
      .from("mosque_timetable_imports")
      .select("id, mosque_id, source_id")
      .eq("id", importId)
      .maybeSingle();

    if (lookupError) {
      return NextResponse.json(
        {
          ok: false,
          error: lookupError.message,
        },
        {
          status: 500,
        }
      );
    }

    if (!importRow) {
      return NextResponse.json(
        {
          ok: false,
          error: "Import record not found.",
        },
        {
          status: 404,
        }
      );
    }

    const mosqueId = cleanString(importRow.mosque_id);

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

    const now = new Date().toISOString();
    const cleanedRawText = limitText(rawText);

    const { data, error } = await supabaseAdmin
      .from("mosque_timetable_imports")
      .update({
        raw_text: cleanedRawText,
        extracted_json: null,
        status: "extracted",
        confidence_score: cleanedRawText.length > 500 ? 50 : 40,
        error_message: null,
        updated_at: now,
      })
      .eq("id", importId)
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

    if (importRow.source_id) {
      await supabaseAdmin
        .from("mosque_timetable_sources")
        .update({
          last_checked_at: now,
          last_success_at: now,
          last_error: null,
          updated_at: now,
        })
        .eq("id", importRow.source_id);
    }

    return NextResponse.json(
      {
        ok: true,
        raw_text_length: cleanedRawText.length,
        import: data,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error("manual raw text route error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Could not save manual raw timetable text.",
      },
      {
        status: 500,
      }
    );
  }
}

