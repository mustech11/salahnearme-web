import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { supabaseServer } from "@/lib/supabaseServer";
import { getSiteUrl } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RequestBody = {
  business_id?: unknown;
};

type BusinessRow = {
  id: string;
  name: string | null;
  email: string | null;
  submitted_by_email: string | null;
  claimed_by_email: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
};

type BusinessClaimRow = {
  id: string;
  status: string | null;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status });
}

function cleanString(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function cleanEmail(value: unknown) {
  return cleanString(value).toLowerCase();
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function getStripeCustomerIdFromSubscription(
  subscription: Stripe.Response<Stripe.Subscription>
) {
  const customer = subscription.customer;

  if (typeof customer === "string") {
    return customer;
  }

  if (customer && typeof customer === "object" && "id" in customer) {
    return cleanString(customer.id);
  }

  return "";
}

async function userOwnsBusinessByClaim(userId: string, businessId: string) {
  const { data, error } = await supabaseAdmin
    .from("business_claims")
    .select("id,status")
    .eq("business_id", businessId)
    .eq("user_id", userId)
    .in("status", ["approved", "active", "verified"])
    .maybeSingle();

  if (error) {
    console.error("customer portal claim lookup error:", error);
    return false;
  }

  const claim = data as BusinessClaimRow | null;

  return Boolean(claim?.id);
}

async function userOwnsBusiness(
  userId: string,
  userEmail: string,
  business: BusinessRow
) {
  const email = cleanEmail(userEmail);

  if (!email) {
    return false;
  }

  const submittedByEmail = cleanEmail(business.submitted_by_email);
  const claimedByEmail = cleanEmail(business.claimed_by_email);
  const businessEmail = cleanEmail(business.email);

  if (
    submittedByEmail === email ||
    claimedByEmail === email ||
    businessEmail === email
  ) {
    return true;
  }

  return userOwnsBusinessByClaim(userId, business.id);
}

export async function POST(req: Request) {
  try {
    const supabase = await supabaseServer();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return jsonResponse(
        {
          ok: false,
          error: "You must be signed in to open the billing portal.",
        },
        401
      );
    }

    const body = (await req.json().catch(() => null)) as RequestBody | null;
    const businessId = cleanString(body?.business_id);

    if (!businessId || !isUuid(businessId)) {
      return jsonResponse(
        {
          ok: false,
          error: "Missing or invalid business_id.",
        },
        400
      );
    }

    const { data, error } = await supabaseAdmin
      .from("businesses")
      .select(
        "id,name,email,submitted_by_email,claimed_by_email,stripe_customer_id,stripe_subscription_id"
      )
      .eq("id", businessId)
      .maybeSingle();

    if (error) {
      console.error("customer portal business lookup error:", error);

      return jsonResponse(
        {
          ok: false,
          error: "Could not load business billing details.",
        },
        500
      );
    }

    const business = data as BusinessRow | null;

    if (!business) {
      return jsonResponse(
        {
          ok: false,
          error: "Business not found.",
        },
        404
      );
    }

    const ownsBusiness = await userOwnsBusiness(
      user.id,
      user.email ?? "",
      business
    );

    if (!ownsBusiness) {
      return jsonResponse(
        {
          ok: false,
          error: "You do not have permission to manage billing for this business.",
        },
        403
      );
    }

    let customerId = cleanString(business.stripe_customer_id);

    if (!customerId && business.stripe_subscription_id) {
      try {
        const subscription = await stripe.subscriptions.retrieve(
          business.stripe_subscription_id
        );

        customerId = getStripeCustomerIdFromSubscription(subscription);

        if (customerId) {
          const { error: updateCustomerError } = await supabaseAdmin
            .from("businesses")
            .update({
              stripe_customer_id: customerId,
              updated_at: new Date().toISOString(),
            })
            .eq("id", businessId);

          if (updateCustomerError) {
            console.error(
              "customer portal stripe_customer_id sync error:",
              updateCustomerError
            );
          }
        }
      } catch (stripeError) {
        console.error("customer portal subscription lookup error:", stripeError);
      }
    }

    if (!customerId) {
      return jsonResponse(
        {
          ok: false,
          error:
            "No Stripe customer was found for this business yet. Start or renew a subscription first.",
        },
        400
      );
    }

    const siteUrl = getSiteUrl();

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${siteUrl}/dashboard/business/billing`,
    });

    if (!session.url) {
      return jsonResponse(
        {
          ok: false,
          error: "Stripe did not return a billing portal URL.",
        },
        500
      );
    }

    return jsonResponse(
      {
        ok: true,
        url: session.url,
      },
      200
    );
  } catch (error) {
    console.error("customer portal route error:", error);

    return jsonResponse(
      {
        ok: false,
        error: "Could not create billing portal session.",
      },
      500
    );
  }
}