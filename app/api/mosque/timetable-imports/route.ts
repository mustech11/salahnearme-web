import { NextResponse } from "next/server";

import { requireMosqueManager } from "@/lib/mosqueManagerAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  mosque_id?: unknown;
  source_id?: unknown;
  source_url?: unknown;
  source_type?: unknown;
  import_month?: unknown;
  import_year?: unknown;
};

type SourceType = "website" | "pdf" | "image" | "csv" | "manual";

type TimetableSourceRow = {
  id: string;
  mosque_id: string | null;
  source_url?: string | null;
  source_type?: string | null;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALLOWED_SOURCE_TYPES = new Set<SourceType>([
  "website",
  "pdf",
  "image",
  "csv",
  "manual",
]);

const MAX_SOURCE_URL_LENGTH = 2_048;
const DEFAULT_LIST_LIMIT = 20;
const MAX_LIST_LIMIT = 100;

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

function normaliseUrl(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const candidate =
    value.startsWith("http://") ||
    value.startsWith("https://")
      ? value
      : `https://${value}`;

  if (candidate.length > MAX_SOURCE_URL_LENGTH) {
    return null;
  }

  try {
    const parsed = new URL(candidate);

    if (
      parsed.protocol !== "http:" &&
      parsed.protocol !== "https:"
    ) {
      return null;
    }

    if (!parsed.hostname) {
      return null;
    }

    parsed.hash = "";

    return parsed.toString();
  } catch {
    return null;
  }
}

function cleanSourceType(
  value: unknown
): SourceType | null {
  const cleaned = cleanString(value)?.toLowerCase();

  if (
    !cleaned ||
    !ALLOWED_SOURCE_TYPES.has(cleaned as SourceType)
  ) {
    return null;
  }

  return cleaned as SourceType;
}

function getCurrentMonth(): number {
  return new Date().getMonth() + 1;
}

function getCurrentYear(): number {
  return new Date().getFullYear();
}

function cleanMonth(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 12
  ) {
    return getCurrentMonth();
  }

  return value;
}

function cleanYear(value: unknown): number {
  const currentYear = getCurrentYear();

  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < currentYear - 5 ||
    value > currentYear + 10
  ) {
    return currentYear;
  }

  return value;
}

function cleanLimit(value: string | null): number {
  if (!value) {
    return DEFAULT_LIST_LIMIT;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return DEFAULT_LIST_LIMIT;
  }

  return Math.min(parsed, MAX_LIST_LIMIT);
}

