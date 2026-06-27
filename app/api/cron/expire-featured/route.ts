import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ExpiredBusiness = {
  id: string;
  name: string | null;
  slug: string | null;
  city: string | null;
  pricing_tier: string | null;
  subscription_type: string | null;
  featured: boolean | null;
  paid_until: string | null;
  sponsorship_active: boolean | null;
};

type ExpireResult = {
  ok: boolean;
  status: number;
  body: Record<string, unknown>;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status });
}

function getBearerToken(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";

  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return authHeader.slice("bearer ".length).trim();
}

function isCronAuthorised(req: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("CRON_SECRET is missing.");
    return false;
  }

  const bearerToken = getBearerToken(req);
  const headerSecret = req.headers.get("x-cron-secret") ?? "";

  return bearerToken === cronSecret || headerSecret === cronSecret;
}

function getStringValue(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function getBooleanValue(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function toExpiredBusiness(row: unknown): ExpiredBusiness | null {
  if (!row || typeof row !== "object") {
    return null;
  }

  const item = row as Record<string, unknown>;
  const id = getStringValue(item.id);

  if (!id) {
    return null;
  }

  return {
    id,
    name: getStringValue(item.name),
    slug: getStringValue(item.slug),
    city: getStringValue(item.city),
    pricing_tier: getStringValue(item.pricing_tier),
    subscription_type: getStringValue(item.subscription_type),
    featured: getBooleanValue(item.featured),
    paid_until: getStringValue(item.paid_until),
    sponsorship_active: getBooleanValue(item.sponsorship_active),
  };
}

function toExpiredBusinesses(rows: unknown): ExpiredBusiness[] {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .map((row) => toExpiredBusiness(row))
    .filter((business): business is ExpiredBusiness => Boolean(business));
}

async function expireFeaturedBusinesses(): Promise<ExpireResult> {
  const nowIso = new Date().toISOString();

  const { data: expiredBusinessesRaw, error: fetchError } = await supabaseAdmin
    .from("businesses")
    .select(
      [
        "id",
        "name",
        "slug",
        "city",
        "pricing_tier",
        "subscription_type",
        "featured",
        "paid_until",
        "sponsorship_active",
      ].join(",")
    )
    .not("paid_until", "is", null)
    .lt("paid_until", nowIso)
    .or(
      [
        "featured.eq.true",
        "sponsorship_active.eq.true",
        "city_sponsor.eq.true",
        "mosque_sponsor.eq.true",
      ].join(",")
    );

  if (fetchError) {
    console.error("expire-featured fetch error:", fetchError);

    return {
      ok: false,
      status: 500,
      body: {
        ok: false,
        error: fetchError.message,
      },
    };
  }

  const businesses = toExpiredBusinesses(expiredBusinessesRaw);
  const businessIds = businesses.map((business) => business.id);

  if (businessIds.length === 0) {
    return {
      ok: true,
      status: 200,
      body: {
        ok: true,
        expired_businesses: 0,
        businesses: [],
        message: "No expired featured or sponsored businesses found.",
      },
    };
  }

  const { error: updateBusinessesError } = await supabaseAdmin
    .from("businesses")
    .update({
      featured: false,
      featured_rank: null,

      pricing_tier: "free",
      subscription_type: "free",

      sponsorship_active: false,
      city_sponsor: false,
      mosque_sponsor: false,

      sponsor_city_id: null,
      sponsor_mosque_id: null,

      updated_at: nowIso,
    })
    .in("id", businessIds);

  if (updateBusinessesError) {
    console.error(
      "expire-featured update businesses error:",
      updateBusinessesError
    );

    return {
      ok: false,
      status: 500,
      body: {
        ok: false,
        error: updateBusinessesError.message,
      },
    };
  }

  const { error: campaignError } = await supabaseAdmin
    .from("advertising_campaign_requests")
    .update({
      status: "expired",
      updated_at: nowIso,
    })
    .in("business_id", businessIds)
    .in("status", ["active", "approved", "pending_activation"]);

  if (campaignError) {
    console.error("expire-featured campaign update error:", campaignError);

    return {
      ok: false,
      status: 500,
      body: {
        ok: false,
        error: campaignError.message,
      },
    };
  }

  return {
    ok: true,
    status: 200,
    body: {
      ok: true,
      expired_businesses: businessIds.length,
      businesses,
      message: "Expired featured and sponsored placements removed.",
    },
  };
}

export async function GET(req: Request) {
  try {
    if (!isCronAuthorised(req)) {
      return jsonResponse(
        {
          ok: false,
          error: "Unauthorized cron request.",
        },
        401
      );
    }

    const result = await expireFeaturedBusinesses();

    return jsonResponse(result.body, result.status);
  } catch (error) {
    console.error("expire-featured GET error:", error);

    return jsonResponse(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not expire featured businesses.",
      },
      500
    );
  }
}

export async function POST(req: Request) {
  return GET(req);
}