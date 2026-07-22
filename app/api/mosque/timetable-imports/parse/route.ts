import { NextResponse } from "next/server";

import { requireMosqueManager } from "@/lib/mosqueManagerAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  import_id?: unknown;
};

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
  parser: "smart_rule_parser";
  confidence_score: number;
  month: number | null;
  year: number | null;
  rows: ParsedPrayerRow[];
  warnings: string[];
  detected_format: string;
};

type TimetableImportRow = {
  id: string;
  mosque_id: string | null;
  raw_text: string | null;
  import_month: number | null;
  import_year: number | null;
};

type DetectedColumnLayout =
  | "full_begins_iqamah_row"
  | "basic_prayer_times_row"
  | "partial_prayer_times_row"
  | "unknown";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_RAW_TEXT_LENGTH = 100_000;
const MAX_ROWS = 370;
const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

const MONTH_NAMES: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

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
  const contentType = request.headers.get("content-type");

  return Boolean(
    contentType?.toLowerCase().includes("application/json")
  );
}

function normaliseTime(
  value: string | null | undefined
): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");

  const match = trimmed.match(
    /^(\d{1,2})[:.](\d{2})(?::(\d{2}))?(am|pm)?$/
  );

  if (!match) {
    return null;
  }

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = match[3]
    ? Number(match[3])
    : 0;
  const meridiem = match[4];

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    !Number.isInteger(second) ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59
  ) {
    return null;
  }

  if (meridiem) {
    if (hour < 1 || hour > 12) {
      return null;
    }

    if (meridiem === "am") {
      hour = hour === 12 ? 0 : hour;
    } else {
      hour = hour === 12 ? 12 : hour + 12;
    }
  } else if (hour < 0 || hour > 23) {
    return null;
  }

  return `${String(hour).padStart(
    2,
    "0"
  )}:${String(minute).padStart(
    2,
    "0"
  )}:${String(second).padStart(2, "0")}`;
}

function extractTimesFromText(text: string): string[] {
  const matches = Array.from(
    text.matchAll(
      /\b\d{1,2}[:.]\d{2}(?::\d{2})?\s*(?:am|pm)?\b/gi
    )
  );

  return matches
    .map((match) => normaliseTime(match[0]))
    .filter((time): time is string =>
      Boolean(time)
    );
}

function cleanMonth(
  value: unknown,
  fallback: number
): number {
  if (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 12
  ) {
    return value;
  }

  return fallback;
}

function cleanYear(
  value: unknown,
  fallback: number
): number {
  if (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MIN_YEAR &&
    value <= MAX_YEAR
  ) {
    return value;
  }

  return fallback;
}

function detectMonthFromText(
  rawText: string
): number | null {
  const lowerText = rawText.toLowerCase();

  for (const [name, month] of Object.entries(
    MONTH_NAMES
  )) {
    if (
      new RegExp(`\\b${name}\\b`, "i").test(
        lowerText
      )
    ) {
      return month;
    }
  }

  return null;
}

function detectYearFromText(
  rawText: string
): number | null {
  const matches = Array.from(
    rawText.matchAll(/\b(20\d{2}|2100)\b/g)
  );

  for (const match of matches) {
    const year = Number(match[1]);

    if (year >= MIN_YEAR && year <= MAX_YEAR) {
      return year;
    }
  }

  return null;
}

function buildDate(
  year: number,
  month: number,
  day: number
): string | null {
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

  return `${year}-${String(month).padStart(
    2,
    "0"
  )}-${String(day).padStart(2, "0")}`;
}

function daysInMonth(
  year: number,
  month: number
): number {
  return new Date(
    Date.UTC(year, month, 0)
  ).getUTCDate();
}

