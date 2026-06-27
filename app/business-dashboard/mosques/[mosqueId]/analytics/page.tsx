import Link from "next/link";
import { notFound } from "next/navigation";

import MosqueAnalyticsPanel from "@/components/MosqueAnalyticsPanel";
import { requireMosqueManager } from "@/lib/mosqueManagerAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    mosqueId: string;
  }>;
};

type MosqueRow = {
  id: string;
  name: string | null;
  slug: string | null;
  city: string | null;
  area: string | null;
  postcode: string | null;
  verified_status: string | null;
};

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

export default async function MosqueAnalyticsDashboardPage({
  params,
}: PageProps) {
  const { mosqueId } = await params;

  const { data: mosqueRaw, error: mosqueError } = await supabaseAdmin
    .from("mosques")
    .select("id, name, slug, city, area, postcode, verified_status")
    .eq("id", mosqueId)
    .maybeSingle();

  if (mosqueError) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <section className="rounded-3xl border border-red-500/20 bg-red-500/10 p-8 text-red-200">
          {mosqueError.message}
        </section>
      </main>
    );
  }

  if (!mosqueRaw) {
    notFound();
  }

  const mosque = mosqueRaw as MosqueRow;

  const permission = await requireMosqueManager(mosque.id);

  if (!permission.ok) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <section className="rounded-3xl border border-red-500/20 bg-red-500/10 p-8 text-red-200">
          {permission.error}
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/business-dashboard/mosques"
            className="text-sm font-semibold text-yellow-400 hover:text-yellow-300"
          >
            ← Back to mosque dashboard
          </Link>

          <h1 className="mt-4 text-3xl font-black text-white">
            Mosque analytics
          </h1>

          <div className="mt-3 text-sm text-white/50">
            {[mosque.name, mosque.area, mosque.city, mosque.postcode]
              .filter(Boolean)
              .join(" • ") || "Location not available"}
          </div>
        </div>

        <span className="rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-semibold text-green-300">
          {formatLabel(mosque.verified_status)}
        </span>
      </div>

      <section className="mb-8 rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6">
        <div className="text-xs uppercase tracking-[0.22em] text-yellow-400">
          Managed mosque
        </div>

        <h2 className="mt-2 text-2xl font-black text-white">
          {mosque.name ?? "Mosque"}
        </h2>

        <p className="mt-2 text-sm text-white/60">
          {getMosqueLocation(mosque)}
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href={`/business-dashboard/mosques/${mosque.id}/prayer-times`}
            className="rounded-xl border border-yellow-500/30 bg-black px-4 py-2 text-xs font-bold text-yellow-400 hover:bg-yellow-500/10"
          >
            Edit prayer times
          </Link>

          <Link
            href={`/business-dashboard/mosques/${mosque.id}/jumuah-times`}
            className="rounded-xl border border-yellow-500/30 bg-black px-4 py-2 text-xs font-bold text-yellow-400 hover:bg-yellow-500/10"
          >
            Edit Jumu’ah times
          </Link>

          <Link
            href={`/business-dashboard/mosques/${mosque.id}/timetable-sources`}
            className="rounded-xl border border-yellow-500/30 bg-black px-4 py-2 text-xs font-bold text-yellow-400 hover:bg-yellow-500/10"
          >
            Timetable sources
          </Link>

          {mosque.slug ? (
            <Link
              href={`/mosque/${mosque.slug}`}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-white/80 hover:bg-white/10"
            >
              View public page
            </Link>
          ) : null}
        </div>
      </section>

      <MosqueAnalyticsPanel mosqueId={mosque.id} />
    </main>
  );
}