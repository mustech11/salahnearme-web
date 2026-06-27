import type { Metadata } from "next";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabaseServer";
import { buildCampaignIntelligence } from "@/lib/campaignIntelligence";

export const metadata: Metadata = {
  title: "Admin Campaigns | SalahNearMe",
  description: "Review and manage advertising campaigns on SalahNearMe.",
};

export const revalidate = 0;

type CampaignRow = {
  id: string;
  advertising_type: string | null;
  selected_city_id: number | null;
  selected_mosque_id: string | null;
  selected_mosque_ids: string[] | null;
  selected_city_ids: number[] | null;
  notes: string | null;
  status: string | null;
  payment_status: string | null;
  activated_at: string | null;
  paid_until: string | null;
  created_at: string;
};

type CityRow = {
  id: number;
  name: string;
};

type MosqueRow = {
  id: string;
  name: string | null;
  city: string | null;
  area: string | null;
};

type BusinessRow = {
  id: string;
  name: string | null;
  city: string | null;
  pricing_tier: string | null;
  featured_rank: number | null;
  featured: boolean | null;
  is_verified: boolean | null;
  paid_until: string | null;
  sponsor_mosque_id: string | null;
};

function formatCampaignType(value: string | null) {
  switch (value) {
    case "mosque_sponsor":
      return "Mosque Sponsor";
    case "city_featured":
      return "City Featured";
    case "multi_mosque":
      return "Multi-Mosque";
    case "multi_city":
      return "Multi-City";
    default:
      return value ?? "Campaign";
  }
}

function badgeClass(status: string | null) {
  if (status === "active") {
    return "border border-green-500/30 bg-green-500/10 text-green-300";
  }

  if (status === "rejected" || status === "expired") {
    return "border border-red-500/30 bg-red-500/10 text-red-300";
  }

  return "border border-yellow-500/30 bg-yellow-500/10 text-yellow-400";
}

