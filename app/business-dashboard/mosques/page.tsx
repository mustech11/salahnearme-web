import type { ReactNode } from "react";

import Link from "next/link";

import MosqueAnalyticsPreviewCard from "@/components/MosqueAnalyticsPreviewCard";
import MosqueCorrectionReportsPreviewCard from "@/components/MosqueCorrectionReportsPreviewCard";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

type MosqueSummary = {
  id: string;
  name: string | null;
  slug: string | null;
  city: string | null;
  area: string | null;
  postcode: string | null;
  verified_status: string | null;
};

type MosqueClaimRow = {
  id: string;
  mosque_id: string;
  user_id: string;
  status: string | null;
  role?: string | null;
  mosques: MosqueSummary | MosqueSummary[] | null;
};

type MosqueRow = MosqueSummary;

type CorrectionCountRow = {
  mosque_id: string;
  status: string | null;
};

function getJoinedMosque(value: MosqueClaimRow["mosques"]) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function formatLabel(value: string | null | undefined) {
  if (!value) {
    return "Pending";
  }

  return value
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getMosqueLocation(mosque: MosqueRow) {
  return (
    [mosque.area, mosque.city, mosque.postcode].filter(Boolean).join(" • ") ||
    "Location not available"
  );
}

function getMosqueName(mosque: MosqueRow) {
  return mosque.name?.trim() || "Mosque";
}

function getOpenCorrectionCount(
  openCorrectionsByMosque: Map<string, number>,
  mosqueId: string
) {
  return openCorrectionsByMosque.get(mosqueId) ?? 0;
}

function DisabledDashboardButton({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-xs font-bold text-white/30">
      {children}
    </span>
  );
}

function DashboardButton({
  href,
  children,
  variant = "default",
}: {
  href: string;
  children: ReactNode;
  variant?: "default" | "analytics" | "quality" | "warning" | "public";
}) {
  const className =
    variant === "analytics"
      ? "rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-center text-xs font-bold text-emerald-300 hover:bg-emerald-500/20"
      : variant === "quality"
        ? "rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-center text-xs font-bold text-cyan-300 hover:bg-cyan-500/20"
        : variant === "warning"
          ? "rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-center text-xs font-bold text-yellow-300 hover:bg-yellow-500/20"
          : variant === "public"
            ? "rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-xs font-bold text-white/80 hover:bg-white/10"
            : "rounded-xl border border-yellow-500/30 bg-black px-4 py-3 text-center text-xs font-bold text-yellow-400 hover:bg-yellow-500/10";

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <section className="rounded-3xl border border-red-500/20 bg-red-500/10 p-8 text-red-200">
        {message}
      </section>
    </main>
  );
}

function CorrectionButtonContent({ openCount }: { openCount: number }) {
  return (
    <span className="flex items-center justify-center gap-2">
      <span>Correction reports</span>

      <span className="rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-[10px] font-black">
        {openCount > 0 ? `${openCount} open` : "All clear"}
      </span>
    </span>
  );
}

