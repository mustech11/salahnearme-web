import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import FeaturedBusinesses from "@/components/FeaturedBusinesses";
import MosqueFilters from "@/components/MosqueFilters";
import { buildMosqueLiveTrust, type LiveReportRow } from "@/lib/mosqueTrust";
import { sortMosquesByTrustAndActivity } from "@/lib/mosqueSmartRanking";
import { supabasePublic } from "@/lib/supabaseServer";

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

function safeText(value: string | null | undefined, fallback = "") {
  const trimmed = String(value ?? "").trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function badge(label: string) {
  return (
    <div className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-400">
      {label}
    </div>
  );
}

function EmptyMosqueCityState({ city }: { city: CityRow }) {
  return (
    <section className="overflow-hidden rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))]">
      <div className="grid gap-8 p-8 lg:grid-cols-[1.2fr_0.8fr] lg:p-10">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.35em] text-yellow-400">
            Help build {city.name}
          </div>

          <h2 className="mt-4 max-w-4xl text-4xl font-black tracking-tight text-white md:text-5xl">
            No mosques listed in {city.name} yet.
          </h2>

          <p className="mt-5 max-w-3xl text-lg leading-8 text-white/70">
            SalahNearMe is expanding city by city. If you know a mosque, prayer
            room, Islamic centre, Jumu’ah location, or community prayer space in{" "}
            {city.name}, you can help Muslims find places to pray by submitting
            it for review.
          </p>

          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <Link
              href={`/claim/mosque/submit?city=${encodeURIComponent(city.slug)}`}
              className="rounded-2xl bg-yellow-500 px-5 py-4 text-center text-sm font-black text-black transition hover:bg-yellow-400"
            >
              Suggest a mosque
            </Link>

            <Link
              href={`/claim/mosque?city=${encodeURIComponent(city.slug)}`}
              className="rounded-2xl border border-yellow-500/30 bg-black/40 px-5 py-4 text-center text-sm font-black text-yellow-400 transition hover:bg-yellow-500/10"
            >
              Claim a mosque
            </Link>

            <Link
              href={`/${city.slug}/businesses`}
              className="rounded-2xl border border-white/10 bg-black/40 px-5 py-4 text-center text-sm font-black text-white transition hover:border-yellow-500/40 hover:text-yellow-300"
            >
              View halal businesses
            </Link>

            <Link
              href="/near-me/pray"
              className="rounded-2xl border border-white/10 bg-black/40 px-5 py-4 text-center text-sm font-black text-white transition hover:border-yellow-500/40 hover:text-yellow-300"
            >
              Use Pray Near Me
            </Link>
          </div>

          <div className="mt-7 rounded-2xl border border-white/10 bg-black/30 p-5">
            <p className="text-sm font-semibold text-white">
              What details help us verify a mosque?
            </p>

            <div className="mt-4 grid gap-3 text-sm text-white/65 sm:grid-cols-2">
              <div>• Mosque or centre name</div>
              <div>• Full address and postcode</div>
              <div>• Website or Google Maps link</div>
              <div>• Jumu’ah and daily prayer details</div>
              <div>• Facilities such as parking or women’s space</div>
              <div>• Contact number or public email</div>
            </div>
          </div>
        </div>

        <aside className="rounded-3xl border border-white/10 bg-black/35 p-6">
          <h3 className="text-xl font-black text-white">Why add mosques?</h3>

          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="font-bold text-yellow-400">
                Help Muslims pray on time
              </div>
              <p className="mt-2 text-sm leading-6 text-white/65">
                City pages become useful when local mosques, prayer spaces, and
                verified prayer information are added.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="font-bold text-yellow-400">
                Support travellers and new Muslims
              </div>
              <p className="mt-2 text-sm leading-6 text-white/65">
                People visiting {city.name} can quickly find nearby places to
                pray, Jumu’ah options, and trusted community locations.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="font-bold text-yellow-400">
                Keep mosques free
              </div>
              <p className="mt-2 text-sm leading-6 text-white/65">
                SalahNearMe is designed to keep mosque listings free while halal
                business listings and sponsorships support the platform.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

export async function generateStaticParams() {
  const supabase = supabasePublic();

  const { data } = await supabase
    .from("cities")
    .select("slug")
    .eq("is_active", true);

  return (data ?? [])
    .filter((city) => typeof city.slug === "string" && city.slug.length > 0)
    .map((city) => ({
      city: city.slug,
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
      title: "Mosques Not Found | SalahNearMe",
      description:
        "This SalahNearMe mosque city page could not be found or is not currently active.",
    };
  }

  const title = `Mosques in ${cityRow.name} | Prayer Spaces & Jumu’ah | SalahNearMe`;
  const description = `Find mosques, prayer rooms, Islamic centres, Jumu’ah locations, facilities, live mosque activity, and nearby halal places in ${cityRow.name}.`;

  return {
    title,
    description,
    alternates: {
      canonical: `/${cityRow.slug}/mosques`,
    },
    openGraph: {
      title,
      description,
      url: `/${cityRow.slug}/mosques`,
      siteName: "SalahNearMe",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
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
    return (
      <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-6 text-sm text-red-200">
        Unable to load city: {cityError.message}
      </div>
    );
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

  const { data: mosquesRaw, error: mosquesError } = await mosqueQuery.order(
    "name",
    {
      ascending: true,
    }
  );

  if (mosquesError) {
    return (
      <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-6 text-sm text-red-200">
        Unable to load mosques: {mosquesError.message}
      </div>
    );
  }

  let mosques = (mosquesRaw ?? []) as MosqueRow[];
  const totalMosquesBeforeLiveFilter = mosques.length;

  const liveMap = new Map<string, ReturnType<typeof buildMosqueLiveTrust>>();

  if (mosques.length > 0) {
    const mosqueIds = mosques.map((mosque) => mosque.id);

    const { data: liveReportsRaw } = await supabase
      .from("mosque_live_reports")
      .select("mosque_id,report_type,created_at,user_fingerprint")
      .in("mosque_id", mosqueIds)
      .order("created_at", { ascending: false });

    const liveReports = (liveReportsRaw ?? []) as LiveReportRow[];
    const grouped = new Map<string, LiveReportRow[]>();

    for (const report of liveReports) {
      const existing = grouped.get(report.mosque_id) ?? [];
      existing.push(report);
      grouped.set(report.mosque_id, existing);
    }

    for (const mosque of mosques) {
      liveMap.set(
        mosque.id,
        buildMosqueLiveTrust(grouped.get(mosque.id) ?? [])
      );
    }

    mosques = sortMosquesByTrustAndActivity(
      mosques,
      liveMap
    ) as unknown as MosqueRow[];

    if (filters.live_now === "1") {
      mosques = mosques.filter((mosque) => liveMap.get(mosque.id)?.hasLive);
    }
  }

  const hasAnyFilter =
    filters.parking === "1" ||
    filters.womens_space === "1" ||
    filters.wheelchair_access === "1" ||
    filters.jumuah === "1" ||
    filters.jumuah === "2" ||
    filters.jumuah === "3" ||
    filters.live_now === "1";

  const showEmptyCityGrowthState =
    totalMosquesBeforeLiveFilter === 0 && !hasAnyFilter;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `Mosques in ${cityRow.name}`,
    description: `Browse mosques, prayer rooms, Islamic centres, Jumu’ah locations, and prayer facilities in ${cityRow.name}.`,
    url: `https://www.salahnearme.com/${cityRow.slug}/mosques`,
    isPartOf: {
      "@type": "WebSite",
      name: "SalahNearMe",
      url: "https://www.salahnearme.com",
    },
  };

  return (
    <div className="space-y-8">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd),
        }}
      />

      <section className="overflow-hidden rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))]">
        <div className="p-8 lg:p-10">
          <div className="text-sm font-semibold uppercase tracking-[0.35em] text-yellow-400">
            City Mosques
          </div>

          <h1 className="mt-4 text-5xl font-black tracking-tight text-white md:text-6xl">
            Mosques in {cityRow.name}
          </h1>

          <p className="mt-5 max-w-4xl text-lg leading-8 text-white/70">
            Browse mosques, prayer spaces, Islamic centres, Jumu’ah locations,
            facilities, live community reports, and nearby halal places in{" "}
            {cityRow.name}.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {badge(`${cityRow.name} City`)}
            {cityRow.country ? badge(cityRow.country) : null}
            {totalMosquesBeforeLiveFilter > 0
              ? badge(`${totalMosquesBeforeLiveFilter} mosque${totalMosquesBeforeLiveFilter === 1 ? "" : "s"}`)
              : badge("Community listings needed")}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={`/${cityRow.slug}`}
              className="rounded-2xl bg-yellow-500 px-5 py-4 text-sm font-black text-black transition hover:bg-yellow-400"
            >
              Back to {cityRow.name}
            </Link>

            <Link
              href={`/${cityRow.slug}/businesses`}
              className="rounded-2xl border border-yellow-500/30 bg-black/40 px-5 py-4 text-sm font-black text-yellow-400 transition hover:bg-yellow-500/10"
            >
              Browse halal businesses
            </Link>

            <Link
              href="/near-me/pray"
              className="rounded-2xl border border-white/10 bg-black/40 px-5 py-4 text-sm font-black text-white transition hover:border-yellow-500/40 hover:text-yellow-300"
            >
              Use Pray Near Me
            </Link>
          </div>
        </div>
      </section>

      {!showEmptyCityGrowthState ? <MosqueFilters /> : null}

      {showEmptyCityGrowthState ? (
        <EmptyMosqueCityState city={cityRow} />
      ) : (
        <section className="grid gap-4">
          {mosques.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-[rgb(var(--card))] p-8">
              <div className="text-sm font-semibold uppercase tracking-[0.3em] text-yellow-400">
                No matching results
              </div>

              <h2 className="mt-3 text-3xl font-black text-white">
                No mosques match these filters yet.
              </h2>

              <p className="mt-3 max-w-3xl text-white/65">
                Try clearing the filters, or help improve SalahNearMe by
                suggesting a mosque in {cityRow.name}.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href={`/${cityRow.slug}/mosques`}
                  className="rounded-xl bg-yellow-500 px-4 py-3 text-sm font-semibold text-black hover:bg-yellow-400"
                >
                  Clear filters
                </Link>

                <Link
                  href={`/claim/mosque/submit?city=${encodeURIComponent(
                    cityRow.slug
                  )}`}
                  className="rounded-xl border border-yellow-500/30 bg-black px-4 py-3 text-sm font-semibold text-yellow-400 hover:bg-yellow-500/10"
                >
                  Suggest a mosque
                </Link>
              </div>
            </div>
          ) : (
            mosques.map((mosque) => {
              const live = liveMap.get(mosque.id);
              const mosqueName = safeText(mosque.name, "Unnamed mosque");
              const mosqueSlug = safeText(mosque.slug);
              const location = [mosque.area, mosque.postcode]
                .filter(Boolean)
                .join(" • ");

              return (
                <article
                  key={mosque.id}
                  className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6 transition hover:border-yellow-500/40"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      {mosqueSlug ? (
                        <Link
                          href={`/mosque/${mosqueSlug}`}
                          className="text-2xl font-black text-white transition hover:text-yellow-400"
                        >
                          {mosqueName}
                        </Link>
                      ) : (
                        <h2 className="text-2xl font-black text-white">
                          {mosqueName}
                        </h2>
                      )}

                      {location ? (
                        <div className="mt-2 text-white/70">{location}</div>
                      ) : null}

                      {mosque.address ? (
                        <div className="mt-2 text-sm leading-6 text-white/60">
                          {mosque.address}
                        </div>
                      ) : null}

                      <div className="mt-4 flex flex-wrap gap-2">
                        {mosque.womens_space ? badge("Women’s Space") : null}
                        {mosque.parking ? badge("Parking") : null}
                        {mosque.wheelchair_access
                          ? badge("Wheelchair Access")
                          : null}
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
                        <div className="rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-semibold capitalize text-green-300">
                          {mosque.verified_status.replace(/_/g, " ")}
                        </div>
                      ) : null}

                      {live?.confidence ? (
                        <div className="text-xs text-white/50">
                          Confidence: {live.confidence}
                        </div>
                      ) : null}

                      <div className="flex flex-wrap gap-3">
                        {mosqueSlug ? (
                          <>
                            <Link
                              href={`/mosque/${mosqueSlug}`}
                              className="rounded-xl bg-yellow-500 px-4 py-3 text-sm font-semibold text-black transition hover:bg-yellow-400"
                            >
                              View mosque
                            </Link>

                            <Link
                              href={`/mosque/${mosqueSlug}/timetable`}
                              className="rounded-xl border border-yellow-500/30 bg-black px-4 py-3 text-sm font-semibold text-yellow-400 transition hover:bg-yellow-500/10"
                            >
                              Timetable
                            </Link>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </section>
      )}

      <FeaturedBusinesses city={cityRow.name} />
    </div>
  );
}