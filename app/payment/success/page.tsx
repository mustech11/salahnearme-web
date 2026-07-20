import type { Metadata } from "next";
import Link from "next/link";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { stripe } from "@/lib/stripe";

export const metadata: Metadata = {
  title: "Payment Successful | SalahNearMe",
  description:
    "Your SalahNearMe payment was successful. Review your listing, billing status, and next steps.",
  robots: {
    index: false,
    follow: false,
  },
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  type?: string;
  advertising?: string;
  business?: string;
  business_id?: string;
  campaign_id?: string;
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
  tone: "success" | "warning" | "error";
  business?: BusinessRow | null;
  error?: string;
  sessionId?: string;
  paymentStatus?: string | null;
};

const ADVERTISING_TYPES = [
  "city_featured",
  "mosque_sponsor",
  "multi_mosque",
  "multi_city",
] as const;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function formatAdvertisingType(value: AdvertisingType) {
  const labels: Record<AdvertisingType, string> = {
    city_featured: "Featured City Listing",
    mosque_sponsor: "Sponsor a Mosque",
    multi_mosque: "Multiple Mosque Sponsorship",
    multi_city: "Multi-City Campaign",
  };

  return labels[value];
}

function getBusinessHref(business: BusinessRow | null | undefined) {
  if (!business?.slug) {
    return "/businesses";
  }

  return `/businesses/${business.slug}`;
}

function getCityBusinessesHref(business: BusinessRow | null | undefined) {
  if (!business?.city) {
    return "/businesses";
  }

  return `/${business.city.toLowerCase().trim().replace(/\s+/g, "-")}/businesses`;
}

