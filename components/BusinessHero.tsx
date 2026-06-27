export default function BusinessHero() {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-yellow-500/30 bg-black px-6 py-14 md:px-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.16),transparent_45%)]" />

      <div className="relative mx-auto max-w-6xl">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <div className="inline-flex rounded-full border border-yellow-500/30 bg-yellow-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-yellow-400">
              Advertise on SalahNearMe
            </div>

            <h1 className="mt-5 text-4xl font-bold tracking-tight text-white md:text-6xl">
              Put your halal business in front of Muslims near you
            </h1>

            <p className="mt-5 max-w-2xl text-base leading-7 text-white/70 md:text-lg">
              Get discovered by local customers searching for trusted halal
              businesses and nearby mosques. Feature your business, sponsor a
              mosque, and grow your visibility on SalahNearMe.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="/admin/businesses"
                className="rounded-2xl bg-yellow-500 px-5 py-3 text-sm font-semibold text-black transition hover:opacity-90"
              >
                Advertise your business
              </a>

              <a
                href="/halal-businesses"
                className="rounded-2xl border border-yellow-500/30 px-5 py-3 text-sm font-semibold text-yellow-400 transition hover:bg-yellow-500/10"
              >
                Explore listings
              </a>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-2xl font-semibold text-yellow-400">Top</div>
                <div className="mt-1 text-sm text-white/70">
                  Featured ranking visibility
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-2xl font-semibold text-yellow-400">30d</div>
                <div className="mt-1 text-sm text-white/70">
                  Premium listing period
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-2xl font-semibold text-yellow-400">Local</div>
                <div className="mt-1 text-sm text-white/70">
                  Reach customers nearby
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-yellow-500/20 bg-[linear-gradient(180deg,rgba(212,175,55,0.16),rgba(255,255,255,0.03))] p-6">
            <div className="rounded-3xl border border-white/10 bg-black/60 p-6 shadow-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-white/60">Featured Business</div>
                  <div className="mt-1 text-2xl font-bold text-white">
                    £25 / 30 days
                  </div>
                </div>
                <div className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-400">
                  Most popular
                </div>
              </div>

              <div className="mt-6 space-y-3 text-sm text-white/75">
                <div>• Appear in the featured ranking section</div>
                <div>• Stand out in halal business discovery</div>
                <div>• Build trust with a premium placement</div>
                <div>• Easy checkout and 30-day activation</div>
              </div>

              <a
                href="/admin/businesses"
                className="mt-8 inline-flex w-full items-center justify-center rounded-2xl bg-yellow-500 px-4 py-3 text-sm font-semibold text-black transition hover:opacity-90"
              >
                Start promoting now
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

