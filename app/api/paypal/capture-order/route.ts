import { NextResponse } from "next/server";
import { getPayPalAccessToken, PAYPAL_BASE_URL } from "@/lib/paypal";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  order_id?: string;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function paidUntil(days = 30) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as Body | null;
    const orderId = clean(body?.order_id);

    if (!orderId) {
      return NextResponse.json(
        { error: "Missing order_id" },
        { status: 400 }
      );
    }

    const accessToken = await getPayPalAccessToken();

    const res = await fetch(
      `${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    );

    const data = await res.json().catch(() => ({}));

    if (!res.ok || data.status !== "COMPLETED") {
      console.error("PayPal capture error:", data);
      return NextResponse.json(
        { error: "PayPal payment was not completed" },
        { status: 400 }
      );
    }

    const purchaseUnit = data.purchase_units?.[0];
    const customId = purchaseUnit?.payments?.captures?.[0]?.custom_id;

    const [businessId, plan] = String(customId ?? "").split(":");

    if (!businessId || !plan) {
      return NextResponse.json(
        { error: "Missing PayPal metadata" },
        { status: 400 }
      );
    }

    const update: Record<string, unknown> = {
      paid_until: paidUntil(30),
      subscription_status: "paypal_paid",
      is_live: true,
      updated_at: new Date().toISOString(),
    };

    if (plan === "featured") {
      update.featured = true;
      update.pricing_tier = "featured";
    }

    if (plan === "mosque_sponsor") {
      update.mosque_sponsor = true;
      update.sponsorship_active = true;
      update.pricing_tier = "mosque_sponsor";
    }

    if (plan === "city_sponsor") {
      update.city_sponsor = true;
      update.sponsorship_active = true;
      update.pricing_tier = "city_sponsor";
    }

    const { error } = await supabaseAdmin
      .from("businesses")
      .update(update)
      .eq("id", businessId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await supabaseAdmin.from("invoices").insert({
      business_id: businessId,
      amount_gbp:
        Number(purchaseUnit?.payments?.captures?.[0]?.amount?.value) || null,
      currency:
        purchaseUnit?.payments?.captures?.[0]?.amount?.currency_code ?? "GBP",
      invoice_status: "paid",
      stripe_invoice_id: null,
      stripe_payment_intent_id:
        purchaseUnit?.payments?.captures?.[0]?.id ?? null,
    });

    return NextResponse.json({
      ok: true,
      business_id: businessId,
      plan,
    });
  } catch (error) {
    console.error("PayPal capture route error:", error);

    return NextResponse.json(
      { error: "Could not capture PayPal payment" },
      { status: 500 }
    );
  }
}

