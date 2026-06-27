import Link from "next/link";
import { notFound } from "next/navigation";

import { buildJumuahInsight } from "@/lib/jumuahIntelligence";
import {
  buildMosqueJumuahInsight,
  getMosqueJumuahSessions,
  type MosqueJumuahInsight,
} from "@/lib/mosqueJumuahIntelligence";
import { supabasePublic } from "@/lib/supabaseServer";
import {
  rankTravelBusinessesByPrayerContext,
  rankTravelMosquesByPrayerContext,
} from "@/lib/travelContextRanking";
import { haversineKm } from "@/lib/travel";
import {
  buildTravelPrayerInsight,
  formatPrayerKey,
  getPrayerPriorityTag,
  type TravelPrayerTimes,
} from "@/lib/travelPrayerIntelligence";

export const revalidate = 300;

type PageProps = {
  params: Promise<{
    country: string;
    city: string;
  }>;
  searchParams: Promise<{
    lat?: string;
    lng?: string;
    verified?: string;
    featured?: string;
    open_now?: string;
  }>;
};

type CountryRow = {
  name: string;
  slug: string;
  country_code: string;
};

type CityRow = {
  id: number;
  name: string;
  slug: string;
  country_code: string | null;
  timezone: string | null;
  latitude: number | null;
  longitude: number | null;
};

type MosqueRow = {
  id: string;
  name: string | null;
  slug: string | null;
  area: string | null;
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  jumuah_enabled: boolean | null;
  jumuah_khutbah_1: string | null;
  jumuah_salah_1: string | null;
  jumuah_khutbah_2: string | null;
  jumuah_salah_2: string | null;
  jumuah_khutbah_3: string | null;
  jumuah_salah_3: string | null;
  jumuah_notes: string | null;
};

type BusinessRow = {
  id: string;
  name: string | null;
  slug: string | null;
  category: string | null;
  city: string | null;
  area: string | null;
  country: string | null;
  featured: boolean | null;
  featured_rank: number | null;
  pricing_tier: string | null;
  is_verified: boolean | null;
  opens_at: string | null;
  closes_at: string | null;
  travel_tags: string[] | null;
  latitude: number | null;
  longitude: number | null;
};

type JumuahSessionDisplay = {
  label: string;
  khutbah: string | null;
  salah: string | null;
};

type TravelMosqueCardRow = MosqueRow & {
  distanceKm: number | null;
  mosqueJumuahInsight: MosqueJumuahInsight;
  jumuahSessions: JumuahSessionDisplay[];
  _score?: number;
};

type TravelBusinessCardRow = BusinessRow & {
  distanceKm: number | null;
  _score?: number;
};

function parseCoordinate(value?: string) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function hasDistance(value: { distanceKm?: number | null }) {
  return typeof value.distanceKm === "number";
}

function formatDistance(value: number | null | undefined) {
  if (typeof value !== "number") {
    return null;
  }

  return `${value.toFixed(2)} km away`;
}

function locationText(...values: Array<string | null | undefined>) {
  return values.filter(Boolean).join(" • ");
}

