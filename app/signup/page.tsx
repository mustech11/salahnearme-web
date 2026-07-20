import type { Metadata } from "next";
import Link from "next/link";

import SignupForm from "@/components/auth/SignupForm";

export const metadata: Metadata = {
  title: "Create Account | SalahNearMe",
  description:
    "Create your SalahNearMe account to manage halal business listings, mosque claims, billing, sponsorships, and community submissions.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function SignupPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 py-10">
      <section className="relative overflow-hidden rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8 md:p-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,0.18),transparent_38%)]" />

        <div className="relative z-10 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
              SalahNearMe Account
            </div>

            <h1 className="mt-3 text-4xl font-black text-white md:text-5xl">
              Create your account
            </h1>

            <p className="mt-4 max-w-3xl text-white/70">
              Sign up to submit halal businesses, claim listings, manage
              sponsorships, review billing, and access future mosque or business
              dashboard tools.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="rounded-xl border border-yellow-500/30 bg-black px-5 py-3 text-sm font-semibold text-yellow-400 hover:bg-yellow-500/10"
              >
                Already have an account?
              </Link>

              <Link
                href="/add-business"
                className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/80 hover:bg-white/10"
              >
                Add a business
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-yellow-500/20 bg-black/30 p-6">
            <div className="text-lg font-bold text-yellow-400">
              What your account unlocks
            </div>

            <div className="mt-5 space-y-4 text-sm text-white/75">
              <div className="rounded-2xl border border-white/10 bg-[rgb(var(--card))] p-4">
                Submit halal businesses for review and publication.
              </div>

              <div className="rounded-2xl border border-white/10 bg-[rgb(var(--card))] p-4">
                Claim and manage approved business listings.
              </div>

              <div className="rounded-2xl border border-white/10 bg-[rgb(var(--card))] p-4">
                Prepare for advertising, sponsorships, billing, and analytics.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
          <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
            Secure signup
          </div>

          <h2 className="mt-3 text-2xl font-bold text-white">
            Build your SalahNearMe presence
          </h2>

          <p className="mt-3 text-sm leading-7 text-white/70">
            Your account helps SalahNearMe protect listings from spam and gives
            business owners a trusted way to manage their information.
          </p>

          <div className="mt-6 space-y-3 text-sm text-white/75">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              Use a real email address so you can receive updates.
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              After signup, you can submit or claim a business.
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              Admin approval keeps the directory clean and trustworthy.
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
          <SignupForm />

          <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/60">
            By creating an account, you agree to use SalahNearMe responsibly and
            only submit accurate mosque, halal business, or community-related
            information.
          </div>
        </div>
      </section>
    </div>
  );
}