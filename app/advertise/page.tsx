import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Advertise on SalahNearMe",
  description:
    "Promote your halal business across mosque pages, city listings, and multi-city campaigns on SalahNearMe.",
};

const packages = [
  {
    key: "city_featured",
    name: "Featured City Listing",
    price: "From £49",
    badge: "Best for one city",
    description:
      "Appear prominently on a city business page and increase visibility in local searches.",
    features: [
      "Featured badge",
      "Higher placement on city page",
      "Ideal for one city",
    ],
  },
  {
    key: "mosque_sponsor",
    name: "Sponsor a Mosque",
    price: "From £79",
    badge: "High intent audience",
    description:
      "Place your business on a specific mosque page and reach local visitors directly.",
    features: [
      "Shown on mosque page",
      "Supporting this mosque positioning",
      "Great for local footfall",
    ],
  },
  {
    key: "multi_mosque",
    name: "Multiple Mosque Sponsorship",
    price: "From £149",
    badge: "Scale locally",
    description:
      "Advertise across several mosque pages within the same city or selected areas.",
    features: [
      "Multiple mosque placements",
      "Broader audience reach",
      "Best for scaling locally",
    ],
  },
  {
    key: "multi_city",
    name: "Multi-City Campaign",
    price: "Custom",
    badge: "Growth package",
    description:
      "Run across selected cities and grow visibility for regional or national businesses.",
    features: [
      "Multiple city coverage",
      "Scalable campaign structure",
      "Best for growth brands",
    ],
  },
];

export default function AdvertisePage() {
  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8 md:p-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,0.16),transparent_36%)]" />

        <div className="relative z-10 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
              Advertising
            </div>

            <h1 className="mt-3 text-4xl font-bold text-white md:text-5xl">
              Grow your halal business with SalahNearMe
            </h1>

            <p className="mt-4 max-w-3xl text-white/70">
              Reach Muslims searching for mosques, halal businesses, and trusted
              local services. Advertise on city pages, mosque pages, or across
              multiple locations with premium placement.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/add-business"
                className="rounded-xl bg-yellow-500 px-5 py-3 text-sm font-semibold text-black hover:bg-yellow-400"
              >
                Add your business
              </Link>

              <Link
                href="/"
                className="rounded-xl border border-yellow-500/30 bg-black px-5 py-3 text-sm font-semibold text-yellow-400 hover:bg-yellow-500/10"
              >
                Back to homepage
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-yellow-500/20 bg-black/30 p-6">
            <div className="text-lg font-semibold text-yellow-400">
              Why advertise here?
            </div>

            <div className="mt-5 space-y-4 text-sm text-white/75">
              <div className="rounded-2xl border border-white/10 bg-[rgb(var(--card))] p-4">
                Reach people already searching for local mosques and halal
                services.
              </div>

              <div className="rounded-2xl border border-white/10 bg-[rgb(var(--card))] p-4">
                Place your business directly on mosque pages and city listings.
              </div>

              <div className="rounded-2xl border border-white/10 bg-[rgb(var(--card))] p-4">
                Support free mosque discovery while growing your visibility.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {packages.map((pkg) => (
          <div
            key={pkg.key}
            className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6 transition hover:border-yellow-400/40 hover:bg-yellow-500/[0.03]"
          >
            <div className="inline-block rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-400">
              {pkg.badge}
            </div>

            <div className="mt-4 text-lg font-semibold text-yellow-400">
              {pkg.name}
            </div>

            <div className="mt-3 text-3xl font-bold text-white">
              {pkg.price}
            </div>

            <p className="mt-3 text-sm text-white/70">{pkg.description}</p>

            <div className="mt-5 space-y-2">
              {pkg.features.map((feature) => (
                <div key={feature} className="text-sm text-white/80">
                  • {feature}
                </div>
              ))}
            </div>

            <div className="mt-6">
              <Link
                href={`/advertise/confirm?advertising=${pkg.key}`}
                className="inline-flex rounded-xl bg-yellow-500 px-4 py-3 text-sm font-semibold text-black hover:bg-yellow-400"
              >
                Choose this package
              </Link>
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
            <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
              Local reach
            </div>
            <div className="mt-3 text-lg font-semibold text-white">
              City-by-city visibility
            </div>
            <p className="mt-2 text-sm text-white/70">
              Appear where local users are actively searching.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
            <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
              Mosque support
            </div>
            <div className="mt-3 text-lg font-semibold text-white">
              Sponsor meaningful places
            </div>
            <p className="mt-2 text-sm text-white/70">
              Associate your business with trusted local mosque communities.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
            <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
              Growth model
            </div>
            <div className="mt-3 text-lg font-semibold text-white">
              Scale across cities
            </div>
            <p className="mt-2 text-sm text-white/70">
              Expand from one area to a wider multi-city campaign over time.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
        <div className="text-2xl font-semibold text-yellow-400">
          How ranking works
        </div>

        <p className="mt-3 max-w-3xl text-white/70">
          Placements are ordered by active advertising type, campaign scope,
          and placement level. This keeps listings structured and fair while
          allowing premium visibility for active sponsors.
        </p>
      </section>
    </div>
  );
}

