"use client";

import { PayPalButtons } from "@paypal/react-paypal-js";
import { useState } from "react";

type Plan = "featured" | "mosque_sponsor" | "city_sponsor";

export default function PayPalCheckoutButton({
  businessId,
  plan,
}: {
  businessId: string;
  plan: Plan;
  label?: string;
}) {
  const [message, setMessage] = useState("");

  return (
    <div>
      <PayPalButtons
        style={{
          layout: "vertical",
          color: "gold",
          shape: "rect",
          label: "paypal",
        }}
        createOrder={async () => {
          setMessage("");

          const res = await fetch("/api/paypal/create-order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              business_id: businessId,
              plan,
            }),
          });

          const data = await res.json().catch(() => ({}));

          if (!res.ok || !data.order_id) {
            throw new Error(data.error ?? "Could not create PayPal order.");
          }

          return data.order_id;
        }}
        onApprove={async (data) => {
          const res = await fetch("/api/paypal/capture-order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              order_id: data.orderID,
            }),
          });

          const json = await res.json().catch(() => ({}));

          if (!res.ok || !json.ok) {
            setMessage(json.error ?? "PayPal payment could not be captured.");
            return;
          }

          window.location.href = `/business-dashboard?business_id=${businessId}&paypal=success`;
        }}
        onCancel={() => setMessage("PayPal payment was cancelled.")}
        onError={() => setMessage("PayPal payment failed.")}
      />

      {message && <div className="mt-2 text-xs text-red-300">{message}</div>}
    </div>
  );
}

