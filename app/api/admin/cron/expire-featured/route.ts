import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function getBearerToken(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";

  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  return authHeader.slice("bearer ".length).trim();
}

function isValidCronRequest(req: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return false;
  }

  const bearerToken = getBearerToken(req);
  const headerSecret = req.headers.get("x-cron-secret");

  return bearerToken === cronSecret || headerSecret === cronSecret;
}

async function expireFeaturedListings() {
  const nowIso = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("businesses")
    .update({
      featured: false,
      featured_rank: null,
      sponsor_mosque_id: null,
      sponsor_city_id: null,
      sponsorship_active: false,
      city_sponsor: false,
      mosque_sponsor: false,
      pricing_tier: "free",
      subscription_type: "free",
      updated_at: nowIso,
    })
    .not("paid_until", "is", null)
    .lt("paid_until", nowIso)
    .or("featured.eq.true,sponsorship_active.eq.true,city_sponsor.eq.true,mosque_sponsor.eq.true")
    .select("id");

  if (error) {
    throw new Error(error.message);
  }

  return data?.length ?? 0;
}

export async function GET(req: Request) {
  try {
    if (!isValidCronRequest(req)) {
      return jsonResponse(
        {
          ok: false,
          error: "Unauthorized cron request.",
        },
        401
      );
    }

    const expiredCount = await expireFeaturedListings();

    return jsonResponse({
      ok: true,
      expired_count: expiredCount,
      message: "Expired featured listings removed.",
    });
  } catch (error) {
    console.error("admin cron expire featured route error:", error);

    return jsonResponse(
      {
        ok: false,
        error: "Could not expire featured listings.",
      },
      500
    );
  }
}

export async function POST(req: Request) {
  return GET(req);
}