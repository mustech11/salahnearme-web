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

type SubmitState =
  | "idle"
  | "submitting"
  | "success"
  | "error";

type ExtractResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  import_id?: string;
  status?: string;
  extracted_text_length?: number;
  extractedTextLength?: number;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const REQUEST_TIMEOUT_MS = 60_000;

const DEFAULT_ERROR_MESSAGE =
  "The timetable text could not be extracted. Please try again.";

const TIMEOUT_ERROR_MESSAGE =
  "The extraction request took too long. Please try again.";

const CANCELLED_ERROR_MESSAGE =
  "The timetable extraction request was cancelled.";

const NETWORK_ERROR_MESSAGE =
  "The timetable extraction service could not be reached. Check your connection and try again.";

function cleanString(
  value: string | null | undefined
): string {
  return String(value ?? "").trim();
}

function getResponseMessage(
  data: ExtractResponse
): string {
  return (
    cleanString(data.message) ||
    "Raw timetable text extracted successfully."
  );
}

function getResponseError(
  data: ExtractResponse,
  status: number
): string {
  const suppliedError =
    cleanString(data.error) ||
    cleanString(data.message);

  if (suppliedError) {
    return suppliedError;
  }

  if (status === 400) {
    return "The extraction request is invalid.";
  }

  if (status === 401) {
    return "Your session has expired. Please sign in again.";
  }

  if (status === 403) {
    return "You do not have permission to extract this timetable.";
  }

  if (status === 404) {
    return "The timetable import could not be found.";
  }

  if (status === 409) {
    return "This timetable import is not ready for extraction, or extraction is already in progress.";
  }

  if (status === 413) {
    return "The timetable source is too large to extract.";
  }

  if (status === 415) {
    return "This timetable source format is not supported.";
  }

  if (status === 422) {
    return "The timetable source could not be processed.";
  }

  if (status === 429) {
    return "Too many extraction requests were submitted. Please wait and try again.";
  }

  if (status >= 500) {
    return "The extraction service is temporarily unavailable. Please try again shortly.";
  }

  return DEFAULT_ERROR_MESSAGE;
}

async function readResponseBody(
  response: Response
): Promise<ExtractResponse> {
  const contentType =
    response.headers.get("content-type") ?? "";

  if (
    contentType
      .toLowerCase()
      .includes("application/json")
  ) {
    try {
      const data =
        (await response.json()) as unknown;

      if (
        data &&
        typeof data === "object" &&
        !Array.isArray(data)
      ) {
        return data as ExtractResponse;
      }
    } catch {
      return {};
    }

    return {};
  }

  try {
    const text = cleanString(
      await response.text()
    );

    return text
      ? {
          message: text,
        }
      : {};
  } catch {
    return {};
  }
}

function isAbortError(
  error: unknown
): boolean {
  return (
    error instanceof DOMException &&
    error.name === "AbortError"
  );
}

function getExtractedTextLength(
  data: ExtractResponse
): number | null {
  const value =
    data.extracted_text_length ??
    data.extractedTextLength;

  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0
  ) {
    return null;
  }

  return Math.floor(value);
}

