import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/requireAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Body = {
  business_id?: unknown;
  business_ids?: unknown;
  patch?: unknown;
  bulk?: unknown;
  reorder_featured?: unknown;
  ordered_ids?: unknown;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALLOWED_FIELDS = new Set([
  "is_live",
  "featured",
  "featured_rank",
  "paid_until",
  "pricing_tier",
  "subscription_type",
  "sponsorship_active",
  "city_sponsor",
  "mosque_sponsor",
  "sponsor_mosque_id",
  "website",
  "phone",
  "maps_url",
  "is_verified",
]);

const BOOLEAN_FIELDS = new Set([
  "is_live",
  "featured",
  "sponsorship_active",
  "city_sponsor",
  "mosque_sponsor",
  "is_verified",
]);

const MAX_IDS = 250;
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
  maxLength = 2_048
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

function cleanIds(
  value: unknown
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) =>
          cleanString(item, 80)
        )
        .filter(
          (item): item is string =>
            isUuid(item)
        )
    )
  ).slice(0, MAX_IDS);
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
    cleanString(value);

  if (!cleaned) {
    return null;
  }

  const candidate =
    /^https?:\/\//i.test(cleaned)
      ? cleaned
      : `https://${cleaned}`;

  try {
    const url = new URL(candidate);

    return (
      url.protocol === "http:" ||
      url.protocol === "https:"
    )
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function normalisePatch(
  input: unknown
):
  | {
      ok: true;
      patch: Record<
        string,
        unknown
      >;
    }
  | {
      ok: false;
      error: string;
    } {
  if (!isPlainObject(input)) {
    return {
      ok: false,
      error:
        "patch must be a JSON object.",
    };
  }

  const patch:
    Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
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

    if (
      key ===
      "featured_rank"
    ) {
      if (
        value === null ||
        value === ""
      ) {
        patch[key] = null;
        continue;
      }

      const numberValue =
        Number(value);

      if (
        !Number.isFinite(
          numberValue
        ) ||
        numberValue < 1
      ) {
        return {
          ok: false,
          error:
            "featured_rank must be a positive number or null.",
        };
      }

      patch[key] =
        Math.trunc(numberValue);
      continue;
    }

    if (key === "paid_until") {
      if (
        value === null ||
        value === ""
      ) {
        patch[key] = null;
        continue;
      }

      const dateValue =
        cleanString(value, 100);

      if (!dateValue) {
        return {
          ok: false,
          error:
            "paid_until must be a valid date or null.",
        };
      }

      const date =
        new Date(dateValue);

      if (
        Number.isNaN(
          date.getTime()
        )
      ) {
        return {
          ok: false,
          error:
            "paid_until must be a valid date or null.",
        };
      }

      patch[key] =
        date.toISOString();
      continue;
    }

    if (
      key === "website" ||
      key === "maps_url"
    ) {
      if (
        value === null ||
        value === ""
      ) {
        patch[key] = null;
        continue;
      }

      const url =
        normaliseUrl(value);

      if (!url) {
        return {
          ok: false,
          error: `${key} must be a valid HTTP or HTTPS URL.`,
        };
      }

      patch[key] = url;
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

    const body =
      parsed as Body;

    if (
      body.reorder_featured ===
      true
    ) {
      const orderedIds =
        cleanIds(
          body.ordered_ids
        );

      if (
        orderedIds.length === 0
      ) {
        return jsonResponse(
          {
            ok: false,
            error:
              "Missing valid ordered_ids.",
          },
          400
        );
      }

      const updatedIds:
        string[] = [];

      for (
        let index = 0;
        index <
        orderedIds.length;
        index += 1
      ) {
        const businessId =
          orderedIds[index];

        const { data, error } =
          await admin.supabaseService
            .from("businesses")
            .update({
              featured_rank:
                index + 1,
              featured: true,
              updated_at:
                new Date().toISOString(),
            })
            .eq("id", businessId)
            .select("id")
            .maybeSingle();

        if (error) {
          console.error(
            "Business featured reorder failed:",
            {
              businessId,
              position:
                index + 1,
              code: error.code,
              message:
                error.message,
            }
          );

          return jsonResponse(
            {
              ok: false,
              error:
                "Could not complete the featured-business reorder.",
              updated_before_failure:
                updatedIds.length,
              failed_business_id:
                businessId,
            },
            500
          );
        }

        if (!data) {
          return jsonResponse(
            {
              ok: false,
              error:
                "A business in ordered_ids was not found.",
              updated_before_failure:
                updatedIds.length,
              failed_business_id:
                businessId,
            },
            404
          );
        }

        updatedIds.push(
          data.id
        );
      }

      return jsonResponse({
        ok: true,
        message:
          "Featured businesses reordered successfully.",
        updated:
          updatedIds.length,
        business_ids:
          updatedIds,
      });
    }

    const patchResult =
      normalisePatch(
        body.patch
      );

    if (!patchResult.ok) {
      return jsonResponse(
        {
          ok: false,
          error:
            patchResult.error,
        },
        400
      );
    }

    if (
      Object.keys(
        patchResult.patch
      ).length === 0
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            "No allowed update fields supplied.",
        },
        400
      );
    }

    if (body.bulk === true) {
      const ids =
        cleanIds(
          body.business_ids
        );

      if (
        ids.length === 0
      ) {
        return jsonResponse(
          {
            ok: false,
            error:
              "Missing valid business_ids.",
          },
          400
        );
      }

      const { data, error } =
        await admin.supabaseService
          .from("businesses")
          .update(
            patchResult.patch
          )
          .in("id", ids)
          .select("id");

      if (error) {
        console.error(
          "Admin business bulk manage failed:",
          {
            code: error.code,
            message: error.message,
          }
        );

        return jsonResponse(
          {
            ok: false,
            error:
              "Could not update the selected businesses.",
          },
          500
        );
      }

      return jsonResponse({
        ok: true,
        message:
          "Businesses updated successfully.",
        requested:
          ids.length,
        updated:
          data?.length ?? 0,
        business_ids:
          data?.map(
            (row) => row.id
          ) ?? [],
      });
    }

    const businessId =
      cleanString(
        body.business_id,
        80
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

    const { data, error } =
      await admin.supabaseService
        .from("businesses")
        .update(
          patchResult.patch
        )
        .eq("id", businessId)
        .select(
          "id,name,updated_at"
        )
        .maybeSingle();

    if (error) {
      console.error(
        "Admin business manage update failed:",
        {
          businessId,
          code: error.code,
          message: error.message,
        }
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
    });
  } catch (error) {
    console.error(
      "Admin business manage route failed:",
      error
    );

    return jsonResponse(
      {
        ok: false,
        error:
          "Could not update business.",
      },
      500
    );
  }
}