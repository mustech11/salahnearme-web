"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

type Props = {
  mosqueId: string;
  mosqueName?: string | null;
  mosqueSlug?: string | null;
  source?: string;
};

type SubmitState = "idle" | "submitting" | "success" | "error";

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

type IconName =
  | "alert"
  | "building"
  | "calendar"
  | "check"
  | "clock"
  | "close"
  | "duplicate"
  | "edit"
  | "email"
  | "facility"
  | "info"
  | "location"
  | "person"
  | "prayer"
  | "save"
  | "send"
  | "shield"
  | "sparkles";

type ReportTypeOption = {
  value: ReportType;
  label: string;
  shortLabel: string;
  description: string;
  example: string;
  icon: IconName;
};

type DraftState = {
  reportType: ReportType;
  message: string;
  reporterName: string;
  reporterEmail: string;
  confirmationChecked: boolean;
  updatedAt: number;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const REQUEST_TIMEOUT_MS = 30_000;
const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1_000;
const DRAFT_SAVE_DELAY_MS = 500;
const MIN_MESSAGE_LENGTH = 10;
const MAX_MESSAGE_LENGTH = 2_000;
const MAX_NAME_LENGTH = 120;
const MAX_EMAIL_LENGTH = 160;
const MAX_SOURCE_LENGTH = 80;

const REPORT_TYPES: ReadonlyArray<ReportTypeOption> = [
  {
    value: "prayer_time_wrong",
    label: "Prayer time is wrong",
    shortLabel: "Prayer time",
    description: "A beginning time or another published prayer time appears incorrect.",
    example: "State the salah, the time shown and the correct time.",
    icon: "prayer",
  },
  {
    value: "iqamah_missing",
    label: "Iqamah time is missing",
    shortLabel: "Iqamah missing",
    description: "An iqamah time is missing or not currently shown.",
    example: "Mention the salah and the iqamah time displayed by the mosque.",
    icon: "clock",
  },
  {
    value: "jumuah_time_wrong",
    label: "Jumuʿah time is wrong",
    shortLabel: "Jumuʿah time",
    description: "A Friday khutbah or salah session time appears incorrect.",
    example: "Include the correct session and whether multiple sessions operate.",
    icon: "calendar",
  },
  {
    value: "location_wrong",
    label: "Mosque location is wrong",
    shortLabel: "Location",
    description: "The address, postcode, map destination or coordinates appear incorrect.",
    example: "Provide the correct address, postcode or map destination where possible.",
    icon: "location",
  },
  {
    value: "facilities_wrong",
    label: "Facilities are incorrect",
    shortLabel: "Facilities",
    description: "Accessibility, parking, women’s facilities or another service is wrong.",
    example: "Specify the facility and what the correct status should be.",
    icon: "facility",
  },
  {
    value: "mosque_closed_or_moved",
    label: "Mosque is closed or moved",
    shortLabel: "Closed or moved",
    description: "The mosque may have closed permanently or moved to another address.",
    example: "Explain whether it closed or moved and include the new address if known.",
    icon: "building",
  },
  {
    value: "duplicate_mosque",
    label: "Duplicate mosque listing",
    shortLabel: "Duplicate",
    description: "This mosque appears to have more than one SalahNearMe listing.",
    example: "Include the name or URL of the other listing if available.",
    icon: "duplicate",
  },
  {
    value: "other",
    label: "Other issue",
    shortLabel: "Other issue",
    description: "Another mosque-data issue not covered by the options above.",
    example: "Describe the issue clearly and include the correct information.",
    icon: "edit",
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
  return typeof value === "string" ? value.trim() : "";
}

function normaliseSource(value: string): string {
  const cleaned = cleanText(value)
    .toLowerCase()
    .replace(/\s+/g, "_")
    .slice(0, MAX_SOURCE_LENGTH);

  return ALLOWED_SOURCES.has(cleaned) ? cleaned : "mosque_page";
}

function getSourceLabel(source: string): string {
  if (source === "mosque_timetable_page") return "Monthly timetable page";
  if (source === "city_mosques_page") return "City mosque directory";
  if (source === "pray_near_me") return "Pray Near Me";
  if (source === "travel_page") return "Travel discovery page";
  return "Mosque profile page";
}

function normaliseReportType(value: unknown): ReportType {
  return typeof value === "string" &&
    ALLOWED_REPORT_TYPES.has(value as ReportType)
    ? (value as ReportType)
    : "prayer_time_wrong";
}

function getDraftKey(mosqueId: string, source: string): string {
  return `salahnearme:mosque-correction:${mosqueId}:${source}`;
}

function parseDraft(value: string | null): DraftState | null {
  if (!value) return null;

  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;

    const draft = parsed as Partial<DraftState>;
    const updatedAt = typeof draft.updatedAt === "number" ? draft.updatedAt : 0;
    if (!updatedAt || Date.now() - updatedAt > DRAFT_MAX_AGE_MS) return null;

    return {
      reportType: normaliseReportType(draft.reportType),
      message:
        typeof draft.message === "string"
          ? draft.message.slice(0, MAX_MESSAGE_LENGTH)
          : "",
      reporterName:
        typeof draft.reporterName === "string"
          ? draft.reporterName.slice(0, MAX_NAME_LENGTH)
          : "",
      reporterEmail:
        typeof draft.reporterEmail === "string"
          ? draft.reporterEmail.slice(0, MAX_EMAIL_LENGTH)
          : "",
      confirmationChecked: draft.confirmationChecked === true,
      updatedAt,
    };
  } catch {
    return null;
  }
}

async function readResponse(response: Response): Promise<CorrectionReportResponse> {
  try {
    const value: unknown = await response.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return value as CorrectionReportResponse;
  } catch {
    return {};
  }
}

function getApiErrorMessage(
  response: Response,
  json: CorrectionReportResponse
): string {
  const apiMessage = cleanText(json.error) || cleanText(json.message);
  if (apiMessage) return apiMessage;
  if (response.status === 400) return "Some report details were invalid. Review the form and try again.";
  if (response.status === 401) return "Your session is no longer valid. Refresh the page and try again.";
  if (response.status === 403) return "This correction report could not be accepted from your current session.";
  if (response.status === 404) return "This mosque could not be found. Refresh the page before submitting again.";
  if (response.status === 409) return "A very similar report may already exist for this mosque.";
  if (response.status === 429) return "Too many correction reports have been submitted recently. Please wait before trying again.";
  if (response.status >= 500) return "The correction-report service is temporarily unavailable. Please try again shortly.";
  return "Could not submit the correction report.";
}

export default function MosqueCorrectionReportForm({
  mosqueId,
  mosqueName,
  mosqueSlug,
  source = "mosque_page",
}: Props) {
  const headingId = useId();
  const formId = useId();
  const reportTypeHeadingId = useId();
  const messageId = useId();
  const reporterNameId = useId();
  const reporterEmailId = useId();
  const confirmationId = useId();
  const feedbackId = useId();
  const honeypotId = useId();

  const abortControllerRef = useRef<AbortController | null>(null);
  const draftTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const restoredDraftRef = useRef(false);

  const safeSource = useMemo(() => normaliseSource(source), [source]);
  const safeMosqueName = useMemo(() => cleanText(mosqueName), [mosqueName]);
  const safeMosqueSlug = useMemo(() => {
    const cleaned = cleanText(mosqueSlug).toLowerCase();
    return SLUG_REGEX.test(cleaned) ? cleaned : null;
  }, [mosqueSlug]);
  const draftKey = useMemo(
    () => getDraftKey(mosqueId, safeSource),
    [mosqueId, safeSource]
  );

  const [isOpen, setIsOpen] = useState(false);
  const [reportType, setReportType] = useState<ReportType>("prayer_time_wrong");
  const [message, setMessage] = useState("");
  const [reporterName, setReporterName] = useState("");
  const [reporterEmail, setReporterEmail] = useState("");
  const [confirmationChecked, setConfirmationChecked] = useState(false);
  const [website, setWebsite] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [draftRestored, setDraftRestored] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortControllerRef.current?.abort();
      if (draftTimerRef.current) window.clearTimeout(draftTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (
      restoredDraftRef.current ||
      typeof window === "undefined" ||
      !UUID_REGEX.test(mosqueId)
    ) {
      return;
    }

    restoredDraftRef.current = true;
    const draft = parseDraft(window.localStorage.getItem(draftKey));

    if (!draft) {
      window.localStorage.removeItem(draftKey);
      return;
    }

    setReportType(draft.reportType);
    setMessage(draft.message);
    setReporterName(draft.reporterName);
    setReporterEmail(draft.reporterEmail);
    setConfirmationChecked(draft.confirmationChecked);
    setDraftRestored(true);

    if (draft.message || draft.reporterName || draft.reporterEmail) {
      setIsOpen(true);
    }
  }, [draftKey, mosqueId]);

  const selectedReportType = useMemo(
    () => REPORT_TYPES.find((item) => item.value === reportType) ?? REPORT_TYPES[0],
    [reportType]
  );

  const messageLength = message.trim().length;
  const validationError = useMemo(() => {
    if (!UUID_REGEX.test(mosqueId)) return "A valid mosque is required before submitting a correction.";
    if (!ALLOWED_REPORT_TYPES.has(reportType)) return "Select a valid correction type.";
    if (messageLength < MIN_MESSAGE_LENGTH) return `Describe the issue using at least ${MIN_MESSAGE_LENGTH} characters.`;
    if (messageLength > MAX_MESSAGE_LENGTH) return `The report must not exceed ${MAX_MESSAGE_LENGTH.toLocaleString("en-GB")} characters.`;
    if (reporterName.length > MAX_NAME_LENGTH) return `Your name must not exceed ${MAX_NAME_LENGTH.toLocaleString("en-GB")} characters.`;

    const cleanEmail = reporterEmail.trim();
    if (cleanEmail.length > MAX_EMAIL_LENGTH) return `Your email must not exceed ${MAX_EMAIL_LENGTH.toLocaleString("en-GB")} characters.`;
    if (cleanEmail && !EMAIL_REGEX.test(cleanEmail)) return "Enter a valid email address or leave the email field empty.";
    if (!confirmationChecked) return "Confirm that the information is accurate to the best of your knowledge.";
    return "";
  }, [confirmationChecked, messageLength, mosqueId, reportType, reporterEmail, reporterName]);

  const isSubmitting = submitState === "submitting";
  const canSubmit = !isSubmitting && !validationError;
  const hasDraftContent = Boolean(
    message.trim() ||
      reporterName.trim() ||
      reporterEmail.trim() ||
      confirmationChecked ||
      reportType !== "prayer_time_wrong"
  );

  const clearFeedback = useCallback(() => {
    setSubmitState("idle");
    setSuccessMessage("");
    setErrorMessage("");
  }, []);

  const removeSavedDraft = useCallback(() => {
    if (typeof window !== "undefined") window.localStorage.removeItem(draftKey);
    setDraftRestored(false);
  }, [draftKey]);

  const resetForm = useCallback(() => {
    setReportType("prayer_time_wrong");
    setMessage("");
    setReporterName("");
    setReporterEmail("");
    setConfirmationChecked(false);
    setWebsite("");
    removeSavedDraft();
  }, [removeSavedDraft]);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !restoredDraftRef.current ||
      !UUID_REGEX.test(mosqueId)
    ) {
      return;
    }

    if (draftTimerRef.current) window.clearTimeout(draftTimerRef.current);

    if (!hasDraftContent) {
      window.localStorage.removeItem(draftKey);
      return;
    }

    draftTimerRef.current = window.setTimeout(() => {
      const draft: DraftState = {
        reportType,
        message,
        reporterName,
        reporterEmail,
        confirmationChecked,
        updatedAt: Date.now(),
      };
      window.localStorage.setItem(draftKey, JSON.stringify(draft));
    }, DRAFT_SAVE_DELAY_MS);

    return () => {
      if (draftTimerRef.current) window.clearTimeout(draftTimerRef.current);
    };
  }, [confirmationChecked, draftKey, hasDraftContent, message, mosqueId, reportType, reporterEmail, reporterName]);

  const closeForm = useCallback(() => {
    if (isSubmitting) return;
    setIsOpen(false);
    clearFeedback();
  }, [clearFeedback, isSubmitting]);

  const submitReport = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (isSubmitting) return;

      setSuccessMessage("");
      setErrorMessage("");

      if (validationError) {
        setSubmitState("error");
        setErrorMessage(validationError);
        return;
      }

      if (website.trim()) {
        resetForm();
        setIsOpen(false);
        setSubmitState("success");
        setSuccessMessage("JazakAllahu khayran. Your correction report has been submitted.");
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

      setSubmitState("submitting");

      try {
        const response = await fetch("/api/mosque/correction-report", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
          body: JSON.stringify({
            mosque_id: mosqueId,
            report_type: reportType,
            report_message: message.trim(),
            reporter_name: reporterName.trim() || null,
            reporter_email: reporterEmail.trim().toLowerCase() || null,
            page_url: window.location.href,
            metadata: {
              source: safeSource,
              source_label: getSourceLabel(safeSource),
              mosque_name: safeMosqueName || null,
              mosque_slug: safeMosqueSlug,
              submitted_path: window.location.pathname,
              user_timezone:
                Intl.DateTimeFormat().resolvedOptions().timeZone || null,
              accuracy_confirmed: true,
              draft_restored: draftRestored,
            },
          }),
        });

        const json = await readResponse(response);
        if (!mountedRef.current) return;

        if (!response.ok || json.ok !== true) {
          setSubmitState("error");
          setErrorMessage(getApiErrorMessage(response, json));
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
        if (!mountedRef.current) return;
        setSubmitState("error");

        if (error instanceof DOMException && error.name === "AbortError") {
          setErrorMessage(
            timedOut
              ? "The correction request timed out. Please try again."
              : "The correction request was cancelled."
          );
          return;
        }

        console.error("Mosque correction report submission failed:", error);
        setErrorMessage("Could not submit the correction report. Please try again.");
      } finally {
        window.clearTimeout(timeoutId);
        if (abortControllerRef.current === controller) abortControllerRef.current = null;
        if (mountedRef.current) {
          setSubmitState((currentState) =>
            currentState === "submitting" ? "idle" : currentState
          );
        }
      }
    },
    [draftRestored, isSubmitting, message, mosqueId, reportType, reporterEmail, reporterName, resetForm, safeMosqueName, safeMosqueSlug, safeSource, validationError, website]
  );

  return (
    <section
      aria-labelledby={headingId}
      className="luxe-card relative isolate overflow-hidden rounded-[2rem] border border-yellow-500/20 p-5 sm:p-6 lg:p-8"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,0.12),transparent_36%),radial-gradient(circle_at_bottom_left,rgba(6,182,212,0.05),transparent_30%)]"
      />

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-yellow-300">
            <Icon name="sparkles" className="h-4 w-4" />
            Help improve this mosque page
          </div>

          <h2 id={headingId} className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl">
            Report incorrect mosque data
          </h2>

          <p className="mt-3 max-w-3xl text-sm leading-7 text-white/60 sm:text-base">
            Report incorrect prayer times, Jumuʿah sessions, facilities,
            locations or duplicate listings. Every report is reviewed before
            public information is changed.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <TrustChip icon="shield" label="Human reviewed" />
            <TrustChip icon="save" label="Draft saved locally" />
            <TrustChip icon="info" label="Optional contact details" />
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            if (isOpen) closeForm();
            else {
              setIsOpen(true);
              clearFeedback();
            }
          }}
          disabled={isSubmitting}
          aria-expanded={isOpen}
          aria-controls={formId}
          className={
            isOpen
              ? "luxe-button-outline inline-flex min-h-11 w-full items-center justify-center px-5 py-3 text-sm sm:w-auto"
              : "luxe-button inline-flex min-h-11 w-full items-center justify-center px-5 py-3 text-sm sm:w-auto"
          }
        >
          <Icon name={isOpen ? "close" : "edit"} className="mr-2 h-4 w-4" />
          {isOpen ? "Close report form" : "Report an issue"}
        </button>
      </div>

      <div id={feedbackId} aria-live="polite" aria-atomic="true">
        {submitState === "success" ? <SuccessPanel message={successMessage} /> : null}
        {submitState === "error" ? (
          <FeedbackPanel tone="error" icon="alert" role="alert">
            {errorMessage}
          </FeedbackPanel>
        ) : null}
      </div>

      {!isOpen ? (
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <PreviewCard icon="prayer" title="Prayer information" description="Beginning times, iqamah and Jumuʿah sessions." />
          <PreviewCard icon="location" title="Mosque details" description="Location, facilities, closure or relocation." />
          <PreviewCard icon="shield" title="Community reviewed" description="Reports do not directly overwrite public data." />
        </div>
      ) : (
        <form
          id={formId}
          onSubmit={(event) => void submitReport(event)}
          noValidate
          className="mt-7 border-t border-white/10 pt-7"
        >
          <div aria-hidden="true" className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden">
            <label htmlFor={honeypotId}>Website</label>
            <input
              id={honeypotId}
              name="website"
              type="text"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
              tabIndex={-1}
              autoComplete="off"
            />
          </div>

          {draftRestored ? (
            <FeedbackPanel tone="info" icon="save">
              Your recent draft was restored on this device.
            </FeedbackPanel>
          ) : null}

          <fieldset aria-labelledby={reportTypeHeadingId} className="mt-6">
            <legend id={reportTypeHeadingId} className="text-lg font-black text-white">
              1. What needs correcting?
            </legend>
            <p className="mt-2 text-sm leading-6 text-white/50">
              Choose the category that best matches the issue.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {REPORT_TYPES.map((option) => {
                const active = reportType === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setReportType(option.value);
                      clearFeedback();
                    }}
                    disabled={isSubmitting}
                    aria-pressed={active}
                    className={`group min-h-32 rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 disabled:cursor-not-allowed disabled:opacity-50 ${
                      active
                        ? "border-yellow-400/45 bg-yellow-500/[0.12] shadow-[0_12px_35px_rgba(212,175,55,0.08)]"
                        : "border-white/10 bg-black/20 hover:border-yellow-500/30 hover:bg-white/[0.035]"
                    }`}
                  >
                    <span className={`flex h-10 w-10 items-center justify-center rounded-xl border ${active ? "border-yellow-400/30 bg-yellow-500/15 text-yellow-200" : "border-white/10 bg-white/[0.035] text-white/45 group-hover:text-yellow-300"}`}>
                      <Icon name={option.icon} className="h-5 w-5" />
                    </span>
                    <span className="mt-3 block text-sm font-black text-white">{option.shortLabel}</span>
                    <span className="mt-1 block text-xs leading-5 text-white/40">{option.description}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 rounded-2xl border border-yellow-500/20 bg-yellow-500/[0.06] p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-yellow-500/20 bg-yellow-500/[0.08] text-yellow-300">
                  <Icon name={selectedReportType.icon} className="h-4 w-4" />
                </span>
                <div>
                  <div className="text-sm font-black text-yellow-100">{selectedReportType.label}</div>
                  <p className="mt-1 text-xs leading-5 text-white/50">{selectedReportType.example}</p>
                </div>
              </div>
            </div>
          </fieldset>

          <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
            <div>
              <label htmlFor={messageId} className="text-lg font-black text-white">
                2. Describe the issue
              </label>
              <p className="mt-2 text-sm leading-6 text-white/50">
                Include the incorrect information, the correct information and how it can be verified.
              </p>

              <textarea
                id={messageId}
                value={message}
                onChange={(event) => {
                  setMessage(event.target.value);
                  clearFeedback();
                }}
                rows={8}
                required
                minLength={MIN_MESSAGE_LENGTH}
                maxLength={MAX_MESSAGE_LENGTH}
                disabled={isSubmitting}
                aria-invalid={Boolean(validationError && messageLength < MIN_MESSAGE_LENGTH)}
                aria-describedby={`${messageId}-help ${feedbackId}`}
                placeholder="Example: Isha iqamah is shown as 8:30pm, but the mosque timetable displays 8:45pm."
                className="mt-4 min-h-56 w-full resize-y rounded-2xl border border-white/10 bg-black px-4 py-4 text-sm leading-7 text-white outline-none transition placeholder:text-white/25 focus:border-yellow-500/50 focus:ring-2 focus:ring-yellow-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              />

              <div id={`${messageId}-help`} className="mt-2 flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between">
                <span className="text-white/35">Minimum {MIN_MESSAGE_LENGTH} characters.</span>
                <span className={`font-semibold ${message.length > MAX_MESSAGE_LENGTH * 0.9 ? "text-amber-300" : messageLength >= MIN_MESSAGE_LENGTH ? "text-emerald-300" : "text-white/40"}`}>
                  {message.length.toLocaleString("en-GB")} / {MAX_MESSAGE_LENGTH.toLocaleString("en-GB")}
                </span>
              </div>
            </div>

            <aside className="rounded-3xl border border-white/10 bg-black/20 p-5">
              <div className="text-xs font-black uppercase tracking-[0.18em] text-yellow-300">Report context</div>
              <dl className="mt-4 space-y-4">
                <ContextRow label="Mosque" value={safeMosqueName || "Current mosque"} />
                <ContextRow label="Source" value={getSourceLabel(safeSource)} />
                <ContextRow label="Category" value={selectedReportType.label} />
              </dl>
              <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-xs leading-6 text-white/45">
                Urgent prayer-time matters should also be confirmed directly with the mosque. SalahNearMe reports are not official mosque announcements.
              </div>
            </aside>
          </div>

          <div className="mt-7">
            <div className="text-lg font-black text-white">3. Your contact details</div>
            <p className="mt-2 text-sm leading-6 text-white/50">
              These fields are optional and are only used when the reviewing team needs clarification.
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <FieldShell icon="person" label="Your name" optional>
                <input
                  id={reporterNameId}
                  value={reporterName}
                  onChange={(event) => {
                    setReporterName(event.target.value);
                    clearFeedback();
                  }}
                  maxLength={MAX_NAME_LENGTH}
                  disabled={isSubmitting}
                  autoComplete="name"
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/25"
                  placeholder="Optional"
                  aria-label="Your name"
                />
              </FieldShell>

              <FieldShell icon="email" label="Email" optional>
                <input
                  id={reporterEmailId}
                  value={reporterEmail}
                  onChange={(event) => {
                    setReporterEmail(event.target.value);
                    clearFeedback();
                  }}
                  maxLength={MAX_EMAIL_LENGTH}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  disabled={isSubmitting}
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/25"
                  placeholder="Optional, for follow-up"
                  aria-label="Email"
                />
              </FieldShell>
            </div>
          </div>

          <label htmlFor={confirmationId} className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:border-yellow-500/25">
            <input
              id={confirmationId}
              type="checkbox"
              checked={confirmationChecked}
              onChange={(event) => {
                setConfirmationChecked(event.target.checked);
                clearFeedback();
              }}
              disabled={isSubmitting}
              className="mt-1 h-4 w-4 shrink-0 accent-yellow-500"
            />
            <span>
              <span className="block text-sm font-black text-white">I confirm this report is accurate to the best of my knowledge.</span>
              <span className="mt-1 block text-xs leading-5 text-white/40">Please do not submit speculation, personal disputes or deliberately misleading information.</span>
            </span>
          </label>

          {validationError && submitState !== "error" ? (
            <FeedbackPanel tone="warning" icon="alert">{validationError}</FeedbackPanel>
          ) : null}

          <div className="mt-6 flex flex-col gap-4 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2 text-xs leading-5 text-white/35">
              <Icon name="save" className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Your unfinished draft is stored only on this device for up to seven days.</span>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={closeForm} disabled={isSubmitting} className="luxe-button-outline inline-flex min-h-11 items-center justify-center px-5 py-3 text-sm">
                Cancel
              </button>
              <button type="submit" disabled={!canSubmit} aria-busy={isSubmitting} className="luxe-button inline-flex min-h-11 items-center justify-center px-5 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-50">
                {isSubmitting ? (
                  <>
                    <span aria-hidden="true" className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                    Submitting…
                  </>
                ) : (
                  <>
                    <Icon name="send" className="mr-2 h-4 w-4" />
                    Submit correction
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}
    </section>
  );
}

function TrustChip({ icon, label }: { icon: IconName; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-[0.7rem] font-bold text-white/55">
      <Icon name={icon} className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

function PreviewCard({ icon, title, description }: { icon: IconName; title: string; description: string }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-yellow-500/20 bg-yellow-500/[0.08] text-yellow-300">
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <h3 className="mt-3 text-sm font-black text-white">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-white/40">{description}</p>
    </article>
  );
}

function FieldShell({ icon, label, optional = false, children }: { icon: IconName; label: string; optional?: boolean; children: ReactNode }) {
  return (
    <label className="rounded-2xl border border-white/10 bg-black p-4 transition focus-within:border-yellow-500/50 focus-within:ring-2 focus-within:ring-yellow-500/15">
      <span className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-white/50">
        <Icon name={icon} className="h-4 w-4 text-yellow-300" />
        {label}
        {optional ? <span className="normal-case tracking-normal text-white/30">optional</span> : null}
      </span>
      <span className="mt-3 block">{children}</span>
    </label>
  );
}

function ContextRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-white/35">{label}</dt>
      <dd className="mt-1 break-words text-sm font-bold text-white/75">{value}</dd>
    </div>
  );
}

function FeedbackPanel({ children, tone, icon, role }: { children: ReactNode; tone: "info" | "warning" | "error"; icon: IconName; role?: "status" | "alert" }) {
  const className =
    tone === "info"
      ? "border-cyan-500/25 bg-cyan-500/[0.08] text-cyan-100"
      : tone === "warning"
        ? "border-amber-500/25 bg-amber-500/[0.08] text-amber-100"
        : "border-red-500/25 bg-red-500/[0.08] text-red-100";

  return (
    <div role={role} className={`mt-5 flex items-start gap-3 rounded-2xl border p-4 text-sm leading-6 ${className}`}>
      <Icon name={icon} className="mt-0.5 h-5 w-5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

function SuccessPanel({ message }: { message: string }) {
  return (
    <div role="status" className="mt-6 overflow-hidden rounded-3xl border border-emerald-500/25 bg-emerald-500/[0.08]">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/25 bg-emerald-500/15 text-emerald-200">
          <Icon name="check" className="h-6 w-6" />
        </span>
        <div>
          <div className="text-lg font-black text-emerald-100">JazakAllahu khayran</div>
          <p className="mt-2 text-sm leading-7 text-emerald-100/70">{message}</p>
          <p className="mt-2 text-xs leading-5 text-white/35">The report will be reviewed before any public mosque information is changed.</p>
        </div>
      </div>
    </div>
  );
}

function Icon({ name, className }: { name: IconName; className?: string }) {
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

  if (name === "alert") return <svg {...common}><path d="M12 3 2.8 20h18.4L12 3Z" /><path d="M12 9v4M12 17h.01" /></svg>;
  if (name === "building") return <svg {...common}><path d="M4 21V5l8-3v19" /><path d="M12 9h8v12M2 21h20" /><path d="M8 7v.01M8 11v.01M8 15v.01M16 13v.01M16 17v.01" /></svg>;
  if (name === "calendar") return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></svg>;
  if (name === "check") return <svg {...common}><path d="m5 12 4 4L19 6" /></svg>;
  if (name === "clock") return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
  if (name === "close") return <svg {...common}><path d="M6 6l12 12M18 6 6 18" /></svg>;
  if (name === "duplicate") return <svg {...common}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></svg>;
  if (name === "edit") return <svg {...common}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" /></svg>;
  if (name === "email") return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>;
  if (name === "facility") return <svg {...common}><path d="M4 21v-8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8" /><path d="M8 11V7a4 4 0 0 1 8 0v4M2 21h20" /></svg>;
  if (name === "info") return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>;
  if (name === "location") return <svg {...common}><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></svg>;
  if (name === "person") return <svg {...common}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>;
  if (name === "prayer") return <svg {...common}><path d="M5 21V10M19 21V10M3 21h18" /><path d="M5 10h14M7 10V7h10v3" /><path d="M12 3c1.6 1.1 2.4 2.4 2.4 4H9.6C9.6 5.4 10.4 4.1 12 3Z" /><path d="M10 21v-5a2 2 0 0 1 4 0v5" /></svg>;
  if (name === "save") return <svg {...common}><path d="M5 3h12l2 2v16H5Z" /><path d="M8 3v6h8V3M8 21v-8h8v8" /></svg>;
  if (name === "send") return <svg {...common}><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg>;
  if (name === "shield") return <svg {...common}><path d="M12 3 5 6v5c0 4.8 2.9 8.1 7 10 4.1-1.9 7-5.2 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></svg>;
  return <svg {...common}><path d="m12 3-1.4 3.6L7 8l3.6 1.4L12 13l1.4-3.6L17 8l-3.6-1.4L12 3Z" /><path d="m5 14-.8 2.2L2 17l2.2.8L5 20l.8-2.2L8 17l-2.2-.8L5 14ZM19 13l-.7 1.8-1.8.7 1.8.7L19 18l.7-1.8 1.8-.7-1.8-.7L19 13Z" /></svg>;
}