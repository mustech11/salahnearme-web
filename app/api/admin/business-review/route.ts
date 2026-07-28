import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/requireAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ACTIONS = [
  "approve",
  "reject",
  "verify",
  "unverify",
  "make_live",
  "hide",
  "feature",
  "unfeature",
  "update",
] as const;

const BULK_ACTIONS = [
  "approve",
  "reject",
  "verify",
  "hide",
  "make_live",
  "feature",
  "unfeature",
] as const;

type Action = (typeof ACTIONS)[number];
type BulkAction = (typeof BULK_ACTIONS)[number];

type Body = {
  business_id?: unknown;
  business_ids?: unknown;
  action?: unknown;
  category?: unknown;
  review_notes?: unknown;
  featured_until?: unknown;
  featured_rank?: unknown;
  bulk?: unknown;
};

const MAX_BULK_IDS = 250;
const MAX_REVIEW_NOTES_LENGTH = 2_000;
const MAX_CATEGORY_LENGTH = 120;
const MAX_REQUEST_BODY_BYTES = 32_000;
const DEFAULT_LIMIT = 150;
const MAX_LIMIT = 500;

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
  maxLength = 300
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

function cleanInteger(value: unknown): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  return Number.isFinite(parsed)
    ? Math.trunc(parsed)
    : null;
}

function cleanDate(value: unknown): string | null {
  const cleaned = cleanString(value, 100);

  if (!cleaned) {
    return null;
  }

  const date = new Date(cleaned);

  return Number.isNaN(date.getTime())
    ? null
    : date.toISOString();
}

function isUuid(value: string | null): value is string {
  return Boolean(value && UUID_REGEX.test(value));
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

function isJsonRequest(request: Request): boolean {
  return Boolean(
    request.headers
      .get("content-type")
      ?.toLowerCase()
      .includes("application/json")
  );
}

function isAction(value: unknown): value is Action {
  return (
    typeof value === "string" &&
    ACTIONS.includes(value as Action)
  );
}

function isBulkAction(value: unknown): value is BulkAction {
  return (
    typeof value === "string" &&
    BULK_ACTIONS.includes(value as BulkAction)
  );
}

function cleanIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) => cleanString(item, 80))
        .filter(
          (item): item is string => isUuid(item)
        )
    )
  ).slice(0, MAX_BULK_IDS);
}

async function readBody(request: Request): Promise<Body | null> {
  const contentLength = Number(
    request.headers.get("content-length")
  );

  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_REQUEST_BODY_BYTES
  ) {
    return null;
  }

  try {
    const value: unknown = await request.json();

    return isPlainObject(value)
      ? (value as Body)
      : null;
  } catch {
    return null;
  }
}

