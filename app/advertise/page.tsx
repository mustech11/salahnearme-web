import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Advertise on SalahNearMe | Halal Business Sponsorship",
  description:
    "Promote your halal business across SalahNearMe city pages, mosque pages, halal listings, and multi-city Muslim community campaigns.",
  alternates: {
    canonical: "/advertise",
  },
  openGraph: {
    title: "Advertise on SalahNearMe",
    description:
      "Reach Muslims searching for mosques, salah times, halal food, halal services, Muslim travel, Hajj and Umrah guidance.",
    url: "/advertise",
    siteName: "SalahNearMe",
    type: "website",
  },
};

type AdvertisingPackage = {
  key: string;
  name: string;
  price: string;
  badge: string;
  audience: string;
  description: string;
  features: string[];
  bestFor: string;
  href: string;
  highlighted?: boolean;
};

const packages: AdvertisingPackage[] = [
  {
    key: "city_featured",
    name: "Featured City Listing",
    price: "From £49",
    badge: "Best for one city",
    audience: "Local halal customers",
    description:
      "Increase visibility on a city halal business page where people are actively looking for local Muslim-friendly services.",
    features: [
      "Featured placement on selected city page",
      "Priority visibility above standard listings",
      "Suitable for restaurants, butchers, shops, clinics, tutors, and services",
      "Helps build local discovery and trust",
    ],
    bestFor: "A halal business serving one main city.",
    href: "/advertise/confirm?advertising=city_featured",
    highlighted: true,
  },
  {
    key: "mosque_sponsor",
    name: "Sponsor a Mosque",
    price: "From £79",
    badge: "High-intent audience",
    audience: "Mosque visitors nearby",
    description:
      "Place your business on a specific mosque page and reach users who are checking prayer times, mosque details, maps, and local services.",
    features: [
      "Placement on a selected mosque profile",
      "Useful for businesses close to a mosque",
      "Supports free mosque discovery on SalahNearMe",
      "Strong local relevance for regular visitors",
    ],
    bestFor: "A business near a mosque or serving that local community.",
    href: "/advertise/confirm?advertising=mosque_sponsor",
  },
  {
    key: "multi_mosque",
    name: "Multiple Mosque Sponsorship",
    price: "From £149",
    badge: "Scale locally",
    audience: "Several mosque communities",
    description:
      "Advertise across multiple mosque pages in one city or selected areas to reach a wider but still highly relevant Muslim audience.",
    features: [
      "Multiple mosque page placements",
      "Better reach across nearby communities",
      "Good for delivery, catering, education, clinics, and trades",
      "Flexible local campaign structure",
    ],
    bestFor: "Businesses wanting stronger city-wide local coverage.",
    href: "/advertise/confirm?advertising=multi_mosque",
  },
  {
    key: "multi_city",
    name: "Multi-City Campaign",
    price: "Custom",
    badge: "Growth package",
    audience: "Regional or national users",
    description:
      "Run visibility campaigns across selected UK cities, ideal for brands, franchises, online services, travel providers, and wider Muslim-focused businesses.",
    features: [
      "Coverage across multiple city pages",
      "Suitable for regional or national campaigns",
      "Flexible campaign planning",
      "Best for serious growth and brand visibility",
    ],
    bestFor: "Brands serving more than one city or operating online.",
    href: "/advertise/confirm?advertising=multi_city",
  },
];

const stats = [
  {
    label: "City visibility",
    value: "UK-wide",
    text: "Reach users browsing city pages for mosques, prayer times, and halal services.",
  },
  {
    label: "Mosque intent",
    value: "High trust",
    text: "Appear close to mosque discovery, salah-time searches, and local Muslim community activity.",
  },
  {
    label: "Business growth",
    value: "Scalable",
    text: "Start with one listing and expand into mosque, city, and multi-city campaigns.",
  },
];

const steps = [
  {
    title: "Choose a package",
    text: "Select city placement, mosque sponsorship, multi-mosque visibility, or a wider campaign.",
  },
  {
    title: "Submit your details",
    text: "Add your business information so the listing can be reviewed and prepared properly.",
  },
  {
    title: "Go live after review",
    text: "Approved campaigns can appear on relevant pages with clear, respectful visibility.",
  },
];

const faqs = [
  {
    question: "Is SalahNearMe only for restaurants?",
    answer:
      "No. SalahNearMe can list halal restaurants, takeaways, butchers, groceries, Islamic shops, education, clinics, travel services, charities, trades, and Muslim-friendly local businesses.",
  },
  {
    question: "Can I advertise near a specific mosque?",
    answer:
      "Yes. Mosque sponsorship is designed for businesses that want visibility on or around selected mosque pages.",
  },
  {
    question: "Can I start small?",
    answer:
      "Yes. A single city featured listing is the easiest starting point. You can later grow into mosque sponsorship or multi-city campaigns.",
  },
  {
    question: "Are listings reviewed?",
    answer:
      "Yes. Submissions and advertising requests should be reviewed before being treated as trusted or promoted listings.",
  },
];

