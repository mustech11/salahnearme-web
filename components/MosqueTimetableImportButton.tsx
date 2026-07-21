"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";

type Props = {
  mosqueId: string;
  sourceId?: string | null;
  sourceUrl: string;
  sourceType: string;
};

type SubmitState = "idle" | "submitting" | "success" | "error";

type TimetableImportResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  import_id?: string;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DEFAULT_ERROR_MESSAGE =
  "The timetable import could not be created. Please try again.";

const REQUEST_TIMEOUT_MS = 30_000;

function getCurrentImportPeriod() {
  const now = new Date();

  return {
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  };
}

function cleanString(value: string) {
  return value.trim();
}

function getErrorMessage(data: TimetableImportResponse) {
  const error = cleanString(data.error ?? "");

  return error || DEFAULT_ERROR_MESSAGE;
}

function isValidSourceUrl(value: string) {
  const url = cleanString(value);

  if (!url) {
    return false;
  }

  try {
    const parsedUrl = new URL(url);

    return parsedUrl.protocol === "https:" || parsedUrl.protocol === "http:";
  } catch {
    return false;
  }
}

export default function MosqueTimetableImportButton({
  mosqueId,
  sourceId,
  sourceUrl,
  sourceType,
}: Props) {
  const router = useRouter();

  const abortControllerRef = useRef<AbortController | null>(null);

  const [submitState, setSubmitState] =
    useState<SubmitState>("idle");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const cleanMosqueId = useMemo(
    () => cleanString(mosqueId),
    [mosqueId]
  );

  const cleanSourceId = useMemo(() => {
    const value = cleanString(sourceId ?? "");

    return value || null;
  }, [sourceId]);

  const cleanSourceUrl = useMemo(
    () => cleanString(sourceUrl),
    [sourceUrl]
  );

  const cleanSourceType = useMemo(
    () => cleanString(sourceType),
    [sourceType]
  );

  const validationError = useMemo(() => {
    if (!UUID_REGEX.test(cleanMosqueId)) {
      return "A valid mosque is required before creating an import.";
    }

    if (
      cleanSourceId !== null &&
      !UUID_REGEX.test(cleanSourceId)
    ) {
      return "The selected timetable source is invalid.";
    }

    if (!cleanSourceType) {
      return "The timetable source type is missing.";
    }

    if (!isValidSourceUrl(cleanSourceUrl)) {
      return "The timetable source must have a valid HTTP or HTTPS URL.";
    }

    return "";
  }, [
    cleanMosqueId,
    cleanSourceId,
    cleanSourceType,
    cleanSourceUrl,
  ]);

  const isSubmitting = submitState === "submitting";
  const isDisabled = isSubmitting || Boolean(validationError);

  const createImport = useCallback(async () => {
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

      const { month, year } = getCurrentImportPeriod();

      const response = await fetch(
        "/api/mosque/timetable-imports",
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
            mosque_id: cleanMosqueId,
            source_id: cleanSourceId,
            source_url: cleanSourceUrl,
            source_type: cleanSourceType,
            import_month: month,
            import_year: year,
          }),
        }
      );

      const data = (await response
        .json()
        .catch(() => ({}))) as TimetableImportResponse;

      if (!response.ok || data.ok !== true) {
        setSubmitState("error");
        setErrorMessage(getErrorMessage(data));
        return;
      }

      setSubmitState("success");
      setMessage(
        cleanString(data.message ?? "") ||
          "Timetable import created successfully. It is ready for extraction."
      );

      router.refresh();
    } catch (error) {
      setSubmitState("error");

      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        setErrorMessage(
          "The request took too long or was cancelled. Please try again."
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
    cleanMosqueId,
    cleanSourceId,
    cleanSourceType,
    cleanSourceUrl,
    isSubmitting,
    router,
    validationError,
  ]);

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => {
          void createImport();
        }}
        disabled={isDisabled}
        aria-busy={isSubmitting}
        aria-describedby={
          errorMessage
            ? "timetable-import-error"
            : message
              ? "timetable-import-success"
              : undefined
        }
        title={validationError || undefined}
        className="inline-flex min-h-10 items-center justify-center rounded-xl bg-yellow-500 px-4 py-2 text-xs font-bold text-black transition hover:bg-yellow-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? (
          <>
            <span
              aria-hidden="true"
              className="mr-2 size-3.5 animate-spin rounded-full border-2 border-black/30 border-t-black"
            />
            Creating import...
          </>
        ) : submitState === "success" ? (
          "Create another import"
        ) : (
          "Import timetable"
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
            id="timetable-import-success"
            role="status"
            className="mt-3 rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-xs leading-5 text-green-300"
          >
            {message}
          </div>
        ) : null}

        {errorMessage ? (
          <div
            id="timetable-import-error"
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