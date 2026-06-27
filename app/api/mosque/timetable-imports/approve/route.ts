import { NextResponse } from "next/server";

import { requireMosqueManager } from "@/lib/mosqueManagerAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  import_id?: unknown;
};

type ParsedPrayerRow = {
  date?: string | null;

  fajr_begins?: string | null;
  fajr_iqamah?: string | null;

  sunrise?: string | null;

  dhuhr_begins?: string | null;
  dhuhr_iqamah?: string | null;

  asr_begins?: string | null;
  asr_iqamah?: string | null;

  maghrib_begins?: string | null;
  maghrib_iqamah?: string | null;

  isha_begins?: string | null;
  isha_iqamah?: string | null;
};

type ParsedTimetable = {
  parser?: string;
  confidence_score?: number;
  month?: number | null;
  year?: number | null;
  rows?: ParsedPrayerRow[];
  warnings?: string[];
};

type MosquePrayerTimeUpsert = {
  mosque_id: string;
  prayer_date: string;

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

  source: string;
  confidence: string;
  notes: string;
  updated_at: string;
};

type TimetableImportRow = {
  id: string;
  mosque_id: string | null;
  source_id: string | null;
  extracted_json: unknown;
  confidence_score: number | null;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function cleanString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function isUuid(value: string | null): value is string {
  if (!value) {
    return false;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function cleanDate(value: unknown): string | null {
  const cleaned = cleanString(value);

  if (!cleaned) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    return null;
  }

  const parsed = new Date(`${cleaned}T00:00:00Z`);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return cleaned;
}

function cleanTime(value: unknown): string | null {
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

function getParsedRows(value: unknown): ParsedPrayerRow[] {
  if (!value || typeof value !== "object") {
    return [];
  }

  const rows = (value as ParsedTimetable).rows;

  if (!Array.isArray(rows)) {
    return [];
  }

  return rows;
}

function getConfidence(importRow: TimetableImportRow) {
  return typeof importRow.confidence_score === "number" &&
    importRow.confidence_score >= 70
    ? "verified"
    : "needs_review";
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as Body | null;

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

    if (!isUuid(importId)) {
      return jsonResponse(
        {
          ok: false,
          error: "Missing or invalid import_id.",
        },
        400
      );
    }

    const { data: importRowRaw, error: lookupError } = await supabaseAdmin
      .from("mosque_timetable_imports")
      .select("id, mosque_id, source_id, extracted_json, confidence_score")
      .eq("id", importId)
      .maybeSingle();

    if (lookupError) {
      console.error("timetable approve lookup error:", lookupError);

      return jsonResponse(
        {
          ok: false,
          error: lookupError.message,
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

    const importRow = importRowRaw as TimetableImportRow;
    const mosqueId = cleanString(importRow.mosque_id);

    if (!isUuid(mosqueId)) {
      return jsonResponse(
        {
          ok: false,
          error: "Import has invalid mosque_id.",
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

    const parsedRows = getParsedRows(importRow.extracted_json);

    if (parsedRows.length === 0) {
      return jsonResponse(
        {
          ok: false,
          error: "No parsed rows found. Parse the timetable first.",
        },
        400
      );
    }

    const now = new Date().toISOString();

    const rowsToUpsert = parsedRows
      .map((row): MosquePrayerTimeUpsert | null => {
        const prayerDate = cleanDate(row.date);

        if (!prayerDate) {
          return null;
        }

        return {
          mosque_id: mosqueId,
          prayer_date: prayerDate,

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

          source: "imported",
          confidence: getConfidence(importRow),
          notes: `Imported from timetable import ${importId}`,
          updated_at: now,
        };
      })
      .filter((row): row is MosquePrayerTimeUpsert => Boolean(row));

    if (rowsToUpsert.length === 0) {
      return jsonResponse(
        {
          ok: false,
          error: "No valid dated rows found to approve.",
        },
        400
      );
    }

    const { error: upsertError } = await supabaseAdmin
      .from("mosque_prayer_times")
      .upsert(rowsToUpsert, {
        onConflict: "mosque_id,prayer_date",
      });

    if (upsertError) {
      console.error("timetable approve upsert error:", upsertError);

      return jsonResponse(
        {
          ok: false,
          error: upsertError.message,
        },
        500
      );
    }

    const { data: updatedImport, error: updateError } = await supabaseAdmin
      .from("mosque_timetable_imports")
      .update({
        status: "approved",
        reviewed_by: permission.userId,
        reviewed_at: now,
        error_message: null,
        updated_at: now,
      })
      .eq("id", importId)
      .select("*")
      .single();

    if (updateError) {
      console.error("timetable approve status update error:", updateError);

      return jsonResponse(
        {
          ok: false,
          error: updateError.message,
        },
        500
      );
    }

    const sourceId = cleanString(importRow.source_id);

    if (isUuid(sourceId)) {
      const { error: sourceUpdateError } = await supabaseAdmin
        .from("mosque_timetable_sources")
        .update({
          last_success_at: now,
          last_error: null,
          updated_at: now,
        })
        .eq("id", sourceId);

      if (sourceUpdateError) {
        console.error("timetable source update error:", sourceUpdateError);
      }
    }

    return jsonResponse({
      ok: true,
      approved_rows: rowsToUpsert.length,
      import: updatedImport,
    });
  } catch (error) {
    console.error("timetable approve route error:", error);

    return jsonResponse(
      {
        ok: false,
        error: "Could not approve timetable import.",
      },
      500
    );
  }
}