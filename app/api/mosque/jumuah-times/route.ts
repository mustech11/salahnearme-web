import { NextResponse } from "next/server";

import { requireMosqueManager } from "@/lib/mosqueManagerAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  id?: string | null;
  mosque_id?: string;
  label?: string | null;
  khutbah_time?: string | null;
  salah_time?: string | null;
  active?: boolean | null;
  notes?: string | null;
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

function cleanTime(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const cleaned = cleanString(value);

  if (!cleaned) {
    return null;
  }

  if (/^\d{2}:\d{2}:\d{2}$/.test(cleaned)) {
    return cleaned;
  }

  if (/^\d{2}:\d{2}$/.test(cleaned)) {
    return `${cleaned}:00`;
  }

  return null;
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

    const { data, error } = await supabaseAdmin
      .from("mosque_jumuah_times")
      .select("*")
      .eq("mosque_id", mosqueId)
      .eq("active", true)
      .order("salah_time", {
        ascending: true,
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
        jumuah_times: data ?? [],
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error("mosque jumuah times GET error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Could not load Jumu’ah times.",
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
    const khutbahTime = cleanTime(body.khutbah_time);
    const salahTime = cleanTime(body.salah_time);

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
          error: "Invalid Jumu’ah time id.",
        },
        {
          status: 400,
        }
      );
    }

    if (!salahTime) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing or invalid salah_time.",
        },
        {
          status: 400,
        }
      );
    }

    const now = new Date().toISOString();

    const payload = {
      mosque_id: mosqueId,
      label: cleanString(body.label) ?? "Jumu’ah",
      khutbah_time: khutbahTime,
      salah_time: salahTime,
      active: body.active === false ? false : true,
      notes: cleanString(body.notes),
      updated_at: now,
    };

    if (id) {
      const { data, error } = await supabaseAdmin
        .from("mosque_jumuah_times")
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
          jumuah_time: data,
        },
        {
          status: 200,
        }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("mosque_jumuah_times")
      .insert(payload)
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
        jumuah_time: data,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error("mosque jumuah times POST error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Could not save Jumu’ah time.",
      },
      {
        status: 500,
      }
    );
  }
}

