import BusinessReviewQueueClient from "@/components/BusinessReviewQueueClient";

export const revalidate = 0;

export default function BusinessReviewPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
        <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
          Admin
        </div>

        <h1 className="mt-3 text-4xl font-bold text-white">
          Business Review Queue
        </h1>

        <p className="mt-3 max-w-3xl text-white/70">
          Review imported halal businesses, approve trusted entries, reject weak
          matches, fix categories, and control what appears live on SalahNearMe.
        </p>
      </section>

      <BusinessReviewQueueClient />
    </div>
  );
}

