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
  published_rows?: number;
  status?: string;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const REQUEST_TIMEOUT_MS = 60_000;
const DEFAULT_ERROR_MESSAGE =
  "The timetable could not be approved. Please try again.";

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function getSafeCount(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }

  return Math.trunc(value);
}

async function readResponse(response: Response): Promise<ApproveResponse> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.toLowerCase().includes("application/json")) {
    try {
      const value: unknown = await response.json();
      return isRecord(value) ? (value as ApproveResponse) : {};
    } catch {
      return {};
    }
  }

  try {
    const text = cleanString(await response.text());
    return text ? { message: text } : {};
  } catch {
    return {};
  }
}

function getResponseError(data: ApproveResponse, status: number): string {
  const supplied = cleanString(data.error) || cleanString(data.message);

  if (supplied) return supplied;
  if (status === 400) return "The approval request is invalid.";
  if (status === 401) return "Your session has expired. Please sign in again.";
  if (status === 403) return "You do not have permission to approve this timetable.";
  if (status === 404) return "The timetable import could not be found.";
  if (status === 409) {
    return "This timetable is not ready for approval, is already approved, or has changed since review.";
  }
  if (status === 422) {
    return "The reviewed timetable contains invalid or incomplete rows.";
  }
  if (status === 429) {
    return "Too many approval requests were submitted. Please wait and try again.";
  }
  if (status >= 500) {
    return "The approval service is temporarily unavailable. Please try again shortly.";
  }

  return DEFAULT_ERROR_MESSAGE;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export default function MosqueTimetableApproveButton({ importId }: Props) {
  const router = useRouter();
  const componentId = useId();

  const validationId = `${componentId}-validation`;
  const successId = `${componentId}-success`;
  const errorId = `${componentId}-error`;

  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutTriggeredRef = useRef(false);
  const mountedRef = useRef(true);

  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [publishedRows, setPublishedRows] = useState<number | null>(null);
  const [resultStatus, setResultStatus] = useState("");

  const cleanImportId = useMemo(() => cleanString(importId), [importId]);

  const validationError = useMemo(() => {
    if (!UUID_REGEX.test(cleanImportId)) {
      return "A valid timetable import is required before approval.";
    }

    return "";
  }, [cleanImportId]);

  const isSubmitting = submitState === "submitting";
  const isApproved = submitState === "success";
  const isDisabled = isSubmitting || isApproved || Boolean(validationError);

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
    setPublishedRows(null);
    setResultStatus("");
  }, [cleanImportId]);

  const describedBy = useMemo(() => {
    if (errorMessage) return errorId;
    if (message) return successId;
    if (validationError) return validationId;
    return undefined;
  }, [errorId, errorMessage, message, successId, validationError, validationId]);

  const approveImport = useCallback(async () => {
    if (isSubmitting || isApproved || !mountedRef.current) return;

    setMessage("");
    setErrorMessage("");
    setPublishedRows(null);
    setResultStatus("");

    if (validationError) {
      setSubmitState("error");
      setErrorMessage(validationError);
      return;
    }

    const confirmed = window.confirm(
      "Approve this reviewed timetable and publish it to the public mosque prayer times? Existing published rows for the same dates may be replaced."
    );

    if (!confirmed) return;

    abortControllerRef.current?.abort();

    const controller = new AbortController();
    abortControllerRef.current = controller;
    timeoutTriggeredRef.current = false;

    const timeoutId = window.setTimeout(() => {
      timeoutTriggeredRef.current = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    try {
      setSubmitState("submitting");

      const response = await fetch("/api/mosque/timetable-imports/approve", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
        body: JSON.stringify({ import_id: cleanImportId }),
      });

      const data = await readResponse(response);

      if (!mountedRef.current || controller.signal.aborted) return;

      if (!response.ok || data.ok !== true) {
        setSubmitState("error");
        setErrorMessage(getResponseError(data, response.status));
        return;
      }

      const rowCount =
        getSafeCount(data.approved_rows) ?? getSafeCount(data.published_rows);

      setSubmitState("success");
      setPublishedRows(rowCount);
      setResultStatus(cleanString(data.status));
      setMessage(
        cleanString(data.message) ||
          (rowCount === null
            ? "Timetable approved and published successfully."
            : `${rowCount.toLocaleString("en-GB")} timetable row${
                rowCount === 1 ? " was" : "s were"
              } approved and published successfully.`)
      );

      router.refresh();
    } catch (error) {
      if (!mountedRef.current) return;

      setSubmitState("error");

      if (isAbortError(error)) {
        setErrorMessage(
          timeoutTriggeredRef.current
            ? "The approval request timed out. Please try again."
            : "The approval request was cancelled."
        );
        return;
      }

      if (error instanceof TypeError) {
        setErrorMessage(
          "The approval service could not be reached. Check your connection and try again."
        );
        return;
      }

      setErrorMessage(DEFAULT_ERROR_MESSAGE);
    } finally {
      window.clearTimeout(timeoutId);

      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }

      timeoutTriggeredRef.current = false;

      if (mountedRef.current) {
        setSubmitState((current) =>
          current === "submitting" ? "idle" : current
        );
      }
    }
  }, [cleanImportId, isApproved, isSubmitting, router, validationError]);

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => void approveImport()}
        disabled={isDisabled}
        aria-busy={isSubmitting}
        aria-disabled={isDisabled}
        aria-describedby={describedBy}
        title={validationError || undefined}
        className="group inline-flex min-h-11 items-center justify-center rounded-xl border border-emerald-300/25 bg-gradient-to-b from-emerald-400 to-emerald-500 px-4 py-2.5 text-xs font-black text-black shadow-[0_12px_30px_rgba(16,185,129,0.12)] transition hover:-translate-y-0.5 hover:from-emerald-300 hover:to-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
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
        ) : submitState === "error" ? (
          "Try approval again"
        ) : (
          "Approve & publish"
        )}
      </button>

      {validationError && !errorMessage ? (
        <p id={validationId} className="mt-2 text-xs leading-5 text-amber-300">
          {validationError}
        </p>
      ) : null}

      <div aria-live="polite" aria-atomic="true">
        {message ? (
          <div
            id={successId}
            role="status"
            className="mt-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.08] p-4 text-xs leading-5 text-emerald-100"
          >
            <p>{message}</p>
            {resultStatus ? (
              <p className="mt-1 text-emerald-200/70">Status: {resultStatus}</p>
            ) : null}
            {publishedRows !== null ? (
              <p className="mt-1 text-emerald-200/70">
                Published rows: {publishedRows.toLocaleString("en-GB")}
              </p>
            ) : null}
          </div>
        ) : null}

        {errorMessage ? (
          <div
            id={errorId}
            role="alert"
            className="mt-3 rounded-2xl border border-red-500/25 bg-red-500/[0.08] p-4 text-xs leading-5 text-red-100"
          >
            {errorMessage}
          </div>
        ) : null}
      </div>
    </div>
  );
}