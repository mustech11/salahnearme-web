import Image from "next/image";
import Link from "next/link";

import {
  buildMosqueLiveTrust,
  formatLiveStatusLabel,
  type LiveReportRow,
  type MosqueLiveTrust,
} from "@/lib/mosqueTrust";
import { sortMosquesByTrustAndActivity } from "@/lib/mosqueSmartRanking";
import { supabasePublic } from "@/lib/supabaseServer";

type CityContext = {
  id: number;
  name: string;
  slug: string;
};

type Props = {
  city?: CityContext | null;
  limit?: number;
};

type MosqueCityJoin =
  | {
      name: string | null;
      slug: string | null;
    }
  | null;

type HomeMosqueRow = {
  id: string;
  name: string | null;
  slug: string | null;
  area: string | null;
  postcode: string | null;
  address: string | null;
  verified_status: string | null;
  parking: boolean | null;
  womens_space: boolean | null;
  wheelchair_access: boolean | null;
  jumuah_enabled: boolean | null;
  jumuah_salah_1: string | null;
  jumuah_salah_2: string | null;
  jumuah_salah_3: string | null;
  city_id: number | null;
  cities?: MosqueCityJoin;
};

const DEFAULT_LIMIT = 6;
const MAX_QUERY_ROWS = 30;

function cleanText(
  value: string | null | undefined
): string {
  return String(value ?? "").trim();
}

