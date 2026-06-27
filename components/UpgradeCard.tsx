"use client";

import { useState } from "react";

type Props = {
  title?: string;
  description?: string;
  plan: string;
  businessId: string;
};

export default function UpgradeCard({
  title = "Stripe subscription",
  description = "Pay securely by card.",
  plan,
  businessId,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function startCheckout() {
    try {
      setLoading(true);
      setMessage("");

      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          business_id: businessId,
          plan,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.url) {
        setMessage(data.error ?? "Could not start Stripe checkout.");
        return;
      }

      window.location.href = data.url;
    } catch {
      setMessage("Stripe checkout failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {(title || description) && (
        <div className="mb-3">
          {title && <div className="text-sm font-semibold text-white">{title}</div>}
          {description && (
            <div className="mt-1 text-xs text-white/55">{description}</div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={startCheckout}
        disabled={loading}
        className="w-full rounded-xl bg-yellow-500 px-5 py-3 text-sm font-semibold text-black hover:bg-yellow-400 disabled:opacity-50"
      >
        {loading ? "Opening Stripe..." : "Pay by card / Stripe"}
      </button>

      {message && <div className="mt-2 text-xs text-red-300">{message}</div>}
    </div>
  );
}

