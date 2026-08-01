"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PayPalScriptProvider } from "@paypal/react-paypal-js";

import PayPalCheckoutButton from "@/components/PayPalCheckoutButton";
import UpgradeCard from "@/components/UpgradeCard";

type Plan = "featured" | "mosque_sponsor" | "city_sponsor";

type PlanDefinition = {
  plan: Plan;
  title: string;
  price: string;
  monthlyAmount: number;
  description: string;
  features: string[];
  recommended?: boolean;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PLANS: PlanDefinition[] = [
  {
    plan: "featured",
    title: "Featured Business",
    price: "£19 / 30 days",
    monthlyAmount: 19,
    description:
      "Boost your listing visibility and display a featured placement badge.",
    features: [
      "Priority placement above standard listings",
      "Featured badge on supported pages",
      "Suitable for one local business",
    ],
  },
  {
    plan: "mosque_sponsor",
    title: "Mosque Sponsor",
    price: "£49 / 30 days",
    monthlyAmount: 49,
    description:
      "Reach worshippers on a selected mosque page and prayer journey.",
    features: [
      "Placement on a selected mosque profile",
      "High-intent local audience",
      "Sponsor impression and click analytics",
    ],
    recommended: true,
  },
  {
    plan: "city_sponsor",
    title: "City Sponsor",
    price: "£99 / 30 days",
    monthlyAmount: 99,
    description:
      "Gain premium visibility across a city-level halal business ecosystem.",
    features: [
      "Broader city-level visibility",
      "Priority campaign positioning",
      "Suitable for established local brands",
    ],
  },
];

export default function BusinessUpgradePlans({
  businessId,
}: {
  businessId: string;
}) {
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID?.trim();
  const cleanBusinessId = businessId.trim();
  const hasBusinessId = UUID_REGEX.test(cleanBusinessId);
  const [selectedPlan, setSelectedPlan] = useState<Plan>("mosque_sponsor");

  const selected = useMemo(
    () => PLANS.find((plan) => plan.plan === selectedPlan) ?? PLANS[1],
    [selectedPlan]
  );

  return (
    <section
      aria-labelledby="business-upgrade-plans-heading"
      className="overflow-hidden rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))]"
    >
      <div className="bg-[radial-gradient(circle_at_top_right,rgba(234,179,8,0.15),transparent_45%)] p-6 md:p-8">
        <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
          Upgrade visibility
        </div>

        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2
              id="business-upgrade-plans-heading"
              className="text-3xl font-black text-white"
            >
              Promote your business
            </h2>

            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/70">
              Choose a promotion plan, then pay by Stripe subscription or
              PayPal one-off checkout where available.
            </p>
          </div>

          <Link
            href="/advertise"
            className="w-fit rounded-2xl border border-yellow-500/30 bg-yellow-500/10 px-5 py-3 text-sm font-bold text-yellow-300 transition hover:bg-yellow-500/20"
          >
            Compare all packages
          </Link>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {PLANS.map((plan) => (
            <button
              key={plan.plan}
              type="button"
              onClick={() => setSelectedPlan(plan.plan)}
              className={`rounded-2xl border p-4 text-left transition ${
                selectedPlan === plan.plan
                  ? "border-yellow-400 bg-yellow-500/15"
                  : "border-white/10 bg-black/25 hover:border-yellow-500/30"
              }`}
            >
              <div className="text-sm font-black text-white">{plan.title}</div>
              <div className="mt-1 text-xs text-yellow-300">{plan.price}</div>
            </button>
          ))}
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-white/40">
            Selected plan
          </div>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-lg font-black text-white">{selected.title}</div>
              <div className="mt-1 text-sm text-white/55">
                {selected.description}
              </div>
            </div>
            <div className="text-2xl font-black text-yellow-300">
              £{selected.monthlyAmount}
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 md:p-8">
        {!hasBusinessId ? (
          <div
            role="alert"
            className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-red-200"
          >
            A valid business must be selected before purchasing an upgrade.
          </div>
        ) : null}

        {!clientId ? (
          <div className="mt-4 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm text-yellow-100">
            <div className="font-bold">
              PayPal checkout is temporarily unavailable.
            </div>
            <p className="mt-1 text-yellow-100/75">
              Stripe card subscriptions remain available.
            </p>
          </div>
        ) : null}

        <PaymentPlans
          businessId={cleanBusinessId}
          clientId={clientId}
          disabled={!hasBusinessId}
          selectedPlan={selectedPlan}
        />

        <div className="mt-6 rounded-2xl border border-white/10 bg-black/25 p-4 text-xs leading-6 text-white/50">
          Paid placement remains subject to listing eligibility, campaign
          availability and compliance review.
        </div>
      </div>
    </section>
  );
}

function PaymentPlans({
  businessId,
  clientId,
  disabled,
  selectedPlan,
}: {
  businessId: string;
  clientId?: string;
  disabled: boolean;
  selectedPlan: Plan;
}) {
  const cards = (
    <div className="grid gap-5 lg:grid-cols-3">
      {PLANS.map((definition) => (
        <PlanCard
          key={definition.plan}
          definition={definition}
          businessId={businessId}
          paypalEnabled={Boolean(clientId)}
          disabled={disabled}
          highlighted={selectedPlan === definition.plan}
        />
      ))}
    </div>
  );

  if (!clientId) {
    return cards;
  }

  return (
    <PayPalScriptProvider
      options={{
        clientId,
        currency: "GBP",
        intent: "capture",
        components: "buttons",
      }}
    >
      {cards}
    </PayPalScriptProvider>
  );
}

function PlanCard({
  definition,
  businessId,
  paypalEnabled,
  disabled,
  highlighted,
}: {
  definition: PlanDefinition;
  businessId: string;
  paypalEnabled: boolean;
  disabled: boolean;
  highlighted: boolean;
}) {
  return (
    <article
      className={`relative rounded-3xl border bg-black/30 p-6 transition ${
        highlighted
          ? "border-yellow-400 shadow-[0_0_35px_rgba(234,179,8,0.09)]"
          : definition.recommended
            ? "border-yellow-500/35"
            : "border-white/10"
      }`}
    >
      {definition.recommended ? (
        <span className="absolute right-5 top-5 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-bold text-yellow-300">
          Recommended
        </span>
      ) : null}

      <h3 className="pr-28 text-xl font-black text-white">
        {definition.title}
      </h3>

      <div className="mt-2 text-2xl font-black text-yellow-400">
        {definition.price}
      </div>

      <p className="mt-3 min-h-[72px] text-sm leading-6 text-white/65">
        {definition.description}
      </p>

      <ul className="mt-5 space-y-3 text-sm text-white/70">
        {definition.features.map((feature) => (
          <li key={feature} className="flex gap-3">
            <span
              aria-hidden="true"
              className="mt-2 h-2 w-2 shrink-0 rounded-full bg-yellow-400"
            />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <div
        className={`mt-6 space-y-3 ${
          disabled ? "pointer-events-none opacity-50" : ""
        }`}
      >
        <UpgradeCard
          plan={definition.plan}
          businessId={businessId}
          title="Stripe subscription"
          description="Pay securely by card."
        />

        {paypalEnabled ? (
          <PayPalCheckoutButton
            businessId={businessId}
            plan={definition.plan}
            label="PayPal one-off payment"
          />
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/45">
            PayPal unavailable. Use Stripe above.
          </div>
        )}
      </div>
    </article>
  );
}