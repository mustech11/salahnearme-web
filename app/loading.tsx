export default function Loading() {
  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
        <div className="h-4 w-28 animate-pulse rounded bg-yellow-500/20" />
        <div className="mt-4 h-10 w-2/3 animate-pulse rounded bg-white/10" />
        <div className="mt-3 h-5 w-full max-w-2xl animate-pulse rounded bg-white/10" />
        <div className="mt-2 h-5 w-3/4 max-w-xl animate-pulse rounded bg-white/10" />

        <div className="mt-6 flex flex-wrap gap-3">
          <div className="h-11 w-40 animate-pulse rounded-xl bg-yellow-500/20" />
          <div className="h-11 w-44 animate-pulse rounded-xl bg-white/10" />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6">
          <div className="h-6 w-40 animate-pulse rounded bg-yellow-500/20" />
          <div className="mt-4 space-y-3">
            <div className="h-20 animate-pulse rounded-2xl bg-white/10" />
            <div className="h-20 animate-pulse rounded-2xl bg-white/10" />
            <div className="h-20 animate-pulse rounded-2xl bg-white/10" />
          </div>
        </div>

        <div className="rounded-2xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6">
          <div className="h-6 w-48 animate-pulse rounded bg-yellow-500/20" />
          <div className="mt-4 space-y-3">
            <div className="h-20 animate-pulse rounded-2xl bg-white/10" />
            <div className="h-20 animate-pulse rounded-2xl bg-white/10" />
            <div className="h-20 animate-pulse rounded-2xl bg-white/10" />
          </div>
        </div>
      </section>
    </div>
  );
}

