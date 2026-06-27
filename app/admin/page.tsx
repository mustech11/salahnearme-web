import Link from "next/link";

import { requireAdmin } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type AdminLinkItem = {
  group: string;
  href: string;
  title: string;
  desc: string;
  tone?: "default" | "green" | "cyan" | "yellow" | "red" | "purple";
};

type CountResult = {
  count: number | null;
  error: unknown;
};

const adminLinks: AdminLinkItem[] = [
  {
    group: "AI & Launch Readiness",
    href: "/admin/ai-assistant",
    title: "AI Admin Dashboard",
    desc: "Read-only launch readiness, SEO, data quality, and duplicate analysis.",
    tone: "purple",
  },
  {
    group: "AI & Launch Readiness",
    href: "/admin/ai-actions",
    title: "AI Actions Queue",
    desc: "Approve or reject AI suggested actions before future write steps.",
    tone: "purple",
  },
  {
    group: "AI & Launch Readiness",
    href: "/admin/city-launch-readiness",
    title: "City Launch Readiness",
    desc: "Check launch readiness for every city.",
    tone: "cyan",
  },
  {
    group: "AI & Launch Readiness",
    href: "/admin/launch-checklist",
    title: "Launch Checklist",
    desc: "Final readiness dashboard before going live.",
    tone: "yellow",
  },
  {
    group: "Cities & Data Quality",
    href: "/admin/city-data-fix",
    title: "City Data Fix",
    desc: "Find missing coordinates, missing timezones, duplicate city records, and SQL helpers.",
    tone: "cyan",
  },
  {
    group: "Cities & Data Quality",
    href: "/admin/priority-city-seed",
    title: "Priority City Seed SQL",
    desc: "Generate SQL to seed launch cities with coordinates and timezone data.",
    tone: "green",
  },
  {
    group: "Cities & Data Quality",
    href: "/admin/duplicates",
    title: "Duplicate Review",
    desc: "Review likely duplicate mosques and businesses.",
    tone: "yellow",
  },
  {
    group: "Claims & Approvals",
    href: "/admin/mosque-claims",
    title: "Mosque Claims",
    desc: "Review mosque manager access requests.",
    tone: "yellow",
  },
  {
    group: "Claims & Approvals",
    href: "/admin/business-claims",
    title: "Business Claims",
    desc: "Approve business ownership requests.",
    tone: "yellow",
  },
  {
    group: "Mosque Timetables",
    href: "/admin/mosque-timetable-imports",
    title: "Mosque Timetable Imports",
    desc: "Review mosque timetable imports, parsed rows, approvals, and failed imports.",
    tone: "purple",
  },
  {
    group: "Mosque Timetables",
    href: "/admin/mosque-timetable-sources",
    title: "Mosque Timetable Sources",
    desc: "Review mosque timetable source URLs, websites, PDFs, and auto-import readiness.",
    tone: "cyan",
  },
  {
    group: "Mosque Timetables",
    href: "/admin/mosque-prayer-times",
    title: "Published Prayer Times",
    desc: "Review published mosque-specific prayer and iqamah timetable rows.",
    tone: "green",
  },
  {
    group: "Businesses & Monetisation",
    href: "/admin/campaigns",
    title: "Campaigns",
    desc: "Manage ads, sponsorships, and featured placements.",
    tone: "yellow",
  },
  {
    group: "Businesses & Monetisation",
    href: "/admin/businesses",
    title: "Businesses",
    desc: "Manage halal business listings.",
    tone: "cyan",
  },
  {
    group: "Businesses & Monetisation",
    href: "/dashboard/business/billing",
    title: "Business Billing",
    desc: "Manage subscriptions and business billing.",
    tone: "green",
  },
  {
    group: "Imports",
    href: "/admin/import",
    title: "Bulk CSV Import",
    desc: "Upload, validate, and import mosque or business CSV files.",
    tone: "yellow",
  },
  {
    group: "Imports",
    href: "/admin/import-mosques",
    title: "Import Mosques Worldwide",
    desc: "Import mosques from OpenStreetMap for active SalahNearMe cities.",
    tone: "green",
  },
  {
    group: "Imports",
    href: "/admin/import-businesses",
    title: "Import Businesses Worldwide",
    desc: "Import halal businesses from OpenStreetMap for active SalahNearMe cities.",
    tone: "cyan",
  },
];

function groupAdminLinks() {
  const groups = new Map<string, AdminLinkItem[]>();

  for (const item of adminLinks) {
    const existing = groups.get(item.group) ?? [];
    existing.push(item);
    groups.set(item.group, existing);
  }

  return Array.from(groups.entries()).map(([title, links]) => ({
    title,
    links,
  }));
}

function safeCount(result: CountResult) {
  return result.count ?? 0;
}

