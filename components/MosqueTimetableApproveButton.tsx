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

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getApprovedRowCount(value: unknown): number | null {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0
  ) {
    return null;
  }

  return Math.trunc(value);
}

async function readApproveResponse(
  response: Response
): Promise<ApproveResponse> {
  try {
    const value: unknown = await response.json();

    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }

    return value as ApproveResponse;
  } catch {
    return {};
  }
}

export default function MosqueTimetableApproveButton({
  importId,
}: Props) {
  const router = useRouter();
  const statusId = useId();

  const abortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

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
  const isApproved = submitState === "success";

  const isDisabled =
    isSubmitting || isApproved || Boolean(validationError);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    setSubmitState("idle");
    setMessage("");
    setErrorMessage("");
  }, [cleanImportId]);

  const approveImport = useCallback(async () => {
    if (isSubmitting || isApproved) {
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
      "Approve this reviewed timetable and publish its rows to the public mosque prayer times? Existing published rows for the same dates may be replaced."
    );

    if (!confirmed) {
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

      const data = await readApproveResponse(response);

      if (!mountedRef.current) {
        return;
      }

      if (!response.ok || data.ok !== true) {
        setSubmitState("error");
        setErrorMessage(
          cleanString(data.error) ||
            cleanString(data.message) ||
            DEFAULT_ERROR_MESSAGE
        );
        return;
      }

      const approvedRows = getApprovedRowCount(
        data.approved_rows
      );

      const successMessage =
        cleanString(data.message) ||
        (approvedRows === null
          ? "Timetable approved and published successfully."
          : `${approvedRows.toLocaleString()} timetable row${
              approvedRows === 1 ? " was" : "s were"
            } approved and published successfully.`);

      setSubmitState("success");
      setMessage(successMessage);
      setErrorMessage("");

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
            ? "The approval request timed out. Please try again."
            : "The approval request was cancelled. Please try again."
        );
        return;
      }

      console.error("Timetable approval request failed:", error);
      setErrorMessage(DEFAULT_ERROR_MESSAGE);
    } finally {
      window.clearTimeout(timeoutId);

      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }

      if (mountedRef.current) {
        setSubmitState((currentState) =>
          currentState === "submitting"
            ? "idle"
            : currentState
        );
      }
    }
  }, [
    cleanImportId,
    isApproved,
    isSubmitting,
    router,
    validationError,
  ]);

  const describedBy = errorMessage
    ? `${statusId}-error`
    : message
      ? `${statusId}-success`
      : validationError
        ? `${statusId}-validation`
        : undefined;

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => {
          void approveImport();
        }}
        disabled={isDisabled}
        aria-busy={isSubmitting}
        aria-describedby={describedBy}
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
        ) : isApproved ? (
          "Approved & published"
        ) : (
          "Approve & publish"
        )}
      </button>

      {validationError && !errorMessage ? (
        <p
          id={`${statusId}-validation`}
          className="mt-2 text-xs text-amber-300"
        >
          {validationError}
        </p>
      ) : null}

      <div aria-live="polite" aria-atomic="true">
        {message ? (
          <div
            id={`${statusId}-success`}
            role="status"
            className="mt-3 rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-xs leading-5 text-green-300"
          >
            {message}
          </div>
        ) : null}

        {errorMessage ? (
          <div
            id={`${statusId}-error`}
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