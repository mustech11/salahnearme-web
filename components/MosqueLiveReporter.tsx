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

type ReportGroup =
  | "prayer"
  | "jumuah"
  | "capacity";

type SubmitState =
  | "idle"
  | "submitting"
  | "success"
  | "error";

type ReportOption = {
  type: ReportType;
  group: ReportGroup;
  label: string;
  shortLabel: string;
  description: string;
  loadingLabel: string;
  successMessage: string;
  tone: Tone;
  icon: IconName;
};

type Tone =
  | "emerald"
  | "purple"
  | "red"
  | "yellow"
  | "orange"
  | "cyan"
  | "blue"
  | "indigo";

type IconName =
  | "clock"
  | "microphone"
  | "users"
  | "warning"
  | "car"
  | "mosque"
  | "check"
  | "close"
  | "send"
  | "shield";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const REQUEST_TIMEOUT_MS = 15_000;
const SUCCESS_RESET_MS = 6_000;

const REPORT_OPTIONS: readonly ReportOption[] = [
  {
    type: "iqamah_started",
    group: "prayer",
    label: "Iqamah started",
    shortLabel: "Iqamah",
    description:
      "Congregational prayer has started or is starting now.",
    loadingLabel: "Sending iqamah report…",
    successMessage: "Iqamah report submitted.",
    tone: "emerald",
    icon: "clock",
  },
  {
    type: "khutbah_live",
    group: "prayer",
    label: "Khutbah live",
    shortLabel: "Khutbah",
    description:
      "The Friday sermon is currently in progress.",
    loadingLabel: "Sending khutbah report…",
    successMessage: "Khutbah report submitted.",
    tone: "purple",
    icon: "microphone",
  },
  {
    type: "correction",
    group: "prayer",
    label: "Time appears incorrect",
    shortLabel: "Incorrect time",
    description:
      "The displayed prayer or iqamah time appears to be wrong.",
    loadingLabel: "Sending correction report…",
    successMessage: "Time correction report submitted.",
    tone: "yellow",
    icon: "warning",
  },
  {
    type: "jumuah_first",
    group: "jumuah",
    label: "First Jumu’ah active",
    shortLabel: "1st Jumu’ah",
    description:
      "The first published Friday prayer session is active.",
    loadingLabel: "Sending first Jumu’ah report…",
    successMessage: "First Jumu’ah report submitted.",
    tone: "cyan",
    icon: "mosque",
  },
  {
    type: "jumuah_second",
    group: "jumuah",
    label: "Second Jumu’ah active",
    shortLabel: "2nd Jumu’ah",
    description:
      "The second published Friday prayer session is active.",
    loadingLabel: "Sending second Jumu’ah report…",
    successMessage: "Second Jumu’ah report submitted.",
    tone: "blue",
    icon: "mosque",
  },
  {
    type: "jumuah_third",
    group: "jumuah",
    label: "Third Jumu’ah active",
    shortLabel: "3rd Jumu’ah",
    description:
      "The third published Friday prayer session is active.",
    loadingLabel: "Sending third Jumu’ah report…",
    successMessage: "Third Jumu’ah report submitted.",
    tone: "indigo",
    icon: "mosque",
  },
  {
    type: "full",
    group: "capacity",
    label: "Prayer space full",
    shortLabel: "Mosque full",
    description:
      "The main prayer space has reached capacity.",
    loadingLabel: "Sending capacity report…",
    successMessage: "Full-capacity report submitted.",
    tone: "red",
    icon: "users",
  },
  {
    type: "parking_full",
    group: "capacity",
    label: "Parking full",
    shortLabel: "Parking full",
    description:
      "Mosque parking appears to be full or unavailable.",
    loadingLabel: "Sending parking report…",
    successMessage: "Parking-full report submitted.",
    tone: "orange",
    icon: "car",
  },
] as const;

const GROUPS: readonly {
  id: ReportGroup;
  label: string;
  description: string;
}[] = [
  {
    id: "prayer",
    label: "Prayer status",
    description:
      "Share what is happening with today’s prayer or khutbah.",
  },
  {
    id: "jumuah",
    label: "Jumu’ah session",
    description:
      "Identify which Friday prayer session is currently active.",
  },
  {
    id: "capacity",
    label: "Capacity & access",
    description:
      "Help visitors understand prayer-space and parking availability.",
  },
] as const;

