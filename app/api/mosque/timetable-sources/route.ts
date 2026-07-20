import { NextResponse } from "next/server";

import { requireMosqueManager } from "@/lib/mosqueManagerAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_URL_LENGTH = 900;

const SOURCE_TYPES = ["website", "pdf", "image", "csv", "manual"] as const;

type SourceType = (typeof SOURCE_TYPES)[number];

type Body = {
  id?: unknown;
  mosque_id?: unknown;
  source_url?: unknown;
  source_type?: unknown;
  auto_import_enabled?: unknown;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function cleanString(value: unknown, maxLength = 300) {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.trim().replace(/\s+/g, " ").slice(0, maxLength);

  return cleaned.length > 0 ? cleaned : null;
}

function isUuid(value: string | null): value is string {
  return Boolean(value && UUID_REGEX.test(value));
}

function cleanSourceType(value: unknown): SourceType {
  const cleaned = cleanString(value, 80);

  if (!cleaned) {
    return "website";
  }

  return SOURCE_TYPES.includes(cleaned as SourceType)
    ? (cleaned as SourceType)
    : "website";
}

function normaliseUrl(value: unknown) {
  const raw = cleanString(value, MAX_URL_LENGTH);

  if (!raw) {
    return null;
  }

  const withProtocol =
    raw.startsWith("http://") || raw.startsWith("https://")
      ? raw
      : `https://${raw}`;

  try {
    const url = new URL(withProtocol);

    if (!["http:", "https:"].includes(url.protocol)) {
      return null;
    }

    return url.toString().slice(0, MAX_URL_LENGTH);
  } catch {
    return null;
  }
}

function cleanAutoImport(value: unknown) {
  return value === true;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const mosqueId = cleanString(searchParams.get("mosque_id"), 80);

    if (!isUuid(mosqueId)) {
      return jsonResponse(
        {
          ok: false,
          error: "Missing or invalid mosque_id.",
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

    const { data, error } = await supabaseAdmin
      .from("mosque_timetable_sources")
      .select("*")
      .eq("mosque_id", mosqueId)
      .order("auto_import_enabled", {
        ascending: false,
      })
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error("timetable sources GET database error:", error);

      return jsonResponse(
        {
          ok: false,
          error: error.message,
        },
        500
      );
    }

    return jsonResponse({
      ok: true,
      count: data?.length ?? 0,
      sources: data ?? [],
    });
  } catch (error) {
    console.error("timetable sources GET route error:", error);

    return jsonResponse(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not load timetable sources.",
      },
      500
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as Body | null;

    if (!body || typeof body !== "object") {
      return jsonResponse(
        {
          ok: false,
          error: "Invalid JSON body.",
        },
        400
      );
    }

    const id = cleanString(body.id, 80);
    const mosqueId = cleanString(body.mosque_id, 80);
    const sourceUrl = normaliseUrl(body.source_url);
    const sourceType = cleanSourceType(body.source_type);
    const autoImportEnabled = cleanAutoImport(body.auto_import_enabled);

    if (!isUuid(mosqueId)) {
      return jsonResponse(
        {
          ok: false,
          error: "Missing or invalid mosque_id.",
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

    if (id && !isUuid(id)) {
      return jsonResponse(
        {
          ok: false,
          error: "Invalid source id.",
        },
        400
      );
    }

    if (!sourceUrl) {
      return jsonResponse(
        {
          ok: false,
          error: "Missing or invalid source_url.",
        },
        400
      );
    }

    const now = new Date().toISOString();

    const payload = {
      mosque_id: mosqueId,
      source_url: sourceUrl,
      source_type: sourceType,
      auto_import_enabled: autoImportEnabled,
      updated_at: now,
    };

    if (id) {
      const { data, error } = await supabaseAdmin
        .from("mosque_timetable_sources")
        .update(payload)
        .eq("id", id)
        .eq("mosque_id", mosqueId)
        .select("*")
        .maybeSingle();

      if (error) {
        console.error("timetable source update error:", error);

        return jsonResponse(
          {
            ok: false,
            error: error.message,
          },
          500
        );
      }

      if (!data) {
        return jsonResponse(
          {
            ok: false,
            error: "Timetable source not found for this mosque.",
          },
          404
        );
      }

      return jsonResponse({
        ok: true,
        source: data,
        message: "Timetable source updated.",
      });
    }

    const { data, error } = await supabaseAdmin
      .from("mosque_timetable_sources")
      .upsert(payload, {
        onConflict: "mosque_id,source_url",
      })
      .select("*")
      .single();

    if (error) {
      console.error("timetable source upsert error:", error);

      return jsonResponse(
        {
          ok: false,
          error: error.message,
        },
        500
      );
    }

    return jsonResponse(
      {
        ok: true,
        source: data,
        message: "Timetable source saved.",
      },
      201
    );
  } catch (error) {
    console.error("timetable sources POST route error:", error);

    return jsonResponse(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not save timetable source.",
      },
      500
    );
  }
}