import type { ReactNode } from "react";

import Link from "next/link";

import { requireAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

type NavigationItem = {
  href: string;
  label: string;
  description: string;
};

type NavigationGroup = {
  title: string;
  items: NavigationItem[];
};

const navigationGroups: NavigationGroup[] = [
  {
    title: "Overview",
    items: [
      {
        href: "/admin",
        label: "Control Centre",
        description: "Platform overview and operational priorities",
      },
      {
        href: "/admin/launch-checklist",
        label: "Launch Checklist",
        description: "Production-readiness checks",
      },
      {
        href: "/admin/city-launch-readiness",
        label: "City Readiness",
        description: "Review city launch coverage",
      },
    ],
  },
  {
    title: "Mosques",
    items: [
      {
        href: "/admin/mosque-claims",
        label: "Mosque Claims",
        description: "Review management requests",
      },
      {
        href: "/admin/mosque-timetable-imports",
        label: "Timetable Imports",
        description: "Review extracted and parsed timetables",
      },
      {
        href: "/admin/mosque-timetable-sources",
        label: "Timetable Sources",
        description: "Manage official timetable sources",
      },
      {
        href: "/admin/mosque-duplicates",
        label: "Mosque Duplicates",
        description: "Review possible duplicate records",
      },
    ],
  },
  {
    title: "Businesses",
    items: [
      {
        href: "/admin/businesses",
        label: "Businesses",
        description: "Manage directory listings",
      },
      {
        href: "/admin/business-review",
        label: "Business Review",
        description: "Review pending listings",
      },
      {
        href: "/admin/business-submissions",
        label: "Submissions",
        description: "Process new business submissions",
      },
      {
        href: "/admin/business-claims",
        label: "Business Claims",
        description: "Review ownership requests",
      },
      {
        href: "/admin/business-promotions",
        label: "Promotions",
        description: "Manage featured placements",
      },
    ],
  },
  {
    title: "Growth",
    items: [
      {
        href: "/admin/campaigns",
        label: "Campaigns",
        description: "Advertising and sponsorship activity",
      },
      {
        href: "/admin/priority-city-seed",
        label: "Priority Cities",
        description: "Prepare priority city data",
      },
      {
        href: "/admin/city-data-fix",
        label: "City Data Fix",
        description: "Resolve city data-quality issues",
      },
    ],
  },
  {
    title: "Data Operations",
    items: [
      {
        href: "/admin/import",
        label: "Import Centre",
        description: "Bulk CSV validation and import",
      },
      {
        href: "/admin/import/history",
        label: "Import History",
        description: "Review previous import activity",
      },
      {
        href: "/admin/import-mosques",
        label: "Import Mosques",
        description: "Worldwide mosque imports",
      },
      {
        href: "/admin/import-businesses",
        label: "Import Businesses",
        description: "Worldwide business imports",
      },
      {
        href: "/admin/duplicates",
        label: "Duplicate Review",
        description: "Cross-platform duplicate analysis",
      },
    ],
  },
  {
    title: "Artificial Intelligence",
    items: [
      {
        href: "/admin/ai-assistant",
        label: "AI Assistant",
        description: "Read-only operational intelligence",
      },
      {
        href: "/admin/ai-actions",
        label: "AI Actions",
        description: "Review suggested admin actions",
      },
    ],
  },
];

function AdminAccessDenied({
  message,
  status,
}: {
  message: string;
  status: number;
}) {
  return (
    <main className="min-h-screen bg-[#05070b] px-4 py-12 text-white">
      <section className="mx-auto max-w-3xl overflow-hidden rounded-[2rem] border border-red-500/20 bg-red-500/[0.07] shadow-2xl shadow-black/40">
        <div className="border-b border-red-500/15 bg-red-500/[0.06] px-6 py-5 sm:px-8">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-red-400/20 bg-red-500/10 text-lg">
              !
            </span>

            <div>
              <div className="text-xs font-black uppercase tracking-[0.28em] text-red-300">
                Admin security
              </div>

              <div className="mt-1 text-sm text-red-100/60">
                Protected SalahNearMe area
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          <h1 className="text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl">
            Access restricted
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-red-100/75">
            {message}
          </p>

          <div className="mt-5 inline-flex rounded-full border border-red-400/20 bg-black/20 px-3 py-1.5 text-xs font-bold text-red-200/70">
            HTTP status {status}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/" className="luxe-button text-sm">
              Return home
            </Link>

            <Link
              href="/business-dashboard"
              className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-bold text-white/75 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
            >
              Business dashboard
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function SidebarNavigation() {
  return (
    <nav className="mt-7 space-y-7" aria-label="Admin navigation">
      {navigationGroups.map((group) => (
        <section key={group.title}>
          <h2 className="px-3 text-[10px] font-black uppercase tracking-[0.24em] text-white/30">
            {group.title}
          </h2>

          <div className="mt-2 space-y-1">
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group block rounded-2xl border border-transparent px-3 py-3 transition hover:border-yellow-400/15 hover:bg-yellow-400/[0.06]"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-bold text-white/75 transition group-hover:text-yellow-300">
                    {item.label}
                  </span>

                  <span className="text-xs text-white/20 transition group-hover:translate-x-0.5 group-hover:text-yellow-300">
                    →
                  </span>
                </div>

                <p className="mt-1 text-[11px] leading-5 text-white/30 transition group-hover:text-white/45">
                  {item.description}
                </p>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </nav>
  );
}

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const permission = await requireAdmin();

  if (!permission.ok) {
    return (
      <AdminAccessDenied
        message={permission.error}
        status={permission.status}
      />
    );
  }

  const adminIdentity = permission.email ?? permission.userId;

  return (
    <div className="min-h-screen bg-[#05070b] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-[1800px]">
        <aside className="hidden w-[290px] shrink-0 border-r border-white/[0.07] bg-[#080b11] lg:block">
          <div className="sticky top-0 max-h-screen overflow-y-auto px-5 py-6">
            <Link href="/admin" className="block">
              <div className="rounded-[1.6rem] border border-yellow-400/20 bg-gradient-to-br from-yellow-400/[0.09] via-white/[0.025] to-transparent p-5">
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-yellow-400">
                  SalahNearMe
                </div>

                <div className="mt-2 text-xl font-black tracking-[-0.03em] text-white">
                  Control Centre
                </div>

                <div className="mt-3 flex items-center gap-2 text-[11px] text-white/40">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.7)]" />
                  Secure admin session
                </div>
              </div>
            </Link>

            <SidebarNavigation />

            <div className="mt-8 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/30">
                Signed in
              </div>

              <div className="mt-2 truncate text-xs font-bold text-white/70">
                {adminIdentity}
              </div>

              <div className="mt-2 inline-flex rounded-full border border-emerald-400/15 bg-emerald-400/[0.07] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-300">
                {permission.role}
              </div>

              <Link
                href="/admin/logout"
                className="mt-4 block rounded-xl border border-white/[0.07] px-3 py-2 text-center text-xs font-bold text-white/45 transition hover:border-red-400/20 hover:bg-red-400/[0.06] hover:text-red-200"
              >
                Sign out
              </Link>
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#05070b]/90 backdrop-blur-xl lg:hidden">
            <div className="flex items-center justify-between gap-4 px-4 py-4">
              <Link href="/admin">
                <div className="text-[10px] font-black uppercase tracking-[0.25em] text-yellow-400">
                  SalahNearMe
                </div>

                <div className="mt-1 text-sm font-black text-white">
                  Admin Control Centre
                </div>
              </Link>

              <div className="rounded-full border border-emerald-400/20 bg-emerald-400/[0.08] px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-300">
                {permission.role}
              </div>
            </div>

            <div className="flex gap-2 overflow-x-auto px-4 pb-4">
              <Link
                href="/admin"
                className="shrink-0 rounded-full border border-yellow-400/20 bg-yellow-400/[0.08] px-4 py-2 text-xs font-bold text-yellow-300"
              >
                Overview
              </Link>

              <Link
                href="/admin/mosque-claims"
                className="shrink-0 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-xs font-bold text-white/60"
              >
                Mosque claims
              </Link>

              <Link
                href="/admin/business-review"
                className="shrink-0 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-xs font-bold text-white/60"
              >
                Business review
              </Link>

              <Link
                href="/admin/mosque-timetable-imports"
                className="shrink-0 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-xs font-bold text-white/60"
              >
                Timetables
              </Link>

              <Link
                href="/admin/ai-assistant"
                className="shrink-0 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-xs font-bold text-white/60"
              >
                AI
              </Link>
            </div>
          </header>

          <div className="min-h-screen">{children}</div>
        </div>
      </div>
    </div>
  );
}