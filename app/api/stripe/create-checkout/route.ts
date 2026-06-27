import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { stripe } from "@/lib/stripe";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      business_id,
      mosque_id,
      pricing_tier,
      duration_days,
      amount,
      business_name,
    } = body;

    if (!business_id || !mosque_id || !pricing_tier || !amount) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // ✅ Create campaign record FIRST
    const { data: campaign, error } = await supabaseAdmin
      .from("advertising_campaign_requests")
      .insert({
        business_id,
        mosque_id,
        pricing_tier,
        duration_days,
        amount,
        payment_status: "unpaid",
        status: "draft",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // ✅ Create Stripe checkout
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "gbp",
            unit_amount: amount * 100,
            product_data: {
              name: `${business_name} Sponsorship`,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/payment-success`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/payment-cancel`,
      metadata: {
        campaign_id: campaign.id,
        business_id,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Checkout creation failed" },
      { status: 500 }
    );
  }
}

