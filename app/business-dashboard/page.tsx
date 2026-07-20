import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

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

export const metadata: Metadata = {
  title: "Business Dashboard | SalahNearMe",
  description:
    "Manage your SalahNearMe halal business listing, advertising, analytics, profile, opening hours, media, and mosque sponsorship visibility.",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  searchParams?: Promise<{
    business_id?: string;
    business?: string;
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
  billing_provider?: string | null;
  paid_until: string | null;
  sponsorship_active: boolean | null;
  city_sponsor: boolean | null;
  mosque_sponsor: boolean | null;
  trust_score?: number | null;
  quality_score?: number | null;
  halal_score?: number | null;
  ranking_score?: number | null;
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
  business_id: string | null;
  role: string | null;
  businesses: Business | Business[] | null;
};

type MosqueUserRow = {
  mosque_id: string | null;
  role: string | null;
  mosques: Mosque | Mosque[] | null;
};

type LinkedBusiness = {
  business: Business;
  role: string | null;
};

type LinkedMosque = {
  mosque: Mosque;
  role: string | null;
};

const BUSINESS_SELECT = [
  "id",
  "name",
  "slug",
  "city",
  "area",
  "address",
  "postcode",
  "phone",
  "website",
  "maps_url",
  "description",
  "logo_url",
  "cover_image_url",
  "gallery_urls",
  "is_verified",
  "featured",
  "pricing_tier",
  "subscription_type",
  "subscription_status",
  "paid_until",
  "sponsorship_active",
  "city_sponsor",
  "mosque_sponsor",
  "opening_hours",
  "opening_hours_note",
  "created_at",
].join(",");

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getBusinessFromRow(row: BusinessUserRow): Business | null {
  if (Array.isArray(row.businesses)) {
    return row.businesses[0] ?? null;
  }

  return row.businesses ?? null;
}

function getMosqueFromRow(row: MosqueUserRow): Mosque | null {
  if (Array.isArray(row.mosques)) {
    return row.mosques[0] ?? null;
  }

  return row.mosques ?? null;
}

function isPaidActive(value: string | null | undefined) {
  if (!value) return false;

  const time = new Date(value).getTime();

  return Number.isFinite(time) && time > Date.now();
}

function label(value: string | null | undefined, fallback = "Free") {
  const cleaned = clean(value);

  if (!cleaned) return fallback;

  return cleaned
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not set";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function uniqueLinkedBusinesses(items: LinkedBusiness[]) {
  const seen = new Set<string>();
  const output: LinkedBusiness[] = [];

  for (const item of items) {
    if (!item.business.id || seen.has(item.business.id)) continue;

    seen.add(item.business.id);
    output.push(item);
  }

  return output.sort((a, b) =>
    (a.business.name ?? "").localeCompare(b.business.name ?? "")
  );
}

function normaliseGallery(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;

  return value.filter((item): item is string => typeof item === "string");
}

function normaliseBusiness(row: unknown): Business | null {
  if (!row || typeof row !== "object") return null;

  const value = row as Record<string, unknown>;
  const id = clean(value.id);

  if (!id) return null;

  return {
    id,
    name: typeof value.name === "string" ? value.name : null,
    slug: typeof value.slug === "string" ? value.slug : null,
    city: typeof value.city === "string" ? value.city : null,
    area: typeof value.area === "string" ? value.area : null,
    address: typeof value.address === "string" ? value.address : null,
    postcode: typeof value.postcode === "string" ? value.postcode : null,
    phone: typeof value.phone === "string" ? value.phone : null,
    website: typeof value.website === "string" ? value.website : null,
    maps_url: typeof value.maps_url === "string" ? value.maps_url : null,
    description:
      typeof value.description === "string" ? value.description : null,
    logo_url: typeof value.logo_url === "string" ? value.logo_url : null,
    cover_image_url:
      typeof value.cover_image_url === "string"
        ? value.cover_image_url
        : null,
    gallery_urls: normaliseGallery(value.gallery_urls),
    is_verified:
      typeof value.is_verified === "boolean" ? value.is_verified : false,
    featured: typeof value.featured === "boolean" ? value.featured : false,
    pricing_tier:
      typeof value.pricing_tier === "string" ? value.pricing_tier : "free",
    subscription_type:
      typeof value.subscription_type === "string"
        ? value.subscription_type
        : "free",
    subscription_status:
      typeof value.subscription_status === "string"
        ? value.subscription_status
        : "inactive",
    billing_provider:
      typeof value.billing_provider === "string"
        ? value.billing_provider
        : null,
    paid_until: typeof value.paid_until === "string" ? value.paid_until : null,
    sponsorship_active:
      typeof value.sponsorship_active === "boolean"
        ? value.sponsorship_active
        : false,
    city_sponsor:
      typeof value.city_sponsor === "boolean" ? value.city_sponsor : false,
    mosque_sponsor:
      typeof value.mosque_sponsor === "boolean"
        ? value.mosque_sponsor
        : false,
    trust_score: typeof value.trust_score === "number" ? value.trust_score : 0,
    quality_score:
      typeof value.quality_score === "number" ? value.quality_score : 0,
    halal_score: typeof value.halal_score === "number" ? value.halal_score : 0,
    ranking_score:
      typeof value.ranking_score === "number" ? value.ranking_score : 0,
    opening_hours:
      value.opening_hours && typeof value.opening_hours === "object"
        ? (value.opening_hours as OpeningHours)
        : null,
    opening_hours_note:
      typeof value.opening_hours_note === "string"
        ? value.opening_hours_note
        : null,
    created_at:
      typeof value.created_at === "string" ? value.created_at : null,
  };
}

async function getLinkedBusinesses(args: {
  userId: string;
  email: string | null;
}) {
  const supabase = await supabaseServer();
  const linked: LinkedBusiness[] = [];

  const { data: businessUserRowsRaw, error: businessUserError } = await supabase
    .from("business_users")
    .select(
      `
      business_id,
      role,
      businesses (
        ${BUSINESS_SELECT}
      )
    `
    )
    .eq("user_id", args.userId);

  if (businessUserError) {
    console.error("business_users dashboard lookup failed:", {
      message: businessUserError.message,
      details: businessUserError.details,
      hint: businessUserError.hint,
    });
  } else {
    for (const row of ((businessUserRowsRaw ?? []) as unknown) as BusinessUserRow[]) {
      const business = getBusinessFromRow(row);

      if (business?.id) {
        linked.push({
          business: normaliseBusiness(business) ?? business,
          role: row.role,
        });
      }
    }
  }

  const fallbackQueries = [
    supabase
      .from("businesses")
      .select(BUSINESS_SELECT)
      .eq("submitted_by_user_id", args.userId)
      .limit(50),
  ];

  if (args.email) {
    fallbackQueries.push(
      supabase
        .from("businesses")
        .select(BUSINESS_SELECT)
        .or(
          [
            `submitted_by_email.eq.${args.email}`,
            `claimed_by_email.eq.${args.email}`,
            `email.eq.${args.email}`,
          ].join(",")
        )
        .limit(50)
    );
  }

  const fallbackResults = await Promise.allSettled(fallbackQueries);

  for (const result of fallbackResults) {
    if (result.status !== "fulfilled") continue;

    const { data, error } = result.value;

    if (error) {
      console.error("business-dashboard fallback lookup failed:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      continue;
    }

    for (const row of data ?? []) {
      const business = normaliseBusiness(row);

      if (business?.id) {
        linked.push({
          business,
          role: "owner",
        });
      }
    }
  }

  return uniqueLinkedBusinesses(linked);
}

async function getLinkedMosques(userId: string) {
  const supabase = await supabaseServer();

  const { data, error } = await supabase
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
    .eq("user_id", userId);

  if (error) {
    console.error("mosque_users dashboard lookup failed:", {
      message: error.message,
      details: error.details,
      hint: error.hint,
    });

    return {
      linkedMosques: [] as LinkedMosque[],
      errorMessage: error.message,
    };
  }

  const linkedMosques = (((data ?? []) as unknown) as MosqueUserRow[])
    .map((row) => ({
      mosque: getMosqueFromRow(row),
      role: row.role,
    }))
    .filter((item): item is LinkedMosque => Boolean(item.mosque?.id))
    .sort((a, b) =>
      (a.mosque.name ?? "").localeCompare(b.mosque.name ?? "")
    );

  return {
    linkedMosques,
    errorMessage: null,
  };
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
            <span className="text-right font-semibold text-white">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyAccessState({ email }: { email: string | null }) {
  return (
    <div className="mx-auto max-w-4xl p-6 md:p-10">
      <div className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8 md:p-10">
        <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
          Business Dashboard
        </div>

        <h1 className="mt-4 text-4xl font-black text-white">
          No dashboard access found
        </h1>

        <p className="mt-4 max-w-3xl text-white/70">
          Your account is signed in
          {email ? (
            <>
              {" "}
              as <span className="font-semibold text-yellow-400">{email}</span>
            </>
          ) : null}
          , but it is not linked to a business or mosque listing yet.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
            <div className="font-bold text-white">Add a business</div>
            <p className="mt-2 text-sm text-white/60">
              Submit a new halal business for review.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
            <div className="font-bold text-white">Claim a listing</div>
            <p className="mt-2 text-sm text-white/60">
              Connect your account to an existing business.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
            <div className="font-bold text-white">Advertise</div>
            <p className="mt-2 text-sm text-white/60">
              Choose visibility after your business is linked.
            </p>
          </div>
        </div>

        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            href="/add-business"
            className="rounded-2xl bg-yellow-500 px-5 py-3 text-sm font-bold text-black hover:bg-yellow-400"
          >
            Add business
          </Link>

          <Link
            href="/businesses"
            className="rounded-2xl border border-yellow-500/30 bg-black px-5 py-3 text-sm font-bold text-yellow-400 hover:bg-yellow-500/10"
          >
            Browse businesses
          </Link>

          <Link
            href="/advertise"
            className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white/80 hover:bg-white/10"
          >
            Advertising options
          </Link>
        </div>
      </div>
    </div>
  );
}

export default async function BusinessDashboardPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const selectedBusinessId = clean(params?.business_id ?? params?.business);

  const supabase = await supabaseServer();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login?next=/business-dashboard");
  }

  const email = user.email?.toLowerCase() ?? null;

  const [linkedBusinesses, mosqueResult] = await Promise.all([
    getLinkedBusinesses({
      userId: user.id,
      email,
    }),
    getLinkedMosques(user.id),
  ]);

  const linkedMosques = mosqueResult.linkedMosques;

  if (linkedBusinesses.length === 0 && linkedMosques.length === 0) {
    return <EmptyAccessState email={email} />;
  }

  const selectedBusiness =
    linkedBusinesses.find((item) => item.business.id === selectedBusinessId)
      ?.business ??
    linkedBusinesses[0]?.business ??
    null;

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
          <section className="relative overflow-hidden rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8 md:p-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,0.16),transparent_36%)]" />

            <div className="relative z-10">
              <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
                Business Dashboard
              </div>

              <h1 className="mt-4 text-4xl font-black tracking-[-0.04em] text-white md:text-6xl">
                {selectedBusiness.name ?? "Business"}
              </h1>

              <p className="mt-4 max-w-3xl text-white/70">
                Manage your listing, sponsorships, analytics, AI insights,
                notifications, opening hours, payments, trust score, media, and
                visibility.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                {selectedBusiness.slug ? (
                  <Link
                    href={`/business/${selectedBusiness.slug}`}
                    target="_blank"
                    className="rounded-2xl bg-yellow-500 px-5 py-3 text-sm font-semibold text-black hover:bg-yellow-400"
                  >
                    View public listing
                  </Link>
                ) : null}

                <Link
                  href="/add-business"
                  className="rounded-2xl border border-yellow-500/30 bg-black px-5 py-3 text-sm font-semibold text-yellow-400 hover:bg-yellow-500/10"
                >
                  Add another business
                </Link>

                <Link
                  href="/advertise"
                  className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
                >
                  Advertising options
                </Link>
              </div>
            </div>
          </section>

          {linkedBusinesses.length > 1 ? (
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
          ) : null}

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

        {mosqueResult.errorMessage ? (
          <div className="mt-6 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-5 text-sm text-yellow-100">
            Mosque access could not be loaded right now. Business dashboard
            access is still available.
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