export default async function TravelCityPage({
  params,
  searchParams,
}: PageProps) {
  const { country, city } = await params;
  const filters = await searchParams;
  const supabase = supabasePublic();

  const userLat = parseCoordinate(filters.lat);
  const userLng = parseCoordinate(filters.lng);
  const verifiedOnly = filters.verified === "1";
  const featuredOnly = filters.featured === "1";
  const openNowOnly = filters.open_now === "1";

  const { data: countryRowRaw } = await supabase
    .from("travel_countries")
    .select("name,slug,country_code")
    .eq("slug", country)
    .eq("is_active", true)
    .maybeSingle();

  const countryRow = countryRowRaw as CountryRow | null;

  if (!countryRow) {
    notFound();
  }

  const { data: cityRowRaw } = await supabase
    .from("cities")
    .select("id,name,slug,country_code,timezone,latitude,longitude")
    .eq("slug", city)
    .eq("country_code", countryRow.country_code)
    .eq("is_travel_enabled", true)
    .maybeSingle();

  const cityRow = cityRowRaw as CityRow | null;

  if (!cityRow) {
    notFound();
  }

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const [
    { data: mosquesRaw, error: mosquesError },
    { data: businessesRaw, error: businessesError },
    { data: prayerTimesRaw, error: prayerTimesError },
  ] = await Promise.all([
    supabase
      .from("mosques")
      .select(
        "id,name,slug,area,city,country,latitude,longitude,jumuah_enabled,jumuah_khutbah_1,jumuah_salah_1,jumuah_khutbah_2,jumuah_salah_2,jumuah_khutbah_3,jumuah_salah_3,jumuah_notes"
      )
      .eq("city", cityRow.name)
      .eq("country_code", countryRow.country_code)
      .eq("is_travel_visible", true)
      .order("name", { ascending: true })
      .limit(50),

    supabase
      .from("businesses")
      .select(
        "id,name,slug,category,city,area,country,featured,featured_rank,pricing_tier,is_verified,opens_at,closes_at,travel_tags,latitude,longitude"
      )
      .eq("city", cityRow.name)
      .eq("country_code", countryRow.country_code)
      .eq("is_travel_visible", true)
      .order("featured", { ascending: false })
      .order("name", { ascending: true })
      .limit(100),

    supabase
      .from("city_prayer_times")
      .select(
        "fajr_start,sunrise,dhuhr_start,asr_start,maghrib_start,isha_start"
      )
      .eq("city_id", cityRow.id)
      .eq("month", month)
      .eq("year", year)
      .maybeSingle(),
  ]);

  if (mosquesError) {
    return <pre className="text-white/80">{mosquesError.message}</pre>;
  }

  if (businessesError) {
    return <pre className="text-white/80">{businessesError.message}</pre>;
  }

  if (prayerTimesError) {
    return <pre className="text-white/80">{prayerTimesError.message}</pre>;
  }

  const prayerTimes = (prayerTimesRaw ?? null) as TravelPrayerTimes | null;
  const prayerInsight = buildTravelPrayerInsight(prayerTimes, now);
  const prayerTag = getPrayerPriorityTag(prayerInsight.currentPrayer);

  const jumuahInsight = buildJumuahInsight({
    now,
    dhuhrStart: prayerTimes?.dhuhr_start ?? null,
    prayerInsight,
  });

  const mosqueRows: TravelMosqueCardRow[] = ((mosquesRaw ?? []) as MosqueRow[]).map(
    (mosque) => {
      const distanceKm =
        userLat !== null &&
        userLng !== null &&
        mosque.latitude !== null &&
        mosque.longitude !== null
          ? haversineKm(userLat, userLng, mosque.latitude, mosque.longitude)
          : null;

      const mosqueJumuahInsight = buildMosqueJumuahInsight(
        {
          ...mosque,
          distanceKm,
        },
        now
      );

      return {
        ...mosque,
        distanceKm,
        mosqueJumuahInsight,
        jumuahSessions: getMosqueJumuahSessions(mosque),
      };
    }
  );

  const businessRows: TravelBusinessCardRow[] = (
    (businessesRaw ?? []) as BusinessRow[]
  )
    .filter((business) => {
      if (verifiedOnly && !business.is_verified) {
        return false;
      }

      if (featuredOnly && !business.featured) {
        return false;
      }

      if (openNowOnly && !(business.opens_at && business.closes_at)) {
        return false;
      }

      return true;
    })
    .map((business) => {
      const distanceKm =
        userLat !== null &&
        userLng !== null &&
        business.latitude !== null &&
        business.longitude !== null
          ? haversineKm(userLat, userLng, business.latitude, business.longitude)
          : null;

      return {
        ...business,
        distanceKm,
      };
    });

  const rankedMosques = rankTravelMosquesByPrayerContext(
    mosqueRows,
    prayerInsight,
    jumuahInsight
  ).slice(0, 8) as TravelMosqueCardRow[];

  const rankedBusinesses = rankTravelBusinessesByPrayerContext(
    businessRows,
    prayerInsight,
    now,
    jumuahInsight
  ) as TravelBusinessCardRow[];

  const essentials = rankedBusinesses.slice(0, 8);
  const verifiedList = rankedBusinesses
    .filter((business) => business.is_verified)
    .slice(0, 8);

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
        <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
          Travel City
        </div>

        <h1 className="mt-3 text-4xl font-bold text-white">
          {cityRow.name}, {countryRow.name}
        </h1>

        <p className="mt-3 text-white/70">
          Find mosques, halal food, and essential Muslim-friendly places in{" "}
          {cityRow.name}.
        </p>

        <div className="mt-2 text-sm text-white/50">
          Timezone: {cityRow.timezone ?? "Not set"}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={`/travel/${countryRow.slug}`}
            className="text-sm font-medium text-yellow-400 hover:text-yellow-300"
          >
            ← Back to {countryRow.name}
          </Link>
        </div>
      </section>

      <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
              Prayer-aware travel guidance
            </div>

            <h2 className="mt-3 text-2xl font-bold text-white">{prayerTag}</h2>

            <p className="mt-3 max-w-3xl text-white/70">
              {prayerInsight.message}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
            <div className="text-xs uppercase tracking-[0.2em] text-yellow-400">
              Prayer snapshot
            </div>

            <div className="mt-4 space-y-2 text-sm text-white/80">
              <div>
                <span className="text-white/50">Current:</span>{" "}
                {formatPrayerKey(prayerInsight.currentPrayer)}
              </div>

              <div>
                <span className="text-white/50">Next:</span>{" "}
                {formatPrayerKey(prayerInsight.nextPrayer)}
              </div>

              <div>
                <span className="text-white/50">Next time:</span>{" "}
                {prayerInsight.nextPrayerTime ?? "—"}
              </div>
            </div>
          </div>
        </div>

        {prayerTimes && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
            <PrayerCard label="Fajr" value={prayerTimes.fajr_start} />
            <PrayerCard label="Sunrise" value={prayerTimes.sunrise} />
            <PrayerCard label="Dhuhr" value={prayerTimes.dhuhr_start} />
            <PrayerCard label="Asr" value={prayerTimes.asr_start} />
            <PrayerCard label="Maghrib" value={prayerTimes.maghrib_start} />
            <PrayerCard label="Isha" value={prayerTimes.isha_start} />
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-green-500/20 bg-[rgb(var(--card))] p-8">
        <div className="text-sm uppercase tracking-[0.2em] text-green-300">
          Jumu’ah-aware mode
        </div>

        <h2 className="mt-3 text-2xl font-bold text-white">
          {jumuahInsight.title}
        </h2>

        <p className="mt-3 max-w-3xl text-white/70">
          {jumuahInsight.message}
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
          <div className="text-2xl font-semibold text-yellow-400">
            Nearby mosques
          </div>

          <div className="mt-5 space-y-3">
            {rankedMosques.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-white/60">
                No mosques added yet.
              </div>
            ) : (
              rankedMosques.map((mosque) => (
                <Link
                  key={mosque.id}
                  href={mosque.slug ? `/mosque/${mosque.slug}` : "#"}
                  className="block rounded-2xl border border-white/10 bg-black/30 p-4 hover:border-yellow-500/30"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-white">
                        {mosque.name}
                      </div>

                      <div className="mt-1 text-sm text-white/60">
                        {locationText(mosque.area, mosque.city)}
                      </div>

                      {hasDistance(mosque) && (
                        <div className="mt-2 text-xs text-yellow-400">
                          {formatDistance(mosque.distanceKm)}
                        </div>
                      )}
                    </div>

                    {mosque.mosqueJumuahInsight.hasJumuah && (
                      <span className="rounded-full border border-green-500/30 bg-green-500/10 px-2 py-1 text-xs font-semibold text-green-300">
                        {mosque.mosqueJumuahInsight.stage ===
                          "khutbah_active" ||
                        mosque.mosqueJumuahInsight.stage === "salah_active"
                          ? "Jumu’ah active"
                          : "Jumu’ah available"}
                      </span>
                    )}
                  </div>

                  {mosque.jumuahSessions.length > 0 && (
                    <div className="mt-3 space-y-1 text-xs text-white/60">
                      {mosque.jumuahSessions.map((session) => (
                        <div key={session.label}>
                          {session.label}: Khutbah {session.khutbah ?? "—"} •
                          Salah {session.salah ?? "—"}
                        </div>
                      ))}
                    </div>
                  )}
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
          <div className="text-2xl font-semibold text-yellow-400">
            Muslim essentials nearby
          </div>

          <div className="mt-5 space-y-3">
            {essentials.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-white/60">
                No essentials added yet.
              </div>
            ) : (
              essentials.map((business) => (
                <Link
                  key={business.id}
                  href={business.slug ? `/business/${business.slug}` : "#"}
                  className="block rounded-2xl border border-white/10 bg-black/30 p-4 hover:border-yellow-500/30"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-white">
                        {business.name}
                      </div>

                      <div className="mt-1 text-sm text-white/60">
                        {locationText(business.category, business.area)}
                      </div>

                      {hasDistance(business) && (
                        <div className="mt-2 text-xs text-yellow-400">
                          {formatDistance(business.distanceKm)}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      {business.featured && (
                        <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2 py-1 text-xs font-semibold text-yellow-400">
                          Featured
                        </span>
                      )}

                      {business.is_verified && (
                        <span className="rounded-full border border-green-500/30 bg-green-500/10 px-2 py-1 text-xs font-semibold text-green-300">
                          Verified
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
        <div className="text-2xl font-semibold text-yellow-400">
          Verified halal businesses
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {verifiedList.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-white/60 md:col-span-2 xl:col-span-4">
              No verified businesses found yet.
            </div>
          ) : (
            verifiedList.map((business) => (
              <Link
                key={business.id}
                href={business.slug ? `/business/${business.slug}` : "#"}
                className="rounded-2xl border border-white/10 bg-black/30 p-5 hover:border-yellow-500/30"
              >
                <div className="font-semibold text-white">{business.name}</div>

                <div className="mt-2 text-sm text-white/60">
                  {locationText(business.category, business.area)}
                </div>

                {hasDistance(business) && (
                  <div className="mt-2 text-xs text-yellow-400">
                    {formatDistance(business.distanceKm)}
                  </div>
                )}
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function PrayerCard({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-center">
      <div className="text-sm font-semibold text-yellow-400">{label}</div>
      <div className="mt-2 text-xl font-bold text-white">{value ?? "—"}</div>
    </div>
  );
}