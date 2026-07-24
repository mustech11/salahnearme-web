"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

type Props = {
  mosqueId: string;
};

type ApiResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  retry_after_seconds?: number;
};

type ReportType =
  | "iqamah_started"
  | "khutbah_live"
  | "full"
  | "correction"
  | "parking_full"
  | "jumuah_first"
  | "jumuah_second"
  | "jumuah_third";

type ReportButton = {
  type: ReportType;
  label: string;
  loadingLabel: string;
  successMessage: string;
  className: string;
};

type SubmitState =
  | "idle"
  | "submitting"
  | "success"
  | "error";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const REQUEST_TIMEOUT_MS = 15_000;
const SUCCESS_RESET_MS = 5_000;

const REPORT_BUTTONS: readonly ReportButton[] = [
  {
    type: "iqamah_started",
    label: "🟢 Iqamah started",
    loadingLabel: "Sending iqamah report...",
    successMessage: "Iqamah report submitted.",
    className:
      "border-green-500/30 bg-green-500/10 text-green-300 hover:bg-green-500/20",
  },
  {
    type: "khutbah_live",
    label: "🟣 Khutbah live",
    loadingLabel: "Sending khutbah report...",
    successMessage: "Khutbah report submitted.",
    className:
      "border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20",
  },
  {
    type: "full",
    label: "🔴 Full",
    loadingLabel: "Sending capacity report...",
    successMessage: "Full-capacity report submitted.",
    className:
      "border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20",
  },
  {
    type: "correction",
    label: "⚠️ Time incorrect",
    loadingLabel: "Sending correction...",
    successMessage: "Time correction report submitted.",
    className:
      "border-yellow-500/30 bg-yellow-500/10 text-yellow-300 hover:bg-yellow-500/20",
  },
  {
    type: "parking_full",
    label: "🚗 Parking full",
    loadingLabel: "Sending parking report...",
    successMessage: "Parking-full report submitted.",
    className:
      "border-orange-500/30 bg-orange-500/10 text-orange-300 hover:bg-orange-500/20",
  },
  {
    type: "jumuah_first",
    label: "🕌 1st Jumu’ah",
    loadingLabel: "Sending Jumu’ah report...",
    successMessage: "First Jumu’ah report submitted.",
    className:
      "border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20",
  },
  {
    type: "jumuah_second",
    label: "🕌 2nd Jumu’ah",
    loadingLabel: "Sending Jumu’ah report...",
    successMessage: "Second Jumu’ah report submitted.",
    className:
      "border-blue-500/30 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20",
  },
  {
    type: "jumuah_third",
    label: "🕌 3rd Jumu’ah",
    loadingLabel: "Sending Jumu’ah report...",
    successMessage: "Third Jumu’ah report submitted.",
    className:
      "border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20",
  },
] as const;

function cleanString(
  value: string | null | undefined
): string {
  return value?.trim() ?? "";
}

async function readResponse(
  response: Response
): Promise<ApiResponse> {
  try {
    const value: unknown = await response.json();

    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value)
    ) {
      return {};
    }

    return value as ApiResponse;
  } catch {
    return {};
  }
}

function getApiErrorMessage(
  response: Response,
  data: ApiResponse
): string {
  const apiError = cleanString(data.error);

  if (apiError) {
    return apiError;
  }

  if (response.status === 400) {
    return "This community report could not be accepted.";
  }

  if (response.status === 404) {
    return "This mosque could not be found.";
  }

  if (response.status === 409) {
    return "A matching report was submitted recently.";
  }

  if (response.status === 429) {
    const retryAfter =
      typeof data.retry_after_seconds === "number" &&
      Number.isFinite(data.retry_after_seconds)
        ? Math.max(
            1,
            Math.trunc(data.retry_after_seconds)
          )
        : null;

    return retryAfter
      ? `Too many recent reports. Please try again in approximately ${retryAfter} seconds.`
      : "Too many recent reports. Please wait before trying again.";
  }

  if (response.status >= 500) {
    return "The reporting service is temporarily unavailable.";
  }

  return "The community report could not be submitted.";
}

