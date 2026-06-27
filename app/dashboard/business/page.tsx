import type { Metadata } from "next";
import Link from "next/link";

import { requireUser } from "@/lib/auth";
import { buildBusinessOwnerInsights } from "@/lib/businessOwnerIntelligence";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const metadata: Metadata = {
  title: "Business Dashboard | SalahNearMe",
  description:
    "Manage your business presence, sponsorships, billing, visibility, and growth on SalahNearMe.",
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
  category: string | null;
  city: string | null;
  area: string | null;
  address: string | null;
  postcode: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  description: string | null;
  featured: boolean | null;
  featured_rank: number | null;
  pricing_tier: string | null;
  subscription_type: string | null;
  paid_until: string | null;
  sponsorship_active: boolean | null;
  city_sponsor: boolean | null;
  mosque_sponsor: boolean | null;
  sponsor_city_id: number | null;
  sponsor_mosque_id: string | null;
  is_verified: boolean | null;
  status: string | null;
  can_advertise: boolean | null;
  submitted_by_email: string | null;
  claimed_by_email: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
};

type MosqueRow = {
  id: string;
  name: string | null;
  city: string | null;
  area: string | null;
};

type CampaignRow = {
  id: string;
  business_id: string | null;
  advertising_type: string | null;
  status: string | null;
  payment_status: string | null;
  activated_at: string | null;
  paid_until: string | null;
  selected_mosque_id: string | null;
  selected_city_id: number | null;
  created_at: string;
  owner_email: string | null;
};

type InsightLevel = "high" | "medium" | "low";

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