async function rejectCampaign(formData: FormData) {
  "use server";

  const campaignId = String(formData.get("campaign_id") ?? "").trim();

  if (!campaignId) {
    throw new Error("Missing campaign ID");
  }

  const supabase = await supabaseServer();

  const { error } = await supabase
    .from("advertising_campaign_requests")
    .update({ status: "rejected" })
    .eq("id", campaignId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/campaigns");
}

async function applyCampaignChanges(formData: FormData) {
  "use server";

  const payload = {
    campaign_id: String(formData.get("campaign_id") ?? "").trim(),
    business_id: String(formData.get("business_id") ?? "").trim(),
    pricing_tier: String(formData.get("pricing_tier") ?? "").trim(),
    featured_rank: String(formData.get("featured_rank") ?? "").trim(),
    sponsor_mosque_id: String(formData.get("sponsor_mosque_id") ?? "").trim(),
    duration_days: String(formData.get("duration_days") ?? "").trim(),
  };

  if (!payload.campaign_id || !payload.business_id || !payload.pricing_tier) {
    throw new Error("Missing required campaign fields");
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";

  const res = await fetch(`${baseUrl}/api/admin/campaigns/activate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      campaign_id: payload.campaign_id,
      business_id: payload.business_id,
      pricing_tier: payload.pricing_tier,
      featured_rank: payload.featured_rank
        ? Number(payload.featured_rank)
        : null,
      sponsor_mosque_id: payload.sponsor_mosque_id || null,
      duration_days: payload.duration_days ? Number(payload.duration_days) : 30,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "Could not apply campaign changes");
  }

  revalidatePath("/admin/campaigns");
}

async function runCleanupNow() {
  "use server";

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";

  const res = await fetch(`${baseUrl}/api/admin/campaigns/cleanup-expired`, {
    method: "POST",
    cache: "no-store",
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "Could not run cleanup");
  }

  revalidatePath("/admin/campaigns");
}

export default async function AdminCampaignsPage() {
  const supabase = await supabaseServer();

  const [
    { data: campaignsRaw, error: campaignsError },
    { data: citiesRaw, error: citiesError },
    { data: mosquesRaw, error: mosquesError },
    { data: businessesRaw, error: businessesError },
  ] = await Promise.all([
    supabase
      .from("advertising_campaign_requests")
      .select(
        "id,advertising_type,selected_city_id,selected_mosque_id,selected_mosque_ids,selected_city_ids,notes,status,payment_status,activated_at,paid_until,created_at"
      )
      .order("created_at", { ascending: false }),

    supabase.from("cities").select("id,name").order("name"),

    supabase.from("mosques").select("id,name,city,area").order("name"),

    supabase
      .from("businesses")
      .select(
        "id,name,city,pricing_tier,featured_rank,featured,is_verified,paid_until,sponsor_mosque_id"
      )
      .eq("status", "approved")
      .eq("can_advertise", true)
      .order("name"),
  ]);

  if (campaignsError) {
    return <pre className="text-white/80">{campaignsError.message}</pre>;
  }

  if (citiesError) {
    return <pre className="text-white/80">{citiesError.message}</pre>;
  }

  if (mosquesError) {
    return <pre className="text-white/80">{mosquesError.message}</pre>;
  }

  if (businessesError) {
    return <pre className="text-white/80">{businessesError.message}</pre>;
  }

  const campaigns = (campaignsRaw ?? []) as CampaignRow[];
  const cities = (citiesRaw ?? []) as CityRow[];
  const mosques = (mosquesRaw ?? []) as MosqueRow[];
  const businesses = (businessesRaw ?? []) as BusinessRow[];

  const cityMap = new Map(cities.map((c) => [c.id, c.name]));
  const mosqueMap = new Map(
    mosques.map((m) => [
      m.id,
      [m.name, m.area, m.city].filter(Boolean).join(" • "),
    ])
  );

  const intelligenceAlerts = buildCampaignIntelligence({
    campaigns,
    businesses,
    mosques,
    cities,
  });

  const draftCount = campaigns.filter(
    (c) => !c.status || c.status === "draft"
  ).length;
  const activeCount = campaigns.filter((c) => c.status === "active").length;
  const rejectedCount = campaigns.filter((c) => c.status === "rejected").length;

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
              Admin
            </div>

            <h1 className="mt-3 text-4xl font-bold text-white">
              Campaign dashboard
            </h1>

            <p className="mt-3 max-w-3xl text-white/70">
              Review advertising requests, manage active placements, and control
              featured rankings across SalahNearMe.
            </p>
          </div>

          <form action={runCleanupNow}>
            <button
              type="submit"
              className="rounded-xl border border-yellow-500/30 bg-black px-5 py-3 text-sm font-semibold text-yellow-400 hover:bg-yellow-500/10"
            >
              Run expiry cleanup now
            </button>
          </form>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-yellow-400">
              Draft
            </div>
            <div className="mt-2 text-2xl font-bold text-white">
              {draftCount}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-yellow-400">
              Active
            </div>
            <div className="mt-2 text-2xl font-bold text-white">
              {activeCount}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-yellow-400">
              Rejected
            </div>
            <div className="mt-2 text-2xl font-bold text-white">
              {rejectedCount}
            </div>
          </div>
        </div>

        <div className="mt-6">
          <Link
            href="/admin"
            className="text-sm font-medium text-yellow-400 hover:text-yellow-300"
          >
            ← Back to admin
          </Link>
        </div>
      </section>

      <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
              Intelligence
            </div>
            <h2 className="mt-3 text-2xl font-bold text-white">
              Automated campaign insights
            </h2>
            <p className="mt-2 max-w-3xl text-white/70">
              SalahNearMe is scanning campaign health, rank issues, expiry risk,
              and monetisation opportunities across the platform.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {intelligenceAlerts.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-black/30 p-5 text-white/60">
              No major issues detected right now.
            </div>
          ) : (
            intelligenceAlerts.map((alert, index) => (
              <div
                key={`${alert.type}-${index}`}
                className="rounded-2xl border border-white/10 bg-black/30 p-5"
              >
                <div
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                    alert.level === "high"
                      ? "border border-red-500/30 bg-red-500/10 text-red-300"
                      : alert.level === "medium"
                      ? "border border-yellow-500/30 bg-yellow-500/10 text-yellow-400"
                      : "border border-green-500/30 bg-green-500/10 text-green-300"
                  }`}
                >
                  {alert.level}
                </div>

                <div className="mt-4 text-lg font-semibold text-white">
                  {alert.title}
                </div>

                <p className="mt-2 text-sm text-white/70">
                  {alert.description}
                </p>
              </div>
            ))
          )}
        </div>
      </section>

      {campaigns.length === 0 ? (
        <section className="rounded-3xl border border-white/10 bg-[rgb(var(--card))] p-8 text-white/60">
          No campaign requests found yet.
        </section>
      ) : (
        <div className="space-y-6">
          {campaigns.map((campaign) => {
            const selectedCityName = campaign.selected_city_id
              ? cityMap.get(campaign.selected_city_id) ?? "Unknown city"
              : null;

            const selectedMosqueName = campaign.selected_mosque_id
              ? mosqueMap.get(campaign.selected_mosque_id) ?? "Unknown mosque"
              : null;

            const selectedMosqueNames = (campaign.selected_mosque_ids ?? [])
              .map((id) => mosqueMap.get(id))
              .filter(Boolean) as string[];

            const selectedCityNames = (campaign.selected_city_ids ?? [])
              .map((id) => cityMap.get(id))
              .filter(Boolean) as string[];

            const cityScopedBusinesses = selectedCityName
              ? businesses.filter((b) => b.city === selectedCityName)
              : businesses;

            const cityScopedMosques = selectedCityName
              ? mosques.filter((m) => m.city === selectedCityName)
              : mosques;

            const isDraft = !campaign.status || campaign.status === "draft";

            return (
              <section
                key={campaign.id}
                className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="text-2xl font-semibold text-white">
                        {formatCampaignType(campaign.advertising_type)}
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClass(
                          campaign.status
                        )}`}
                      >
                        {campaign.status ?? "draft"}
                      </span>

                      {campaign.payment_status && (
                        <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/70">
                          Payment: {campaign.payment_status}
                        </span>
                      )}
                    </div>

                    <div className="mt-2 text-sm text-white/50">
                      Created {new Date(campaign.created_at).toLocaleString()}
                    </div>
                  </div>

                  <div className="text-xs text-white/40">{campaign.id}</div>
                </div>

                <div className="mt-6 grid gap-6 lg:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                    <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
                      Campaign details
                    </div>

                    <div className="mt-4 space-y-2 text-sm text-white/80">
                      {selectedCityName && (
                        <div>
                          <span className="text-white/50">City:</span>{" "}
                          {selectedCityName}
                        </div>
                      )}

                      {selectedMosqueName && (
                        <div>
                          <span className="text-white/50">Mosque:</span>{" "}
                          {selectedMosqueName}
                        </div>
                      )}

                      {selectedCityNames.length > 0 && (
                        <div>
                          <span className="text-white/50">Cities:</span>{" "}
                          {selectedCityNames.join(", ")}
                        </div>
                      )}

                      {selectedMosqueNames.length > 0 && (
                        <div>
                          <span className="text-white/50">Mosques:</span>{" "}
                          {selectedMosqueNames.join(" | ")}
                        </div>
                      )}

                      {campaign.activated_at && (
                        <div>
                          <span className="text-white/50">Activated:</span>{" "}
                          {new Date(campaign.activated_at).toLocaleString()}
                        </div>
                      )}

                      {campaign.paid_until && (
                        <div>
                          <span className="text-white/50">Paid until:</span>{" "}
                          {new Date(campaign.paid_until).toLocaleString()}
                        </div>
                      )}

                      {campaign.notes && (
                        <div className="pt-2">
                          <div className="text-white/50">Notes:</div>
                          <div className="mt-1">{campaign.notes}</div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                    <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
                      Placement controls
                    </div>

                    {isDraft ? (
                      <form action={applyCampaignChanges} className="mt-4 grid gap-4">
                        <input
                          type="hidden"
                          name="campaign_id"
                          value={campaign.id}
                        />

                        <div>
                          <label
                            htmlFor={`business-${campaign.id}`}
                            className="mb-2 block text-sm font-medium text-white/80"
                          >
                            Business
                          </label>
                          <select
                            id={`business-${campaign.id}`}
                            name="business_id"
                            defaultValue=""
                            className="w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none focus:border-yellow-400"
                            required
                          >
                            <option value="">Select business</option>
                            {cityScopedBusinesses.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.name}
                                {b.city ? ` • ${b.city}` : ""}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <label
                              htmlFor={`tier-${campaign.id}`}
                              className="mb-2 block text-sm font-medium text-white/80"
                            >
                              Tier
                            </label>
                            <select
                              id={`tier-${campaign.id}`}
                              name="pricing_tier"
                              defaultValue="silver"
                              className="w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none focus:border-yellow-400"
                            >
                              <option value="bronze">Bronze</option>
                              <option value="silver">Silver</option>
                              <option value="gold">Gold</option>
                              <option value="platinum">Platinum</option>
                            </select>
                          </div>

                          <div>
                            <label
                              htmlFor={`rank-${campaign.id}`}
                              className="mb-2 block text-sm font-medium text-white/80"
                            >
                              Featured rank
                            </label>
                            <input
                              id={`rank-${campaign.id}`}
                              name="featured_rank"
                              type="number"
                              min="1"
                              placeholder="e.g. 1"
                              className="w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none focus:border-yellow-400"
                            />
                          </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <label
                              htmlFor={`mosque-${campaign.id}`}
                              className="mb-2 block text-sm font-medium text-white/80"
                            >
                              Sponsor mosque
                            </label>
                            <select
                              id={`mosque-${campaign.id}`}
                              name="sponsor_mosque_id"
                              defaultValue={campaign.selected_mosque_id ?? ""}
                              className="w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none focus:border-yellow-400"
                            >
                              <option value="">No mosque sponsorship</option>
                              {cityScopedMosques.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {[m.name, m.area, m.city]
                                    .filter(Boolean)
                                    .join(" • ")}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label
                              htmlFor={`duration-${campaign.id}`}
                              className="mb-2 block text-sm font-medium text-white/80"
                            >
                              Duration
                            </label>
                            <select
                              id={`duration-${campaign.id}`}
                              name="duration_days"
                              defaultValue="30"
                              className="w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none focus:border-yellow-400"
                            >
                              <option value="30">30 days</option>
                              <option value="60">60 days</option>
                              <option value="90">90 days</option>
                            </select>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-3 pt-2">
                          <button
                            type="submit"
                            className="rounded-xl bg-yellow-500 px-5 py-3 text-sm font-semibold text-black hover:bg-yellow-400"
                          >
                            Activate campaign
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="mt-4 text-sm text-white/70">
                        This campaign is no longer in draft mode. Use the
                        business records and payment dates above to monitor its
                        current state.
                      </div>
                    )}
                  </div>
                </div>

                {isDraft && (
                  <div className="mt-6">
                    <form action={rejectCampaign}>
                      <input
                        type="hidden"
                        name="campaign_id"
                        value={campaign.id}
                      />
                      <button
                        type="submit"
                        className="rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-3 text-sm font-semibold text-red-300 hover:bg-red-500/20"
                      >
                        Reject campaign
                      </button>
                    </form>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

