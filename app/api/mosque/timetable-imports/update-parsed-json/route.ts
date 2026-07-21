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
  rows?: unknown;
  warnings?: unknown;
  detected_format?: string;
};

type Body = {
  import_id?: unknown;
  extracted_json?: unknown;
};

type TimetableImportLookup = {
  id: string;
  mosque_id: string | null;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

const MAX_ROWS = 370;
const MAX_WARNINGS = 50;
const MAX_WARNING_LENGTH = 500;

const PRAYER_TIME_FIELDS = [
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

type PrayerTimeField =
  (typeof PRAYER_TIME_FIELDS)[number];

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

function isPlainObject(
  value: unknown
): value is Record<string, unknown> {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value)
  );
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

function cleanTime(value: unknown): string | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const cleaned = cleanString(value);

  if (!cleaned) {
    return null;
  }

  const match = TIME_REGEX.exec(cleaned);

  if (!match) {
    return null;
  }

  return `${match[1]}:${match[2]}:${match[3] ?? "00"}`;
}

function hasPrayerTime(row: ParsedPrayerRow): boolean {
  return PRAYER_TIME_FIELDS.some(
    (field) => row[field] !== null
  );
}

function normaliseRow(
  value: unknown
): ParsedPrayerRow | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const date = cleanDate(value.date);

  if (!date) {
    return null;
  }

  const row: ParsedPrayerRow = {
    date,

    fajr_begins: cleanTime(value.fajr_begins),
    fajr_iqamah: cleanTime(value.fajr_iqamah),

    sunrise: cleanTime(value.sunrise),

    dhuhr_begins: cleanTime(value.dhuhr_begins),
    dhuhr_iqamah: cleanTime(value.dhuhr_iqamah),

    asr_begins: cleanTime(value.asr_begins),
    asr_iqamah: cleanTime(value.asr_iqamah),

    maghrib_begins: cleanTime(
      value.maghrib_begins
    ),
    maghrib_iqamah: cleanTime(
      value.maghrib_iqamah
    ),

    isha_begins: cleanTime(value.isha_begins),
    isha_iqamah: cleanTime(value.isha_iqamah),
  };

  return hasPrayerTime(row) ? row : null;
}

function calculateConfidence(
  rowCount: number,
  invalidRows: number
): number {
  let confidence = 40;

  if (rowCount >= 28) {
    confidence = 85;
  } else if (rowCount >= 20) {
    confidence = 70;
  } else if (rowCount >= 7) {
    confidence = 55;
  }

  if (invalidRows > 0) {
    confidence = Math.max(
      30,
      confidence - Math.min(20, invalidRows * 2)
    );
  }

  return confidence;
}

function cleanWarnings(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map(cleanString)
        .filter(
          (warning): warning is string =>
            Boolean(warning)
        )
        .map((warning) =>
          warning.slice(0, MAX_WARNING_LENGTH)
        )
    )
  ).slice(0, MAX_WARNINGS);
}

