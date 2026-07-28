import Link from "next/link";

import { requireAdmin } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type CountResult = {
  count: number | null;
  error: unknown;
};

type MetricTone =
  | "gold"
  | "green"
  | "red"
  | "purple"
  | "cyan"
  | "neutral";

type MetricCardProps = {
  title: string;
  value: number;
  description: string;
  href?: string;
  tone?: MetricTone;
  urgent?: boolean;
};

type ActionItem = {
  title: string;
  description: string;
  href: string;
  count?: number;
  tone: MetricTone;
};

type AdminTool = {
  href: string;
  title: string;
  description: string;
  category: string;
  tone: MetricTone;
};

const adminTools: AdminTool[] = [
  {
    category: "Mosque Operations",
    href: "/admin/mosque-claims",
    title: "Mosque Claims",
    description: "Review and approve mosque management access requests.",
    tone: "gold",
  },
  {
    category: "Mosque Operations",
    href: "/admin/mosque-timetable-imports",
    title: "Timetable Imports",
    description: "Review extraction, parsing, approval and import failures.",
    tone: "purple",
  },
  {
    category: "Mosque Operations",
    href: "/admin/mosque-timetable-sources",
    title: "Timetable Sources",
    description: "Manage official websites, PDFs and timetable source records.",
    tone: "cyan",
  },
  {
    category: "Mosque Operations",
    href: "/admin/mosque-duplicates",
    title: "Mosque Duplicates",
    description: "Review and merge potential duplicate mosque records.",
    tone: "red",
  },
  {
    category: "Business Operations",
    href: "/admin/business-review",
    title: "Business Review",
    description: "Review pending and recently submitted business listings.",
    tone: "gold",
  },
  {
    category: "Business Operations",
    href: "/admin/business-submissions",
    title: "Business Submissions",
    description: "Process community and owner-submitted businesses.",
    tone: "cyan",
  },
  {
    category: "Business Operations",
    href: "/admin/business-claims",
    title: "Business Claims",
    description: "Approve or reject ownership verification requests.",
    tone: "gold",
  },
  {
    category: "Business Operations",
    href: "/admin/businesses",
    title: "Business Management",
    description: "Manage published businesses, rankings and listing status.",
    tone: "cyan",
  },
  {
    category: "Growth & Revenue",
    href: "/admin/campaigns",
    title: "Campaigns",
    description: "Manage sponsorships, featured placement and advertising.",
    tone: "green",
  },
  {
    category: "Growth & Revenue",
    href: "/admin/business-promotions",
    title: "Promotions",
    description: "Control promoted listings and premium business exposure.",
    tone: "gold",
  },
  {
    category: "Growth & Revenue",
    href: "/admin/city-launch-readiness",
    title: "City Launch Readiness",
    description: "Assess mosque, business and prayer-time coverage by city.",
    tone: "cyan",
  },
  {
    category: "Growth & Revenue",
    href: "/admin/priority-city-seed",
    title: "Priority City Seed",
    description: "Generate and prepare data for high-priority launch cities.",
    tone: "green",
  },
  {
    category: "Data & Imports",
    href: "/admin/import",
    title: "Bulk Import Centre",
    description: "Upload and validate mosque or business CSV files.",
    tone: "gold",
  },
  {
    category: "Data & Imports",
    href: "/admin/import/history",
    title: "Import History",
    description: "Review completed, failed and historical import activity.",
    tone: "neutral",
  },
  {
    category: "Data & Imports",
    href: "/admin/import-mosques",
    title: "Import Mosques",
    description: "Import mosque data for active SalahNearMe cities.",
    tone: "green",
  },
  {
    category: "Data & Imports",
    href: "/admin/import-businesses",
    title: "Import Businesses",
    description: "Import halal business data for supported cities.",
    tone: "cyan",
  },
  {
    category: "Data & Imports",
    href: "/admin/duplicates",
    title: "Duplicate Review",
    description: "Review potential mosque and business duplicate records.",
    tone: "red",
  },
  {
    category: "Data & Imports",
    href: "/admin/city-data-fix",
    title: "City Data Fix",
    description: "Find missing coordinates, timezones and duplicate cities.",
    tone: "purple",
  },
  {
    category: "AI & Safety",
    href: "/admin/ai-assistant",
    title: "AI Assistant",
    description: "Analyse launch readiness, SEO and platform data quality.",
    tone: "purple",
  },
  {
    category: "AI & Safety",
    href: "/admin/ai-actions",
    title: "AI Action Queue",
    description: "Review proposed AI actions before any approved workflow.",
    tone: "purple",
  },
  {
    category: "AI & Safety",
    href: "/admin/launch-checklist",
    title: "Launch Checklist",
    description: "Complete final operational and production-readiness checks.",
    tone: "green",
  },
];

