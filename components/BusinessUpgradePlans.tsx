"use client";

import { PayPalScriptProvider } from "@paypal/react-paypal-js";
import PayPalCheckoutButton from "@/components/PayPalCheckoutButton";
import UpgradeCard from "@/components/UpgradeCard";

type Plan = "featured" | "mosque_sponsor" | "city_sponsor";

export default function BusinessUpgradePlans({ businessId }: { businessId: string }) {
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;

  return (
    <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
      <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
        Upgrade Visibility
      </div>

      <h2 className="mt-3 text-3xl font-black text-white">
        Promote your business
      </h2>

      <p className="mt-3 max-w-3xl text-white/70">
        Choose Stripe for card subscriptions or PayPal for a 30-day one-off payment.
      </p>

      {!clientId ? (
        <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-red-300">
          Missing NEXT_PUBLIC_PAYPAL_CLIENT_ID
        </div>
      ) : (
        <PayPalScriptProvider
          options={{
            clientId,
            currency: "GBP",
            intent: "capture",
            components: "buttons",
          }}
        >
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <PlanCard
              title="Featured Business"
              price="£19 / 30 days"
              description="Boost your business across listings and receive a featured badge."
              plan="featured"
              businessId={businessId}
            />

            <PlanCard
              title="Mosque Sponsor"
              price="£49 / 30 days"
              description="Sponsor mosque pages and reach worshippers near key prayer locations."
              plan="mosque_sponsor"
              businessId={businessId}
            />

            <PlanCard
              title="City Sponsor"
              price="£99 / 30 days"
              description="Gain premium visibility across a city-level halal business ecosystem."
              plan="city_sponsor"
              businessId={businessId}
            />
          </div>
        </PayPalScriptProvider>
      )}
    </section>
  );
}

function PlanCard({
  title,
  price,
  description,
  plan,
  businessId,
}: {
  title: string;
  price: string;
  description: string;
  plan: Plan;
  businessId: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-6">
      <div className="text-xl font-black text-white">{title}</div>
      <div className="mt-2 text-2xl font-black text-yellow-400">{price}</div>

      <p className="mt-3 min-h-[72px] text-sm text-white/65">{description}</p>

      <div className="mt-5 space-y-3">
        <UpgradeCard
          plan={plan}
          businessId={businessId}
          title="Stripe subscription"
          description="Pay securely by card."
        />

        <PayPalCheckoutButton
          businessId={businessId}
          plan={plan}
          label="PayPal one-off payment"
        />
      </div>
    </div>
  );
}

