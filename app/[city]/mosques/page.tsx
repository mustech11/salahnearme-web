import type { Metadata } from "next";
import type { ReactNode } from "react";

import Link from "next/link";
import { notFound } from "next/navigation";

import FeaturedBusinesses from "@/components/FeaturedBusinesses";
import MosqueFilters from "@/components/MosqueFilters";
import {
  buildMosqueLiveTrust,
  type LiveReportRow,
} from "@/lib/mosqueTrust";
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

type SummaryCardProps = {
  label: string;
  value: number | string;
  description: string;
};

function safeText(
  value: string | null | undefined,
  fallback = ""
): string {
  const trimmed = String(
    value ?? ""
  ).trim();

  return trimmed || fallback;
}

function formatVerifiedStatus(
  value: string | null | undefined
): string | null {
  const cleaned = safeText(value);

  if (!cleaned) {
    return null;
  }

  return cleaned
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase()
    );
}

function hasJumuah(
  mosque: MosqueRow
): boolean {
  return Boolean(
    mosque.jumuah_salah_1 ||
      mosque.jumuah_salah_2 ||
      mosque.jumuah_salah_3
  );
}

function getFacilityCount(
  mosque: MosqueRow
): number {
  return [
    mosque.parking,
    mosque.womens_space,
    mosque.wheelchair_access,
    hasJumuah(mosque),
  ].filter(Boolean).length;
}

function getMosqueLocation(
  mosque: MosqueRow
): string {
  return [
    safeText(mosque.area),
    safeText(mosque.postcode),
  ]
    .filter(Boolean)
    .join(" • ");
}

function Badge({
  children,
  tone = "gold",
}: {
  children: ReactNode;
  tone?: "gold" | "green" | "blue";
}) {
  const styles = {
    gold:
      "border-yellow-500/30 bg-yellow-500/10 text-yellow-300",
    green:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    blue:
      "border-sky-500/30 bg-sky-500/10 text-sky-300",
  };

  return (
    <span
      className={[
        "inline-flex rounded-full border px-3 py-1 text-xs font-semibold",
        styles[tone],
      ].join(" ")}
    >
      {children}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  description,
}: SummaryCardProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4 backdrop-blur-xl">
      <div className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-yellow-400">
        {label}
      </div>

      <div className="mt-2 text-2xl font-black text-white">
        {value}
      </div>

      <p className="mt-1 text-xs leading-5 text-white/45">
        {description}
      </p>
    </div>
  );
}

function EmptyMosqueCityState({
  city,
}: {
  city: CityRow;
}) {
  return (
    <section className="premium-panel relative overflow-hidden rounded-[2rem] p-6 sm:p-8 lg:p-10">
      <div
        aria-hidden="true"
        className="absolute -right-24 -top-24 h-72 w-72 rounded-full border border-yellow-400/10 bg-yellow-400/[0.025]"
      />

      <div className="relative grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <div className="section-kicker">
            Help build {city.name}
          </div>

          <h2 className="mt-4 max-w-4xl text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">
            No mosques are listed in{" "}
            {city.name} yet.
          </h2>

          <p className="mt-5 max-w-3xl text-base leading-8 text-white/65">
            SalahNearMe is expanding city by
            city. Submit a mosque, prayer room,
            Islamic centre or Jumu&apos;ah
            location to help Muslims find a
            reliable place to pray.
          </p>

          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <Link
              href={`/claim/mosque/submit?city=${encodeURIComponent(
                city.slug
              )}`}
              className="premium-button px-5 py-4 text-sm"
            >
              Suggest a mosque
            </Link>

            <Link
              href={`/claim/mosque?city=${encodeURIComponent(
                city.slug
              )}`}
              className="premium-button-outline px-5 py-4 text-sm"
            >
              Claim a mosque
            </Link>

            <Link
              href={`/${city.slug}/businesses`}
              className="rounded-2xl border border-white/10 bg-black/35 px-5 py-4 text-center text-sm font-black text-white transition hover:border-yellow-500/40 hover:text-yellow-300"
            >
              View halal businesses
            </Link>

            <Link
              href="/near-me/pray"
              className="rounded-2xl border border-white/10 bg-black/35 px-5 py-4 text-center text-sm font-black text-white transition hover:border-yellow-500/40 hover:text-yellow-300"
            >
              Use Pray Near Me
            </Link>
          </div>

          <div className="mt-7 rounded-2xl border border-white/10 bg-black/25 p-5">
            <p className="text-sm font-bold text-white">
              Information that helps us verify
              a mosque
            </p>

            <div className="mt-4 grid gap-3 text-sm text-white/60 sm:grid-cols-2">
              <div>• Mosque or centre name</div>
              <div>• Full address and postcode</div>
              <div>• Website or maps link</div>
              <div>• Daily prayer information</div>
              <div>• Jumu&apos;ah times</div>
              <div>• Facilities and accessibility</div>
            </div>
          </div>
        </div>

        <aside className="premium-inset rounded-3xl p-6">
          <h3 className="text-xl font-black text-white">
            Why local mosque data matters
          </h3>

          <div className="mt-5 space-y-4">
            <EmptyBenefit
              title="Pray on time"
              text="Accurate local listings make prayer and Jumu’ah planning easier."
            />

            <EmptyBenefit
              title="Support travellers"
              text={`Visitors to ${city.name} can quickly find trusted places to pray.`}
            />

            <EmptyBenefit
              title="Strengthen the community"
              text="Better data connects worshippers, mosques and local Muslim services."
            />
          </div>
        </aside>
      </div>
    </section>
  );
}

