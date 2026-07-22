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

const ALLOWED_STATUSES = new Set<ReportStatus>(
  STATUSES.map((item) => item.value)
);

function cleanString(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function normaliseStatus(
  value: unknown
): ReportStatus {
  if (
    typeof value === "string" &&
    ALLOWED_STATUSES.has(
      value as ReportStatus
    )
  ) {
    return value as ReportStatus;
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
    const value: unknown = await response.json();

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
    () => normaliseStatus(currentStatus),
    [currentStatus]
  );

  const initialNotes = useMemo(
    () => currentNotes ?? "",
    [currentNotes]
  );

  const [status, setStatus] =
    useState<ReportStatus>(initialStatus);

  const [notes, setNotes] =
    useState(initialNotes);

  const [savedStatus, setSavedStatus] =
    useState<ReportStatus>(initialStatus);

  const [savedNotes, setSavedNotes] =
    useState(initialNotes);

  const [submitState, setSubmitState] =
    useState<SubmitState>("idle");

  const [message, setMessage] = useState("");
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

  const hasUnsavedChanges =
    status !== savedStatus ||
    notes !== savedNotes;

  const validationError = useMemo(() => {
    if (!UUID_REGEX.test(reportId)) {
      return "A valid correction report is required.";
    }

    if (!UUID_REGEX.test(mosqueId)) {
      return "A valid mosque is required.";
    }

    if (!ALLOWED_STATUSES.has(status)) {
      return "Select a valid report status.";
    }

    if (notes.length > MAX_NOTES_LENGTH) {
      return `Manager notes must not exceed ${MAX_NOTES_LENGTH.toLocaleString()} characters.`;
    }

    if (
      (status === "resolved" ||
        status === "rejected") &&
      !notes.trim()
    ) {
      return "Add manager notes before resolving or rejecting this report.";
    }

    return "";
  }, [
    mosqueId,
    notes,
    reportId,
    status,
  ]);

  const isSaving =
    submitState === "saving";

  const clearFeedback = useCallback(() => {
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

  const resetChanges = useCallback(() => {
    setStatus(savedStatus);
    setNotes(savedNotes);
    clearFeedback();
  }, [
    clearFeedback,
    savedNotes,
    savedStatus,
  ]);

  const saveUpdate = useCallback(async () => {
    if (isSaving) {
      return;
    }

    setMessage("");
    setErrorMessage("");

    if (validationError) {
      setSubmitState("error");
      setErrorMessage(validationError);
      return;
    }

    if (!hasUnsavedChanges) {
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

    setSubmitState("saving");

    try {
      const cleanNotes = notes.trim();

      const response = await fetch(
        "/api/mosque/correction-report/update",
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
            report_id: reportId,
            mosque_id: mosqueId,
            status,
            admin_notes: cleanNotes,
          }),
        }
      );

      const json = await readResponse(response);

      if (!mountedRef.current) {
        return;
      }

      if (
        !response.ok ||
        json.ok !== true
      ) {
        setSubmitState("error");
        setErrorMessage(
          cleanString(json.error) ||
            cleanString(json.message) ||
            "Could not update the correction report."
        );
        return;
      }

      setNotes(cleanNotes);
      setSavedNotes(cleanNotes);
      setSavedStatus(status);
      setSubmitState("success");
      setErrorMessage("");
      setMessage(
        cleanString(json.message) ||
          "Correction report updated successfully."
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
        abortControllerRef.current === controller
      ) {
        abortControllerRef.current = null;
      }

      if (mountedRef.current) {
        setSubmitState((currentState) =>
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
    notes,
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
            {STATUSES.map((item) => (
              <option
                key={item.value}
                value={item.value}
              >
                {item.label}
              </option>
            ))}
          </select>

          <div className="mt-3 flex flex-wrap gap-2">
            <QuickActionButton
              label="Mark reviewing"
              onClick={() =>
                quickSet("reviewing")
              }
              disabled={isSaving}
              className="border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10"
            />

            <QuickActionButton
              label="Mark resolved"
              onClick={() =>
                quickSet("resolved")
              }
              disabled={isSaving}
              className="border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
            />

            <QuickActionButton
              label="Reject"
              onClick={() =>
                quickSet("rejected")
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
              setNotes(event.target.value);
              clearFeedback();
            }}
            rows={4}
            maxLength={MAX_NOTES_LENGTH}
            disabled={isSaving}
            placeholder="Add what was checked, what changed, or why the report was rejected."
            aria-invalid={Boolean(
              validationError
            )}
            aria-describedby={feedbackId}
            className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 disabled:opacity-60"
          />

          <div className="mt-2 text-right text-xs text-white/40">
            {notes.length.toLocaleString()} /{" "}
            {MAX_NOTES_LENGTH.toLocaleString()}
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

        {submitState === "success" ? (
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
            Boolean(validationError)
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
            isSaving || !hasUnsavedChanges
          }
          className="min-h-11 rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-bold text-white/70 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Reset changes
        </button>

        {hasUnsavedChanges ? (
          <span className="text-xs font-semibold text-amber-300">
            Unsaved changes
          </span>
        ) : null}
      </div>

      <p className="mt-3 text-xs leading-6 text-white/45">
        Updating this report does not automatically change
        public prayer or mosque data.
      </p>
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