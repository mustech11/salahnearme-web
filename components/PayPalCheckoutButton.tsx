"use client";

import { PayPalButtons } from "@paypal/react-paypal-js";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

type Plan = "featured" | "mosque_sponsor" | "city_sponsor";

type Props = {
  businessId: string;
  plan: Plan;
  label?: string;
};

type OrderResponse = {
  ok?: boolean;
  order_id?: string;
  error?: string;
};

type CaptureResponse = {
  ok?: boolean;
  error?: string;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const REQUEST_TIMEOUT_MS = 25_000;

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function requestJson<T>(
  url: string,
  body: Record<string, unknown>,
  signal: AbortSignal
): Promise<T> {
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

  const data = (await response
    .json()
    .catch(() => ({}))) as T & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(
      cleanString(data.error) ||
        "The payment request could not be completed."
    );
  }

  return data;
}

export default function PayPalCheckoutButton({
  businessId,
  plan,
  label = "PayPal one-off payment",
}: Props) {
  const feedbackId = useId();
  const abortControllerRef = useRef<AbortController | null>(null);

  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<
    "error" | "success" | "neutral"
  >("neutral");
  const [processing, setProcessing] = useState(false);

  const cleanBusinessId = useMemo(
    () => cleanString(businessId),
    [businessId]
  );

  const validBusiness = UUID_REGEX.test(cleanBusinessId);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  function createController() {
    abortControllerRef.current?.abort();

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const timeoutId = window.setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS
    );

    return { controller, timeoutId };
  }

  return (
    <div aria-describedby={message ? feedbackId : undefined}>
      <div className="mb-2 text-xs font-bold text-white/55">
        {label}
      </div>

      <PayPalButtons
        disabled={!validBusiness || processing}
        forceReRender={[cleanBusinessId, plan]}
        style={{
          layout: "vertical",
          color: "gold",
          shape: "rect",
          label: "paypal",
          height: 42,
        }}
        createOrder={async () => {
          setMessage("");
          setMessageTone("neutral");

          if (!validBusiness) {
            throw new Error(
              "A valid business is required before payment."
            );
          }

          const { controller, timeoutId } = createController();

          try {
            setProcessing(true);

            const data = await requestJson<OrderResponse>(
              "/api/paypal/create-order",
              {
                business_id: cleanBusinessId,
                plan,
              },
              controller.signal
            );

            const orderId = cleanString(data.order_id);

            if (!orderId) {
              throw new Error(
                "PayPal order ID was not returned."
              );
            }

            return orderId;
          } catch (error) {
            const message =
              error instanceof DOMException &&
              error.name === "AbortError"
                ? "PayPal order creation timed out."
                : error instanceof Error
                  ? error.message
                  : "Could not create PayPal order.";

            setMessageTone("error");
            setMessage(message);
            throw error;
          } finally {
            window.clearTimeout(timeoutId);
            setProcessing(false);
          }
        }}
        onApprove={async (data) => {
          const orderId = cleanString(data.orderID);

          if (!orderId) {
            setMessageTone("error");
            setMessage("PayPal order ID is missing.");
            return;
          }

          const { controller, timeoutId } = createController();

          try {
            setProcessing(true);
            setMessage("");
            setMessageTone("neutral");

            const json = await requestJson<CaptureResponse>(
              "/api/paypal/capture-order",
              {
                order_id: orderId,
              },
              controller.signal
            );

            if (json.ok !== true) {
              throw new Error(
                cleanString(json.error) ||
                  "PayPal payment could not be captured."
              );
            }

            setMessageTone("success");
            setMessage("Payment completed successfully.");

            const params = new URLSearchParams({
              business_id: cleanBusinessId,
              paypal: "success",
            });

            window.location.assign(
              `/business-dashboard?${params.toString()}`
            );
          } catch (error) {
            setMessageTone("error");
            setMessage(
              error instanceof DOMException &&
                error.name === "AbortError"
                ? "PayPal capture timed out."
                : error instanceof Error
                  ? error.message
                  : "PayPal payment could not be captured."
            );
          } finally {
            window.clearTimeout(timeoutId);
            setProcessing(false);
          }
        }}
        onCancel={() => {
          setMessageTone("neutral");
          setMessage("PayPal payment was cancelled.");
        }}
        onError={(error) => {
          console.error("PayPal checkout error:", error);
          setMessageTone("error");
          setMessage("PayPal payment failed.");
        }}
      />

      {message ? (
        <div
          id={feedbackId}
          role={
            messageTone === "error" ? "alert" : "status"
          }
          className={`mt-3 rounded-xl border p-3 text-xs leading-5 ${
            messageTone === "error"
              ? "border-red-500/30 bg-red-500/10 text-red-200"
              : messageTone === "success"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                : "border-white/10 bg-white/5 text-white/60"
          }`}
        >
          {message}
        </div>
      ) : null}
    </div>
  );
}