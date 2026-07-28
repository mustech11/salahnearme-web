import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/requireAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Patch = Record<string, unknown>;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALLOWED_FIELDS = new Set([
  "name",
  "category",
  "address",
  "postcode",
  "city",
  "area",
  "country",
  "phone",
  "website",
  "maps_url",
  "description",
  "is_live",
  "is_verified",
  "is_claimed",
  "can_advertise",
  "featured",
  "featured_rank",
  "pricing_tier",
  "subscription_type",
  "paid_until",
  "sponsorship_active",
  "city_sponsor",
  "mosque_sponsor",
  "sponsor_mosque_id",
  "sponsor_city_id",
  "status",
  "review_status",
  "quality_status",
  "review_notes",
]);

const BOOLEAN_FIELDS = new Set([
  "is_live",
  "is_verified",
  "is_claimed",
  "can_advertise",
  "featured",
  "sponsorship_active",
  "city_sponsor",
  "mosque_sponsor",
]);

const NUMBER_FIELDS = new Set([
  "featured_rank",
  "sponsor_city_id",
]);

const DATE_FIELDS = new Set([
  "paid_until",
]);

const URL_FIELDS = new Set([
  "website",
  "maps_url",
]);

const MAX_REQUEST_BODY_BYTES = 32_000;

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
  maxLength = 4_000
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

function parseBoolean(
  value: unknown
): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return null;
}

function normaliseUrl(
  value: unknown
): string | null {
  const cleaned =
    cleanString(value, 2_048);

  if (!cleaned) {
    return null;
  }

  const candidate =
    /^https?:\/\//i.test(cleaned)
      ? cleaned
      : `https://${cleaned}`;

  try {
    const url = new URL(candidate);

    if (
      url.protocol !== "http:" &&
      url.protocol !== "https:"
    ) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function normalisePatch(
  body: Patch
):
  | {
      ok: true;
      patch: Patch;
    }
  | {
      ok: false;
      error: string;
    } {
  const patch: Patch = {};

  for (const [key, value] of Object.entries(body)) {
    if (!ALLOWED_FIELDS.has(key)) {
      continue;
    }

    if (BOOLEAN_FIELDS.has(key)) {
      const parsed =
        parseBoolean(value);

      if (parsed === null) {
        return {
          ok: false,
          error: `${key} must be true or false.`,
        };
      }

      patch[key] = parsed;
      continue;
    }

    if (NUMBER_FIELDS.has(key)) {
      if (
        value === null ||
        value === ""
      ) {
        patch[key] = null;
        continue;
      }

      const parsed = Number(value);

      if (!Number.isFinite(parsed)) {
        return {
          ok: false,
          error: `${key} must be a valid number or null.`,
        };
      }

      patch[key] = Math.trunc(parsed);
      continue;
    }

    if (DATE_FIELDS.has(key)) {
      if (
        value === null ||
        value === ""
      ) {
        patch[key] = null;
        continue;
      }

      const cleaned =
        cleanString(value, 100);

      if (!cleaned) {
        return {
          ok: false,
          error: `${key} must be a valid date or null.`,
        };
      }

      const date = new Date(cleaned);

      if (
        Number.isNaN(
          date.getTime()
        )
      ) {
        return {
          ok: false,
          error: `${key} must be a valid date or null.`,
        };
      }

      patch[key] =
        date.toISOString();
      continue;
    }

    if (URL_FIELDS.has(key)) {
      if (
        value === null ||
        value === ""
      ) {
        patch[key] = null;
        continue;
      }

      const normalised =
        normaliseUrl(value);

      if (!normalised) {
        return {
          ok: false,
          error: `${key} must be a valid HTTP or HTTPS URL.`,
        };
      }

      patch[key] =
        normalised;
      continue;
    }

    if (
      key ===
      "sponsor_mosque_id"
    ) {
      if (
        value === null ||
        value === ""
      ) {
        patch[key] = null;
        continue;
      }

      const id =
        cleanString(value, 80);

      if (!isUuid(id)) {
        return {
          ok: false,
          error:
            "sponsor_mosque_id must be a valid UUID or null.",
        };
      }

      patch[key] = id;
      continue;
    }

    patch[key] =
      cleanString(value);
  }

  if (
    Object.keys(patch).length >
    0
  ) {
    patch.updated_at =
      new Date().toISOString();
  }

  return {
    ok: true,
    patch,
  };
}

export async function POST(
  request: Request
) {
  const admin =
    await requireAdmin(request);

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

    if (
      !contentType.includes(
        "application/json"
      )
    ) {
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
      Number.isFinite(
        contentLength
      ) &&
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

    const parsed: unknown =
      await request
        .json()
        .catch(() => null);

    if (!isPlainObject(parsed)) {
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
      cleanString(
        parsed.id,
        80
      );

    if (!isUuid(id)) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Missing or invalid id.",
        },
        400
      );
    }

    const result =
      normalisePatch(parsed);

    if (!result.ok) {
      return jsonResponse(
        {
          ok: false,
          error: result.error,
        },
        400
      );
    }

    if (
      Object.keys(
        result.patch
      ).length === 0
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            "No valid update fields supplied.",
        },
        400
      );
    }

    const { data, error } =
      await admin.supabaseService
        .from("businesses")
        .update(result.patch)
        .eq("id", id)
        .select(
          "id,name,slug,updated_at"
        )
        .maybeSingle();

    if (error) {
      console.error(
        "Admin business update failed:",
        {
          businessId: id,
          code: error.code,
          message: error.message,
        }
      );

      return jsonResponse(
        {
          ok: false,
          error:
            error.code ===
            "23505"
              ? "The update conflicts with an existing business."
              : "Could not update the business.",
        },
        error.code ===
        "23505"
          ? 409
          : 500
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
        "Business updated successfully.",
      business: data,
      updated_fields:
        Object.keys(
          result.patch
        ).filter(
          (key) =>
            key !==
            "updated_at"
        ),
    });
  } catch (error) {
    console.error(
      "Admin business update route failed:",
      error
    );

    return jsonResponse(
      {
        ok: false,
        error:
          "Could not update the business.",
      },
      500
    );
  }
}