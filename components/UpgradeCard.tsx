"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

type SupportedPlan =
  | "featured"
  | "mosque_sponsor"
  | "city_sponsor";

type Props = {
  title?: string;
  description?: string;
  plan: SupportedPlan;
  businessId: string;
};

type CheckoutResponse = {
  ok?: boolean;
  url?: string;
  session_id?: string;
  error?: string;
  env_hint?: string;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SUPPORTED_PLANS: SupportedPlan[] = [
  "featured",
  "mosque_sponsor",
  "city_sponsor",
];

const REQUEST_TIMEOUT_MS = 25_000;

function cleanString(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function isSupportedPlan(
  value: string
): value is SupportedPlan {
  return SUPPORTED_PLANS.includes(
    value as SupportedPlan
  );
}

function getCheckoutUrl(
  value: unknown
): string | null {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    return null;
  }

  try {
    const url = new URL(value);

    if (
      url.protocol !== "https:" &&
      url.protocol !== "http:"
    ) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function getErrorMessage(
  data: CheckoutResponse,
  fallback: string
): string {
  const error = cleanString(data.error);
  const hint = cleanString(data.env_hint);

  if (error && hint) {
    return `${error} ${hint}`;
  }

  return error || fallback;
}

export default function UpgradeCard({
  title = "Stripe subscription",
  description = "Pay securely by card.",
  plan,
  businessId,
}: Props) {
  const feedbackId = useId();

  const abortControllerRef =
    useRef<AbortController | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const cleanBusinessId = useMemo(
    () => cleanString(businessId),
    [businessId]
  );

  const validationError = useMemo(() => {
    if (!UUID_REGEX.test(cleanBusinessId)) {
      return "A valid business must be selected before checkout.";
    }

    if (!isSupportedPlan(plan)) {
      return "The selected upgrade plan is not supported.";
    }

    return "";
  }, [cleanBusinessId, plan]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, []);

  async function startCheckout() {
    if (loading) {
      return;
    }

    setMessage("");

    if (validationError) {
      setMessage(validationError);
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
        "/api/stripe/create-checkout",
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
            business_id: cleanBusinessId,
            plan,
          }),
        }
      );

      const data = (await response
        .json()
        .catch(() => ({}))) as CheckoutResponse;

      if (
        !response.ok ||
        data.ok === false
      ) {
        setMessage(
          getErrorMessage(
            data,
            "Could not start Stripe checkout."
          )
        );
        return;
      }

      const checkoutUrl =
        getCheckoutUrl(data.url);

      if (!checkoutUrl) {
        setMessage(
          "A valid Stripe checkout URL was not returned."
        );
        return;
      }

      window.location.assign(checkoutUrl);
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        setMessage(
          timedOut
            ? "Stripe checkout timed out. Please try again."
            : "Stripe checkout was cancelled."
        );
        return;
      }

      console.error(
        "UpgradeCard checkout error:",
        error
      );

      setMessage(
        "Stripe checkout failed. Please try again."
      );
    } finally {
      window.clearTimeout(timeoutId);

      if (
        abortControllerRef.current === controller
      ) {
        abortControllerRef.current = null;
      }

      setLoading(false);
    }
  }

  const isDisabled =
    loading || Boolean(validationError);

  return (
    <section
      aria-labelledby={`${feedbackId}-title`}
      className="rounded-2xl border border-yellow-500/20 bg-black/20 p-4"
    >
      {(title || description) ? (
        <div className="mb-4">
          {title ? (
            <h3
              id={`${feedbackId}-title`}
              className="text-sm font-black text-white"
            >
              {title}
            </h3>
          ) : null}

          {description ? (
            <p className="mt-1 text-xs leading-5 text-white/55">
              {description}
            </p>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => void startCheckout()}
        disabled={isDisabled}
        aria-busy={loading}
        aria-describedby={
          message ? feedbackId : undefined
        }
        title={
          validationError || undefined
        }
        className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-yellow-500 px-5 py-3 text-sm font-black text-black transition hover:bg-yellow-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? (
          <>
            <span
              aria-hidden="true"
              className="mr-2 size-4 animate-spin rounded-full border-2 border-black/30 border-t-black"
            />

            Opening Stripe…
          </>
        ) : (
          "Pay by card / Stripe"
        )}
      </button>

      {validationError && !message ? (
        <p className="mt-3 text-xs leading-5 text-amber-300">
          {validationError}
        </p>
      ) : null}

      {message ? (
        <div
          id={feedbackId}
          role="alert"
          className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs leading-5 text-red-200"
        >
          {message}
        </div>
      ) : null}

      <p className="mt-3 text-[11px] leading-5 text-white/35">
        Secure checkout is handled by Stripe.
      </p>
    </section>
  );
}