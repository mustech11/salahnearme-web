import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import MosquePrayerTimesEditor from "@/components/MosquePrayerTimesEditor";
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

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const metadata: Metadata = {
  title: "Edit Mosque Prayer Times | SalahNearMe",
  description:
    "Manage daily mosque beginning times and iqamah times inside the SalahNearMe mosque manager dashboard.",
  robots: {
    index: false,
    follow: false,
  },
};

function isUuid(value: string) {
  return UUID_REGEX.test(value);
}

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

function formatDateLabel(value: string, timezone: string) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: timezone,
    }).format(new Date(`${value}T12:00:00.000Z`));
  } catch {
    return value;
  }
}

function getMosqueLocation(mosque: MosqueRow) {
  return (
    [mosque.area, mosque.city, mosque.postcode].filter(Boolean).join(" • ") ||
    "Location not available"
  );
}

function hasAnyTimes(row: PrayerTimeRow | null) {
  if (!row) {
    return false;
  }

  return Boolean(
    row.fajr_begins ||
      row.fajr_iqamah ||
      row.sunrise ||
      row.dhuhr_begins ||
      row.dhuhr_iqamah ||
      row.asr_begins ||
      row.asr_iqamah ||
      row.maghrib_begins ||
      row.maghrib_iqamah ||
      row.isha_begins ||
      row.isha_iqamah
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

export default async function MosquePrayerTimesDashboardPage({
  params,
}: PageProps) {
  const { mosqueId } = await params;

  if (!isUuid(mosqueId)) {
    notFound();
  }

  const { data: mosqueRaw, error: mosqueError } = await supabaseAdmin
    .from("mosques")
    .select("id, name, slug, city, area, postcode, timezone")
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
          "You do not have permission to manage prayer times for this mosque."
        }
      />
    );
  }

  const timezone = mosque.timezone || "Europe/London";
  const today = getTodayDateForTimezone(timezone);

  const { data: prayerTimeRaw, error: prayerTimeError } = await supabaseAdmin
    .from("mosque_prayer_times")
    .select(
      [
        "id",
        "mosque_id",
        "prayer_date",
        "fajr_begins",
        "fajr_iqamah",
        "sunrise",
        "dhuhr_begins",
        "dhuhr_iqamah",
        "asr_begins",
        "asr_iqamah",
        "maghrib_begins",
        "maghrib_iqamah",
        "isha_begins",
        "isha_iqamah",
        "source",
        "confidence",
        "notes",
        "created_at",
        "updated_at",
      ].join(",")
    )
    .eq("mosque_id", mosque.id)
    .eq("prayer_date", today)
    .maybeSingle();

  if (prayerTimeError) {
    return <ErrorPanel message={prayerTimeError.message} />;
  }

  const prayerTime = prayerTimeRaw as PrayerTimeRow | null;
  const hasTimes = hasAnyTimes(prayerTime);

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
            Edit prayer times
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-7 text-white/60">
            Manage today’s beginning and iqamah times. These times power the
            public mosque page, timetable pages, and Pray Near Me accuracy.
          </p>
        </div>

        <div
          className={
            hasTimes
              ? "rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-black text-emerald-300"
              : "rounded-full border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-xs font-black text-yellow-300"
          }
        >
          {hasTimes ? "Times found today" : "No times for today"}
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

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs font-bold text-white/60">
            {formatDateLabel(today, timezone)}
          </span>

          <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs font-bold text-white/60">
            {timezone}
          </span>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <ManagerLink
            href={`/business-dashboard/mosques/${mosque.id}/jumuah-times`}
          >
            Edit Jumu’ah
          </ManagerLink>

          <ManagerLink
            href={`/business-dashboard/mosques/${mosque.id}/timetable-sources`}
          >
            Timetable sources
          </ManagerLink>

          <ManagerLink
            href={`/business-dashboard/mosques/${mosque.id}/data-quality`}
            primary
          >
            Data quality
          </ManagerLink>

          <ManagerLink
            href={`/business-dashboard/mosques/${mosque.id}/analytics`}
          >
            Analytics
          </ManagerLink>

          {mosque.slug ? (
            <>
              <Link
                href={`/mosque/${mosque.slug}`}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-black text-white/80 hover:bg-white/10"
              >
                View public page
              </Link>

              <Link
                href={`/mosque/${mosque.slug}/timetable`}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-black text-white/80 hover:bg-white/10"
              >
                Public timetable
              </Link>
            </>
          ) : null}
        </div>
      </section>

      {!hasTimes ? (
        <section className="mb-8 rounded-3xl border border-yellow-500/20 bg-yellow-500/10 p-6">
          <div className="text-xl font-black text-yellow-100">
            Today’s prayer times are missing
          </div>

          <p className="mt-3 max-w-3xl text-sm leading-7 text-yellow-100/70">
            Add today’s beginning and iqamah times so users can rely on this
            mosque in Pray Near Me and on the public timetable page.
          </p>
        </section>
      ) : null}

      <MosquePrayerTimesEditor
        mosqueId={mosque.id}
        mosqueName={mosque.name ?? "Mosque"}
        initialPrayerTime={prayerTime}
      />
    </main>
  );
}