"use client";

import { useState } from "react";

type Props = {
  mosqueId: string | number;
  mosqueSlug: string;
  mosqueName: string;
};

export default function ClaimMosqueForm({
  mosqueId,
  mosqueSlug,
  mosqueName,
}: Props) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");
  const [relationship, setRelationship] = useState("");
  const [proof, setProof] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    if (!fullName.trim() || !email.trim() || !relationship.trim()) {
      setErrorMessage("Please complete the required fields.");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch("/api/claim-mosque", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mosque_id: mosqueId,
          mosque_slug: mosqueSlug,
          mosque_name: mosqueName,
          full_name: fullName,
          email,
          phone,
          role,
          relationship,
          proof,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErrorMessage(data?.error ?? "Could not submit claim request.");
        return;
      }

      setSuccessMessage(
        "Your claim request has been submitted for review."
      );

      setFullName("");
      setEmail("");
      setPhone("");
      setRole("");
      setRelationship("");
      setProof("");
    } catch {
      setErrorMessage("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 grid gap-5 md:grid-cols-2">
      <div className="md:col-span-1">
        <label
          htmlFor="full_name"
          className="mb-2 block text-sm font-medium text-white/80"
        >
          Full name
        </label>
        <input
          id="full_name"
          name="full_name"
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Your full name"
          className="w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none focus:border-yellow-400"
        />
      </div>

      <div className="md:col-span-1">
        <label
          htmlFor="email"
          className="mb-2 block text-sm font-medium text-white/80"
        >
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none focus:border-yellow-400"
        />
      </div>

      <div className="md:col-span-1">
        <label
          htmlFor="phone"
          className="mb-2 block text-sm font-medium text-white/80"
        >
          Phone number
        </label>
        <input
          id="phone"
          name="phone"
          type="text"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Your phone number"
          className="w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none focus:border-yellow-400"
        />
      </div>

      <div className="md:col-span-1">
        <label
          htmlFor="role"
          className="mb-2 block text-sm font-medium text-white/80"
        >
          Your role at the mosque
        </label>
        <input
          id="role"
          name="role"
          type="text"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="e.g. Imam, Trustee, Admin"
          className="w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none focus:border-yellow-400"
        />
      </div>

      <div className="md:col-span-2">
        <label
          htmlFor="relationship"
          className="mb-2 block text-sm font-medium text-white/80"
        >
          Why should this claim be approved?
        </label>
        <textarea
          id="relationship"
          name="relationship"
          rows={6}
          value={relationship}
          onChange={(e) => setRelationship(e.target.value)}
          placeholder="Tell us about your connection to the mosque and how you help manage it."
          className="w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none focus:border-yellow-400"
        />
      </div>

      <div className="md:col-span-2">
        <label
          htmlFor="proof"
          className="mb-2 block text-sm font-medium text-white/80"
        >
          Proof or supporting information
        </label>
        <textarea
          id="proof"
          name="proof"
          rows={4}
          value={proof}
          onChange={(e) => setProof(e.target.value)}
          placeholder="Optional: website, official email, social page, or any supporting proof."
          className="w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none focus:border-yellow-400"
        />
      </div>

      {errorMessage && (
        <div className="md:col-span-2 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="md:col-span-2 rounded-2xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-200">
          {successMessage}
        </div>
      )}

      <div className="md:col-span-2 flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-yellow-500 px-5 py-3 text-sm font-semibold text-black hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Submitting..." : "Submit claim request"}
        </button>
      </div>
    </form>
  );
}

