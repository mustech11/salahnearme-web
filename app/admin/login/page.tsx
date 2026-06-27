"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

const DEFAULT_REDIRECT = "/admin";

function getSafeRedirect(value: string | null) {
  if (!value) {
    return DEFAULT_REDIRECT;
  }

  if (!value.startsWith("/")) {
    return DEFAULT_REDIRECT;
  }

  if (value.startsWith("//")) {
    return DEFAULT_REDIRECT;
  }

  return value;
}

export default function AdminLoginPage() {
  const router = useRouter();

  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const [email, setEmail] = useState("mustech@hotmail.com");
  const [password, setPassword] = useState("");
  const [nextPath, setNextPath] = useState(DEFAULT_REDIRECT);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const next = getSafeRedirect(params.get("next"));
    setNextPath(next);
  }, []);

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setError("");
    setMessage("");

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password.trim()) {
      setError("Enter email and password.");
      return;
    }

    try {
      setLoading(true);
      setMessage("Signing in...");

      const { data, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

      if (loginError) {
        setMessage("");
        setError(loginError.message);
        return;
      }

      if (!data.user || !data.session) {
        setMessage("");
        setError("Login failed. No user session was returned.");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, is_admin")
        .eq("id", data.user.id)
        .maybeSingle();

      if (profileError) {
        setMessage("");
        setError(profileError.message);
        return;
      }

      if (!profile?.is_admin) {
        await supabase.auth.signOut();
        setMessage("");
        setError("You are signed in, but this account is not an admin.");
        return;
      }

      setMessage("Signed in successfully. Redirecting...");

      router.refresh();
      router.replace(nextPath);
    } catch (err) {
      console.error("Admin login error:", err);
      setMessage("");
      setError("Could not sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#050a24] px-4 py-16 text-white">
      <section className="mx-auto max-w-lg rounded-3xl border border-yellow-500/20 bg-black/35 p-8 shadow-2xl md:p-10">
        <div className="text-sm uppercase tracking-[0.35em] text-yellow-400">
          SalahNearMe
        </div>

        <h1 className="mt-6 text-4xl font-black tracking-tight text-white">
          Sign in
        </h1>

        <p className="mt-4 text-white/70">
          Sign in to access your business dashboard or admin tools.
        </p>

        <form onSubmit={handleLogin} className="mt-8 space-y-4">
          <input
            type="email"
            value={email}
            autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full rounded-2xl border border-yellow-500/20 bg-yellow-50 px-5 py-4 text-black outline-none focus:border-yellow-400"
          />

          <input
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full rounded-2xl border border-yellow-500/20 bg-yellow-50 px-5 py-4 text-black outline-none focus:border-yellow-400"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-yellow-500 px-5 py-4 font-bold text-black transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        {message ? (
          <div className="mt-5 rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 text-sm text-blue-200">
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <p className="mt-6 text-sm text-white/50">
          After sign in, you will be sent to:{" "}
          <span className="font-semibold text-yellow-400">{nextPath}</span>
        </p>
      </section>
    </main>
  );
}

