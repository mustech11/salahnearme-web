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
  mosqueName?: string | null;
  mosqueSlug?: string | null;
  source?: string;
};

type SubmitState =
  | "idle"
  | "submitting"
  | "success"
  | "error";

type ReportType =
  | "prayer_time_wrong"
  | "iqamah_missing"
  | "jumuah_time_wrong"
  | "location_wrong"
  | "facilities_wrong"
  | "mosque_closed_or_moved"
  | "duplicate_mosque"
  | "other";

type CorrectionReportResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  report_id?: string;
};

type ReportTypeOption = {
  value: ReportType;
  label: string;
  description: string;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const EMAIL_REGEX =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SLUG_REGEX =
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const REQUEST_TIMEOUT_MS = 30_000;

const MIN_MESSAGE_LENGTH = 10;
const MAX_MESSAGE_LENGTH = 2_000;
const MAX_NAME_LENGTH = 120;
const MAX_EMAIL_LENGTH = 160;
const MAX_SOURCE_LENGTH = 80;

const REPORT_TYPES: ReadonlyArray<ReportTypeOption> = [
  {
    value: "prayer_time_wrong",
    label: "Prayer time is wrong",
    description:
      "A beginning time or another published prayer time appears incorrect.",
  },
  {
    value: "iqamah_missing",
    label: "Iqamah time is missing",
    description:
      "An iqamah time is missing or not currently shown.",
  },
  {
    value: "jumuah_time_wrong",
    label: "Jumuʿah time is wrong",
    description:
      "A Friday khutbah or salah session time appears incorrect.",
  },
  {
    value: "location_wrong",
    label: "Mosque location is wrong",
    description:
      "The address, postcode, map destination or coordinates appear incorrect.",
  },
  {
    value: "facilities_wrong",
    label: "Facilities are incorrect",
    description:
      "Accessibility, parking, women’s facilities or another service is wrong.",
  },
  {
    value: "mosque_closed_or_moved",
    label: "Mosque is closed or moved",
    description:
      "The mosque may have closed permanently or moved to another address.",
  },
  {
    value: "duplicate_mosque",
    label: "Duplicate mosque listing",
    description:
      "This mosque appears to have more than one SalahNearMe listing.",
  },
  {
    value: "other",
    label: "Other issue",
    description:
      "Another mosque-data issue not covered by the options above.",
  },
];

const ALLOWED_REPORT_TYPES = new Set<ReportType>(
  REPORT_TYPES.map((item) => item.value)
);

const ALLOWED_SOURCES = new Set([
  "mosque_page",
  "mosque_timetable_page",
  "city_mosques_page",
  "pray_near_me",
  "travel_page",
]);

function cleanText(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function normaliseSource(value: string): string {
  const cleaned = cleanText(value)
    .toLowerCase()
    .replace(/\s+/g, "_")
    .slice(0, MAX_SOURCE_LENGTH);

  return ALLOWED_SOURCES.has(cleaned)
    ? cleaned
    : "mosque_page";
}

function getSourceLabel(source: string): string {
  if (source === "mosque_timetable_page") {
    return "Monthly timetable page";
  }

  if (source === "city_mosques_page") {
    return "City mosque directory";
  }

  if (source === "pray_near_me") {
    return "Pray Near Me";
  }

  if (source === "travel_page") {
    return "Travel discovery page";
  }

  return "Mosque profile page";
}

function normaliseReportType(
  value: unknown
): ReportType {
  if (
    typeof value === "string" &&
    ALLOWED_REPORT_TYPES.has(
      value as ReportType
    )
  ) {
    return value as ReportType;
  }

  return "prayer_time_wrong";
}

async function readResponse(
  response: Response
): Promise<CorrectionReportResponse> {
  try {
    const value: unknown =
      await response.json();

    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value)
    ) {
      return {};
    }

    return value as CorrectionReportResponse;
  } catch {
    return {};
  }
}

