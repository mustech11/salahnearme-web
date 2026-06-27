import Link from "next/link";
import { supabaseServer } from "@/lib/supabaseServer";
import AdminGate from "@/components/AdminGate";

export const revalidate = 0;

type CheckStatus = "ready" | "warning" | "missing";

type Check = {
  title: string;
  status: CheckStatus;
  detail: string;
  href?: string;
  group:
    | "Data"
    | "Admin"
    | "Monetisation"
    | "SEO"
    | "Legal"
    | "Imports";
};

type CountResult = {
  count: number;
  available: boolean;
};

async function safeCount(
  query: PromiseLike<{ count: number | null; error: { message?: string } | null }>
): Promise<CountResult> {
  try {
    const result = await query;

    if (result.error) {
      return {
        count: 0,
        available: false,
      };
    }

    return {
      count: result.count ?? 0,
      available: true,
    };
  } catch {
    return {
      count: 0,
      available: false,
    };
  }
}

function getStatusStyle(status: CheckStatus) {
  if (status === "ready") {
    return "border-green-500/30 bg-green-500/10 text-green-300";
  }

  if (status === "warning") {
    return "border-yellow-500/30 bg-yellow-500/10 text-yellow-300";
  }

  return "border-red-500/30 bg-red-500/10 text-red-300";
}

function getLaunchScore(checks: Check[]) {
  if (checks.length === 0) return 0;

  const score = checks.reduce((total, check) => {
    if (check.status === "ready") return total + 2;
    if (check.status === "warning") return total + 1;
    return total;
  }, 0);

  return Math.round((score / (checks.length * 2)) * 100);
}

