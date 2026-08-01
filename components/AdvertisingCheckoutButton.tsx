"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

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

const REQUEST_TIMEOUT_MS = 25_000;

function isValidBusinessId(value: string | null | undefined): boolean {
  return typeof value === "string" && UUID_REGEX.test(value.trim());
}

function isValidAdvertisingType(
  value: AdvertisingType
): value is AdvertisingType {
  return ADVERTISING_TYPES.includes(value);
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getFriendlyError(
  data: CheckoutResponse,
  fallback: string
): string {
  const error = cleanString(data.error);
  const hint = cleanString(data.env_hint);

  if (error && hint) {
    return `${error} ${hint}`;
  }

  if (error) {
    return error;
  }

  return fallback;
}

function getValidatedCheckoutUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  try {
    const url = new URL(value);

    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export default function AdvertisingCheckoutButton({
  advertisingType,
  businessId = null,
  label = "Continue to payment",
  disabled = false,
  className = "",
}: AdvertisingCheckoutButtonProps) {
  const feedbackId = useId();
  const abortControllerRef = useRef<AbortController | null>(null);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const cleanedBusinessId = useMemo(
    () => cleanString(businessId),
    [businessId]
  );

  const canPay = useMemo(
    () => isValidBusinessId(cleanedBusinessId),
    [cleanedBusinessId]
  );

  const buttonDisabled = disabled || loading;

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  async function handleCheckout() {
    if (buttonDisabled) return;

    setErrorMessage("");

    if (!isValidAdvertisingType(advertisingType)) {
      setErrorMessage("Invalid advertising package selected.");
      return;
    }

    if (!canPay) {
      setErrorMessage(
        "A valid business must be selected before payment."
      );
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

      const response = await fetch(
        "/api/stripe/advertising-checkout",
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
          body: JSON.stringify({
            advertising_type: advertisingType,
            business_id: cleanedBusinessId,
          }),
        }
      );

      const data = (await response
        .json()
        .catch(() => ({}))) as CheckoutResponse;

      if (!response.ok || data.ok === false) {
        setErrorMessage(
          getFriendlyError(
            data,
            "Could not start advertising checkout."
          )
        );
        return;
      }

      const checkoutUrl = getValidatedCheckoutUrl(data.url);

      if (!checkoutUrl) {
        setErrorMessage("A valid checkout URL was not returned.");
        return;
      }

      window.location.assign(checkoutUrl);
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        setErrorMessage(
          timedOut
            ? "Checkout setup timed out. Please try again."
            : "Checkout setup was cancelled."
        );
      } else {
        console.error(
          "Advertising checkout button error:",
          error
        );
        setErrorMessage(
          "Something went wrong while starting checkout."
        );
      }
    } finally {
      window.clearTimeout(timeoutId);

      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }

      setLoading(false);
    }
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => void handleCheckout()}
        disabled={buttonDisabled}
        aria-busy={loading}
        aria-describedby={
          errorMessage ? feedbackId : undefined
        }
        className={[
          "inline-flex min-h-12 items-center justify-center rounded-xl bg-yellow-500 px-5 py-3 text-sm font-black text-black",
          "transition hover:bg-yellow-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300",
          "disabled:cursor-not-allowed disabled:opacity-60",
          className,
        ].join(" ")}
      >
        {loading ? (
          <>
            <span
              aria-hidden="true"
              className="mr-2 size-4 animate-spin rounded-full border-2 border-black/30 border-t-black"
            />
            Starting checkout…
          </>
        ) : (
          label
        )}
      </button>

      {errorMessage ? (
        <div
          id={feedbackId}
          role="alert"
          className="mt-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm leading-6 text-red-200"
        >
          {errorMessage}
        </div>
      ) : null}
    </div>
  );
}