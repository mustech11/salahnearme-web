"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";

export default function SignupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setSuccessMessage(
        "Account created. Check your email to confirm your account if email confirmation is enabled."
      );
      setEmail("");
      setPassword("");
      setFullName("");
    } catch {
      setErrorMessage("Could not create account.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSignup} className="grid gap-5">
      <div>
        <label className="mb-2 block text-sm font-medium text-white/80">
          Full name
        </label>
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none focus:border-yellow-400"
          placeholder="Your full name"
        />
      </div>

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
          placeholder="Create a password"
          required
        />
      </div>

      {errorMessage && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-200">
          {successMessage}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="rounded-xl bg-yellow-500 px-5 py-3 text-sm font-semibold text-black hover:bg-yellow-400 disabled:opacity-60"
      >
        {loading ? "Creating account..." : "Create account"}
      </button>
    </form>
  );
}

