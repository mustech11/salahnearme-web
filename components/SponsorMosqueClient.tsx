"use client";

import { useMemo, useState } from "react";

type Business = {
  id: string;
  name: string | null;
  slug: string | null;
  category: string | null;
  city: string | null;
  featured: boolean | null;
};

type PricingTier = "bronze" | "silver" | "gold" | "platinum";

const monthlyPrices: Record<PricingTier, number> = {
  bronze: 19,
  silver: 49,
  gold: 99,
  platinum: 199,
};

function getTierPrice(tier: PricingTier, durationDays: number) {
  const months = Math.max(1, Math.ceil(durationDays / 30));
  return monthlyPrices[tier] * months;
}

function formatPrice(price: number) {
  return `£${price}`;
}

export default function SponsorMosqueClient({
  mosqueId,
  mosqueName,
  businesses,
}: {
  mosqueId: string;
  mosqueName: string | null;
  businesses: Business[];
}) {
  const [selectedBusinessId, setSelectedBusinessId] = useState("");
  const [pricingTier, setPricingTier] = useState<PricingTier>("silver");
  const [durationDays, setDurationDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const selectedBusiness = useMemo(() => {
    return businesses.find((b) => b.id === selectedBusinessId) ?? null;
  }, [businesses, selectedBusinessId]);

  const pricingCopy: Record<PricingTier, string> = {
    bronze: "Bronze · Entry placement",
    silver: "Silver · Strong visibility",
    gold: "Gold · Premium placement",
    platinum: "Platinum · Highest priority",
  };

  const tierBenefits: Record<PricingTier, string[]> = {
    bronze: [
      "Entry-level sponsored visibility",
      "Included in mosque sponsor placement",
      "Good for first-time advertisers",
    ],
    silver: [
      "Stronger priority in sponsored placements",
      "Better visibility than Bronze",
      "Balanced value for local businesses",
    ],
    gold: [
      "Premium visibility for serious promotion",
      "Strong ranking position on sponsored sections",
      "Ideal for established halal businesses",
    ],
    platinum: [
      "Highest priority placement",
      "Best visibility for competitive locations",
      "Top-tier premium sponsorship option",
    ],
  };

  const totalPrice = getTierPrice(pricingTier, durationDays);
  const hasBusinesses = businesses.length > 0;

  async function startSponsorCheckout() {
    if (!selectedBusinessId) {
      setErrorMessage("Please choose a business first.");
      return;
    }

    try {
      setLoading(true);
      setErrorMessage("");

      console.log("Sponsor checkout payload", {
        business_id: selectedBusinessId,
        pricing_tier: pricingTier,
        duration_days: durationDays,
        advertising_type: "mosque_sponsor",
        sponsor_mosque_id: mosqueId,
      });

      const campaignRes = await fetch("/api/advertise/setup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          advertising_type: "mosque_sponsor",
          selected_mosque_id: mosqueId,
          notes: `Mosque sponsorship requested for ${mosqueName ?? "mosque"}`,
        }),
      });

      const campaignData = await campaignRes.json().catch(() => ({}));

      if (!campaignRes.ok || !campaignData?.id) {
        setErrorMessage(
          campaignData?.error ?? "Could not create campaign setup."
        );
        return;
      }

      const checkoutRes = await fetch("/api/checkout/create-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          campaign_id: campaignData.id,
          business_id: selectedBusinessId,
          pricing_tier: pricingTier,
          duration_days: durationDays,
          advertising_type: "mosque_sponsor",
          sponsor_mosque_id: mosqueId,
        }),
      });

      const checkoutData = await checkoutRes.json().catch(() => ({}));

      if (!checkoutRes.ok) {
        setErrorMessage(
          checkoutData?.error ?? "Could not start checkout session."
        );
        return;
      }

      if (checkoutData?.url) {
        window.location.href = checkoutData.url;
        return;
      }

      setErrorMessage("Checkout URL was not returned.");
    } catch {
      setErrorMessage("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
      <div className="text-2xl font-semibold text-yellow-400">
        Choose a business to sponsor this mosque
      </div>

      <p className="mt-3 max-w-3xl text-white/70">
        Select your business, choose your sponsorship tier, review the pricing,
        and continue to secure Stripe checkout.
      </p>

      {!hasBusinesses && (
        <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/60">
          No approved businesses are available for sponsorship in this city yet.
        </div>
      )}

      <div className="mt-6 grid gap-4">
        <div>
          <label
            htmlFor="sponsor-business"
            className="mb-2 block text-sm font-medium text-white/80"
          >
            Business
          </label>
          <select
            id="sponsor-business"
            value={selectedBusinessId}
            onChange={(e) => setSelectedBusinessId(e.target.value)}
            className="w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-4 text-white outline-none transition focus:border-yellow-400"
            disabled={!hasBusinesses || loading}
          >
            <option value="">Select a business</option>
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} {b.category ? `• ${b.category}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label
              htmlFor="pricing-tier"
              className="mb-2 block text-sm font-medium text-white/80"
            >
              Sponsorship tier
            </label>
            <select
              id="pricing-tier"
              value={pricingTier}
              onChange={(e) => setPricingTier(e.target.value as PricingTier)}
              className="w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-4 text-white outline-none transition focus:border-yellow-400"
              disabled={loading}
            >
              <option value="bronze">Bronze · £19 / month</option>
              <option value="silver">Silver · £49 / month</option>
              <option value="gold">Gold · £99 / month</option>
              <option value="platinum">Platinum · £199 / month</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="duration-days"
              className="mb-2 block text-sm font-medium text-white/80"
            >
              Duration
            </label>
            <select
              id="duration-days"
              value={durationDays}
              onChange={(e) => setDurationDays(Number(e.target.value))}
              className="w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-4 text-white outline-none transition focus:border-yellow-400"
              disabled={loading}
            >
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
              <option value={90}>90 days</option>
            </select>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        {selectedBusiness ? (
          <div className="rounded-2xl border border-yellow-500/20 bg-black/30 p-5">
            <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
              Sponsorship Summary
            </div>

            <div className="mt-4 space-y-3 text-white/80">
              <div>
                <span className="text-white/50">Business:</span>{" "}
                <span className="font-semibold text-white">
                  {selectedBusiness.name}
                </span>
              </div>

              <div>
                <span className="text-white/50">Category:</span>{" "}
                <span className="font-semibold text-white">
                  {selectedBusiness.category ?? "Business"}
                </span>
              </div>

              <div>
                <span className="text-white/50">Mosque:</span>{" "}
                <span className="font-semibold text-white">{mosqueName}</span>
              </div>

              <div>
                <span className="text-white/50">Tier:</span>{" "}
                <span className="font-semibold text-white">
                  {pricingCopy[pricingTier]}
                </span>
              </div>

              <div>
                <span className="text-white/50">Duration:</span>{" "}
                <span className="font-semibold text-white">
                  {durationDays} days
                </span>
              </div>

              <div className="border-t border-white/10 pt-3">
                <span className="text-white/50">Total:</span>{" "}
                <span className="text-lg font-bold text-yellow-400">
                  {formatPrice(totalPrice)}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-black/30 p-5 text-white/60">
            Select a business to preview your sponsorship summary.
          </div>
        )}

        <div className="rounded-2xl border border-yellow-500/20 bg-black/30 p-5">
          <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
            Tier Benefits
          </div>

          <div className="mt-4">
            <div className="text-lg font-semibold text-white">
              {pricingCopy[pricingTier]}
            </div>
            <div className="mt-2 text-sm text-white/60">
              Monthly price: {formatPrice(monthlyPrices[pricingTier])}
            </div>
          </div>

          <ul className="mt-4 space-y-2 text-sm text-white/75">
            {tierBenefits[pricingTier].map((benefit) => (
              <li key={benefit}>• {benefit}</li>
            ))}
          </ul>
        </div>
      </div>

      {errorMessage && (
        <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {errorMessage}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={startSponsorCheckout}
          disabled={!selectedBusinessId || loading || !hasBusinesses}
          className="rounded-2xl bg-yellow-500 px-6 py-3 font-semibold text-black transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Starting checkout..." : `Continue to payment · ${formatPrice(totalPrice)}`}
        </button>

        <div className="text-sm text-white/50">
          Secure Stripe checkout. Sponsorship activates automatically after successful payment.
        </div>
      </div>
    </section>
  );
}

