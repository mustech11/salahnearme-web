"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Props = {
  importId: string;
};

type SubmitState = "idle" | "submitting" | "success" | "error";

type ApproveResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  approved_rows?: number;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const REQUEST_TIMEOUT_MS = 60_000;

const DEFAULT_ERROR_MESSAGE =
  "The timetable could not be approved. Please try again.";

function cleanString(value: string) {
  return value.trim();
}

export default function MosqueTimetableApproveButton({
  importId,
}: Props) {
  const router = useRouter();

  const abortControllerRef = useRef<AbortController | null>(null);

  const [submitState, setSubmitState] =
    useState<SubmitState>("idle");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const cleanImportId = useMemo(
    () => cleanString(importId),
    [importId]
  );

  const validationError = useMemo(() => {
    if (!UUID_REGEX.test(cleanImportId)) {
      return "A valid timetable import is required before approval.";
    }

    return "";
  }, [cleanImportId]);

  const isSubmitting = submitState === "submitting";
  const isDisabled = isSubmitting || Boolean(validationError);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const approveImport = useCallback(async () => {
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

    const confirmed = window.confirm(
      "Approve this reviewed timetable and publish its rows to the public mosque prayer times? This action may replace existing published rows for the same dates."
    );

    if (!confirmed) {
      return;
    }

    abortControllerRef.current?.abort();

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    try {
      setSubmitState("submitting");

      const response = await fetch(
        "/api/mosque/timetable-imports/approve",
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
            import_id: cleanImportId,
          }),
        }
      );

      const data = (await response
        .json()
        .catch(() => ({}))) as ApproveResponse;

      if (!response.ok || data.ok !== true) {
        setSubmitState("error");
        setErrorMessage(
          cleanString(data.error ?? "") ||
            DEFAULT_ERROR_MESSAGE
        );
        return;
      }

      const approvedRows =
        typeof data.approved_rows === "number" &&
        Number.isFinite(data.approved_rows)
          ? Math.max(0, Math.trunc(data.approved_rows))
          : null;

      setSubmitState("success");
      setMessage(
        cleanString(data.message ?? "") ||
          (approvedRows === null
            ? "Timetable approved and published successfully."
            : `${approvedRows} timetable row${
                approvedRows === 1 ? " was" : "s were"
              } approved and published successfully.`)
      );

      router.refresh();
    } catch (error) {
      setSubmitState("error");

      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        setErrorMessage(
          "The approval request took too long or was cancelled. Please try again."
        );
        return;
      }

      setErrorMessage(DEFAULT_ERROR_MESSAGE);
    } finally {
      window.clearTimeout(timeoutId);

      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }

      setSubmitState((currentState) =>
        currentState === "submitting"
          ? "idle"
          : currentState
      );
    }
  }, [
    cleanImportId,
    isSubmitting,
    router,
    validationError,
  ]);

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => {
          void approveImport();
        }}
        disabled={isDisabled}
        aria-busy={isSubmitting}
        aria-describedby={
          errorMessage
            ? "timetable-approve-error"
            : message
              ? "timetable-approve-success"
              : undefined
        }
        title={validationError || undefined}
        className="inline-flex min-h-10 items-center justify-center rounded-xl bg-green-500 px-4 py-2 text-xs font-bold text-black transition hover:bg-green-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? (
          <>
            <span
              aria-hidden="true"
              className="mr-2 size-3.5 animate-spin rounded-full border-2 border-black/30 border-t-black"
            />
            Approving...
          </>
        ) : submitState === "success" ? (
          "Approved & published"
        ) : (
          "Approve & publish"
        )}
      </button>

      {validationError && !errorMessage ? (
        <p className="mt-2 text-xs text-amber-300">
          {validationError}
        </p>
      ) : null}

      <div aria-live="polite" aria-atomic="true">
        {message ? (
          <div
            id="timetable-approve-success"
            role="status"
            className="mt-3 rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-xs leading-5 text-green-300"
          >
            {message}
          </div>
        ) : null}

        {errorMessage ? (
          <div
            id="timetable-approve-error"
            role="alert"
            className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs leading-5 text-red-300"
          >
            {errorMessage}
          </div>
        ) : null}
      </div>
    </div>
  );
}