function buildUpdate(
  action: Action | BulkAction,
  reviewNotes: string | null
) {
  const now = new Date().toISOString();

  const update: Record<string, unknown> = {
    reviewed_at: now,
    reviewed_by: "admin",
    updated_at: now,
  };

  if (action === "approve") {
    Object.assign(update, {
      review_status: "approved",
      status: "approved",
      can_advertise: true,
      is_live: true,
      quality_status: "manual_approved",
    });
  }

  if (action === "reject") {
    Object.assign(update, {
      review_status: "rejected",
      status: "rejected",
      can_advertise: false,
      is_live: false,
      featured: false,
      featured_rank: null,
      featured_until: null,
      quality_status: "manual_rejected",
    });
  }

  if (action === "verify") {
    Object.assign(update, {
      is_verified: true,
      review_status: "approved",
      status: "approved",
      can_advertise: true,
      is_live: true,
      quality_status: "manual_verified",
    });
  }

  if (action === "unverify") {
    Object.assign(update, {
      is_verified: false,
      quality_status: "manual_unverified",
    });
  }

  if (action === "make_live") {
    Object.assign(update, {
      is_live: true,
      review_status: "approved",
      status: "approved",
      can_advertise: true,
    });
  }

  if (action === "hide") {
    Object.assign(update, {
      is_live: false,
      quality_status: "manual_hidden",
    });
  }

  if (action === "feature") {
    update.featured = true;
  }

  if (action === "unfeature") {
    Object.assign(update, {
      featured: false,
      featured_rank: null,
      featured_until: null,
    });
  }

  if (reviewNotes !== null) {
    update.review_notes = reviewNotes;
  }

  return update;
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);

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
    const { searchParams } = new URL(request.url);

    const status =
      cleanString(searchParams.get("status"), 80) ??
      "pending";

    const city = cleanString(
      searchParams.get("city"),
      120
    );

    const confidence = cleanString(
      searchParams.get("confidence"),
      80
    );

    const quality = cleanString(
      searchParams.get("quality"),
      120
    );

    const requestedLimit =
      cleanInteger(searchParams.get("limit")) ??
      DEFAULT_LIMIT;

    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, requestedLimit)
    );

    let query = admin.supabaseService
      .from("businesses")
      .select(
        `
        id,
        name,
        slug,
        category,
        city,
        area,
        address,
        postcode,
        phone,
        website,
        maps_url,
        is_verified,
        is_claimed,
        claimed_by_email,
        featured,
        featured_rank,
        featured_until,
        pricing_tier,
        subscription_type,
        paid_until,
        sponsorship_active,
        city_sponsor,
        mosque_sponsor,
        sponsor_mosque_id,
        halal_confidence,
        halal_score,
        halal_signals,
        import_source,
        import_notes,
        import_distance_km,
        imported_for_city,
        quality_status,
        quality_reason,
        review_status,
        review_notes,
        reviewed_at,
        is_live,
        status,
        can_advertise,
        latitude,
        longitude,
        google_place_id,
        osm_type,
        osm_id,
        created_at
      `
      )
      .order("created_at", {
        ascending: false,
      })
      .limit(limit);

    if (status !== "all") {
      query = query.eq("review_status", status);
    }

    if (city && city !== "all") {
      query = query.eq("city", city);
    }

    if (confidence && confidence !== "all") {
      query = query.eq(
        "halal_confidence",
        confidence
      );
    }

    if (quality && quality !== "all") {
      query = query.eq(
        "quality_status",
        quality
      );
    }

    const { data, error } = await query;

    if (error) {
      console.error(
        "Business review queue query failed:",
        {
          code: error.code,
          message: error.message,
        }
      );

      return jsonResponse(
        {
          ok: false,
          error:
            "Could not load business review queue.",
        },
        500
      );
    }

    return jsonResponse({
      ok: true,
      count: data?.length ?? 0,
      limit,
      filters: {
        status,
        city,
        confidence,
        quality,
      },
      businesses: data ?? [],
    });
  } catch (error) {
    console.error(
      "Business review GET route failed:",
      error
    );

    return jsonResponse(
      {
        ok: false,
        error:
          "Could not load business review queue.",
      },
      500
    );
  }
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);

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
    if (!isJsonRequest(request)) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Content-Type must be application/json.",
        },
        415
      );
    }

    const body = await readBody(request);

    if (!body) {
      return jsonResponse(
        {
          ok: false,
          error: "Invalid JSON body.",
        },
        400
      );
    }

    const action = body.action;
    const reviewNotes = cleanString(
      body.review_notes,
      MAX_REVIEW_NOTES_LENGTH
    );

    if (body.bulk === true) {
      const ids = cleanIds(body.business_ids);

      if (
        ids.length === 0 ||
        !isBulkAction(action)
      ) {
        return jsonResponse(
          {
            ok: false,
            error:
              "Missing valid bulk action or selected businesses.",
          },
          400
        );
      }

      const update = buildUpdate(
        action,
        reviewNotes
      );

      const { data, error } =
        await admin.supabaseService
          .from("businesses")
          .update(update)
          .in("id", ids)
          .select("id");

      if (error) {
        console.error(
          "Business review bulk update failed:",
          {
            action,
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
        action,
        requested: ids.length,
        updated: data?.length ?? 0,
        business_ids:
          data?.map((row) => row.id) ?? [],
      });
    }

    const businessId = cleanString(
      body.business_id,
      80
    );

    if (
      !isUuid(businessId) ||
      !isAction(action)
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Missing or invalid business_id/action.",
        },
        400
      );
    }

    let update: Record<string, unknown>;

    if (action === "update") {
      update = {
        reviewed_at:
          new Date().toISOString(),
        reviewed_by: "admin",
        updated_at:
          new Date().toISOString(),
      };

      const category = cleanString(
        body.category,
        MAX_CATEGORY_LENGTH
      );

      if (category !== null) {
        update.category = category;
      }

      if (body.review_notes !== undefined) {
        update.review_notes = reviewNotes;
      }

      if (body.featured_until !== undefined) {
        if (body.featured_until === null) {
          update.featured_until = null;
        } else {
          const featuredUntil = cleanDate(
            body.featured_until
          );

          if (!featuredUntil) {
            return jsonResponse(
              {
                ok: false,
                error:
                  "Invalid featured_until date.",
              },
              400
            );
          }

          update.featured_until =
            featuredUntil;
        }
      }

      if (body.featured_rank !== undefined) {
        if (body.featured_rank === null) {
          update.featured_rank = null;
        } else {
          const featuredRank = cleanInteger(
            body.featured_rank
          );

          if (
            featuredRank === null ||
            featuredRank < 1
          ) {
            return jsonResponse(
              {
                ok: false,
                error:
                  "featured_rank must be a positive integer or null.",
              },
              400
            );
          }

          update.featured_rank =
            featuredRank;
        }
      }

      if (Object.keys(update).length === 3) {
        return jsonResponse(
          {
            ok: false,
            error:
              "No valid update fields were supplied.",
          },
          400
        );
      }
    } else {
      update = buildUpdate(
        action,
        reviewNotes
      );
    }

    const { data, error } =
      await admin.supabaseService
        .from("businesses")
        .update(update)
        .eq("id", businessId)
        .select(
          `
          id,
          name,
          category,
          review_status,
          status,
          is_live,
          is_verified,
          can_advertise,
          featured,
          featured_rank,
          featured_until,
          review_notes,
          reviewed_at
        `
        )
        .maybeSingle();

    if (error) {
      console.error(
        "Business review update failed:",
        {
          businessId,
          action,
          code: error.code,
          message: error.message,
        }
      );

      return jsonResponse(
        {
          ok: false,
          error:
            "Could not update the business review item.",
        },
        500
      );
    }

    if (!data) {
      return jsonResponse(
        {
          ok: false,
          error: "Business not found.",
        },
        404
      );
    }

    return jsonResponse({
      ok: true,
      action,
      business: data,
    });
  } catch (error) {
    console.error(
      "Business review POST route failed:",
      error
    );

    return jsonResponse(
      {
        ok: false,
        error:
          "Could not update business review item.",
      },
      500
    );
  }
}