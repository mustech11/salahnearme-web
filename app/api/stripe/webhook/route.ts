import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";

import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function activateBusinessPlan(
  subscription: Stripe.Subscription
) {
  const businessId =
    subscription.metadata.business_id;

  const plan =
    subscription.metadata.plan;

  if (!businessId || !plan) return;

  const currentPeriodEnd =
    subscription.items.data[0]?.current_period_end;

  const paidUntil = currentPeriodEnd
    ? new Date(currentPeriodEnd * 1000).toISOString()
    : null;

  const update: any = {
    subscription_status: subscription.status,
    stripe_subscription_id: subscription.id,
    paid_until: paidUntil,
    is_live: true,
  };

  /*
  ----------------------------------------
  PLAN ACTIVATION
  ----------------------------------------
  */

  if (plan === "featured") {
    update.featured = true;
    update.pricing_tier = "featured";
  }

  if (plan === "mosque_sponsor") {
    update.mosque_sponsor = true;
    update.sponsorship_active = true;
  }

  if (plan === "city_sponsor") {
    update.city_sponsor = true;
    update.sponsorship_active = true;
  }

  /*
  ----------------------------------------
  UPDATE BUSINESS
  ----------------------------------------
  */

  await supabaseAdmin
    .from("businesses")
    .update(update)
    .eq("id", businessId);

  /*
  ----------------------------------------
  UPSERT SUBSCRIPTION RECORD
  ----------------------------------------
  */

  await supabaseAdmin
    .from("subscriptions")
    .upsert({
      business_id: businessId,

      stripe_customer_id:
        typeof subscription.customer === "string"
          ? subscription.customer
          : "",

      stripe_subscription_id:
        subscription.id,

      subscription_type: plan,

      subscription_status:
        subscription.status,

      current_period_start:
        subscription.items.data[0]?.current_period_start
          ? new Date(
              subscription.items.data[0].current_period_start * 1000
            ).toISOString()
          : null,

      current_period_end:
        paidUntil,
    });
}

async function deactivateBusinessPlan(
  subscription: Stripe.Subscription
) {
  const businessId =
    subscription.metadata.business_id;

  if (!businessId) return;

  await supabaseAdmin
    .from("businesses")
    .update({
      featured: false,
      mosque_sponsor: false,
      city_sponsor: false,
      sponsorship_active: false,
      subscription_status: "cancelled",
    })
    .eq("id", businessId);

  await supabaseAdmin
    .from("subscriptions")
    .update({
      subscription_status: "cancelled",
    })
    .eq(
      "stripe_subscription_id",
      subscription.id
    );
}

export async function POST(req: Request) {
  const body = await req.text();

  const signature =
    (await headers()).get(
      "stripe-signature"
    );

  if (!signature) {
    return new NextResponse(
      "Missing signature",
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error(
      "Webhook signature failed:",
      err
    );

    return new NextResponse(
      "Invalid signature",
      { status: 400 }
    );
  }

  try {
    /*
    ----------------------------------------
    CHECKOUT COMPLETED
    ----------------------------------------
    */

    if (
      event.type ===
      "checkout.session.completed"
    ) {
      const session =
        event.data.object as Stripe.Checkout.Session;

      if (
        session.mode === "subscription" &&
        session.subscription
      ) {
        const subscription =
          await stripe.subscriptions.retrieve(
            session.subscription as string
          );

        await activateBusinessPlan(
          subscription
        );
      }
    }

    /*
    ----------------------------------------
    SUBSCRIPTION UPDATED
    ----------------------------------------
    */

    if (
      event.type ===
      "customer.subscription.updated"
    ) {
      const subscription =
        event.data.object as Stripe.Subscription;

      await activateBusinessPlan(
        subscription
      );
    }

    /*
    ----------------------------------------
    SUBSCRIPTION DELETED
    ----------------------------------------
    */

    if (
      event.type ===
      "customer.subscription.deleted"
    ) {
      const subscription =
        event.data.object as Stripe.Subscription;

      await deactivateBusinessPlan(
        subscription
      );
    }

    /*
    ----------------------------------------
    PAYMENT FAILED
    ----------------------------------------
    */

    if (
  event.type === "invoice.payment_failed"
) {
  const invoice =
    event.data.object as Stripe.Invoice;

  const subscriptionId =
    invoice.parent?.subscription_details?.subscription
      ? String(
          invoice.parent.subscription_details.subscription
        )
      : null;

  if (subscriptionId) {
    await supabaseAdmin
      .from("subscriptions")
      .update({
        subscription_status:
          "payment_failed",
      })
      .eq(
        "stripe_subscription_id",
        subscriptionId
      );
  }
}

    return NextResponse.json({
      received: true,
    });
  } catch (error) {
    console.error(
      "Webhook processing failed:",
      error
    );

    return new NextResponse(
      "Webhook handler failed",
      { status: 500 }
    );
  }
}

