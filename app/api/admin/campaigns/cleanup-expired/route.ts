import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type ExpiredBusinessRow = {
  id: string;
  name: string | null;
  paid_until: string | null;
};

type UpdatedCampaignRow = {
  id: string;
  business_id: string | null;
  status: string | null;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_BUSINESSES_PER_RUN = 1_000;

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
      Allow: "POST",
    },
  });
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    UUID_REGEX.test(value)
  );
}

export async function GET() {
  return jsonResponse(
    {
      ok: false,
      error:
        "Method not allowed. Use POST.",
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

    const nowIso =
      new Date().toISOString();

    const {
      data: expiredBusinessesRaw,
      error: fetchError,
    } = await supabaseAdmin
      .from("businesses")
      .select("id,name,paid_until")
      .not("paid_until", "is", null)
      .lt("paid_until", nowIso)
      .or(
        "featured.eq.true,sponsorship_active.eq.true,city_sponsor.eq.true,mosque_sponsor.eq.true"
      )
      .order("paid_until", {
        ascending: true,
      })
      .limit(MAX_BUSINESSES_PER_RUN);

    if (fetchError) {
      console.error(
        "Expired-business cleanup lookup failed:",
        {
          code: fetchError.code,
          message: fetchError.message,
        }
      );

      return jsonResponse(
        {
          ok: false,
          error:
            "Could not load expired businesses.",
        },
        500
      );
    }

    const expiredBusinesses =
      (expiredBusinessesRaw ??
        []) as ExpiredBusinessRow[];

    const businessIds = Array.from(
      new Set(
        expiredBusinesses
          .map((business) => business.id)
          .filter(isUuid)
      )
    );

    if (businessIds.length === 0) {
      return jsonResponse({
        ok: true,
        expired_businesses: 0,
        expired_campaign_requests: 0,
        businesses: [],
        truncated: false,
        message:
          "No expired campaigns found.",
      });
    }

    const {
      data: updatedBusinesses,
      error: updateBusinessesError,
    } = await supabaseAdmin
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
      .in("id", businessIds)
      .select("id,name,paid_until");

    if (updateBusinessesError) {
      console.error(
        "Expired-business cleanup update failed:",
        {
          count: businessIds.length,
          code: updateBusinessesError.code,
          message: updateBusinessesError.message,
        }
      );

      return jsonResponse(
        {
          ok: false,
          error:
            "Could not reset expired businesses.",
        },
        500
      );
    }

    const {
      data: expiredCampaignRequestsRaw,
      error: campaignError,
    } = await supabaseAdmin
      .from("advertising_campaign_requests")
      .update({
        status: "expired",
        updated_at: nowIso,
      })
      .in("business_id", businessIds)
      .neq("status", "expired")
      .select("id,business_id,status");

    if (campaignError) {
      console.error(
        "Expired campaign-request cleanup failed:",
        {
          count: businessIds.length,
          code: campaignError.code,
          message: campaignError.message,
        }
      );

      return jsonResponse(
        {
          ok: false,
          error:
            "Businesses were reset, but campaign requests could not be marked as expired.",
          businesses_reset:
            updatedBusinesses?.length ?? 0,
        },
        500
      );
    }

    const campaignRows =
      (expiredCampaignRequestsRaw ??
        []) as UpdatedCampaignRow[];

    return jsonResponse({
      ok: true,
      expired_businesses:
        updatedBusinesses?.length ?? 0,
      expired_campaign_requests:
        campaignRows.length,
      businesses:
        expiredBusinesses.map(
          (business) => ({
            id: business.id,
            name: business.name,
            paid_until:
              business.paid_until,
          })
        ),
      truncated:
        expiredBusinesses.length >=
        MAX_BUSINESSES_PER_RUN,
      cleaned_at: nowIso,
      message:
        "Expired campaigns cleaned successfully.",
    });
  } catch (error) {
    console.error(
      "Admin campaign cleanup route failed:",
      error
    );

    return jsonResponse(
      {
        ok: false,
        error:
          "Could not clean expired campaigns.",
      },
      500
    );
  }
}