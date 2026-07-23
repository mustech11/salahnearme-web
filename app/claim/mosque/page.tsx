import type { Metadata } from "next";

import ClaimMosqueSearchClient from "@/components/ClaimMosqueSearchClient";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    city?: string | string[];
    q?: string | string[];
  }>;
};

function firstValue(
  value: string | string[] | undefined
): string {
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }

  return value?.trim() ?? "";
}

function cleanSearchValue(
  value: string,
  maxLength: number
): string {
  return value
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, maxLength);
}

export const metadata: Metadata = {
  title: "Claim a Mosque | SalahNearMe",
  description:
    "Search for a mosque on SalahNearMe and submit a management claim request for verification.",
  alternates: {
    canonical: "/claim/mosque",
  },
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default async function ClaimMosqueLandingPage({
  searchParams,
}: PageProps) {
  const resolvedSearchParams = await searchParams;

  const initialCity = cleanSearchValue(
    firstValue(resolvedSearchParams.city),
    120
  );

  const initialQuery = cleanSearchValue(
    firstValue(resolvedSearchParams.q),
    160
  );

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[2rem] border border-yellow-500/20 bg-[#020826] p-8 md:p-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(212,175,55,0.14),transparent_34%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.05),transparent_38%)]" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-yellow-500/40 to-transparent" />

        <div className="relative z-10">
          <div className="text-sm font-semibold uppercase tracking-[0.3em] text-yellow-400">
            Mosque management
          </div>

          <h1 className="mt-4 max-w-5xl text-4xl font-black leading-tight tracking-tight text-white md:text-6xl">
            Claim a mosque page
          </h1>

          <p className="mt-5 max-w-3xl text-lg leading-8 text-white/70">
            Search for your mosque, open its claim page and submit your
            management verification request. Approved managers can maintain
            prayer times, iqamah times, Jumu’ah sessions and public mosque
            information.
          </p>

          <div className="mt-7 grid gap-3 text-sm text-white/65 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="font-bold text-yellow-400">1. Find</div>
              <p className="mt-2 leading-6">
                Search by mosque name, city, area or postcode.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="font-bold text-yellow-400">2. Verify</div>
              <p className="mt-2 leading-6">
                Explain your role and provide supporting information.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="font-bold text-yellow-400">3. Manage</div>
              <p className="mt-2 leading-6">
                Access mosque-management tools after approval.
              </p>
            </div>
          </div>
        </div>
      </section>

      <ClaimMosqueSearchClient
        initialCity={initialCity}
        initialQuery={initialQuery}
      />

      <section className="rounded-3xl border border-white/10 bg-[rgb(var(--card))] p-6 md:p-8">
        <h2 className="text-2xl font-black text-white">
          Cannot find your mosque?
        </h2>

        <p className="mt-3 max-w-3xl leading-7 text-white/65">
          Try searching using only part of the mosque name, its postcode, area
          or city. A dedicated new-mosque submission workflow will be added
          separately, so claims remain connected to existing verified records.
        </p>
      </section>
    </div>
  );
}