function extractDayFromLine(
  line: string,
  month: number,
  year: number
): number | null {
  const fullDateMatch = line.match(
    /\b([0-3]?\d)[\/\-.]([01]?\d)[\/\-.](\d{2,4})\b/
  );

  if (fullDateMatch) {
    const day = Number(fullDateMatch[1]);
    const detectedMonth = Number(fullDateMatch[2]);
    let detectedYear = Number(fullDateMatch[3]);

    if (detectedYear < 100) {
      detectedYear += 2000;
    }

    if (
      detectedMonth === month &&
      detectedYear === year &&
      buildDate(year, month, day)
    ) {
      return day;
    }
  }

  const dayMonthMatch = line.match(
    /\b([0-3]?\d)[\/\-.]([01]?\d)\b/
  );

  if (dayMonthMatch) {
    const day = Number(dayMonthMatch[1]);
    const detectedMonth = Number(
      dayMonthMatch[2]
    );

    if (
      detectedMonth === month &&
      buildDate(year, month, day)
    ) {
      return day;
    }
  }

  const startDayMatch = line.match(
    /^\s*([1-9]|[12]\d|3[01])(?:st|nd|rd|th)?(?:\s|$)/i
  );

  if (startDayMatch) {
    const day = Number(startDayMatch[1]);

    if (buildDate(year, month, day)) {
      return day;
    }
  }

  return null;
}