function EmptyBenefit({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="font-bold text-yellow-300">
        {title}
      </div>

      <p className="mt-2 text-sm leading-6 text-white/60">
        {text}
      </p>
    </div>
  );
}

export async function generateStaticParams() {
  const supabase = supabasePublic();

  const { data } = await supabase
    .from("cities")
    .select("slug")
    .eq("is_active", true);

  return (data ?? [])
    .filter(
      (city) =>
        typeof city.slug === "string" &&
        city.slug.length > 0
    )
    .map((city) => ({
      city: city.slug,
    }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{
    city: string;
  }>;
}): Promise<Metadata> {
  const { city } = await params;
  const supabase = supabasePublic();

  const { data: cityRow } =
    await supabase
      .from("cities")
      .select("name,slug")
      .eq("slug", city)
      .eq("is_active", true)
      .maybeSingle();

  if (!cityRow) {
    return {
      title:
        "Mosques Not Found | SalahNearMe",
      description:
        "This mosque city page could not be found or is not currently active.",
    };
  }

  const title =
    `Mosques in ${cityRow.name} | Prayer Spaces & Jumu’ah`;

  const description =
    `Find mosques, prayer rooms, Islamic centres, Jumu’ah locations, facilities and live mosque activity in ${cityRow.name}.`;

  return {
    title,
    description,
    alternates: {
      canonical:
        `/${cityRow.slug}/mosques`,
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

  const { data: cityRaw, error: cityError } =
    await supabase
      .from("cities")
      .select("id,name,slug,country")
      .eq("slug", city)
      .eq("is_active", true)
      .maybeSingle();

  if (cityError) {
    return (
      <div
        role="alert"
        className="rounded-3xl border border-red-500/25 bg-red-500/10 p-6 text-sm text-red-200"
      >
        Unable to load this city:{" "}
        {cityError.message}
      </div>
    );
  }

  const cityRow =
    cityRaw as CityRow | null;

  if (!cityRow) {
    notFound();
  }

  let mosqueQuery = supabase
    .from("mosques")
    .select(
      [
        "id",
        "name",
        "slug",
        "postcode",
        "area",
        "address",
        "verified_status",
        "latitude",
        "longitude",
        "parking",
        "womens_space",
        "wheelchair_access",
        "jumuah_salah_1",
        "jumuah_salah_2",
        "jumuah_salah_3",
      ].join(",")
    )
    .eq("city_id", cityRow.id)
    .eq("is_active", true);

  if (filters.parking === "1") {
    mosqueQuery =
      mosqueQuery.eq("parking", true);
  }

  if (filters.womens_space === "1") {
    mosqueQuery =
      mosqueQuery.eq(
        "womens_space",
        true
      );
  }

  if (
    filters.wheelchair_access === "1"
  ) {
    mosqueQuery =
      mosqueQuery.eq(
        "wheelchair_access",
        true
      );
  }

  if (filters.jumuah === "1") {
    mosqueQuery =
      mosqueQuery.not(
        "jumuah_salah_1",
        "is",
        null
      );
  }

  if (filters.jumuah === "2") {
    mosqueQuery =
      mosqueQuery.not(
        "jumuah_salah_2",
        "is",
        null
      );
  }

  if (filters.jumuah === "3") {
    mosqueQuery =
      mosqueQuery.not(
        "jumuah_salah_3",
        "is",
        null
      );
  }

  const {
    data: mosquesRaw,
    error: mosquesError,
  } = await mosqueQuery.order("name", {
    ascending: true,
  });

  if (mosquesError) {
    return (
      <div
        role="alert"
        className="rounded-3xl border border-red-500/25 bg-red-500/10 p-6 text-sm text-red-200"
      >
        Unable to load mosques:{" "}
        {mosquesError.message}
      </div>
    );
  }

  let mosques =
    (mosquesRaw ?? []) as unknown as MosqueRow[];

  const totalBeforeLiveFilter =
    mosques.length;

  const liveMap = new Map<
    string,
    ReturnType<
      typeof buildMosqueLiveTrust
    >
  >();

  if (mosques.length > 0) {
    const mosqueIds = mosques.map(
      (mosque) => mosque.id
    );

    const { data: liveReportsRaw } =
      await supabase
        .from("mosque_live_reports")
        .select(
          [
            "mosque_id",
            "report_type",
            "created_at",
            "user_fingerprint",
          ].join(",")
        )
        .in("mosque_id", mosqueIds)
        .order("created_at", {
          ascending: false,
        });

    const liveReports =
      (liveReportsRaw ?? []) as unknown as LiveReportRow[];

    const grouped = new Map<
      string,
      LiveReportRow[]
    >();

    for (const report of liveReports) {
      const existing =
        grouped.get(report.mosque_id) ??
        [];

      existing.push(report);

      grouped.set(
        report.mosque_id,
        existing
      );
    }

    for (const mosque of mosques) {
      liveMap.set(
        mosque.id,
        buildMosqueLiveTrust(
          grouped.get(mosque.id) ?? []
        )
      );
    }

    mosques =
      sortMosquesByTrustAndActivity(
        mosques,
        liveMap
      ) as unknown as MosqueRow[];

    if (filters.live_now === "1") {
      mosques = mosques.filter(
        (mosque) =>
          liveMap.get(mosque.id)
            ?.hasLive
      );
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
    totalBeforeLiveFilter === 0 &&
    !hasAnyFilter;

  const verifiedCount =
    mosques.filter(
      (mosque) =>
        Boolean(
          safeText(
            mosque.verified_status
          )
        )
    ).length;

  const liveCount =
    mosques.filter(
      (mosque) =>
        liveMap.get(mosque.id)?.hasLive
    ).length;

  const jumuahCount =
    mosques.filter(hasJumuah).length;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `Mosques in ${cityRow.name}`,
    description:
      `Browse mosques, prayer rooms, Islamic centres and Jumu’ah locations in ${cityRow.name}.`,
    url:
      `https://www.salahnearme.com/${cityRow.slug}/mosques`,
    isPartOf: {
      "@type": "WebSite",
      name: "SalahNearMe",
      url:
        "https://www.salahnearme.com",
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

      <section className="premium-panel relative overflow-hidden rounded-[2rem] p-6 sm:p-8 lg:p-10">
        <div
          aria-hidden="true"
          className="absolute -right-28 -top-28 h-80 w-80 rounded-full border border-yellow-400/10 bg-yellow-400/[0.025]"
        />

        <div className="relative">
          <div className="section-kicker">
            City mosques
          </div>

          <h1 className="dashboard-hero-glow mt-4 text-4xl font-black tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl">
            Mosques in {cityRow.name}
          </h1>

          <p className="mt-5 max-w-4xl text-base leading-8 text-white/65 sm:text-lg">
            Explore prayer spaces,
            Islamic centres, Jumu&apos;ah
            locations, facilities, timetable
            confidence and live community
            activity across {cityRow.name}.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            <Badge>
              {cityRow.name}
            </Badge>

            {cityRow.country ? (
              <Badge tone="blue">
                {cityRow.country}
              </Badge>
            ) : null}

            {totalBeforeLiveFilter > 0 ? (
              <Badge tone="green">
                {totalBeforeLiveFilter}{" "}
                mosque
                {totalBeforeLiveFilter === 1
                  ? ""
                  : "s"}
              </Badge>
            ) : (
              <Badge>
                Community listings needed
              </Badge>
            )}
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              label="Mosques"
              value={totalBeforeLiveFilter}
              description="Active listings in this city"
            />

            <SummaryCard
              label="Verified"
              value={verifiedCount}
              description="Listings with verification status"
            />

            <SummaryCard
              label="Jumu’ah"
              value={jumuahCount}
              description="Mosques with Friday prayer data"
            />

            <SummaryCard
              label="Live now"
              value={liveCount}
              description="Recent community activity"
            />
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={`/${cityRow.slug}`}
              className="premium-button px-5 py-3 text-sm"
            >
              Back to {cityRow.name}
            </Link>

            <Link
              href={`/${cityRow.slug}/businesses`}
              className="premium-button-outline px-5 py-3 text-sm"
            >
              Halal businesses
            </Link>

            <Link
              href="/near-me/pray"
              className="rounded-2xl border border-white/10 bg-black/30 px-5 py-3 text-sm font-black text-white transition hover:border-yellow-500/40 hover:text-yellow-300"
            >
              Pray Near Me
            </Link>
          </div>
        </div>
      </section>

      {!showEmptyCityGrowthState ? (
        <MosqueFilters />
      ) : null}

      {showEmptyCityGrowthState ? (
        <EmptyMosqueCityState
          city={cityRow}
        />
      ) : (
        <section className="grid gap-4">
          {mosques.length === 0 ? (
            <div className="premium-panel rounded-[2rem] p-7">
              <div className="section-kicker">
                No matching results
              </div>

              <h2 className="mt-3 text-3xl font-black text-white">
                No mosques match these
                filters yet.
              </h2>

              <p className="mt-3 max-w-3xl text-white/60">
                Clear the filters or help
                improve SalahNearMe by
                suggesting a mosque in{" "}
                {cityRow.name}.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href={`/${cityRow.slug}/mosques`}
                  className="premium-button px-4 py-3 text-sm"
                >
                  Clear filters
                </Link>

                <Link
                  href={`/claim/mosque/submit?city=${encodeURIComponent(
                    cityRow.slug
                  )}`}
                  className="premium-button-outline px-4 py-3 text-sm"
                >
                  Suggest a mosque
                </Link>
              </div>
            </div>
          ) : (
            mosques.map((mosque) => {
              const live =
                liveMap.get(mosque.id);

              const mosqueName =
                safeText(
                  mosque.name,
                  "Unnamed mosque"
                );

              const mosqueSlug =
                safeText(mosque.slug);

              const location =
                getMosqueLocation(mosque);

              const facilityCount =
                getFacilityCount(mosque);

              const verifiedStatus =
                formatVerifiedStatus(
                  mosque.verified_status
                );

              return (
                <article
                  key={mosque.id}
                  className="premium-panel group rounded-[2rem] p-5 transition duration-300 hover:-translate-y-0.5 hover:border-yellow-400/35 sm:p-6"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {live?.hasLive ? (
                          <Badge tone="green">
                            Live now
                          </Badge>
                        ) : null}

                        {verifiedStatus ? (
                          <Badge tone="green">
                            {verifiedStatus}
                          </Badge>
                        ) : null}

                        {facilityCount > 0 ? (
                          <Badge>
                            {facilityCount} key
                            feature
                            {facilityCount === 1
                              ? ""
                              : "s"}
                          </Badge>
                        ) : null}
                      </div>

                      {mosqueSlug ? (
                        <Link
                          href={`/mosque/${mosqueSlug}`}
                          className="mt-4 block text-2xl font-black text-white transition group-hover:text-yellow-300 sm:text-3xl"
                        >
                          {mosqueName}
                        </Link>
                      ) : (
                        <h2 className="mt-4 text-2xl font-black text-white sm:text-3xl">
                          {mosqueName}
                        </h2>
                      )}

                      {location ? (
                        <div className="mt-2 text-sm font-medium text-white/65">
                          {location}
                        </div>
                      ) : null}

                      {mosque.address ? (
                        <div className="mt-2 max-w-3xl text-sm leading-6 text-white/50">
                          {mosque.address}
                        </div>
                      ) : null}

                      <div className="mt-5 flex flex-wrap gap-2">
                        {mosque.womens_space ? (
                          <Badge>
                            Women&apos;s space
                          </Badge>
                        ) : null}

                        {mosque.parking ? (
                          <Badge>
                            Parking
                          </Badge>
                        ) : null}

                        {mosque.wheelchair_access ? (
                          <Badge>
                            Wheelchair access
                          </Badge>
                        ) : null}

                        {mosque.jumuah_salah_1 ? (
                          <Badge tone="blue">
                            1st Jumu&apos;ah
                          </Badge>
                        ) : null}

                        {mosque.jumuah_salah_2 ? (
                          <Badge tone="blue">
                            2nd Jumu&apos;ah
                          </Badge>
                        ) : null}

                        {mosque.jumuah_salah_3 ? (
                          <Badge tone="blue">
                            3rd Jumu&apos;ah
                          </Badge>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-start gap-3 lg:items-end">
                      {live?.confidence ? (
                        <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs text-white/50">
                          Live confidence:{" "}
                          <span className="capitalize text-white/80">
                            {live.confidence}
                          </span>
                        </div>
                      ) : null}

                      <div className="flex flex-wrap gap-3">
                        {mosqueSlug ? (
                          <>
                            <Link
                              href={`/mosque/${mosqueSlug}`}
                              className="premium-button px-4 py-3 text-sm"
                            >
                              View mosque
                            </Link>

                            <Link
                              href={`/mosque/${mosqueSlug}/timetable`}
                              className="premium-button-outline px-4 py-3 text-sm"
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

      <FeaturedBusinesses
        city={cityRow.name}
      />
    </div>
  );
}