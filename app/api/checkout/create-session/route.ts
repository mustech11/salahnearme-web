import { NextResponse } from "next/server";

import { getSiteUrl } from "@/lib/env";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PricingTier = "bronze" | "silver" | "gold" | "platinum";

type Body = {
  campaign_id?: unknown;
  business_id?: unknown;
  pricing_tier?: unknown;
  duration_days?: unknown;
  advertising_type?: unknown;
  sponsor_mosque_id?: unknown;
};

const PRICING_TIERS = ["bronze", "silver", "gold", "platinum"] as const;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function cleanString(value: unknown, maxLength = 300) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function nullableString(value: unknown, maxLength = 300) {
  const cleaned = cleanString(value, maxLength);

  return cleaned ? cleaned : null;
}

function isPricingTier(value: string): value is PricingTier {
  return (PRICING_TIERS as readonly string[]).includes(value);
}

function isUuid(value: string) {
  return UUID_REGEX.test(value);
}

function normaliseDurationDays(value: unknown) {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.trim())
        : 30;

  if (!Number.isFinite(numeric)) {
    return 30;
  }

  return Math.min(365, Math.max(30, Math.round(numeric)));
}

function getTierMonthlyPricePence(tier: PricingTier) {
  const monthly: Record<PricingTier, number> = {
    bronze: 1900,
    silver: 4900,
    gold: 9900,
    platinum: 19900,
  };

  return monthly[tier];
}

function getTierLabel(tier: PricingTier) {
  const labels: Record<PricingTier, string> = {
    bronze: "Bronze",
    silver: "Silver",
    gold: "Gold",
    platinum: "Platinum",
  };

  return labels[tier];
}

export async function GET() {
  return jsonResponse({
    ok: true,
    route: "/api/checkout/create-session",
    method: "POST",
    required_body: {
      campaign_id: "required",
      business_id: "required UUID",
      pricing_tier: PRICING_TIERS,
      duration_days: "optional number, minimum 30, maximum 365",
      advertising_type: "optional",
      sponsor_mosque_id: "optional UUID",
    },
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as Body | null;

    if (!body) {
      return jsonResponse(
        {
          ok: false,
          error: "Missing request body.",
        },
        400
      );
    }

    const campaignId = cleanString(body.campaign_id, 120);
    const businessId = cleanString(body.business_id, 120);
    const pricingTierRaw = cleanString(body.pricing_tier, 40);
    const durationDays = normaliseDurationDays(body.duration_days);
    const advertisingType =
      nullableString(body.advertising_type, 80) ?? "mosque_sponsor";
    const sponsorMosqueId = nullableString(body.sponsor_mosque_id, 120);

    if (!campaignId) {
      return jsonResponse(
        {
          ok: false,
          error: "Missing campaign_id.",
        },
        400
      );
    }

    if (!businessId || !isUuid(businessId)) {
      return jsonResponse(
        {
          ok: false,
          error: "Missing or invalid business_id.",
        },
        400
      );
    }

    if (!pricingTierRaw || !isPricingTier(pricingTierRaw)) {
      return jsonResponse(
        {
          ok: false,
          error: "Missing or invalid pricing_tier.",
          allowed: PRICING_TIERS,
        },
        400
      );
    }

    if (sponsorMosqueId && !isUuid(sponsorMosqueId)) {
      return jsonResponse(
        {
          ok: false,
          error: "Invalid sponsor_mosque_id.",
        },
        400
      );
    }

    const siteUrl = getSiteUrl();
    const tierLabel = getTierLabel(pricingTierRaw);
    const monthlyAmountPence = getTierMonthlyPricePence(pricingTierRaw);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "gbp",
            recurring: {
              interval: "month",
            },
            product_data: {
              name: `SalahNearMe ${tierLabel} Sponsorship`,
              description: `${tierLabel} advertising placement for SalahNearMe.`,
            },
            unit_amount: monthlyAmountPence,
          },
          quantity: 1,
        },
      ],
      success_url: `${siteUrl}/payment/success?type=sponsorship&campaign_id=${encodeURIComponent(
        campaignId
      )}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/payment/cancel?campaign_id=${encodeURIComponent(
        campaignId
      )}`,
      metadata: {
        source: "checkout_create_session",
        campaign_id: campaignId,
        business_id: businessId,
        pricing_tier: pricingTierRaw,
        duration_days: String(durationDays),
        advertising_type: advertisingType,
        sponsor_mosque_id: sponsorMosqueId ?? "",
      },
    });

    if (!session.url) {
      return jsonResponse(
        {
          ok: false,
          error: "Stripe checkout URL was not returned.",
        },
        500
      );
    }

    return jsonResponse({
      ok: true,
      url: session.url,
      session_id: session.id,
    });
  } catch (error) {
    console.error("checkout create-session route error:", error);

    return jsonResponse(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not create checkout session.",
      },
      500
    );
  }
}