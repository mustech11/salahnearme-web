import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";

import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdvertisingType =
  | "city_featured"
  | "mosque_sponsor"
  | "multi_mosque"
  | "multi_city";

type SubscriptionPlan =
  | "featured"
  | "city_featured"
  | "mosque_sponsor"
  | "multi_mosque"
  | "city_sponsor"
  | "multi_city"
  | "bronze"
  | "silver"
  | "gold"
  | "platinum";

type StripeMetadata = Stripe.Metadata | Record<string, string | undefined>;

const ADVERTISING_TYPES = [
  "city_featured",
  "mosque_sponsor",
  "multi_mosque",
  "multi_city",
] as const;

const SUBSCRIPTION_PLANS = [
  "featured",
  "city_featured",
  "mosque_sponsor",
  "multi_mosque",
  "city_sponsor",
  "multi_city",
  "bronze",
  "silver",
  "gold",
  "platinum",
] as const;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function textResponse(message: string, status = 200) {
  return new NextResponse(message, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value);
}

function isAdvertisingType(value: unknown): value is AdvertisingType {
  return (
    typeof value === "string" &&
    (ADVERTISING_TYPES as readonly string[]).includes(value)
  );
}

function isSubscriptionPlan(value: unknown): value is SubscriptionPlan {
  return (
    typeof value === "string" &&
    (SUBSCRIPTION_PLANS as readonly string[]).includes(value)
  );
}

function getMetadataValue(metadata: StripeMetadata | null | undefined, key: string) {
  if (!metadata) {
    return "";
  }

  return clean(metadata[key]);
}

function getCustomerId(customer: unknown) {
  if (typeof customer === "string") {
    return customer;
  }

  if (
    customer &&
    typeof customer === "object" &&
    "id" in customer &&
    typeof customer.id === "string"
  ) {
    return customer.id;
  }

  return null;
}

