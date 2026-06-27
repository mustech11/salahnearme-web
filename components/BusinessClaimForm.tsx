"use client";

import { useState } from "react";

export default function BusinessClaimForm({
  businessId,
  businessSlug,
  businessName,
}: {
  businessId: string;
  businessSlug: string | null;
  businessName: string | null;
}) {
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

    if (!fullName.trim() || !email.trim()) {
      setErrorMessage("Please complete the required fields.");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch("/api/claim/business", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
        business_id: businessId,
        business_slug: businessSlug,
        business_name: businessName,
        full_name: fullName,
        phone,
        role,
        relationship,
        proof,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErrorMessage(data?.error ?? "Could not submit business claim.");
        return;
      }

      setSuccessMessage(
        "Your business claim request has been submitted for review."
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
      <div>
        <label className="mb-2 block text-sm font-medium text-white/80">
          Full name *
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
          Email address *
        </label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none focus:border-yellow-400"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-white/80">
          Phone number
        </label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none focus:border-yellow-400"
          placeholder="Phone number"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-white/80">
          Your role
        </label>
        <input
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none focus:border-yellow-400"
          placeholder="Owner, manager, marketing lead, etc."
        />
      </div>

      <div className="md:col-span-2">
        <label className="mb-2 block text-sm font-medium text-white/80">
          Why should this claim be approved?
        </label>
        <textarea
          rows={5}
          value={relationship}
          onChange={(e) => setRelationship(e.target.value)}
          className="w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none focus:border-yellow-400"
          placeholder="Explain your relationship to this business."
        />
      </div>

      <div className="md:col-span-2">
        <label className="mb-2 block text-sm font-medium text-white/80">
          Supporting proof
        </label>
        <textarea
          rows={4}
          value={proof}
          onChange={(e) => setProof(e.target.value)}
          className="w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none focus:border-yellow-400"
          placeholder="Website, official email domain, company page, social proof, or other evidence."
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

      <div className="md:col-span-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-yellow-500 px-5 py-3 text-sm font-semibold text-black hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Submitting..." : "Submit business claim"}
        </button>
      </div>
    </form>
  );
}

