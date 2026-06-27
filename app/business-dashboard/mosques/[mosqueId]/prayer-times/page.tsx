import Link from "next/link";
import { notFound } from "next/navigation";

import MosquePrayerTimesEditor from "@/components/MosquePrayerTimesEditor";
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
  timezone: string | null;
};

type PrayerTimeRow = {
  id: string;
  mosque_id: string;
  prayer_date: string;

  fajr_begins: string | null;
  fajr_iqamah: string | null;

  sunrise: string | null;

  dhuhr_begins: string | null;
  dhuhr_iqamah: string | null;

  asr_begins: string | null;
  asr_iqamah: string | null;

  maghrib_begins: string | null;
  maghrib_iqamah: string | null;

  isha_begins: string | null;
  isha_iqamah: string | null;

  source: string | null;
  confidence: string | null;
  notes: string | null;

  created_at: string;
  updated_at: string;
};

function getTodayDateForTimezone(timezone: string | null | undefined) {
  try {
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone || "Europe/London",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

    const parts = formatter.formatToParts(new Date());

    const day = parts.find((part) => part.type === "day")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const year = parts.find((part) => part.type === "year")?.value;

    if (!day || !month || !year) {
      return new Date().toISOString().slice(0, 10);
    }

    return `${year}-${month}-${day}`;
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export default async function MosquePrayerTimesDashboardPage({
  params,
}: PageProps) {
  const { mosqueId } = await params;

  const { data: mosqueRaw, error: mosqueError } = await supabaseAdmin
    .from("mosques")
    .select("id, name, slug, city, area, postcode, timezone")
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

  const today = getTodayDateForTimezone(mosque.timezone);

  const { data: prayerTimeRaw, error: prayerTimeError } = await supabaseAdmin
    .from("mosque_prayer_times")
    .select("*")
    .eq("mosque_id", mosque.id)
    .eq("prayer_date", today)
    .maybeSingle();

  if (prayerTimeError) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <section className="rounded-3xl border border-red-500/20 bg-red-500/10 p-8 text-red-200">
          {prayerTimeError.message}
        </section>
      </main>
    );
  }

  const prayerTime = prayerTimeRaw as PrayerTimeRow | null;

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
            Edit prayer times
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
                href={`/business-dashboard/mosques/${mosque.id}/timetable-sources`}
                className="text-sm text-white/60 underline hover:text-white"
              >
                Timetable sources
              </Link>

              <Link
                href={`/business-dashboard/mosques/${mosque.id}/jumuah-times`}
                className="text-sm text-white/60 underline hover:text-white"
              >
                Edit Jumu’ah times
              </Link>
            </div>
          ) : null}
        </div>
      </div>

      <MosquePrayerTimesEditor
        mosqueId={mosque.id}
        mosqueName={mosque.name ?? "Mosque"}
        initialPrayerTime={prayerTime}
      />
    </main>
  );
}