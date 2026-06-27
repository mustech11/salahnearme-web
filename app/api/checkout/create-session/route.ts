import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";

type PricingTier = "bronze" | "silver" | "gold" | "platinum";

type Body = {
  campaign_id?: string;
  business_id?: string;
  pricing_tier?: PricingTier;
  duration_days?: number;
  advertising_type?: string;
  sponsor_mosque_id?: string | null;
};

function getTierPrice(tier: PricingTier, durationDays: number) {
  const monthly: Record<PricingTier, number> = {
    bronze: 19,
    silver: 49,
    gold: 99,
    platinum: 199,
  };

  const months = Math.max(1, Math.ceil(durationDays / 30));
  return monthly[tier] * months;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    const campaignId = body.campaign_id?.trim();
    const businessId = body.business_id?.trim();
    const pricingTier = body.pricing_tier;
    const durationDays = Number(body.duration_days ?? 30);

    if (!campaignId || !businessId || !pricingTier) {
      return NextResponse.json(
        { error: "Missing required checkout fields" },
        { status: 400 }
      );
    }

    const amount = getTierPrice(pricingTier, durationDays);

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

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
              name: `SalahNearMe Mosque Sponsorship (${pricingTier})`,
            },
            unit_amount: amount * 100,
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
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Checkout create-session error:", error);
    return NextResponse.json(
      { error: "Could not create checkout session" },
      { status: 500 }
    );
  }
}

