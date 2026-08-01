"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

type Props = {
  reportId: string;
  mosqueId: string;
  currentStatus: string;
  currentNotes?: string | null;
};

type ReportStatus =
  | "new"
  | "reviewing"
  | "resolved"
  | "rejected";

type SubmitState =
  | "idle"
  | "saving"
  | "success"
  | "error";

type UpdateResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  unchanged?: boolean;
  report?: {
    id?: string;
    status?: string;
    admin_notes?: string | null;
  };
};

type StatusDefinition = {
  value: ReportStatus;
  label: string;
  description: string;
  tone: Tone;
};

type Tone =
  | "yellow"
  | "cyan"
  | "emerald"
  | "red";

type IconName =
  | "check"
  | "edit"
  | "refresh"
  | "save"
  | "shield"
  | "warning";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_NOTES_LENGTH = 2_000;

const STATUSES: ReadonlyArray<StatusDefinition> = [
  {
    value: "new",
    label: "New",
    description:
      "Not yet reviewed by a mosque manager.",
    tone: "yellow",
  },
  {
    value: "reviewing",
    label: "Reviewing",
    description:
      "The correction is currently being checked.",
    tone: "cyan",
  },
  {
    value: "resolved",
    label: "Resolved",
    description:
      "The report has been reviewed and action completed.",
    tone: "emerald",
  },
  {
    value: "rejected",
    label: "Rejected",
    description:
      "The report was reviewed but not accepted.",
    tone: "red",
  },
];

const ALLOWED_STATUSES =
  new Set<ReportStatus>(
    STATUSES.map(
      (item) => item.value
    )
  );

function cleanString(
  value: unknown
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function normaliseStatus(
  value: unknown
): ReportStatus {
  const cleaned =
    cleanString(value).toLowerCase();

  return ALLOWED_STATUSES.has(
    cleaned as ReportStatus
  )
    ? (cleaned as ReportStatus)
    : "new";
}

function getStatusDefinition(
  status: ReportStatus
): StatusDefinition {
  return (
    STATUSES.find(
      (item) => item.value === status
    ) ?? STATUSES[0]
  );
}

function getQuickNote(
  status: ReportStatus
): string {
  if (status === "reviewing") {
    return "We are reviewing this correction report.";
  }

  if (status === "resolved") {
    return "This report has been reviewed and resolved.";
  }

  if (status === "rejected") {
    return "This report was reviewed but was not accepted.";
  }

  return "";
}

function getErrorMessage(
  response: Response,
  json: UpdateResponse
): string {
  const apiError =
    cleanString(json.error) ||
    cleanString(json.message);

  if (apiError) {
    return apiError;
  }

  if (response.status === 401) {
    return "Your session has expired. Sign in again before updating this report.";
  }

  if (response.status === 403) {
    return "You do not have permission to update this report.";
  }

  if (response.status === 404) {
    return "This correction report could not be found.";
  }

  if (response.status === 409) {
    return "This report changed elsewhere. Refresh and review the latest version.";
  }

  if (response.status === 429) {
    return "Too many update attempts. Wait briefly and try again.";
  }

  if (response.status >= 500) {
    return "The correction-report service is temporarily unavailable.";
  }

  return "Could not update the correction report.";
}

async function readResponse(
  response: Response
): Promise<UpdateResponse> {
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

    return value as UpdateResponse;
  } catch {
    return {};
  }
}