function safeCount(result: CountResult) {
  if (result.error) {
    return 0;
  }

  return result.count ?? 0;
}

function percentage(part: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((part / total) * 100));
}

function groupTools() {
  const grouped = new Map<string, AdminTool[]>();

  for (const tool of adminTools) {
    const current = grouped.get(tool.category) ?? [];
    current.push(tool);
    grouped.set(tool.category, current);
  }

  return Array.from(grouped.entries()).map(([title, tools]) => ({
    title,
    tools,
  }));
}

async function getAdminCounts() {
  const [
    pendingBusinessClaims,
    pendingMosqueClaims,
    pendingCampaigns,
    activeCampaigns,
    totalBusinesses,
    totalMosques,
    totalCities,
    pendingAiActions,
    approvedAiActions,
    timetableImports,
    pendingTimetableReviews,
    approvedTimetableImports,
    failedTimetableImports,
    timetableSources,
    publishedPrayerRows,
    publishedJumuahRows,
    correctionReports,
    openCorrectionReports,
    adminUsers,
  ] = await Promise.all([
    supabaseAdmin
      .from("business_claim_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),

    supabaseAdmin
      .from("mosque_claims")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),

    supabaseAdmin
      .from("advertising_campaign_requests")
      .select("id", { count: "exact", head: true })
      .or("status.is.null,status.eq.draft"),

    supabaseAdmin
      .from("advertising_campaign_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),

    supabaseAdmin
      .from("businesses")
      .select("id", { count: "exact", head: true }),

    supabaseAdmin
      .from("mosques")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),

    supabaseAdmin
      .from("cities")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),

    supabaseAdmin
      .from("ai_admin_actions")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),

    supabaseAdmin
      .from("ai_admin_actions")
      .select("id", { count: "exact", head: true })
      .eq("status", "approved"),

    supabaseAdmin
      .from("mosque_timetable_imports")
      .select("id", { count: "exact", head: true }),

    supabaseAdmin
      .from("mosque_timetable_imports")
      .select("id", { count: "exact", head: true })
      .eq("status", "parsed_pending_review"),

    supabaseAdmin
      .from("mosque_timetable_imports")
      .select("id", { count: "exact", head: true })
      .eq("status", "approved"),

    supabaseAdmin
      .from("mosque_timetable_imports")
      .select("id", { count: "exact", head: true })
      .in("status", ["failed", "parse_failed"]),

    supabaseAdmin
      .from("mosque_timetable_sources")
      .select("id", { count: "exact", head: true }),

    supabaseAdmin
      .from("mosque_prayer_times")
      .select("id", { count: "exact", head: true }),

    supabaseAdmin
      .from("mosque_jumuah_times")
      .select("id", { count: "exact", head: true })
      .eq("active", true),

    supabaseAdmin
      .from("mosque_correction_reports")
      .select("id", { count: "exact", head: true }),

    supabaseAdmin
      .from("mosque_correction_reports")
      .select("id", { count: "exact", head: true })
      .in("status", ["new", "reviewing"]),

    supabaseAdmin
      .from("admin_users")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),
  ]);

  return {
    pendingBusinessClaims: safeCount(pendingBusinessClaims),
    pendingMosqueClaims: safeCount(pendingMosqueClaims),
    pendingCampaigns: safeCount(pendingCampaigns),
    activeCampaigns: safeCount(activeCampaigns),
    totalBusinesses: safeCount(totalBusinesses),
    totalMosques: safeCount(totalMosques),
    totalCities: safeCount(totalCities),
    pendingAiActions: safeCount(pendingAiActions),
    approvedAiActions: safeCount(approvedAiActions),
    timetableImports: safeCount(timetableImports),
    pendingTimetableReviews: safeCount(pendingTimetableReviews),
    approvedTimetableImports: safeCount(approvedTimetableImports),
    failedTimetableImports: safeCount(failedTimetableImports),
    timetableSources: safeCount(timetableSources),
    publishedPrayerRows: safeCount(publishedPrayerRows),
    publishedJumuahRows: safeCount(publishedJumuahRows),
    correctionReports: safeCount(correctionReports),
    openCorrectionReports: safeCount(openCorrectionReports),
    adminUsers: safeCount(adminUsers),
  };
}

