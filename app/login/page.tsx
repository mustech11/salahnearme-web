"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function safeNext(value: string | null) {
  if (!value) return "/business-dashboard";
  if (!value.startsWith("/")) return "/business-dashboard";
  if (value.startsWith("//")) return "/business-dashboard";
  return value;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const next = safeNext(searchParams.get("next"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function signIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setMsg(null);
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error || !data.session) {
      setLoading(false);
      setMsg(error?.message ?? "Login failed");
      return;
    }

    await supabase.auth.getSession();

    setLoading(false);

    router.replace(next);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-md p-6">
      <div className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
        <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
          SalahNearMe
        </div>

        <h1 className="mt-4 text-3xl font-black text-white">Sign in</h1>

        <p className="mt-3 text-sm text-white/60">
          Sign in to access your business dashboard or admin tools.
        </p>

        <form onSubmit={signIn} className="mt-6 space-y-3">
          <input
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-yellow-400"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
            autoComplete="email"
          />

          <input
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-yellow-400"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
            autoComplete="current-password"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-yellow-500 px-4 py-3 text-sm font-semibold text-black hover:bg-yellow-400 disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>

          {msg && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
              {msg}
            </div>
          )}
        </form>

        <div className="mt-5 text-xs text-white/50">
          After sign in, you will be sent to:{" "}
          <span className="text-yellow-400">{next}</span>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-6 text-white/70">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}

