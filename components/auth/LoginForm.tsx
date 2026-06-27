"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      router.push("/dashboard/business");
      router.refresh();
    } catch {
      setErrorMessage("Could not log in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleLogin} className="grid gap-5">
      <div>
        <label className="mb-2 block text-sm font-medium text-white/80">
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none focus:border-yellow-400"
          placeholder="you@example.com"
          required
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-white/80">
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none focus:border-yellow-400"
          placeholder="Your password"
          required
        />
      </div>

      {errorMessage && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {errorMessage}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="rounded-xl bg-yellow-500 px-5 py-3 text-sm font-semibold text-black hover:bg-yellow-400 disabled:opacity-60"
      >
        {loading ? "Logging in..." : "Log in"}
      </button>
    </form>
  );
}

