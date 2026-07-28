import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/requireAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Body = {
  ordered_ids?: unknown;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_IDS = 250;
const MAX_REQUEST_BODY_BYTES = 24_000;

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

function isUuid(
  value: string
): boolean {
  return UUID_REGEX.test(value);
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
        .map((id) =>
          typeof id === "string"
            ? id.trim()
            : ""
        )
        .filter(
          (id) =>
            Boolean(id) &&
            isUuid(id)
        )
    )
  ).slice(0, MAX_IDS);
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

    const body =
      (await request
        .json()
        .catch(() => null)) as
        | Body
        | null;

    const orderedIds =
      cleanIds(
        body?.ordered_ids
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
          "Featured business reorder failed:",
          {
            businessId,
            rank: index + 1,
            code: error.code,
            message:
              error.message,
          }
        );

        return jsonResponse(
          {
            ok: false,
            error:
              "Could not complete the business reorder.",
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
      ordered_ids:
        updatedIds,
    });
  } catch (error) {
    console.error(
      "Business reorder route failed:",
      error
    );

    return jsonResponse(
      {
        ok: false,
        error:
          "Could not reorder businesses.",
      },
      500
    );
  }
}