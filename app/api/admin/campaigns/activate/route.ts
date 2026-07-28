import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const PRICING_TIERS = [
  "bronze",
  "silver",
  "gold",
  "platinum",
  "featured",
  "mosque_sponsor",
  "city_sponsor",
] as const;

type PricingTier =
  (typeof PRICING_TIERS)[number];

type ActivateBody = {
  campaign_id?: unknown;
  business_id?: unknown;
  pricing_tier?: unknown;
  featured_rank?: unknown;
  sponsor_mosque_id?: unknown;
  sponsor_city_id?: unknown;
  duration_days?: unknown;
};

type CampaignRow = {
  id: string;
  business_id: string | null;
  status: string | null;
  payment_status: string | null;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_REQUEST_BODY_BYTES = 16_000;
const DEFAULT_DURATION_DAYS = 30;
const MAX_DURATION_DAYS = 366;
const MAX_FEATURED_RANK = 9_999;

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
): value is Record<
  string,
  unknown
> {
  return Boolean(
    value &&
      typeof value ===
        "object" &&
      !Array.isArray(value)
  );
}

function isPricingTier(
  value: unknown
): value is PricingTier {
  return (
    typeof value ===
      "string" &&
    PRICING_TIERS.includes(
      value as PricingTier
    )
  );
}

function cleanPositiveInteger(
  value: unknown,
  maximum: number
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const parsed = Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed < 1 ||
    parsed > maximum
  ) {
    return null;
  }

  return parsed;
}

function addDays(
  days: number
): string {
  const date = new Date();

  date.setUTCDate(
    date.getUTCDate() + days
  );

  date.setUTCHours(
    23,
    59,
    59,
    999
  );

  return date.toISOString();
}

async function readBody(
  request: Request
): Promise<ActivateBody | null> {
  const contentType =
    request.headers
      .get("content-type")
      ?.toLowerCase() ?? "";

  if (
    !contentType.includes(
      "application/json"
    )
  ) {
    return null;
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
    return null;
  }

  try {
    const value: unknown =
      await request.json();

    return isPlainObject(value)
      ? (value as ActivateBody)
      : null;
  } catch {
    return null;
  }
}