function cleanOptionalInteger(
  value: unknown,
  minimum: number,
  maximum: number
): number | null {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    return null;
  }

  return value;
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

    if (!isUuid(importId)) {
      return jsonResponse(
        {
          ok: false,
          error: "Missing or invalid import_id.",
        },
        400
      );
    }

    if (!isPlainObject(body.extracted_json)) {
      return jsonResponse(
        {
          ok: false,
          error:
            "A valid extracted_json object is required.",
        },
        400
      );
    }

    const submittedJson =
      body.extracted_json as ParsedTimetable;

    if (!Array.isArray(submittedJson.rows)) {
      return jsonResponse(
        {
          ok: false,
          error:
            "The extracted timetable must contain a rows array.",
        },
        400
      );
    }

    if (submittedJson.rows.length === 0) {
      return jsonResponse(
        {
          ok: false,
          error:
            "At least one parsed timetable row is required.",
        },
        400
      );
    }

    if (submittedJson.rows.length > MAX_ROWS) {
      return jsonResponse(
        {
          ok: false,
          error: `A timetable cannot contain more than ${MAX_ROWS} rows.`,
        },
        400
      );
    }

    const {
      data: importRowRaw,
      error: lookupError,
    } = await supabaseAdmin
      .from("mosque_timetable_imports")
      .select("id, mosque_id")
      .eq("id", importId)
      .maybeSingle();

    if (lookupError) {
      console.error(
        "update parsed timetable lookup error:",
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

    const normalisedRows: ParsedPrayerRow[] = [];
    let invalidRowCount = 0;

    for (const submittedRow of submittedJson.rows) {
      const normalisedRow =
        normaliseRow(submittedRow);

      if (!normalisedRow) {
        invalidRowCount += 1;
        continue;
      }

      normalisedRows.push(normalisedRow);
    }

    if (normalisedRows.length === 0) {
      return jsonResponse(
        {
          ok: false,
          error:
            "No valid dated timetable rows containing prayer times were supplied.",
        },
        400
      );
    }

    const rowsByDate = new Map<
      string,
      ParsedPrayerRow
    >();

    for (const row of normalisedRows) {
      if (!row.date) {
        continue;
      }

      if (rowsByDate.has(row.date)) {
        return jsonResponse(
          {
            ok: false,
            error: `Duplicate timetable date detected: ${row.date}.`,
          },
          400
        );
      }

      rowsByDate.set(row.date, row);
    }

    const rows = Array.from(rowsByDate.values()).sort(
      (first, second) =>
        (first.date ?? "").localeCompare(
          second.date ?? ""
        )
    );

    const confidenceScore = calculateConfidence(
      rows.length,
      invalidRowCount
    );

    const warnings = cleanWarnings(
      submittedJson.warnings
    );

    if (rows.length < 20) {
      warnings.push(
        "Only a small number of rows are present. Manual review is required."
      );
    }

    if (invalidRowCount > 0) {
      warnings.push(
        `${invalidRowCount} invalid row${
          invalidRowCount === 1 ? " was" : "s were"
        } excluded during validation.`
      );
    }

    const finalWarnings = Array.from(
      new Set(warnings)
    ).slice(0, MAX_WARNINGS);

    const updatedJson: ParsedTimetable = {
      parser:
        cleanString(submittedJson.parser) ??
        "manual_review_editor",
      confidence_score: confidenceScore,
      month: cleanOptionalInteger(
        submittedJson.month,
        1,
        12
      ),
      year: cleanOptionalInteger(
        submittedJson.year,
        2000,
        2100
      ),
      rows,
      warnings: finalWarnings,
      detected_format:
        cleanString(
          submittedJson.detected_format
        ) ?? "manual_review_editor",
    };

    const now = new Date().toISOString();

    const { data: updatedImport, error: updateError } =
      await supabaseAdmin
        .from("mosque_timetable_imports")
        .update({
          extracted_json: updatedJson,
          confidence_score: confidenceScore,
          status: "parsed_pending_review",
          error_message: null,
          updated_at: now,
        })
        .eq("id", importId)
        .eq("mosque_id", mosqueId)
        .select("*")
        .maybeSingle();

    if (updateError) {
      console.error(
        "update parsed timetable update error:",
        updateError
      );

      return jsonResponse(
        {
          ok: false,
          error:
            "Could not save the reviewed timetable rows.",
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

    return jsonResponse({
      ok: true,
      message:
        "Reviewed timetable rows saved successfully.",
      import: updatedImport,
      rows_count: rows.length,
      invalid_rows_count: invalidRowCount,
      confidence_score: confidenceScore,
      warnings: finalWarnings,
    });
  } catch (error) {
    console.error(
      "update parsed json route error:",
      error
    );

    return jsonResponse(
      {
        ok: false,
        error:
          "Could not update parsed timetable rows.",
      },
      500
    );
  }
}