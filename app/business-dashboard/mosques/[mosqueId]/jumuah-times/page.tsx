import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import MosqueJumuahTimesEditor from "@/components/MosqueJumuahTimesEditor";
import { requireMosqueManager } from "@/lib/mosqueManagerAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
};

type JumuahTimeRow = {
  id: string;
  mosque_id: string;
  label: string | null;
  khutbah_time: string | null;
  salah_time: string;
  active: boolean | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const metadata: Metadata = {
  title: "Edit Jumu’ah Times | SalahNearMe",
  description:
    "Manage Friday khutbah and Jumu’ah salah times for a mosque inside the SalahNearMe mosque manager dashboard.",
  robots: {
    index: false,
    follow: false,
  },
};

function isUuid(value: string) {
  return UUID_REGEX.test(value);
}

function getMosqueLocation(mosque: MosqueRow) {
  return (
    [mosque.area, mosque.city, mosque.postcode].filter(Boolean).join(" • ") ||
    "Location not available"
  );
}

function ErrorPanel({
  title = "Dashboard error",
  message,
}: {
  title?: string;
  message: string;
}) {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <section className="rounded-3xl border border-red-500/20 bg-red-500/10 p-8">
        <div className="text-sm uppercase tracking-[0.24em] text-red-300">
          {title}
        </div>

        <h1 className="mt-3 text-3xl font-black text-white">
          Something needs attention
        </h1>

        <p className="mt-3 text-sm leading-7 text-red-100/80">{message}</p>

        <Link
          href="/business-dashboard/mosques"
          className="mt-6 inline-flex rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-bold text-white/80 hover:bg-white/10"
        >
          Back to mosque dashboard
        </Link>
      </section>
    </main>
  );
}

function ManagerLink({
  href,
  children,
  primary = false,
}: {
  href: string;
  children: React.ReactNode;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        primary
          ? "rounded-xl bg-yellow-500 px-4 py-3 text-xs font-black text-black hover:bg-yellow-400"
          : "rounded-xl border border-yellow-500/30 bg-black px-4 py-3 text-xs font-black text-yellow-400 hover:bg-yellow-500/10"
      }
    >
      {children}
    </Link>
  );
}

export default async function MosqueJumuahTimesDashboardPage({
  params,
}: PageProps) {
  const { mosqueId } = await params;

  if (!isUuid(mosqueId)) {
    notFound();
  }

  const { data: mosqueRaw, error: mosqueError } = await supabaseAdmin
    .from("mosques")
    .select("id, name, slug, city, area, postcode")
    .eq("id", mosqueId)
    .maybeSingle();

  if (mosqueError) {
    return <ErrorPanel message={mosqueError.message} />;
  }

  if (!mosqueRaw) {
    notFound();
  }

  const mosque = mosqueRaw as MosqueRow;

  const permission = await requireMosqueManager(mosque.id);

  if (!permission.ok) {
    return (
      <ErrorPanel
        title="Access denied"
        message={
          permission.error ||
          "You do not have permission to manage Jumu’ah times for this mosque."
        }
      />
    );
  }

  const { data: jumuahRowsRaw, error: jumuahError } = await supabaseAdmin
    .from("mosque_jumuah_times")
    .select(
      [
        "id",
        "mosque_id",
        "label",
        "khutbah_time",
        "salah_time",
        "active",
        "notes",
        "created_at",
        "updated_at",
      ].join(",")
    )
    .eq("mosque_id", mosque.id)
    .order("active", { ascending: false })
    .order("salah_time", { ascending: true });

  if (jumuahError) {
    return <ErrorPanel message={jumuahError.message} />;
  }

  const jumuahRows = (jumuahRowsRaw ?? []) as unknown as JumuahTimeRow[];

  const activeCount = jumuahRows.filter(
  (row: JumuahTimeRow) => row.active !== false
).length;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            href="/business-dashboard/mosques"
            className="text-sm font-semibold text-yellow-400 hover:text-yellow-300"
          >
            ← Back to mosque dashboard
          </Link>

          <h1 className="mt-4 text-4xl font-black text-white">
            Edit Jumu’ah times
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-7 text-white/60">
            Manage Friday prayer sessions, khutbah times, salah times, labels,
            notes, and active status for the public mosque page.
          </p>
        </div>

        <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-black text-emerald-300">
          {activeCount} active session{activeCount === 1 ? "" : "s"}
        </div>
      </div>

      <section className="mb-8 rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6">
        <div className="text-xs uppercase tracking-[0.24em] text-yellow-400">
          Managed mosque
        </div>

        <h2 className="mt-3 text-3xl font-black text-white">
          {mosque.name ?? "Mosque"}
        </h2>

        <p className="mt-2 text-sm text-white/60">
          {getMosqueLocation(mosque)}
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <ManagerLink
            href={`/business-dashboard/mosques/${mosque.id}/prayer-times`}
          >
            Edit prayer times
          </ManagerLink>

          <ManagerLink
            href={`/business-dashboard/mosques/${mosque.id}/timetable-sources`}
          >
            Timetable sources
          </ManagerLink>

          <ManagerLink
            href={`/business-dashboard/mosques/${mosque.id}/data-quality`}
          >
            Data quality
          </ManagerLink>

          <ManagerLink
            href={`/business-dashboard/mosques/${mosque.id}/analytics`}
          >
            Analytics
          </ManagerLink>

          {mosque.slug ? (
            <Link
              href={`/mosque/${mosque.slug}`}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-black text-white/80 hover:bg-white/10"
            >
              View public page
            </Link>
          ) : null}
        </div>
      </section>

      {jumuahRows.length === 0 ? (
        <section className="mb-8 rounded-3xl border border-yellow-500/20 bg-yellow-500/10 p-6">
          <div className="text-xl font-black text-yellow-100">
            No Jumu’ah times yet
          </div>

          <p className="mt-3 max-w-3xl text-sm leading-7 text-yellow-100/70">
            Add at least one Friday prayer session so visitors know when khutbah
            and Jumu’ah salah take place.
          </p>
        </section>
      ) : null}

      <MosqueJumuahTimesEditor
        mosqueId={mosque.id}
        mosqueName={mosque.name ?? "Mosque"}
        initialJumuahTimes={jumuahRows}
      />
    </main>
  );
}