function getAdvertisingUpdate(args: {
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

async function getBusinessById(businessId: string) {
  const { data, error } = await supabaseAdmin
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
    .eq("id", businessId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? null) as BusinessRow | null;
}

async function activateAdvertisingPlacement({
  advertising,
  businessId,
  sessionId,
}: {
  advertising: string;
  businessId: string;
  sessionId: string;
}): Promise<PageState> {
  if (!isAdvertisingType(advertising)) {
    return {
      ok: false,
      tone: "error",
      title: "Invalid advertising package",
      message: "The selected advertising package is not valid.",
      error: "Invalid advertising type.",
    };
  }

  if (!isUuid(businessId)) {
    return {
      ok: false,
      tone: "error",
      title: "Missing business",
      message: "A valid business was not attached to this payment.",
      error: "Invalid business id.",
    };
  }

  if (!sessionId || !sessionId.startsWith("cs_")) {
    return {
      ok: false,
      tone: "error",
      title: "Missing Stripe session",
      message: "The Stripe checkout session was not returned.",
      error: "Invalid session id.",
    };
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId);

  const sessionBusinessId = clean(session.metadata?.business_id);
  const sessionAdvertisingType = clean(session.metadata?.advertising_type);

  if (sessionBusinessId && sessionBusinessId !== businessId) {
    return {
      ok: false,
      tone: "error",
      title: "Payment mismatch",
      message: "This payment does not match the selected business.",
      error: "Session business_id mismatch.",
      sessionId: session.id,
      paymentStatus: session.payment_status,
    };
  }

  if (sessionAdvertisingType && sessionAdvertisingType !== advertising) {
    return {
      ok: false,
      tone: "error",
      title: "Package mismatch",
      message: "This payment does not match the selected advertising package.",
      error: "Session advertising_type mismatch.",
      sessionId: session.id,
      paymentStatus: session.payment_status,
    };
  }

  const existingBusiness = await getBusinessById(businessId);

  if (!existingBusiness) {
    return {
      ok: false,
      tone: "error",
      title: "Business not found",
      message: "The payment succeeded, but the business was not found.",
      error: "Business not found.",
      sessionId: session.id,
      paymentStatus: session.payment_status,
    };
  }

  if (session.payment_status !== "paid") {
    return {
      ok: false,
      tone: "warning",
      title: "Payment not confirmed yet",
      message:
        "Stripe has not confirmed this payment yet. Please refresh this page in a few seconds.",
      error: `Stripe payment_status is ${session.payment_status}.`,
      business: existingBusiness,
      sessionId: session.id,
      paymentStatus: session.payment_status,
    };
  }

  const stripeCustomerId = getCustomerId(session.customer);
  const stripeSubscriptionId = getSubscriptionId(session.subscription);
  const paidUntil = getPaidUntil(existingBusiness.paid_until, 30);

  const updatePayload = getAdvertisingUpdate({
    advertisingType: advertising,
    paidUntil,
    stripeCustomerId,
    stripeSubscriptionId,
  });

  const { data: updatedBusiness, error: updateError } = await supabaseAdmin
    .from("businesses")
    .update(updatePayload)
    .eq("id", businessId)
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
      tone: "warning",
      title: "Payment successful",
      message:
        "Your payment succeeded, but the listing could not be updated automatically. Admin can activate it manually from the dashboard.",
      error: updateError.message,
      business: existingBusiness,
      sessionId: session.id,
      paymentStatus: session.payment_status,
    };
  }

  const typedBusiness = updatedBusiness as unknown as BusinessRow;

  const { error: campaignUpdateError } = await supabaseAdmin
    .from("advertising_campaign_requests")
    .update({
      status: "active",
      payment_status: "paid",
      stripe_checkout_session_id: session.id,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("business_id", businessId)
    .eq("advertising_type", advertising)
    .in("status", ["draft", "pending", "approved", "pending_payment"]);

  if (campaignUpdateError) {
    console.warn("payment success campaign update warning:", {
      business_id: businessId,
      advertising,
      error: campaignUpdateError.message,
    });
  }

  return {
    ok: true,
    tone: "success",
    title: "Payment successful",
    message: `JazakAllahu khayran. Your ${formatAdvertisingType(
      advertising
    )} has been activated successfully.`,
    business: typedBusiness,
    sessionId: session.id,
    paymentStatus: session.payment_status,
  };
}

async function getStateFromParams(params: Awaited<SearchParams>): Promise<PageState> {
  const type = clean(params.type);
  const advertising = clean(params.advertising);
  const businessId = clean(params.business_id || params.business);
  const sessionId = clean(params.session_id);

  if (type === "advertising") {
    return activateAdvertisingPlacement({
      advertising,
      businessId,
      sessionId,
    });
  }

  if (businessId && isUuid(businessId)) {
    try {
      const business = await getBusinessById(businessId);

      return {
        ok: true,
        tone: "success",
        title: "Payment successful",
        message:
          "JazakAllahu khayran. Your payment was successful and your listing status is shown below.",
        business,
        sessionId: sessionId || undefined,
      };
    } catch (error) {
      return {
        ok: false,
        tone: "warning",
        title: "Payment successful",
        message:
          "Your payment appears to have completed, but the business details could not be loaded.",
        error:
          error instanceof Error
            ? error.message
            : "Could not load business details.",
        sessionId: sessionId || undefined,
      };
    }
  }

  return {
    ok: true,
    tone: "success",
    title: "Payment successful",
    message:
      "JazakAllahu khayran. Your payment was successful. If your listing does not update immediately, please refresh in a few seconds.",
    sessionId: sessionId || undefined,
  };
}

function getSectionClass(tone: PageState["tone"]) {
  if (tone === "error") {
    return "border-red-500/30 bg-red-500/10";
  }

  if (tone === "warning") {
    return "border-yellow-500/30 bg-yellow-500/10";
  }

  return "border-yellow-500/20 bg-[rgb(var(--card))]";
}

function getStatusLabel(state: PageState) {
  if (state.tone === "error") {
    return "Needs attention";
  }

  if (state.tone === "warning") {
    return "Payment received";
  }

  return "Activated";
}

export default async function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const state = await getStateFromParams(params);

  const businessHref = getBusinessHref(state.business);
  const cityBusinessesHref = getCityBusinessesHref(state.business);

  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <section
        className={`relative overflow-hidden rounded-3xl border p-8 md:p-10 ${getSectionClass(
          state.tone
        )}`}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,0.16),transparent_36%)]" />

        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
              Payment
            </div>

            <div
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                state.tone === "error"
                  ? "border-red-500/30 bg-red-500/10 text-red-200"
                  : state.tone === "warning"
                    ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-300"
                    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              }`}
            >
              {getStatusLabel(state)}
            </div>
          </div>

          <h1 className="mt-3 text-4xl font-bold text-white md:text-5xl">
            {state.title}
          </h1>

          <p className="mt-4 max-w-3xl text-lg text-white/75">
            {state.message}
          </p>

          {state.error && (
            <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
              <div className="font-semibold text-red-50">System note</div>
              <div className="mt-1">{state.error}</div>
            </div>
          )}

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
              <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
                Payment status
              </div>
              <div className="mt-3 text-lg font-semibold text-white">
                {state.paymentStatus ?? (state.ok ? "Paid" : "Check required")}
              </div>
              <p className="mt-2 text-sm text-white/60">
                Stripe confirmation is used to protect business activation.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
              <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
                Listing status
              </div>
              <div className="mt-3 text-lg font-semibold text-white">
                {state.business?.featured
                  ? "Featured"
                  : state.business
                    ? "Standard"
                    : "Pending"}
              </div>
              <p className="mt-2 text-sm text-white/60">
                Paid placements are reflected on city and business pages.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
              <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
                Next step
              </div>
              <div className="mt-3 text-lg font-semibold text-white">
                Review listing
              </div>
              <p className="mt-2 text-sm text-white/60">
                Check your public page and improve your profile details.
              </p>
            </div>
          </div>

          {state.business && (
            <div className="mt-8 rounded-3xl border border-white/10 bg-black/30 p-6">
              <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
                Business activated
              </div>

              <div className="mt-3 text-2xl font-bold text-white">
                {state.business.name ?? "Business listing"}
              </div>

              <div className="mt-2 text-white/60">
                {state.business.city ?? "City not set"}
              </div>

              <div className="mt-6 grid gap-3 text-sm text-white/80 md:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-white/45">Pricing tier</div>
                  <div className="mt-1 font-semibold text-white">
                    {state.business.pricing_tier ?? "—"}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-white/45">Subscription type</div>
                  <div className="mt-1 font-semibold text-white">
                    {state.business.subscription_type ?? "—"}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-white/45">Featured</div>
                  <div className="mt-1 font-semibold text-white">
                    {state.business.featured ? "Yes" : "No"}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-white/45">Paid until</div>
                  <div className="mt-1 font-semibold text-white">
                    {state.business.paid_until
                      ? new Date(state.business.paid_until).toLocaleString(
                          "en-GB"
                        )
                      : "—"}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-white/45">Sponsorship active</div>
                  <div className="mt-1 font-semibold text-white">
                    {state.business.sponsorship_active ? "Yes" : "No"}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-white/45">Stripe session</div>
                  <div className="mt-1 break-all font-semibold text-white">
                    {state.sessionId ?? "—"}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            {state.business?.slug && (
              <Link
                href={businessHref}
                className="rounded-xl bg-yellow-500 px-5 py-3 text-sm font-semibold text-black hover:bg-yellow-400"
              >
                View public listing
              </Link>
            )}

            <Link
              href={cityBusinessesHref}
              className="rounded-xl border border-yellow-500/30 bg-black px-5 py-3 text-sm font-semibold text-yellow-400 hover:bg-yellow-500/10"
            >
              View city businesses
            </Link>

            <Link
              href="/dashboard/business/billing"
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/80 hover:bg-white/10"
            >
              Billing dashboard
            </Link>

            <Link
              href="/dashboard/business"
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/80 hover:bg-white/10"
            >
              Business dashboard
            </Link>

            <Link
              href="/advertise"
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/80 hover:bg-white/10"
            >
              Advertise more
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}