export default async function BusinessDashboardMosquesPage() {
  const supabase = await supabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <section className="rounded-3xl border border-red-500/20 bg-red-500/10 p-8 text-red-200">
          You must be signed in to manage mosque pages.
        </section>
      </main>
    );
  }

  const { data: claimsRaw, error } = await supabase
    .from("mosque_claims")
    .select(
      `
      id,
      mosque_id,
      user_id,
      status,
      role,
      mosques:mosque_id (
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
    .eq("user_id", user.id)
    .in("status", ["approved", "active", "verified"])
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    return <ErrorPanel message={error.message} />;
  }

  const claims = (claimsRaw ?? []) as unknown as MosqueClaimRow[];

  const mosques = claims
    .map((claim) => getJoinedMosque(claim.mosques))
    .filter((mosque): mosque is MosqueRow => Boolean(mosque));

  const mosqueIds = mosques.map((mosque) => mosque.id);

  const { data: correctionCountsRaw, error: correctionCountsError } =
    mosqueIds.length > 0
      ? await supabase
          .from("mosque_correction_reports")
          .select("mosque_id, status")
          .in("mosque_id", mosqueIds)
      : {
          data: [],
          error: null,
        };

  if (correctionCountsError) {
    return <ErrorPanel message={correctionCountsError.message} />;
  }

  const correctionCounts = (correctionCountsRaw ??
    []) as CorrectionCountRow[];

  const openCorrectionsByMosque = new Map<string, number>();

  for (const report of correctionCounts) {
    if (report.status === "new" || report.status === "reviewing") {
      openCorrectionsByMosque.set(
        report.mosque_id,
        (openCorrectionsByMosque.get(report.mosque_id) ?? 0) + 1
      );
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6 md:p-8">
        <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
          Mosque Dashboard
        </div>

        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-4xl font-black text-white">
              Manage your mosque pages
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/60">
              Update mosque prayer times, Jumu’ah sessions, timetable sources,
              public page information, Pray Near Me analytics, correction
              reports, and timetable data quality.
            </p>
          </div>

          <Link href="/claim/mosque" className="luxe-button text-sm">
            Claim another mosque
          </Link>
        </div>
      </section>

      {mosques.length === 0 ? (
        <section className="mt-8 rounded-3xl border border-white/10 bg-black/30 p-8 text-white/70">
          <div className="text-xl font-bold text-white">
            No approved mosque claims found
          </div>

          <p className="mt-3 max-w-2xl text-sm leading-7 text-white/60">
            Once a mosque claim is approved, it will appear here for management.
            You will then be able to manage prayer times, Jumu’ah sessions,
            timetable quality, analytics, correction reports, and public mosque
            information.
          </p>

          <div className="mt-5">
            <Link href="/claim/mosque" className="luxe-button text-sm">
              Claim a mosque
            </Link>
          </div>
        </section>
      ) : (
        <section className="mt-8 grid gap-5 lg:grid-cols-2">
          {mosques.map((mosque) => {
            const openCount = getOpenCorrectionCount(
              openCorrectionsByMosque,
              mosque.id
            );

            return (
              <article
                key={mosque.id}
                className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-[0.22em] text-yellow-400">
                      Managed mosque
                    </div>

                    <h2
                      dir="auto"
                      className="mt-2 text-2xl font-black leading-tight text-white"
                    >
                      {getMosqueName(mosque)}
                    </h2>

                    <div className="mt-2 text-sm text-white/60">
                      {getMosqueLocation(mosque)}
                    </div>
                  </div>

                  <span className="w-fit rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-semibold text-green-300">
                    {formatLabel(mosque.verified_status)}
                  </span>
                </div>

                <MosqueAnalyticsPreviewCard mosqueId={mosque.id} />

                <MosqueCorrectionReportsPreviewCard mosqueId={mosque.id} />

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <DashboardButton
                    href={`/business-dashboard/mosques/${mosque.id}/analytics`}
                    variant="analytics"
                  >
                    Analytics
                  </DashboardButton>

                  <DashboardButton
                    href={`/business-dashboard/mosques/${mosque.id}/data-quality`}
                    variant="quality"
                  >
                    Data quality
                  </DashboardButton>

                  <DashboardButton
                    href={`/business-dashboard/mosques/${mosque.id}/correction-reports`}
                    variant={openCount > 0 ? "warning" : "quality"}
                  >
                    <CorrectionButtonContent openCount={openCount} />
                  </DashboardButton>

                  <DashboardButton
                    href={`/business-dashboard/mosques/${mosque.id}/prayer-times`}
                  >
                    Edit prayer times
                  </DashboardButton>

                  <DashboardButton
                    href={`/business-dashboard/mosques/${mosque.id}/jumuah-times`}
                  >
                    Edit Jumu’ah times
                  </DashboardButton>

                  <DashboardButton
                    href={`/business-dashboard/mosques/${mosque.id}/timetable-sources`}
                  >
                    Timetable sources
                  </DashboardButton>

                  {mosque.slug ? (
                    <DashboardButton
                      href={`/mosque/${mosque.slug}/timetable`}
                      variant="public"
                    >
                      Public timetable
                    </DashboardButton>
                  ) : (
                    <DisabledDashboardButton>
                      Public timetable
                    </DisabledDashboardButton>
                  )}

                  {mosque.slug ? (
                    <DashboardButton
                      href={`/mosque/${mosque.slug}`}
                      variant="public"
                    >
                      View public page
                    </DashboardButton>
                  ) : (
                    <DisabledDashboardButton>
                      View public page
                    </DisabledDashboardButton>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}