function formatStatus(
  value: string | null | undefined
): string | null {
  const cleaned = cleanText(value);

  if (!cleaned) {
    return null;
  }

  return cleaned
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

function hasJumuah(
  mosque: HomeMosqueRow
): boolean {
  return Boolean(
    mosque.jumuah_enabled ||
      mosque.jumuah_salah_1 ||
      mosque.jumuah_salah_2 ||
      mosque.jumuah_salah_3
  );
}

function getLocation(
  mosque: HomeMosqueRow
): string {
  return [
    cleanText(mosque.area),
    cleanText(mosque.cities?.name),
    cleanText(mosque.postcode),
  ]
    .filter(Boolean)
    .join(" • ");
}

function getFacilityLabels(
  mosque: HomeMosqueRow
): string[] {
  const labels: string[] = [];

  if (mosque.womens_space) {
    labels.push("Women’s space");
  }

  if (mosque.parking) {
    labels.push("Parking");
  }

  if (
    mosque.wheelchair_access
  ) {
    labels.push("Accessible");
  }

  if (hasJumuah(mosque)) {
    labels.push("Jumu’ah");
  }

  return labels.slice(0, 3);
}

function getImagePosition(
  index: number
): string {
  const positions = [
    "object-[64%_45%]",
    "object-[74%_42%]",
    "object-[58%_48%]",
  ];

  return positions[
    index % positions.length
  ];
}

function getLiveTone(
  live: MosqueLiveTrust
): "green" | "red" | "orange" | "cyan" | "yellow" {
  if (
    live.dominantStatus ===
      "full" ||
    live.dominantStatus ===
      "correction"
  ) {
    return "red";
  }

  if (
    live.dominantStatus ===
      "parking_full" ||
    live.dominantStatus ===
      "delayed"
  ) {
    return "orange";
  }

  if (
    live.dominantStatus ===
    "khutbah"
  ) {
    return "cyan";
  }

  if (
    live.dominantStatus ===
      "iqamah" ||
    live.dominantStatus ===
      "jumuah"
  ) {
    return "green";
  }

  return "yellow";
}

function getFreshnessLabel(
  minutesAgo: number | null
): string | null {
  if (minutesAgo === null) {
    return null;
  }

  if (minutesAgo <= 0) {
    return "Updated just now";
  }

  if (minutesAgo === 1) {
    return "Updated 1 minute ago";
  }

  return `Updated ${minutesAgo} minutes ago`;
}

export default async function HomeFeaturedMosques({
  city = null,
  limit = DEFAULT_LIMIT,
}: Props) {
  const safeLimit = Math.max(
    1,
    Math.min(limit, 12)
  );

  const supabase =
    supabasePublic();

  let mosqueQuery = supabase
    .from("mosques")
    .select(
      `
      id,
      name,
      slug,
      area,
      postcode,
      address,
      verified_status,
      parking,
      womens_space,
      wheelchair_access,
      jumuah_enabled,
      jumuah_salah_1,
      jumuah_salah_2,
      jumuah_salah_3,
      city_id,
      cities:city_id (
        name,
        slug
      )
    `
    )
    .eq("is_active", true)
    .not("slug", "is", null)
    .order("verified_status", {
      ascending: false,
    })
    .order("name", {
      ascending: true,
    })
    .limit(MAX_QUERY_ROWS);

  if (city) {
    mosqueQuery =
      mosqueQuery.eq(
        "city_id",
        city.id
      );
  }

  const {
    data: mosqueData,
    error: mosqueError,
  } = await mosqueQuery;

  if (mosqueError) {
    console.warn(
      "Home featured mosques unavailable:",
      mosqueError.message
    );

    return null;
  }

  const mosqueRows =
    (mosqueData ??
      []) as unknown as HomeMosqueRow[];

  if (
    mosqueRows.length === 0
  ) {
    return null;
  }

  const mosqueIds =
    mosqueRows.map(
      (mosque) => mosque.id
    );

  const {
    data: reportData,
    error: reportError,
  } = await supabase
    .from(
      "mosque_live_reports"
    )
    .select(
      [
        "mosque_id",
        "report_type",
        "created_at",
        "user_fingerprint",
      ].join(",")
    )
    .in(
      "mosque_id",
      mosqueIds
    )
    .order("created_at", {
      ascending: false,
    })
    .limit(300);

  if (reportError) {
    console.warn(
      "Homepage mosque live reports unavailable:",
      reportError.message
    );
  }

  const reports =
    (reportData ??
      []) as unknown as LiveReportRow[];

  const groupedReports =
    new Map<
      string,
      LiveReportRow[]
    >();

  for (const report of reports) {
    const existing =
      groupedReports.get(
        report.mosque_id
      ) ?? [];

    existing.push(report);

    groupedReports.set(
      report.mosque_id,
      existing
    );
  }

  const liveMap =
    new Map<
      string,
      MosqueLiveTrust
    >();

  for (const mosque of mosqueRows) {
    liveMap.set(
      mosque.id,
      buildMosqueLiveTrust(
        groupedReports.get(
          mosque.id
        ) ?? []
      )
    );
  }

  const mosques =
    sortMosquesByTrustAndActivity(
      mosqueRows,
      liveMap
    )
      .sort((a, b) => {
        const aRow =
          a as HomeMosqueRow;

        const bRow =
          b as HomeMosqueRow;

        const aVerified =
          cleanText(
            aRow.verified_status
          )
            ? 1
            : 0;

        const bVerified =
          cleanText(
            bRow.verified_status
          )
            ? 1
            : 0;

        if (
          aVerified !== bVerified
        ) {
          return (
            bVerified -
            aVerified
          );
        }

        return (
          (liveMap.get(b.id)
            ?.trustScore ?? 0) -
          (liveMap.get(a.id)
            ?.trustScore ?? 0)
        );
      })
      .slice(
        0,
        safeLimit
      ) as HomeMosqueRow[];

  const viewAllHref = city
    ? `/${city.slug}/mosques`
    : "/near-me/pray";

  const liveMosqueCount =
    mosques.filter(
      (mosque) =>
        liveMap.get(mosque.id)
          ?.hasLive
    ).length;

  return (
    <section
      aria-labelledby="featured-mosques-heading"
      className="premium-panel relative overflow-hidden rounded-[2rem] p-5 sm:p-7"
    >
      <div
        aria-hidden="true"
        className="absolute -right-28 -top-28 h-80 w-80 rounded-full border border-yellow-400/10 bg-yellow-400/[0.025]"
      />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="section-kicker">
              Live mosque discovery
            </div>

            {liveMosqueCount > 0 ? (
              <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-[0.62rem] font-black uppercase tracking-[0.14em] text-emerald-200">
                {liveMosqueCount} active now
              </span>
            ) : null}
          </div>

          <h2
            id="featured-mosques-heading"
            className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl"
          >
            {city
              ? `Mosques to explore in ${city.name}`
              : "Trusted mosque discovery"}
          </h2>

          <p className="mt-3 max-w-3xl text-sm leading-7 text-white/55">
            Mosque profiles ranked using
            verification, facilities and
            recent community trust
            signals.
          </p>
        </div>

        <Link
          href={viewAllHref}
          className="inline-flex shrink-0 items-center gap-2 text-sm font-bold text-yellow-300 transition hover:text-yellow-100"
        >
          View all mosques
          <span aria-hidden="true">
            →
          </span>
        </Link>
      </div>

      <div className="relative mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {mosques.map(
          (mosque, index) => {
            const live =
              liveMap.get(
                mosque.id
              ) ??
              buildMosqueLiveTrust(
                []
              );

            const name =
              cleanText(
                mosque.name
              ) || "Mosque";

            const slug =
              cleanText(
                mosque.slug
              );

            const location =
              getLocation(mosque);

            const facilities =
              getFacilityLabels(
                mosque
              );

            const verifiedStatus =
              formatStatus(
                mosque.verified_status
              );

            const liveLabel =
              formatLiveStatusLabel(
                live.dominantStatus
              );

            const freshnessLabel =
              getFreshnessLabel(
                live.latestReportMinutesAgo
              );

            return (
              <article
                key={mosque.id}
                className="group relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#030a1d] shadow-[0_20px_55px_rgba(0,0,0,0.24)] transition duration-300 hover:-translate-y-1 hover:border-yellow-400/35"
              >
                <div className="relative h-44 overflow-hidden">
                  <Image
                    src="/images/homepage-mosque-night.webp"
                    alt=""
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                    className={[
                      "scale-[1.04] object-cover opacity-75 transition duration-700 group-hover:scale-[1.09] group-hover:opacity-90",
                      getImagePosition(
                        index
                      ),
                    ].join(" ")}
                  />

                  <div className="absolute inset-0 bg-gradient-to-t from-[#030a1d] via-[#030a1d]/35 to-black/10" />

                  <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                    {live.hasLive ? (
                      <LiveBadge
                        tone={getLiveTone(
                          live
                        )}
                      >
                        {liveLabel}
                      </LiveBadge>
                    ) : null}

                    {verifiedStatus ? (
                      <Badge variant="verified">
                        {verifiedStatus}
                      </Badge>
                    ) : null}
                  </div>

                  <div className="absolute bottom-4 left-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-yellow-400/25 bg-black/65 text-yellow-300 shadow-xl backdrop-blur-xl">
                    <MosqueIcon />
                  </div>
                </div>

                <div className="p-5">
                  {slug ? (
                    <Link
                      href={`/mosque/${slug}`}
                      className="block text-xl font-black text-white transition group-hover:text-yellow-300"
                    >
                      {name}
                    </Link>
                  ) : (
                    <h3 className="text-xl font-black text-white">
                      {name}
                    </h3>
                  )}

                  <p className="mt-2 min-h-6 text-sm text-white/55">
                    {location ||
                      "Location details being verified"}
                  </p>

                  {mosque.address ? (
                    <p className="mt-2 line-clamp-2 min-h-12 text-xs leading-6 text-white/40">
                      {mosque.address}
                    </p>
                  ) : (
                    <div className="min-h-14" />
                  )}

                  {live.hasLive ? (
                    <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-black text-white">
                          {liveLabel}
                        </span>

                        <span className="capitalize text-[0.64rem] font-bold text-yellow-200">
                          {live.confidence} confidence
                        </span>
                      </div>

                      {freshnessLabel ? (
                        <p className="mt-1 text-[0.68rem] text-white/40">
                          {freshnessLabel}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="mt-4 flex min-h-8 flex-wrap gap-2">
                    {facilities.map(
                      (facility) => (
                        <Badge
                          key={facility}
                        >
                          {facility}
                        </Badge>
                      )
                    )}
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
                    <div className="text-xs text-white/45">
                      Trust score:{" "}
                      <span className="font-bold text-white/75">
                        {live.trustScore}
                      </span>
                    </div>

                    {slug ? (
                      <Link
                        href={`/mosque/${slug}`}
                        className="text-sm font-bold text-yellow-300 transition hover:text-yellow-100"
                      >
                        View profile →
                      </Link>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          }
        )}
      </div>
    </section>
  );
}

function MosqueIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 21v-7h16v7" />
      <path d="M7 14V9h10v5" />
      <path d="M9 9c0-2 1.3-3.6 3-4.5C13.7 5.4 15 7 15 9" />
      <path d="M12 2v2.5" />
      <path d="M2 21h20" />
    </svg>
  );
}

function LiveBadge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone:
    | "green"
    | "red"
    | "orange"
    | "cyan"
    | "yellow";
}) {
  const styles = {
    green:
      "border-emerald-400/25 bg-emerald-400/10 text-emerald-100",
    red:
      "border-red-400/25 bg-red-400/10 text-red-100",
    orange:
      "border-orange-400/25 bg-orange-400/10 text-orange-100",
    cyan:
      "border-cyan-400/25 bg-cyan-400/10 text-cyan-100",
    yellow:
      "border-yellow-400/25 bg-yellow-400/10 text-yellow-100",
  };

  return (
    <span
      className={[
        "inline-flex rounded-full border px-3 py-1 text-[0.64rem] font-black",
        styles[tone],
      ].join(" ")}
    >
      {children}
    </span>
  );
}

function Badge({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?:
    | "default"
    | "verified";
}) {
  const className =
    variant === "verified"
      ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
      : "border-yellow-400/20 bg-yellow-400/[0.07] text-yellow-200";

  return (
    <span
      className={[
        "inline-flex rounded-full border px-3 py-1 text-[0.64rem] font-bold",
        className,
      ].join(" ")}
    >
      {children}
    </span>
  );
}