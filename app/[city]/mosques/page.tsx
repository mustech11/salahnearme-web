import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabasePublic } from "@/lib/supabaseServer";
import FeaturedBusinesses from "@/components/FeaturedBusinesses";
import MosqueFilters from "@/components/MosqueFilters";
import { buildMosqueLiveTrust, type LiveReportRow } from "@/lib/mosqueTrust";
import { sortMosquesByTrustAndActivity } from "@/lib/mosqueSmartRanking";

export const revalidate = 300;

type PageProps = {
  params: Promise<{
    city: string;
  }>;
  searchParams: Promise<{
    parking?: string;
    womens_space?: string;
    wheelchair_access?: string;
    jumuah?: string;
    live_now?: string;
  }>;
};

type CityRow = {
  id: number;
  name: string;
  slug: string;
  country: string | null;
};

type MosqueRow = {
  id: string;
  name: string | null;
  slug: string | null;
  postcode: string | null;
  area: string | null;
  address: string | null;
  verified_status: string | null;
  latitude: number | null;
  longitude: number | null;
  parking: boolean | null;
  womens_space: boolean | null;
  wheelchair_access: boolean | null;
  jumuah_salah_1: string | null;
  jumuah_salah_2: string | null;
  jumuah_salah_3: string | null;
};

function badge(label: string) {
  return (
    <div className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-400">
      {label}
    </div>
  );
}

