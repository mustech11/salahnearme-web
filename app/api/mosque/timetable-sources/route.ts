import { NextResponse } from "next/server";

import { requireMosqueManager } from "@/lib/mosqueManagerAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  id?: string | null;
  mosque_id?: string;
  source_url?: string | null;
  source_type?: string | null;
  auto_import_enabled?: boolean | null;
};

function cleanString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function isUuid(value: string | null | undefined) {
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
      .from("mosque_timetable_sources")
      .select("*")
      .eq("mosque_id", mosqueId)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
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
        sources: data ?? [],
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error("timetable sources GET route error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Could not load timetable sources.",
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

    const id = cleanString(body.id ?? null);
    const mosqueId = cleanString(body.mosque_id);
    const sourceUrl = normaliseUrl(cleanString(body.source_url));
    const sourceType = cleanSourceType(body.source_type);
    const autoImportEnabled = Boolean(body.auto_import_enabled);

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

    if (id && !isUuid(id)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid source id.",
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
        .single();

      if (error) {
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
          source: data,
        },
        {
          status: 200,
        }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("mosque_timetable_sources")
      .upsert(payload, {
        onConflict: "mosque_id,source_url",
      })
      .select("*")
      .single();

    if (error) {
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
        source: data,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error("timetable sources POST route error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Could not save timetable source.",
      },
      {
        status: 500,
      }
    );
  }
}

