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

type ExtractResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const REQUEST_TIMEOUT_MS = 60_000;

const DEFAULT_ERROR_MESSAGE =
  "The timetable text could not be extracted. Please try again.";

function cleanString(value: string) {
  return value.trim();
}

export default function MosqueTimetableExtractButton({
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
      return "A valid timetable import is required before extraction.";
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

  const extract = useCallback(async () => {
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

    abortControllerRef.current?.abort();

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    try {
      setSubmitState("submitting");

      const response = await fetch(
        "/api/mosque/timetable-imports/extract",
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
        .catch(() => ({}))) as ExtractResponse;

      if (!response.ok || data.ok !== true) {
        setSubmitState("error");
        setErrorMessage(
          cleanString(data.error ?? "") ||
            DEFAULT_ERROR_MESSAGE
        );
        return;
      }

      setSubmitState("success");
      setMessage(
        cleanString(data.message ?? "") ||
          "Raw timetable text extracted successfully."
      );

      router.refresh();
    } catch (error) {
      setSubmitState("error");

      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        setErrorMessage(
          "The extraction request took too long or was cancelled. Please try again."
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
        currentState === "submitting" ? "idle" : currentState
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
          void extract();
        }}
        disabled={isDisabled}
        aria-busy={isSubmitting}
        aria-describedby={
          errorMessage
            ? "timetable-extract-error"
            : message
              ? "timetable-extract-success"
              : undefined
        }
        title={validationError || undefined}
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
        ) : submitState === "success" ? (
          "Extract again"
        ) : (
          "Extract raw text"
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
            id="timetable-extract-success"
            role="status"
            className="mt-3 rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-xs leading-5 text-green-300"
          >
            {message}
          </div>
        ) : null}

        {errorMessage ? (
          <div
            id="timetable-extract-error"
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