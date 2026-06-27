import Link from "next/link";
import { supabaseServer } from "@/lib/supabaseServer";

import BusinessProfileEditor from "@/components/BusinessProfileEditor";
import BusinessDashboardAnalytics from "@/components/BusinessDashboardAnalytics";
import BusinessDashboardNotifications from "@/components/BusinessDashboardNotifications";
import BusinessDashboardSwitcher from "@/components/BusinessDashboardSwitcher";
import BusinessOpeningHoursEditor from "@/components/BusinessOpeningHoursEditor";
import BusinessUpgradePlans from "@/components/BusinessUpgradePlans";
import BusinessAnalyticsSummary from "@/components/BusinessAnalyticsSummary";
import BusinessAIInsights from "@/components/BusinessAIInsights";
import BusinessLeadsInbox from "@/components/BusinessLeadsInbox";
import BusinessImageUploader from "@/components/BusinessImageUploader";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  searchParams?: Promise<{
    business_id?: string;
  }>;
};

type OpeningHours = Record<string, unknown>;

type Business = {
  id: string;

  name: string | null;
  slug: string | null;

  city: string | null;
  area: string | null;

  address: string | null;
  postcode: string | null;

  phone: string | null;
  website: string | null;
  maps_url: string | null;

  description: string | null;

  logo_url: string | null;
  cover_image_url: string | null;
  gallery_urls: string[] | null;

  is_verified: boolean | null;
  featured: boolean | null;

  pricing_tier: string | null;
  subscription_type: string | null;
  subscription_status: string | null;

  billing_provider: string | null;
  paid_until: string | null;

  sponsorship_active: boolean | null;
  city_sponsor: boolean | null;
  mosque_sponsor: boolean | null;

  trust_score: number | null;
  quality_score: number | null;
  halal_score: number | null;
  ranking_score: number | null;

  opening_hours: OpeningHours | null;
  opening_hours_note: string | null;

  created_at: string | null;
};

type Mosque = {
  id: string;
  name: string | null;
  slug: string | null;
  city: string | null;
  area: string | null;
  postcode: string | null;
  verified_status: string | null;
};

type BusinessUserRow = {
  business_id: string;
  role: string | null;
  businesses: Business | Business[] | null;
};

type MosqueUserRow = {
  mosque_id: string;
  role: string | null;
  mosques: Mosque | Mosque[] | null;
};

function getBusinessFromRow(row: BusinessUserRow): Business | null {
  return Array.isArray(row.businesses)
    ? row.businesses[0] ?? null
    : row.businesses ?? null;
}

function getMosqueFromRow(row: MosqueUserRow): Mosque | null {
  return Array.isArray(row.mosques)
    ? row.mosques[0] ?? null
    : row.mosques ?? null;
}

function isPaidActive(value: string | null | undefined) {
  if (!value) return false;

  const time = new Date(value).getTime();

  return Number.isFinite(time) && time > Date.now();
}

