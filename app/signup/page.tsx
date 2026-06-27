import type { Metadata } from "next";
import SignupForm from "@/components/auth/SignupForm";

export const metadata: Metadata = {
  title: "Sign up | SalahNearMe",
  description: "Create your SalahNearMe account.",
};

export default function SignupPage() {
  return (
    <div className="mx-auto max-w-xl space-y-8 py-10">
      <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
        <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
          Account
        </div>
        <h1 className="mt-3 text-4xl font-bold text-white">Create account</h1>
        <p className="mt-3 text-white/70">
          Sign up to manage your business, billing, and listings on SalahNearMe.
        </p>
      </section>

      <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
        <SignupForm />
      </section>
    </div>
  );
}

