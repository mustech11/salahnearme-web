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

type ParseResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  status?: string;
  rows_count?: number;
  parsed_rows?: number;
  warning_count?: number;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const REQUEST_TIMEOUT_MS = 60_000;
const DEFAULT_ERROR_MESSAGE =
  "The timetable could not be parsed. Please try again.";

function cleanString(value: string | null | undefined): string {
  return String(value ?? "").trim();
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

async function readResponse(response: Response): Promise<ParseResponse> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.toLowerCase().includes("application/json")) {
    try {
      const value: unknown = await response.json();
      return isRecord(value) ? (value as ParseResponse) : {};
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

function getResponseError(data: ParseResponse, status: number): string {
  const supplied = cleanString(data.error) || cleanString(data.message);

  if (supplied) return supplied;
  if (status === 400) return "The parsing request is invalid.";
  if (status === 401) return "Your session has expired. Please sign in again.";
  if (status === 403) return "You do not have permission to parse this timetable.";
  if (status === 404) return "The timetable import could not be found.";
  if (status === 409) {
    return "This timetable is not ready for parsing, or parsing is already in progress.";
  }
  if (status === 413) return "The extracted timetable text is too large to parse.";
  if (status === 422) {
    return "The timetable text could not be converted into valid prayer-time rows.";
  }
  if (status === 429) {
    return "Too many parsing requests were submitted. Please wait and try again.";
  }
  if (status >= 500) {
    return "The parsing service is temporarily unavailable. Please try again shortly.";
  }

  return DEFAULT_ERROR_MESSAGE;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export default function MosqueTimetableParseButton({ importId }: Props) {
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
  const [resultStatus, setResultStatus] = useState("");
  const [parsedRows, setParsedRows] = useState<number | null>(null);
  const [warningCount, setWarningCount] = useState<number | null>(null);

  const cleanImportId = useMemo(() => cleanString(importId), [importId]);

  const validationError = useMemo(() => {
    if (!UUID_REGEX.test(cleanImportId)) {
      return "A valid timetable import is required before parsing.";
    }

    return "";
  }, [cleanImportId]);

  const isSubmitting = submitState === "submitting";
  const isDisabled = isSubmitting || Boolean(validationError);

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
    setResultStatus("");
    setParsedRows(null);
    setWarningCount(null);
  }, [cleanImportId]);

  const describedBy = useMemo(() => {
    if (errorMessage) return errorId;
    if (message) return successId;
    if (validationError) return validationId;
    return undefined;
  }, [errorId, errorMessage, message, successId, validationError, validationId]);

  const parseImport = useCallback(async () => {
    if (isSubmitting || !mountedRef.current) return;

    setMessage("");
    setErrorMessage("");
    setResultStatus("");
    setParsedRows(null);
    setWarningCount(null);

    if (validationError) {
      setSubmitState("error");
      setErrorMessage(validationError);
      return;
    }

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

      const response = await fetch("/api/mosque/timetable-imports/parse", {
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

      setSubmitState("success");
      setMessage(
        cleanString(data.message) ||
          "Timetable parsed successfully and is ready for review."
      );
      setResultStatus(cleanString(data.status));
      setParsedRows(getSafeCount(data.rows_count) ?? getSafeCount(data.parsed_rows));
      setWarningCount(getSafeCount(data.warning_count));

      router.refresh();
    } catch (error) {
      if (!mountedRef.current) return;

      setSubmitState("error");

      if (isAbortError(error)) {
        setErrorMessage(
          timeoutTriggeredRef.current
            ? "The parsing request took too long. Please try again."
            : "The timetable parsing request was cancelled."
        );
        return;
      }

      if (error instanceof TypeError) {
        setErrorMessage(
          "The timetable parsing service could not be reached. Check your connection and try again."
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
  }, [cleanImportId, isSubmitting, router, validationError]);

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => void parseImport()}
        disabled={isDisabled}
        aria-busy={isSubmitting}
        aria-disabled={isDisabled}
        aria-describedby={describedBy}
        title={validationError || undefined}
        className="inline-flex min-h-10 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? (
          <>
            <span
              aria-hidden="true"
              className="mr-2 size-3.5 animate-spin rounded-full border-2 border-emerald-300/30 border-t-emerald-300"
            />
            Parsing...
          </>
        ) : submitState === "success" ? (
          "Parse again"
        ) : submitState === "error" ? (
          "Try parsing again"
        ) : (
          "Parse timetable"
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
            className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs leading-5 text-emerald-300"
          >
            <p>{message}</p>
            {resultStatus ? <p className="mt-1 text-emerald-200/70">Status: {resultStatus}</p> : null}
            {parsedRows !== null ? (
              <p className="mt-1 text-emerald-200/70">
                Parsed rows: {parsedRows.toLocaleString("en-GB")}
              </p>
            ) : null}
            {warningCount !== null ? (
              <p className="mt-1 text-emerald-200/70">
                Parser warnings: {warningCount.toLocaleString("en-GB")}
              </p>
            ) : null}
          </div>
        ) : null}

        {errorMessage ? (
          <div
            id={errorId}
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