function cleanOffset(value: string | null): number {
  if (!value) {
    return 0;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);

    const mosqueId = cleanString(
      requestUrl.searchParams.get("mosque_id")
    );

    if (!isUuid(mosqueId)) {
      return jsonResponse(
        {
          ok: false,
          error: "Missing or invalid mosque_id.",
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

    const limit = cleanLimit(
      requestUrl.searchParams.get("limit")
    );
    const offset = cleanOffset(
      requestUrl.searchParams.get("offset")
    );

    const { data, error, count } = await supabaseAdmin
      .from("mosque_timetable_imports")
      .select("*", {
        count: "exact",
      })
      .eq("mosque_id", mosqueId)
      .order("created_at", {
        ascending: false,
      })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error(
        "mosque timetable imports GET error:",
        error
      );

      return jsonResponse(
        {
          ok: false,
          error: "Could not load timetable imports.",
        },
        500
      );
    }

    const imports = data ?? [];
    const total = count ?? imports.length;

    return jsonResponse({
      ok: true,
      count: imports.length,
      total,
      limit,
      offset,
      has_more: offset + imports.length < total,
      imports,
    });
  } catch (error) {
    console.error(
      "mosque timetable imports GET route error:",
      error
    );

    return jsonResponse(
      {
        ok: false,
        error: "Could not load timetable imports.",
      },
      500
    );
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

    const mosqueId = cleanString(body.mosque_id);
    const sourceId = cleanString(body.source_id);
    const sourceType =
      cleanSourceType(body.source_type) ?? "website";
    const sourceUrl = normaliseUrl(
      cleanString(body.source_url)
    );

    if (!isUuid(mosqueId)) {
      return jsonResponse(
        {
          ok: false,
          error: "Missing or invalid mosque_id.",
        },
        400
      );
    }

    if (sourceId && !isUuid(sourceId)) {
      return jsonResponse(
        {
          ok: false,
          error: "Invalid source_id.",
        },
        400
      );
    }

    if (sourceType !== "manual" && !sourceUrl) {
      return jsonResponse(
        {
          ok: false,
          error:
            "A valid source_url is required for this source type.",
        },
        400
      );
    }

    if (
      sourceType === "manual" &&
      body.source_url !== null &&
      body.source_url !== undefined &&
      cleanString(body.source_url) &&
      !sourceUrl
    ) {
      return jsonResponse(
        {
          ok: false,
          error: "Invalid source_url.",
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

    let verifiedSource: TimetableSourceRow | null = null;

    if (sourceId) {
      const {
        data: sourceRowRaw,
        error: sourceLookupError,
      } = await supabaseAdmin
        .from("mosque_timetable_sources")
        .select("id, mosque_id, source_url, source_type")
        .eq("id", sourceId)
        .eq("mosque_id", mosqueId)
        .maybeSingle();

      if (sourceLookupError) {
        console.error(
          "timetable source lookup error:",
          sourceLookupError
        );

        return jsonResponse(
          {
            ok: false,
            error:
              "Could not verify the timetable source.",
          },
          500
        );
      }

      if (!sourceRowRaw) {
        return jsonResponse(
          {
            ok: false,
            error:
              "The selected timetable source was not found for this mosque.",
          },
          404
        );
      }

      verifiedSource =
        sourceRowRaw as TimetableSourceRow;
    }

    const finalSourceUrl =
      sourceUrl ??
      normaliseUrl(
        cleanString(verifiedSource?.source_url)
      );

    const finalSourceType =
      cleanSourceType(verifiedSource?.source_type) ??
      sourceType;

    if (
      finalSourceType !== "manual" &&
      !finalSourceUrl
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            "The timetable source has no valid source URL.",
        },
        400
      );
    }

    const importMonth = cleanMonth(
      body.import_month
    );
    const importYear = cleanYear(body.import_year);
    const now = new Date().toISOString();

    const payload = {
      mosque_id: mosqueId,
      source_id: sourceId,
      source_url: finalSourceUrl,
      source_type: finalSourceType,
      import_month: importMonth,
      import_year: importYear,
      raw_text: null,
      extracted_json: null,
      confidence_score: 0,
      status: "pending_review",
      error_message: null,
      updated_at: now,
    };

    const { data, error } = await supabaseAdmin
      .from("mosque_timetable_imports")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      console.error(
        "mosque timetable imports POST error:",
        error
      );

      return jsonResponse(
        {
          ok: false,
          error: "Could not create timetable import.",
        },
        500
      );
    }

    if (sourceId) {
      const { error: sourceUpdateError } =
        await supabaseAdmin
          .from("mosque_timetable_sources")
          .update({
            last_checked_at: now,
            updated_at: now,
          })
          .eq("id", sourceId)
          .eq("mosque_id", mosqueId);

      if (sourceUpdateError) {
        console.error(
          "timetable source timestamp update error:",
          sourceUpdateError
        );
      }
    }

    return jsonResponse(
      {
        ok: true,
        message:
          "Timetable import created successfully.",
        import: data,
      },
      201
    );
  } catch (error) {
    console.error(
      "mosque timetable imports POST route error:",
      error
    );

    return jsonResponse(
      {
        ok: false,
        error: "Could not create timetable import.",
      },
      500
    );
  }
}