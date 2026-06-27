import Link from "next/link";
import { notFound } from "next/navigation";

import MosqueJumuahTimesEditor from "@/components/MosqueJumuahTimesEditor";
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

export default async function MosqueJumuahTimesDashboardPage({
  params,
}: PageProps) {
  const { mosqueId } = await params;

  const { data: mosqueRaw, error: mosqueError } = await supabaseAdmin
    .from("mosques")
    .select("id, name, slug, city, area, postcode")
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

  const { data: jumuahRowsRaw, error: jumuahError } = await supabaseAdmin
    .from("mosque_jumuah_times")
    .select("*")
    .eq("mosque_id", mosque.id)
    .order("salah_time", {
      ascending: true,
    });

  if (jumuahError) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <section className="rounded-3xl border border-red-500/20 bg-red-500/10 p-8 text-red-200">
          {jumuahError.message}
        </section>
      </main>
    );
  }

  const jumuahRows = (jumuahRowsRaw ?? []) as JumuahTimeRow[];

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/business-dashboard/mosques"
            className="text-sm font-semibold text-yellow-400 hover:text-yellow-300"
          >
            ← Back to mosque dashboard
          </Link>

          <h1 className="mt-4 text-3xl font-black text-white">
            Edit Jumu’ah times
          </h1>

          <div className="mt-3 text-sm text-white/50">
            {[mosque.name, mosque.area, mosque.city, mosque.postcode]
              .filter(Boolean)
              .join(" • ") || "Location not available"}
          </div>

          {mosque.slug ? (
            <div className="mt-3 flex flex-wrap gap-4">
              <Link
                href={`/mosque/${mosque.slug}`}
                className="text-sm text-white/60 underline hover:text-white"
              >
                View public mosque page
              </Link>

              <Link
                href={`/business-dashboard/mosques/${mosque.id}/prayer-times`}
                className="text-sm text-white/60 underline hover:text-white"
              >
                Edit prayer times
              </Link>

              <Link
                href={`/business-dashboard/mosques/${mosque.id}/timetable-sources`}
                className="text-sm text-white/60 underline hover:text-white"
              >
                Timetable sources
              </Link>
            </div>
          ) : null}
        </div>
      </div>

      <MosqueJumuahTimesEditor
        mosqueId={mosque.id}
        mosqueName={mosque.name ?? "Mosque"}
        initialJumuahTimes={jumuahRows}
        />
    </main>
  );
}