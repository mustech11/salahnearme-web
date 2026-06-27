"use client";

export default function BuyFeaturedButton({
  businessId,
  plan,
  sponsorMosqueId,
}: {
  businessId: string;
  plan: "featured" | "sponsor";
  sponsorMosqueId?: string | null;
}) {
  async function startCheckout() {
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        business_id: businessId,
        plan,
        sponsor_mosque_id: sponsorMosqueId ?? null,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(data?.error ?? "Could not start Stripe checkout");
      return;
    }

    window.location.href = data.url;
  }

  return (
    <button
      type="button"
      onClick={startCheckout}
      className="rounded-xl bg-emerald-400 px-3 py-2 text-xs font-semibold text-neutral-950 hover:opacity-90"
    >
      {plan === "featured"
        ? "Buy Featured Listing"
        : "Buy Mosque Sponsorship"}
    </button>
  );
}

