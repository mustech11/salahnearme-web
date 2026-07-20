"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

const DEFAULT_REDIRECT = "/business-dashboard";

function safeNext(value: string | null) {
  if (!value) {
    return DEFAULT_REDIRECT;
  }

  const trimmed = value.trim();

  if (!trimmed || !trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return DEFAULT_REDIRECT;
  }

  if (
    trimmed.startsWith("/api") ||
    trimmed.startsWith("/logout") ||
    trimmed.startsWith("/login") ||
    trimmed.startsWith("/signup")
  ) {
    return DEFAULT_REDIRECT;
  }

  return trimmed;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const next = useMemo(() => safeNext(searchParams.get("next")), [searchParams]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"error" | "success">("error");
  const [loading, setLoading] = useState(false);

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanedEmail = email.trim().toLowerCase();

    setMessage(null);
    setMessageType("error");

    if (!cleanedEmail || !password) {
      setMessage("Please enter your email and password.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanedEmail,
      password,
    });

    if (error || !data.session) {
      setLoading(false);
      setMessage(error?.message ?? "Login failed. Please try again.");
      return;
    }

    await supabase.auth.getSession();

    setMessageType("success");
    setMessage("Signed in successfully. Redirecting...");

    router.replace(next);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 py-10">
      <section className="relative overflow-hidden rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8 md:p-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,0.18),transparent_38%)]" />

        <div className="relative z-10 grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
              SalahNearMe Login
            </div>

            <h1 className="mt-3 text-4xl font-black text-white md:text-5xl">
              Sign in to continue
            </h1>

            <p className="mt-4 max-w-3xl text-white/70">
              Access your business dashboard, admin tools, sponsorship setup,
              claims, billing, and saved listing workflows.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/signup"
                className="rounded-xl border border-yellow-500/30 bg-black px-5 py-3 text-sm font-semibold text-yellow-400 hover:bg-yellow-500/10"
              >
                Create an account
              </Link>

              <Link
                href="/"
                className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/80 hover:bg-white/10"
              >
                Back to homepage
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-yellow-500/20 bg-black/30 p-6">
            <div className="text-lg font-bold text-yellow-400">
              Secure account access
            </div>

            <div className="mt-5 space-y-4 text-sm text-white/75">
              <div className="rounded-2xl border border-white/10 bg-[rgb(var(--card))] p-4">
                Manage halal business listings and visibility.
              </div>

              <div className="rounded-2xl border border-white/10 bg-[rgb(var(--card))] p-4">
                Access claim, billing, and sponsorship workflows.
              </div>

              <div className="rounded-2xl border border-white/10 bg-[rgb(var(--card))] p-4">
                Admin users can access the protected control centre.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-xl rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
        <form onSubmit={signIn} className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-white/80">
              Email address
            </label>

            <input
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-yellow-400"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              required
              autoComplete="email"
              inputMode="email"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-white/80">
              Password
            </label>

            <input
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-yellow-400"
              placeholder="Your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-yellow-500 px-5 py-3 text-sm font-bold text-black transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>

          {message && (
            <div
              className={`rounded-xl border p-3 text-sm ${
                messageType === "success"
                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                  : "border-red-500/20 bg-red-500/10 text-red-300"
              }`}
            >
              {message}
            </div>
          )}
        </form>

        <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4 text-xs text-white/50">
          After sign in, you will be sent to{" "}
          <span className="font-semibold text-yellow-400">{next}</span>.
        </div>
      </section>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-xl py-10 text-sm text-white/70">
          Loading login...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}