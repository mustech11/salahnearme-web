import Link from "next/link";

import AdminGate from "@/components/AdminGate";
import { supabaseServer } from "@/lib/supabaseServer";

export const revalidate = 0;

type TimetableSourceRow = {
  id: string;
  mosque_id: string;
  source_url: string;
  source_type: string | null;
  auto_import_enabled: boolean | null;
  last_checked_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string | null;
  mosques?: {
    id: string;
    name: string | null;
    slug: string | null;
    city: string | null;
    area: string | null;
    postcode: string | null;
  } | null;
};

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "Never";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date.toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function sourceTypeLabel(value: string | null | undefined) {
  if (!value) {
    return "Website";
  }

  return value
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusLabel(item: TimetableSourceRow) {
  if (item.last_error) {
    return "Has Error";
  }

  if (item.last_success_at) {
    return "Successful";
  }

  if (item.last_checked_at) {
    return "Checked";
  }

  return "Not Checked";
}

function statusClassName(item: TimetableSourceRow) {
  if (item.last_error) {
    return "border-red-500/30 bg-red-500/10 text-red-300";
  }

  if (item.last_success_at) {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }

  if (item.last_checked_at) {
    return "border-blue-500/30 bg-blue-500/10 text-blue-300";
  }

  return "border-yellow-500/30 bg-yellow-500/10 text-yellow-400";
}

export default async function AdminMosqueTimetableSourcesPage() {
  const supabase = await supabaseServer();

  const [
    { count: totalSources },
    { count: autoImportEnabled },
    { count: successfulSources },
    { count: errorSources },
    { data: sourcesRaw, error: sourcesError },
  ] = await Promise.all([
    supabase
      .from("mosque_timetable_sources")
      .select("*", { count: "exact", head: true }),

    supabase
      .from("mosque_timetable_sources")
      .select("*", { count: "exact", head: true })
      .eq("auto_import_enabled", true),

    supabase
      .from("mosque_timetable_sources")
      .select("*", { count: "exact", head: true })
      .not("last_success_at", "is", null),

    supabase
      .from("mosque_timetable_sources")
      .select("*", { count: "exact", head: true })
      .not("last_error", "is", null),

    supabase
      .from("mosque_timetable_sources")
      .select(
        `
        id,
        mosque_id,
        source_url,
        source_type,
        auto_import_enabled,
        last_checked_at,
        last_success_at,
        last_error,
        created_at,
        updated_at,
        mosques:mosque_id (
          id,
          name,
          slug,
          city,
          area,
          postcode
        )
      `
      )
      .order("created_at", {
        ascending: false,
      })
      .limit(100),
  ]);

  const sources = (sourcesRaw ?? []) as unknown as TimetableSourceRow[];

  return (
    <AdminGate>
      <div className="space-y-8">
        <section className="luxe-card rounded-3xl p-8 md:p-10">
          <Link
            href="/admin"
            className="text-sm font-semibold text-yellow-400 hover:text-yellow-300"
          >
            ← Back to admin
          </Link>

          <div className="mt-6 text-sm uppercase tracking-[0.25em] text-yellow-400">
            Mosque Timetable Engine
          </div>

          <h1 className="dashboard-hero-glow mt-4 text-4xl font-black tracking-[-0.04em] text-white md:text-5xl">
            Timetable Sources
          </h1>

          <p className="mt-4 max-w-3xl text-white/70">
            Review mosque timetable source URLs, websites, PDFs, image sources,
            manual sources, import readiness, success history, and errors.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/admin/mosque-timetable-imports"
              className="luxe-button-outline text-sm"
            >
              Timetable imports
            </Link>

            <Link
              href="/admin/mosque-prayer-times"
              className="luxe-button-outline text-sm"
            >
              Published prayer rows
            </Link>

            <Link href="/admin/mosque-claims" className="luxe-button text-sm">
              Mosque claims
            </Link>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card title="Total Sources" value={totalSources ?? 0} />
          <Card
            title="Auto Import Enabled"
            value={autoImportEnabled ?? 0}
            tone="purple"
          />
          <Card
            title="Successful Sources"
            value={successfulSources ?? 0}
            tone="green"
          />
          <Card title="Sources With Errors" value={errorSources ?? 0} tone="red" />
        </section>

        {sourcesError ? (
          <section className="rounded-3xl border border-red-500/20 bg-red-500/10 p-6 text-red-200">
            {sourcesError.message}
          </section>
        ) : null}

        <section className="luxe-card rounded-3xl p-6">
          <div>
            <h2 className="text-2xl font-black text-white">
              Recent timetable sources
            </h2>

            <p className="mt-2 text-sm text-white/60">
              Showing the latest 100 timetable source records.
            </p>
          </div>

          {sources.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-6 text-white/60">
              No timetable sources found yet.
            </div>
          ) : (
            <div className="mt-6 grid gap-4">
              {sources.map((item) => {
                const mosque = item.mosques;

                return (
                  <article
                    key={item.id}
                    className="rounded-2xl border border-white/10 bg-black/30 p-5"
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-xl font-bold text-white">
                            {mosque?.name ?? "Unknown mosque"}
                          </div>

                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-bold ${statusClassName(
                              item
                            )}`}
                          >
                            {statusLabel(item)}
                          </span>

                          {item.auto_import_enabled ? (
                            <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-bold text-purple-300">
                              Auto import
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-1 text-xs text-white/50">
                          {[mosque?.area, mosque?.city, mosque?.postcode]
                            .filter(Boolean)
                            .join(" • ") || "Location not available"}
                        </div>

                        <div className="mt-3 break-all text-xs text-white/50">
                          {sourceTypeLabel(item.source_type)} •{" "}
                          {item.source_url}
                        </div>

                        <div className="mt-3 grid gap-2 text-xs text-white/40 sm:grid-cols-2 xl:grid-cols-4">
                          <div>Created: {formatDateTime(item.created_at)}</div>
                          <div>Updated: {formatDateTime(item.updated_at)}</div>
                          <div>
                            Last checked: {formatDateTime(item.last_checked_at)}
                          </div>
                          <div>
                            Last success: {formatDateTime(item.last_success_at)}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {mosque?.slug ? (
                          <Link
                            href={`/mosque/${mosque.slug}`}
                            className="rounded-xl border border-yellow-500/30 px-4 py-2 text-xs font-bold text-yellow-400 hover:bg-yellow-500/10"
                          >
                            Public page
                          </Link>
                        ) : null}

                        <Link
                          href={`/business-dashboard/mosques/${item.mosque_id}/timetable-sources`}
                          className="rounded-xl border border-white/10 px-4 py-2 text-xs font-bold text-white/70 hover:border-yellow-400 hover:text-yellow-400"
                        >
                          Manager view
                        </Link>
                      </div>
                    </div>

                    {item.last_error ? (
                      <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-300">
                        {item.last_error}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AdminGate>
  );
}

function Card({
  title,
  value,
  tone = "yellow",
}: {
  title: string;
  value: number;
  tone?: "yellow" | "green" | "red" | "purple";
}) {
  const toneClass =
    tone === "green"
      ? "text-green-300"
      : tone === "red"
        ? "text-red-300"
        : tone === "purple"
          ? "text-purple-300"
          : "text-yellow-400";

  return (
    <div className="luxe-card-soft rounded-2xl p-5">
      <div className={`text-sm font-medium ${toneClass}`}>{title}</div>
      <div className="mt-3 text-4xl font-black text-white">{value}</div>
    </div>
  );
}

