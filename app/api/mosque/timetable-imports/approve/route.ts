import { NextResponse } from "next/server";

import { requireMosqueManager } from "@/lib/mosqueManagerAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

const MAX_ROWS = 370;

const APPROVABLE_STATUSES = new Set([
  "parsed",
  "parsed_pending_review",
  "reviewed",
  "approved",
]);

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

    const {
      data: importRowRaw,
      error: lookupError,
    } = await supabaseAdmin
      .from("mosque_timetable_imports")
      .select(
        "id, mosque_id, source_id, extracted_json, confidence_score, status"
      )
      .eq("id", importId)
      .maybeSingle();

    if (lookupError) {
      console.error(
        "timetable approve lookup error:",
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

    const importStatus =
      cleanString(importRow.status);

    if (
      importStatus &&
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
      const row = parsedRows[index];
      const prayerDate = cleanDate(row.date);

      if (!prayerDate) {
        return jsonResponse(
          {
            ok: false,
            error: `Row ${
              index + 1
            } has a missing or invalid date.`,
          },
          400
        );
      }

      if (rowsByDate.has(prayerDate)) {
        return jsonResponse(
          {
            ok: false,
            error: `Duplicate timetable date detected: ${prayerDate}.`,
          },
          400
        );
      }

      const upsertRow: MosquePrayerTimeUpsert = {
        mosque_id: mosqueId,
        prayer_date: prayerDate,

        fajr_begins: cleanTime(row.fajr_begins),
        fajr_iqamah: cleanTime(row.fajr_iqamah),

        sunrise: cleanTime(row.sunrise),

        dhuhr_begins: cleanTime(
          row.dhuhr_begins
        ),
        dhuhr_iqamah: cleanTime(
          row.dhuhr_iqamah
        ),

        asr_begins: cleanTime(row.asr_begins),
        asr_iqamah: cleanTime(row.asr_iqamah),

        maghrib_begins: cleanTime(
          row.maghrib_begins
        ),
        maghrib_iqamah: cleanTime(
          row.maghrib_iqamah
        ),

        isha_begins: cleanTime(row.isha_begins),
        isha_iqamah: cleanTime(row.isha_iqamah),

        source: "imported",
        confidence,
        notes: `Imported from timetable import ${importId}`,
        updated_at: now,
      };

      if (!hasAtLeastOnePrayerTime(upsertRow)) {
        return jsonResponse(
          {
            ok: false,
            error: `Row ${
              index + 1
            } does not contain any valid prayer times.`,
          },
          400
        );
      }

      rowsByDate.set(prayerDate, upsertRow);
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
        });

    if (upsertError) {
      console.error(
        "timetable approve upsert error:",
        upsertError
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
      data: updatedImport,
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
      .select("*")
      .maybeSingle();

    if (updateError) {
      console.error(
        "timetable approve status update error:",
        updateError
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

    if (!updatedImport) {
      return jsonResponse(
        {
          ok: false,
          error:
            "The timetable rows were published, but the import record was not updated.",
          published: true,
          approved_rows: rowsToUpsert.length,
        },
        409
      );
    }

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
          "timetable approve source update error:",
          sourceUpdateError
        );
      }
    }

    return jsonResponse({
      ok: true,
      message: `${rowsToUpsert.length} timetable row${
        rowsToUpsert.length === 1 ? " was" : "s were"
      } approved and published successfully.`,
      approved_rows: rowsToUpsert.length,
      import: updatedImport,
    });
  } catch (error) {
    console.error(
      "timetable approve route error:",
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