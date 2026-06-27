import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type CheckoutBody = {
  business_id: string;
  plan: "featured" | "sponsor";
  sponsor_mosque_id?: string | null;
};

function getPriceId(plan: CheckoutBody["plan"]) {
  if (plan === "featured") {
    const priceId = process.env.STRIPE_PRICE_FEATURED_BUSINESS;
    if (!priceId) {
      throw new Error("Missing STRIPE_PRICE_FEATURED_BUSINESS");
    }
    return priceId;
  }

  const priceId = process.env.STRIPE_PRICE_SPONSOR_MOSQUE;
  if (!priceId) {
    throw new Error("Missing STRIPE_PRICE_SPONSOR_MOSQUE");
  }
  return priceId;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as CheckoutBody | null;

    if (!body?.business_id || !body?.plan) {
      return NextResponse.json(
        { error: "Missing business_id or plan" },
        { status: 400 }
      );
    }

    if (body.plan === "sponsor" && !body.sponsor_mosque_id) {
      return NextResponse.json(
        { error: "Missing sponsor_mosque_id" },
        { status: 400 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) {
      return NextResponse.json(
        { error: "Missing NEXT_PUBLIC_APP_URL" },
        { status: 500 }
      );
    }

    const priceId = getPriceId(body.plan);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/payment/cancel`,
      metadata: {
        business_id: body.business_id,
        plan: body.plan,
        sponsor_mosque_id: body.sponsor_mosque_id ?? "",
      },
    });

    const { error } = await supabaseAdmin
      .from("businesses")
      .update({
        stripe_session_id: session.id,
        stripe_payment_status: "created",
        plan: body.plan,
        sponsor_mosque_id:
          body.plan === "sponsor" ? body.sponsor_mosque_id ?? null : null,
      })
      .eq("id", body.business_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe checkout URL was not returned" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe checkout route error:", error);

    return NextResponse.json(
      { error: "Could not start checkout" },
      { status: 500 }
    );
  }
}

