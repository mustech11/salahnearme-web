import Link from "next/link";

const FEATURES = [
  "Priority placement on supported listings",
  "Premium visibility across discovery journeys",
  "Straightforward campaign setup and activation",
] as const;

const STATS = [
  {
    value: "Top",
    label: "Featured ranking visibility",
  },
  {
    value: "30d",
    label: "Premium listing period",
  },
  {
    value: "Local",
    label: "Reach nearby Muslim customers",
  },
] as const;

export default function BusinessHero() {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-yellow-500/30 bg-black px-6 py-12 sm:px-8 md:px-10 md:py-16">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.18),transparent_46%)]"
      />

      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(135deg,transparent_20%,rgba(234,179,8,0.04),transparent_80%)]"
      />

      <div className="relative mx-auto max-w-6xl">
        <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <div className="inline-flex rounded-full border border-yellow-500/30 bg-yellow-500/10 px-4 py-1.5 text-xs font-black uppercase tracking-[0.2em] text-yellow-400">
              Advertise on SalahNearMe
            </div>

            <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-tight text-white sm:text-5xl md:text-6xl">
              Put your halal business in front of Muslims near you
            </h1>

            <p className="mt-5 max-w-2xl text-base leading-8 text-white/70 md:text-lg">
              Reach customers already searching for trusted halal businesses,
              nearby mosques and local services. Feature your listing, sponsor a
              mosque and grow your visibility across SalahNearMe.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/advertise"
                className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-yellow-500 px-5 py-3 text-sm font-black text-black transition hover:bg-yellow-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"
              >
                Advertise your business
              </Link>

              <Link
                href="/businesses"
                className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-yellow-500/30 px-5 py-3 text-sm font-black text-yellow-400 transition hover:bg-yellow-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"
              >
                Explore listings
              </Link>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {STATS.map((stat) => (
                <article
                  key={stat.label}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="text-2xl font-black text-yellow-400">
                    {stat.value}
                  </div>
                  <div className="mt-1 text-sm leading-6 text-white/70">
                    {stat.label}
                  </div>
                </article>
              ))}
            </div>
          </div>

          <aside className="rounded-3xl border border-yellow-500/20 bg-[linear-gradient(180deg,rgba(212,175,55,0.16),rgba(255,255,255,0.03))] p-4 sm:p-6">
            <div className="rounded-3xl border border-white/10 bg-black/70 p-6 shadow-2xl">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-sm text-white/60">
                    Featured business
                  </div>
                  <div className="mt-1 text-2xl font-black text-white">
                    Premium placement
                  </div>
                </div>

                <div className="w-fit rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-black text-yellow-400">
                  Most popular
                </div>
              </div>

              <div className="mt-6 space-y-4 text-sm text-white/75">
                {FEATURES.map((feature) => (
                  <div key={feature} className="flex gap-3">
                    <span
                      aria-hidden="true"
                      className="mt-1.5 size-2 shrink-0 rounded-full bg-yellow-400"
                    />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>

              <Link
                href="/advertise"
                className="mt-8 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-yellow-500 px-4 py-3 text-sm font-black text-black transition hover:bg-yellow-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"
              >
                Start promoting now
              </Link>

              <p className="mt-4 text-xs leading-5 text-white/40">
                Campaigns remain subject to eligibility, availability and
                content review.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}