import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature" },
      { status: 400 }
    );
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Missing STRIPE_WEBHOOK_SECRET" },
      { status: 500 }
    );
  }

  const body = await req.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Invalid webhook signature";

    return NextResponse.json(
      { error: `Webhook Error: ${message}` },
      { status: 400 }
    );
  }

  try {
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = event.data.object as Stripe.Checkout.Session;

      const businessId = session.metadata?.business_id;
      const plan = session.metadata?.plan as "featured" | "sponsor" | undefined;
      const sponsorMosqueId = session.metadata?.sponsor_mosque_id || null;

      if (!businessId || !plan) {
        return NextResponse.json({ received: true });
      }

      const expiry = addDays(30);

      const updateData: Record<string, unknown> = {
        stripe_customer_id:
          typeof session.customer === "string" ? session.customer : null,
        stripe_payment_status: "paid",
        featured: true,
        featured_until: expiry,
        paid_until: expiry,
        plan,
      };

      if (plan === "featured") {
        updateData.sponsor_mosque_id = null;
      }

      if (plan === "sponsor") {
        updateData.sponsor_mosque_id = sponsorMosqueId;
      }

      const { error } = await supabaseAdmin
        .from("businesses")
        .update(updateData)
        .eq("id", businessId);

      if (error) {
        console.error("Webhook business update error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      const businessId = session.metadata?.business_id;

      if (businessId) {
        const { error } = await supabaseAdmin
          .from("businesses")
          .update({ stripe_payment_status: "expired" })
          .eq("id", businessId);

        if (error) {
          console.error("Webhook expired-session update error:", error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook route error:", error);

    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

