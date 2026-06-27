import Link from "next/link";
import { supabasePublic } from "@/lib/supabaseServer";

export const revalidate = 300;

type SearchParams = Promise<{
  city?: string;
  mosque?: string;
  business?: string;
}>;

type PageProps = {
  searchParams: SearchParams;
};

type CityRow = {
  id: number;
  name: string;
  slug: string;
};

type MosqueRow = {
  id: string;
  name: string | null;
  slug: string | null;
  city: string | null;
  area: string | null;
  postcode: string | null;
};

type BusinessRow = {
  id: string;
  name: string | null;
  slug: string | null;
  category: string | null;
  city: string | null;
  featured: boolean | null;
};

export default async function AdvertiseSetupPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const selectedCitySlug = params.city ?? "";
  const selectedMosqueId = params.mosque ?? "";
  const selectedBusinessId = params.business ?? "";

  const supabase = supabasePublic();

  const [
    { data: cities, error: citiesError },
    { data: mosques, error: mosquesError },
    { data: businesses, error: businessesError },
  ] = await Promise.all([
    supabase
      .from("cities")
      .select("id,name,slug")
      .eq("is_active", true)
      .order("name", { ascending: true }),

    supabase
      .from("mosques")
      .select("id,name,slug,city,area,postcode")
      .order("name", { ascending: true }),

    supabase
      .from("businesses")
      .select("id,name,slug,category,city,featured")
      .eq("status", "approved")
      .eq("can_advertise", true)
      .order("featured", { ascending: false })
      .order("name", { ascending: true }),
  ]);

  if (citiesError) {
    return <pre className="text-white/80">{citiesError.message}</pre>;
  }

  if (mosquesError) {
    return <pre className="text-white/80">{mosquesError.message}</pre>;
  }

  if (businessesError) {
    return <pre className="text-white/80">{businessesError.message}</pre>;
  }

  const cityList = (cities ?? []) as CityRow[];
  const mosqueList = (mosques ?? []) as MosqueRow[];
  const businessList = (businesses ?? []) as BusinessRow[];

  const selectedCity = selectedCitySlug
    ? cityList.find((c) => c.slug === selectedCitySlug) ?? null
    : null;

  const filteredMosques = selectedCity
    ? mosqueList.filter((m) => m.city === selectedCity.name)
    : mosqueList;

  const filteredBusinesses = selectedCity
    ? businessList.filter((b) => b.city === selectedCity.name)
    : businessList;

  const selectedMosque = selectedMosqueId
    ? mosqueList.find((m) => m.id === selectedMosqueId) ?? null
    : null;

  const selectedBusiness = selectedBusinessId
    ? businessList.find((b) => b.id === selectedBusinessId) ?? null
    : null;

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
        <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
          Advertising Setup
        </div>

        <h1 className="mt-3 text-4xl font-bold text-white">
          Promote your halal business
        </h1>

        <p className="mt-3 max-w-3xl text-white/70">
          Choose a city, mosque, or business path to start a sponsored placement
          on SalahNearMe.
        </p>

        <div className="mt-6">
          <Link
            href="/businesses"
            className="text-sm font-medium text-yellow-400 hover:text-yellow-300"
          >
            ← Back to businesses
          </Link>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
          <div className="text-xl font-semibold text-yellow-400">
            Cities
          </div>
          <div className="mt-4 space-y-3">
            {cityList.length === 0 ? (
              <div className="text-white/60">No active cities found.</div>
            ) : (
              cityList.map((city) => (
                <Link
                  key={city.id}
                  href={`/advertise/setup?city=${city.slug}`}
                  className={`block rounded-2xl border p-4 transition ${
                    selectedCitySlug === city.slug
                      ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-400"
                      : "border-white/10 bg-black/30 text-white hover:border-yellow-500/30"
                  }`}
                >
                  {city.name}
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
          <div className="text-xl font-semibold text-yellow-400">
            Mosques
          </div>
          <div className="mt-4 space-y-3">
            {filteredMosques.length === 0 ? (
              <div className="text-white/60">No mosques found.</div>
            ) : (
              filteredMosques.slice(0, 100).map((mosque) => (
                <Link
                  key={mosque.id}
                  href={`/sponsor/mosque/${mosque.slug}`}
                  className={`block rounded-2xl border p-4 transition ${
                    selectedMosqueId === mosque.id
                      ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-400"
                      : "border-white/10 bg-black/30 text-white hover:border-yellow-500/30"
                  }`}
                >
                  <div className="font-semibold">{mosque.name}</div>
                  <div className="mt-1 text-sm text-white/60">
                    {[mosque.area, mosque.city, mosque.postcode]
                      .filter(Boolean)
                      .join(" • ")}
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
          <div className="text-xl font-semibold text-yellow-400">
            Businesses
          </div>
          <div className="mt-4 space-y-3">
            {filteredBusinesses.length === 0 ? (
              <div className="text-white/60">No businesses found.</div>
            ) : (
              filteredBusinesses.slice(0, 100).map((business) => (
                <Link
                  key={business.id}
                  href={`/advertise?business=${business.id}`}
                  className={`block rounded-2xl border p-4 transition ${
                    selectedBusinessId === business.id
                      ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-400"
                      : "border-white/10 bg-black/30 text-white hover:border-yellow-500/30"
                  }`}
                >
                  <div className="font-semibold">{business.name}</div>
                  <div className="mt-1 text-sm text-white/60">
                    {[business.category, business.city]
                      .filter(Boolean)
                      .join(" • ")}
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </section>

      {(selectedCity || selectedMosque || selectedBusiness) && (
        <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
          <div className="text-xl font-semibold text-yellow-400">
            Current selection
          </div>

          <div className="mt-4 space-y-2 text-white/80">
            <div>
              <span className="text-white/50">City:</span>{" "}
              {selectedCity?.name ?? "—"}
            </div>
            <div>
              <span className="text-white/50">Mosque:</span>{" "}
              {selectedMosque?.name ?? "—"}
            </div>
            <div>
              <span className="text-white/50">Business:</span>{" "}
              {selectedBusiness?.name ?? "—"}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

