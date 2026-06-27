import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import AdvertisingCheckoutButton from "@/components/AdvertisingCheckoutButton";

export const metadata: Metadata = {
  title: "Confirm Advertising Package | SalahNearMe",
  description:
    "Review your selected SalahNearMe advertising package before submitting your business and moving into paid placement.",
};

type SearchParams = Promise<{
  advertising?: string;
  business?: string;
  business_id?: string;
}>;

const packageMap = {
  city_featured: {
    name: "Featured City Listing",
    price: "From £49",
    description:
      "Appear prominently on a city business page and increase visibility in local searches.",
    features: [
      "Featured badge",
      "Higher placement on city page",
      "Best for a single city launch",
    ],
  },
  mosque_sponsor: {
    name: "Sponsor a Mosque",
    price: "From £79",
    description:
      "Place your business on a specific mosque page and reach local visitors directly.",
    features: [
      "Shown on a mosque page",
      "Supporting this mosque positioning",
      "Strong local relevance",
    ],
  },
  multi_mosque: {
    name: "Multiple Mosque Sponsorship",
    price: "From £149",
    description:
      "Advertise across several mosque pages within one city or selected nearby areas.",
    features: [
      "Multiple mosque placements",
      "Broader local reach",
      "Ideal for businesses scaling within a region",
    ],
  },
  multi_city: {
    name: "Multi-City Campaign",
    price: "Custom",
    description:
      "Run across selected cities and grow visibility for regional or national halal brands.",
    features: [
      "Multiple city coverage",
      "Higher growth potential",
      "Best for established businesses",
    ],
  },
} as const;

type AdvertisingKey = keyof typeof packageMap;

function isAdvertisingKey(value: string | undefined): value is AdvertisingKey {
  return Boolean(value && value in packageMap);
}

function clean(value: string | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

export default async function AdvertiseConfirmPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;

  const advertising = clean(params.advertising);
  const businessId = clean(params.business_id || params.business);

  if (!isAdvertisingKey(advertising)) {
    notFound();
  }

  const pkg = packageMap[advertising];

  const addBusinessHref = `/add-business?advertising=${encodeURIComponent(
    advertising
  )}`;

  const setupHref = `/advertise/setup?advertising=${encodeURIComponent(
    advertising
  )}${businessId ? `&business=${encodeURIComponent(businessId)}` : ""}`;

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8 md:p-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,0.16),transparent_36%)]" />

        <div className="relative z-10">
          <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
            Confirm Package
          </div>

          <h1 className="mt-3 text-4xl font-bold text-white md:text-5xl">
            {pkg.name}
          </h1>

          <p className="mt-4 max-w-3xl text-white/70">
            Review your selected advertising option before moving into payment
            and business submission.
          </p>

          <div className="mt-6 inline-block rounded-full border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-sm font-semibold text-yellow-400">
            {pkg.price}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <div className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
          <div className="text-2xl font-semibold text-yellow-400">
            Package overview
          </div>

          <p className="mt-3 text-white/70">{pkg.description}</p>

          <div className="mt-6 space-y-3">
            {pkg.features.map((feature) => (
              <div
                key={feature}
                className="rounded-2xl border border-white/10 bg-black/30 p-4 text-white/80"
              >
                {feature}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
          <div className="text-2xl font-semibold text-yellow-400">
            Next steps
          </div>

          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
                Step 1
              </div>
              <div className="mt-2 text-white/80">
                Select or submit the business you want to advertise.
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
                Step 2
              </div>
              <div className="mt-2 text-white/80">
                Complete payment for your selected package.
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
                Step 3
              </div>
              <div className="mt-2 text-white/80">
                We activate the placement once the setup is complete.
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <AdvertisingCheckoutButton
              advertisingType={advertising}
              businessId={businessId || null}
              label="Continue to payment"
            />

            <Link
              href={addBusinessHref}
              className="rounded-xl border border-yellow-500/30 bg-black px-5 py-3 text-sm font-semibold text-yellow-400 hover:bg-yellow-500/10"
            >
              Submit business first
            </Link>

            <Link
              href={setupHref}
              className="rounded-xl border border-yellow-500/30 bg-black px-5 py-3 text-sm font-semibold text-yellow-400 hover:bg-yellow-500/10"
            >
              Configure campaign first
            </Link>

            <Link
              href="/advertise"
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/80 hover:bg-white/10"
            >
              Back to packages
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}