function cleanRawText(rawText: string): string {
  return rawText
    .slice(0, MAX_RAW_TEXT_LENGTH)
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[|]/g, " ")
    .replace(/[,;]/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitIntoLikelyRows(
  rawText: string
): string[] {
  const cleaned = cleanRawText(rawText);

  const newlineRows = cleaned
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const rowsWithTimes = newlineRows.filter(
    (line) => extractTimesFromText(line).length > 0
  );

  if (rowsWithTimes.length > 1) {
    return newlineRows;
  }

  return cleaned
    .split(
      /(?=\b(?:[1-9]|[12]\d|3[01])(?:st|nd|rd|th)?\s+)/i
    )
    .map((line) => line.trim())
    .filter(Boolean);
}

function emptyPrayerRow(
  date: string | null
): ParsedPrayerRow {
  return {
    date,

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
}

function mapTimesToPrayerRow(
  times: string[],
  date: string | null
): {
  row: ParsedPrayerRow;
  format: DetectedColumnLayout;
} {
  const row = emptyPrayerRow(date);

  if (times.length >= 11) {
    row.fajr_begins = times[0] ?? null;
    row.fajr_iqamah = times[1] ?? null;
    row.sunrise = times[2] ?? null;
    row.dhuhr_begins = times[3] ?? null;
    row.dhuhr_iqamah = times[4] ?? null;
    row.asr_begins = times[5] ?? null;
    row.asr_iqamah = times[6] ?? null;
    row.maghrib_begins = times[7] ?? null;
    row.maghrib_iqamah = times[8] ?? null;
    row.isha_begins = times[9] ?? null;
    row.isha_iqamah = times[10] ?? null;

    return {
      row,
      format: "full_begins_iqamah_row",
    };
  }

  if (times.length >= 6) {
    row.fajr_begins = times[0] ?? null;
    row.sunrise = times[1] ?? null;
    row.dhuhr_begins = times[2] ?? null;
    row.asr_begins = times[3] ?? null;
    row.maghrib_begins = times[4] ?? null;
    row.isha_begins = times[5] ?? null;

    return {
      row,
      format: "basic_prayer_times_row",
    };
  }

  if (times.length >= 5) {
    row.fajr_begins = times[0] ?? null;
    row.dhuhr_begins = times[1] ?? null;
    row.asr_begins = times[2] ?? null;
    row.maghrib_begins = times[3] ?? null;
    row.isha_begins = times[4] ?? null;

    return {
      row,
      format: "partial_prayer_times_row",
    };
  }

  return {
    row,
    format: "unknown",
  };
}

function rowHasUsefulTimes(
  row: ParsedPrayerRow
): boolean {
  return Boolean(
    row.fajr_begins ||
      row.fajr_iqamah ||
      row.sunrise ||
      row.dhuhr_begins ||
      row.dhuhr_iqamah ||
      row.asr_begins ||
      row.asr_iqamah ||
      row.maghrib_begins ||
      row.maghrib_iqamah ||
      row.isha_begins ||
      row.isha_iqamah
  );
}

function countRowTimes(
  row: ParsedPrayerRow
): number {
  return [
    row.fajr_begins,
    row.fajr_iqamah,
    row.sunrise,
    row.dhuhr_begins,
    row.dhuhr_iqamah,
    row.asr_begins,
    row.asr_iqamah,
    row.maghrib_begins,
    row.maghrib_iqamah,
    row.isha_begins,
    row.isha_iqamah,
  ].filter(Boolean).length;
}

function calculateConfidence(
  rows: ParsedPrayerRow[],
  format: DetectedColumnLayout,
  expectedDays: number
): number {
  if (rows.length === 0) {
    return 10;
  }

  const coverageRatio = Math.min(
    rows.length / expectedDays,
    1
  );

  const averageTimes =
    rows.reduce(
      (total, row) => total + countRowTimes(row),
      0
    ) / rows.length;

  let confidence = 20;

  confidence += Math.round(coverageRatio * 40);
  confidence += Math.min(
    25,
    Math.round((averageTimes / 11) * 25)
  );

  if (format === "full_begins_iqamah_row") {
    confidence += 10;
  } else if (
    format === "basic_prayer_times_row"
  ) {
    confidence += 5;
  }

  return Math.min(90, Math.max(10, confidence));
}

function parseSmartTimetable(
  rawText: string,
  importMonth: number | null,
  importYear: number | null
): ParsedTimetable {
  const warnings: string[] = [];
  const currentDate = new Date();

  const detectedMonth =
    detectMonthFromText(rawText);
  const detectedYear = detectYearFromText(rawText);

  const month = cleanMonth(
    importMonth,
    detectedMonth ??
      currentDate.getMonth() + 1
  );

  const year = cleanYear(
    importYear,
    detectedYear ??
      currentDate.getFullYear()
  );

  const maxDay = daysInMonth(year, month);
  const candidateLines =
    splitIntoLikelyRows(rawText);

  const rowsByDate = new Map<
    string,
    ParsedPrayerRow
  >();

  const detectedFormats = new Map<
    DetectedColumnLayout,
    number
  >();

  let skippedRows = 0;
  let duplicateRows = 0;

  for (const line of candidateLines) {
    const times = extractTimesFromText(line);

    if (times.length < 5) {
      continue;
    }

    const day = extractDayFromLine(
      line,
      month,
      year
    );

    if (!day || day < 1 || day > maxDay) {
      skippedRows += 1;
      continue;
    }

    const date = buildDate(year, month, day);

    if (!date) {
      skippedRows += 1;
      continue;
    }

    const mapped = mapTimesToPrayerRow(
      times,
      date
    );

    if (!rowHasUsefulTimes(mapped.row)) {
      skippedRows += 1;
      continue;
    }

    if (rowsByDate.has(date)) {
      duplicateRows += 1;

      const existingRow = rowsByDate.get(date);

      if (
        existingRow &&
        countRowTimes(mapped.row) >
          countRowTimes(existingRow)
      ) {
        rowsByDate.set(date, mapped.row);
      }

      continue;
    }

    rowsByDate.set(date, mapped.row);

    detectedFormats.set(
      mapped.format,
      (detectedFormats.get(mapped.format) ?? 0) + 1
    );
  }

  const rows = Array.from(
    rowsByDate.values()
  )
    .sort((first, second) =>
      String(first.date).localeCompare(
        String(second.date)
      )
    )
    .slice(0, MAX_ROWS);

  const detectedFormat =
    Array.from(detectedFormats.entries()).sort(
      (first, second) => second[1] - first[1]
    )[0]?.[0] ?? "unknown";

  if (rows.length === 0) {
    warnings.push(
      "No structured daily rows were detected by the smart parser."
    );
  }

  if (rows.length > 0 && rows.length < 20) {
    warnings.push(
      "Only a small number of timetable rows were detected. Manual review is required."
    );
  }

  if (
    detectedFormat === "basic_prayer_times_row"
  ) {
    warnings.push(
      "Only one time per prayer appears to have been detected. Iqamah times may require manual entry."
    );
  }

  if (
    detectedFormat === "partial_prayer_times_row"
  ) {
    warnings.push(
      "Only five prayer times appear to have been detected. Sunrise and iqamah times may require manual entry."
    );
  }

  if (skippedRows > 0) {
    warnings.push(
      `${skippedRows} possible timetable row${
        skippedRows === 1 ? " was" : "s were"
      } skipped because the date or time format could not be validated.`
    );
  }

  if (duplicateRows > 0) {
    warnings.push(
      `${duplicateRows} duplicate date row${
        duplicateRows === 1 ? " was" : "s were"
      } detected. The row containing the most prayer times was retained.`
    );
  }

  if (
    detectedMonth &&
    importMonth &&
    detectedMonth !== importMonth
  ) {
    warnings.push(
      `The timetable text appears to mention month ${detectedMonth}, but import month ${importMonth} was used.`
    );
  }

  if (
    detectedYear &&
    importYear &&
    detectedYear !== importYear
  ) {
    warnings.push(
      `The timetable text appears to mention year ${detectedYear}, but import year ${importYear} was used.`
    );
  }

  return {
    parser: "smart_rule_parser",
    confidence_score: calculateConfidence(
      rows,
      detectedFormat,
      maxDay
    ),
    month,
    year,
    rows,
    warnings: Array.from(
      new Set(warnings)
    ).slice(0, 50),
    detected_format: detectedFormat,
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

    const body = (await request
      .json()
      .catch(() => null)) as unknown;

    if (!isPlainObject(body)) {
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

    const {
      data: importRowRaw,
      error: lookupError,
    } = await supabaseAdmin
      .from("mosque_timetable_imports")
      .select(
        "id, mosque_id, raw_text, import_month, import_year"
      )
      .eq("id", importId)
      .maybeSingle();

    if (lookupError) {
      console.error(
        "timetable parse lookup error:",
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
      importRowRaw as TimetableImportRow;

    const mosqueId = cleanString(
      importRow.mosque_id
    );

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

    const rawText = cleanString(
      importRow.raw_text
    );

    if (!rawText) {
      return jsonResponse(
        {
          ok: false,
          error:
            "This import has no raw text. Extract or paste timetable text first.",
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

    const parsed = parseSmartTimetable(
      rawText,
      importRow.import_month,
      importRow.import_year
    );

    const hasRows = parsed.rows.length > 0;
    const status = hasRows
      ? "parsed_pending_review"
      : "parse_failed";

    const errorMessage = hasRows
      ? null
      : "Smart parser could not detect valid timetable rows.";

    const now = new Date().toISOString();

    const {
      data: updatedImport,
      error: updateError,
    } = await supabaseAdmin
      .from("mosque_timetable_imports")
      .update({
        extracted_json: parsed,
        confidence_score:
          parsed.confidence_score,
        status,
        error_message: errorMessage,
        updated_at: now,
      })
      .eq("id", importId)
      .eq("mosque_id", mosqueId)
      .select("*")
      .maybeSingle();

    if (updateError) {
      console.error(
        "timetable parse update error:",
        updateError
      );

      return jsonResponse(
        {
          ok: false,
          error:
            "Could not save the parsed timetable.",
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
      message: hasRows
        ? `${parsed.rows.length} timetable row${
            parsed.rows.length === 1
              ? " was"
              : "s were"
          } detected. Review the rows before approval.`
        : "No valid timetable rows were detected.",
      rows_count: parsed.rows.length,
      confidence_score:
        parsed.confidence_score,
      requires_review: true,
      import: updatedImport,
      parsed,
    });
  } catch (error) {
    console.error(
      "timetable parse route error:",
      error
    );

    return jsonResponse(
      {
        ok: false,
        error: "Could not parse timetable import.",
      },
      500
    );
  }
}