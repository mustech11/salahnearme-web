import { NextResponse } from "next/server";

import { requireMosqueManager } from "@/lib/mosqueManagerAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Body = {
  import_id?: unknown;
};

type ParsedPrayerRow = {
  date?: unknown;

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
};

type ParsedTimetable = {
  rows?: unknown;
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
  status: string | null;
};

type UpdatedImportRow = {
  id: string;
  mosque_id: string | null;
  source_id: string | null;
  status: string | null;
  confidence_score: number | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  updated_at: string | null;
};

type TimeResult =
  | {
      ok: true;
      value: string | null;
    }
  | {
      ok: false;
    };

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const TIME_REGEX =
  /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

const MAX_ROWS = 370;

const APPROVABLE_STATUSES = new Set([
  "parsed",
  "parsed_pending_review",
  "reviewed",
  "approved",
]);

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

type TimeField = (typeof TIME_FIELDS)[number];

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

function cleanDate(value: unknown): string | null {
  const cleaned = cleanString(value);

  if (!cleaned || !DATE_REGEX.test(cleaned)) {
    return null;
  }

  const [year, month, day] = cleaned
    .split("-")
    .map(Number);

  const parsedDate = new Date(
    Date.UTC(year, month - 1, day)
  );

  if (
    parsedDate.getUTCFullYear() !== year ||
    parsedDate.getUTCMonth() + 1 !== month ||
    parsedDate.getUTCDate() !== day
  ) {
    return null;
  }

  return cleaned;
}