function cleanString(
  value: string | null | undefined
): string {
  return String(value ?? "").trim();
}

function getToneClasses(
  tone: Tone,
  selected: boolean
): string {
  const styles: Record<Tone, string> = {
    emerald: selected
      ? "border-emerald-400/60 bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-400/25"
      : "border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-200 hover:border-emerald-400/45 hover:bg-emerald-500/15",
    purple: selected
      ? "border-purple-400/60 bg-purple-500/20 text-purple-100 ring-1 ring-purple-400/25"
      : "border-purple-500/25 bg-purple-500/[0.08] text-purple-200 hover:border-purple-400/45 hover:bg-purple-500/15",
    red: selected
      ? "border-red-400/60 bg-red-500/20 text-red-100 ring-1 ring-red-400/25"
      : "border-red-500/25 bg-red-500/[0.08] text-red-200 hover:border-red-400/45 hover:bg-red-500/15",
    yellow: selected
      ? "border-yellow-400/60 bg-yellow-500/20 text-yellow-100 ring-1 ring-yellow-400/25"
      : "border-yellow-500/25 bg-yellow-500/[0.08] text-yellow-200 hover:border-yellow-400/45 hover:bg-yellow-500/15",
    orange: selected
      ? "border-orange-400/60 bg-orange-500/20 text-orange-100 ring-1 ring-orange-400/25"
      : "border-orange-500/25 bg-orange-500/[0.08] text-orange-200 hover:border-orange-400/45 hover:bg-orange-500/15",
    cyan: selected
      ? "border-cyan-400/60 bg-cyan-500/20 text-cyan-100 ring-1 ring-cyan-400/25"
      : "border-cyan-500/25 bg-cyan-500/[0.08] text-cyan-200 hover:border-cyan-400/45 hover:bg-cyan-500/15",
    blue: selected
      ? "border-blue-400/60 bg-blue-500/20 text-blue-100 ring-1 ring-blue-400/25"
      : "border-blue-500/25 bg-blue-500/[0.08] text-blue-200 hover:border-blue-400/45 hover:bg-blue-500/15",
    indigo: selected
      ? "border-indigo-400/60 bg-indigo-500/20 text-indigo-100 ring-1 ring-indigo-400/25"
      : "border-indigo-500/25 bg-indigo-500/[0.08] text-indigo-200 hover:border-indigo-400/45 hover:bg-indigo-500/15",
  };

  return styles[tone];
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

  if (response.status === 401 || response.status === 403) {
    return "This report is not currently permitted.";
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
  const selectedDescriptionId = useId();

  const abortControllerRef =
    useRef<AbortController | null>(null);

  const successTimeoutRef =
    useRef<number | null>(null);

  const [selectedType, setSelectedType] =
    useState<ReportType | null>(null);

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

  const selectedOption = useMemo(
    () =>
      REPORT_OPTIONS.find(
        (option) => option.type === selectedType
      ) ?? null,
    [selectedType]
  );

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

  const clearFeedback = useCallback(() => {
    setMessage("");
    setErrorMessage("");

    if (submitState !== "submitting") {
      setSubmitState("idle");
    }
  }, [submitState]);

  const selectReport = useCallback(
    (option: ReportOption) => {
      if (isSubmitting) {
        return;
      }

      clearFeedback();

      setSelectedType((current) =>
        current === option.type
          ? null
          : option.type
      );
    },
    [clearFeedback, isSubmitting]
  );

  const sendReport = useCallback(async () => {
    if (isSubmitting || !selectedOption) {
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

    setLoadingType(selectedOption.type);
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
            report_type: selectedOption.type,
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
          selectedOption.successMessage
      );
      setSelectedType(null);

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
  }, [
    cleanMosqueId,
    isSubmitting,
    selectedOption,
    validationError,
  ]);

  return (
    <section
      aria-labelledby="mosque-live-reporter-heading"
      className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/20 p-5 sm:p-6"
    >
      <div
        aria-hidden="true"
        className="absolute -right-16 -top-16 h-40 w-40 rounded-full border border-yellow-400/[0.08] bg-yellow-400/[0.025]"
      />

      <div className="relative">
        <div className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-yellow-300">
              <Icon
                name="send"
                className="h-4 w-4"
              />
              Community report
            </div>

            <h2
              id="mosque-live-reporter-heading"
              className="mt-2 text-xl font-black text-white sm:text-2xl"
            >
              Share a live mosque update
            </h2>

            <p className="mt-2 text-sm leading-7 text-white/55">
              Select the update that best describes
              what is happening now. Reports are
              short-lived, rate-limited and combined
              with other recent community signals.
            </p>
          </div>

          <div className="inline-flex shrink-0 items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/[0.08] px-3 py-2 text-xs font-bold text-emerald-200">
            <Icon
              name="shield"
              className="h-4 w-4"
            />
            Anti-abuse protected
          </div>
        </div>

        <div className="mt-6 space-y-6">
          {GROUPS.map((group) => {
            const options = REPORT_OPTIONS.filter(
              (option) =>
                option.group === group.id
            );

            return (
              <fieldset
                key={group.id}
                disabled={
                  isSubmitting ||
                  Boolean(validationError)
                }
                className="min-w-0"
              >
                <legend className="w-full">
                  <span className="block text-sm font-black text-white">
                    {group.label}
                  </span>

                  <span className="mt-1 block text-xs leading-5 text-white/40">
                    {group.description}
                  </span>
                </legend>

                <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {options.map((option) => {
                    const isSelected =
                      selectedType === option.type;

                    const isLoading =
                      loadingType === option.type;

                    return (
                      <button
                        key={option.type}
                        type="button"
                        disabled={
                          isSubmitting ||
                          Boolean(validationError)
                        }
                        aria-pressed={isSelected}
                        aria-busy={isLoading}
                        aria-describedby={
                          isSelected
                            ? selectedDescriptionId
                            : feedbackId
                        }
                        onClick={() =>
                          selectReport(option)
                        }
                        className={`group relative min-h-24 rounded-2xl border p-4 text-left transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 disabled:cursor-not-allowed disabled:opacity-45 ${getToneClasses(
                          option.tone,
                          isSelected
                        )}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-current/15 bg-black/15">
                            {isLoading ? (
                              <span
                                aria-hidden="true"
                                className="h-4 w-4 animate-spin rounded-full border-2 border-current/25 border-t-current"
                              />
                            ) : (
                              <Icon
                                name={option.icon}
                                className="h-5 w-5"
                              />
                            )}
                          </span>

                          <span
                            className={`flex h-6 w-6 items-center justify-center rounded-full border transition ${
                              isSelected
                                ? "border-current/35 bg-current/10 opacity-100"
                                : "border-white/10 bg-black/15 opacity-40 group-hover:opacity-70"
                            }`}
                          >
                            {isSelected ? (
                              <Icon
                                name="check"
                                className="h-3.5 w-3.5"
                              />
                            ) : null}
                          </span>
                        </div>

                        <div className="mt-4 text-sm font-black">
                          {isLoading
                            ? option.loadingLabel
                            : option.shortLabel}
                        </div>

                        <div className="mt-1 text-xs leading-5 opacity-70">
                          {option.description}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}
        </div>

        <div
          id={selectedDescriptionId}
          className="mt-6"
        >
          {selectedOption ? (
            <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/[0.065] p-4 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${getToneClasses(
                      selectedOption.tone,
                      true
                    )}`}
                  >
                    <Icon
                      name={selectedOption.icon}
                      className="h-5 w-5"
                    />
                  </span>

                  <div className="min-w-0">
                    <div className="text-xs font-black uppercase tracking-[0.16em] text-yellow-300">
                      Selected report
                    </div>

                    <div className="mt-1 font-black text-white">
                      {selectedOption.label}
                    </div>

                    <p className="mt-1 text-xs leading-5 text-white/50">
                      {selectedOption.description}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => {
                      setSelectedType(null);
                      clearFeedback();
                    }}
                    className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-bold text-white/60 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Icon
                      name="close"
                      className="mr-2 h-4 w-4"
                    />
                    Cancel
                  </button>

                  <button
                    type="button"
                    disabled={
                      isSubmitting ||
                      Boolean(validationError)
                    }
                    onClick={() => {
                      void sendReport();
                    }}
                    className="inline-flex min-h-11 items-center justify-center rounded-xl border border-yellow-400/30 bg-yellow-500/15 px-5 py-2 text-sm font-black text-yellow-100 transition hover:bg-yellow-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <span
                          aria-hidden="true"
                          className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current/25 border-t-current"
                        />
                        Sending…
                      </>
                    ) : (
                      <>
                        <Icon
                          name="send"
                          className="mr-2 h-4 w-4"
                        />
                        Submit live update
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-black/15 p-4 text-sm leading-6 text-white/40">
              Select one report above. You will be
              asked to confirm it before anything is
              submitted.
            </div>
          )}
        </div>

        <div
          id={feedbackId}
          aria-live="polite"
          aria-atomic="true"
          className="mt-4"
        >
          {validationError &&
          !errorMessage ? (
            <FeedbackMessage
              tone="warning"
              icon="warning"
            >
              {validationError}
            </FeedbackMessage>
          ) : null}

          {submitState === "success" &&
          message ? (
            <FeedbackMessage
              tone="success"
              icon="check"
              role="status"
            >
              {message}
            </FeedbackMessage>
          ) : null}

          {submitState === "error" &&
          errorMessage ? (
            <FeedbackMessage
              tone="error"
              icon="warning"
              role="alert"
            >
              {errorMessage}
            </FeedbackMessage>
          ) : null}
        </div>

        <div className="mt-5 flex items-start gap-3 border-t border-white/10 pt-5 text-[0.7rem] leading-5 text-white/35">
          <Icon
            name="shield"
            className="mt-0.5 h-4 w-4 shrink-0"
          />

          <p>
            Community feedback is not an official
            mosque announcement. Only report what you
            can currently observe. Duplicate,
            misleading or excessive reports may be
            rejected or rate-limited.
          </p>
        </div>
      </div>
    </section>
  );
}

function FeedbackMessage({
  children,
  tone,
  icon,
  role,
}: {
  children: React.ReactNode;
  tone: "success" | "warning" | "error";
  icon: IconName;
  role?: "status" | "alert";
}) {
  const className =
    tone === "success"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
      : tone === "warning"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-100"
        : "border-red-500/30 bg-red-500/10 text-red-100";

  return (
    <div
      role={role}
      className={`flex items-start gap-3 rounded-2xl border p-4 text-sm leading-6 ${className}`}
    >
      <Icon
        name={icon}
        className="mt-0.5 h-5 w-5 shrink-0"
      />

      <span>{children}</span>
    </div>
  );
}

function Icon({
  name,
  className,
}: {
  name: IconName;
  className?: string;
}) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };

  if (name === "clock") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    );
  }

  if (name === "microphone") {
    return (
      <svg {...common}>
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 10a7 7 0 0 0 14 0M12 17v4M9 21h6" />
      </svg>
    );
  }

  if (name === "users") {
    return (
      <svg {...common}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    );
  }

  if (name === "warning") {
    return (
      <svg {...common}>
        <path d="M12 3 2.8 20h18.4L12 3Z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </svg>
    );
  }

  if (name === "car") {
    return (
      <svg {...common}>
        <path d="m5 17-1 2M19 17l1 2" />
        <path d="M3 13h18l-2-6H5l-2 6Z" />
        <path d="M5 13v5h14v-5" />
        <circle cx="7" cy="16" r="1" />
        <circle cx="17" cy="16" r="1" />
      </svg>
    );
  }

  if (name === "mosque") {
    return (
      <svg {...common}>
        <path d="M5 21V10M19 21V10M3 21h18" />
        <path d="M5 10h14M7 10V7h10v3" />
        <path d="M12 3c1.6 1.1 2.4 2.4 2.4 4H9.6C9.6 5.4 10.4 4.1 12 3Z" />
        <path d="M10 21v-5a2 2 0 0 1 4 0v5" />
      </svg>
    );
  }

  if (name === "check") {
    return (
      <svg {...common}>
        <path d="m5 12 4 4L19 6" />
      </svg>
    );
  }

  if (name === "close") {
    return (
      <svg {...common}>
        <path d="M6 6l12 12M18 6 6 18" />
      </svg>
    );
  }

  if (name === "shield") {
    return (
      <svg {...common}>
        <path d="M12 3 5 6v5c0 4.8 2.9 8.1 7 10 4.1-1.9 7-5.2 7-10V6l-7-3Z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="m22 2-7 20-4-9-9-4 20-7Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}