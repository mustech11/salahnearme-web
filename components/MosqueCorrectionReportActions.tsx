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

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_NOTES_LENGTH = 2_000;

const STATUSES: ReadonlyArray<{
  value: ReportStatus;
  label: string;
}> = [
  {
    value: "new",
    label: "New",
  },
  {
    value: "reviewing",
    label: "Reviewing",
  },
  {
    value: "resolved",
    label: "Resolved",
  },
  {
    value: "rejected",
    label: "Rejected",
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

  if (
    ALLOWED_STATUSES.has(
      cleaned as ReportStatus
    )
  ) {
    return cleaned as ReportStatus;
  }

  return "new";
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

  const statusInputId = useId();
  const notesInputId = useId();
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

  const validationError =
    useMemo(() => {
      if (
        !UUID_REGEX.test(reportId)
      ) {
        return "A valid correction report is required.";
      }

      if (
        !UUID_REGEX.test(mosqueId)
      ) {
        return "A valid mosque is required.";
      }

      if (
        !ALLOWED_STATUSES.has(
          status
        )
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
        getQuickNote(
          nextStatus
        );

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

          if (
            response.status === 401
          ) {
            setErrorMessage(
              cleanString(
                json.error
              ) ||
                "Your session has expired. Sign in again before updating this report."
            );
            return;
          }

          if (
            response.status === 403
          ) {
            setErrorMessage(
              cleanString(
                json.error
              ) ||
                "You do not have permission to update this report."
            );
            return;
          }

          setErrorMessage(
            cleanString(
              json.error
            ) ||
              cleanString(
                json.message
              ) ||
              "Could not update the correction report."
          );
          return;
        }

        const returnedStatus =
          normaliseStatus(
            json.report?.status ??
              status
          );

        const returnedNotes =
          cleanString(
            json.report
              ?.admin_notes
          );

        setStatus(
          returnedStatus
        );

        setNotes(returnedNotes);

        setSavedStatus(
          returnedStatus
        );

        setSavedNotes(
          returnedNotes
        );

        setSubmitState(
          "success"
        );

        setErrorMessage("");

        setMessage(
          cleanString(
            json.message
          ) ||
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
          error instanceof
            DOMException &&
          error.name ===
            "AbortError"
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
              "saving"
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
      aria-labelledby={`${feedbackId}-heading`}
      className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4"
    >
      <div className="text-xs uppercase tracking-[0.18em] text-cyan-300">
        Manager action
      </div>

      <h3
        id={`${feedbackId}-heading`}
        className="mt-2 text-base font-bold text-white"
      >
        Review correction report
      </h3>

      <p className="mt-1 text-sm leading-6 text-white/55">
        Record the review outcome
        without automatically changing
        public mosque data.
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-[0.75fr_1.25fr]">
        <div>
          <label
            htmlFor={statusInputId}
            className="text-sm font-bold text-white/80"
          >
            Report status
          </label>

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
            className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 disabled:opacity-60"
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

          <div className="mt-3 flex flex-wrap gap-2">
            <QuickActionButton
              label="Mark new"
              onClick={() =>
                quickSet("new")
              }
              disabled={isSaving}
              className="border-yellow-500/30 text-yellow-300 hover:bg-yellow-500/10"
            />

            <QuickActionButton
              label="Mark reviewing"
              onClick={() =>
                quickSet(
                  "reviewing"
                )
              }
              disabled={isSaving}
              className="border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10"
            />

            <QuickActionButton
              label="Mark resolved"
              onClick={() =>
                quickSet(
                  "resolved"
                )
              }
              disabled={isSaving}
              className="border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
            />

            <QuickActionButton
              label="Reject"
              onClick={() =>
                quickSet(
                  "rejected"
                )
              }
              disabled={isSaving}
              className="border-red-500/30 text-red-300 hover:bg-red-500/10"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor={notesInputId}
            className="text-sm font-bold text-white/80"
          >
            Manager notes
          </label>

          <textarea
            id={notesInputId}
            value={notes}
            onChange={(event) => {
              setNotes(
                event.target.value
              );
              clearFeedback();
            }}
            rows={4}
            maxLength={
              MAX_NOTES_LENGTH
            }
            disabled={isSaving}
            placeholder="Add what was checked, what changed, or why the report was rejected."
            aria-invalid={Boolean(
              validationError
            )}
            aria-describedby={
              feedbackId
            }
            className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 disabled:opacity-60"
          />

          <div className="mt-2 text-right text-xs text-white/40">
            {notes.length.toLocaleString(
              "en-GB"
            )}{" "}
            /{" "}
            {MAX_NOTES_LENGTH.toLocaleString(
              "en-GB"
            )}
          </div>
        </div>
      </div>

      <div
        id={feedbackId}
        aria-live="polite"
        aria-atomic="true"
      >
        {validationError &&
        submitState !== "error" ? (
          <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-200">
            {validationError}
          </div>
        ) : null}

        {submitState === "error" ? (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-100"
          >
            {errorMessage}
          </div>
        ) : null}

        {submitState ===
        "success" ? (
          <div
            role="status"
            className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-100"
          >
            {message}
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
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
                className="mr-2 size-4 animate-spin rounded-full border-2 border-black/30 border-t-black"
              />
              Saving...
            </>
          ) : (
            "Save report update"
          )}
        </button>

        <button
          type="button"
          onClick={resetChanges}
          disabled={
            isSaving ||
            !hasUnsavedChanges
          }
          className="min-h-11 rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-bold text-white/70 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Reset changes
        </button>

        {hasUnsavedChanges ? (
          <span className="text-xs font-semibold text-amber-300">
            Unsaved changes
          </span>
        ) : (
          <span className="text-xs text-white/35">
            Changes saved
          </span>
        )}
      </div>
    </section>
  );
}

function QuickActionButton({
  label,
  onClick,
  disabled,
  className,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  className: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg border px-3 py-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {label}
    </button>
  );
}