import { NextResponse } from "next/server";

import { requireMosqueManager } from "@/lib/mosqueManagerAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ParsedPrayerRow = {
  date: string | null;

  fajr_begins: string | null;
  fajr_iqamah: string | null;

  sunrise: string | null;

  dhuhr_begins: string | null;
  dhuhr_iqamah: string | null;

  asr_begins: string | null;
  asr_iqamah: string | null;

  maghrib_begins: string | null;
  maghrib_iqamah: string | null;

  isha_begins: string | null;
  isha_iqamah: string | null;
};

type ParsedTimetable = {
  parser?: string;
  confidence_score?: number;
  month?: number | null;
  year?: number | null;
  rows?: ParsedPrayerRow[];
  warnings?: string[];
  detected_format?: string;
};

type Body = {
  import_id?: string;
  extracted_json?: ParsedTimetable;
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

function normaliseRow(row: ParsedPrayerRow): ParsedPrayerRow | null {
  const date = cleanDate(row.date);

  if (!date) {
    return null;
  }

  return {
    date,

    fajr_begins: cleanTime(row.fajr_begins),
    fajr_iqamah: cleanTime(row.fajr_iqamah),

    sunrise: cleanTime(row.sunrise),

    dhuhr_begins: cleanTime(row.dhuhr_begins),
    dhuhr_iqamah: cleanTime(row.dhuhr_iqamah),

    asr_begins: cleanTime(row.asr_begins),
    asr_iqamah: cleanTime(row.asr_iqamah),

    maghrib_begins: cleanTime(row.maghrib_begins),
    maghrib_iqamah: cleanTime(row.maghrib_iqamah),

    isha_begins: cleanTime(row.isha_begins),
    isha_iqamah: cleanTime(row.isha_iqamah),
  };
}

function getRows(value: ParsedTimetable | undefined) {
  if (!value || !Array.isArray(value.rows)) {
    return [];
  }

  return value.rows;
}

function calculateConfidence(rowCount: number) {
  if (rowCount >= 28) {
    return 85;
  }

  if (rowCount >= 20) {
    return 70;
  }

  if (rowCount >= 7) {
    return 55;
  }

  if (rowCount > 0) {
    return 40;
  }

  return 10;
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

    const { data: importRow, error: lookupError } = await supabaseAdmin
      .from("mosque_timetable_imports")
      .select("id, mosque_id")
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

    const rows = getRows(body.extracted_json)
      .map(normaliseRow)
      .filter(Boolean) as ParsedPrayerRow[];

    if (rows.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "No valid parsed rows were supplied.",
        },
        {
          status: 400,
        }
      );
    }

    const confidenceScore = calculateConfidence(rows.length);

    const warnings: string[] = [];

    if (rows.length < 20) {
      warnings.push(
        "Only a small number of rows are present. Manual review is required."
      );
    }

    const updatedJson: ParsedTimetable = {
      ...(body.extracted_json ?? {}),
      parser: body.extracted_json?.parser ?? "manual_review_editor",
      confidence_score: confidenceScore,
      rows,
      warnings,
      detected_format:
        body.extracted_json?.detected_format ?? "manual_review_editor",
    };

    const { data, error } = await supabaseAdmin
      .from("mosque_timetable_imports")
      .update({
        extracted_json: updatedJson,
        confidence_score: confidenceScore,
        status: "parsed_pending_review",
        error_message: null,
        updated_at: new Date().toISOString(),
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

    return NextResponse.json(
      {
        ok: true,
        import: data,
        rows_count: rows.length,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error("update parsed json route error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Could not update parsed timetable rows.",
      },
      {
        status: 500,
      }
    );
  }
}