async function getCount(table: string) {
  const { count } = await supabaseAdmin.from(table).select("id", {
    count: "exact",
    head: true,
  });

  return count ?? 0;
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

    supabaseAdmin.from("businesses").select("id", {
      count: "exact",
      head: true,
    }),

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

function AdminAccessDenied({
  message,
  status,
}: {
  message: string;
  status: number;
}) {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <section className="rounded-3xl border border-red-500/20 bg-red-500/10 p-8">
        <div className="text-sm uppercase tracking-[0.25em] text-red-300">
          Admin access denied
        </div>

        <h1 className="mt-3 text-3xl font-black text-white">
          Access restricted
        </h1>

        <p className="mt-3 text-sm leading-7 text-red-100/80">{message}</p>

        <div className="mt-5 text-xs text-red-100/50">Status: {status}</div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/" className="luxe-button text-sm">
            Return home
          </Link>

          <Link
            href="/business-dashboard"
            className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white/80 hover:bg-white/10"
          >
            Business dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}

function MetricCard({
  title,
  value,
  href,
  tone = "yellow",
}: {
  title: string;
  value: number;
  href?: string;
  tone?: "yellow" | "green" | "red" | "purple" | "cyan";
}) {
  const toneClass =
    tone === "green"
      ? "border-green-500/25 bg-green-500/10 text-green-300"
      : tone === "red"
        ? "border-red-500/25 bg-red-500/10 text-red-300"
        : tone === "purple"
          ? "border-purple-500/25 bg-purple-500/10 text-purple-300"
          : tone === "cyan"
            ? "border-cyan-500/25 bg-cyan-500/10 text-cyan-300"
            : "border-yellow-500/25 bg-yellow-500/10 text-yellow-300";

  const content = (
    <div
      className={`rounded-2xl border p-5 transition duration-300 hover:-translate-y-1 hover:bg-white/[0.03] ${toneClass}`}
    >
      <div className="text-sm font-bold">{title}</div>
      <div className="mt-3 text-4xl font-black text-white">{value}</div>
    </div>
  );

  if (!href) {
    return content;
  }

  return <Link href={href}>{content}</Link>;
}

function AdminLink({
  href,
  title,
  desc,
  tone = "default",
}: {
  href: string;
  title: string;
  desc: string;
  tone?: AdminLinkItem["tone"];
}) {
  const toneClass =
    tone === "green"
      ? "border-green-500/20 bg-green-500/10 hover:border-green-400"
      : tone === "red"
        ? "border-red-500/20 bg-red-500/10 hover:border-red-400"
        : tone === "purple"
          ? "border-purple-500/20 bg-purple-500/10 hover:border-purple-400"
          : tone === "cyan"
            ? "border-cyan-500/20 bg-cyan-500/10 hover:border-cyan-400"
            : tone === "yellow"
              ? "border-yellow-500/20 bg-yellow-500/10 hover:border-yellow-400"
              : "border-white/10 bg-black/30 hover:border-yellow-400";

  return (
    <Link
      href={href}
      className={`rounded-2xl border p-6 transition duration-300 hover:-translate-y-1 ${toneClass}`}
    >
      <div className="text-xl font-bold text-white">{title}</div>
      <p className="mt-3 text-sm leading-relaxed text-white/60">{desc}</p>
      <div className="mt-5 text-sm font-semibold text-yellow-400">Open →</div>
    </Link>
  );
}

function MiniLink({ href, title }: { href: string; title: string }) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm font-bold text-yellow-400 transition hover:border-yellow-400 hover:bg-yellow-500/10"
    >
      {title} →
    </Link>
  );
}

