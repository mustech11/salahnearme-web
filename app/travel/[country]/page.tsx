import Link from "next/link";
import { notFound } from "next/navigation";
import { supabasePublic } from "@/lib/supabaseServer";

export const revalidate = 300;

type PageProps = {
  params: Promise<{
    country: string;
  }>;
};

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
  country_code: string | null;
  timezone: string | null;
  is_travel_enabled: boolean | null;
};

export default async function TravelCountryPage({ params }: PageProps) {
  const { country } = await params;
  const supabase = supabasePublic();

  const { data: countryRowRaw, error: countryError } = await supabase
    .from("travel_countries")
    .select("id,name,slug,country_code,timezone")
    .eq("slug", country)
    .eq("is_active", true)
    .maybeSingle();

  if (countryError) {
    return <pre className="text-white/80">{countryError.message}</pre>;
  }

  if (!countryRowRaw) {
    notFound();
  }

  const countryRow = countryRowRaw as CountryRow;

  const { data: citiesRaw, error: citiesError } = await supabase
    .from("cities")
    .select("id,name,slug,country,country_code,timezone,is_travel_enabled")
    .eq("is_active", true)
    .eq("is_travel_enabled", true)
    .or(
      `country.eq.${countryRow.name},country_code.eq.${countryRow.country_code}`
    )
    .order("name", { ascending: true });

  if (citiesError) {
    return <pre className="text-white/80">{citiesError.message}</pre>;
  }

  const cities = (citiesRaw ?? []) as CityRow[];
  const cityCount = cities.length;

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8 md:p-10">
        <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
          Travel Country
        </div>

        <h1 className="mt-3 text-4xl font-bold text-white md:text-6xl">
          {countryRow.name}
        </h1>

        <p className="mt-4 max-w-3xl text-white/70 md:text-xl">
          Browse travel-enabled Muslim discovery pages for cities in{" "}
          {countryRow.name}.
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <div className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-sm font-medium text-yellow-400">
            {countryRow.country_code}
          </div>

          {countryRow.timezone && (
            <div className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-sm text-white/70">
              {countryRow.timezone}
            </div>
          )}

          <div className="rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-sm font-medium text-green-300">
            {cityCount} {cityCount === 1 ? "city" : "cities"}
          </div>
        </div>

        <div className="mt-6">
          <Link
            href="/travel"
            className="text-sm font-medium text-yellow-400 hover:text-yellow-300"
          >
            ← Back to travel
          </Link>
        </div>
      </section>

      {cities.length === 0 ? (
        <section className="rounded-3xl border border-white/10 bg-[rgb(var(--card))] p-8 text-white/60">
          No travel-enabled cities have been added for {countryRow.name} yet.
        </section>
      ) : (
        <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6 md:p-8">
          <div className="mb-6">
            <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
              Cities
            </div>
            <h2 className="mt-3 text-3xl font-bold text-white">
              Choose a city
            </h2>
            <p className="mt-2 text-white/60">
              Open a city page to explore mosques, halal businesses, and prayer-aware tools.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {cities.map((city) => (
              <Link
                key={city.id}
                href={`/${city.slug}`}
                className="block w-full rounded-3xl border border-yellow-500/20 bg-black/30 p-7 transition hover:border-yellow-400/40 hover:bg-yellow-500/[0.03]"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-2xl font-semibold text-white">
                      {city.name}
                    </div>

                    <div className="mt-3 text-base text-white/60">
                      {city.timezone ?? "Timezone not set"}
                    </div>
                  </div>

                  <div className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-sm font-medium text-yellow-400">
                    Open city
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}