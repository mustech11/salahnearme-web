import { NextResponse } from "next/server";

import { requireMosqueManager } from "@/lib/mosqueManagerAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SOURCE_TYPES = [
  "website",
  "pdf",
  "image",
  "csv",
  "manual",
] as const;

type SourceType =
  (typeof SOURCE_TYPES)[number];

type Body = {
  id?: unknown;
  mosque_id?: unknown;
  source_url?: unknown;
  source_type?: unknown;
  auto_import_enabled?: unknown;
};

type TimetableSourceRow = {
  id: string;
  mosque_id: string;
  source_url: string;
  source_type: string;
  auto_import_enabled: boolean;
  last_checked_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type SaveSourceResponseRow =
  TimetableSourceRow;

const MAX_URL_LENGTH = 2_048;
const MAX_MANUAL_LABEL_LENGTH = 250;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

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

function cleanString(
  value: unknown,
  maxLength = 2_048
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value
    .trim()
    .replace(/\u0000/g, "")
    .slice(0, maxLength);

  return cleaned || null;
}

function isUuid(
  value: string | null
): value is string {
  return Boolean(
    value &&
      UUID_REGEX.test(value)
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

function isJsonRequest(
  request: Request
): boolean {
  const contentType =
    request.headers
      .get("content-type")
      ?.toLowerCase() ?? "";

  return contentType.includes(
    "application/json"
  );
}

function cleanSourceType(
  value: unknown
): SourceType | null {
  const cleaned =
    cleanString(value, 80)
      ?.toLowerCase();

  if (
    !cleaned ||
    !SOURCE_TYPES.includes(
      cleaned as SourceType
    )
  ) {
    return null;
  }

  return cleaned as SourceType;
}

function cleanAutoImport(
  value: unknown
): boolean {
  return value === true;
}

function normaliseSourceValue(
  value: unknown,
  sourceType: SourceType
): string | null {
  const maxLength =
    sourceType === "manual"
      ? MAX_MANUAL_LABEL_LENGTH
      : MAX_URL_LENGTH;

  const raw =
    cleanString(value, maxLength);

  if (!raw) {
    return null;
  }

  if (sourceType === "manual") {
    return raw.replace(/\s+/g, " ");
  }

  const candidate =
    /^https?:\/\//i.test(raw)
      ? raw
      : `https://${raw}`;

  try {
    const url = new URL(candidate);

    if (
      url.protocol !== "http:" &&
      url.protocol !== "https:"
    ) {
      return null;
    }

    if (!url.hostname) {
      return null;
    }

    url.hash = "";

    const normalised =
      url.toString();

    return normalised.length <=
      MAX_URL_LENGTH
      ? normalised
      : null;
  } catch {
    return null;
  }
}

function cleanLimit(
  value: string | null
): number {
  if (!value) {
    return DEFAULT_LIMIT;
  }

  const parsed = Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed < 1
  ) {
    return DEFAULT_LIMIT;
  }

  return Math.min(
    parsed,
    MAX_LIMIT
  );
}

function getDatabaseErrorStatus(
  code: string | null | undefined
): number {
  if (code === "23505") {
    return 409;
  }

  if (
    code === "23503" ||
    code === "22P02"
  ) {
    return 400;
  }

  return 500;
}

function getDatabaseErrorMessage(
  code: string | null | undefined,
  fallback: string
): string {
  if (code === "23505") {
    return "An identical timetable source already exists for this mosque.";
  }

  if (code === "23503") {
    return "The mosque or timetable source reference is invalid.";
  }

  return fallback;
}

async function readBody(
  request: Request
): Promise<Body | null> {
  try {
    const value: unknown =
      await request.json();

    return isPlainObject(value)
      ? (value as Body)
      : null;
  } catch {
    return null;
  }
}

export async function GET(
  request: Request
) {
  try {
    const requestUrl =
      new URL(request.url);

    const mosqueId =
      cleanString(
        requestUrl.searchParams.get(
          "mosque_id"
        ),
        80
      );

    if (!isUuid(mosqueId)) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Missing or invalid mosque_id.",
        },
        400
      );
    }

    const permission =
      await requireMosqueManager(
        mosqueId
      );

    if (!permission.ok) {
      return jsonResponse(
        {
          ok: false,
          error:
            permission.error,
        },
        permission.status
      );
    }

    const limit = cleanLimit(
      requestUrl.searchParams.get(
        "limit"
      )
    );

    const {
      data,
      error,
      count,
    } = await supabaseAdmin
      .from(
        "mosque_timetable_sources"
      )
      .select("*", {
        count: "exact",
      })
      .eq(
        "mosque_id",
        mosqueId
      )
      .order(
        "auto_import_enabled",
        {
          ascending: false,
        }
      )
      .order("created_at", {
        ascending: false,
      })
      .limit(limit);

    if (error) {
      console.error(
        "Timetable source list query failed:",
        {
          mosqueId,
          code: error.code,
          message: error.message,
        }
      );

      return jsonResponse(
        {
          ok: false,
          error:
            "Could not load timetable sources.",
        },
        500
      );
    }

    const sources =
      (data ??
        []) as SaveSourceResponseRow[];

    return jsonResponse({
      ok: true,
      count: sources.length,
      total:
        count ?? sources.length,
      limit,
      sources,
    });
  } catch (error) {
    console.error(
      "Timetable source GET route failed:",
      error
    );

    return jsonResponse(
      {
        ok: false,
        error:
          "Could not load timetable sources.",
      },
      500
    );
  }
}

