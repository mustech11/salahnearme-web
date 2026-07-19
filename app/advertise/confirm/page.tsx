import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import AdvertisingCheckoutButton from "@/components/AdvertisingCheckoutButton";

export const metadata: Metadata = {
  title: "Confirm Advertising Package | SalahNearMe",
  description:
    "Review your selected SalahNearMe advertising package before business submission, campaign setup, and paid placement.",
  alternates: {
    canonical: "/advertise/confirm",
  },
};

type SearchParams = Promise<{
  advertising?: string;
  business?: string;
  business_id?: string;
}>;

type AdvertisingPackage = {
  name: string;
  price: string;
  badge: string;
  description: string;
  features: string[];
  bestFor: string;
  paymentMode: "instant_checkout" | "custom_setup";
};

const packageMap = {
  city_featured: {
    name: "Featured City Listing",
    price: "From £49",
    badge: "Best for one city",
    description:
      "Appear prominently on a city business page and increase visibility in local halal searches.",
    features: [
      "Featured badge on selected city page",
      "Higher placement above standard listings",
      "Ideal for one city or local area",
      "Good for restaurants, butchers, shops, clinics, tutors, and services",
    ],
    bestFor: "A business serving one main city.",
    paymentMode: "instant_checkout",
  },
  mosque_sponsor: {
    name: "Sponsor a Mosque",
    price: "From £79",
    badge: "High-intent local audience",
    description:
      "Place your business on a specific mosque page and reach users checking prayer times, maps, mosque information, and nearby services.",
    features: [
      "Placement on a selected mosque page",
      "Strong local relevance",
      "Supports free mosque discovery",
      "Useful for businesses close to a mosque community",
    ],
    bestFor: "A business near a mosque or serving that local Muslim community.",
    paymentMode: "instant_checkout",
  },
  multi_mosque: {
    name: "Multiple Mosque Sponsorship",
    price: "From £149",
    badge: "Scale locally",
    description:
      "Advertise across several mosque pages within one city or selected nearby areas.",
    features: [
      "Multiple mosque page placements",
      "Broader local reach",
      "Good for delivery, catering, education, clinics, and trades",
      "Better city-wide visibility",
    ],
    bestFor: "Businesses wanting stronger local coverage.",
    paymentMode: "instant_checkout",
  },
  multi_city: {
    name: "Multi-City Campaign",
    price: "Custom",
    badge: "Growth campaign",
    description:
      "Run across selected UK cities and grow visibility for regional or national halal brands.",
    features: [
      "Multiple city coverage",
      "Flexible campaign structure",
      "Best for regional or national businesses",
      "Manual setup and pricing discussion required",
    ],
    bestFor: "Brands, franchises, online services, and wider campaigns.",
    paymentMode: "custom_setup",
  },
} as const satisfies Record<string, AdvertisingPackage>;

type AdvertisingKey = keyof typeof packageMap;

function clean(value: string | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function isAdvertisingKey(value: string): value is AdvertisingKey {
  return value in packageMap;
}

function buildSetupHref(advertising: AdvertisingKey, businessId: string) {
  const params = new URLSearchParams();

  params.set("advertising", advertising);

  if (businessId) {
    params.set("business", businessId);
  }

  return `/advertise/setup?${params.toString()}`;
}

function buildAddBusinessHref(advertising: AdvertisingKey) {
  const params = new URLSearchParams();
  params.set("advertising", advertising);

  return `/add-business?${params.toString()}`;
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

  const addBusinessHref = buildAddBusinessHref(advertising);
  const setupHref = buildSetupHref(advertising, businessId);

  const canCheckoutNow =
    pkg.paymentMode === "instant_checkout" && businessId.length > 0;

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8 md:p-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,0.18),transparent_36%)]" />

        <div className="relative z-10 grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <div className="text-sm uppercase tracking-[0.26em] text-yellow-400">
              Confirm Advertising Package
            </div>

            <h1 className="mt-4 text-4xl font-black leading-tight text-white md:text-6xl">
              {pkg.name}
            </h1>

            <p className="mt-5 max-w-3xl text-lg leading-8 text-white/72">
              Review this advertising option before connecting it to a business,
              setting up the campaign, and moving into payment.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-sm font-bold text-yellow-400">
                {pkg.price}
              </span>

              <span className="rounded-full border border-white/10 bg-black/30 px-4 py-2 text-sm font-semibold text-white/70">
                {pkg.badge}
              </span>
            </div>
          </div>

          <div className="rounded-3xl border border-yellow-500/20 bg-black/30 p-6">
            <div className="text-sm uppercase tracking-[0.24em] text-yellow-400">
              Best for
            </div>

            <p className="mt-4 text-lg font-semibold leading-7 text-white">
              {pkg.bestFor}
            </p>

            <div className="mt-6 rounded-2xl border border-white/10 bg-[rgb(var(--card))] p-4 text-sm leading-6 text-white/65">
              {pkg.paymentMode === "custom_setup"
                ? "This package requires campaign setup before payment."
                : "This package can move to Stripe checkout after a business is selected."}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <div className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
          <div className="text-2xl font-bold text-yellow-400">
            Package overview
          </div>

          <p className="mt-4 leading-7 text-white/70">{pkg.description}</p>

          <div className="mt-6 space-y-3">
            {pkg.features.map((feature) => (
              <div
                key={feature}
                className="flex gap-3 rounded-2xl border border-white/10 bg-black/30 p-4 text-white/80"
              >
                <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-yellow-400" />
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
          <div className="text-2xl font-bold text-yellow-400">Next steps</div>

          <div className="mt-5 space-y-4">
            {[
              "Select or submit the business you want to advertise.",
              "Configure the city, mosque, or campaign scope.",
              "Complete payment or submit a custom campaign request.",
              "Placement is activated after review and setup.",
            ].map((step, index) => (
              <div
                key={step}
                className="rounded-2xl border border-white/10 bg-black/30 p-4"
              >
                <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
                  Step {index + 1}
                </div>
                <div className="mt-2 text-sm leading-6 text-white/75">
                  {step}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {canCheckoutNow ? (
              <AdvertisingCheckoutButton
                advertisingType={advertising}
                businessId={businessId}
                label="Continue to payment"
              />
            ) : (
              <Link
                href={setupHref}
                className="rounded-xl bg-yellow-500 px-5 py-3 text-sm font-bold text-black hover:bg-yellow-400"
              >
                Configure campaign first
              </Link>
            )}

            <Link
              href={addBusinessHref}
              className="rounded-xl border border-yellow-500/30 bg-black px-5 py-3 text-sm font-bold text-yellow-400 hover:bg-yellow-500/10"
            >
              Submit business first
            </Link>

            <Link
              href={setupHref}
              className="rounded-xl border border-yellow-500/30 bg-black px-5 py-3 text-sm font-bold text-yellow-400 hover:bg-yellow-500/10"
            >
              Setup campaign
            </Link>

            <Link
              href="/advertise"
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white/80 hover:bg-white/10"
            >
              Back to packages
            </Link>
          </div>

          {!businessId && pkg.paymentMode === "instant_checkout" && (
            <div className="mt-5 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm leading-6 text-yellow-100">
              Select or submit a business before payment. This prevents payment
              being taken without knowing which listing should receive the
              advertising placement.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}