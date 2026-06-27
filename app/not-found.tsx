import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6">
      <section className="luxe-card max-w-2xl rounded-3xl p-10 text-center">
        <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
          Error 404
        </div>

        <div className="dashboard-hero-glow mt-5 text-7xl font-black text-white">
          Page Not Found
        </div>

        <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-white/70">
          The page you are looking for may have moved,
          no longer exists, or has not yet been created.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link
            href="/"
            className="rounded-2xl bg-yellow-500 px-6 py-4 font-semibold text-black transition hover:bg-yellow-400"
          >
            Return Home
          </Link>

          <Link
            href="/travel"
            className="rounded-2xl border border-yellow-500/30 bg-black px-6 py-4 font-semibold text-yellow-400 hover:bg-yellow-500/10"
          >
            Explore Travel
          </Link>
        </div>
      </section>
    </div>
  );
}