function getSubscriptionId(subscription: unknown) {
  if (typeof subscription === "string") {
    return subscription;
  }

  if (
    subscription &&
    typeof subscription === "object" &&
    "id" in subscription &&
    typeof subscription.id === "string"
  ) {
    return subscription.id;
  }

  return null;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function extendPaidUntil(currentPaidUntil: string | null, days = 30) {
  const now = new Date();
  const current = currentPaidUntil ? new Date(currentPaidUntil) : null;

  const start =
    current && !Number.isNaN(current.getTime()) && current > now ? current : now;

  return addDays(start, days).toISOString();
}

function getSubscriptionPeriod(subscription: Stripe.Subscription) {
  const firstItem = subscription.items.data[0] as Stripe.SubscriptionItem & {
    current_period_start?: number | null;
    current_period_end?: number | null;
  };

  const startTimestamp =
    firstItem?.current_period_start ??
    (subscription as unknown as { current_period_start?: number | null })
      .current_period_start ??
    null;

  const endTimestamp =
    firstItem?.current_period_end ??
    (subscription as unknown as { current_period_end?: number | null })
      .current_period_end ??
    null;

  return {
    currentPeriodStart: startTimestamp
      ? new Date(startTimestamp * 1000).toISOString()
      : null,
    currentPeriodEnd: endTimestamp
      ? new Date(endTimestamp * 1000).toISOString()
      : null,
  };
}

function getAdvertisingBusinessUpdate(args: {
  advertisingType: AdvertisingType;
  paidUntil: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}) {
  const base = {
    paid_until: args.paidUntil,
    stripe_customer_id: args.stripeCustomerId,
    stripe_subscription_id: args.stripeSubscriptionId,
    subscription_status: "active",
    subscription_type: "advertising",
    is_live: true,
    updated_at: new Date().toISOString(),
  };

  if (args.advertisingType === "city_featured") {
    return {
      ...base,
      featured: true,
      featured_rank: 1,
      pricing_tier: "featured",
      sponsorship_active: false,
      city_sponsor: true,
      mosque_sponsor: false,
    };
  }

  if (
    args.advertisingType === "mosque_sponsor" ||
    args.advertisingType === "multi_mosque"
  ) {
    return {
      ...base,
      featured: true,
      featured_rank: 1,
      pricing_tier: "sponsored",
      sponsorship_active: true,
      city_sponsor: false,
      mosque_sponsor: true,
    };
  }

  return {
    ...base,
    featured: true,
    featured_rank: 1,
    pricing_tier: "custom",
    sponsorship_active: true,
    city_sponsor: true,
    mosque_sponsor: true,
  };
}

function getSubscriptionBusinessUpdate(args: {
  plan: SubscriptionPlan;
  status: Stripe.Subscription.Status;
  paidUntil: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string;
}) {
  const base = {
    subscription_status: args.status,
    stripe_customer_id: args.stripeCustomerId,
    stripe_subscription_id: args.stripeSubscriptionId,
    paid_until: args.paidUntil,
    is_live: true,
    updated_at: new Date().toISOString(),
  };

  if (args.plan === "featured" || args.plan === "city_featured") {
    return {
      ...base,
      featured: true,
      featured_rank: 1,
      pricing_tier: "featured",
      subscription_type: args.plan,
      city_sponsor: args.plan === "city_featured",
      mosque_sponsor: false,
      sponsorship_active: args.plan === "city_featured",
    };
  }

  if (
    args.plan === "mosque_sponsor" ||
    args.plan === "multi_mosque" ||
    args.plan === "city_sponsor" ||
    args.plan === "multi_city"
  ) {
    return {
      ...base,
      featured: true,
      featured_rank: 1,
      pricing_tier: "sponsored",
      subscription_type: args.plan,
      city_sponsor: args.plan === "city_sponsor" || args.plan === "multi_city",
      mosque_sponsor:
        args.plan === "mosque_sponsor" ||
        args.plan === "multi_mosque" ||
        args.plan === "multi_city",
      sponsorship_active: true,
    };
  }

  return {
    ...base,
    pricing_tier: args.plan,
    subscription_type: args.plan,
    sponsorship_active: false,
  };
}

async function activateOneTimeAdvertisingPayment(session: Stripe.Checkout.Session) {
  const businessId = getMetadataValue(session.metadata, "business_id");
  const advertisingType = getMetadataValue(session.metadata, "advertising_type");

  if (!isUuid(businessId) || !isAdvertisingType(advertisingType)) {
    console.warn("Stripe webhook: advertising checkout missing metadata", {
      session_id: session.id,
      businessId,
      advertisingType,
    });
    return;
  }

  if (session.payment_status !== "paid") {
    console.warn("Stripe webhook: advertising checkout not paid", {
      session_id: session.id,
      payment_status: session.payment_status,
    });
    return;
  }

  const { data: business, error: businessError } = await supabaseAdmin
    .from("businesses")
    .select("id, paid_until")
    .eq("id", businessId)
    .maybeSingle();

  if (businessError) {
    throw new Error(businessError.message);
  }

  if (!business) {
    console.warn("Stripe webhook: business not found for advertising payment", {
      session_id: session.id,
      business_id: businessId,
    });
    return;
  }

  const paidUntil = extendPaidUntil(
    typeof business.paid_until === "string" ? business.paid_until : null,
    30
  );

  const updatePayload = getAdvertisingBusinessUpdate({
    advertisingType,
    paidUntil,
    stripeCustomerId: getCustomerId(session.customer),
    stripeSubscriptionId: getSubscriptionId(session.subscription),
  });

  const { error: updateBusinessError } = await supabaseAdmin
    .from("businesses")
    .update(updatePayload)
    .eq("id", businessId);

  if (updateBusinessError) {
    throw new Error(updateBusinessError.message);
  }

  const { error: updateCampaignError } = await supabaseAdmin
    .from("advertising_campaign_requests")
    .update({
      status: "active",
      payment_status: "paid",
      stripe_checkout_session_id: session.id,
      stripe_customer_id: getCustomerId(session.customer),
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("business_id", businessId)
    .eq("advertising_type", advertisingType)
    .in("status", ["draft", "pending", "approved", "pending_payment"]);

  if (updateCampaignError) {
    console.warn("Stripe webhook: campaign request update failed", {
      session_id: session.id,
      error: updateCampaignError.message,
    });
  }
}

async function activateSubscriptionPlan(
  subscription: Stripe.Subscription,
  fallbackMetadata?: StripeMetadata | null
) {
  const metadata = {
    ...(fallbackMetadata ?? {}),
    ...(subscription.metadata ?? {}),
  };

  const businessId = getMetadataValue(metadata, "business_id");
  const rawPlan =
    getMetadataValue(metadata, "plan") ||
    getMetadataValue(metadata, "pricing_tier") ||
    getMetadataValue(metadata, "advertising_type") ||
    getMetadataValue(metadata, "subscription_type");

  if (!isUuid(businessId) || !isSubscriptionPlan(rawPlan)) {
    console.warn("Stripe webhook: subscription missing usable metadata", {
      subscription_id: subscription.id,
      businessId,
      plan: rawPlan,
    });
    return;
  }

  const { currentPeriodStart, currentPeriodEnd } =
    getSubscriptionPeriod(subscription);

  const stripeCustomerId = getCustomerId(subscription.customer);

  const updatePayload = getSubscriptionBusinessUpdate({
    plan: rawPlan,
    status: subscription.status,
    paidUntil: currentPeriodEnd,
    stripeCustomerId,
    stripeSubscriptionId: subscription.id,
  });

  const { error: businessUpdateError } = await supabaseAdmin
    .from("businesses")
    .update(updatePayload)
    .eq("id", businessId);

  if (businessUpdateError) {
    throw new Error(businessUpdateError.message);
  }

  const { error: subscriptionUpsertError } = await supabaseAdmin
    .from("subscriptions")
    .upsert(
      {
        business_id: businessId,
        stripe_customer_id: stripeCustomerId ?? "",
        stripe_subscription_id: subscription.id,
        subscription_type: rawPlan,
        subscription_status: subscription.status,
        current_period_start: currentPeriodStart,
        current_period_end: currentPeriodEnd,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "stripe_subscription_id",
      }
    );

  if (subscriptionUpsertError) {
    console.warn("Stripe webhook: subscription upsert failed", {
      subscription_id: subscription.id,
      error: subscriptionUpsertError.message,
    });
  }

  if (isAdvertisingType(rawPlan)) {
    const { error: campaignUpdateError } = await supabaseAdmin
      .from("advertising_campaign_requests")
      .update({
        status: "active",
        payment_status: "paid",
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: subscription.id,
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("business_id", businessId)
      .eq("advertising_type", rawPlan)
      .in("status", ["draft", "pending", "approved", "pending_payment"]);

    if (campaignUpdateError) {
      console.warn("Stripe webhook: subscription campaign update failed", {
        subscription_id: subscription.id,
        error: campaignUpdateError.message,
      });
    }
  }
}

async function deactivateBusinessPlan(subscription: Stripe.Subscription) {
  const businessId = getMetadataValue(subscription.metadata, "business_id");

  if (!isUuid(businessId)) {
    console.warn("Stripe webhook: deleted subscription missing business_id", {
      subscription_id: subscription.id,
    });
    return;
  }

  const { error: businessUpdateError } = await supabaseAdmin
    .from("businesses")
    .update({
      featured: false,
      mosque_sponsor: false,
      city_sponsor: false,
      sponsorship_active: false,
      subscription_status: "cancelled",
      updated_at: new Date().toISOString(),
    })
    .eq("id", businessId);

  if (businessUpdateError) {
    throw new Error(businessUpdateError.message);
  }

  const { error: subscriptionUpdateError } = await supabaseAdmin
    .from("subscriptions")
    .update({
      subscription_status: "cancelled",
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id);

  if (subscriptionUpdateError) {
    console.warn("Stripe webhook: subscription cancellation update failed", {
      subscription_id: subscription.id,
      error: subscriptionUpdateError.message,
    });
  }

  const { error: campaignUpdateError } = await supabaseAdmin
    .from("advertising_campaign_requests")
    .update({
      status: "cancelled",
      payment_status: "cancelled",
      updated_at: new Date().toISOString(),
    })
    .eq("business_id", businessId)
    .eq("stripe_subscription_id", subscription.id);

  if (campaignUpdateError) {
    console.warn("Stripe webhook: campaign cancellation update failed", {
      subscription_id: subscription.id,
      error: campaignUpdateError.message,
    });
  }
}

function getInvoiceSubscriptionId(invoice: Stripe.Invoice) {
  const invoiceWithSubscription = invoice as Stripe.Invoice & {
    subscription?: string | Stripe.Subscription | null;
  };

  const directSubscription = getSubscriptionId(invoiceWithSubscription.subscription);

  if (directSubscription) {
    return directSubscription;
  }

  const parent = invoice.parent as
    | {
        subscription_details?: {
          subscription?: string | Stripe.Subscription | null;
        } | null;
      }
    | null
    | undefined;

  return getSubscriptionId(parent?.subscription_details?.subscription);
}

async function markPaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = getInvoiceSubscriptionId(invoice);

  if (!subscriptionId) {
    console.warn("Stripe webhook: invoice.payment_failed missing subscription", {
      invoice_id: invoice.id,
    });
    return;
  }

  const { error } = await supabaseAdmin
    .from("subscriptions")
    .update({
      subscription_status: "payment_failed",
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscriptionId);

  if (error) {
    console.warn("Stripe webhook: payment failed subscription update failed", {
      invoice_id: invoice.id,
      subscription_id: subscriptionId,
      error: error.message,
    });
  }

  const { error: businessError } = await supabaseAdmin
    .from("businesses")
    .update({
      subscription_status: "payment_failed",
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscriptionId);

  if (businessError) {
    console.warn("Stripe webhook: payment failed business update failed", {
      invoice_id: invoice.id,
      subscription_id: subscriptionId,
      error: businessError.message,
    });
  }
}

export async function GET() {
  return jsonResponse({
    ok: true,
    route: "/api/stripe/webhook",
    method: "POST",
    required_header: "stripe-signature",
    handled_events: [
      "checkout.session.completed",
      "customer.subscription.updated",
      "customer.subscription.deleted",
      "invoice.payment_failed",
    ],
  });
}

export async function POST(req: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

  if (!webhookSecret) {
    console.error("Stripe webhook secret is missing.");
    return textResponse("Webhook secret not configured", 500);
  }

  const signature = (await headers()).get("stripe-signature");

  if (!signature) {
    return textResponse("Missing signature", 400);
  }

  const body = await req.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    console.error("Stripe webhook signature verification failed:", error);
    return textResponse("Invalid signature", 400);
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      if (session.mode === "payment") {
        await activateOneTimeAdvertisingPayment(session);
      }

      if (session.mode === "subscription" && session.subscription) {
        const subscription = await stripe.subscriptions.retrieve(
          String(session.subscription)
        );

        await activateSubscriptionPlan(subscription, session.metadata);
      }
    }

    if (event.type === "customer.subscription.updated") {
      const subscription = event.data.object as Stripe.Subscription;
      await activateSubscriptionPlan(subscription);
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      await deactivateBusinessPlan(subscription);
    }

    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      await markPaymentFailed(invoice);
    }

    return jsonResponse({
      received: true,
      event_id: event.id,
      event_type: event.type,
    });
  } catch (error) {
    console.error("Stripe webhook processing failed:", {
      event_id: event.id,
      event_type: event.type,
      error,
    });

    return textResponse("Webhook handler failed", 500);
  }
}