import { NextResponse } from "next/server";

import { requireMosqueManager } from "@/lib/mosqueManagerAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  mosque_id?: string;
  source_id?: string | null;
  source_url?: string | null;
  source_type?: string | null;
  import_month?: number | null;
  import_year?: number | null;
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

function normaliseUrl(value: string | null) {
  if (!value) {
    return null;
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  return `https://${value}`;
}

function cleanSourceType(value: unknown) {
  const cleaned = cleanString(value);

  const allowed = new Set(["website", "pdf", "image", "csv", "manual"]);

  if (!cleaned || !allowed.has(cleaned)) {
    return "website";
  }

  return cleaned;
}

function getCurrentMonth() {
  return new Date().getMonth() + 1;
}

function getCurrentYear() {
  return new Date().getFullYear();
}

function cleanMonth(value: unknown) {
  if (typeof value !== "number") {
    return getCurrentMonth();
  }

  if (!Number.isInteger(value) || value < 1 || value > 12) {
    return getCurrentMonth();
  }

  return value;
}

function cleanYear(value: unknown) {
  if (typeof value !== "number") {
    return getCurrentYear();
  }

  if (!Number.isInteger(value) || value < 2020 || value > 2100) {
    return getCurrentYear();
  }

  return value;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const mosqueId = cleanString(searchParams.get("mosque_id"));

    if (!isUuid(mosqueId)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing or invalid mosque_id.",
        },
        {
          status: 400,
        }
      );
    }

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

    const { data, error } = await supabaseAdmin
      .from("mosque_timetable_imports")
      .select("*")
      .eq("mosque_id", mosqueId)
      .order("created_at", {
        ascending: false,
      })
      .limit(20);

    if (error) {
      console.error("mosque timetable imports GET error:", error);

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
        count: data?.length ?? 0,
        imports: data ?? [],
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error("mosque timetable imports GET route error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Could not load timetable imports.",
      },
      {
        status: 500,
      }
    );
  }
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

    const mosqueId = cleanString(body.mosque_id);
    const sourceId = cleanString(body.source_id ?? null);
    const sourceUrl = normaliseUrl(cleanString(body.source_url));
    const sourceType = cleanSourceType(body.source_type);

    if (!isUuid(mosqueId)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing or invalid mosque_id.",
        },
        {
          status: 400,
        }
      );
    }

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

    if (sourceId && !isUuid(sourceId)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid source_id.",
        },
        {
          status: 400,
        }
      );
    }

    if (!sourceUrl) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing source_url.",
        },
        {
          status: 400,
        }
      );
    }

    const now = new Date().toISOString();

    const payload = {
      mosque_id: mosqueId,
      source_id: sourceId || null,
      source_url: sourceUrl,
      source_type: sourceType,
      import_month: cleanMonth(body.import_month),
      import_year: cleanYear(body.import_year),
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
      console.error("mosque timetable imports POST error:", error);

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

    if (sourceId) {
      await supabaseAdmin
        .from("mosque_timetable_sources")
        .update({
          last_checked_at: now,
          updated_at: now,
        })
        .eq("id", sourceId)
        .eq("mosque_id", mosqueId);
    }

    return NextResponse.json(
      {
        ok: true,
        import: data,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error("mosque timetable imports POST route error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Could not create timetable import.",
      },
      {
        status: 500,
      }
    );
  }
}

