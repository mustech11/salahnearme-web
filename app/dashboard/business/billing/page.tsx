import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { getSiteUrl } from "@/lib/env";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const metadata: Metadata = {
  title: "Business Billing | SalahNearMe",
  description: "Manage your business subscriptions and billing on SalahNearMe.",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = Promise<{
  business?: string;
}>;

type BusinessRow = {
  id: string;
  name: string | null;
  slug: string | null;
  city: string | null;
  area: string | null;
  postcode: string | null;
  pricing_tier: string | null;
  subscription_type: string | null;
  featured: boolean | null;
  paid_until: string | null;
  sponsorship_active: boolean | null;
  city_sponsor: boolean | null;
  mosque_sponsor: boolean | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  submitted_by_email: string | null;
  claimed_by_email: string | null;
  email: string | null;
};

type ManageableBusinessRow = {
  id: string;
  submitted_by_email: string | null;
  claimed_by_email: string | null;
  email: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
};

function normaliseEmail(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getTierLabel(value: string | null) {
  if (!value) {
    return "Free";
  }

  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isPaidActive(business: BusinessRow) {
  if (!business.paid_until) {
    return false;
  }

  const paidUntil = new Date(business.paid_until).getTime();

  if (Number.isNaN(paidUntil)) {
    return false;
  }

  return paidUntil > Date.now();
}

function isPremiumVisible(business: BusinessRow) {
  return Boolean(
    business.featured ||
      business.sponsorship_active ||
      business.city_sponsor ||
      business.mosque_sponsor ||
      isPaidActive(business)
  );
}

function getPaymentLabel(business: BusinessRow) {
  if (isPaidActive(business)) {
    return "Active";
  }

  if (business.paid_until) {
    return "Expired";
  }

  return "Not started";
}

function getPlacementLabel(business: BusinessRow) {
  if (business.city_sponsor) {
    return "City Sponsor";
  }

  if (business.mosque_sponsor) {
    return "Mosque Sponsor";
  }

  if (business.sponsorship_active) {
    return "Sponsor Active";
  }

  if (business.featured) {
    return "Featured";
  }

  return "Free";
}

function uniqueById(rows: BusinessRow[]) {
  const map = new Map<string, BusinessRow>();

  for (const row of rows) {
    if (row.id) {
      map.set(row.id, row);
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    const aPremium = isPremiumVisible(a) ? 0 : 1;
    const bPremium = isPremiumVisible(b) ? 0 : 1;

    if (aPremium !== bPremium) {
      return aPremium - bPremium;
    }

    return String(a.name ?? "").localeCompare(String(b.name ?? ""));
  });
}

function selectBusiness(params: {
  businesses: BusinessRow[];
  requestedBusinessId: string | undefined;
}) {
  const requested = params.requestedBusinessId
    ? params.businesses.find(
        (business) => business.id === params.requestedBusinessId
      )
    : null;

  if (requested) {
    return requested;
  }

  return (
    params.businesses.find((business) => isPremiumVisible(business)) ??
    params.businesses[0] ??
    null
  );
}

async function getOwnedBusinesses(userEmail: string) {
  const email = normaliseEmail(userEmail);

  if (!email) {
    return [];
  }

  const { data, error } = await supabaseAdmin
    .from("businesses")
    .select(
      [
        "id",
        "name",
        "slug",
        "city",
        "area",
        "postcode",
        "pricing_tier",
        "subscription_type",
        "featured",
        "paid_until",
        "sponsorship_active",
        "city_sponsor",
        "mosque_sponsor",
        "stripe_customer_id",
        "stripe_subscription_id",
        "submitted_by_email",
        "claimed_by_email",
        "email",
      ].join(",")
    )
    .or(
      [
        `submitted_by_email.eq.${email}`,
        `claimed_by_email.eq.${email}`,
        `email.eq.${email}`,
      ].join(",")
    )
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return uniqueById((data ?? []) as unknown as BusinessRow[]);
}

async function assertUserCanManageBusiness(params: {
  userEmail: string;
  businessId: string;
}) {
  const email = normaliseEmail(params.userEmail);

  if (!email) {
    throw new Error("You must be signed in to manage billing.");
  }

  const { data, error } = await supabaseAdmin
    .from("businesses")
    .select(
      [
        "id",
        "submitted_by_email",
        "claimed_by_email",
        "email",
        "stripe_customer_id",
        "stripe_subscription_id",
      ].join(",")
    )
    .eq("id", params.businessId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Business not found.");
  }

  const business = data as unknown as ManageableBusinessRow;

  const ownerEmails = [
    business.submitted_by_email,
    business.claimed_by_email,
    business.email,
  ].map(normaliseEmail);

  if (!ownerEmails.includes(email)) {
    throw new Error("You do not have permission to manage this business.");
  }

  return business;
}

async function openBillingPortal(formData: FormData) {
  "use server";

  const user = await requireUser();

  const businessId = String(formData.get("business_id") ?? "").trim();

  if (!businessId) {
    throw new Error("Missing business ID.");
  }

  const business = await assertUserCanManageBusiness({
    userEmail: user.email ?? "",
    businessId,
  });

  let customerId = String(business.stripe_customer_id ?? "").trim();

  if (!customerId && business.stripe_subscription_id) {
    const subscription = await stripe.subscriptions.retrieve(
      business.stripe_subscription_id
    );

    customerId =
      typeof subscription.customer === "string" ? subscription.customer : "";

    if (customerId) {
      await supabaseAdmin
        .from("businesses")
        .update({
          stripe_customer_id: customerId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", businessId);
    }
  }

  if (!customerId) {
    throw new Error(
      "No Stripe customer found for this business yet. Start or renew a subscription first."
    );
  }

  const siteUrl = getSiteUrl();

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${siteUrl}/dashboard/business/billing?business=${businessId}`,
  });

  if (!session.url) {
    throw new Error("Stripe billing portal URL was not returned.");
  }

  redirect(session.url);
}

export default async function BusinessBillingPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireUser();
  const params = await searchParams;

  let businesses: BusinessRow[] = [];
  let loadError: string | null = null;

  try {
    businesses = await getOwnedBusinesses(user.email ?? "");
  } catch (error) {
    loadError =
      error instanceof Error ? error.message : "Could not load businesses.";
  }

  const selectedBusiness = selectBusiness({
    businesses,
    requestedBusinessId: params.business,
  });

  const hasStripeAccess = selectedBusiness
    ? Boolean(selectedBusiness.stripe_customer_id) ||
      Boolean(selectedBusiness.stripe_subscription_id)
    : false;

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8 md:p-10">
        <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
          Billing
        </div>

        <h1 className="mt-3 text-4xl font-bold text-white md:text-5xl">
          Subscription and billing
        </h1>

        <p className="mt-3 max-w-3xl text-white/70">
          Manage paid placements, renew sponsorships, view the selected business,
          or open Stripe billing when a Stripe customer is attached.
        </p>

        <div className="mt-6">
          <Link
            href={
              selectedBusiness
                ? `/dashboard/business?business=${selectedBusiness.id}`
                : "/dashboard/business"
            }
            className="text-sm font-medium text-yellow-400 hover:text-yellow-300"
          >
            ← Back to business dashboard
          </Link>
        </div>
      </section>

      {loadError && (
        <section className="rounded-3xl border border-red-500/30 bg-red-500/10 p-8 text-red-200">
          {loadError}
        </section>
      )}

      {!loadError && businesses.length === 0 && (
        <section className="rounded-3xl border border-white/10 bg-[rgb(var(--card))] p-8">
          <h2 className="text-2xl font-semibold text-white">
            No owned businesses found yet
          </h2>

          <p className="mt-3 max-w-3xl text-white/60">
            This account is signed in, but it is not linked to a submitted,
            claimed, or owned business listing yet.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/businesses"
              className="rounded-xl border border-yellow-500/30 bg-black px-5 py-3 text-sm font-semibold text-yellow-400 hover:bg-yellow-500/10"
            >
              Browse public businesses
            </Link>

            <Link
              href="/claim/business"
              className="rounded-xl bg-yellow-500 px-5 py-3 text-sm font-semibold text-black hover:bg-yellow-400"
            >
              Claim a business
            </Link>

            <Link
              href="/add-business"
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/80 hover:bg-white/10"
            >
              Add a business
            </Link>
          </div>
        </section>
      )}

      {!loadError && businesses.length > 0 && selectedBusiness && (
        <>
          <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
            <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr] lg:items-end">
              <div>
                <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
                  Selected business
                </div>

                <h2 className="mt-3 text-3xl font-bold text-white">
                  {selectedBusiness.name ?? "Unnamed business"}
                </h2>

                <p className="mt-2 text-white/60">
                  {[selectedBusiness.area, selectedBusiness.city, selectedBusiness.postcode]
                    .filter(Boolean)
                    .join(" • ") || "Location not set"}
                </p>
              </div>

              <form
                action="/dashboard/business/billing"
                method="get"
                className="flex flex-col gap-3 sm:flex-row"
              >
                <select
                  name="business"
                  defaultValue={selectedBusiness.id}
                  className="min-h-12 flex-1 rounded-xl border border-yellow-500/40 bg-black px-4 py-3 text-white outline-none"
                >
                  {businesses.map((business) => (
                    <option key={business.id} value={business.id}>
                      {business.name ?? "Unnamed business"} —{" "}
                      {business.city ?? "No city"}
                    </option>
                  ))}
                </select>

                <button
                  type="submit"
                  className="rounded-xl bg-yellow-500 px-5 py-3 text-sm font-semibold text-black hover:bg-yellow-400"
                >
                  Switch
                </button>
              </form>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl border border-white/10 bg-[rgb(var(--card))] p-6">
              <div className="text-xs uppercase tracking-[0.2em] text-yellow-400">
                Placement
              </div>
              <div className="mt-3 text-3xl font-bold text-white">
                {getPlacementLabel(selectedBusiness)}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-[rgb(var(--card))] p-6">
              <div className="text-xs uppercase tracking-[0.2em] text-yellow-400">
                Payment
              </div>
              <div className="mt-3 text-3xl font-bold text-white">
                {getPaymentLabel(selectedBusiness)}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-[rgb(var(--card))] p-6">
              <div className="text-xs uppercase tracking-[0.2em] text-yellow-400">
                Tier
              </div>
              <div className="mt-3 text-3xl font-bold text-white">
                {getTierLabel(selectedBusiness.pricing_tier)}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-[rgb(var(--card))] p-6">
              <div className="text-xs uppercase tracking-[0.2em] text-yellow-400">
                Stripe
              </div>
              <div className="mt-3 text-3xl font-bold text-white">
                {hasStripeAccess ? "Linked" : "None"}
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-semibold text-white">
                    {selectedBusiness.name ?? "Unnamed business"}
                  </h2>

                  {selectedBusiness.featured && (
                    <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-400">
                      Featured
                    </span>
                  )}

                  {selectedBusiness.city_sponsor && (
                    <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-400">
                      City Sponsor
                    </span>
                  )}

                  {selectedBusiness.mosque_sponsor && (
                    <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-400">
                      Mosque Sponsor
                    </span>
                  )}
                </div>

                <div className="mt-2 text-white/60">
                  {[selectedBusiness.area, selectedBusiness.city, selectedBusiness.postcode]
                    .filter(Boolean)
                    .join(" • ") || "Location not set"}
                </div>
              </div>

              <div className="text-sm text-white/50">
                Paid until: {formatDate(selectedBusiness.paid_until)}
              </div>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
                  Subscription status
                </div>

                <div className="mt-4 space-y-2 text-sm text-white/80">
                  <div>
                    <span className="text-white/50">Current tier:</span>{" "}
                    {getTierLabel(selectedBusiness.pricing_tier)}
                  </div>

                  <div>
                    <span className="text-white/50">Subscription type:</span>{" "}
                    {getTierLabel(selectedBusiness.subscription_type)}
                  </div>

                  <div>
                    <span className="text-white/50">Featured placement:</span>{" "}
                    {selectedBusiness.featured ? "Active" : "Inactive"}
                  </div>

                  <div>
                    <span className="text-white/50">City sponsor:</span>{" "}
                    {selectedBusiness.city_sponsor ? "Active" : "Inactive"}
                  </div>

                  <div>
                    <span className="text-white/50">Mosque sponsor:</span>{" "}
                    {selectedBusiness.mosque_sponsor ? "Active" : "Inactive"}
                  </div>

                  <div>
                    <span className="text-white/50">Stripe customer:</span>{" "}
                    {selectedBusiness.stripe_customer_id ? "Connected" : "None"}
                  </div>

                  <div>
                    <span className="text-white/50">Stripe subscription:</span>{" "}
                    {selectedBusiness.stripe_subscription_id ?? "None"}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
                  Billing actions
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  {hasStripeAccess ? (
                    <form action={openBillingPortal}>
                      <input
                        type="hidden"
                        name="business_id"
                        value={selectedBusiness.id}
                      />

                      <button
                        type="submit"
                        className="rounded-xl bg-yellow-500 px-5 py-3 text-sm font-semibold text-black hover:bg-yellow-400"
                      >
                        Open Stripe billing portal
                      </button>
                    </form>
                  ) : (
                    <Link
                      href={`/advertise?business=${selectedBusiness.id}`}
                      className="rounded-xl bg-yellow-500 px-5 py-3 text-sm font-semibold text-black hover:bg-yellow-400"
                    >
                      Start subscription
                    </Link>
                  )}

                  <Link
                    href={`/advertise?business=${selectedBusiness.id}`}
                    className="rounded-xl border border-yellow-500/30 bg-black px-5 py-3 text-sm font-semibold text-yellow-400 hover:bg-yellow-500/10"
                  >
                    Upgrade / renew
                  </Link>

                  {selectedBusiness.slug && (
                    <Link
                      href={`/business/${selectedBusiness.slug}`}
                      className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/80 hover:bg-white/10"
                    >
                      View public listing
                    </Link>
                  )}

                  <Link
                    href={`/dashboard/business?business=${selectedBusiness.id}`}
                    className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/80 hover:bg-white/10"
                  >
                    Back to selected dashboard
                  </Link>
                </div>

                {!hasStripeAccess && (
                  <p className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/60">
                    Stripe billing portal becomes available after Stripe
                    customer details are attached to this business.
                  </p>
                )}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}