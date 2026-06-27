import { NextResponse } from "next/server";

import { requireMosqueManager } from "@/lib/mosqueManagerAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  import_id?: string;
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

function normaliseTime(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  const match = trimmed.match(/^(\d{1,2})[:.](\d{2})(?::\d{2})?$/);

  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(
    2,
    "0"
  )}:00`;
}

function extractTimesFromText(text: string) {
  return Array.from(text.matchAll(/\b\d{1,2}[:.]\d{2}(?::\d{2})?\b/g))
    .map((match) => normaliseTime(match[0]))
    .filter(Boolean) as string[];
}

function guessYear(importYear: number | null) {
  return importYear ?? new Date().getFullYear();
}

function guessMonth(importMonth: number | null) {
  return importMonth ?? new Date().getMonth() + 1;
}

function buildDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
    2,
    "0"
  )}`;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function extractDayFromLine(line: string) {
  const dateMatch = line.match(
    /\b([0-3]?\d)[\/\-.]([01]?\d)(?:[\/\-.](\d{2,4}))?\b/
  );

  if (dateMatch) {
    const day = Number(dateMatch[1]);

    if (Number.isInteger(day) && day >= 1 && day <= 31) {
      return day;
    }
  }

  const startDayMatch = line.match(
    /^\s*([1-9]|[12]\d|3[01])(?:st|nd|rd|th)?\b/i
  );

  if (startDayMatch) {
    const day = Number(startDayMatch[1]);

    if (Number.isInteger(day) && day >= 1 && day <= 31) {
      return day;
    }
  }

  const anyDayMatch = line.match(/\b([1-9]|[12]\d|3[01])(?:st|nd|rd|th)?\b/i);

  if (anyDayMatch) {
    const day = Number(anyDayMatch[1]);

    if (Number.isInteger(day) && day >= 1 && day <= 31) {
      return day;
    }
  }

  return null;
}

function cleanRawText(rawText: string) {
  return rawText
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[|]/g, " ")
    .replace(/[,;]/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim();
}

function splitIntoLikelyRows(rawText: string) {
  const cleaned = cleanRawText(rawText);

  const newlineRows = cleaned
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (newlineRows.length > 1) {
    return newlineRows;
  }

  return cleaned
    .split(/(?=\b(?:[1-9]|[12]\d|3[01])(?:st|nd|rd|th)?\s+)/i)
    .map((line) => line.trim())
    .filter(Boolean);
}

function mapTimesToPrayerRow(
  times: string[],
  date: string | null
): ParsedPrayerRow {
  if (times.length >= 11) {
    return {
      date,

      fajr_begins: times[0] ?? null,
      fajr_iqamah: times[1] ?? null,

      sunrise: times[2] ?? null,

      dhuhr_begins: times[3] ?? null,
      dhuhr_iqamah: times[4] ?? null,

      asr_begins: times[5] ?? null,
      asr_iqamah: times[6] ?? null,

      maghrib_begins: times[7] ?? null,
      maghrib_iqamah: times[8] ?? null,

      isha_begins: times[9] ?? null,
      isha_iqamah: times[10] ?? null,
    };
  }

  if (times.length >= 6) {
    return {
      date,

      fajr_begins: times[0] ?? null,
      fajr_iqamah: null,

      sunrise: times[1] ?? null,

      dhuhr_begins: times[2] ?? null,
      dhuhr_iqamah: null,

      asr_begins: times[3] ?? null,
      asr_iqamah: null,

      maghrib_begins: times[4] ?? null,
      maghrib_iqamah: null,

      isha_begins: times[5] ?? null,
      isha_iqamah: null,
    };
  }

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

function rowHasUsefulTimes(row: ParsedPrayerRow) {
  return Boolean(
    row.fajr_begins ||
      row.sunrise ||
      row.dhuhr_begins ||
      row.asr_begins ||
      row.maghrib_begins ||
      row.isha_begins
  );
}

function dedupeRows(rows: ParsedPrayerRow[]) {
  const seen = new Set<string>();
  const output: ParsedPrayerRow[] = [];

  for (const row of rows) {
    if (!row.date) {
      continue;
    }

    if (seen.has(row.date)) {
      continue;
    }

    seen.add(row.date);
    output.push(row);
  }

  return output.sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

function parseSmartTimetable(
  rawText: string,
  importMonth: number | null,
  importYear: number | null
): ParsedTimetable {
  const warnings: string[] = [];

  const month = guessMonth(importMonth);
  const year = guessYear(importYear);
  const maxDay = daysInMonth(year, month);

  const candidateLines = splitIntoLikelyRows(rawText);

  const rows: ParsedPrayerRow[] = [];

  let detectedFormat = "unknown";

  for (const line of candidateLines) {
    const times = extractTimesFromText(line);

    if (times.length < 5) {
      continue;
    }

    const day = extractDayFromLine(line);

    if (!day || day < 1 || day > maxDay) {
      continue;
    }

    const date = buildDate(year, month, day);
    const row = mapTimesToPrayerRow(times, date);

    if (!rowHasUsefulTimes(row)) {
      continue;
    }

    rows.push(row);

    if (times.length >= 11) {
      detectedFormat = "full_begins_iqamah_row";
    } else if (times.length >= 6 && detectedFormat === "unknown") {
      detectedFormat = "basic_prayer_times_row";
    }
  }

  const dedupedRows = dedupeRows(rows);

  if (dedupedRows.length === 0) {
    warnings.push("No structured daily rows were detected by the smart parser.");
  }

  if (dedupedRows.length > 0 && dedupedRows.length < 20) {
    warnings.push(
      "Only a small number of rows were detected. Manual review is required."
    );
  }

  if (detectedFormat === "basic_prayer_times_row") {
    warnings.push(
      "Only one time per prayer appears to have been detected. Iqamah times may need manual entry."
    );
  }

  const confidenceScore =
    dedupedRows.length >= 28
      ? detectedFormat === "full_begins_iqamah_row"
        ? 80
        : 65
      : dedupedRows.length >= 20
        ? 60
        : dedupedRows.length > 0
          ? 40
          : 10;

  return {
    parser: "smart_rule_parser",
    confidence_score: confidenceScore,
    month,
    year,
    rows: dedupedRows,
    warnings,
    detected_format: detectedFormat,
  };
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
      .select("*")
      .eq("id", importId)
      .maybeSingle();

    if (lookupError) {
      console.error("timetable parse lookup error:", lookupError);

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

    const rawText = cleanString(importRow.raw_text);

    if (!rawText) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "This import has no raw_text yet. Extract or paste raw text first.",
        },
        {
          status: 400,
        }
      );
    }

    const parsed = parseSmartTimetable(
      rawText,
      typeof importRow.import_month === "number"
        ? importRow.import_month
        : null,
      typeof importRow.import_year === "number" ? importRow.import_year : null
    );

    const status =
      parsed.rows.length > 0 ? "parsed_pending_review" : "parse_failed";

    const { data, error } = await supabaseAdmin
      .from("mosque_timetable_imports")
      .update({
        extracted_json: parsed,
        confidence_score: parsed.confidence_score,
        status,
        error_message:
          parsed.rows.length > 0
            ? null
            : "Smart parser could not detect timetable rows.",
        updated_at: new Date().toISOString(),
      })
      .eq("id", importId)
      .select("*")
      .single();

    if (error) {
      console.error("timetable parse update error:", error);

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
        parsed,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error("timetable parse route error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Could not parse timetable import.",
      },
      {
        status: 500,
      }
    );
  }
}

