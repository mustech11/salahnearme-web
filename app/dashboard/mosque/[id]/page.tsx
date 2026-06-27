import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireUser } from "@/lib/auth";
import { canManageMosque } from "@/lib/mosquePermissions";
import MosqueManagementEditor from "@/components/MosqueManagementEditor";

export const revalidate = 0;

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function MosqueDashboardPage({ params }: PageProps) {
  const { id } = await params;
  const user = await requireUser();
  const email = (user.email ?? "").trim().toLowerCase();

  const allowed = await canManageMosque(id, email);

  if (!allowed) {
    notFound();
  }

  const supabase = await supabaseServer();

  const { data: mosque, error: mosqueError } = await supabase
    .from("mosques")
    .select(
      "id,name,area,city,postcode,address,maps_url,jumuah_enabled,jumuah_khutbah_1,jumuah_salah_1,jumuah_khutbah_2,jumuah_salah_2,jumuah_khutbah_3,jumuah_salah_3,jumuah_notes"
    )
    .eq("id", id)
    .maybeSingle();

  if (mosqueError) {
    return <pre className="text-white/80">{mosqueError.message}</pre>;
  }

  if (!mosque) {
    notFound();
  }

  let prayerTimes = null;

  if (mosque.city) {
    const { data: cityRow } = await supabase
      .from("cities")
      .select("id")
      .eq("name", mosque.city)
      .maybeSingle();

    if (cityRow?.id) {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      const { data: prayerTimesRow } = await supabase
        .from("city_prayer_times")
        .select(
          "fajr_start,sunrise,dhuhr_start,asr_start,maghrib_start,isha_start"
        )
        .eq("city_id", cityRow.id)
        .eq("month", month)
        .eq("year", year)
        .maybeSingle();

      prayerTimes = prayerTimesRow ?? null;
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
        <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
          Mosque Dashboard
        </div>

        <h1 className="mt-3 text-4xl font-bold text-white">
          Manage mosque settings
        </h1>

        <p className="mt-3 max-w-3xl text-white/70">
          Update Jumu’ah sessions, prayer times, and mosque details used across
          the SalahNearMe platform.
        </p>

        <div className="mt-6">
          <Link
            href="/dashboard"
            className="text-sm font-medium text-yellow-400 hover:text-yellow-300"
          >
            ← Back to dashboard
          </Link>
        </div>
      </section>

      <MosqueManagementEditor mosque={mosque} prayerTimes={prayerTimes} />
    </div>
  );
}