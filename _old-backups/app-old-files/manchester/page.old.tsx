import Link from "next/link";

export default function ManchesterHub() {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-[rgb(var(--card))] p-8">
        <h1 className="text-2xl font-semibold">Manchester</h1>
        <p className="mt-2 text-white/70">
          Find mosques, see Friday guidance, and community signals — calmly.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/manchester/mosques" className="rounded-xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-neutral-950 hover:opacity-90">
            View mosques
          </Link>
          <Link href="/manchester/businesses" className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold hover:bg-white/10">
            Halal businesses
          </Link>
        </div>
      </section>
    </div>
  );
}

