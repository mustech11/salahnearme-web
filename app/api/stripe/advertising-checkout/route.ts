import { NextResponse } from "next/server";

import { getSiteUrl } from "@/lib/env";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdvertisingType =
  | "city_featured"
  | "mosque_sponsor"
  | "multi_mosque"
  | "multi_city";

type RequestBody = {
  advertising_type?: unknown;
  business_id?: unknown;
};

type BusinessRow = {
  id: string;
  name: string | null;
  slug: string | null;
  city: string | null;
  pricing_tier: string | null;
  subscription_type: string | null;
  featured: boolean | null;
  paid_until: string | null;
  stripe_customer_id: string | null;
  submitted_by_email: string | null;
  claimed_by_email: string | null;
  email: string | null;
};

const ADVERTISING_TYPES = [
  "city_featured",
  "mosque_sponsor",
  "multi_mosque",
  "multi_city",
] as const;

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

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function nullableString(value: unknown): string | null {
  const cleaned = cleanString(value);

  return cleaned ? cleaned : null;
}

function nullableBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function isUuid(value: string) {
  return UUID_REGEX.test(value);
}

function isAdvertisingType(value: string): value is AdvertisingType {
  return (ADVERTISING_TYPES as readonly string[]).includes(value);
}

function getStripePriceId(advertisingType: AdvertisingType) {
  const priceMap: Record<Exclude<AdvertisingType, "multi_city">, string> = {
    city_featured: process.env.STRIPE_PRICE_CITY_FEATURED ?? "",
    mosque_sponsor: process.env.STRIPE_PRICE_MOSQUE_SPONSOR ?? "",
    multi_mosque: process.env.STRIPE_PRICE_MULTI_MOSQUE ?? "",
  };

  if (advertisingType === "multi_city") {
    return "";
  }

  return priceMap[advertisingType].trim();
}

function getMissingPriceHint(advertisingType: AdvertisingType) {
  if (advertisingType === "city_featured") {
    return "Add STRIPE_PRICE_CITY_FEATURED to Vercel and .env.local.";
  }

  if (advertisingType === "mosque_sponsor") {
    return "Add STRIPE_PRICE_MOSQUE_SPONSOR to Vercel and .env.local.";
  }

  if (advertisingType === "multi_mosque") {
    return "Add STRIPE_PRICE_MULTI_MOSQUE to Vercel and .env.local.";
  }

  return "Multi-city campaigns are custom and should be configured manually.";
}

function getPackageLabel(advertisingType: AdvertisingType) {
  const labels: Record<AdvertisingType, string> = {
    city_featured: "Featured City Listing",
    mosque_sponsor: "Sponsor a Mosque",
    multi_mosque: "Multiple Mosque Sponsorship",
    multi_city: "Multi-City Campaign",
  };

  return labels[advertisingType];
}

function getBusinessEmail(business: BusinessRow) {
  return (
    business.email ??
    business.claimed_by_email ??
    business.submitted_by_email ??
    undefined
  );
}

function normaliseBusinessRow(row: unknown): BusinessRow | null {
  if (!row || typeof row !== "object") {
    return null;
  }

  const value = row as Record<string, unknown>;
  const id = cleanString(value.id);

  if (!isUuid(id)) {
    return null;
  }

  return {
    id,
    name: nullableString(value.name),
    slug: nullableString(value.slug),
    city: nullableString(value.city),
    pricing_tier: nullableString(value.pricing_tier),
    subscription_type: nullableString(value.subscription_type),
    featured: nullableBoolean(value.featured),
    paid_until: nullableString(value.paid_until),
    stripe_customer_id: nullableString(value.stripe_customer_id),
    submitted_by_email: nullableString(value.submitted_by_email),
    claimed_by_email: nullableString(value.claimed_by_email),
    email: nullableString(value.email),
  };
}

export async function GET() {
  return jsonResponse({
    ok: true,
    route: "/api/stripe/advertising-checkout",
    method: "POST",
    required_body: {
      advertising_type: ADVERTISING_TYPES,
      business_id: "valid business UUID",
    },
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as RequestBody | null;

    if (!body) {
      return jsonResponse(
        {
          ok: false,
          error: "Missing request body.",
        },
        400
      );
    }

    const advertisingTypeRaw = cleanString(body.advertising_type);
    const businessId = cleanString(body.business_id);

    if (!advertisingTypeRaw || !isAdvertisingType(advertisingTypeRaw)) {
      return jsonResponse(
        {
          ok: false,
          error: "Missing or invalid advertising type.",
          allowed: ADVERTISING_TYPES,
        },
        400
      );
    }

    const advertisingType = advertisingTypeRaw;

    if (advertisingType === "multi_city") {
      return jsonResponse(
        {
          ok: false,
          error:
            "Multi-city campaigns are custom. Please configure this campaign first.",
        },
        400
      );
    }

    if (!businessId || !isUuid(businessId)) {
      return jsonResponse(
        {
          ok: false,
          error: "A valid business must be selected before payment.",
        },
        400
      );
    }

    const priceId = getStripePriceId(advertisingType);

    if (!priceId) {
      return jsonResponse(
        {
          ok: false,
          error: `Missing Stripe price ID for ${advertisingType}.`,
          env_hint: getMissingPriceHint(advertisingType),
        },
        500
      );
    }

    const { data: businessRow, error: businessError } = await supabaseAdmin
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
          "stripe_customer_id",
          "submitted_by_email",
          "claimed_by_email",
          "email",
        ].join(",")
      )
      .eq("id", businessId)
      .maybeSingle();

    if (businessError) {
      console.error(
        "advertising checkout business lookup error:",
        businessError
      );

      return jsonResponse(
        {
          ok: false,
          error: businessError.message,
        },
        500
      );
    }

    const business = normaliseBusinessRow(businessRow);

    if (!business) {
      return jsonResponse(
        {
          ok: false,
          error: "Business not found.",
        },
        404
      );
    }

    const siteUrl = getSiteUrl();
    const packageLabel = getPackageLabel(advertisingType);
    const customerEmail = getBusinessEmail(business);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: business.stripe_customer_id ?? undefined,
      customer_email: business.stripe_customer_id ? undefined : customerEmail,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${siteUrl}/payment/success?type=advertising&advertising=${advertisingType}&business=${business.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/advertise/confirm?advertising=${advertisingType}&business=${business.id}`,
      metadata: {
        source: "advertising_checkout",
        advertising_type: advertisingType,
        package_label: packageLabel,
        business_id: business.id,
        business_name: business.name ?? "",
        business_slug: business.slug ?? "",
        business_city: business.city ?? "",
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
    console.error("advertising checkout route error:", error);

    return jsonResponse(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not start advertising checkout.",
      },
      500
    );
  }
}