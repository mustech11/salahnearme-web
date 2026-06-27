import Link from "next/link";
import { notFound } from "next/navigation";

import MosqueCorrectionReportForm from "@/components/MosqueCorrectionReportForm";
import MosqueTrustBadges from "@/components/MosqueTrustBadges";
import PrintButton from "@/components/PrintButton";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<{
    month?: string;
    year?: string;
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
  verified_status: string | null;
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
};

function cleanMonth(value: string | undefined) {
  const month = Number(value);

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return new Date().getMonth() + 1;
  }

  return month;
}

function cleanYear(value: string | undefined) {
  const year = Number(value);

  if (!Number.isInteger(year) || year < 2020 || year > 2100) {
    return new Date().getFullYear();
  }

  return year;
}

function monthName(month: number, year: number) {
  return new Date(year, month - 1, 1).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
}

function buildDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
    2,
    "0"
  )}`;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function formatTime(value: string | null) {
  if (!value) {
    return "—";
  }

  return value.slice(0, 5);
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

function formatPrintDate(value: string) {
  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
  });
}

function formatLabel(value: string | null | undefined) {
  if (!value) {
    return "Published";
  }

  return value
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getPreviousMonth(month: number, year: number) {
  if (month === 1) {
    return {
      month: 12,
      year: year - 1,
    };
  }

  return {
    month: month - 1,
    year,
  };
}

function getNextMonth(month: number, year: number) {
  if (month === 12) {
    return {
      month: 1,
      year: year + 1,
    };
  }

  return {
    month: month + 1,
    year,
  };
}

function getTodayDateForTimezone(timezone: string | null | undefined) {
  const safeTimezone = timezone || "Europe/London";

  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: safeTimezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());

    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;

    if (year && month && day) {
      return `${year}-${month}-${day}`;
    }
  } catch {
    // Fallback below.
  }

  return new Date().toISOString().slice(0, 10);
}

function hasMissingIqamah(row: PrayerTimeRow) {
  return Boolean(
    !row.fajr_iqamah ||
      !row.dhuhr_iqamah ||
      !row.asr_iqamah ||
      !row.maghrib_iqamah ||
      !row.isha_iqamah
  );
}

function countRowsMissingIqamah(rows: PrayerTimeRow[]) {
  return rows.filter(hasMissingIqamah).length;
}

function getSourceLabel(row: PrayerTimeRow) {
  return formatLabel(row.confidence ?? row.source ?? "published");
}

function getSourceClassName(row: PrayerTimeRow) {
  const value = `${row.confidence ?? ""} ${row.source ?? ""}`.toLowerCase();

  if (value.includes("verified") || value.includes("official")) {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  }

  if (
    value.includes("needs") ||
    value.includes("low") ||
    value.includes("unverified")
  ) {
    return "border-red-500/20 bg-red-500/10 text-red-300";
  }

  return "border-yellow-500/20 bg-yellow-500/10 text-yellow-300";
}

async function getManagerAccess(mosqueId: string) {
  try {
    const supabase = await supabaseServer();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return false;
    }

    const { data: claim } = await supabase
      .from("mosque_claims")
      .select("id")
      .eq("mosque_id", mosqueId)
      .eq("user_id", user.id)
      .in("status", ["approved", "active", "verified"])
      .maybeSingle();

    return Boolean(claim);
  } catch {
    return false;
  }
}

export default async function MosqueMonthlyTimetablePage({
  params,
  searchParams,
}: PageProps) {
  const { slug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};

  const month = cleanMonth(resolvedSearchParams.month);
  const year = cleanYear(resolvedSearchParams.year);

  const { data: mosqueRaw, error: mosqueError } = await supabaseAdmin
    .from("mosques")
    .select("id, name, slug, city, area, postcode, timezone, verified_status")
    .eq("slug", slug)
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

  const startDate = buildDate(year, month, 1);
  const endDate = buildDate(year, month, daysInMonth(year, month));
  const today = getTodayDateForTimezone(mosque.timezone);

  const { data: prayerRowsRaw, error: prayerError } = await supabaseAdmin
    .from("mosque_prayer_times")
    .select("*")
    .eq("mosque_id", mosque.id)
    .gte("prayer_date", startDate)
    .lte("prayer_date", endDate)
    .order("prayer_date", {
      ascending: true,
    });

  if (prayerError) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <section className="rounded-3xl border border-red-500/20 bg-red-500/10 p-8 text-red-200">
          {prayerError.message}
        </section>
      </main>
    );
  }

  const prayerRows = (prayerRowsRaw ?? []) as PrayerTimeRow[];
  const previous = getPreviousMonth(month, year);
  const next = getNextMonth(month, year);
  const missingIqamahCount = countRowsMissingIqamah(prayerRows);
  const hasTodayInThisMonth = prayerRows.some(
    (row) => row.prayer_date === today
  );
  const isManager = await getManagerAccess(mosque.id);

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 print:max-w-none print:px-0 print:py-0">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4 print:mb-4">
        <div>
          <Link
            href={`/mosque/${mosque.slug}`}
            className="text-sm font-semibold text-yellow-400 hover:text-yellow-300 print:hidden"
          >
            ← Back to mosque page
          </Link>

          <div className="hidden print:block print:text-center">
            <div className="text-lg font-bold text-black">
              SalahNearMe Mosque Timetable
            </div>
          </div>

          <h1
            dir="auto"
            className="mt-4 text-3xl font-black text-white print:mt-2 print:text-center print:text-2xl print:text-black"
          >
            Monthly prayer timetable
          </h1>

          <div className="mt-2 text-xl font-bold text-yellow-400 print:text-center print:text-lg print:text-black">
            {monthName(month, year)}
          </div>

          <div className="mt-3 text-sm text-white/50 print:text-center print:text-black">
            {[mosque.name, mosque.area, mosque.city, mosque.postcode]
              .filter(Boolean)
              .join(" • ") || "Location not available"}
          </div>

          <div className="mt-3 text-xs text-white/40 print:text-center print:text-black">
            Mosque timezone: {mosque.timezone ?? "Europe/London"} • Today:{" "}
            {today}
          </div>
        </div>

        <div className="flex flex-wrap gap-3 print:hidden">
          <Link
            href={`/mosque/${mosque.slug}/timetable?month=${previous.month}&year=${previous.year}`}
            className="rounded-xl border border-yellow-500/30 px-4 py-2 text-sm font-bold text-yellow-400 hover:bg-yellow-500/10"
          >
            Previous month
          </Link>

          <Link
            href={`/mosque/${mosque.slug}/timetable?month=${next.month}&year=${next.year}`}
            className="rounded-xl border border-yellow-500/30 px-4 py-2 text-sm font-bold text-yellow-400 hover:bg-yellow-500/10"
          >
            Next month
          </Link>

          <Link
            href={`/mosque/${mosque.slug}/timetable`}
            className="rounded-xl border border-white/10 px-4 py-2 text-sm font-bold text-white/70 hover:bg-white/10"
          >
            Current month
          </Link>

          <PrintButton />

          {isManager ? (
            <Link
              href={`/business-dashboard/mosques/${mosque.id}/timetable-sources`}
              className="rounded-xl bg-yellow-500 px-4 py-2 text-sm font-bold text-black hover:bg-yellow-400"
            >
              Manage timetable
            </Link>
          ) : null}
        </div>
      </div>

      <div className="mb-8 print:hidden">
        <MosqueTrustBadges
          mosqueId={mosque.id}
          mosqueSlug={mosque.slug}
          timezone={mosque.timezone}
          verifiedStatus={mosque.verified_status}
          showManagerLink={isManager}
        />
      </div>

      <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-5 print:rounded-none print:border-0 print:bg-white print:p-0">
        {prayerRows.length === 0 ? (
          <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-6 text-yellow-100 print:border print:border-black print:bg-white print:text-black">
            <div className="text-lg font-bold text-yellow-300 print:text-black">
              No monthly timetable published
            </div>

            <p className="mt-2">
              No monthly timetable has been published for this mosque for{" "}
              {monthName(month, year)}.
            </p>

            <div className="mt-5 flex flex-wrap gap-3 print:hidden">
              <Link
                href={`/mosque/${mosque.slug}`}
                className="rounded-xl border border-yellow-500/30 px-4 py-2 text-sm font-bold text-yellow-300 hover:bg-yellow-500/10"
              >
                Back to mosque page
              </Link>

              {isManager ? (
                <Link
                  href={`/business-dashboard/mosques/${mosque.id}/timetable-sources`}
                  className="rounded-xl bg-yellow-500 px-4 py-2 text-sm font-bold text-black hover:bg-yellow-400"
                >
                  Import timetable
                </Link>
              ) : null}
            </div>
          </div>
        ) : (
          <>
            <div className="mb-4 grid gap-3 md:grid-cols-3 print:hidden">
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">
                <div className="font-bold text-emerald-300">
                  Published rows
                </div>

                <div className="mt-1 text-2xl font-black">
                  {prayerRows.length}
                </div>

                <div className="mt-1 text-xs text-emerald-100/70">
                  For {monthName(month, year)}
                </div>
              </div>

              <div
                className={`rounded-2xl border p-4 text-sm ${
                  missingIqamahCount > 0
                    ? "border-yellow-500/20 bg-yellow-500/10 text-yellow-100"
                    : "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
                }`}
              >
                <div className="font-bold">
                  {missingIqamahCount > 0
                    ? "Iqamah times need review"
                    : "Iqamah times complete"}
                </div>

                <div className="mt-1 text-2xl font-black">
                  {missingIqamahCount}
                </div>

                <div className="mt-1 text-xs opacity-80">
                  rows missing at least one iqamah time
                </div>
              </div>

              <div
                className={`rounded-2xl border p-4 text-sm ${
                  hasTodayInThisMonth
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
                    : "border-yellow-500/20 bg-yellow-500/10 text-yellow-100"
                }`}
              >
                <div className="font-bold">
                  {hasTodayInThisMonth ? "Today is included" : "Today missing"}
                </div>

                <div className="mt-1 text-2xl font-black">
                  {hasTodayInThisMonth ? "Yes" : "No"}
                </div>

                <div className="mt-1 text-xs opacity-80">{today}</div>
              </div>
            </div>

            {missingIqamahCount > 0 ? (
              <div className="mb-4 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm text-yellow-100 print:border print:border-black print:bg-white print:text-black">
                Some rows only contain beginning times. Mosque-specific iqamah
                times should be checked manually before relying on them for
                jamaʿah.
              </div>
            ) : null}

            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full min-w-[1150px] border-separate border-spacing-y-2 text-left text-sm print:min-w-0 print:border-collapse print:border print:border-black print:text-[10px]">
                <thead className="text-xs uppercase tracking-wide text-yellow-400 print:text-black">
                  <tr>
                    <th className="px-3 py-2 print:border print:border-black print:px-1 print:py-1">
                      Date
                    </th>
                    <th className="px-3 py-2 print:border print:border-black print:px-1 print:py-1">
                      Fajr
                    </th>
                    <th className="px-3 py-2 print:border print:border-black print:px-1 print:py-1">
                      Fajr Iq.
                    </th>
                    <th className="px-3 py-2 print:border print:border-black print:px-1 print:py-1">
                      Sunrise
                    </th>
                    <th className="px-3 py-2 print:border print:border-black print:px-1 print:py-1">
                      Dhuhr
                    </th>
                    <th className="px-3 py-2 print:border print:border-black print:px-1 print:py-1">
                      Dhuhr Iq.
                    </th>
                    <th className="px-3 py-2 print:border print:border-black print:px-1 print:py-1">
                      Asr
                    </th>
                    <th className="px-3 py-2 print:border print:border-black print:px-1 print:py-1">
                      Asr Iq.
                    </th>
                    <th className="px-3 py-2 print:border print:border-black print:px-1 print:py-1">
                      Maghrib
                    </th>
                    <th className="px-3 py-2 print:border print:border-black print:px-1 print:py-1">
                      Maghrib Iq.
                    </th>
                    <th className="px-3 py-2 print:border print:border-black print:px-1 print:py-1">
                      Isha
                    </th>
                    <th className="px-3 py-2 print:border print:border-black print:px-1 print:py-1">
                      Isha Iq.
                    </th>
                    <th className="px-3 py-2 print:border print:border-black print:px-1 print:py-1 print:hidden">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {prayerRows.map((row) => {
                    const isToday = row.prayer_date === today;
                    const missingIqamah = hasMissingIqamah(row);

                    return (
                      <tr
                        key={row.id}
                        className={
                          isToday
                            ? "bg-yellow-500/15 text-white print:bg-white print:text-black"
                            : "bg-black/40 text-white/80 print:bg-white print:text-black"
                        }
                      >
                        <td className="rounded-l-xl px-3 py-3 font-semibold text-white print:rounded-none print:border print:border-black print:px-1 print:py-1 print:text-black">
                          <div className="flex flex-col gap-1 print:block">
                            <span className="hidden print:inline">
                              {formatPrintDate(row.prayer_date)}
                            </span>

                            <span className="print:hidden">
                              {formatDate(row.prayer_date)}
                            </span>

                            {isToday ? (
                              <span className="w-fit rounded-full border border-yellow-500/30 bg-yellow-500 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-black print:hidden">
                                Today
                              </span>
                            ) : null}
                          </div>
                        </td>

                        <td className="px-3 py-3 print:border print:border-black print:px-1 print:py-1">
                          {formatTime(row.fajr_begins)}
                        </td>

                        <td className="px-3 py-3 print:border print:border-black print:px-1 print:py-1">
                          {formatTime(row.fajr_iqamah)}
                        </td>

                        <td className="px-3 py-3 print:border print:border-black print:px-1 print:py-1">
                          {formatTime(row.sunrise)}
                        </td>

                        <td className="px-3 py-3 print:border print:border-black print:px-1 print:py-1">
                          {formatTime(row.dhuhr_begins)}
                        </td>

                        <td className="px-3 py-3 print:border print:border-black print:px-1 print:py-1">
                          {formatTime(row.dhuhr_iqamah)}
                        </td>

                        <td className="px-3 py-3 print:border print:border-black print:px-1 print:py-1">
                          {formatTime(row.asr_begins)}
                        </td>

                        <td className="px-3 py-3 print:border print:border-black print:px-1 print:py-1">
                          {formatTime(row.asr_iqamah)}
                        </td>

                        <td className="px-3 py-3 print:border print:border-black print:px-1 print:py-1">
                          {formatTime(row.maghrib_begins)}
                        </td>

                        <td className="px-3 py-3 print:border print:border-black print:px-1 print:py-1">
                          {formatTime(row.maghrib_iqamah)}
                        </td>

                        <td className="px-3 py-3 print:border print:border-black print:px-1 print:py-1">
                          {formatTime(row.isha_begins)}
                        </td>

                        <td className="px-3 py-3 print:border print:border-black print:px-1 print:py-1">
                          {formatTime(row.isha_iqamah)}
                        </td>

                        <td className="rounded-r-xl px-3 py-3 print:hidden">
                          <div className="flex flex-col gap-2">
                            <span
                              className={`w-fit rounded-full border px-3 py-1 text-xs font-bold ${getSourceClassName(
                                row
                              )}`}
                            >
                              {getSourceLabel(row)}
                            </span>

                            {missingIqamah ? (
                              <span className="w-fit rounded-full border border-yellow-500/20 bg-yellow-500/10 px-3 py-1 text-xs font-bold text-yellow-300">
                                Iqamah missing
                              </span>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 hidden text-center text-[10px] text-black print:block">
              Timetable shown for {monthName(month, year)} • Generated by
              SalahNearMe
            </div>
          </>
        )}
      </section>

      <div className="mt-8 print:hidden">
        <MosqueCorrectionReportForm
          mosqueId={mosque.id}
          mosqueName={mosque.name}
          mosqueSlug={mosque.slug}
          source="mosque_timetable_page"
        />
      </div>
    </main>
  );
}