export default async function AdminHomePage() {
  const permission = await requireAdmin();

  if (!permission.ok) {
    return (
      <AdminAccessDenied
        message={permission.error}
        status={permission.status}
      />
    );
  }

  const counts = await getAdminCounts();
  const groupedLinks = groupAdminLinks();

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <div className="space-y-8">
        <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8 md:p-10">
          <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
            SalahNearMe Admin
          </div>

          <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="dashboard-hero-glow text-4xl font-black tracking-[-0.04em] text-white md:text-5xl">
                Control Centre
              </h1>

              <p className="mt-4 max-w-3xl text-sm leading-7 text-white/70">
                AI launch readiness, mosque timetable imports, mosque claims,
                business claims, duplicate review, monetisation, imports,
                correction reports, security checks, and operational control.
              </p>
            </div>

            <div className="w-fit rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-black text-emerald-300">
              {permission.role.toUpperCase()} ACCESS
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-white/55">
            Signed in as{" "}
            <span className="font-bold text-white">
              {permission.email ?? permission.userId}
            </span>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/admin/mosque-claims" className="luxe-button text-sm">
              Review mosque claims
            </Link>

            <Link
              href="/admin/business-claims"
              className="luxe-button-outline text-sm"
            >
              Review business claims
            </Link>

            <Link
              href="/admin/mosque-timetable-imports"
              className="luxe-button-outline text-sm"
            >
              Timetable imports
            </Link>

            <Link
              href="/business-dashboard/mosques"
              className="luxe-button-outline text-sm"
            >
              Mosque manager dashboard
            </Link>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Pending Mosque Claims"
            value={counts.pendingMosqueClaims}
            href="/admin/mosque-claims"
            tone={counts.pendingMosqueClaims > 0 ? "yellow" : "green"}
          />

          <MetricCard
            title="Pending Business Claims"
            value={counts.pendingBusinessClaims}
            href="/admin/business-claims"
            tone={counts.pendingBusinessClaims > 0 ? "yellow" : "green"}
          />

          <MetricCard
            title="Open Correction Reports"
            value={counts.openCorrectionReports}
            href="/business-dashboard/mosques"
            tone={counts.openCorrectionReports > 0 ? "yellow" : "green"}
          />

          <MetricCard
            title="Pending Timetable Reviews"
            value={counts.pendingTimetableReviews}
            href="/admin/mosque-timetable-imports"
            tone={counts.pendingTimetableReviews > 0 ? "purple" : "green"}
          />

          <MetricCard
            title="Failed Timetable Imports"
            value={counts.failedTimetableImports}
            href="/admin/mosque-timetable-imports"
            tone={counts.failedTimetableImports > 0 ? "red" : "green"}
          />

          <MetricCard
            title="Timetable Imports"
            value={counts.timetableImports}
            href="/admin/mosque-timetable-imports"
          />

          <MetricCard
            title="Approved Imports"
            value={counts.approvedTimetableImports}
            href="/admin/mosque-timetable-imports"
            tone="green"
          />

          <MetricCard
            title="Timetable Sources"
            value={counts.timetableSources}
            href="/admin/mosque-timetable-sources"
            tone="cyan"
          />

          <MetricCard
            title="Prayer-Time Rows"
            value={counts.publishedPrayerRows}
            href="/admin/mosque-prayer-times"
            tone="green"
          />

          <MetricCard
            title="Active Jumu’ah Rows"
            value={counts.publishedJumuahRows}
            tone="green"
          />

          <MetricCard
            title="Correction Reports"
            value={counts.correctionReports}
            href="/business-dashboard/mosques"
            tone="cyan"
          />

          <MetricCard
            title="Draft Campaigns"
            value={counts.pendingCampaigns}
            href="/admin/campaigns"
          />

          <MetricCard
            title="Active Campaigns"
            value={counts.activeCampaigns}
            href="/admin/campaigns"
            tone="green"
          />

          <MetricCard
            title="Businesses"
            value={counts.totalBusinesses}
            href="/admin/businesses"
            tone="cyan"
          />

          <MetricCard
            title="Mosques"
            value={counts.totalMosques}
            tone="green"
          />

          <MetricCard
            title="Cities"
            value={counts.totalCities}
            tone="cyan"
          />

          <MetricCard
            title="Pending AI Actions"
            value={counts.pendingAiActions}
            href="/admin/ai-actions"
            tone={counts.pendingAiActions > 0 ? "purple" : "green"}
          />

          <MetricCard
            title="Approved AI Actions"
            value={counts.approvedAiActions}
            href="/admin/ai-actions"
            tone="green"
          />

          <MetricCard
            title="Active Admin Users"
            value={counts.adminUsers}
            tone="green"
          />
        </section>

        <section className="rounded-3xl border border-green-500/20 bg-green-500/10 p-6 backdrop-blur-xl">
          <div className="text-lg font-bold text-green-300">
            Server-Side Admin Protection
          </div>

          <p className="mt-2 text-sm leading-relaxed text-white/70">
            This page is now protected by server-side admin role verification.
            The old client-side AdminGate check has been removed to prevent the
            admin page from getting stuck on “Checking access...”.
          </p>
        </section>

        <section className="rounded-3xl border border-purple-500/20 bg-purple-500/10 p-6 backdrop-blur-xl">
          <div className="text-lg font-bold text-purple-300">
            AI Safety Layer
          </div>

          <p className="mt-2 text-sm leading-relaxed text-white/70">
            AI tools remain read-only or approval-only. No database records are
            automatically modified unless an approved write workflow is built.
          </p>
        </section>

        <section className="rounded-3xl border border-yellow-500/20 bg-yellow-500/10 p-6">
          <div className="text-lg font-bold text-yellow-300">
            Mosque Timetable Engine
          </div>

          <p className="mt-2 max-w-4xl text-sm leading-relaxed text-white/70">
            Mosque-specific prayer times are powered by official manager
            entries, timetable source imports, raw text extraction, smart
            parsing, review/edit approval, and published monthly timetable rows.
          </p>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <MiniLink
              href="/admin/mosque-timetable-imports"
              title="Review imports"
            />

            <MiniLink
              href="/admin/mosque-timetable-sources"
              title="Check sources"
            />

            <MiniLink
              href="/admin/mosque-prayer-times"
              title="Published rows"
            />
          </div>
        </section>

        {groupedLinks.map((group) => (
          <section key={group.title} className="space-y-4">
            <div>
              <h2 className="text-2xl font-black text-white">{group.title}</h2>
              <div className="mt-2 h-px bg-gradient-to-r from-yellow-500/50 to-transparent" />
            </div>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {group.links.map((item) => (
                <AdminLink
                  key={`${item.href}-${item.title}`}
                  href={item.href}
                  title={item.title}
                  desc={item.desc}
                  tone={item.tone}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}