function badgeClass(level: InsightLevel) {
  if (level === "high") {
    return "border border-red-500/30 bg-red-500/10 text-red-300";
  }

  if (level === "medium") {
    return "border border-yellow-500/30 bg-yellow-500/10 text-yellow-400";
  }

  return "border border-green-500/30 bg-green-500/10 text-green-300";
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

function isExpiringSoon(business: BusinessRow) {
  if (!business.paid_until) {
    return false;
  }

  const diff = new Date(business.paid_until).getTime() - Date.now();

  if (Number.isNaN(diff)) {
    return false;
  }

  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  return days >= 0 && days <= 7;
}

function getVisibilityLabel(business: BusinessRow) {
  if (isPremiumVisible(business)) {
    return "Premium active";
  }

  if (business.status === "approved") {
    return "Approved free listing";
  }

  if (business.status) {
    return getTierLabel(business.status);
  }

  return "Free listing";
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

function getSponsorLabel(business: BusinessRow) {
  if (business.city_sponsor) {
    return "City sponsor";
  }

  if (business.mosque_sponsor) {
    return "Mosque sponsor";
  }

  if (business.sponsorship_active) {
    return "Sponsor active";
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
    params.businesses.find((business) => business.status === "approved") ??
    params.businesses[0] ??
    null
  );
}

async function getOwnedBusinesses(ownerEmail: string) {
  const email = normaliseEmail(ownerEmail);

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
        "category",
        "city",
        "area",
        "address",
        "postcode",
        "phone",
        "email",
        "website",
        "description",
        "featured",
        "featured_rank",
        "pricing_tier",
        "subscription_type",
        "paid_until",
        "sponsorship_active",
        "city_sponsor",
        "mosque_sponsor",
        "sponsor_city_id",
        "sponsor_mosque_id",
        "is_verified",
        "status",
        "can_advertise",
        "submitted_by_email",
        "claimed_by_email",
        "stripe_customer_id",
        "stripe_subscription_id",
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

async function getMosques() {
  const { data, error } = await supabaseAdmin
    .from("mosques")
    .select("id,name,city,area")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as MosqueRow[];
}

async function getCampaigns(ownerEmail: string) {
  const email = normaliseEmail(ownerEmail);

  if (!email) {
    return [];
  }

  const { data, error } = await supabaseAdmin
    .from("advertising_campaign_requests")
    .select(
      [
        "id",
        "business_id",
        "advertising_type",
        "status",
        "payment_status",
        "activated_at",
        "paid_until",
        "selected_mosque_id",
        "selected_city_id",
        "created_at",
        "owner_email",
      ].join(",")
    )
    .eq("owner_email", email)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as CampaignRow[];
}

export default async function BusinessOwnerDashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireUser();
  const ownerEmail = user.email ?? "";
  const params = await searchParams;

  let businesses: BusinessRow[] = [];
  let mosques: MosqueRow[] = [];
  let campaigns: CampaignRow[] = [];
  let loadError: string | null = null;

  try {
    [businesses, mosques, campaigns] = await Promise.all([
      getOwnedBusinesses(ownerEmail),
      getMosques(),
      getCampaigns(ownerEmail),
    ]);
  } catch (error) {
    loadError =
      error instanceof Error ? error.message : "Could not load dashboard data.";
  }

  const selectedBusiness = selectBusiness({
    businesses,
    requestedBusinessId: params.business,
  });

  const mosqueMap = new Map(
    mosques.map((mosque) => [
      mosque.id,
      [mosque.name, mosque.area, mosque.city].filter(Boolean).join(" • "),
    ])
  );

  const insights = buildBusinessOwnerInsights({
    businesses,
    campaigns,
    mosques,
  });

  const approvedListings = businesses.filter(
    (business) => business.status === "approved"
  ).length;

  const featuredListings = businesses.filter((business) =>
    isPremiumVisible(business)
  ).length;

  const expiringSoon = businesses.filter(isExpiringSoon).length;

  const selectedCampaigns = selectedBusiness
    ? campaigns.filter((campaign) => campaign.business_id === selectedBusiness.id)
    : [];

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8 md:p-10">
        <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
          Business Dashboard
        </div>

        <h1 className="mt-3 text-4xl font-bold text-white md:text-5xl">
          {selectedBusiness?.name ?? "Manage your business"}
        </h1>

        <p className="mt-3 max-w-4xl text-white/70">
          Manage your listing, sponsorships, analytics, AI insights,
          notifications, opening hours, payments, trust score, and visibility.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          {selectedBusiness?.slug && (
            <Link
              href={`/business/${selectedBusiness.slug}`}
              className="rounded-xl bg-yellow-500 px-5 py-3 text-sm font-semibold text-black hover:bg-yellow-400"
            >
              View public listing
            </Link>
          )}

          <Link
            href="/"
            className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/80 hover:bg-white/10"
          >
            Back to website
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
            No businesses linked to this account yet
          </h2>

          <p className="mt-3 max-w-3xl text-white/60">
            Submit or claim a business first to unlock dashboard management.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/add-business"
              className="rounded-xl bg-yellow-500 px-5 py-3 text-sm font-semibold text-black hover:bg-yellow-400"
            >
              Add a business
            </Link>

            <Link
              href="/businesses"
              className="rounded-xl border border-yellow-500/30 bg-black px-5 py-3 text-sm font-semibold text-yellow-400 hover:bg-yellow-500/10"
            >
              Browse businesses
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
                  Your businesses
                </div>

                <h2 className="mt-3 text-3xl font-bold text-white">
                  {businesses.length} linked{" "}
                  {businesses.length === 1 ? "listing" : "listings"}
                </h2>

                <p className="mt-2 text-white/60">
                  Select which business you want to manage.
                </p>
              </div>

              <form
                action="/dashboard/business"
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
                Verification
              </div>
              <div className="mt-3 text-3xl font-bold text-white">
                {selectedBusiness.is_verified ? "Verified" : "Pending"}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-[rgb(var(--card))] p-6">
              <div className="text-xs uppercase tracking-[0.2em] text-yellow-400">
                Featured
              </div>
              <div className="mt-3 text-3xl font-bold text-white">
                {isPremiumVisible(selectedBusiness) ? "Active" : "Inactive"}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-[rgb(var(--card))] p-6">
              <div className="text-xs uppercase tracking-[0.2em] text-yellow-400">
                Subscription
              </div>
              <div className="mt-3 text-3xl font-bold text-white">
                {getTierLabel(selectedBusiness.pricing_tier)}
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
          </section>

          <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
                  Selected listing
                </div>

                <h2 className="mt-3 text-3xl font-bold text-white">
                  {selectedBusiness.name ?? "Unnamed business"}
                </h2>

                <p className="mt-2 text-white/60">
                  {[selectedBusiness.category, selectedBusiness.area, selectedBusiness.city]
                    .filter(Boolean)
                    .join(" • ") || "Location not set"}
                </p>

                <div className="mt-5 flex flex-wrap gap-2">
                  <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-400">
                    {getSponsorLabel(selectedBusiness)}
                  </span>

                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/70">
                    {getVisibilityLabel(selectedBusiness)}
                  </span>

                  {selectedBusiness.is_verified && (
                    <span className="rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-semibold text-green-300">
                      Verified
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
                  Listing status
                </div>

                <div className="mt-4 grid gap-3 text-sm text-white/80">
                  <div>
                    <span className="text-white/50">Status:</span>{" "}
                    {getTierLabel(selectedBusiness.status)}
                  </div>

                  <div>
                    <span className="text-white/50">Pricing tier:</span>{" "}
                    {getTierLabel(selectedBusiness.pricing_tier)}
                  </div>

                  <div>
                    <span className="text-white/50">Subscription type:</span>{" "}
                    {getTierLabel(selectedBusiness.subscription_type)}
                  </div>

                  <div>
                    <span className="text-white/50">Featured rank:</span>{" "}
                    {selectedBusiness.featured_rank ?? "—"}
                  </div>

                  <div>
                    <span className="text-white/50">Paid until:</span>{" "}
                    {formatDate(selectedBusiness.paid_until)}
                  </div>

                  <div>
                    <span className="text-white/50">Sponsored mosque:</span>{" "}
                    {selectedBusiness.sponsor_mosque_id
                      ? mosqueMap.get(selectedBusiness.sponsor_mosque_id) ??
                        "Unknown mosque"
                      : "None"}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              {selectedBusiness.slug && (
                <Link
                  href={`/business/${selectedBusiness.slug}`}
                  className="rounded-xl border border-yellow-500/30 bg-black px-5 py-3 text-sm font-semibold text-yellow-400 hover:bg-yellow-500/10"
                >
                  View public page
                </Link>
              )}

              <Link
                href={`/advertise?business=${selectedBusiness.id}`}
                className="rounded-xl bg-yellow-500 px-5 py-3 text-sm font-semibold text-black hover:bg-yellow-400"
              >
                Upgrade / renew campaign
              </Link>

              <Link
                href={`/dashboard/business/billing?business=${selectedBusiness.id}`}
                className="rounded-xl border border-yellow-500/30 bg-black px-5 py-3 text-sm font-semibold text-yellow-400 hover:bg-yellow-500/10"
              >
                Billing & subscriptions
              </Link>

              <Link
                href={`/claim/business/${selectedBusiness.slug ?? selectedBusiness.id}`}
                className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/80 hover:bg-white/10"
              >
                Claim / verify ownership
              </Link>
            </div>
          </section>

          <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
            <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
              Account summary
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-yellow-400">
                  Approved Listings
                </div>
                <div className="mt-2 text-2xl font-bold text-white">
                  {approvedListings}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-yellow-400">
                  Premium Active
                </div>
                <div className="mt-2 text-2xl font-bold text-white">
                  {featuredListings}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-yellow-400">
                  Expiring Soon
                </div>
                <div className="mt-2 text-2xl font-bold text-white">
                  {expiringSoon}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
            <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
              Intelligence
            </div>

            <h2 className="mt-3 text-2xl font-bold text-white">
              Growth and renewal insights
            </h2>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {insights.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/30 p-5 text-white/60">
                  No urgent issues detected right now.
                </div>
              ) : (
                insights.map((insight, index) => (
                  <div
                    key={`${insight.type}-${index}`}
                    className="rounded-2xl border border-white/10 bg-black/30 p-5"
                  >
                    <div
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${badgeClass(
                        insight.level
                      )}`}
                    >
                      {insight.level}
                    </div>

                    <div className="mt-4 text-lg font-semibold text-white">
                      {insight.title}
                    </div>

                    <p className="mt-2 text-sm text-white/70">
                      {insight.description}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
            <div className="text-xl font-semibold text-yellow-400">
              Recent activity for {selectedBusiness.name ?? "this business"}
            </div>

            <div className="mt-5 space-y-3">
              {selectedCampaigns.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-white/60">
                  No recent campaign activity found for this listing yet.
                </div>
              ) : (
                selectedCampaigns.slice(0, 8).map((campaign) => (
                  <div
                    key={campaign.id}
                    className="rounded-2xl border border-white/10 bg-black/30 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-white">
                          {getTierLabel(campaign.advertising_type)}
                        </div>
                        <div className="mt-1 text-sm text-white/60">
                          {campaign.payment_status ?? "pending"} •{" "}
                          {campaign.status ?? "draft"}
                        </div>
                      </div>

                      <div className="text-xs text-white/50">
                        {formatDate(campaign.created_at)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}