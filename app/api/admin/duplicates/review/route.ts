import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_ACTIONS = ["merge", "keep_both", "ignore"] as const;

type ReviewAction = (typeof ALLOWED_ACTIONS)[number];

type ReviewBody = {
  queue_id?: unknown;
  action?: unknown;
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
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value.trim()
    )
  );
}

function isAllowedAction(value: unknown): value is ReviewAction {
  return (
    typeof value === "string" &&
    ALLOWED_ACTIONS.includes(value as ReviewAction)
  );
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
    route: "/api/admin/duplicates/review",
    method: "POST",
    allowed_actions: ALLOWED_ACTIONS,
    body: {
      queue_id: "uuid",
      action: "merge | keep_both | ignore",
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

    const body = (await req.json().catch(() => ({}))) as ReviewBody;

    const queueId =
      typeof body.queue_id === "string" ? body.queue_id.trim() : null;

    if (!isUuid(queueId)) {
      return jsonResponse(
        {
          ok: false,
          error: "Missing or invalid queue_id.",
        },
        400
      );
    }

    if (!isAllowedAction(body.action)) {
      return jsonResponse(
        {
          ok: false,
          error: "Missing or invalid action.",
          allowed_actions: ALLOWED_ACTIONS,
        },
        400
      );
    }

    const status = body.action === "ignore" ? "ignored" : "resolved";

    const { data, error } = await supabaseAdmin
      .from("duplicate_review_queue")
      .update({
        status,
        resolution: body.action,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", queueId)
      .select("id, entity_type, left_id, right_id, status, resolution, reviewed_at")
      .single();

    if (error) {
      console.error("duplicate review update error:", error);

      return jsonResponse(
        {
          ok: false,
          error: "Could not update duplicate review.",
        },
        500
      );
    }

    return jsonResponse({
      ok: true,
      review: data,
    });
  } catch (error) {
    console.error("duplicate review route error:", error);

    return jsonResponse(
      {
        ok: false,
        error: "Could not update duplicate review.",
      },
      500
    );
  }
}

