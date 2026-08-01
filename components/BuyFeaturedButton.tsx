"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

type Plan = "featured" | "sponsor";

type CheckoutResponse = {
  ok?: boolean;
  url?: string;
  error?: string;
};

type Props = {
  businessId: string;
  plan: Plan;
  sponsorMosqueId?: string | null;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const REQUEST_TIMEOUT_MS = 25_000;

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getCheckoutUrl(value: unknown): string | null {
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

export default function BuyFeaturedButton({
  businessId,
  plan,
  sponsorMosqueId,
}: Props) {
  const feedbackId = useId();
  const abortControllerRef = useRef<AbortController | null>(null);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const cleanBusinessId = useMemo(
    () => cleanString(businessId),
    [businessId]
  );

  const cleanMosqueId = useMemo(
    () => cleanString(sponsorMosqueId),
    [sponsorMosqueId]
  );

  const validationError = useMemo(() => {
    if (!UUID_REGEX.test(cleanBusinessId)) {
      return "A valid business is required.";
    }

    if (plan === "sponsor" && !UUID_REGEX.test(cleanMosqueId)) {
      return "A valid mosque is required for sponsorship.";
    }

    return "";
  }, [cleanBusinessId, cleanMosqueId, plan]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  async function startCheckout() {
    if (loading) return;

    setErrorMessage("");

    if (validationError) {
      setErrorMessage(validationError);
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

      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
        body: JSON.stringify({
          business_id: cleanBusinessId,
          plan,
          sponsor_mosque_id:
            plan === "sponsor" ? cleanMosqueId : null,
        }),
      });

      const data = (await response
        .json()
        .catch(() => ({}))) as CheckoutResponse;

      if (!response.ok || data.ok === false) {
        setErrorMessage(
          cleanString(data.error) ||
            "Could not start Stripe checkout."
        );
        return;
      }

      const checkoutUrl = getCheckoutUrl(data.url);

      if (!checkoutUrl) {
        setErrorMessage(
          "A valid Stripe checkout URL was not returned."
        );
        return;
      }

      window.location.assign(checkoutUrl);
    } catch (error) {
      setErrorMessage(
        error instanceof DOMException &&
          error.name === "AbortError"
          ? timedOut
            ? "Stripe checkout timed out. Please try again."
            : "Stripe checkout was cancelled."
          : "Could not start Stripe checkout."
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
    <div>
      <button
        type="button"
        onClick={() => void startCheckout()}
        disabled={loading || Boolean(validationError)}
        aria-busy={loading}
        aria-describedby={
          errorMessage ? feedbackId : undefined
        }
        className="inline-flex min-h-10 items-center justify-center rounded-xl bg-emerald-400 px-4 py-2.5 text-xs font-black text-neutral-950 transition hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading
          ? "Starting checkout…"
          : plan === "featured"
            ? "Buy Featured Listing"
            : "Buy Mosque Sponsorship"}
      </button>

      {errorMessage ? (
        <div
          id={feedbackId}
          role="alert"
          className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs leading-5 text-red-200"
        >
          {errorMessage}
        </div>
      ) : null}
    </div>
  );
}