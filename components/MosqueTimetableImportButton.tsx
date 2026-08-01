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
  mosqueId: string;
  sourceId?: string | null;
  sourceUrl: string;
  sourceType: string;
};

type SubmitState =
  | "idle"
  | "submitting"
  | "success"
  | "error";

type TimetableImportResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  import_id?: string;
  importId?: string;
  existing_import_id?: string;
};

type ImportPeriod = {
  month: number;
  year: number;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const REQUEST_TIMEOUT_MS = 30_000;

const DEFAULT_ERROR_MESSAGE =
  "The timetable import could not be created. Please try again.";

const TIMEOUT_ERROR_MESSAGE =
  "The request took too long. Please try again.";

const CANCELLED_ERROR_MESSAGE =
  "The timetable import request was cancelled.";

const NETWORK_ERROR_MESSAGE =
  "The timetable service could not be reached. Check your connection and try again.";

function cleanString(
  value: string | null | undefined
): string {
  return String(value ?? "").trim();
}

function getCurrentImportPeriod(): ImportPeriod {
  const now = new Date();

  return {
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  };
}

function isValidSourceUrl(
  value: string
): boolean {
  const cleaned = cleanString(value);

  if (!cleaned) {
    return false;
  }

  try {
    const url = new URL(cleaned);

    return (
      url.protocol === "https:" ||
      url.protocol === "http:"
    );
  } catch {
    return false;
  }
}

function getResponseMessage(
  data: TimetableImportResponse
): string {
  return (
    cleanString(data.message) ||
    "Timetable import created successfully. It is ready for extraction."
  );
}

function getResponseError(
  data: TimetableImportResponse,
  status: number
): string {
  const suppliedError =
    cleanString(data.error) ||
    cleanString(data.message);

  if (suppliedError) {
    return suppliedError;
  }

  if (status === 400) {
    return "The timetable import details are invalid.";
  }

  if (status === 401) {
    return "Your session has expired. Please sign in again.";
  }

  if (status === 403) {
    return "You do not have permission to create timetable imports for this mosque.";
  }

  if (status === 404) {
    return "The mosque or timetable source could not be found.";
  }

  if (status === 409) {
    return "An import already exists for this mosque, source and month.";
  }

  if (status === 413) {
    return "The timetable source is too large to import.";
  }

  if (status === 429) {
    return "Too many import requests were submitted. Please wait and try again.";
  }

  if (status >= 500) {
    return "The timetable service is temporarily unavailable. Please try again shortly.";
  }

  return DEFAULT_ERROR_MESSAGE;
}

async function readResponseBody(
  response: Response
): Promise<TimetableImportResponse> {
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
        return data as TimetableImportResponse;
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

export default function MosqueTimetableImportButton({
  mosqueId,
  sourceId,
  sourceUrl,
  sourceType,
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

  const [createdImportId, setCreatedImportId] =
    useState<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, []);

  const cleanMosqueId = useMemo(
    () => cleanString(mosqueId),
    [mosqueId]
  );

  const cleanSourceId = useMemo(() => {
    const cleaned =
      cleanString(sourceId);

    return cleaned || null;
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

    if (
      cleanSourceType.length > 80
    ) {
      return "The timetable source type is too long.";
    }

    if (
      !isValidSourceUrl(
        cleanSourceUrl
      )
    ) {
      return "The timetable source must use a valid HTTP or HTTPS URL.";
    }

    if (
      cleanSourceUrl.length > 2_000
    ) {
      return "The timetable source URL is too long.";
    }

    return "";
  }, [
    cleanMosqueId,
    cleanSourceId,
    cleanSourceType,
    cleanSourceUrl,
  ]);

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

  const createImport =
    useCallback(async () => {
      if (
        isSubmitting ||
        !mountedRef.current
      ) {
        return;
      }

      setSuccessMessage("");
      setErrorMessage("");
      setCreatedImportId(null);

      if (validationError) {
        setSubmitState("error");
        setErrorMessage(
          validationError
        );
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

        const { month, year } =
          getCurrentImportPeriod();

        const response = await fetch(
          "/api/mosque/timetable-imports",
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
              mosque_id:
                cleanMosqueId,
              source_id:
                cleanSourceId,
              source_url:
                cleanSourceUrl,
              source_type:
                cleanSourceType,
              import_month: month,
              import_year: year,
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

        const importId =
          cleanString(
            data.import_id
          ) ||
          cleanString(
            data.importId
          ) ||
          cleanString(
            data.existing_import_id
          ) ||
          null;

        setCreatedImportId(
          importId
        );

        setSubmitState("success");
        setSuccessMessage(
          getResponseMessage(data)
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
        aria-disabled={isDisabled}
        aria-describedby={
          describedBy
        }
        title={
          validationError ||
          undefined
        }
        className="group inline-flex min-h-11 items-center justify-center rounded-xl border border-yellow-300/30 bg-gradient-to-b from-yellow-400 to-yellow-500 px-4 py-2.5 text-xs font-black text-black shadow-[0_12px_30px_rgba(234,179,8,0.12)] transition hover:-translate-y-0.5 hover:from-yellow-300 hover:to-yellow-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
      >
        {isSubmitting ? (
          <>
            <span
              aria-hidden="true"
              className="mr-2 size-3.5 animate-spin rounded-full border-2 border-black/30 border-t-black"
            />

            Creating import...
          </>
        ) : submitState ===
          "success" ? (
          "Create another import"
        ) : submitState ===
          "error" ? (
          "Try import again"
        ) : (
          "Import timetable"
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
            className="mt-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.08] p-4 text-xs leading-5 text-emerald-100 shadow-[0_10px_30px_rgba(16,185,129,0.05)]"
          >
            <p>
              {successMessage}
            </p>

            {createdImportId ? (
              <p className="mt-1 break-all text-emerald-200/70">
                Import reference:{" "}
                {createdImportId}
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