function getToneClasses(tone: MetricTone) {
  if (tone === "green") {
    return {
      border: "border-emerald-400/20",
      background: "bg-emerald-400/[0.06]",
      text: "text-emerald-300",
      glow: "shadow-emerald-950/20",
      dot: "bg-emerald-400",
    };
  }

  if (tone === "red") {
    return {
      border: "border-red-400/20",
      background: "bg-red-400/[0.06]",
      text: "text-red-300",
      glow: "shadow-red-950/20",
      dot: "bg-red-400",
    };
  }

  if (tone === "purple") {
    return {
      border: "border-purple-400/20",
      background: "bg-purple-400/[0.06]",
      text: "text-purple-300",
      glow: "shadow-purple-950/20",
      dot: "bg-purple-400",
    };
  }

  if (tone === "cyan") {
    return {
      border: "border-cyan-400/20",
      background: "bg-cyan-400/[0.06]",
      text: "text-cyan-300",
      glow: "shadow-cyan-950/20",
      dot: "bg-cyan-400",
    };
  }

  if (tone === "neutral") {
    return {
      border: "border-white/[0.08]",
      background: "bg-white/[0.025]",
      text: "text-white/60",
      glow: "shadow-black/20",
      dot: "bg-white/50",
    };
  }

  return {
    border: "border-yellow-400/20",
    background: "bg-yellow-400/[0.06]",
    text: "text-yellow-300",
    glow: "shadow-yellow-950/20",
    dot: "bg-yellow-400",
  };
}

function MetricCard({
  title,
  value,
  description,
  href,
  tone = "gold",
  urgent = false,
}: MetricCardProps) {
  const styles = getToneClasses(tone);

  const card = (
    <div
      className={`group h-full rounded-[1.6rem] border p-5 shadow-xl transition duration-300 hover:-translate-y-1 hover:border-white/20 ${styles.border} ${styles.background} ${styles.glow}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-2xl border ${styles.border} bg-black/20`}
        >
          <span
            className={`h-2.5 w-2.5 rounded-full ${styles.dot} ${
              urgent ? "animate-pulse" : ""
            }`}
          />
        </div>

        {href ? (
          <span className="text-sm text-white/20 transition group-hover:translate-x-0.5 group-hover:text-white/60">
            →
          </span>
        ) : null}
      </div>

      <div className="mt-5 text-4xl font-black tracking-[-0.05em] text-white">
        {value.toLocaleString("en-GB")}
      </div>

      <div className={`mt-2 text-sm font-black ${styles.text}`}>{title}</div>

      <p className="mt-2 text-xs leading-5 text-white/35">{description}</p>
    </div>
  );

  if (!href) {
    return card;
  }

  return (
    <Link href={href} className="block h-full">
      {card}
    </Link>
  );
}

