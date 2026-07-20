import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Payment Cancelled | SalahNearMe",
  description:
    "Your SalahNearMe payment was cancelled. You can safely try again or return to your dashboard.",
  robots: {
    index: false,
    follow: false,
  },
};

type SearchParams = Promise<{
  type?: string;
  advertising?: string;
  business?: string;
  business_id?: string;
  campaign_id?: string;
}>;

function clean(value: string | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function buildRetryHref(params: {
  type: string;
  advertising: string;
  businessId: string;
  campaignId: string;
}) {
  if (params.advertising) {
    const query = new URLSearchParams({
      advertising: params.advertising,
    });

    if (params.businessId) {
      query.set("business", params.businessId);
    }

    return `/advertise/confirm?${query.toString()}`;
  }

  if (params.campaignId) {
    return `/advertise/setup?campaign=${encodeURIComponent(params.campaignId)}`;
  }

  if (params.type === "advertising") {
    return "/advertise";
  }

  return "/advertise";
}

export default async function PaymentCancelPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;

  const type = clean(params.type);
  const advertising = clean(params.advertising);
  const businessId = clean(params.business_id || params.business);
  const campaignId = clean(params.campaign_id);

  const retryHref = buildRetryHref({
    type,
    advertising,
    businessId,
    campaignId,
  });

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <section className="relative overflow-hidden rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8 md:p-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,0.16),transparent_36%)]" />

        <div className="relative z-10">
          <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
            Payment Cancelled
          </div>

          <h1 className="mt-3 text-4xl font-bold text-white md:text-5xl">
            No payment was taken
          </h1>

          <p className="mt-4 max-w-3xl text-white/70">
            Your checkout was cancelled safely. Your business listing or
            advertising setup has not been charged. You can return to the
            package page, choose another option, or try checkout again.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
              <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
                Status
              </div>
              <div className="mt-3 text-lg font-semibold text-white">
                Cancelled
              </div>
              <p className="mt-2 text-sm text-white/60">
                Stripe checkout was closed before payment was completed.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
              <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
                Charge
              </div>
              <div className="mt-3 text-lg font-semibold text-white">
                £0 charged
              </div>
              <p className="mt-2 text-sm text-white/60">
                No successful payment has been confirmed for this checkout.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
              <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
                Next
              </div>
              <div className="mt-3 text-lg font-semibold text-white">
                Try again
              </div>
              <p className="mt-2 text-sm text-white/60">
                You can restart the advertising or sponsorship setup any time.
              </p>
            </div>
          </div>

          {(advertising || businessId || campaignId) && (
            <div className="mt-8 rounded-2xl border border-white/10 bg-black/30 p-5 text-sm text-white/70">
              <div className="font-semibold text-white">
                Checkout reference
              </div>

              <div className="mt-3 grid gap-2 md:grid-cols-3">
                <div>
                  <span className="text-white/45">Package:</span>{" "}
                  <span className="text-white">{advertising || "—"}</span>
                </div>

                <div>
                  <span className="text-white/45">Business:</span>{" "}
                  <span className="text-white">{businessId || "—"}</span>
                </div>

                <div>
                  <span className="text-white/45">Campaign:</span>{" "}
                  <span className="text-white">{campaignId || "—"}</span>
                </div>
              </div>
            </div>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={retryHref}
              className="rounded-xl bg-yellow-500 px-5 py-3 text-sm font-semibold text-black hover:bg-yellow-400"
            >
              Try again
            </Link>

            <Link
              href="/advertise"
              className="rounded-xl border border-yellow-500/30 bg-black px-5 py-3 text-sm font-semibold text-yellow-400 hover:bg-yellow-500/10"
            >
              View packages
            </Link>

            <Link
              href="/businesses"
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/80 hover:bg-white/10"
            >
              Browse businesses
            </Link>

            <Link
              href="/"
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/80 hover:bg-white/10"
            >
              Back home
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}