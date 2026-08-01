"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Business = {
  id: string;
  name: string | null;
  slug: string | null;
  category: string | null;
  city: string | null;
  featured: boolean | null;
};

type PricingTier = "bronze" | "silver" | "gold" | "platinum";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const REQUEST_TIMEOUT_MS = 25_000;

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
  const abortControllerRef = useRef<AbortController | null>(null);
  const [selectedBusinessId, setSelectedBusinessId] = useState("");
  const [pricingTier, setPricingTier] = useState<PricingTier>("silver");
  const [durationDays, setDurationDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const safeBusinesses = useMemo(
    () =>
      (businesses ?? [])
        .filter((business) => UUID_REGEX.test(business.id))
        .sort((first, second) =>
          (first.name ?? "").localeCompare(second.name ?? "", "en-GB", {
            sensitivity: "base",
          })
        ),
    [businesses]
  );

  const selectedBusiness = useMemo(() => {
    return safeBusinesses.find((b) => b.id === selectedBusinessId) ?? null;
  }, [safeBusinesses, selectedBusinessId]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

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
  const hasBusinesses = safeBusinesses.length > 0;

  async function requestJson(
    url: string,
    body: Record<string, unknown>,
    signal: AbortSignal
  ) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      credentials: "same-origin",
      cache: "no-store",
      signal,
      body: JSON.stringify(body),
    });

    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;

    if (!response.ok) {
      throw new Error(
        typeof data.error === "string" && data.error.trim()
          ? data.error.trim()
          : "The request could not be completed."
      );
    }

    return data;
  }

  async function startSponsorCheckout() {
    if (!UUID_REGEX.test(mosqueId)) {
      setErrorMessage("A valid mosque is required.");
      return;
    }

    if (!selectedBusinessId || !UUID_REGEX.test(selectedBusinessId)) {
      setErrorMessage("Please choose a business first.");
      return;
    }

    abortControllerRef.current?.abort();

    const controller = new AbortController();
    abortControllerRef.current = controller;
    let timedOut = false;

    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    try {
      setLoading(true);
      setErrorMessage("");

      const campaignData = await requestJson(
        "/api/advertise/setup",
        {
          advertising_type: "mosque_sponsor",
          selected_mosque_id: mosqueId,
          notes: `Mosque sponsorship requested for ${mosqueName ?? "mosque"}`,
        },
        controller.signal
      );

      const campaignId =
        typeof campaignData.id === "string" ? campaignData.id : "";

      if (!campaignId) {
        throw new Error("Could not create campaign setup.");
      }

      const checkoutData = await requestJson(
        "/api/checkout/create-session",
        {
          campaign_id: campaignId,
          business_id: selectedBusinessId,
          pricing_tier: pricingTier,
          duration_days: durationDays,
          advertising_type: "mosque_sponsor",
          sponsor_mosque_id: mosqueId,
        },
        controller.signal
      );

      const checkoutUrl =
        typeof checkoutData.url === "string" ? checkoutData.url : "";

      if (!checkoutUrl) {
        throw new Error("Checkout URL was not returned.");
      }

      const parsed = new URL(checkoutUrl);

      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        throw new Error("The checkout URL is invalid.");
      }

      window.location.assign(parsed.toString());
    } catch (error) {
      setErrorMessage(
        error instanceof DOMException && error.name === "AbortError"
          ? timedOut
            ? "Checkout setup timed out. Please try again."
            : "Checkout setup was cancelled."
          : error instanceof Error
            ? error.message
            : "Something went wrong. Please try again."
      );
    } finally {
      window.clearTimeout(timeoutId);

      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }

      setLoading(false);
    }
  }

  return (
    <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-2xl font-semibold text-yellow-400">
            Choose a business to sponsor this mosque
          </div>
          <p className="mt-2 text-sm text-white/50">
            Sponsorship target: {mosqueName ?? "Selected mosque"}
          </p>
        </div>

        <span className="w-fit rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-300">
          Secure Stripe checkout
        </span>
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
            {safeBusinesses.map((b) => (
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