export default function MosqueCorrectionReportForm({
  mosqueId,
  mosqueName,
  mosqueSlug,
  source = "mosque_page",
}: Props) {
  const reportTypeId = useId();
  const messageId = useId();
  const reporterNameId = useId();
  const reporterEmailId = useId();
  const feedbackId = useId();
  const honeypotId = useId();

  const abortControllerRef =
    useRef<AbortController | null>(null);

  const mountedRef = useRef(true);

  const safeSource = useMemo(
    () => normaliseSource(source),
    [source]
  );

  const safeMosqueName = useMemo(
    () => cleanText(mosqueName),
    [mosqueName]
  );

  const safeMosqueSlug = useMemo(() => {
    const cleaned = cleanText(
      mosqueSlug
    ).toLowerCase();

    return SLUG_REGEX.test(cleaned)
      ? cleaned
      : null;
  }, [mosqueSlug]);

  const [isOpen, setIsOpen] =
    useState(false);

  const [reportType, setReportType] =
    useState<ReportType>(
      "prayer_time_wrong"
    );

  const [message, setMessage] =
    useState("");

  const [reporterName, setReporterName] =
    useState("");

  const [reporterEmail, setReporterEmail] =
    useState("");

  const [website, setWebsite] =
    useState("");

  const [submitState, setSubmitState] =
    useState<SubmitState>("idle");

  const [successMessage, setSuccessMessage] =
    useState("");

  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, []);

  const selectedReportType = useMemo(
    () =>
      REPORT_TYPES.find(
        (item) =>
          item.value === reportType
      ) ?? REPORT_TYPES[0],
    [reportType]
  );

  const validationError = useMemo(() => {
    if (!UUID_REGEX.test(mosqueId)) {
      return "A valid mosque is required before submitting a correction.";
    }

    if (
      !ALLOWED_REPORT_TYPES.has(
        reportType
      )
    ) {
      return "Select a valid correction type.";
    }

    const cleanMessage =
      message.trim();

    if (
      cleanMessage.length <
      MIN_MESSAGE_LENGTH
    ) {
      return `Describe the issue using at least ${MIN_MESSAGE_LENGTH} characters.`;
    }

    if (
      cleanMessage.length >
      MAX_MESSAGE_LENGTH
    ) {
      return `The report must not exceed ${MAX_MESSAGE_LENGTH.toLocaleString()} characters.`;
    }

    if (
      reporterName.length >
      MAX_NAME_LENGTH
    ) {
      return `Your name must not exceed ${MAX_NAME_LENGTH.toLocaleString()} characters.`;
    }

    const cleanEmail =
      reporterEmail.trim();

    if (
      cleanEmail.length >
      MAX_EMAIL_LENGTH
    ) {
      return `Your email must not exceed ${MAX_EMAIL_LENGTH.toLocaleString()} characters.`;
    }

    if (
      cleanEmail &&
      !EMAIL_REGEX.test(cleanEmail)
    ) {
      return "Enter a valid email address or leave the email field empty.";
    }

    return "";
  }, [
    message,
    mosqueId,
    reportType,
    reporterEmail,
    reporterName,
  ]);

  const isSubmitting =
    submitState === "submitting";

  const canSubmit =
    !isSubmitting &&
    !validationError;

  const clearFeedback = useCallback(() => {
    setSubmitState("idle");
    setSuccessMessage("");
    setErrorMessage("");
  }, []);

  const closeForm = useCallback(() => {
    if (isSubmitting) {
      return;
    }

    setIsOpen(false);
    clearFeedback();
  }, [
    clearFeedback,
    isSubmitting,
  ]);

  const resetForm = useCallback(() => {
    setReportType(
      "prayer_time_wrong"
    );
    setMessage("");
    setReporterName("");
    setReporterEmail("");
    setWebsite("");
  }, []);

  const submitReport = useCallback(
    async (
      event: React.FormEvent<HTMLFormElement>
    ) => {
      event.preventDefault();

      if (isSubmitting) {
        return;
      }

      setSuccessMessage("");
      setErrorMessage("");

      if (validationError) {
        setSubmitState("error");
        setErrorMessage(validationError);
        return;
      }

      /*
       * Honeypot field. Bots frequently fill
       * hidden website fields.
       */
      if (website.trim()) {
        setSubmitState("success");
        setSuccessMessage(
          "JazakAllahu khayran. Your correction report has been submitted."
        );
        resetForm();
        setIsOpen(false);
        return;
      }

      abortControllerRef.current?.abort();

      const controller =
        new AbortController();

      abortControllerRef.current =
        controller;

      let timedOut = false;

      const timeoutId =
        window.setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, REQUEST_TIMEOUT_MS);

      setSubmitState("submitting");

      try {
        const pageUrl =
          window.location.href;

        const response = await fetch(
          "/api/mosque/correction-report",
          {
            method: "POST",
            headers: {
              Accept:
                "application/json",
              "Content-Type":
                "application/json",
            },
            credentials: "same-origin",
            cache: "no-store",
            signal: controller.signal,
            body: JSON.stringify({
              mosque_id: mosqueId,
              report_type:
                reportType,
              report_message:
                message.trim(),
              reporter_name:
                reporterName.trim() ||
                null,
              reporter_email:
                reporterEmail
                  .trim()
                  .toLowerCase() ||
                null,
              page_url: pageUrl,
              metadata: {
                source: safeSource,
                source_label:
                  getSourceLabel(
                    safeSource
                  ),
                mosque_name:
                  safeMosqueName ||
                  null,
                mosque_slug:
                  safeMosqueSlug,
                submitted_path:
                  window.location
                    .pathname,
                user_timezone:
                  Intl.DateTimeFormat()
                    .resolvedOptions()
                    .timeZone ||
                  null,
              },
            }),
          }
        );

        const json =
          await readResponse(
            response
          );

        if (!mountedRef.current) {
          return;
        }

        if (
          !response.ok ||
          json.ok !== true
        ) {
          setSubmitState("error");

          if (
            response.status === 429
          ) {
            setErrorMessage(
              cleanText(json.error) ||
                "Too many correction reports have been submitted recently. Please wait before trying again."
            );
            return;
          }

          setErrorMessage(
            cleanText(json.error) ||
              cleanText(
                json.message
              ) ||
              "Could not submit the correction report."
          );
          return;
        }

        resetForm();
        setIsOpen(false);
        setSubmitState("success");
        setSuccessMessage(
          cleanText(json.message) ||
            "JazakAllahu khayran. Your correction report has been submitted for review."
        );
      } catch (error) {
        if (!mountedRef.current) {
          return;
        }

        setSubmitState("error");

        if (
          error instanceof
            DOMException &&
          error.name ===
            "AbortError"
        ) {
          setErrorMessage(
            timedOut
              ? "The correction request timed out. Please try again."
              : "The correction request was cancelled."
          );
          return;
        }

        console.error(
          "Mosque correction report submission failed:",
          error
        );

        setErrorMessage(
          "Could not submit the correction report. Please try again."
        );
      } finally {
        window.clearTimeout(
          timeoutId
        );

        if (
          abortControllerRef.current ===
          controller
        ) {
          abortControllerRef.current =
            null;
        }

        if (mountedRef.current) {
          setSubmitState(
            (currentState) =>
              currentState ===
              "submitting"
                ? "idle"
                : currentState
          );
        }
      }
    },
    [
      isSubmitting,
      message,
      mosqueId,
      reportType,
      reporterEmail,
      reporterName,
      resetForm,
      safeMosqueName,
      safeMosqueSlug,
      safeSource,
      validationError,
      website,
    ]
  );

  return (
    <section
      aria-labelledby={`${feedbackId}-heading`}
      className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-5 md:p-6"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-yellow-400">
            Help improve this mosque page
          </div>

          <h2
            id={`${feedbackId}-heading`}
            className="mt-2 text-2xl font-black text-white"
          >
            Report incorrect mosque data
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-7 text-white/55">
            Report incorrect prayer
            times, Jumuʿah sessions,
            facilities, locations or
            duplicate mosque listings.
            Every report is reviewed
            before public information is
            changed.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (isOpen) {
              closeForm();
              return;
            }

            setIsOpen(true);
            clearFeedback();
          }}
          disabled={isSubmitting}
          aria-expanded={isOpen}
          aria-controls={`${feedbackId}-form`}
          className="w-fit rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-5 py-3 text-sm font-black text-yellow-300 transition hover:bg-yellow-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isOpen
            ? "Close report form"
            : "Report an issue"}
        </button>
      </div>

      <div
        id={feedbackId}
        aria-live="polite"
        aria-atomic="true"
      >
        {submitState ===
        "success" ? (
          <div
            role="status"
            className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-100"
          >
            {successMessage}
          </div>
        ) : null}

        {submitState ===
        "error" ? (
          <div
            role="alert"
            className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-100"
          >
            {errorMessage}
          </div>
        ) : null}
      </div>

      {!isOpen ? (
        <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm leading-7 text-white/50">
          Urgent prayer-time matters
          should also be confirmed
          directly with the mosque.
          SalahNearMe reports are not
          official mosque announcements.
        </div>
      ) : (
        <form
          id={`${feedbackId}-form`}
          onSubmit={(event) => {
            void submitReport(event);
          }}
          noValidate
          className="mt-6 grid gap-4"
        >
          <div
            aria-hidden="true"
            className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden"
          >
            <label
              htmlFor={honeypotId}
            >
              Website
            </label>

            <input
              id={honeypotId}
              name="website"
              type="text"
              value={website}
              onChange={(event) =>
                setWebsite(
                  event.target.value
                )
              }
              tabIndex={-1}
              autoComplete="off"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
            <div>
              <label
                htmlFor={reportTypeId}
                className="text-sm font-bold text-white/80"
              >
                What needs correcting?
              </label>

              <select
                id={reportTypeId}
                value={reportType}
                onChange={(event) => {
                  setReportType(
                    normaliseReportType(
                      event.target
                        .value
                    )
                  );
                  clearFeedback();
                }}
                disabled={isSubmitting}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none transition focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/30 disabled:opacity-60"
              >
                {REPORT_TYPES.map(
                  (item) => (
                    <option
                      key={item.value}
                      value={item.value}
                    >
                      {item.label}
                    </option>
                  )
                )}
              </select>

              <p className="mt-2 text-xs leading-5 text-white/40">
                {
                  selectedReportType.description
                }
              </p>
            </div>

            <div>
              <div className="text-sm font-bold text-white/80">
                Report source
              </div>

              <div className="mt-2 min-h-12 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/60">
                {getSourceLabel(
                  safeSource
                )}
              </div>
            </div>
          </div>

          <div>
            <label
              htmlFor={messageId}
              className="text-sm font-bold text-white/80"
            >
              Describe the issue
            </label>

            <textarea
              id={messageId}
              value={message}
              onChange={(event) => {
                setMessage(
                  event.target.value
                );
                clearFeedback();
              }}
              rows={5}
              required
              minLength={
                MIN_MESSAGE_LENGTH
              }
              maxLength={
                MAX_MESSAGE_LENGTH
              }
              disabled={isSubmitting}
              aria-invalid={Boolean(
                validationError
              )}
              aria-describedby={`${messageId}-help ${feedbackId}`}
              placeholder="Example: Isha iqamah is shown as 8:30pm, but the mosque timetable displays 8:45pm."
              className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/30 disabled:opacity-60"
            />

            <div
              id={`${messageId}-help`}
              className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-white/35"
            >
              <span>
                Include the correct
                information and how it
                can be verified.
              </span>

              <span>
                {message.length.toLocaleString(
                  "en-GB"
                )}{" "}
                /{" "}
                {MAX_MESSAGE_LENGTH.toLocaleString(
                  "en-GB"
                )}
              </span>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor={
                  reporterNameId
                }
                className="text-sm font-bold text-white/80"
              >
                Your name{" "}
                <span className="font-normal text-white/40">
                  optional
                </span>
              </label>

              <input
                id={reporterNameId}
                value={reporterName}
                onChange={(event) => {
                  setReporterName(
                    event.target.value
                  );
                  clearFeedback();
                }}
                maxLength={
                  MAX_NAME_LENGTH
                }
                disabled={isSubmitting}
                autoComplete="name"
                className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/30 disabled:opacity-60"
                placeholder="Optional"
              />
            </div>

            <div>
              <label
                htmlFor={
                  reporterEmailId
                }
                className="text-sm font-bold text-white/80"
              >
                Email{" "}
                <span className="font-normal text-white/40">
                  optional
                </span>
              </label>

              <input
                id={reporterEmailId}
                value={reporterEmail}
                onChange={(event) => {
                  setReporterEmail(
                    event.target.value
                  );
                  clearFeedback();
                }}
                maxLength={
                  MAX_EMAIL_LENGTH
                }
                type="email"
                inputMode="email"
                autoComplete="email"
                disabled={isSubmitting}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/30 disabled:opacity-60"
                placeholder="Optional, for follow-up"
              />
            </div>
          </div>

          {validationError &&
          submitState !== "error" ? (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-200">
              {validationError}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={!canSubmit}
              aria-busy={isSubmitting}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-yellow-500 px-5 py-3 text-sm font-black text-black transition hover:bg-yellow-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <span
                    aria-hidden="true"
                    className="mr-2 size-4 animate-spin rounded-full border-2 border-black/30 border-t-black"
                  />
                  Submitting...
                </>
              ) : (
                "Submit correction"
              )}
            </button>

            <button
              type="button"
              onClick={closeForm}
              disabled={isSubmitting}
              className="min-h-11 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white/70 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>

            <p className="text-xs leading-6 text-white/40">
              Reports are reviewed
              before public data is
              changed.
            </p>
          </div>
        </form>
      )}
    </section>
  );
}