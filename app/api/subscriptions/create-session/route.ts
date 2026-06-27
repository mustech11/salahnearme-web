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
  advertising_type: AdvertisingType;
  sponsor_mosque_id?: string | null;
  customer_email?: string | null;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getPriceLookupKey(
  tier: PricingTier,
  advertisingType: AdvertisingType
) {
  return `${advertisingType}_${tier}_monthly`;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    const campaignId = clean(body.campaign_id);
    const businessId = clean(body.business_id);
    const pricingTier = body.pricing_tier;
    const advertisingType = body.advertising_type;
    const sponsorMosqueId = clean(body.sponsor_mosque_id);
    const customerEmail = clean(body.customer_email);

    if (!campaignId || !businessId || !pricingTier || !advertisingType) {
      return NextResponse.json(
        { error: "Missing required subscription fields" },
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

    const lookupKey = getPriceLookupKey(pricingTier, advertisingType);

    const prices = await stripe.prices.list({
      lookup_keys: [lookupKey],
      expand: ["data.product"],
      active: true,
      limit: 1,
    });

    const price = prices.data[0];

    if (!price) {
      return NextResponse.json(
        { error: `Stripe price not found for lookup key: ${lookupKey}` },
        { status: 400 }
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: customerEmail || undefined,
      line_items: [
        {
          price: price.id,
          quantity: 1,
        },
      ],
      success_url: `${siteUrl}/payment/success?campaign_id=${campaignId}`,
      cancel_url: `${siteUrl}/payment/cancel`,
      metadata: {
        campaign_id: campaignId,
        business_id: businessId,
        pricing_tier: pricingTier,
        advertising_type: advertisingType,
        sponsor_mosque_id: sponsorMosqueId || "",
      },
      subscription_data: {
        metadata: {
          campaign_id: campaignId,
          business_id: businessId,
          pricing_tier: pricingTier,
          advertising_type: advertisingType,
          sponsor_mosque_id: sponsorMosqueId || "",
        },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Create subscription session error:", error);
    return NextResponse.json(
      { error: "Could not create subscription session" },
      { status: 500 }
    );
  }
}

