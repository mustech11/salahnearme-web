import type { Metadata } from "next";
import Link from "next/link";

import { supabasePublic } from "@/lib/supabaseServer";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Advertising Setup | SalahNearMe",
  description:
    "Choose a city, mosque, or business for your SalahNearMe advertising campaign.",
  alternates: {
    canonical: "/advertise/setup",
  },
};

type SearchParams = Promise<{
  advertising?: string;
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
  is_verified: boolean | null;
};

const advertisingLabels: Record<string, string> = {
  city_featured: "Featured City Listing",
  mosque_sponsor: "Sponsor a Mosque",
  multi_mosque: "Multiple Mosque Sponsorship",
  multi_city: "Multi-City Campaign",
};

function clean(value: string | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function withParams(
  basePath: string,
  params: Record<string, string | number | null | undefined>
) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && String(value).trim()) {
      search.set(key, String(value));
    }
  }

  const query = search.toString();

  return query ? `${basePath}?${query}` : basePath;
}

function displayValue(value: string | null | undefined) {
  return value?.trim() || "—";
}

export default async function AdvertiseSetupPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const selectedAdvertising = clean(params.advertising);
  const selectedCitySlug = clean(params.city);
  const selectedMosqueId = clean(params.mosque);
  const selectedBusinessId = clean(params.business);

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
      .order("name", { ascending: true })
      .limit(1000),

    supabase
      .from("businesses")
      .select("id,name,slug,category,city,featured,is_verified")
      .or("status.eq.approved,review_status.eq.approved")
      .order("featured", { ascending: false })
      .order("name", { ascending: true })
      .limit(1000),
  ]);

  const setupError =
    citiesError?.message ?? mosquesError?.message ?? businessesError?.message;

  const cityList = ((cities ?? []) as CityRow[]).filter(
    (city) => city.name && city.slug
  );

  const mosqueList = ((mosques ?? []) as MosqueRow[]).filter(
    (mosque) => mosque.id && mosque.name
  );

  const businessList = ((businesses ?? []) as BusinessRow[]).filter(
    (business) => business.id && business.name
  );

  const selectedCity = selectedCitySlug
    ? cityList.find((city) => city.slug === selectedCitySlug) ?? null
    : null;

  const filteredMosques = selectedCity
    ? mosqueList.filter(
        (mosque) =>
          mosque.city?.toLowerCase() === selectedCity.name.toLowerCase()
      )
    : mosqueList;

  const filteredBusinesses = selectedCity
    ? businessList.filter(
        (business) =>
          business.city?.toLowerCase() === selectedCity.name.toLowerCase()
      )
    : businessList;

  const selectedMosque = selectedMosqueId
    ? mosqueList.find((mosque) => mosque.id === selectedMosqueId) ?? null
    : null;

  const selectedBusiness = selectedBusinessId
    ? businessList.find((business) => business.id === selectedBusinessId) ??
      null
    : null;

  const selectedPackageLabel =
    advertisingLabels[selectedAdvertising] ?? "No package selected";

  const confirmHref = selectedAdvertising
    ? withParams("/advertise/confirm", {
        advertising: selectedAdvertising,
        business: selectedBusinessId,
      })
    : "/advertise";

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8 md:p-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,0.16),transparent_36%)]" />

        <div className="relative z-10 grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <div className="text-sm uppercase tracking-[0.26em] text-yellow-400">
              Advertising Setup
            </div>

            <h1 className="mt-4 text-4xl font-black text-white md:text-6xl">
              Promote your halal business
            </h1>

            <p className="mt-5 max-w-3xl text-lg leading-8 text-white/72">
              Choose the city, mosque, and business linked to your campaign.
              This helps SalahNearMe place your advert in the most relevant
              location.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/advertise"
                className="rounded-2xl border border-yellow-500/30 bg-black/30 px-5 py-3 text-sm font-bold text-yellow-400 hover:bg-yellow-500/10"
              >
                Back to packages
              </Link>

              <Link
                href="/add-business"
                className="rounded-2xl bg-yellow-500 px-5 py-3 text-sm font-bold text-black hover:bg-yellow-400"
              >
                Add new business
              </Link>
            </div>
          </div>

          <aside className="rounded-3xl border border-yellow-500/20 bg-black/30 p-6">
            <div className="text-sm uppercase tracking-[0.22em] text-yellow-400">
              Current package
            </div>

            <div className="mt-3 text-2xl font-black text-white">
              {selectedPackageLabel}
            </div>

            <div className="mt-5 space-y-3 text-sm text-white/75">
              <div className="rounded-2xl border border-white/10 bg-[rgb(var(--card))] p-4">
                City: {selectedCity?.name ?? "Not selected"}
              </div>

              <div className="rounded-2xl border border-white/10 bg-[rgb(var(--card))] p-4">
                Mosque: {selectedMosque?.name ?? "Not selected"}
              </div>

              <div className="rounded-2xl border border-white/10 bg-[rgb(var(--card))] p-4">
                Business: {selectedBusiness?.name ?? "Not selected"}
              </div>
            </div>
          </aside>
        </div>
      </section>

      {setupError && (
        <section className="rounded-3xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-100">
          Could not load setup data: {setupError}
        </section>
      )}

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6">
          <div className="text-xl font-bold text-yellow-400">1. Choose city</div>

          <p className="mt-2 text-sm leading-6 text-white/60">
            Select the main city for the advertising placement.
          </p>

          <div className="mt-5 max-h-[650px] space-y-3 overflow-y-auto pr-2">
            {cityList.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-white/60">
                No active cities found.
              </div>
            ) : (
              cityList.map((city) => (
                <Link
                  key={city.id}
                  href={withParams("/advertise/setup", {
                    advertising: selectedAdvertising,
                    city: city.slug,
                    business: selectedBusinessId,
                  })}
                  className={[
                    "block rounded-2xl border p-4 transition",
                    selectedCitySlug === city.slug
                      ? "border-yellow-500/50 bg-yellow-500/10 text-yellow-400"
                      : "border-white/10 bg-black/30 text-white hover:border-yellow-500/30",
                  ].join(" ")}
                >
                  <div className="font-bold">{city.name}</div>
                  <div className="mt-1 text-xs text-white/45">
                    /{city.slug}
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6">
          <div className="text-xl font-bold text-yellow-400">
            2. Choose mosque
          </div>

          <p className="mt-2 text-sm leading-6 text-white/60">
            Optional for city campaigns. Required for mosque sponsorship.
          </p>

          <div className="mt-5 max-h-[650px] space-y-3 overflow-y-auto pr-2">
            {filteredMosques.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-white/60">
                No mosques found for this selection.
              </div>
            ) : (
              filteredMosques.slice(0, 150).map((mosque) => (
                <Link
                  key={mosque.id}
                  href={withParams("/advertise/setup", {
                    advertising: selectedAdvertising,
                    city: selectedCitySlug,
                    mosque: mosque.id,
                    business: selectedBusinessId,
                  })}
                  className={[
                    "block rounded-2xl border p-4 transition",
                    selectedMosqueId === mosque.id
                      ? "border-yellow-500/50 bg-yellow-500/10 text-yellow-400"
                      : "border-white/10 bg-black/30 text-white hover:border-yellow-500/30",
                  ].join(" ")}
                >
                  <div className="font-bold">{mosque.name}</div>
                  <div className="mt-1 text-sm text-white/60">
                    {[mosque.area, mosque.city, mosque.postcode]
                      .filter(Boolean)
                      .join(" • ") || "No location details"}
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6">
          <div className="text-xl font-bold text-yellow-400">
            3. Choose business
          </div>

          <p className="mt-2 text-sm leading-6 text-white/60">
            Select the business that should receive the advertising placement.
          </p>

          <div className="mt-5 max-h-[650px] space-y-3 overflow-y-auto pr-2">
            {filteredBusinesses.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-white/60">
                No approved businesses found for this selection.
              </div>
            ) : (
              filteredBusinesses.slice(0, 150).map((business) => (
                <Link
                  key={business.id}
                  href={withParams("/advertise/setup", {
                    advertising: selectedAdvertising,
                    city: selectedCitySlug,
                    mosque: selectedMosqueId,
                    business: business.id,
                  })}
                  className={[
                    "block rounded-2xl border p-4 transition",
                    selectedBusinessId === business.id
                      ? "border-yellow-500/50 bg-yellow-500/10 text-yellow-400"
                      : "border-white/10 bg-black/30 text-white hover:border-yellow-500/30",
                  ].join(" ")}
                >
                  <div className="font-bold">{business.name}</div>
                  <div className="mt-1 text-sm text-white/60">
                    {[business.category, business.city]
                      .filter(Boolean)
                      .join(" • ") || "Business listing"}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {business.featured && (
                      <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2 py-1 text-xs text-yellow-400">
                        Featured
                      </span>
                    )}

                    {business.is_verified && (
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300">
                        Verified
                      </span>
                    )}
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
        <div className="text-sm uppercase tracking-[0.24em] text-yellow-400">
          Current selection
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-white/40">
              Package
            </div>
            <div className="mt-2 font-bold text-white">
              {selectedPackageLabel}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-white/40">
              City
            </div>
            <div className="mt-2 font-bold text-white">
              {displayValue(selectedCity?.name)}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-white/40">
              Mosque
            </div>
            <div className="mt-2 font-bold text-white">
              {displayValue(selectedMosque?.name)}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-white/40">
              Business
            </div>
            <div className="mt-2 font-bold text-white">
              {displayValue(selectedBusiness?.name)}
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={confirmHref}
            className="rounded-2xl bg-yellow-500 px-6 py-4 text-sm font-bold text-black hover:bg-yellow-400"
          >
            Continue to confirmation
          </Link>

          <Link
            href="/add-business"
            className="rounded-2xl border border-yellow-500/30 bg-black/30 px-6 py-4 text-sm font-bold text-yellow-400 hover:bg-yellow-500/10"
          >
            Add another business
          </Link>
        </div>
      </section>
    </div>
  );
}