export default async function AdminLaunchChecklistPage() {
  const supabase = await supabaseServer();

  const [
    totalCities,
    citiesMissingCoordinates,
    citiesMissingTimezone,
    totalMosques,
    totalBusinesses,
    pendingAiActions,
    pendingBusinessClaims,
    pendingMosqueClaims,
    pendingCampaigns,
    activeCampaigns,
    duplicateQueue,
    importHistory,
  ] = await Promise.all([
    safeCount(
      supabase
        .from("cities")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true)
    ),

    safeCount(
      supabase
        .from("cities")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true)
        .or("latitude.is.null,longitude.is.null")
    ),

    safeCount(
      supabase
        .from("cities")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true)
        .is("timezone", null)
    ),

    safeCount(
      supabase
        .from("mosques")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true)
    ),

    safeCount(
      supabase
        .from("businesses")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true)
    ),

    safeCount(
      supabase
        .from("ai_admin_actions")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending")
    ),

    safeCount(
      supabase
        .from("business_claim_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending")
    ),

    safeCount(
      supabase
        .from("mosque_claim_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending")
    ),

    safeCount(
      supabase
        .from("advertising_campaign_requests")
        .select("*", { count: "exact", head: true })
        .or("status.is.null,status.eq.draft")
    ),

    safeCount(
      supabase
        .from("advertising_campaign_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "active")
    ),

    safeCount(
      supabase
        .from("mosque_duplicate_candidates")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending")
    ),

    safeCount(
      supabase.from("import_jobs").select("*", {
        count: "exact",
        head: true,
      })
    ),
  ]);

  const stripeReady =
    Boolean(process.env.STRIPE_SECRET_KEY) &&
    Boolean(process.env.STRIPE_WEBHOOK_SECRET);

  const metadataBaseReady = Boolean(process.env.NEXT_PUBLIC_SITE_URL);

  const checks: Check[] = [
    {
      group: "Data",
      title: "Active cities",
      status: totalCities.count > 0 ? "ready" : "missing",
      detail: totalCities.available
        ? `${totalCities.count} active cities found.`
        : "Cities table could not be checked.",
      href: "/admin/city-launch-readiness",
    },
    {
      group: "Data",
      title: "City coordinates",
      status:
        citiesMissingCoordinates.available &&
        citiesMissingCoordinates.count === 0
          ? "ready"
          : "warning",
      detail: !citiesMissingCoordinates.available
        ? "City coordinate check could not be completed."
        : citiesMissingCoordinates.count === 0
        ? "All active cities have coordinates."
        : `${citiesMissingCoordinates.count} active cities are missing latitude or longitude.`,
      href: "/admin/city-data-fix",
    },
    {
      group: "Data",
      title: "City timezones",
      status:
        citiesMissingTimezone.available && citiesMissingTimezone.count === 0
          ? "ready"
          : "warning",
      detail: !citiesMissingTimezone.available
        ? "City timezone check could not be completed."
        : citiesMissingTimezone.count === 0
        ? "All active cities have timezones."
        : `${citiesMissingTimezone.count} active cities are missing timezone values.`,
      href: "/admin/city-data-fix",
    },
    {
      group: "Data",
      title: "Mosque data",
      status: totalMosques.count > 0 ? "ready" : "missing",
      detail: totalMosques.available
        ? `${totalMosques.count} active mosques found.`
        : "Mosques table could not be checked.",
      href: "/admin/import-mosques",
    },
    {
      group: "Data",
      title: "Business data",
      status: totalBusinesses.count > 0 ? "ready" : "warning",
      detail: totalBusinesses.available
        ? `${totalBusinesses.count} active halal businesses found.`
        : "Businesses table could not be checked.",
      href: "/admin/import-businesses",
    },
    {
      group: "Imports",
      title: "Import history",
      status: !importHistory.available
        ? "warning"
        : importHistory.count > 0
        ? "ready"
        : "warning",
      detail: !importHistory.available
        ? "Optional import_jobs table not found or not accessible."
        : importHistory.count > 0
        ? `${importHistory.count} import jobs recorded.`
        : "No import jobs recorded yet.",
      href: "/admin/import",
    },
    {
      group: "Admin",
      title: "AI approval queue",
      status: pendingAiActions.count === 0 ? "ready" : "warning",
      detail: pendingAiActions.available
        ? pendingAiActions.count === 0
          ? "No pending AI actions."
          : `${pendingAiActions.count} AI actions waiting for approval.`
        : "AI actions table could not be checked.",
      href: "/admin/ai-actions",
    },
    {
      group: "Admin",
      title: "Mosque claims",
      status: !pendingMosqueClaims.available
        ? "warning"
        : pendingMosqueClaims.count === 0
        ? "ready"
        : "warning",
      detail: !pendingMosqueClaims.available
        ? "Optional mosque_claim_requests table not found or not accessible."
        : pendingMosqueClaims.count === 0
        ? "No pending mosque claims."
        : `${pendingMosqueClaims.count} mosque claims pending.`,
      href: "/admin/mosque-claims",
    },
    {
      group: "Admin",
      title: "Business claims",
      status: pendingBusinessClaims.count === 0 ? "ready" : "warning",
      detail: pendingBusinessClaims.available
        ? pendingBusinessClaims.count === 0
          ? "No pending business claims."
          : `${pendingBusinessClaims.count} business claims pending.`
        : "Business claims table could not be checked.",
      href: "/admin/business-claims",
    },
    {
      group: "Admin",
      title: "Duplicate queue",
      status: !duplicateQueue.available
        ? "warning"
        : duplicateQueue.count === 0
        ? "ready"
        : "warning",
      detail: !duplicateQueue.available
        ? "Optional mosque_duplicate_candidates table not found or not accessible."
        : duplicateQueue.count === 0
        ? "No pending duplicate mosque candidates."
        : `${duplicateQueue.count} duplicate mosque candidates need review.`,
      href: "/admin/mosque-duplicates",
    },
    {
      group: "Monetisation",
      title: "Campaign drafts",
      status: pendingCampaigns.count === 0 ? "ready" : "warning",
      detail: pendingCampaigns.available
        ? pendingCampaigns.count === 0
          ? "No draft campaign requests pending."
          : `${pendingCampaigns.count} draft campaign requests need review.`
        : "Campaign requests table could not be checked.",
      href: "/admin/campaigns",
    },
    {
      group: "Monetisation",
      title: "Active campaigns",
      status: activeCampaigns.count > 0 ? "ready" : "warning",
      detail: activeCampaigns.available
        ? activeCampaigns.count > 0
          ? `${activeCampaigns.count} active campaigns found.`
          : "No active campaigns yet."
        : "Active campaign check could not be completed.",
      href: "/admin/campaigns",
    },
    {
      group: "Monetisation",
      title: "Stripe environment",
      status: stripeReady ? "ready" : "warning",
      detail: stripeReady
        ? "Stripe secret key and webhook secret are configured."
        : "Check STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET before live payments.",
      href: "/admin/campaigns",
    },
    {
      group: "SEO",
      title: "Metadata base",
      status: metadataBaseReady ? "ready" : "warning",
      detail: metadataBaseReady
        ? "NEXT_PUBLIC_SITE_URL is configured."
        : "Set NEXT_PUBLIC_SITE_URL before production launch.",
      href: "/admin",
    },
    {
      group: "SEO",
      title: "Sitemap",
      status: "warning",
      detail:
        "Manually open sitemap.xml and confirm city, mosque, and business URLs are included.",
      href: "/sitemap.xml",
    },
    {
      group: "SEO",
      title: "Robots",
      status: "warning",
      detail:
        "Manually open robots.txt and confirm search engines can crawl public pages.",
      href: "/robots.txt",
    },
    {
      group: "Legal",
      title: "Legal pages",
      status: "warning",
      detail:
        "Manually confirm Privacy, Terms, and Disclaimer pages exist before launch.",
      href: "/privacy",
    },
    {
      group: "Admin",
      title: "Admin protection",
      status: "warning",
      detail:
        "Manually confirm all admin routes are protected by AdminGate and server checks.",
      href: "/admin",
    },
  ];

  const ready = checks.filter((item) => item.status === "ready").length;
  const warning = checks.filter((item) => item.status === "warning").length;
  const missing = checks.filter((item) => item.status === "missing").length;
  const launchScore = getLaunchScore(checks);

  return (
    <AdminGate>
      <div className="space-y-8">
        <section className="luxe-card rounded-3xl p-8 md:p-10">
          <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
            Launch Control
          </div>

          <h1 className="dashboard-hero-glow mt-4 text-4xl font-black tracking-[-0.04em] text-white md:text-6xl">
            Launch Checklist Dashboard
          </h1>

          <p className="mt-4 max-w-3xl text-white/70">
            Final readiness overview for SalahNearMe before going live.
          </p>

          <div className="mt-8 rounded-3xl border border-yellow-500/20 bg-black/30 p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
                  Launch Score
                </div>

                <div className="mt-2 text-5xl font-black text-white">
                  {launchScore}%
                </div>
              </div>

              <div
                className={`rounded-full border px-4 py-2 text-sm font-bold uppercase ${
                  launchScore >= 85
                    ? getStatusStyle("ready")
                    : launchScore >= 60
                    ? getStatusStyle("warning")
                    : getStatusStyle("missing")
                }`}
              >
                {launchScore >= 85
                  ? "Near launch ready"
                  : launchScore >= 60
                  ? "Needs review"
                  : "Not ready"}
              </div>
            </div>

            <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-yellow-500"
                style={{ width: `${launchScore}%` }}
              />
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <StatCard title="Ready" value={ready} status="ready" />
          <StatCard title="Needs review" value={warning} status="warning" />
          <StatCard title="Missing" value={missing} status="missing" />
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {checks.map((check) => (
            <div
              key={`${check.group}-${check.title}`}
              className="luxe-card rounded-3xl p-6"
            >
              <div className="mb-3 text-xs uppercase tracking-[0.2em] text-yellow-400">
                {check.group}
              </div>

              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xl font-bold text-white">
                    {check.title}
                  </div>

                  <p className="mt-2 text-sm leading-relaxed text-white/60">
                    {check.detail}
                  </p>
                </div>

                <span
                  className={`rounded-full border px-3 py-1 text-xs font-bold uppercase ${getStatusStyle(
                    check.status
                  )}`}
                >
                  {check.status}
                </span>
              </div>

              {check.href && (
                <Link
                  href={check.href}
                  className="mt-5 inline-flex text-sm font-semibold text-yellow-400 hover:text-yellow-300"
                >
                  Open →
                </Link>
              )}
            </div>
          ))}
        </section>
      </div>
    </AdminGate>
  );
}

function StatCard({
  title,
  value,
  status,
}: {
  title: string;
  value: number;
  status: CheckStatus;
}) {
  return (
    <div className="luxe-card-soft rounded-2xl p-6">
      <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
        {title}
      </div>

      <div className="mt-3 text-4xl font-black text-white">{value}</div>

      <div
        className={`mt-4 inline-flex rounded-full border px-3 py-1 text-xs font-bold uppercase ${getStatusStyle(
          status
        )}`}
      >
        {status}
      </div>
    </div>
  );
}

