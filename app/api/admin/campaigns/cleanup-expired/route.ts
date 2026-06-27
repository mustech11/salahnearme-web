import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/adminAuth";
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

export async function POST() {
  try {
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

    const nowIso = new Date().toISOString();

    const { data: expiredBusinesses, error: fetchError } = await supabaseAdmin
      .from("businesses")
      .select("id")
      .not("paid_until", "is", null)
      .lt("paid_until", nowIso)
      .or("featured.eq.true,sponsorship_active.eq.true,city_sponsor.eq.true,mosque_sponsor.eq.true");

    if (fetchError) {
      return jsonResponse(
        {
          ok: false,
          error: fetchError.message,
        },
        500
      );
    }

    const businessIds = (expiredBusinesses ?? [])
      .map((business) => String(business.id ?? ""))
      .filter(Boolean);

    if (businessIds.length === 0) {
      return jsonResponse({
        ok: true,
        expired_businesses: 0,
        expired_campaign_requests: 0,
        message: "No expired campaigns found.",
      });
    }

    const { error: businessError } = await supabaseAdmin
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
      .in("id", businessIds);

    if (businessError) {
      return jsonResponse(
        {
          ok: false,
          error: businessError.message,
        },
        500
      );
    }

    const { error: campaignError } = await supabaseAdmin
      .from("advertising_campaign_requests")
      .update({
        status: "expired",
        updated_at: nowIso,
      })
      .in("business_id", businessIds)
      .neq("status", "expired");

    if (campaignError) {
      return jsonResponse(
        {
          ok: false,
          error: campaignError.message,
        },
        500
      );
    }

    return jsonResponse({
      ok: true,
      expired_businesses: businessIds.length,
      message: "Expired campaigns cleaned successfully.",
    });
  } catch (error) {
    console.error("admin campaigns cleanup route error:", error);

    return jsonResponse(
      {
        ok: false,
        error: "Could not clean expired campaigns.",
      },
      500
    );
  }
}