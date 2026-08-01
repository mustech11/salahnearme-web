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

function StatusIcon({
  type,
}: {
  type: "parse" | "success" | "error" | "refresh";
}) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "size-4",
    "aria-hidden": true,
  };

  if (type === "success") {
    return (
      <svg {...common}>
        <path d="m5 12 4 4L19 6" />
      </svg>
    );
  }

  if (type === "error") {
    return (
      <svg {...common}>
        <path d="M12 3 2.8 20h18.4L12 3Z" />
        <path d="M12 9v4M12 17h.01" />
      </svg>
    );
  }

  if (type === "refresh") {
    return (
      <svg {...common}>
        <path d="M20 11a8 8 0 1 0 2 5" />
        <path d="M20 4v7h-7" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M4 5h16M4 12h10M4 19h7" />
      <path d="m17 14 3 3-3 3M14 17h6" />
    </svg>
  );
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

      console.error("Timetable parsing failed:", error);
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
        className="group inline-flex min-h-11 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs font-black text-emerald-200 shadow-[0_10px_30px_rgba(16,185,129,0.06)] transition hover:border-emerald-400/50 hover:bg-emerald-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? (
          <>
            <span
              aria-hidden="true"
              className="mr-2 size-4 animate-spin rounded-full border-2 border-emerald-200/30 border-t-emerald-200"
            />
            Parsing timetable…
          </>
        ) : (
          <>
            <span className="mr-2">
              <StatusIcon type={submitState === "success" ? "refresh" : "parse"} />
            </span>
            {submitState === "success"
              ? "Parse again"
              : submitState === "error"
                ? "Try parsing again"
                : "Parse timetable"}
          </>
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
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-200">
                <StatusIcon type="success" />
              </span>
              <div className="min-w-0">
                <p className="font-bold">{message}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {resultStatus ? <ResultBadge label="Status" value={resultStatus} /> : null}
                  {parsedRows !== null ? (
                    <ResultBadge label="Rows" value={parsedRows.toLocaleString("en-GB")} />
                  ) : null}
                  {warningCount !== null ? (
                    <ResultBadge
                      label="Warnings"
                      value={warningCount.toLocaleString("en-GB")}
                      warning={warningCount > 0}
                    />
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {errorMessage ? (
          <div
            id={errorId}
            role="alert"
            className="mt-3 flex items-start gap-3 rounded-2xl border border-red-500/25 bg-red-500/[0.08] p-4 text-xs leading-5 text-red-100"
          >
            <span className="mt-0.5 shrink-0"><StatusIcon type="error" /></span>
            <span>{errorMessage}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ResultBadge({
  label,
  value,
  warning = false,
}: {
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.68rem] font-bold ${
        warning
          ? "border-amber-500/25 bg-amber-500/10 text-amber-200"
          : "border-white/10 bg-black/20 text-white/60"
      }`}
    >
      <span className="text-white/35">{label}</span>
      {value}
    </span>
  );
}