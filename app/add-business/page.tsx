import type { Metadata } from "next";
import AddBusinessForm from "@/components/AddBusinessForm";

export const metadata: Metadata = {
  title: "Add Your Business | SalahNearMe",
  description:
    "Submit your halal business to SalahNearMe and explore advertising opportunities across mosque pages and city listings.",
};

function formatAdvertisingType(value: string) {
  switch (value) {
    case "city_featured":
      return "Featured in a city";
    case "mosque_sponsor":
      return "Sponsor a mosque";
    case "multi_mosque":
      return "Sponsor multiple mosques";
    case "multi_city":
      return "Advertise in multiple cities";
    default:
      return value;
  }
}

export default async function AddBusinessPage({
  searchParams,
}: {
  searchParams: Promise<{ advertising?: string }>;
}) {
  const { advertising } = await searchParams;

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8 md:p-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,0.16),transparent_36%)]" />

        <div className="relative z-10 grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
              Add Business
            </div>

            <h1 className="mt-3 text-4xl font-bold text-white md:text-5xl">
              Add your halal business
            </h1>

            <p className="mt-4 max-w-3xl text-white/70">
              Submit your business to SalahNearMe so Muslims can discover your
              services. You can also request advertising across mosque pages,
              city listings, and future multi-location campaigns.
            </p>

            {advertising && (
              <div className="mt-5 inline-block rounded-full border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-sm font-semibold text-yellow-400">
                Selected package: {formatAdvertisingType(advertising)}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-yellow-500/20 bg-black/30 p-6">
            <div className="text-lg font-semibold text-yellow-400">
              Why list your business?
            </div>

            <div className="mt-5 space-y-4 text-sm text-white/75">
              <div className="rounded-2xl border border-white/10 bg-[rgb(var(--card))] p-4">
                Reach Muslims looking for trusted halal services nearby.
              </div>

              <div className="rounded-2xl border border-white/10 bg-[rgb(var(--card))] p-4">
                Advertise on mosque pages, city pages, or multiple locations.
              </div>

              <div className="rounded-2xl border border-white/10 bg-[rgb(var(--card))] p-4">
                Build local trust while supporting free mosque discovery.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
            <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
              Step 1
            </div>
            <div className="mt-3 text-lg font-semibold text-white">
              Submit your listing
            </div>
            <p className="mt-2 text-sm text-white/70">
              Enter your business details for review.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
            <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
              Step 2
            </div>
            <div className="mt-3 text-lg font-semibold text-white">
              Choose your visibility
            </div>
            <p className="mt-2 text-sm text-white/70">
              Request city, mosque, or wider campaign placement.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
            <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
              Step 3
            </div>
            <div className="mt-3 text-lg font-semibold text-white">
              Grow on SalahNearMe
            </div>
            <p className="mt-2 text-sm text-white/70">
              Reach more people across the Muslim community.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
        <div className="text-2xl font-semibold text-yellow-400">
          Business submission form
        </div>

        <p className="mt-2 text-white/70">
          Fill in the details below. Your submission will be reviewed before
          publishing.
        </p>

        <AddBusinessForm initialAdvertisingType={advertising ?? ""} />
      </section>
    </div>
  );
}

