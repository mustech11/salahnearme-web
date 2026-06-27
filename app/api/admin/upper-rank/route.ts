import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RequestBody = {
  id?: unknown;
  newRank?: unknown;
  featured_rank?: unknown;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(
      value.trim()
    )
  );
}

function cleanRank(value: unknown) {
  const number = Number(value);

  if (!Number.isInteger(number)) {
    return null;
  }

  if (number < 0 || number > 9999) {
    return null;
  }

  return number;
}

export async function GET() {
  const permission = await requireAdmin();

  if (!permission.ok) {
    return jsonResponse(
      {
        ok: false,
        error: permission.error,
      },
      permission.status
    );
  }

  return jsonResponse({
    ok: true,
    route: "/api/admin/upper-rank",
    method: "POST",
    body: {
      id: "business uuid",
      newRank: 1,
    },
  });
}

export async function POST(req: Request) {
  try {
    const permission = await requireAdmin();

    if (!permission.ok) {
      return jsonResponse(
        {
          ok: false,
          error: permission.error,
        },
        permission.status
      );
    }

    const body = (await req.json().catch(() => ({}))) as RequestBody;

    const id = typeof body.id === "string" ? body.id.trim() : null;

    const newRank = cleanRank(
      body.newRank ?? body.featured_rank
    );

    if (!isUuid(id)) {
      return jsonResponse(
        {
          ok: false,
          error: "Missing or invalid business id.",
        },
        400
      );
    }

    if (newRank === null) {
      return jsonResponse(
        {
          ok: false,
          error: "Missing or invalid featured rank.",
        },
        400
      );
    }

    const { data, error } = await supabaseAdmin
      .from("businesses")
      .update({
        featured_rank: newRank,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id, name, slug, featured_rank, updated_at")
      .single();

    if (error) {
      console.error("upper-rank update error:", error);

      return jsonResponse(
        {
          ok: false,
          error: "Could not update business rank.",
        },
        500
      );
    }

    return jsonResponse({
      ok: true,
      business: data,
    });
  } catch (error) {
    console.error("upper-rank route error:", error);

    return jsonResponse(
      {
        ok: false,
        error: "Could not update upper rank.",
      },
      500
    );
  }
}

