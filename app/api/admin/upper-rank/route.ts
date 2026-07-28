import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type RequestBody = {
  id?: unknown;
  newRank?: unknown;
  featured_rank?: unknown;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_FEATURED_RANK = 9_999;
const MAX_REQUEST_BODY_BYTES = 8_000;

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
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function cleanString(
  value: unknown,
  maxLength = 80
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, maxLength);

  return cleaned || null;
}

function isUuid(
  value: string | null
): value is string {
  return Boolean(value && UUID_REGEX.test(value));
}

function cleanRank(
  value: unknown
): number | null {
  const parsed = Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed < 1 ||
    parsed >
      MAX_FEATURED_RANK
  ) {
    return null;
  }

  return parsed;
}

export async function GET() {
  const permission =
    await requireAdmin();

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

  return jsonResponse({
    ok: true,
    route:
      "/api/admin/upper-rank",
    method: "POST",
    body: {
      id: "business uuid",
      newRank: 1,
    },
    limits: {
      minimum_rank: 1,
      maximum_rank:
        MAX_FEATURED_RANK,
    },
  });
}

export async function POST(
  request: Request
) {
  const permission =
    await requireAdmin();

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

  try {
    const contentType =
      request.headers
        .get("content-type")
        ?.toLowerCase() ?? "";

    if (!contentType.includes("application/json")) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Content-Type must be application/json.",
        },
        415
      );
    }

    const contentLength =
      Number(
        request.headers.get(
          "content-length"
        )
      );

    if (
      Number.isFinite(contentLength) &&
      contentLength >
        MAX_REQUEST_BODY_BYTES
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Request body is too large.",
        },
        413
      );
    }

    const body =
      (await request
        .json()
        .catch(() => null)) as
        | RequestBody
        | null;

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
      cleanString(body.id);

    const newRank =
      cleanRank(
        body.newRank ??
          body.featured_rank
      );

    if (!isUuid(id)) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Missing or invalid business id.",
        },
        400
      );
    }

    if (newRank === null) {
      return jsonResponse(
        {
          ok: false,
          error: `Featured rank must be an integer from 1 to ${MAX_FEATURED_RANK}.`,
        },
        400
      );
    }

    const now =
      new Date().toISOString();

    const {
      data,
      error,
    } = await supabaseAdmin
      .from("businesses")
      .update({
        featured_rank:
          newRank,
        featured: true,
        updated_at: now,
      })
      .eq("id", id)
      .select(
        "id,name,slug,featured,featured_rank,updated_at"
      )
      .maybeSingle();

    if (error) {
      console.error(
        "Upper-rank update failed:",
        {
          businessId: id,
          newRank,
          code: error.code,
          message: error.message,
        }
      );

      return jsonResponse(
        {
          ok: false,
          error:
            "Could not update business rank.",
        },
        500
      );
    }

    if (!data) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Business not found.",
        },
        404
      );
    }

    return jsonResponse({
      ok: true,
      message:
        "Business featured rank updated successfully.",
      featured_rank:
        newRank,
      business: data,
    });
  } catch (error) {
    console.error(
      "Upper-rank route failed:",
      error
    );

    return jsonResponse(
      {
        ok: false,
        error:
          "Could not update upper rank.",
      },
      500
    );
  }
}