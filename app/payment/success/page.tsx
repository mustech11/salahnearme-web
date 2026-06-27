import type { Metadata } from "next";
import Link from "next/link";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { stripe } from "@/lib/stripe";

export const metadata: Metadata = {
  title: "Payment Successful | SalahNearMe",
  description: "Your SalahNearMe payment was successful.",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  type?: string;
  advertising?: string;
  business?: string;
  session_id?: string;
}>;

type AdvertisingType =
  | "city_featured"
  | "mosque_sponsor"
  | "multi_mosque"
  | "multi_city";

type BusinessRow = {
  id: string;
  name: string | null;
  slug: string | null;
  city: string | null;
  pricing_tier: string | null;
  subscription_type: string | null;
  featured: boolean | null;
  paid_until: string | null;
  sponsorship_active: boolean | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
};

type PageState = {
  ok: boolean;
  title: string;
  message: string;
  business?: BusinessRow | null;
  error?: string;
};

const ADVERTISING_TYPES: AdvertisingType[] = [
  "city_featured",
  "mosque_sponsor",
  "multi_mosque",
  "multi_city",
];

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function isAdvertisingType(value: string): value is AdvertisingType {
  return ADVERTISING_TYPES.includes(value as AdvertisingType);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getPaidUntil(currentPaidUntil: string | null, days = 30) {
  const now = new Date();
  const current = currentPaidUntil ? new Date(currentPaidUntil) : null;

  const start =
    current && !Number.isNaN(current.getTime()) && current > now ? current : now;

  return addDays(start, days).toISOString();
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

function getAdvertisingUpdate(
  advertisingType: AdvertisingType,
  paidUntil: string,
  stripeCustomerId: string | null,
  stripeSubscriptionId: string | null
) {
  const base = {
    paid_until: paidUntil,
    stripe_customer_id: stripeCustomerId,
    stripe_subscription_id: stripeSubscriptionId,
    updated_at: new Date().toISOString(),
  };

  if (advertisingType === "city_featured") {
    return {
      ...base,
      featured: true,
      featured_rank: 1,
      pricing_tier: "featured",
      subscription_type: "advertising",
      sponsorship_active: false,
      city_sponsor: true,
      mosque_sponsor: false,
    };
  }

  if (advertisingType === "mosque_sponsor") {
    return {
      ...base,
      featured: true,
      featured_rank: 1,
      pricing_tier: "sponsored",
      subscription_type: "advertising",
      sponsorship_active: true,
      city_sponsor: false,
      mosque_sponsor: true,
    };
  }

  if (advertisingType === "multi_mosque") {
    return {
      ...base,
      featured: true,
      featured_rank: 1,
      pricing_tier: "sponsored",
      subscription_type: "advertising",
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
    subscription_type: "advertising",
    sponsorship_active: true,
    city_sponsor: true,
    mosque_sponsor: true,
  };
}

async function activateAdvertisingPlacement({
  advertising,
  business,
  sessionId,
}: {
  advertising: string;
  business: string;
  sessionId: string;
}): Promise<PageState> {
  if (!isAdvertisingType(advertising)) {
    return {
      ok: false,
      title: "Invalid advertising package",
      message: "The selected advertising package is not valid.",
      error: "Invalid advertising type.",
    };
  }

  if (!business || !isUuid(business)) {
    return {
      ok: false,
      title: "Missing business",
      message: "A valid business was not attached to this payment.",
      error: "Invalid business id.",
    };
  }

  if (!sessionId || !sessionId.startsWith("cs_")) {
    return {
      ok: false,
      title: "Missing Stripe session",
      message: "The Stripe checkout session was not returned.",
      error: "Invalid session id.",
    };
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.payment_status !== "paid") {
    return {
      ok: false,
      title: "Payment not confirmed yet",
      message:
        "Stripe has not confirmed this payment yet. Please refresh this page in a few seconds.",
      error: `Stripe payment_status is ${session.payment_status}.`,
    };
  }

  const sessionBusinessId =
    typeof session.metadata?.business_id === "string"
      ? session.metadata.business_id
      : "";

  const sessionAdvertisingType =
    typeof session.metadata?.advertising_type === "string"
      ? session.metadata.advertising_type
      : "";

  if (sessionBusinessId && sessionBusinessId !== business) {
    return {
      ok: false,
      title: "Payment mismatch",
      message: "This payment does not match the selected business.",
      error: "Session business_id mismatch.",
    };
  }

  if (sessionAdvertisingType && sessionAdvertisingType !== advertising) {
    return {
      ok: false,
      title: "Package mismatch",
      message: "This payment does not match the selected advertising package.",
      error: "Session advertising_type mismatch.",
    };
  }

  const { data: existingBusiness, error: fetchError } = await supabaseAdmin
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
        "sponsorship_active",
        "stripe_customer_id",
        "stripe_subscription_id",
      ].join(",")
    )
    .eq("id", business)
    .maybeSingle();

  if (fetchError) {
    return {
      ok: false,
      title: "Could not load business",
      message: "The payment succeeded, but the business could not be loaded.",
      error: fetchError.message,
    };
  }

  if (!existingBusiness) {
    return {
      ok: false,
      title: "Business not found",
      message: "The payment succeeded, but the business was not found.",
      error: "Business not found.",
    };
  }

  const typedBusiness = existingBusiness as unknown as BusinessRow;
  const stripeCustomerId = getCustomerId(session.customer);
  const stripeSubscriptionId = getSubscriptionId(session.subscription);
  const paidUntil = getPaidUntil(typedBusiness.paid_until, 30);

  const updatePayload = getAdvertisingUpdate(
    advertising,
    paidUntil,
    stripeCustomerId,
    stripeSubscriptionId
  );

  const { data: updatedBusiness, error: updateError } = await supabaseAdmin
    .from("businesses")
    .update(updatePayload)
    .eq("id", business)
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
        "sponsorship_active",
        "stripe_customer_id",
        "stripe_subscription_id",
      ].join(",")
    )
    .single();

  if (updateError) {
    return {
      ok: false,
      title: "Payment successful",
      message:
        "Your payment succeeded, but the listing could not be updated automatically.",
      error: updateError.message,
    };
  }

  await supabaseAdmin
    .from("advertising_campaign_requests")
    .update({
      status: "active",
      stripe_checkout_session_id: session.id,
      stripe_customer_id: stripeCustomerId,
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("business_id", business)
    .eq("advertising_type", advertising)
    .in("status", ["draft", "pending", "approved", "pending_payment"]);

  return {
    ok: true,
    title: "Payment successful",
    message:
      "JazakAllahu khayran. Your listing has been activated successfully.",
    business: updatedBusiness as unknown as BusinessRow,
  };
}

export default async function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;

  let state: PageState = {
    ok: true,
    title: "Payment successful",
    message:
      "JazakAllahu khayran. Your listing will update automatically in a few seconds.",
  };

  if (
    params.type === "advertising" &&
    params.advertising &&
    params.business &&
    params.session_id
  ) {
    state = await activateAdvertisingPlacement({
      advertising: params.advertising,
      business: params.business,
      sessionId: params.session_id,
    });
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <section
        className={`rounded-3xl border p-8 md:p-10 ${
          state.ok
            ? "border-yellow-500/20 bg-[rgb(var(--card))]"
            : "border-red-500/30 bg-red-500/10"
        }`}
      >
        <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
          Payment
        </div>

        <h1 className="mt-3 text-3xl font-bold text-white md:text-5xl">
          {state.title}
        </h1>

        <p className="mt-4 max-w-3xl text-lg text-white/75">
          {state.message}
        </p>

        {state.error && (
          <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {state.error}
          </div>
        )}

        {state.business && (
          <div className="mt-8 rounded-2xl border border-white/10 bg-black/30 p-5">
            <div className="text-xl font-semibold text-white">
              {state.business.name}
            </div>

            <div className="mt-2 text-white/60">{state.business.city}</div>

            <div className="mt-5 grid gap-3 text-sm text-white/80 md:grid-cols-2">
              <div>
                Pricing tier:{" "}
                <span className="font-semibold text-white">
                  {state.business.pricing_tier ?? "—"}
                </span>
              </div>

              <div>
                Subscription type:{" "}
                <span className="font-semibold text-white">
                  {state.business.subscription_type ?? "—"}
                </span>
              </div>

              <div>
                Featured:{" "}
                <span className="font-semibold text-white">
                  {state.business.featured ? "Yes" : "No"}
                </span>
              </div>

              <div>
                Paid until:{" "}
                <span className="font-semibold text-white">
                  {state.business.paid_until
                    ? new Date(state.business.paid_until).toLocaleString(
                        "en-GB"
                      )
                    : "—"}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/dashboard/business/billing"
            className="rounded-xl bg-yellow-500 px-5 py-3 text-sm font-semibold text-black hover:bg-yellow-400"
          >
            View billing dashboard
          </Link>

          <Link
            href="/dashboard/business"
            className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/80 hover:bg-white/10"
          >
            Back to business dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}