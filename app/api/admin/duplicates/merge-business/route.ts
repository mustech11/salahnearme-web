import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  queue_id?: string;
  primary_id?: string;
  duplicate_id?: string;
  merged?: Record<string, unknown>;
};

function cleanString(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();

  return trimmed.length ? trimmed : null;
}

function cleanNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function cleanBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;

  if (typeof value === "string") {
    const v = value.trim().toLowerCase();

    if (["true", "1", "yes"].includes(v)) return true;
    if (["false", "0", "no"].includes(v)) return false;
  }

  return null;
}

function cleanDate(value: unknown): string | null {
  const v = cleanString(value);

  if (!v) return null;

  const time = new Date(v).getTime();

  if (!Number.isFinite(time)) return null;

  return new Date(v).toISOString();
}

function chooseString(
  merged: unknown,
  primary: unknown,
  duplicate: unknown
) {
  return (
    cleanString(merged) ??
    cleanString(primary) ??
    cleanString(duplicate)
  );
}

function chooseNumber(
  merged: unknown,
  primary: unknown,
  duplicate: unknown
) {
  return (
    cleanNumber(merged) ??
    cleanNumber(primary) ??
    cleanNumber(duplicate)
  );
}

function chooseBoolean(
  merged: unknown,
  primary: unknown,
  duplicate: unknown,
  fallback = false
) {
  return (
    cleanBoolean(merged) ??
    cleanBoolean(primary) ??
    cleanBoolean(duplicate) ??
    fallback
  );
}

function chooseDate(
  merged: unknown,
  primary: unknown,
  duplicate: unknown
) {
  return (
    cleanDate(merged) ??
    cleanDate(primary) ??
    cleanDate(duplicate)
  );
}