function parseTime(value: unknown): TimeResult {
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

  const cleaned = cleanString(value);

  if (!cleaned) {
    return {
      ok: true,
      value: null,
    };
  }

  const match = TIME_REGEX.exec(cleaned);

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

function getParsedRows(
  value: unknown
): ParsedPrayerRow[] {
  if (!isPlainObject(value)) {
    return [];
  }

  const rows = (value as ParsedTimetable).rows;

  if (!Array.isArray(rows)) {
    return [];
  }

  return rows.filter(
    (row): row is ParsedPrayerRow =>
      isPlainObject(row)
  );
}

function getConfidence(
  confidenceScore: number | null
): "verified" | "needs_review" {
  return typeof confidenceScore === "number" &&
    Number.isFinite(confidenceScore) &&
    confidenceScore >= 70
    ? "verified"
    : "needs_review";
}

function hasAtLeastOnePrayerTime(
  row: MosquePrayerTimeUpsert
): boolean {
  return TIME_FIELDS.some(
    (field) => Boolean(row[field])
  );
}

function formatFieldName(field: TimeField): string {
  return field
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}

function buildPrayerTimeRow({
  parsedRow,
  rowNumber,
  mosqueId,
  importId,
  confidence,
  updatedAt,
}: {
  parsedRow: ParsedPrayerRow;
  rowNumber: number;
  mosqueId: string;
  importId: string;
  confidence: "verified" | "needs_review";
  updatedAt: string;
}):
  | {
      ok: true;
      row: MosquePrayerTimeUpsert;
    }
  | {
      ok: false;
      error: string;
    } {
  const prayerDate = cleanDate(parsedRow.date);

  if (!prayerDate) {
    return {
      ok: false,
      error: `Row ${rowNumber} has a missing or invalid date.`,
    };
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
    const result = parseTime(parsedRow[field]);

    if (!result.ok) {
      return {
        ok: false,
        error: `Row ${rowNumber} contains an invalid ${formatFieldName(
          field
        )} time. Use 24-hour HH:MM format.`,
      };
    }

    parsedTimes[field] = result.value;
  }

  const row: MosquePrayerTimeUpsert = {
    mosque_id: mosqueId,
    prayer_date: prayerDate,

    fajr_begins: parsedTimes.fajr_begins,
    fajr_iqamah: parsedTimes.fajr_iqamah,

    sunrise: parsedTimes.sunrise,

    dhuhr_begins: parsedTimes.dhuhr_begins,
    dhuhr_iqamah: parsedTimes.dhuhr_iqamah,

    asr_begins: parsedTimes.asr_begins,
    asr_iqamah: parsedTimes.asr_iqamah,

    maghrib_begins: parsedTimes.maghrib_begins,
    maghrib_iqamah: parsedTimes.maghrib_iqamah,

    isha_begins: parsedTimes.isha_begins,
    isha_iqamah: parsedTimes.isha_iqamah,

    source: "imported",
    confidence,
    notes: `Imported from timetable import ${importId}`,
    updated_at: updatedAt,
  };

  if (!hasAtLeastOnePrayerTime(row)) {
    return {
      ok: false,
      error: `Row ${rowNumber} does not contain any valid prayer times.`,
    };
  }

  return {
    ok: true,
    row,
  };
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

    if (!isUuid(importId)) {
      return jsonResponse(
        {
          ok: false,
          error: "Missing or invalid import_id.",
        },
        400
      );
    }

    const { data: importRowRaw, error: lookupError } =
      await supabaseAdmin
        .from("mosque_timetable_imports")
        .select(
          "id,mosque_id,source_id,extracted_json,confidence_score,status"
        )
        .eq("id", importId)
        .maybeSingle();

    if (lookupError) {
      console.error(
        "Timetable approval lookup failed:",
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
      importRowRaw as TimetableImportRow;

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

    const importStatus =
      cleanString(importRow.status)?.toLowerCase() ??
      null;

    if (
      !importStatus ||
      !APPROVABLE_STATUSES.has(importStatus)
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            "This timetable must be parsed and reviewed before it can be approved.",
        },
        409
      );
    }

    const parsedRows = getParsedRows(
      importRow.extracted_json
    );

    if (parsedRows.length === 0) {
      return jsonResponse(
        {
          ok: false,
          error:
            "No parsed rows were found. Parse and review the timetable first.",
        },
        400
      );
    }

    if (parsedRows.length > MAX_ROWS) {
      return jsonResponse(
        {
          ok: false,
          error: `A timetable cannot contain more than ${MAX_ROWS} rows.`,
        },
        400
      );
    }

    const now = new Date().toISOString();

    const confidence = getConfidence(
      importRow.confidence_score
    );

    const rowsByDate = new Map<
      string,
      MosquePrayerTimeUpsert
    >();

    for (
      let index = 0;
      index < parsedRows.length;
      index += 1
    ) {
      const result = buildPrayerTimeRow({
        parsedRow: parsedRows[index],
        rowNumber: index + 1,
        mosqueId,
        importId,
        confidence,
        updatedAt: now,
      });

      if (!result.ok) {
        return jsonResponse(
          {
            ok: false,
            error: result.error,
          },
          400
        );
      }

      if (
        rowsByDate.has(result.row.prayer_date)
      ) {
        return jsonResponse(
          {
            ok: false,
            error: `Duplicate timetable date detected: ${result.row.prayer_date}.`,
          },
          400
        );
      }

      rowsByDate.set(
        result.row.prayer_date,
        result.row
      );
    }

    const rowsToUpsert = Array.from(
      rowsByDate.values()
    ).sort((first, second) =>
      first.prayer_date.localeCompare(
        second.prayer_date
      )
    );

    const { error: upsertError } =
      await supabaseAdmin
        .from("mosque_prayer_times")
        .upsert(rowsToUpsert, {
          onConflict: "mosque_id,prayer_date",
          ignoreDuplicates: false,
        });

    if (upsertError) {
      console.error(
        "Timetable approval prayer-time upsert failed:",
        {
          importId,
          mosqueId,
          rowCount: rowsToUpsert.length,
          code: upsertError.code,
          message: upsertError.message,
        }
      );

      return jsonResponse(
        {
          ok: false,
          error:
            "Could not publish the timetable prayer times.",
        },
        500
      );
    }

    const {
      data: updatedImportRaw,
      error: updateError,
    } = await supabaseAdmin
      .from("mosque_timetable_imports")
      .update({
        status: "approved",
        reviewed_by: permission.userId,
        reviewed_at: now,
        error_message: null,
        updated_at: now,
      })
      .eq("id", importId)
      .eq("mosque_id", mosqueId)
      .eq("status", importStatus)
      .select(
        "id,mosque_id,source_id,status,confidence_score,reviewed_by,reviewed_at,updated_at"
      )
      .maybeSingle();

    if (updateError) {
      console.error(
        "Timetable approval status update failed:",
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
            "The timetable rows were published, but the import status could not be updated.",
          published: true,
          approved_rows: rowsToUpsert.length,
        },
        500
      );
    }

    if (!updatedImportRaw) {
      return jsonResponse(
        {
          ok: false,
          error:
            "The timetable rows were published, but the import changed during approval. Refresh the page before trying again.",
          published: true,
          approved_rows: rowsToUpsert.length,
        },
        409
      );
    }

    const updatedImport =
      updatedImportRaw as UpdatedImportRow;

    const sourceId = cleanString(
      importRow.source_id
    );

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
          "Timetable approval source update failed:",
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
      message: `${rowsToUpsert.length.toLocaleString()} timetable row${
        rowsToUpsert.length === 1 ? " was" : "s were"
      } approved and published successfully.`,
      approved_rows: rowsToUpsert.length,
      import: updatedImport,
    });
  } catch (error) {
    console.error(
      "Timetable approval route failed:",
      error
    );

    return jsonResponse(
      {
        ok: false,
        error:
          "Could not approve the timetable import.",
      },
      500
    );
  }
}