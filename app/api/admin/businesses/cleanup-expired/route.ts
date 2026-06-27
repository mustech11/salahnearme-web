import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ExpiredBusinessRow = {
  id: string;
  name: string | null;
  paid_until: string | null;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function GET() {
  return jsonResponse(
    {
      ok: false,
      error: "Method not allowed. Use POST.",
    },
    405
  );
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

    const { data: expiredBusinessesRaw, error: fetchError } =
      await supabaseAdmin
        .from("businesses")
        .select("id,name,paid_until")
        .not("paid_until", "is", null)
        .lt("paid_until", nowIso)
        .or(
          "featured.eq.true,sponsorship_active.eq.true,city_sponsor.eq.true,mosque_sponsor.eq.true"
        );

    if (fetchError) {
      return jsonResponse(
        {
          ok: false,
          error: fetchError.message,
        },
        500
      );
    }

    const expiredBusinesses = (expiredBusinessesRaw ??
      []) as ExpiredBusinessRow[];

    const businessIds = expiredBusinesses
      .map((business) => business.id)
      .filter(Boolean);

    if (businessIds.length === 0) {
      return jsonResponse({
        ok: true,
        expired_businesses: 0,
        expired_campaign_requests: 0,
        businesses: [],
        message: "No expired campaigns found.",
      });
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

        paid_until: null,
        updated_at: nowIso,
      })
      .in("id", businessIds);

    if (updateBusinessesError) {
      return jsonResponse(
        {
          ok: false,
          error: updateBusinessesError.message,
        },
        500
      );
    }

    const { data: expiredCampaignRequestsRaw, error: campaignError } =
      await supabaseAdmin
        .from("advertising_campaign_requests")
        .update({
          status: "expired",
          updated_at: nowIso,
        })
        .in("business_id", businessIds)
        .neq("status", "expired")
        .select("id,business_id,status");

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
      expired_campaign_requests: expiredCampaignRequestsRaw?.length ?? 0,
      businesses: expiredBusinesses.map((business) => ({
        id: business.id,
        name: business.name,
        paid_until: business.paid_until,
      })),
      message: "Expired campaigns cleaned successfully.",
    });
  } catch (error) {
    console.error("admin cleanup expired campaigns error:", error);

    return jsonResponse(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not clean expired campaigns.",
      },
      500
    );
  }
}