function chooseLongestString(
  a: unknown,
  b: unknown,
  c?: unknown
) {
  const values = [
    cleanString(a),
    cleanString(b),
    cleanString(c),
  ].filter(Boolean) as string[];

  if (!values.length) return null;

  return values.sort((x, y) => y.length - x.length)[0];
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as Body | null;

    const queueId = cleanString(body?.queue_id);
    const primaryId = cleanString(body?.primary_id);
    const duplicateId = cleanString(body?.duplicate_id);

    const merged = body?.merged ?? {};

    if (!queueId || !primaryId || !duplicateId) {
      return NextResponse.json(
        {
          error:
            "Missing queue_id, primary_id, or duplicate_id",
        },
        { status: 400 }
      );
    }

    if (primaryId === duplicateId) {
      return NextResponse.json(
        {
          error:
            "Primary and duplicate IDs cannot be the same",
        },
        { status: 400 }
      );
    }

    const { data: primary, error: primaryError } =
      await supabaseAdmin
        .from("businesses")
        .select("*")
        .eq("id", primaryId)
        .maybeSingle();

    if (primaryError) {
      return NextResponse.json(
        { error: primaryError.message },
        { status: 500 }
      );
    }

    const { data: duplicate, error: duplicateError } =
      await supabaseAdmin
        .from("businesses")
        .select("*")
        .eq("id", duplicateId)
        .maybeSingle();

    if (duplicateError) {
      return NextResponse.json(
        { error: duplicateError.message },
        { status: 500 }
      );
    }

    if (!primary || !duplicate) {
      return NextResponse.json(
        {
          error:
            "Primary or duplicate business not found",
        },
        { status: 404 }
      );
    }

    const mergedPayload = {
      name: chooseString(
        merged.name,
        primary.name,
        duplicate.name
      ),

      slug: chooseString(
        merged.slug,
        primary.slug,
        duplicate.slug
      ),

      category: chooseString(
        merged.category,
        primary.category,
        duplicate.category
      ),

      city: chooseString(
        merged.city,
        primary.city,
        duplicate.city
      ),

      area: chooseString(
        merged.area,
        primary.area,
        duplicate.area
      ),

      address: chooseLongestString(
        merged.address,
        primary.address,
        duplicate.address
      ),

      postcode: chooseString(
        merged.postcode,
        primary.postcode,
        duplicate.postcode
      ),

      website: chooseString(
        merged.website,
        primary.website,
        duplicate.website
      ),

      phone: chooseString(
        merged.phone,
        primary.phone,
        duplicate.phone
      ),

      email: chooseString(
        merged.email,
        primary.email,
        duplicate.email
      ),

      maps_url: chooseString(
        merged.maps_url,
        primary.maps_url,
        duplicate.maps_url
      ),

      latitude: chooseNumber(
        merged.latitude,
        primary.latitude,
        duplicate.latitude
      ),

      longitude: chooseNumber(
        merged.longitude,
        primary.longitude,
        duplicate.longitude
      ),

      is_verified: chooseBoolean(
        merged.is_verified,
        primary.is_verified,
        duplicate.is_verified,
        false
      ),

      featured: chooseBoolean(
        merged.featured,
        primary.featured,
        duplicate.featured,
        false
      ),

      featured_rank: chooseNumber(
        merged.featured_rank,
        primary.featured_rank,
        duplicate.featured_rank
      ),

      can_advertise: chooseBoolean(
        merged.can_advertise,
        primary.can_advertise,
        duplicate.can_advertise,
        true
      ),

      is_claimed: chooseBoolean(
        merged.is_claimed,
        primary.is_claimed,
        duplicate.is_claimed,
        false
      ),

      pricing_tier:
        chooseString(
          merged.pricing_tier,
          primary.pricing_tier,
          duplicate.pricing_tier
        ) ?? "free",

      paid_until: chooseDate(
        merged.paid_until,
        primary.paid_until,
        duplicate.paid_until
      ),

      sponsor_mosque_id: chooseString(
        merged.sponsor_mosque_id,
        primary.sponsor_mosque_id,
        duplicate.sponsor_mosque_id
      ),

      submitted_by_email: chooseString(
        merged.submitted_by_email,
        primary.submitted_by_email,
        duplicate.submitted_by_email
      ),

      claimed_by_email: chooseString(
        merged.claimed_by_email,
        primary.claimed_by_email,
        duplicate.claimed_by_email
      ),

      stripe_customer_id: chooseString(
        merged.stripe_customer_id,
        primary.stripe_customer_id,
        duplicate.stripe_customer_id
      ),

      stripe_subscription_id: chooseString(
        merged.stripe_subscription_id,
        primary.stripe_subscription_id,
        duplicate.stripe_subscription_id
      ),

      description: chooseLongestString(
        merged.description,
        primary.description,
        duplicate.description
      ),

      review_status:
        chooseString(
          merged.review_status,
          primary.review_status,
          duplicate.review_status
        ) ?? "approved",

      status:
        chooseString(
          merged.status,
          primary.status,
          duplicate.status
        ) ?? "approved",

      quality_status:
        chooseString(
          merged.quality_status,
          primary.quality_status,
          duplicate.quality_status
        ) ?? "merged",

      updated_at: new Date().toISOString(),
    };

    const { error: updatePrimaryError } =
      await supabaseAdmin
        .from("businesses")
        .update(mergedPayload)
        .eq("id", primaryId);

    if (updatePrimaryError) {
      return NextResponse.json(
        { error: updatePrimaryError.message },
        { status: 500 }
      );
    }

    await supabaseAdmin
      .from("advertising_campaign_requests")
      .update({
        business_id: primaryId,
      })
      .eq("business_id", duplicateId);

    await supabaseAdmin
      .from("business_claim_requests")
      .update({
        business_id: primaryId,
      })
      .eq("business_id", duplicateId);

    await supabaseAdmin
      .from("duplicate_review_queue")
      .update({
        status: "resolved",
        resolution: "merge",
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", queueId);

    const { error: deleteDuplicateError } =
      await supabaseAdmin
        .from("businesses")
        .delete()
        .eq("id", duplicateId);

    if (deleteDuplicateError) {
      return NextResponse.json(
        { error: deleteDuplicateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      merged_into: primaryId,
      removed_duplicate: duplicateId,
    });
  } catch (error) {
    console.error(
      "merge business duplicate route error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not merge business duplicate",
      },
      { status: 500 }
    );
  }
}

