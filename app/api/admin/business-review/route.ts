import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Action =
  | "approve"
  | "reject"
  | "verify"
  | "unverify"
  | "make_live"
  | "hide"
  | "feature"
  | "unfeature"
  | "update";

type BulkAction =
  | "approve"
  | "reject"
  | "verify"
  | "hide"
  | "make_live"
  | "feature"
  | "unfeature";

type Body = {
  business_id?: string;
  business_ids?: string[];
  action?: Action | BulkAction;
  category?: string | null;
  review_notes?: string | null;
  featured_until?: string | null;
  featured_rank?: number | null;
  bulk?: boolean;
};

function cleanString(value: unknown) {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();

  return trimmed.length ? trimmed : null;
}

function cleanNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function isValidAction(value: unknown): value is Action {
  return [
    "approve",
    "reject",
    "verify",
    "unverify",
    "make_live",
    "hide",
    "feature",
    "unfeature",
    "update",
  ].includes(String(value));
}

function isValidBulkAction(value: unknown): value is BulkAction {
  return [
    "approve",
    "reject",
    "verify",
    "hide",
    "make_live",
    "feature",
    "unfeature",
  ].includes(String(value));
}

function buildUpdate(
  action: Action | BulkAction,
  reviewNotes?: string | null
) {
  const update: Record<string, unknown> = {
    reviewed_at: new Date().toISOString(),
    reviewed_by: "admin",
  };

  if (action === "approve") {
    update.review_status = "approved";
    update.status = "approved";
    update.can_advertise = true;
    update.is_live = true;
    update.quality_status = "manual_approved";
  }

  if (action === "reject") {
    update.review_status = "rejected";
    update.status = "rejected";
    update.can_advertise = false;
    update.is_live = false;
    update.featured = false;
    update.quality_status = "manual_rejected";
  }

  if (action === "verify") {
    update.is_verified = true;
    update.review_status = "approved";
    update.status = "approved";
    update.can_advertise = true;
    update.is_live = true;
    update.quality_status = "manual_verified";
  }

  if (action === "unverify") {
    update.is_verified = false;
    update.quality_status = "manual_unverified";
  }

  if (action === "make_live") {
    update.is_live = true;
    update.review_status = "approved";
    update.status = "approved";
    update.can_advertise = true;
  }

  if (action === "hide") {
    update.is_live = false;
    update.quality_status = "manual_hidden";
  }

  if (action === "feature") {
    update.featured = true;
  }

  if (action === "unfeature") {
    update.featured = false;
    update.featured_rank = null;
    update.featured_until = null;
  }

  if (reviewNotes) {
    update.review_notes = reviewNotes;
  }

  return update;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const status = searchParams.get("status") ?? "pending";
    const city = searchParams.get("city");
    const confidence = searchParams.get("confidence");
    const quality = searchParams.get("quality");

    const requestedLimit = Number(searchParams.get("limit") ?? "150");

    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 500)
      : 150;

    let query = supabaseAdmin
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
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status !== "all") {
      query = query.eq("review_status", status);
    }

    if (city && city !== "all") {
      query = query.eq("city", city);
    }

    if (confidence && confidence !== "all") {
      query = query.eq("halal_confidence", confidence);
    }

    if (quality && quality !== "all") {
      query = query.eq("quality_status", quality);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      count: data?.length ?? 0,
      businesses: data ?? [],
    });
  } catch (error) {
    console.error("business review queue GET error:", error);

    return NextResponse.json(
      { error: "Could not load business review queue." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as Body | null;

    if (!body) {
      return NextResponse.json(
        { error: "Missing body." },
        { status: 400 }
      );
    }

    const action = body.action;
    const reviewNotes = cleanString(body.review_notes);

    if (body.bulk) {
      const ids = Array.isArray(body.business_ids)
        ? body.business_ids
            .map(cleanString)
            .filter((id): id is string => !!id)
        : [];

      if (!ids.length || !isValidBulkAction(action)) {
        return NextResponse.json(
          {
            error: "Missing valid bulk action or selected businesses.",
          },
          { status: 400 }
        );
      }

      const update = buildUpdate(action, reviewNotes);

      const { error } = await supabaseAdmin
        .from("businesses")
        .update(update)
        .in("id", ids);

      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        ok: true,
        updated: ids.length,
      });
    }

    const businessId = cleanString(body.business_id);

    const category = cleanString(body.category);

    const featuredUntil = cleanString(body.featured_until);

    const featuredRank = cleanNumber(body.featured_rank);

    if (!businessId || !isValidAction(action)) {
      return NextResponse.json(
        {
          error: "Missing or invalid business_id/action.",
        },
        { status: 400 }
      );
    }

    const update =
      action === "update"
        ? {
            reviewed_at: new Date().toISOString(),
            reviewed_by: "admin",

            ...(category ? { category } : {}),

            ...(reviewNotes
              ? {
                  review_notes: reviewNotes,
                }
              : {}),

            ...(featuredUntil !== null
              ? {
                  featured_until: featuredUntil,
                }
              : {}),

            ...(featuredRank !== null
              ? {
                  featured_rank: featuredRank,
                }
              : {}),
          }
        : buildUpdate(action, reviewNotes);

    const { data, error } = await supabaseAdmin
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
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      business: data,
    });
  } catch (error) {
    console.error("business review queue POST error:", error);

    return NextResponse.json(
      { error: "Could not update business review item." },
      { status: 500 }
    );
  }
}