export default function MosqueLiveReporter({
  mosqueId,
}: Props) {
  const feedbackId = useId();

  const abortControllerRef =
    useRef<AbortController | null>(null);

  const successTimeoutRef =
    useRef<number | null>(null);

  const [loadingType, setLoadingType] =
    useState<ReportType | null>(null);

  const [submitState, setSubmitState] =
    useState<SubmitState>("idle");

  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] =
    useState("");

  const cleanMosqueId = useMemo(
    () => mosqueId.trim(),
    [mosqueId]
  );

  const validationError = useMemo(() => {
    if (!UUID_REGEX.test(cleanMosqueId)) {
      return "This mosque cannot currently accept community reports.";
    }

    return "";
  }, [cleanMosqueId]);

  const isSubmitting =
    submitState === "submitting";

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();

      if (successTimeoutRef.current !== null) {
        window.clearTimeout(
          successTimeoutRef.current
        );
      }
    };
  }, []);

  const sendReport = useCallback(
    async (button: ReportButton) => {
      if (isSubmitting) {
        return;
      }

      setMessage("");
      setErrorMessage("");

      if (validationError) {
        setSubmitState("error");
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

      setLoadingType(button.type);
      setSubmitState("submitting");

      try {
        const response = await fetch(
          "/api/mosque/report",
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
              mosque_id: cleanMosqueId,
              report_type: button.type,
            }),
          }
        );

        const data = await readResponse(response);

        if (!response.ok || data.ok === false) {
          setSubmitState("error");
          setErrorMessage(
            getApiErrorMessage(response, data)
          );
          return;
        }

        setSubmitState("success");

        setMessage(
          cleanString(data.message) ||
            button.successMessage
        );

        if (successTimeoutRef.current !== null) {
          window.clearTimeout(
            successTimeoutRef.current
          );
        }

        successTimeoutRef.current =
          window.setTimeout(() => {
            setSubmitState("idle");
            setMessage("");
            successTimeoutRef.current = null;
          }, SUCCESS_RESET_MS);
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          setSubmitState("error");
          setErrorMessage(
            timedOut
              ? "The report request timed out. Please try again."
              : "The report request was cancelled."
          );
          return;
        }

        console.error(
          "Mosque live report submission error:",
          error
        );

        setSubmitState("error");
        setErrorMessage(
          "Something went wrong while submitting the report."
        );
      } finally {
        window.clearTimeout(timeoutId);

        if (
          abortControllerRef.current === controller
        ) {
          abortControllerRef.current = null;
        }

        setLoadingType(null);

        setSubmitState((currentState) =>
          currentState === "submitting"
            ? "idle"
            : currentState
        );
      }
    },
    [
      cleanMosqueId,
      isSubmitting,
      validationError,
    ]
  );

  return (
    <section
      aria-labelledby="mosque-live-reporter-heading"
      className="space-y-4"
    >
      <div>
        <h2
          id="mosque-live-reporter-heading"
          className="text-lg font-black text-white"
        >
          Share a live mosque update
        </h2>

        <p className="mt-1 max-w-3xl text-xs leading-6 text-white/50">
          Community reports help visitors understand
          current mosque activity. Reports are
          time-limited, monitored and may be combined
          with other recent reports.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {REPORT_BUTTONS.map((button) => {
          const buttonIsLoading =
            loadingType === button.type;

          return (
            <button
              key={button.type}
              type="button"
              disabled={
                isSubmitting ||
                Boolean(validationError)
              }
              aria-busy={buttonIsLoading}
              aria-describedby={feedbackId}
              onClick={() => {
                void sendReport(button);
              }}
              className={`inline-flex min-h-10 items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 disabled:cursor-not-allowed disabled:opacity-50 ${button.className}`}
            >
              {buttonIsLoading ? (
                <>
                  <span
                    aria-hidden="true"
                    className="mr-2 size-3.5 animate-spin rounded-full border-2 border-current/30 border-t-current"
                  />

                  {button.loadingLabel}
                </>
              ) : (
                button.label
              )}
            </button>
          );
        })}
      </div>

      <div
        id={feedbackId}
        aria-live="polite"
        aria-atomic="true"
      >
        {validationError &&
        !errorMessage ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
            {validationError}
          </div>
        ) : null}

        {submitState === "success" &&
        message ? (
          <div
            role="status"
            className="rounded-2xl border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-200"
          >
            {message}
          </div>
        ) : null}

        {submitState === "error" &&
        errorMessage ? (
          <div
            role="alert"
            className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200"
          >
            {errorMessage}
          </div>
        ) : null}
      </div>

      <p className="text-[11px] leading-5 text-white/40">
        Community feedback is not an official mosque
        announcement. Repeated or duplicate reports may
        be rate-limited.
      </p>
    </section>
  );
}