export async function POST(
  request: Request
) {
  try {
    if (!isJsonRequest(request)) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Content-Type must be application/json.",
        },
        415
      );
    }

    const body =
      await readBody(request);

    if (!body) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Invalid JSON body.",
        },
        400
      );
    }

    const id =
      cleanString(body.id, 80);

    const mosqueId =
      cleanString(
        body.mosque_id,
        80
      );

    const sourceType =
      cleanSourceType(
        body.source_type
      );

    if (!isUuid(mosqueId)) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Missing or invalid mosque_id.",
        },
        400
      );
    }

    if (
      id &&
      !isUuid(id)
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Invalid source id.",
        },
        400
      );
    }

    if (!sourceType) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Select a valid timetable source type.",
        },
        400
      );
    }

    const sourceValue =
      normaliseSourceValue(
        body.source_url,
        sourceType
      );

    if (!sourceValue) {
      return jsonResponse(
        {
          ok: false,
          error:
            sourceType ===
            "manual"
              ? "A manual source label is required."
              : "A valid HTTP or HTTPS source URL is required.",
        },
        400
      );
    }

    const permission =
      await requireMosqueManager(
        mosqueId
      );

    if (!permission.ok) {
      return jsonResponse(
        {
          ok: false,
          error:
            permission.error,
        },
        permission.status
      );
    }

    const autoImportEnabled =
      sourceType === "manual"
        ? false
        : cleanAutoImport(
            body.auto_import_enabled
          );

    const now =
      new Date().toISOString();

    const payload = {
      mosque_id: mosqueId,
      source_url: sourceValue,
      source_type: sourceType,
      auto_import_enabled:
        autoImportEnabled,
      updated_at: now,
    };

    if (id) {
      const {
        data,
        error,
      } = await supabaseAdmin
        .from(
          "mosque_timetable_sources"
        )
        .update(payload)
        .eq("id", id)
        .eq(
          "mosque_id",
          mosqueId
        )
        .select("*")
        .maybeSingle();

      if (error) {
        console.error(
          "Timetable source update failed:",
          {
            id,
            mosqueId,
            code: error.code,
            message:
              error.message,
          }
        );

        return jsonResponse(
          {
            ok: false,
            error:
              getDatabaseErrorMessage(
                error.code,
                "Could not update the timetable source."
              ),
          },
          getDatabaseErrorStatus(
            error.code
          )
        );
      }

      if (!data) {
        return jsonResponse(
          {
            ok: false,
            error:
              "Timetable source not found for this mosque.",
          },
          404
        );
      }

      return jsonResponse({
        ok: true,
        message:
          "Timetable source updated successfully.",
        source: data,
        source_id: id,
        created: false,
      });
    }

    const {
      data: existing,
      error:
        existingLookupError,
    } = await supabaseAdmin
      .from(
        "mosque_timetable_sources"
      )
      .select("id")
      .eq(
        "mosque_id",
        mosqueId
      )
      .eq(
        "source_url",
        sourceValue
      )
      .maybeSingle();

    if (existingLookupError) {
      console.error(
        "Timetable source duplicate lookup failed:",
        {
          mosqueId,
          code:
            existingLookupError.code,
          message:
            existingLookupError.message,
        }
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

    if (existing?.id) {
      return jsonResponse(
        {
          ok: false,
          error:
            "An identical timetable source already exists for this mosque.",
          source_id:
            existing.id,
        },
        409
      );
    }

    const {
      data,
      error,
    } = await supabaseAdmin
      .from(
        "mosque_timetable_sources"
      )
      .insert({
        ...payload,
        created_at: now,
      })
      .select("*")
      .single();

    if (error) {
      console.error(
        "Timetable source insert failed:",
        {
          mosqueId,
          code: error.code,
          message: error.message,
        }
      );

      return jsonResponse(
        {
          ok: false,
          error:
            getDatabaseErrorMessage(
              error.code,
              "Could not save the timetable source."
            ),
        },
        getDatabaseErrorStatus(
          error.code
        )
      );
    }

    return jsonResponse(
      {
        ok: true,
        message:
          "Timetable source saved successfully.",
        source: data,
        source_id:
          cleanString(
            data?.id,
            80
          ),
        created: true,
      },
      201
    );
  } catch (error) {
    console.error(
      "Timetable source POST route failed:",
      error
    );

    return jsonResponse(
      {
        ok: false,
        error:
          "Could not save timetable source.",
      },
      500
    );
  }
}