import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

type PricingTier = "bronze" | "silver" | "gold" | "platinum";
type AdvertisingType =
  | "mosque_sponsor"
  | "city_featured"
  | "multi_mosque"
  | "multi_city";

type Body = {
  campaign_id: string;
  business_id: string;
  pricing_tier: PricingTier;
  duration_days: number;
  advertising_type?: AdvertisingType;
  sponsor_mosque_id?: string | null;
  selected_mosque_ids?: string[];
  selected_city_ids?: number[];
  featured_rank?: number | null;
};

function getPriceAmount(
  tier: PricingTier,
  durationDays: number,
  advertisingType?: AdvertisingType,
  quantity = 1
): number {
  const baseMonthly: Record<PricingTier, number> = {
    bronze: 1900,
    silver: 4900,
    gold: 9900,
    platinum: 19900,
  };

  const base = baseMonthly[tier];
  const months = Math.max(1, Math.ceil(durationDays / 30));

  let multiplier = 1;

  if (advertisingType === "city_featured") {
    multiplier = 1.2;
  } else if (advertisingType === "multi_mosque") {
    multiplier = quantity;
  } else if (advertisingType === "multi_city") {
    multiplier = quantity * 1.5;
  }

  return Math.round(base * months * multiplier);
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    const campaignId = cleanString(body.campaign_id);
    const businessId = cleanString(body.business_id);
    const pricingTier = body.pricing_tier;
    const durationDays =
      Number.isFinite(body.duration_days) && body.duration_days > 0
        ? body.duration_days
        : 30;

    if (!campaignId || !businessId || !pricingTier) {
      return NextResponse.json(
        { error: "Missing required checkout fields" },
        { status: 400 }
      );
    }

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL;

    if (!siteUrl) {
      return NextResponse.json(
        { error: "Missing NEXT_PUBLIC_SITE_URL or NEXT_PUBLIC_APP_URL" },
        { status: 500 }
      );
    }

    const quantity =
      body.selected_mosque_ids?.length ||
      body.selected_city_ids?.length ||
      1;

    const amount = getPriceAmount(
      pricingTier,
      durationDays,
      body.advertising_type,
      quantity
    );

    const productName =
      body.advertising_type === "city_featured"
        ? `SalahNearMe City Featured (${pricingTier})`
        : body.advertising_type === "multi_mosque"
        ? `SalahNearMe Multi-Mosque Campaign (${pricingTier})`
        : body.advertising_type === "multi_city"
        ? `SalahNearMe Multi-City Campaign (${pricingTier})`
        : `SalahNearMe Mosque Sponsorship (${pricingTier})`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: {
              name: productName,
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      success_url: `${siteUrl}/payment/success?campaign_id=${campaignId}`,
      cancel_url: `${siteUrl}/payment/cancel`,
      metadata: {
        campaign_id: campaignId,
        business_id: businessId,
        pricing_tier: pricingTier,
        duration_days: String(durationDays),
        advertising_type: body.advertising_type ?? "mosque_sponsor",
        sponsor_mosque_id: body.sponsor_mosque_id ?? "",
        featured_rank:
          typeof body.featured_rank === "number"
            ? String(body.featured_rank)
            : "",
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout failed:", err);
    return NextResponse.json(
      { error: "Stripe checkout failed" },
      { status: 500 }
    );
  }
}