export default function MosqueCorrectionReportActions({
  reportId,
  mosqueId,
  currentStatus,
  currentNotes,
}: Props) {
  const router = useRouter();

  const headingId = useId();
  const statusInputId = useId();
  const notesInputId = useId();
  const notesHelpId = useId();
  const feedbackId = useId();

  const abortControllerRef =
    useRef<AbortController | null>(null);

  const mountedRef = useRef(true);

  const initialStatus = useMemo(
    () =>
      normaliseStatus(
        currentStatus
      ),
    [currentStatus]
  );

  const initialNotes = useMemo(
    () => currentNotes ?? "",
    [currentNotes]
  );

  const [status, setStatus] =
    useState<ReportStatus>(
      initialStatus
    );

  const [notes, setNotes] =
    useState(initialNotes);

  const [
    savedStatus,
    setSavedStatus,
  ] = useState<ReportStatus>(
    initialStatus
  );

  const [
    savedNotes,
    setSavedNotes,
  ] = useState(initialNotes);

  const [
    submitState,
    setSubmitState,
  ] = useState<SubmitState>(
    "idle"
  );

  const [message, setMessage] =
    useState("");

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    setStatus(initialStatus);
    setNotes(initialNotes);
    setSavedStatus(initialStatus);
    setSavedNotes(initialNotes);
    setSubmitState("idle");
    setMessage("");
    setErrorMessage("");
  }, [
    initialNotes,
    initialStatus,
    mosqueId,
    reportId,
  ]);

  const normalisedNotes =
    notes.trim();

  const savedNormalisedNotes =
    savedNotes.trim();

  const hasUnsavedChanges =
    status !== savedStatus ||
    normalisedNotes !==
      savedNormalisedNotes;

  const statusDefinition =
    getStatusDefinition(status);

  const validationError =
    useMemo(() => {
      if (!UUID_REGEX.test(reportId)) {
        return "A valid correction report is required.";
      }

      if (!UUID_REGEX.test(mosqueId)) {
        return "A valid mosque is required.";
      }

      if (
        !ALLOWED_STATUSES.has(status)
      ) {
        return "Select a valid report status.";
      }

      if (
        notes.length >
        MAX_NOTES_LENGTH
      ) {
        return `Manager notes must not exceed ${MAX_NOTES_LENGTH.toLocaleString(
          "en-GB"
        )} characters.`;
      }

      if (
        (status === "resolved" ||
          status === "rejected") &&
        !normalisedNotes
      ) {
        return "Add manager notes before resolving or rejecting this report.";
      }

      return "";
    }, [
      mosqueId,
      normalisedNotes,
      notes.length,
      reportId,
      status,
    ]);

  const isSaving =
    submitState === "saving";

  const clearFeedback =
    useCallback(() => {
      setSubmitState("idle");
      setMessage("");
      setErrorMessage("");
    }, []);

  const quickSet = useCallback(
    (nextStatus: ReportStatus) => {
      setStatus(nextStatus);

      const quickNote =
        getQuickNote(nextStatus);

      if (
        quickNote &&
        notes.trim().length === 0
      ) {
        setNotes(quickNote);
      }

      clearFeedback();
    },
    [clearFeedback, notes]
  );

  const resetChanges =
    useCallback(() => {
      setStatus(savedStatus);
      setNotes(savedNotes);
      clearFeedback();
    }, [
      clearFeedback,
      savedNotes,
      savedStatus,
    ]);

  const saveUpdate =
    useCallback(async () => {
      if (isSaving) {
        return;
      }

      setMessage("");
      setErrorMessage("");

      if (validationError) {
        setSubmitState("error");
        setErrorMessage(
          validationError
        );
        return;
      }

      if (!hasUnsavedChanges) {
        setSubmitState("success");
        setMessage(
          "No changes need to be saved."
        );
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

      setSubmitState("saving");

      try {
        const response = await fetch(
          "/api/mosque/correction-report/update",
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
            signal:
              controller.signal,
            body: JSON.stringify({
              report_id: reportId,
              mosque_id: mosqueId,
              status,
              admin_notes:
                normalisedNotes ||
                null,
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
          setErrorMessage(
            getErrorMessage(
              response,
              json
            )
          );
          return;
        }

        const returnedStatus =
          normaliseStatus(
            json.report?.status ??
              status
          );

        const returnedNotes =
          typeof json.report?.admin_notes ===
          "string"
            ? json.report.admin_notes
            : "";

        setStatus(returnedStatus);
        setNotes(returnedNotes);
        setSavedStatus(returnedStatus);
        setSavedNotes(returnedNotes);

        setSubmitState("success");
        setErrorMessage("");

        setMessage(
          cleanString(json.message) ||
            (json.unchanged
              ? "No report changes were required."
              : "Correction report updated successfully.")
        );

        router.refresh();
      } catch (error) {
        if (!mountedRef.current) {
          return;
        }

        setSubmitState("error");

        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          setErrorMessage(
            timedOut
              ? "The update request timed out. Please try again."
              : "The update request was cancelled."
          );
          return;
        }

        console.error(
          "Correction report update failed:",
          error
        );

        setErrorMessage(
          "Could not update the correction report."
        );
      } finally {
        window.clearTimeout(timeoutId);

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
              currentState === "saving"
                ? "idle"
                : currentState
          );
        }
      }
    }, [
      hasUnsavedChanges,
      isSaving,
      mosqueId,
      normalisedNotes,
      reportId,
      router,
      status,
      validationError,
    ]);

  return (
    <section
      aria-labelledby={headingId}
      className="relative overflow-hidden rounded-3xl border border-cyan-500/20 bg-cyan-500/[0.07] p-5 sm:p-6"
    >
      <div
        aria-hidden="true"
        className="absolute -right-16 -top-16 h-40 w-40 rounded-full border border-cyan-400/10 bg-cyan-400/[0.025]"
      />

      <div className="relative">
        <div className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
              <Icon
                name="edit"
                className="h-4 w-4"
              />
              Manager action
            </div>

            <h3
              id={headingId}
              className="mt-2 text-xl font-black text-white sm:text-2xl"
            >
              Review correction report
            </h3>

            <p className="mt-2 text-sm leading-7 text-white/55">
              Record the review outcome without
              automatically changing public mosque
              data.
            </p>
          </div>

          <StatusPill
            definition={
              statusDefinition
            }
          />
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
          <div>
            <label
              htmlFor={statusInputId}
              className="text-sm font-black text-white/85"
            >
              Report status
            </label>

            <p className="mt-1 text-xs leading-5 text-white/40">
              Choose the current stage of the manager
              review.
            </p>

            <select
              id={statusInputId}
              value={status}
              onChange={(event) => {
                setStatus(
                  normaliseStatus(
                    event.target.value
                  )
                );
                clearFeedback();
              }}
              disabled={isSaving}
              className="mt-3 min-h-11 w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm font-semibold text-white outline-none transition focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {STATUSES.map(
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

            <div className="mt-4 grid grid-cols-2 gap-2">
              {STATUSES.map(
                (item) => (
                  <QuickActionButton
                    key={item.value}
                    definition={item}
                    active={
                      status ===
                      item.value
                    }
                    onClick={() =>
                      quickSet(
                        item.value
                      )
                    }
                    disabled={isSaving}
                  />
                )
              )}
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs font-black uppercase tracking-[0.15em] text-white/40">
                Selected outcome
              </div>

              <div className="mt-2 font-black text-white">
                {statusDefinition.label}
              </div>

              <p className="mt-1 text-xs leading-5 text-white/45">
                {statusDefinition.description}
              </p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <label
                htmlFor={notesInputId}
                className="text-sm font-black text-white/85"
              >
                Manager notes
              </label>

              <span
                className={`text-xs font-semibold ${
                  notes.length >
                  MAX_NOTES_LENGTH *
                    0.9
                    ? "text-amber-300"
                    : "text-white/40"
                }`}
              >
                {notes.length.toLocaleString(
                  "en-GB"
                )}{" "}
                /{" "}
                {MAX_NOTES_LENGTH.toLocaleString(
                  "en-GB"
                )}
              </span>
            </div>

            <textarea
              id={notesInputId}
              value={notes}
              onChange={(event) => {
                setNotes(
                  event.target.value
                );
                clearFeedback();
              }}
              rows={8}
              maxLength={
                MAX_NOTES_LENGTH
              }
              disabled={isSaving}
              placeholder="Add what was checked, what changed, or why the report was rejected."
              aria-invalid={Boolean(
                validationError
              )}
              aria-describedby={`${notesHelpId} ${feedbackId}`}
              className="mt-3 min-h-48 w-full resize-y rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm leading-7 text-white outline-none transition placeholder:text-white/25 focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            />

            <div
              id={notesHelpId}
              className="mt-2 flex items-start gap-2 text-xs leading-5 text-white/35"
            >
              <Icon
                name="shield"
                className="mt-0.5 h-4 w-4 shrink-0"
              />
              <span>
                Notes are for the correction-review
                record. Resolving or rejecting requires
                an explanation.
              </span>
            </div>
          </div>
        </div>

        <div
          id={feedbackId}
          aria-live="polite"
          aria-atomic="true"
          className="mt-5"
        >
          {validationError &&
          submitState !== "error" ? (
            <FeedbackMessage
              tone="warning"
              icon="warning"
            >
              {validationError}
            </FeedbackMessage>
          ) : null}

          {submitState === "error" ? (
            <FeedbackMessage
              tone="error"
              icon="warning"
              role="alert"
            >
              {errorMessage}
            </FeedbackMessage>
          ) : null}

          {submitState === "success" ? (
            <FeedbackMessage
              tone="success"
              icon="check"
              role="status"
            >
              {message}
            </FeedbackMessage>
          ) : null}
        </div>

        <div className="mt-5 flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs">
            <span
              className={`h-2 w-2 rounded-full ${
                hasUnsavedChanges
                  ? "bg-amber-400"
                  : "bg-emerald-400"
              }`}
            />

            <span
              className={
                hasUnsavedChanges
                  ? "font-bold text-amber-300"
                  : "text-white/35"
              }
            >
              {hasUnsavedChanges
                ? "Unsaved changes"
                : "Changes saved"}
            </span>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={resetChanges}
              disabled={
                isSaving ||
                !hasUnsavedChanges
              }
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-5 py-3 text-sm font-bold text-white/70 transition hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon
                name="refresh"
                className="mr-2 h-4 w-4"
              />
              Reset changes
            </button>

            <button
              type="button"
              onClick={() => {
                void saveUpdate();
              }}
              disabled={
                isSaving ||
                !hasUnsavedChanges ||
                Boolean(
                  validationError
                )
              }
              aria-busy={isSaving}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-cyan-500 px-5 py-3 text-sm font-black text-black transition hover:bg-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <span
                    aria-hidden="true"
                    className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black"
                  />
                  Saving…
                </>
              ) : (
                <>
                  <Icon
                    name="save"
                    className="mr-2 h-4 w-4"
                  />
                  Save report update
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatusPill({
  definition,
}: {
  definition: StatusDefinition;
}) {
  const classes: Record<Tone, string> = {
    yellow:
      "border-yellow-500/30 bg-yellow-500/10 text-yellow-200",
    cyan:
      "border-cyan-500/30 bg-cyan-500/10 text-cyan-200",
    emerald:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
    red:
      "border-red-500/30 bg-red-500/10 text-red-200",
  };

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-black ${classes[definition.tone]}`}
    >
      <span className="h-2 w-2 rounded-full bg-current" />
      {definition.label}
    </span>
  );
}

function QuickActionButton({
  definition,
  active,
  onClick,
  disabled,
}: {
  definition: StatusDefinition;
  active: boolean;
  onClick: () => void;
  disabled: boolean;
}) {
  const classes: Record<Tone, string> = {
    yellow:
      "border-yellow-500/30 text-yellow-200 hover:bg-yellow-500/10",
    cyan:
      "border-cyan-500/30 text-cyan-200 hover:bg-cyan-500/10",
    emerald:
      "border-emerald-500/30 text-emerald-200 hover:bg-emerald-500/10",
    red:
      "border-red-500/30 text-red-200 hover:bg-red-500/10",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`min-h-11 rounded-xl border px-3 py-2 text-xs font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-50 ${
        classes[definition.tone]
      } ${
        active
          ? "bg-white/[0.08] ring-1 ring-current/20"
          : "bg-black/20"
      }`}
    >
      {definition.label}
    </button>
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

  if (name === "check") {
    return (
      <svg {...common}>
        <path d="m5 12 4 4L19 6" />
      </svg>
    );
  }

  if (name === "edit") {
    return (
      <svg {...common}>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
      </svg>
    );
  }

  if (name === "refresh") {
    return (
      <svg {...common}>
        <path d="M20 6v5h-5" />
        <path d="M4 18v-5h5" />
        <path d="M18.5 9A7 7 0 0 0 6 6.5L4 11M5.5 15A7 7 0 0 0 18 17.5l2-4.5" />
      </svg>
    );
  }

  if (name === "save") {
    return (
      <svg {...common}>
        <path d="M5 3h12l2 2v16H5Z" />
        <path d="M8 3v6h8V3M8 21v-8h8v8" />
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
      <path d="M12 3 2.8 20h18.4L12 3Z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}