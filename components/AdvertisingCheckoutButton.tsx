"use client";

import { useMemo, useState } from "react";

type AdvertisingType =
  | "city_featured"
  | "mosque_sponsor"
  | "multi_mosque"
  | "multi_city";

type AdvertisingCheckoutButtonProps = {
  advertisingType: AdvertisingType;
  businessId?: string | null;
  label?: string;
  disabled?: boolean;
  className?: string;
};

type CheckoutResponse = {
  ok?: boolean;
  url?: string;
  session_id?: string;
  error?: string;
  env_hint?: string;
  allowed?: string[];
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ADVERTISING_TYPES: AdvertisingType[] = [
  "city_featured",
  "mosque_sponsor",
  "multi_mosque",
  "multi_city",
];

function isValidBusinessId(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  return UUID_REGEX.test(value.trim());
}

function isValidAdvertisingType(value: AdvertisingType) {
  return ADVERTISING_TYPES.includes(value);
}

function getFriendlyError(data: CheckoutResponse, fallback: string) {
  if (data.env_hint && data.error) {
    return `${data.error} ${data.env_hint}`;
  }

  if (data.error) {
    return data.error;
  }

  return fallback;
}

export default function AdvertisingCheckoutButton({
  advertisingType,
  businessId = null,
  label = "Continue to payment",
  disabled = false,
  className = "",
}: AdvertisingCheckoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const cleanedBusinessId = useMemo(() => {
    return typeof businessId === "string" ? businessId.trim() : "";
  }, [businessId]);

  const canPay = useMemo(() => {
    return isValidBusinessId(cleanedBusinessId);
  }, [cleanedBusinessId]);

  const buttonDisabled = disabled || loading;

  async function handleCheckout() {
    if (buttonDisabled) {
      return;
    }

    try {
      setErrorMessage("");

      if (!isValidAdvertisingType(advertisingType)) {
        setErrorMessage("Invalid advertising package selected.");
        return;
      }

      if (!canPay) {
        setErrorMessage(
          "A valid business must be selected before payment. Use the Submit business first or Configure campaign first option."
        );
        return;
      }

      setLoading(true);

      const res = await fetch("/api/stripe/advertising-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({
          advertising_type: advertisingType,
          business_id: cleanedBusinessId,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as CheckoutResponse;

      if (!res.ok) {
        setErrorMessage(
          getFriendlyError(data, "Could not start advertising checkout.")
        );
        return;
      }

      if (!data.url || typeof data.url !== "string") {
        setErrorMessage("Checkout URL was not returned.");
        return;
      }

      window.location.assign(data.url);
    } catch (error) {
      console.error("advertising checkout button error:", error);
      setErrorMessage("Something went wrong while starting checkout.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={handleCheckout}
        disabled={buttonDisabled}
        aria-busy={loading}
        className={[
          "rounded-xl bg-yellow-500 px-5 py-3 text-sm font-semibold text-black",
          "transition hover:bg-yellow-400",
          "disabled:cursor-not-allowed disabled:opacity-60",
          className,
        ].join(" ")}
      >
        {loading ? "Starting checkout..." : label}
      </button>

      {errorMessage ? (
        <div
          role="alert"
          className="mt-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm leading-6 text-red-200"
        >
          {errorMessage}
        </div>
      ) : null}
    </div>
  );
}