function label(value: string | null | undefined, fallback = "Free") {
  if (!value) return fallback;

  return value
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not set";

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function BusinessDashboardPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const selectedBusinessId = params?.business_id ?? null;

  const supabase = await supabaseServer();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return (
      <div className="mx-auto max-w-3xl p-10">
        <div className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-10">
          <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
            Business Dashboard
          </div>

          <h1 className="mt-4 text-4xl font-black text-white">
            Sign in required
          </h1>

          <p className="mt-4 text-white/70">
            Sign in with the account linked to your business or mosque before
            viewing the dashboard.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/login?next=/business-dashboard"
              className="rounded-2xl bg-yellow-500 px-5 py-3 text-sm font-semibold text-black hover:bg-yellow-400"
            >
              Sign in
            </Link>

            <Link
              href="/business-claim"
              className="rounded-2xl border border-yellow-500/30 px-5 py-3 text-sm font-semibold text-yellow-400 hover:bg-yellow-500/10"
            >
              Claim a business
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { data: businessUserRowsRaw, error: businessUserError } = await supabase
    .from("business_users")
    .select(
      `
      business_id,
      role,
      businesses (
        id,
        name,
        slug,
        city,
        area,
        address,
        postcode,
        phone,
        website,
        maps_url,
        description,
        logo_url,
        cover_image_url,
        gallery_urls,
        is_verified,
        featured,
        pricing_tier,
        subscription_type,
        subscription_status,
        billing_provider,
        paid_until,
        sponsorship_active,
        city_sponsor,
        mosque_sponsor,
        trust_score,
        quality_score,
        halal_score,
        ranking_score,
        opening_hours,
        opening_hours_note,
        created_at
      )
    `
    )
    .eq("user_id", user.id);

  if (businessUserError) {
    return (
      <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-8 text-red-200">
        {businessUserError.message}
      </div>
    );
  }

  const { data: mosqueUserRowsRaw, error: mosqueUserError } = await supabase
    .from("mosque_users")
    .select(
      `
      mosque_id,
      role,
      mosques (
        id,
        name,
        slug,
        city,
        area,
        postcode,
        verified_status
      )
    `
    )
    .eq("user_id", user.id);

  const linkedMosques = mosqueUserError
    ? []
    : ((mosqueUserRowsRaw ?? []) as MosqueUserRow[])
        .map((row) => ({
          mosque: getMosqueFromRow(row),
          role: row.role,
        }))
        .filter((item): item is { mosque: Mosque; role: string | null } =>
          Boolean(item.mosque?.id)
        )
        .sort((a, b) =>
          (a.mosque.name ?? "").localeCompare(b.mosque.name ?? "")
        );

  const linkedBusinesses = ((businessUserRowsRaw ?? []) as BusinessUserRow[])
    .map((row) => ({
      business: getBusinessFromRow(row),
      role: row.role,
    }))
    .filter((item): item is { business: Business; role: string | null } =>
      Boolean(item.business?.id)
    )
    .sort((a, b) =>
      (a.business.name ?? "").localeCompare(b.business.name ?? "")
    );

  if (linkedBusinesses.length === 0 && linkedMosques.length === 0) {
    return (
      <div className="mx-auto max-w-3xl p-10">
        <div className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-10">
          <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
            SalahNearMe
          </div>

          <h1 className="mt-4 text-4xl font-black text-white">
            No dashboard access found
          </h1>

          <p className="mt-4 text-white/70">
            Your account is signed in, but it is not linked to a business or
            mosque listing yet.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/business-claim"
              className="inline-flex rounded-2xl bg-yellow-500 px-5 py-3 text-sm font-semibold text-black hover:bg-yellow-400"
            >
              Claim a business
            </Link>

            <Link
              href="/mosque"
              className="inline-flex rounded-2xl border border-yellow-500/30 px-5 py-3 text-sm font-semibold text-yellow-400 hover:bg-yellow-500/10"
            >
              Find a mosque
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const selectedBusiness =
    linkedBusinesses.find((item) => item.business.id === selectedBusinessId)
      ?.business ?? linkedBusinesses[0]?.business ?? null;

  const selectedRole = selectedBusiness
    ? linkedBusinesses.find((item) => item.business.id === selectedBusiness.id)
        ?.role ?? "owner"
    : "owner";

  const paidActive = isPaidActive(selectedBusiness?.paid_until);

  const subscriptionLabel = label(
    selectedBusiness?.pricing_tier ?? selectedBusiness?.subscription_type,
    "Free"
  );

  const paymentLabel = paidActive
    ? selectedBusiness?.billing_provider
      ? `Active • ${label(selectedBusiness.billing_provider)}`
      : "Active"
    : "Inactive";

  return (
    <div className="space-y-8">
      {selectedBusiness ? (
        <>
          <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8 md:p-10">
            <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
              Business Dashboard
            </div>

            <h1 className="mt-4 text-4xl font-black tracking-[-0.04em] text-white md:text-6xl">
              {selectedBusiness.name ?? "Business"}
            </h1>

            <p className="mt-4 max-w-3xl text-white/70">
              Manage your listing, sponsorships, analytics, AI insights,
              notifications, opening hours, payments, trust score, and
              visibility.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              {selectedBusiness.slug && (
                <Link
                  href={`/business/${selectedBusiness.slug}`}
                  target="_blank"
                  className="rounded-2xl bg-yellow-500 px-5 py-3 text-sm font-semibold text-black hover:bg-yellow-400"
                >
                  View public listing
                </Link>
              )}

              <Link
                href="/"
                className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-semibold text-white hover:bg-white/5"
              >
                Back to website
              </Link>
            </div>
          </section>

          {linkedBusinesses.length > 1 && (
            <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
                    Your Businesses
                  </div>

                  <h2 className="mt-2 text-2xl font-black text-white">
                    {linkedBusinesses.length} linked listings
                  </h2>

                  <p className="mt-2 text-sm text-white/60">
                    Select which business you want to manage.
                  </p>
                </div>

                <div className="w-full lg:max-w-md">
                  <BusinessDashboardSwitcher
                    selectedBusinessId={selectedBusiness.id}
                    businesses={linkedBusinesses.map((item) => ({
                      id: item.business.id,
                      name: item.business.name ?? "Unnamed business",
                      city: item.business.city,
                    }))}
                  />
                </div>
              </div>
            </section>
          )}

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <DashboardCard
              title="Verification"
              value={selectedBusiness.is_verified ? "Verified" : "Pending"}
            />

            <DashboardCard
              title="Featured"
              value={
                selectedBusiness.featured && paidActive ? "Active" : "Inactive"
              }
            />

            <DashboardCard title="Subscription" value={subscriptionLabel} />

            <DashboardCard title="Payment" value={paymentLabel} />
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <DashboardCard
              title="Trust Score"
              value={String(selectedBusiness.trust_score ?? 0)}
            />

            <DashboardCard
              title="Quality Score"
              value={String(selectedBusiness.quality_score ?? 0)}
            />

            <DashboardCard
              title="Halal Score"
              value={String(selectedBusiness.halal_score ?? 0)}
            />

            <DashboardCard
              title="Ranking Score"
              value={String(selectedBusiness.ranking_score ?? 0)}
            />
          </section>

          <section className="grid gap-6 lg:grid-cols-3">
            <StatusPanel
              title="Billing"
              items={[
                ["Provider", label(selectedBusiness.billing_provider, "None")],
                [
                  "Status",
                  label(selectedBusiness.subscription_status, "Inactive"),
                ],
                ["Paid until", formatDate(selectedBusiness.paid_until)],
              ]}
            />

            <StatusPanel
              title="Sponsorship"
              items={[
                [
                  "City sponsor",
                  selectedBusiness.city_sponsor ? "Active" : "Inactive",
                ],
                [
                  "Mosque sponsor",
                  selectedBusiness.mosque_sponsor ? "Active" : "Inactive",
                ],
                [
                  "Sponsorship",
                  selectedBusiness.sponsorship_active ? "Active" : "Inactive",
                ],
              ]}
            />

            <StatusPanel
              title="Listing"
              items={[
                ["Dashboard role", label(selectedRole, "Owner")],
                ["City", selectedBusiness.city ?? "Not set"],
                ["Created", formatDate(selectedBusiness.created_at)],
              ]}
            />
          </section>

          <BusinessAnalyticsSummary businessId={selectedBusiness.id} />

          <BusinessAIInsights businessId={selectedBusiness.id} />

          <BusinessLeadsInbox businessId={selectedBusiness.id} />

          <BusinessUpgradePlans businessId={selectedBusiness.id} />

          <BusinessDashboardAnalytics businessId={selectedBusiness.id} />

          <BusinessDashboardNotifications businessId={selectedBusiness.id} />

          <BusinessProfileEditor business={selectedBusiness} />

          <BusinessOpeningHoursEditor
            businessId={selectedBusiness.id}
            initialHours={selectedBusiness.opening_hours}
            initialNote={selectedBusiness.opening_hours_note}
          />

          <BusinessImageUploader
            businessId={selectedBusiness.id}
            currentLogo={selectedBusiness.logo_url}
            currentCover={selectedBusiness.cover_image_url}
            currentGallery={selectedBusiness.gallery_urls ?? []}
          />
        </>
      ) : null}

      <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
              Mosque Dashboard
            </div>

            <h2 className="mt-3 text-3xl font-black text-white">
              Your Mosques
            </h2>

            <p className="mt-3 max-w-3xl text-white/70">
              Manage mosque prayer times, Jumuʿah sessions, facilities, live
              status, and public mosque page details.
            </p>
          </div>
        </div>

        {mosqueUserError ? (
          <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-200">
            Could not load mosque access: {mosqueUserError.message}
          </div>
        ) : linkedMosques.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-6 text-white/60">
            No mosque access found for this account yet.
          </div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {linkedMosques.map(({ mosque, role }) => (
              <div
                key={mosque.id}
                className="rounded-3xl border border-white/10 bg-black/30 p-6"
              >
                <div className="text-lg font-bold text-white">
                  {mosque.name ?? "Mosque"}
                </div>

                <div className="mt-2 text-sm text-white/60">
                  {[mosque.area, mosque.city, mosque.postcode]
                    .filter(Boolean)
                    .join(" • ") || "Location not set"}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full border border-yellow-500/20 bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-300">
                    {label(role, "Manager")}
                  </span>

                  {mosque.verified_status ? (
                    <span className="rounded-full border border-green-500/20 bg-green-500/10 px-3 py-1 text-xs font-semibold text-green-300">
                      {label(mosque.verified_status, "Verified")}
                    </span>
                  ) : null}
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <Link
                    href={`/business-dashboard/mosques/${mosque.id}/prayer-times`}
                    className="rounded-xl bg-yellow-500 px-4 py-2 text-xs font-bold text-black hover:bg-yellow-400"
                  >
                    Edit prayer times
                  </Link>

                  <Link
                    href={`/business-dashboard/mosques/${mosque.id}/jumuah-times`}
                    className="rounded-xl border border-yellow-500/30 bg-black px-4 py-2 text-xs font-bold text-yellow-400 hover:bg-yellow-500/10"
                  >
                    Edit Jumuʿah
                  </Link>

                  {mosque.slug ? (
                    <Link
                      href={`/mosque/${mosque.slug}`}
                      target="_blank"
                      className="rounded-xl border border-yellow-500/30 bg-black px-4 py-2 text-xs font-bold text-yellow-400 hover:bg-yellow-500/10"
                    >
                      View public page
                    </Link>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-white/10 bg-[rgb(var(--card))] p-8">
        <div className="text-lg font-bold text-white">Launch Roadmap</div>

        <div className="mt-6 grid gap-3 text-sm text-white/70 md:grid-cols-2">
          <div>• Image uploads</div>
          <div>• Campaign manager</div>
          <div>• Ramadan visibility tools</div>
          <div>• Sponsor analytics</div>
          <div>• Public opening-hours badges</div>
          <div>• Business lead inbox</div>
          <div>• Mosque prayer times editor</div>
          <div>• Jumuʿah times editor</div>
        </div>
      </section>
    </div>
  );
}

function DashboardCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[rgb(var(--card))] p-6">
      <div className="text-xs uppercase tracking-[0.2em] text-yellow-400">
        {title}
      </div>

      <div className="mt-4 text-2xl font-black text-white">{value}</div>
    </div>
  );
}

function StatusPanel({
  title,
  items,
}: {
  title: string;
  items: Array<[string, string]>;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[rgb(var(--card))] p-6">
      <div className="text-lg font-bold text-white">{title}</div>

      <div className="mt-5 space-y-3 text-sm text-white/70">
        {items.map(([labelText, value]) => (
          <div key={labelText} className="flex justify-between gap-4">
            <span>{labelText}</span>
            <span className="font-semibold text-white">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