function PriorityAction({
  title,
  description,
  href,
  count,
  tone,
}: ActionItem) {
  const styles = getToneClasses(tone);

  return (
    <Link
      href={href}
      className={`group flex items-center gap-4 rounded-2xl border p-4 transition hover:border-white/20 hover:bg-white/[0.035] ${styles.border} ${styles.background}`}
    >
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-lg font-black ${styles.border} ${styles.text}`}
      >
        {count ?? "→"}
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-sm font-black text-white">{title}</div>
        <p className="mt-1 text-xs leading-5 text-white/35">{description}</p>
      </div>

      <span className="text-white/20 transition group-hover:translate-x-1 group-hover:text-white/60">
        →
      </span>
    </Link>
  );
}

function ProgressRow({
  label,
  value,
  total,
  tone,
}: {
  label: string;
  value: number;
  total: number;
  tone: MetricTone;
}) {
  const progress = percentage(value, total);
  const styles = getToneClasses(tone);

  return (
    <div>
      <div className="flex items-center justify-between gap-4 text-xs">
        <span className="font-bold text-white/55">{label}</span>
        <span className={`font-black ${styles.text}`}>{progress}%</span>
      </div>

      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className={`h-full rounded-full ${styles.dot}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mt-2 text-[11px] text-white/25">
        {value.toLocaleString("en-GB")} of{" "}
        {total.toLocaleString("en-GB")}
      </div>
    </div>
  );
}

