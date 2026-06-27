import { NextResponse } from "next/server";
import { getPayPalAccessToken, PAYPAL_BASE_URL } from "@/lib/paypal";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Plan = "featured" | "mosque_sponsor" | "city_sponsor";

type Body = {
  business_id?: string;
  plan?: Plan;
};

const PLAN_PRICES_GBP: Record<Plan, string> = {
  featured: "19.00",
  mosque_sponsor: "49.00",
  city_sponsor: "99.00",
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as Body | null;

    const businessId = clean(body?.business_id);
    const plan = body?.plan;

    if (!businessId || !plan || !PLAN_PRICES_GBP[plan]) {
      return NextResponse.json(
        { error: "Missing or invalid PayPal checkout fields" },
        { status: 400 }
      );
    }

    const { data: business, error } = await supabaseAdmin
      .from("businesses")
      .select("id,name,email")
      .eq("id", businessId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!business) {
      return NextResponse.json(
        { error: "Business not found" },
        { status: 404 }
      );
    }

    const accessToken = await getPayPalAccessToken();

    const res = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: business.id,
            description: `SalahNearMe ${plan.replace(/_/g, " ")}`,
            custom_id: `${business.id}:${plan}`,
            amount: {
              currency_code: "GBP",
              value: PLAN_PRICES_GBP[plan],
            },
          },
        ],
        payment_source: {
          paypal: {
            experience_context: {
              brand_name: "SalahNearMe",
              shipping_preference: "NO_SHIPPING",
              user_action: "PAY_NOW",
            },
          },
        },
      }),
      cache: "no-store",
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error("PayPal create order error:", data);
      return NextResponse.json(
        { error: "Could not create PayPal order" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      order_id: data.id,
    });
  } catch (error) {
    console.error("PayPal create order route error:", error);

    return NextResponse.json(
      { error: "Could not create PayPal order" },
      { status: 500 }
    );
  }
}

