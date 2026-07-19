import type { Metadata } from "next";
import Link from "next/link";

import AddBusinessForm from "@/components/AddBusinessForm";
import { getSiteUrl } from "@/lib/env";

type AddBusinessPageSearchParams = {
  advertising?: string | string[];
};

const advertisingLabels: Record<string, string> = {
  city_featured: "Featured in a city",
  mosque_sponsor: "Sponsor a mosque",
  multi_mosque: "Sponsor multiple mosques",
  multi_city: "Advertise in multiple cities",
};

function getAdvertisingValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function formatAdvertisingType(value: string) {
  return advertisingLabels[value] ?? value;
}

export const metadata: Metadata = {
  title: "Add Your Halal Business | SalahNearMe",
  description:
    "Submit a halal restaurant, butcher, grocery shop, Islamic bookstore, Muslim-friendly service, clinic, charity, tuition centre, or travel business to SalahNearMe.",
  alternates: {
    canonical: `${getSiteUrl()}/add-business`,
  },
  openGraph: {
    title: "Add Your Halal Business | SalahNearMe",
    description:
      "List your halal business on SalahNearMe and help Muslims discover trusted local services near mosques and cities.",
    url: `${getSiteUrl()}/add-business`,
    siteName: "SalahNearMe",
    type: "website",
  },
};

export default async function AddBusinessPage({
  searchParams,
}: {
  searchParams: Promise<AddBusinessPageSearchParams>;
}) {
  const params = await searchParams;
  const advertising = getAdvertisingValue(params.advertising);

  const selectedAdvertisingLabel = advertising
    ? formatAdvertisingType(advertising)
    : "";

  return (
    <main className="space-y-10">
      <section className="relative overflow-hidden rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6 shadow-2xl shadow-black/30 md:p-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,0.18),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.08),transparent_35%)]" />

        <div className="relative z-10 grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-yellow-400">
              SalahNearMe business directory
            </p>

            <h1 className="mt-4 max-w-4xl text-4xl font-black leading-tight text-white md:text-6xl">
              Add your halal business to SalahNearMe
            </h1>

            <p className="mt-5 max-w-3xl text-base leading-8 text-white/75 md:text-lg">
              Help Muslims discover trusted halal restaurants, butchers,
              groceries, Islamic bookstores, clinics, charities, tuition
              centres, travel services, and Muslim-friendly local businesses.
            </p>

            {selectedAdvertisingLabel ? (
              <div className="mt-6 inline-flex rounded-full border border-yellow-400/30 bg-yellow-400/10 px-5 py-2 text-sm font-bold text-yellow-300">
                Selected interest: {selectedAdvertisingLabel}
              </div>
            ) : null}

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#business-form"
                className="rounded-2xl bg-yellow-400 px-6 py-3 text-sm font-black text-black transition hover:bg-yellow-300"
              >
                Submit business
              </a>

              <Link
                href="/businesses"
                className="rounded-2xl border border-yellow-500/30 px-6 py-3 text-sm font-black text-yellow-300 transition hover:border-yellow-400 hover:bg-yellow-400/10"
              >
                View directory
              </Link>

              <Link
                href="/advertise"
                className="rounded-2xl border border-white/10 px-6 py-3 text-sm font-black text-white/80 transition hover:border-white/20 hover:bg-white/5"
              >
                Advertising options
              </Link>
            </div>
          </div>

          <aside className="rounded-3xl border border-yellow-500/20 bg-black/30 p-6">
            <h2 className="text-2xl font-black text-yellow-400">
              Why list here?
            </h2>

            <div className="mt-5 space-y-4">
              {[
                {
                  title: "Reach Muslims nearby",
                  text: "Show your business to people searching by city, mosque area, travel route, and halal category.",
                },
                {
                  title: "Start with a free listing",
                  text: "Community listings can be reviewed before going live. Paid options can be added later.",
                },
                {
                  title: "Build trust",
                  text: "Verified details, photos, opening hours, call buttons, map links, and website links improve confidence.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-white/10 bg-[rgb(var(--card))] p-4"
                >
                  <div className="font-bold text-white">{item.title}</div>
                  <p className="mt-2 text-sm leading-6 text-white/65">
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        {[
          {
            step: "Step 1",
            title: "Submit details",
            text: "Send the business name, city, contact details, category, and useful notes.",
          },
          {
            step: "Step 2",
            title: "Admin review",
            text: "Listings are checked before publishing to protect users and keep the directory trustworthy.",
          },
          {
            step: "Step 3",
            title: "Grow visibility",
            text: "After approval, the business can be upgraded with media, verification, and advertising.",
          },
        ].map((item) => (
          <div
            key={item.step}
            className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6"
          >
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-yellow-400">
              {item.step}
            </p>
            <h2 className="mt-3 text-xl font-black text-white">
              {item.title}
            </h2>
            <p className="mt-3 text-sm leading-7 text-white/65">{item.text}</p>
          </div>
        ))}
      </section>

      <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6 md:p-8">
        <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-yellow-400">
              Good fit for
            </p>

            <h2 className="mt-3 text-3xl font-black text-white">
              Halal and Muslim-friendly services
            </h2>

            <p className="mt-4 text-sm leading-7 text-white/70">
              SalahNearMe is built for local Muslim discovery. Add businesses
              that genuinely serve the community and help people find halal,
              ethical, and useful services nearby.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              "Halal restaurants",
              "Halal takeaways",
              "Halal butchers",
              "Halal groceries",
              "Islamic bookstores",
              "Muslim clothing shops",
              "Dental clinics",
              "Travel and Umrah agents",
              "Tuition centres",
              "Charities",
              "Community services",
              "Muslim-friendly professionals",
            ].map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm font-semibold text-white/75"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="business-form"
        className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6 md:p-8"
      >
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-yellow-400">
            Submit listing
          </p>

          <h2 className="mt-3 text-3xl font-black text-white">
            Business submission form
          </h2>

          <p className="mt-3 text-sm leading-7 text-white/70">
            Fill in as much as possible. Your submission will be reviewed before
            publishing. Clear details make approval faster.
          </p>
        </div>

        <div className="mt-8">
          <AddBusinessForm initialAdvertisingType={advertising} />
        </div>
      </section>
    </main>
  );
}