function PackageCard({ pkg }: { pkg: AdvertisingPackage }) {
  return (
    <article
      className={[
        "flex h-full flex-col rounded-3xl border p-6 transition",
        pkg.highlighted
          ? "border-yellow-400/50 bg-yellow-500/[0.06] shadow-[0_0_40px_rgba(234,179,8,0.08)]"
          : "border-yellow-500/20 bg-[rgb(var(--card))] hover:border-yellow-400/40 hover:bg-yellow-500/[0.03]",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-400">
          {pkg.badge}
        </span>

        <span className="inline-flex rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs font-semibold text-white/65">
          {pkg.audience}
        </span>
      </div>

      <div className="mt-5 text-xl font-bold text-white">{pkg.name}</div>

      <div className="mt-3 text-3xl font-black text-yellow-400">
        {pkg.price}
      </div>

      <p className="mt-4 text-sm leading-6 text-white/70">{pkg.description}</p>

      <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4">
        <div className="text-xs uppercase tracking-[0.2em] text-yellow-400">
          Best for
        </div>
        <p className="mt-2 text-sm text-white/75">{pkg.bestFor}</p>
      </div>

      <ul className="mt-5 space-y-3 text-sm text-white/78">
        {pkg.features.map((feature) => (
          <li key={feature} className="flex gap-3">
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-yellow-400" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-6">
        <Link
          href={pkg.href}
          className={[
            "inline-flex w-full items-center justify-center rounded-2xl px-5 py-3 text-sm font-bold transition",
            pkg.highlighted
              ? "bg-yellow-500 text-black hover:bg-yellow-400"
              : "border border-yellow-500/30 bg-black/30 text-yellow-400 hover:bg-yellow-500/10",
          ].join(" ")}
        >
          Choose this package
        </Link>
      </div>
    </article>
  );
}

export default function AdvertisePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Advertise on SalahNearMe",
    description:
      "Advertising and sponsorship options for halal businesses on SalahNearMe.",
    url: "https://www.salahnearme.com/advertise",
    publisher: {
      "@type": "Organization",
      name: "SalahNearMe",
      url: "https://www.salahnearme.com",
    },
    mainEntity: packages.map((pkg) => ({
      "@type": "Service",
      name: pkg.name,
      description: pkg.description,
      offers: {
        "@type": "Offer",
        priceCurrency: "GBP",
        price: pkg.price.replace("From £", "").replace("Custom", "0"),
        availability: "https://schema.org/InStock",
      },
    })),
  };

  return (
    <div className="space-y-10">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd),
        }}
      />

      <section className="relative overflow-hidden rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8 md:p-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,0.18),transparent_34%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.08),transparent_34%)]" />

        <div className="relative z-10 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="text-sm uppercase tracking-[0.28em] text-yellow-400">
              Advertise on SalahNearMe
            </div>

            <h1 className="mt-4 max-w-5xl text-4xl font-black leading-tight text-white md:text-6xl">
              Reach Muslims searching for halal places near them
            </h1>

            <p className="mt-5 max-w-3xl text-lg leading-8 text-white/72">
              Promote your halal business across city pages, mosque pages, halal
              business listings, and future multi-city Muslim community
              campaigns. SalahNearMe connects users with prayer times, mosques,
              trusted local services, Hajj, Umrah, and Muslim travel guidance.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/add-business"
                className="rounded-2xl bg-yellow-500 px-6 py-4 text-sm font-bold text-black transition hover:bg-yellow-400"
              >
                Add your business
              </Link>

              <Link
                href="#packages"
                className="rounded-2xl border border-yellow-500/30 bg-black/30 px-6 py-4 text-sm font-bold text-yellow-400 transition hover:bg-yellow-500/10"
              >
                View packages
              </Link>

              <Link
                href="/businesses"
                className="rounded-2xl border border-white/10 bg-black/20 px-6 py-4 text-sm font-bold text-white/80 transition hover:border-white/20 hover:bg-white/5"
              >
                Browse directory
              </Link>
            </div>
          </div>

          <aside className="rounded-3xl border border-yellow-500/20 bg-black/30 p-6">
            <div className="text-2xl font-bold text-yellow-400">
              Why advertise here?
            </div>

            <div className="mt-5 space-y-4 text-sm text-white/75">
              <div className="rounded-2xl border border-white/10 bg-[rgb(var(--card))] p-4">
                <div className="font-semibold text-white">
                  Intent-driven visitors
                </div>
                <p className="mt-2 leading-6 text-white/65">
                  Users are already looking for mosques, prayer times, halal
                  food, shops, services, or Muslim-friendly places.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[rgb(var(--card))] p-4">
                <div className="font-semibold text-white">
                  Mosque and city relevance
                </div>
                <p className="mt-2 leading-6 text-white/65">
                  Your business can appear where it makes sense: near a mosque,
                  in a city, or across selected locations.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[rgb(var(--card))] p-4">
                <div className="font-semibold text-white">
                  Supports a community platform
                </div>
                <p className="mt-2 leading-6 text-white/65">
                  Advertising helps keep mosque discovery and community
                  information accessible.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        {stats.map((item) => (
          <div
            key={item.label}
            className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6"
          >
            <div className="text-sm uppercase tracking-[0.24em] text-yellow-400">
              {item.label}
            </div>
            <div className="mt-3 text-3xl font-black text-white">
              {item.value}
            </div>
            <p className="mt-3 text-sm leading-6 text-white/65">{item.text}</p>
          </div>
        ))}
      </section>

      <section id="packages" className="space-y-5">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <div className="text-sm uppercase tracking-[0.26em] text-yellow-400">
              Advertising packages
            </div>
            <h2 className="mt-3 text-3xl font-black text-white md:text-4xl">
              Choose the right visibility level
            </h2>
            <p className="mt-3 max-w-3xl text-white/65">
              Start with one city, sponsor a mosque, or scale across multiple
              locations as SalahNearMe grows.
            </p>
          </div>

          <Link
            href="/add-business"
            className="inline-flex rounded-2xl border border-yellow-500/30 bg-yellow-500/10 px-5 py-3 text-sm font-bold text-yellow-400 transition hover:bg-yellow-500/15"
          >
            Submit listing first
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {packages.map((pkg) => (
            <PackageCard key={pkg.key} pkg={pkg} />
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
        <div className="grid gap-6 md:grid-cols-3">
          {steps.map((step, index) => (
            <div
              key={step.title}
              className="rounded-2xl border border-white/10 bg-black/30 p-5"
            >
              <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
                Step {index + 1}
              </div>
              <div className="mt-3 text-lg font-bold text-white">
                {step.title}
              </div>
              <p className="mt-2 text-sm leading-6 text-white/70">
                {step.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
          <div className="text-sm uppercase tracking-[0.26em] text-yellow-400">
            Fair visibility
          </div>

          <h2 className="mt-3 text-3xl font-black text-white">
            How ranking works
          </h2>

          <p className="mt-4 leading-7 text-white/70">
            Sponsored and featured placements can receive higher visibility, but
            SalahNearMe should remain structured, respectful, and useful for the
            community. The goal is to help users discover relevant halal
            businesses without turning mosque and prayer pages into distracting
            advertising spaces.
          </p>

          <div className="mt-6 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-5 text-sm leading-6 text-yellow-100">
            Premium placement should be clear, ethical, and relevant to the page
            where it appears.
          </div>
        </div>

        <div className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
          <div className="text-sm uppercase tracking-[0.26em] text-yellow-400">
            Good fit businesses
          </div>

          <h2 className="mt-3 text-3xl font-black text-white">
            Who should advertise?
          </h2>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {[
              "Halal restaurants",
              "Halal takeaways",
              "Halal butchers",
              "Halal groceries",
              "Islamic bookshops",
              "Muslim clothing shops",
              "Tuition centres",
              "Dental and health clinics",
              "Travel and Umrah services",
              "Charities and community services",
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

      <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
        <div className="text-sm uppercase tracking-[0.26em] text-yellow-400">
          Questions
        </div>

        <h2 className="mt-3 text-3xl font-black text-white">
          Advertising FAQ
        </h2>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {faqs.map((faq) => (
            <div
              key={faq.question}
              className="rounded-2xl border border-white/10 bg-black/25 p-5"
            >
              <h3 className="font-bold text-white">{faq.question}</h3>
              <p className="mt-3 text-sm leading-6 text-white/68">
                {faq.answer}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="relative overflow-hidden rounded-3xl border border-yellow-500/20 bg-yellow-500 p-8 text-black md:p-10">
        <div className="max-w-4xl">
          <div className="text-sm uppercase tracking-[0.24em] font-black">
            Ready to grow?
          </div>

          <h2 className="mt-3 text-3xl font-black md:text-5xl">
            Put your halal business where Muslims are already searching.
          </h2>

          <p className="mt-4 max-w-3xl text-base font-semibold text-black/75">
            Submit your listing first. Then choose whether you want standard
            visibility, city promotion, mosque sponsorship, or a wider campaign.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/add-business"
              className="rounded-2xl bg-black px-6 py-4 text-sm font-bold text-yellow-400 transition hover:bg-neutral-900"
            >
              Add your business
            </Link>

            <Link
              href="/advertise/confirm?advertising=city_featured"
              className="rounded-2xl border border-black/20 bg-white/30 px-6 py-4 text-sm font-bold text-black transition hover:bg-white/45"
            >
              Start with city featured
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}