export async function generateStaticParams() {
  const supabase = supabasePublic();

  const { data } = await supabase
    .from("cities")
    .select("slug")
    .eq("is_active", true);

  return (data ?? []).map((c) => ({
    city: c.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string }>;
}): Promise<Metadata> {
  const { city } = await params;
  const supabase = supabasePublic();

  const { data: cityRow } = await supabase
    .from("cities")
    .select("name,slug")
    .eq("slug", city)
    .eq("is_active", true)
    .maybeSingle();

  if (!cityRow) {
    return {
      title: "Mosques Not Found",
    };
  }

  return {
    title: `Mosques in ${cityRow.name} | SalahNearMe`,
    description: `Browse mosques in ${cityRow.name}, with smart filters for parking, women’s space, wheelchair access, Jumu’ah sessions, and live mosque activity.`,
    alternates: {
      canonical: `/${cityRow.slug}/mosques`,
    },
    openGraph: {
      title: `Mosques in ${cityRow.name} | SalahNearMe`,
      description: `Browse mosques in ${cityRow.name}, with smart filters for parking, women’s space, wheelchair access, Jumu’ah sessions, and live mosque activity.`,
      url: `/${cityRow.slug}/mosques`,
    },
  };
}

export default async function CityMosquesPage({
  params,
  searchParams,
}: PageProps) {
  const { city } = await params;
  const filters = await searchParams;
  const supabase = supabasePublic();

  const { data: cityRaw, error: cityError } = await supabase
    .from("cities")
    .select("id,name,slug,country")
    .eq("slug", city)
    .eq("is_active", true)
    .maybeSingle();

  if (cityError) {
    return <pre className="text-white/80">{cityError.message}</pre>;
  }

  const cityRow = cityRaw as CityRow | null;

  if (!cityRow) {
    notFound();
  }

  let mosqueQuery = supabase
    .from("mosques")
    .select(
      `
      id,
      name,
      slug,
      postcode,
      area,
      address,
      verified_status,
      latitude,
      longitude,
      parking,
      womens_space,
      wheelchair_access,
      jumuah_salah_1,
      jumuah_salah_2,
      jumuah_salah_3
    `
    )
    .eq("city_id", cityRow.id)
    .eq("is_active", true);

  if (filters.parking === "1") {
    mosqueQuery = mosqueQuery.eq("parking", true);
  }

  if (filters.womens_space === "1") {
    mosqueQuery = mosqueQuery.eq("womens_space", true);
  }

  if (filters.wheelchair_access === "1") {
    mosqueQuery = mosqueQuery.eq("wheelchair_access", true);
  }

  if (filters.jumuah === "1") {
    mosqueQuery = mosqueQuery.not("jumuah_salah_1", "is", null);
  }

  if (filters.jumuah === "2") {
    mosqueQuery = mosqueQuery.not("jumuah_salah_2", "is", null);
  }

  if (filters.jumuah === "3") {
    mosqueQuery = mosqueQuery.not("jumuah_salah_3", "is", null);
  }

  const { data: mosquesRaw, error: mosquesError } = await mosqueQuery.order("name", {
    ascending: true,
  });

  if (mosquesError) {
    return <pre className="text-white/80">{mosquesError.message}</pre>;
  }

  let mosques = (mosquesRaw ?? []) as MosqueRow[];
  let liveMap = new Map<string, ReturnType<typeof buildMosqueLiveTrust>>();

  if (mosques.length > 0) {
    const { data: liveReportsRaw } = await supabase
      .from("mosque_live_reports")
      .select("mosque_id,report_type,created_at,user_fingerprint")
      .in(
        "mosque_id",
        mosques.map((m) => m.id)
      )
      .order("created_at", { ascending: false });

    const liveReports = (liveReportsRaw ?? []) as LiveReportRow[];
    const grouped = new Map<string, LiveReportRow[]>();

    for (const report of liveReports) {
      const existing = grouped.get(report.mosque_id) ?? [];
      existing.push(report);
      grouped.set(report.mosque_id, existing);
    }

    for (const mosque of mosques) {
      liveMap.set(mosque.id, buildMosqueLiveTrust(grouped.get(mosque.id) ?? []));
    }

    mosques = sortMosquesByTrustAndActivity(
      mosques,
      liveMap
    ) as unknown as MosqueRow[];

    if (filters.live_now === "1") {
      mosques = mosques.filter((m) => liveMap.get(m.id)?.hasLive);
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
        <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
          City Mosques
        </div>

        <h1 className="mt-3 text-4xl font-bold text-white">
          Mosques in {cityRow.name}
        </h1>

        <p className="mt-3 max-w-3xl text-white/70">
          Browse mosques in {cityRow.name} with smarter filters for facilities,
          Jumu’ah sessions, and live mosque activity.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={`/${cityRow.slug}`}
            className="rounded-xl bg-yellow-500 px-4 py-3 text-sm font-semibold text-black hover:bg-yellow-400"
          >
            Back to {cityRow.name}
          </Link>

          <Link
            href={`/${cityRow.slug}/businesses`}
            className="rounded-xl border border-yellow-500/30 bg-black px-4 py-3 text-sm font-semibold text-yellow-400 hover:bg-yellow-500/10"
          >
            Browse businesses
          </Link>

          <Link
            href="/travel/near-me"
            className="rounded-xl border border-white/10 bg-black px-4 py-3 text-sm font-semibold text-white hover:border-yellow-500/30"
          >
            Use near me
          </Link>
        </div>
      </section>

      <MosqueFilters />

      <section className="grid gap-4">
        {mosques.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-[rgb(var(--card))] p-8 text-white/60">
            No mosques match the selected filters yet.
          </div>
        ) : (
          mosques.map((mosque) => {
            const live = liveMap.get(mosque.id);

            return (
              <div
                key={mosque.id}
                className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6"
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <Link
                      href={`/mosque/${mosque.slug}`}
                      className="text-2xl font-semibold text-white hover:text-yellow-400"
                    >
                      {mosque.name}
                    </Link>

                    <div className="mt-2 text-white/70">
                      {[mosque.area, mosque.postcode].filter(Boolean).join(" • ")}
                    </div>

                    {mosque.address && (
                      <div className="mt-2 text-sm text-white/60">
                        {mosque.address}
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2">
                      {mosque.womens_space ? badge("Women’s Space") : null}
                      {mosque.parking ? badge("Parking") : null}
                      {mosque.wheelchair_access ? badge("Wheelchair Access") : null}
                      {mosque.jumuah_salah_1 ? badge("1st Jumu’ah") : null}
                      {mosque.jumuah_salah_2 ? badge("2nd Jumu’ah") : null}
                      {mosque.jumuah_salah_3 ? badge("3rd Jumu’ah") : null}
                    </div>
                  </div>

                  <div className="flex flex-col items-start gap-3 lg:items-end">
                    {live?.hasLive ? (
                      <div className="rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-semibold text-green-300">
                        Live now
                      </div>
                    ) : null}

                    {mosque.verified_status ? (
                      <div className="rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-semibold text-green-300">
                        {mosque.verified_status.replace(/_/g, " ")}
                      </div>
                    ) : null}

                    {live?.confidence ? (
                      <div className="text-xs text-white/50">
                        Confidence: {live.confidence}
                      </div>
                    ) : null}

                    <div className="flex flex-wrap gap-3">
                      <Link
                        href={`/mosque/${mosque.slug}`}
                        className="rounded-xl bg-yellow-500 px-4 py-3 text-sm font-semibold text-black hover:bg-yellow-400"
                      >
                        View mosque
                      </Link>

                      <Link
                        href={`/mosque/${mosque.slug}`}
                        className="rounded-xl border border-yellow-500/30 bg-black px-4 py-3 text-sm font-semibold text-yellow-400 hover:bg-yellow-500/10"
                      >
                        Details & directions
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </section>

      <FeaturedBusinesses city={cityRow.name} />
    </div>
  );
}