export default function MosqueTimetableExtractButton({
  importId,
}: Props) {
  const router = useRouter();

  const componentId = useId();
  const errorId = `${componentId}-error`;
  const successId = `${componentId}-success`;
  const validationId =
    `${componentId}-validation`;

  const abortControllerRef =
    useRef<AbortController | null>(null);

  const timeoutTriggeredRef =
    useRef(false);

  const mountedRef =
    useRef(true);

  const [submitState, setSubmitState] =
    useState<SubmitState>("idle");

  const [successMessage, setSuccessMessage] =
    useState("");

  const [errorMessage, setErrorMessage] =
    useState("");

  const [resultStatus, setResultStatus] =
    useState("");

  const [
    extractedTextLength,
    setExtractedTextLength,
  ] = useState<number | null>(null);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, []);

  const cleanImportId = useMemo(
    () => cleanString(importId),
    [importId]
  );

  const validationError = useMemo(() => {
    if (!UUID_REGEX.test(cleanImportId)) {
      return "A valid timetable import is required before extraction.";
    }

    return "";
  }, [cleanImportId]);

  const isSubmitting =
    submitState === "submitting";

  const isDisabled =
    isSubmitting ||
    Boolean(validationError);

  const describedBy = useMemo(() => {
    if (errorMessage) {
      return errorId;
    }

    if (successMessage) {
      return successId;
    }

    if (validationError) {
      return validationId;
    }

    return undefined;
  }, [
    errorId,
    successId,
    validationId,
    errorMessage,
    successMessage,
    validationError,
  ]);

  const extract = useCallback(async () => {
    if (
      isSubmitting ||
      !mountedRef.current
    ) {
      return;
    }

    setSuccessMessage("");
    setErrorMessage("");
    setResultStatus("");
    setExtractedTextLength(null);

    if (validationError) {
      setSubmitState("error");
      setErrorMessage(validationError);
      return;
    }

    abortControllerRef.current?.abort();

    const controller =
      new AbortController();

    abortControllerRef.current =
      controller;

    timeoutTriggeredRef.current =
      false;

    const timeoutId =
      window.setTimeout(() => {
        timeoutTriggeredRef.current =
          true;

        controller.abort();
      }, REQUEST_TIMEOUT_MS);

    try {
      setSubmitState("submitting");

      const response = await fetch(
        "/api/mosque/timetable-imports/extract",
        {
          method: "POST",
          headers: {
            Accept:
              "application/json",
            "Content-Type":
              "application/json",
          },
          credentials:
            "same-origin",
          cache: "no-store",
          signal:
            controller.signal,
          body: JSON.stringify({
            import_id:
              cleanImportId,
          }),
        }
      );

      const data =
        await readResponseBody(
          response
        );

      if (
        !mountedRef.current ||
        controller.signal.aborted
      ) {
        return;
      }

      if (
        !response.ok ||
        data.ok !== true
      ) {
        setSubmitState("error");
        setErrorMessage(
          getResponseError(
            data,
            response.status
          )
        );
        return;
      }

      setSubmitState("success");
      setSuccessMessage(
        getResponseMessage(data)
      );

      setResultStatus(
        cleanString(data.status)
      );

      setExtractedTextLength(
        getExtractedTextLength(data)
      );

      router.refresh();
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }

      setSubmitState("error");

      if (isAbortError(error)) {
        setErrorMessage(
          timeoutTriggeredRef.current
            ? TIMEOUT_ERROR_MESSAGE
            : CANCELLED_ERROR_MESSAGE
        );
        return;
      }

      if (error instanceof TypeError) {
        setErrorMessage(
          NETWORK_ERROR_MESSAGE
        );
        return;
      }

      setErrorMessage(
        DEFAULT_ERROR_MESSAGE
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

      timeoutTriggeredRef.current =
        false;

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
          void extract();
        }}
        disabled={isDisabled}
        aria-busy={isSubmitting}
        aria-disabled={isDisabled}
        aria-describedby={
          describedBy
        }
        title={
          validationError ||
          undefined
        }
        className="inline-flex min-h-10 items-center justify-center rounded-xl border border-yellow-500/30 bg-black px-4 py-2 text-xs font-bold text-yellow-400 transition hover:bg-yellow-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? (
          <>
            <span
              aria-hidden="true"
              className="mr-2 size-3.5 animate-spin rounded-full border-2 border-yellow-400/30 border-t-yellow-400"
            />

            Extracting...
          </>
        ) : submitState ===
          "success" ? (
          "Extract again"
        ) : submitState ===
          "error" ? (
          "Try extraction again"
        ) : (
          "Extract raw text"
        )}
      </button>

      {validationError &&
      !errorMessage ? (
        <p
          id={validationId}
          className="mt-2 text-xs leading-5 text-amber-300"
        >
          {validationError}
        </p>
      ) : null}

      <div
        aria-live="polite"
        aria-atomic="true"
      >
        {successMessage ? (
          <div
            id={successId}
            role="status"
            className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs leading-5 text-emerald-300"
          >
            <p>
              {successMessage}
            </p>

            {resultStatus ? (
              <p className="mt-1 text-emerald-200/70">
                Status:{" "}
                {resultStatus}
              </p>
            ) : null}

            {extractedTextLength !==
            null ? (
              <p className="mt-1 text-emerald-200/70">
                Extracted characters:{" "}
                {extractedTextLength.toLocaleString(
                  "en-GB"
                )}
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