export async function POST(
  request: Request
) {
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

  try {
    const body =
      await readBody(request);

    if (!body) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Invalid JSON body or Content-Type.",
        },
        400
      );
    }

    const campaignId =
      cleanString(
        body.campaign_id,
        80
      );

    const businessId =
      cleanString(
        body.business_id,
        80
      );

    const pricingTier =
      cleanString(
        body.pricing_tier,
        80
      );

    const sponsorMosqueId =
      body.sponsor_mosque_id ===
        null
        ? null
        : cleanString(
            body.sponsor_mosque_id,
            80
          );

    const featuredRank =
      cleanPositiveInteger(
        body.featured_rank,
        MAX_FEATURED_RANK
      );

    const sponsorCityId =
      cleanPositiveInteger(
        body.sponsor_city_id,
        Number.MAX_SAFE_INTEGER
      );

    const durationDays =
      body.duration_days ===
        null ||
      body.duration_days ===
        undefined
        ? DEFAULT_DURATION_DAYS
        : cleanPositiveInteger(
            body.duration_days,
            MAX_DURATION_DAYS
          );

    if (
      !isUuid(campaignId) ||
      !isUuid(businessId) ||
      !isPricingTier(
        pricingTier
      )
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Missing or invalid activation fields.",
          allowed_pricing_tiers:
            PRICING_TIERS,
        },
        400
      );
    }

    if (
      body.duration_days !==
        null &&
      body.duration_days !==
        undefined &&
      durationDays === null
    ) {
      return jsonResponse(
        {
          ok: false,
          error: `duration_days must be an integer from 1 to ${MAX_DURATION_DAYS}.`,
        },
        400
      );
    }

    if (
      body.featured_rank !==
        null &&
      body.featured_rank !==
        undefined &&
      featuredRank === null
    ) {
      return jsonResponse(
        {
          ok: false,
          error: `featured_rank must be an integer from 1 to ${MAX_FEATURED_RANK}.`,
        },
        400
      );
    }

    if (
      body.sponsor_city_id !==
        null &&
      body.sponsor_city_id !==
        undefined &&
      sponsorCityId === null
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            "sponsor_city_id must be a positive integer or null.",
        },
        400
      );
    }

    if (
      sponsorMosqueId !==
        null &&
      !isUuid(sponsorMosqueId)
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            "sponsor_mosque_id must be a valid UUID or null.",
        },
        400
      );
    }

    if (
      pricingTier ===
        "mosque_sponsor" &&
      !sponsorMosqueId
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            "A mosque sponsor campaign requires sponsor_mosque_id.",
        },
        400
      );
    }

    if (
      pricingTier ===
        "city_sponsor" &&
      sponsorCityId === null
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            "A city sponsor campaign requires sponsor_city_id.",
        },
        400
      );
    }

    const {
      data: campaignRaw,
      error: campaignLookupError,
    } = await supabaseAdmin
      .from(
        "advertising_campaign_requests"
      )
      .select(
        "id,business_id,status,payment_status"
      )
      .eq("id", campaignId)
      .maybeSingle();

    if (campaignLookupError) {
      console.error(
        "Campaign activation lookup failed:",
        {
          campaignId,
          code:
            campaignLookupError.code,
          message:
            campaignLookupError.message,
        }
      );

      return jsonResponse(
        {
          ok: false,
          error:
            "Could not load the campaign.",
        },
        500
      );
    }

    if (!campaignRaw) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Campaign not found.",
        },
        404
      );
    }

    const campaign =
      campaignRaw as unknown as CampaignRow;

    if (
      campaign.status ===
        "active"
    ) {
      return jsonResponse({
        ok: true,
        already_active: true,
        campaign_id:
          campaignId,
        business_id:
          campaign.business_id ??
          businessId,
        message:
          "Campaign is already active.",
      });
    }

    if (
      campaign.business_id &&
      campaign.business_id !==
        businessId
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Campaign is linked to a different business.",
        },
        409
      );
    }

    const {
      data: business,
      error: businessLookupError,
    } = await supabaseAdmin
      .from("businesses")
      .select("id")
      .eq("id", businessId)
      .maybeSingle();

    if (businessLookupError) {
      console.error(
        "Campaign activation business lookup failed:",
        {
          campaignId,
          businessId,
          code:
            businessLookupError.code,
          message:
            businessLookupError.message,
        }
      );

      return jsonResponse(
        {
          ok: false,
          error:
            "Could not verify the business.",
        },
        500
      );
    }

    if (!business) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Business not found.",
        },
        404
      );
    }

    const effectiveDuration =
      durationDays ??
      DEFAULT_DURATION_DAYS;

    const paidUntil =
      addDays(
        effectiveDuration
      );

    const activatedAt =
      new Date().toISOString();

    const isMosqueSponsor =
      pricingTier ===
      "mosque_sponsor";

    const isCitySponsor =
      pricingTier ===
      "city_sponsor";

    const businessUpdate: Record<
      string,
      unknown
    > = {
      featured: true,
      featured_rank:
        featuredRank,
      pricing_tier:
        pricingTier,
      subscription_type:
        pricingTier,
      paid_until: paidUntil,
      can_advertise: true,
      status: "approved",
      review_status:
        "approved",
      is_live: true,
      sponsorship_active:
        isMosqueSponsor ||
        isCitySponsor,
      mosque_sponsor:
        isMosqueSponsor,
      city_sponsor:
        isCitySponsor,
      sponsor_mosque_id:
        isMosqueSponsor
          ? sponsorMosqueId
          : null,
      sponsor_city_id:
        isCitySponsor
          ? sponsorCityId
          : null,
      updated_at: activatedAt,
    };

    const {
      data: updatedBusiness,
      error: businessError,
    } = await supabaseAdmin
      .from("businesses")
      .update(businessUpdate)
      .eq("id", businessId)
      .select(
        "id,pricing_tier,paid_until,featured,sponsorship_active"
      )
      .maybeSingle();

    if (businessError) {
      console.error(
        "Campaign activation business update failed:",
        {
          campaignId,
          businessId,
          code:
            businessError.code,
          message:
            businessError.message,
        }
      );

      return jsonResponse(
        {
          ok: false,
          error:
            "Could not activate the campaign for the business.",
        },
        500
      );
    }

    if (!updatedBusiness) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Business not found during activation.",
        },
        404
      );
    }

    const {
      data: updatedCampaign,
      error: campaignError,
    } = await supabaseAdmin
      .from(
        "advertising_campaign_requests"
      )
      .update({
        status: "active",
        payment_status:
          "paid",
        activated_at:
          activatedAt,
        paid_until:
          paidUntil,
        business_id:
          businessId,
        selected_mosque_id:
          isMosqueSponsor
            ? sponsorMosqueId
            : null,
        selected_city_id:
          isCitySponsor
            ? sponsorCityId
            : null,
        updated_at:
          activatedAt,
      })
      .eq("id", campaignId)
      .neq("status", "active")
      .select(
        "id,business_id,status,payment_status,paid_until"
      )
      .maybeSingle();

    if (campaignError) {
      console.error(
        "Campaign activation status update failed:",
        {
          campaignId,
          businessId,
          code:
            campaignError.code,
          message:
            campaignError.message,
        }
      );

      return jsonResponse(
        {
          ok: false,
          error:
            "The business was activated, but the campaign record could not be updated.",
          business_activated:
            true,
          business_id:
            businessId,
          paid_until:
            paidUntil,
        },
        500
      );
    }

    if (!updatedCampaign) {
      return jsonResponse(
        {
          ok: false,
          error:
            "The business was activated, but the campaign changed during activation.",
          business_activated:
            true,
          business_id:
            businessId,
          paid_until:
            paidUntil,
        },
        409
      );
    }

    return jsonResponse({
      ok: true,
      message:
        "Campaign activated successfully.",
      campaign_id:
        campaignId,
      business_id:
        businessId,
      pricing_tier:
        pricingTier,
      duration_days:
        effectiveDuration,
      paid_until:
        paidUntil,
      campaign:
        updatedCampaign,
      business:
        updatedBusiness,
    });
  } catch (error) {
    console.error(
      "Campaign activation route failed:",
      error
    );

    return jsonResponse(
      {
        ok: false,
        error:
          "Could not activate campaign.",
      },
      500
    );
  }
}