function ToolCard({ tool }: { tool: AdminTool }) {
  const styles = getToneClasses(tool.tone);

  return (
    <Link
      href={tool.href}
      className={`group rounded-[1.4rem] border p-5 transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.04] ${styles.border} ${styles.background}`}
    >
      <div className="flex items-start justify-between gap-4">
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-xl border text-sm font-black ${styles.border} ${styles.text}`}
        >
          ◆
        </span>

        <span className="text-white/20 transition group-hover:translate-x-1 group-hover:text-white/60">
          →
        </span>
      </div>

      <h3 className="mt-5 text-base font-black text-white">{tool.title}</h3>

      <p className="mt-2 text-xs leading-6 text-white/35">
        {tool.description}
      </p>
    </Link>
  );
}

export default async function AdminHomePage() {
  const permission = await requireAdmin();

  if (!permission.ok) {
    return (
      <main className="px-4 py-10">
        <section className="mx-auto max-w-3xl rounded-3xl border border-red-500/20 bg-red-500/[0.07] p-8">
          <div className="text-xs font-black uppercase tracking-[0.25em] text-red-300">
            Admin access denied
          </div>

          <h1 className="mt-3 text-3xl font-black text-white">
            Access restricted
          </h1>

          <p className="mt-3 text-sm leading-7 text-red-100/75">
            {permission.error}
          </p>
        </section>
      </main>
    );
  }

  const counts = await getAdminCounts();
  const groupedTools = groupTools();

  const pendingWork =
    counts.pendingMosqueClaims +
    counts.pendingBusinessClaims +
    counts.pendingTimetableReviews +
    counts.openCorrectionReports +
    counts.pendingAiActions +
    counts.pendingCampaigns;

  const timetableResolved =
    counts.approvedTimetableImports + counts.failedTimetableImports;

  const timetableSuccessRate = percentage(
    counts.approvedTimetableImports,
    timetableResolved,
  );

  const priorityActions: ActionItem[] = [
    {
      title: "Review mosque claims",
      description: "Verify organisations requesting mosque management access.",
      href: "/admin/mosque-claims",
      count: counts.pendingMosqueClaims,
      tone: counts.pendingMosqueClaims > 0 ? "gold" : "green",
    },
    {
      title: "Review business claims",
      description: "Process ownership and listing-access requests.",
      href: "/admin/business-claims",
      count: counts.pendingBusinessClaims,
      tone: counts.pendingBusinessClaims > 0 ? "gold" : "green",
    },
    {
      title: "Review timetable imports",
      description: "Approve parsed timetable rows waiting for review.",
      href: "/admin/mosque-timetable-imports",
      count: counts.pendingTimetableReviews,
      tone: counts.pendingTimetableReviews > 0 ? "purple" : "green",
    },
    {
      title: "Resolve failed imports",
      description: "Investigate extraction and timetable parsing failures.",
      href: "/admin/mosque-timetable-imports",
      count: counts.failedTimetableImports,
      tone: counts.failedTimetableImports > 0 ? "red" : "green",
    },
    {
      title: "Review AI actions",
      description: "Approve or reject suggested operational actions.",
      href: "/admin/ai-actions",
      count: counts.pendingAiActions,
      tone: counts.pendingAiActions > 0 ? "purple" : "green",
    },
    {
      title: "Manage draft campaigns",
      description: "Prepare sponsorship and featured-placement campaigns.",
      href: "/admin/campaigns",
      count: counts.pendingCampaigns,
      tone: counts.pendingCampaigns > 0 ? "gold" : "green",
    },
  ];

  return (
    <main className="px-4 py-6 sm:px-6 sm:py-8 xl:px-10">
      <div className="mx-auto max-w-[1500px] space-y-8">
        <section className="relative overflow-hidden rounded-[2rem] border border-yellow-400/15 bg-gradient-to-br from-yellow-400/[0.09] via-[#0b0f16] to-[#080b11] p-6 shadow-2xl shadow-black/30 sm:p-8 xl:p-10">
          <div className="pointer-events-none absolute -right-28 -top-28 h-72 w-72 rounded-full bg-yellow-400/[0.07] blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-purple-500/[0.05] blur-3xl" />

          <div className="relative">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs font-black uppercase tracking-[0.3em] text-yellow-400">
                    SalahNearMe Admin
                  </span>

                  <span className="rounded-full border border-emerald-400/20 bg-emerald-400/[0.08] px-3 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-300">
                    Platform operational
                  </span>
                </div>

                <h1 className="dashboard-hero-glow mt-4 max-w-4xl text-4xl font-black tracking-[-0.055em] text-white sm:text-5xl xl:text-6xl">
                  Control Centre
                </h1>

                <p className="mt-4 max-w-3xl text-sm leading-7 text-white/50 sm:text-base">
                  Manage platform quality, mosque timetables, claims, business
                  listings, imports, campaigns, city expansion and
                  approval-controlled AI operations.
                </p>
              </div>

              <div className="grid min-w-full gap-3 sm:grid-cols-2 xl:min-w-[430px]">
                <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">
                    Pending workload
                  </div>

                  <div className="mt-2 text-3xl font-black text-white">
                    {pendingWork.toLocaleString("en-GB")}
                  </div>

                  <div className="mt-1 text-xs text-white/35">
                    Items requiring attention
                  </div>
                </div>

                <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.06] p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300/70">
                    Access level
                  </div>

                  <div className="mt-2 text-xl font-black uppercase text-white">
                    {permission.role}
                  </div>

                  <div className="mt-1 truncate text-xs text-white/35">
                    {permission.email ?? permission.userId}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/admin/business-review" className="luxe-button text-sm">
                Review businesses
              </Link>

              <Link
                href="/admin/mosque-timetable-imports"
                className="luxe-button-outline text-sm"
              >
                Timetable queue
              </Link>

              <Link
                href="/admin/ai-assistant"
                className="luxe-button-outline text-sm"
              >
                Open AI assistant
              </Link>

              <Link
                href="/admin/launch-checklist"
                className="luxe-button-outline text-sm"
              >
                Launch checklist
              </Link>
            </div>
          </div>
        </section>

        <section>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.25em] text-yellow-400">
                Platform footprint
              </div>

              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-white">
                Live directory coverage
              </h2>
            </div>

            <div className="text-xs text-white/30">
              Server-side Supabase counts
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="Active cities"
              value={counts.totalCities}
              description="Cities currently published across the platform."
              href="/admin/city-launch-readiness"
              tone="cyan"
            />

            <MetricCard
              title="Active mosques"
              value={counts.totalMosques}
              description="Active mosque profiles available to users."
              tone="green"
            />

            <MetricCard
              title="Businesses"
              value={counts.totalBusinesses}
              description="Halal businesses stored in the directory."
              href="/admin/businesses"
              tone="cyan"
            />

            <MetricCard
              title="Active campaigns"
              value={counts.activeCampaigns}
              description="Advertising and sponsorship campaigns currently live."
              href="/admin/campaigns"
              tone="green"
            />
          </div>
        </section>

        <section>
          <div className="mb-4">
            <div className="text-[10px] font-black uppercase tracking-[0.25em] text-yellow-400">
              Operations
            </div>

            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-white">
              Items requiring attention
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <MetricCard
              title="Mosque claims"
              value={counts.pendingMosqueClaims}
              description="Pending mosque manager verification requests."
              href="/admin/mosque-claims"
              tone={counts.pendingMosqueClaims > 0 ? "gold" : "green"}
              urgent={counts.pendingMosqueClaims > 0}
            />

            <MetricCard
              title="Business claims"
              value={counts.pendingBusinessClaims}
              description="Pending business ownership requests."
              href="/admin/business-claims"
              tone={counts.pendingBusinessClaims > 0 ? "gold" : "green"}
              urgent={counts.pendingBusinessClaims > 0}
            />

            <MetricCard
              title="Timetable reviews"
              value={counts.pendingTimetableReviews}
              description="Parsed timetable imports awaiting approval."
              href="/admin/mosque-timetable-imports"
              tone={counts.pendingTimetableReviews > 0 ? "purple" : "green"}
              urgent={counts.pendingTimetableReviews > 0}
            />

            <MetricCard
              title="Failed imports"
              value={counts.failedTimetableImports}
              description="Timetable imports requiring investigation."
              href="/admin/mosque-timetable-imports"
              tone={counts.failedTimetableImports > 0 ? "red" : "green"}
              urgent={counts.failedTimetableImports > 0}
            />

            <MetricCard
              title="Correction reports"
              value={counts.openCorrectionReports}
              description="New or reviewing mosque correction reports."
              href="/business-dashboard/mosques"
              tone={counts.openCorrectionReports > 0 ? "gold" : "green"}
              urgent={counts.openCorrectionReports > 0}
            />

            <MetricCard
              title="AI action queue"
              value={counts.pendingAiActions}
              description="Approval-controlled AI actions awaiting review."
              href="/admin/ai-actions"
              tone={counts.pendingAiActions > 0 ? "purple" : "green"}
              urgent={counts.pendingAiActions > 0}
            />
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[1.8rem] border border-white/[0.08] bg-[#090d14] p-5 sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-yellow-400">
                  Priority queue
                </div>

                <h2 className="mt-2 text-xl font-black text-white">
                  Recommended next actions
                </h2>
              </div>

              <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white/35">
                {pendingWork} pending
              </span>
            </div>

            <div className="mt-5 grid gap-3">
              {priorityActions.map((action) => (
                <PriorityAction
                  key={action.href}
                  title={action.title}
                  description={action.description}
                  href={action.href}
                  count={action.count}
                  tone={action.tone}
                />
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <section className="rounded-[1.8rem] border border-purple-400/15 bg-purple-400/[0.045] p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.24em] text-purple-300">
                    AI safety layer
                  </div>

                  <h2 className="mt-2 text-xl font-black text-white">
                    Human approval remains required
                  </h2>
                </div>

                <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-purple-400/20 bg-purple-400/[0.08] text-purple-300">
                  AI
                </span>
              </div>

              <p className="mt-4 text-sm leading-7 text-white/45">
                AI tools remain read-only or approval-controlled. Suggested
                actions do not modify production records without an approved
                administrative workflow.
              </p>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/[0.07] bg-black/20 p-4">
                  <div className="text-2xl font-black text-white">
                    {counts.pendingAiActions}
                  </div>
                  <div className="mt-1 text-xs text-white/35">Pending</div>
                </div>

                <div className="rounded-2xl border border-white/[0.07] bg-black/20 p-4">
                  <div className="text-2xl font-black text-emerald-300">
                    {counts.approvedAiActions}
                  </div>
                  <div className="mt-1 text-xs text-white/35">Approved</div>
                </div>
              </div>

              <Link
                href="/admin/ai-assistant"
                className="mt-5 inline-flex text-sm font-black text-purple-300 transition hover:text-purple-200"
              >
                Open AI operations →
              </Link>
            </section>

            <section className="rounded-[1.8rem] border border-emerald-400/15 bg-emerald-400/[0.045] p-5 sm:p-6">
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-300">
                Platform security
              </div>

              <h2 className="mt-2 text-xl font-black text-white">
                Server-side protection active
              </h2>

              <p className="mt-4 text-sm leading-7 text-white/45">
                Admin access is verified on the server before protected pages
                render. Sensitive operational data is not exposed through a
                client-only access gate.
              </p>

              <div className="mt-5 flex items-center gap-3 rounded-2xl border border-emerald-400/15 bg-black/20 p-4">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.6)]" />

                <div>
                  <div className="text-sm font-black text-emerald-300">
                    Admin session verified
                  </div>

                  <div className="mt-1 text-xs text-white/30">
                    {counts.adminUsers} active admin account
                    {counts.adminUsers === 1 ? "" : "s"}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </section>

        <section className="rounded-[1.8rem] border border-white/[0.08] bg-[#090d14] p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-yellow-400">
                Timetable intelligence
              </div>

              <h2 className="mt-2 text-xl font-black text-white">
                Mosque timetable engine
              </h2>

              <p className="mt-2 max-w-3xl text-sm leading-7 text-white/40">
                Monitor timetable sources, imported files, approval results,
                published prayer rows and active Jumu’ah records.
              </p>
            </div>

            <Link
              href="/admin/mosque-timetable-imports"
              className="text-sm font-black text-yellow-300 transition hover:text-yellow-200"
            >
              Open timetable operations →
            </Link>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
            <div className="grid gap-4 sm:grid-cols-2">
              <MetricCard
                title="Total imports"
                value={counts.timetableImports}
                description="All timetable import records."
                href="/admin/mosque-timetable-imports"
                tone="purple"
              />

              <MetricCard
                title="Approved imports"
                value={counts.approvedTimetableImports}
                description="Imports approved for publication."
                href="/admin/mosque-timetable-imports"
                tone="green"
              />

              <MetricCard
                title="Timetable sources"
                value={counts.timetableSources}
                description="Official source records being monitored."
                href="/admin/mosque-timetable-sources"
                tone="cyan"
              />

              <MetricCard
                title="Published prayer rows"
                value={counts.publishedPrayerRows}
                description="Mosque prayer-time records currently stored."
                tone="green"
              />
            </div>

            <div className="rounded-[1.5rem] border border-white/[0.07] bg-black/20 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-black text-white">
                    Import performance
                  </div>

                  <div className="mt-1 text-xs text-white/30">
                    Current timetable processing overview
                  </div>
                </div>

                <div className="text-3xl font-black text-emerald-300">
                  {timetableSuccessRate}%
                </div>
              </div>

              <div className="mt-6 space-y-6">
                <ProgressRow
                  label="Approved imports"
                  value={counts.approvedTimetableImports}
                  total={counts.timetableImports}
                  tone="green"
                />

                <ProgressRow
                  label="Pending review"
                  value={counts.pendingTimetableReviews}
                  total={counts.timetableImports}
                  tone="purple"
                />

                <ProgressRow
                  label="Failed imports"
                  value={counts.failedTimetableImports}
                  total={counts.timetableImports}
                  tone="red"
                />
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                  <div className="text-2xl font-black text-white">
                    {counts.publishedJumuahRows.toLocaleString("en-GB")}
                  </div>

                  <div className="mt-1 text-xs text-white/30">
                    Active Jumu’ah rows
                  </div>
                </div>

                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                  <div className="text-2xl font-black text-white">
                    {counts.correctionReports.toLocaleString("en-GB")}
                  </div>

                  <div className="mt-1 text-xs text-white/30">
                    Total corrections
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="mb-5">
            <div className="text-[10px] font-black uppercase tracking-[0.25em] text-yellow-400">
              Administration
            </div>

            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-white">
              Platform management tools
            </h2>

            <p className="mt-2 text-sm text-white/35">
              Existing admin modules grouped into clear operational areas.
            </p>
          </div>

          <div className="space-y-8">
            {groupedTools.map((group) => (
              <section key={group.title}>
                <div className="mb-4 flex items-center gap-4">
                  <h3 className="shrink-0 text-sm font-black text-white/70">
                    {group.title}
                  </h3>

                  <div className="h-px flex-1 bg-gradient-to-r from-white/[0.1] to-transparent" />
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {group.tools.map((tool) => (
                    <ToolCard key={`${tool.href}-${tool.title}`} tool={tool} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}