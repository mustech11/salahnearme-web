import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Body = {
  business_id?: unknown;
  featured?: unknown;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function parseFeatured(
  value: unknown
): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const cleaned =
      value.trim().toLowerCase();

    if (
      ["true", "1", "yes", "on"].includes(cleaned)
    ) {
      return true;
    }

    if (
      ["false", "0", "no", "off"].includes(cleaned)
    ) {
      return false;
    }
  }

  return null;
}

export async function GET() {
  const admin = await requireAdmin();

  if (!admin.ok) {
    return jsonResponse(
      {
        ok: false,
        error: admin.error,
      },
      admin.status
    );
  }

  return jsonResponse({
    ok: true,
    route:
      "/api/admin/toggle-featured",
    method: "POST",
    body: {
      business_id: "uuid",
      featured: "boolean",
    },
  });
}

export async function POST(
  request: Request
) {
  const admin = await requireAdmin();

  if (!admin.ok) {
    return jsonResponse(
      {
        ok: false,
        error: admin.error,
      },
      admin.status
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
        | Body
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

    const businessId =
      cleanString(
        body.business_id
      );

    if (!isUuid(businessId)) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Missing or invalid business_id.",
        },
        400
      );
    }

    const featured =
      parseFeatured(
        body.featured
      );

    if (featured === null) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Missing or invalid featured value.",
        },
        400
      );
    }

    const now =
      new Date().toISOString();

    const update: Record<
      string,
      unknown
    > = {
      featured,
      updated_at: now,
    };

    if (!featured) {
      update.featured_rank =
        null;
      update.featured_until =
        null;
    }

    const {
      data,
      error,
    } = await supabaseAdmin
      .from("businesses")
      .update(update)
      .eq("id", businessId)
      .select(
        "id,name,slug,featured,featured_rank,featured_until,updated_at"
      )
      .maybeSingle();

    if (error) {
      console.error(
        "Toggle-featured update failed:",
        {
          businessId,
          featured,
          code: error.code,
          message: error.message,
        }
      );

      return jsonResponse(
        {
          ok: false,
          error:
            "Could not update featured status.",
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
      business: data,
      featured,
      message: featured
        ? "Business marked as featured."
        : "Business removed from featured.",
    });
  } catch (error) {
    console.error(
      "Toggle-featured route failed:",
      error
    );

    return jsonResponse(
      {
        ok: false,
        error:
          "Could not toggle featured status.",
      },
      500
    );
  }
}