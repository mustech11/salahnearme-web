import Link from "next/link";
import { supabasePublic } from "@/lib/supabaseServer";

export const revalidate = 300;

type CountryRow = {
  id: number;
  name: string;
  slug: string;
  country_code: string;
  timezone: string | null;
};

type CityRow = {
  id: number;
  name: string;
  slug: string;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
};

export default async function TravelHomePage() {
  const supabase = supabasePublic();

  const [
    { data: countryData, error: countryError },
    { data: cityData, error: cityError },
    { count: mosqueCount },
    { count: businessCount },
  ] = await Promise.all([
    supabase
      .from("travel_countries")
      .select("id,name,slug,country_code,timezone")
      .eq("is_active", true)
      .order("name", { ascending: true }),

    supabase
      .from("cities")
      .select("id,name,slug,country,latitude,longitude")
      .eq("is_active", true)
      .order("name", { ascending: true }),

    supabase
      .from("mosques")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),

    supabase
      .from("businesses")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),
  ]);

  if (countryError) {
    return <pre className="text-white/80">{countryError.message}</pre>;
  }

  if (cityError) {
    return <pre className="text-white/80">{cityError.message}</pre>;
  }

  const countries = (countryData ?? []) as CountryRow[];
  const cities = (cityData ?? []) as CityRow[];

  const cityCountByCountry = new Map<string, number>();
  const readyCityCountByCountry = new Map<string, number>();

  for (const city of cities) {
    const countryName = city.country?.trim();
    if (!countryName) continue;

    cityCountByCountry.set(
      countryName,
      (cityCountByCountry.get(countryName) ?? 0) + 1
    );

    if (typeof city.latitude === "number" && typeof city.longitude === "number") {
      readyCityCountByCountry.set(
        countryName,
        (readyCityCountByCountry.get(countryName) ?? 0) + 1
      );
    }
  }

  const featuredCities = cities
    .filter(
      (city) =>
        typeof city.latitude === "number" &&
        typeof city.longitude === "number"
    )
    .slice(0, 8);

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-yellow-500/20 bg-[radial-gradient(circle_at_top_right,rgba(234,179,8,0.16),transparent_35%),rgb(var(--card))] p-8 md:p-10">
        <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
          Travel Mode
        </div>

        <h1 className="mt-3 max-w-5xl text-4xl font-bold leading-tight text-white md:text-6xl">
          Find mosques and halal essentials while travelling
        </h1>

        <p className="mt-4 max-w-3xl text-white/70 md:text-xl">
          Discover nearby mosques, halal businesses, prayer spaces, directions,
          and trusted Muslim-friendly essentials in supported cities worldwide.
        </p>

        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            href="/travel/map"
            className="rounded-2xl bg-yellow-500 px-6 py-4 text-base font-semibold text-black transition hover:bg-yellow-400"
          >
            Open map view
          </Link>

          <Link
            href="/travel/near-me"
            className="rounded-2xl border border-yellow-500/30 bg-black px-6 py-4 text-base font-semibold text-yellow-400 transition hover:bg-yellow-500/10"
          >
            Use near me
          </Link>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
            <div className="text-xs uppercase tracking-[0.2em] text-white/50">
              Countries
            </div>
            <div className="mt-2 text-3xl font-bold text-white">
              {countries.length}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
            <div className="text-xs uppercase tracking-[0.2em] text-white/50">
              Mosques
            </div>
            <div className="mt-2 text-3xl font-bold text-white">
              {mosqueCount ?? 0}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
            <div className="text-xs uppercase tracking-[0.2em] text-white/50">
              Halal Businesses
            </div>
            <div className="mt-2 text-3xl font-bold text-white">
              {businessCount ?? 0}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8 md:p-10">
          <div className="text-2xl font-semibold text-yellow-400 md:text-4xl">
            Use your current location
          </div>

          <p className="mt-3 max-w-3xl text-white/70 md:text-lg">
            Travelling right now? Let SalahNearMe detect your nearest supported
            city and show nearby mosques and halal essentials.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/travel/near-me"
              className="rounded-2xl bg-yellow-500 px-6 py-4 text-base font-semibold text-black transition hover:bg-yellow-400"
            >
              Find near me
            </Link>

            <Link
              href="/travel/map"
              className="rounded-2xl border border-yellow-500/30 bg-black px-6 py-4 text-base font-semibold text-yellow-400 transition hover:bg-yellow-500/10"
            >
              Open live map
            </Link>
          </div>
        </div>

        <div className="rounded-3xl border border-green-500/20 bg-green-500/10 p-8 md:p-10">
          <div className="text-sm uppercase tracking-[0.2em] text-green-300">
            Smart Travel Layer
          </div>

          <div className="mt-3 text-3xl font-bold text-white">
            Built for global Muslim travel
          </div>

          <p className="mt-3 text-white/70">
            Your platform can now support city pages, mosque pages, halal
            businesses, near-me results, and map discovery across multiple
            countries.
          </p>
        </div>
      </section>

      {featuredCities.length > 0 && (
        <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6 md:p-8">
          <div className="mb-6">
            <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
              Featured Cities
            </div>
            <h2 className="mt-3 text-3xl font-bold text-white">
              Explore supported cities
            </h2>
            <p className="mt-2 text-white/60">
              These cities have coordinates and are ready for imports, map view,
              and near-me features.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {featuredCities.map((city) => (
              <Link
                key={city.id}
                href={`/${city.slug}`}
                className="rounded-2xl border border-white/10 bg-black/30 p-5 transition hover:border-yellow-400/40 hover:bg-yellow-500/[0.03]"
              >
                <div className="text-xl font-bold text-white">{city.name}</div>
                <div className="mt-2 text-sm text-white/60">
                  {city.country ?? "Supported city"}
                </div>
                <div className="mt-4 text-sm font-semibold text-yellow-400">
                  Open city →
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {countries.length === 0 ? (
        <section className="rounded-3xl border border-white/10 bg-[rgb(var(--card))] p-8 text-white/60">
          No travel countries added yet.
        </section>
      ) : (
        <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6 md:p-8">
          <div className="mb-6">
            <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
              Travel Countries
            </div>

            <h2 className="mt-3 text-3xl font-bold text-white">
              Choose a country
            </h2>

            <p className="mt-2 text-white/60">
              Browse supported countries and open their travel city pages.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {countries.map((country) => {
              const cityCount = cityCountByCountry.get(country.name) ?? 0;
              const readyCount = readyCityCountByCountry.get(country.name) ?? 0;

              return (
                <Link
                  key={country.id}
                  href={`/travel/${country.slug}`}
                  className="block w-full rounded-3xl border border-yellow-500/20 bg-black/30 p-7 transition hover:border-yellow-400/40 hover:bg-yellow-500/[0.03]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="text-2xl font-semibold text-white">
                        {country.name}
                      </div>

                      <div className="mt-3 text-base text-white/60">
                        Code: {country.country_code}
                        {country.timezone ? ` • ${country.timezone}` : ""}
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-sm font-medium text-yellow-400">
                          {cityCount} {cityCount === 1 ? "city" : "cities"}
                        </span>

                        <span className="rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-sm font-medium text-green-300">
                          {readyCount} map-ready
                        </span>
                      </div>
                    </div>

                    <div className="text-sm font-semibold text-yellow-400">
                      Explore →
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

