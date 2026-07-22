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
  initialRawText?: string | null;
};

type SaveState = "idle" | "saving" | "success" | "error";

type SaveResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  raw_text_length?: number;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RAW_TEXT_LENGTH = 100_000;

const DEFAULT_ERROR_MESSAGE =
  "The raw timetable text could not be saved. Please try again.";

const EXAMPLE_TEXT =
  "1 Fajr 03:15 04:15 Sunrise 04:40 Dhuhr 13:15 14:00 Asr 17:15 18:00 Maghrib 21:35 21:35 Isha 22:40 23:00\n" +
  "2 Fajr 03:14 04:15 Sunrise 04:39 Dhuhr 13:15 14:00 Asr 17:16 18:00 Maghrib 21:36 21:36 Isha 22:41 23:00";

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getStoredLength(
  value: unknown,
  fallback: number
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0
  ) {
    return fallback;
  }

  return Math.trunc(value);
}

async function readSaveResponse(
  response: Response
): Promise<SaveResponse> {
  try {
    const value: unknown = await response.json();

    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }

    return value as SaveResponse;
  } catch {
    return {};
  }
}

export default function MosqueTimetableManualRawTextEditor({
  importId,
  initialRawText,
}: Props) {
  const router = useRouter();

  const panelId = useId();
  const textareaId = useId();
  const helpId = useId();
  const validationId = useId();
  const successId = useId();
  const errorId = useId();

  const abortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  const initialText = useMemo(
    () => initialRawText ?? "",
    [initialRawText]
  );

  const cleanImportId = useMemo(
    () => cleanString(importId),
    [importId]
  );

  const [open, setOpen] = useState(false);
  const [rawText, setRawText] = useState(initialText);
  const [savedText, setSavedText] = useState(initialText);

  const [saveState, setSaveState] =
    useState<SaveState>("idle");

  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    setRawText(initialText);
    setSavedText(initialText);
    setSaveState("idle");
    setMessage("");
    setErrorMessage("");
  }, [initialText, cleanImportId]);

  const trimmedRawText = useMemo(
    () => rawText.trim(),
    [rawText]
  );

  const characterCount = rawText.length;
  const hasUnsavedChanges = rawText !== savedText;

  const validationError = useMemo(() => {
    if (!UUID_REGEX.test(cleanImportId)) {
      return "A valid timetable import is required.";
    }

    if (!trimmedRawText) {
      return "Paste timetable text before saving.";
    }

    if (characterCount > MAX_RAW_TEXT_LENGTH) {
      return `The timetable text must not exceed ${MAX_RAW_TEXT_LENGTH.toLocaleString()} characters.`;
    }

    return "";
  }, [
    characterCount,
    cleanImportId,
    trimmedRawText,
  ]);

  const isSaving = saveState === "saving";

  const isSaveDisabled =
    isSaving ||
    Boolean(validationError) ||
    !hasUnsavedChanges;

  const clearFeedback = useCallback(() => {
    setSaveState("idle");
    setMessage("");
    setErrorMessage("");
  }, []);

  const resetText = useCallback(() => {
    setRawText(savedText);
    clearFeedback();
  }, [clearFeedback, savedText]);

  const clearText = useCallback(() => {
    setRawText("");
    clearFeedback();
  }, [clearFeedback]);

  const togglePanel = useCallback(() => {
    if (open && hasUnsavedChanges) {
      const confirmed = window.confirm(
        "You have unsaved timetable text. Hide the editor without saving it?"
      );

      if (!confirmed) {
        return;
      }
    }

    setOpen((current) => !current);
  }, [hasUnsavedChanges, open]);

  const saveRawText = useCallback(async () => {
    if (isSaving) {
      return;
    }

    setMessage("");
    setErrorMessage("");

    if (validationError) {
      setSaveState("error");
      setErrorMessage(validationError);
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

    setSaveState("saving");

    try {
      const response = await fetch(
        "/api/mosque/timetable-imports/manual-raw-text",
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
            raw_text: trimmedRawText,
          }),
        }
      );

      const data = await readSaveResponse(response);

      if (!mountedRef.current) {
        return;
      }

      if (!response.ok || data.ok !== true) {
        setSaveState("error");
        setErrorMessage(
          cleanString(data.error) ||
            cleanString(data.message) ||
            DEFAULT_ERROR_MESSAGE
        );
        return;
      }

      const storedLength = getStoredLength(
        data.raw_text_length,
        trimmedRawText.length
      );

      setRawText(trimmedRawText);
      setSavedText(trimmedRawText);
      setSaveState("success");
      setErrorMessage("");

      setMessage(
        cleanString(data.message) ||
          `${storedLength.toLocaleString()} character${
            storedLength === 1 ? " was" : "s were"
          } saved. The timetable is ready to be parsed.`
      );

      router.refresh();
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }

      setSaveState("error");

      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        setErrorMessage(
          timedOut
            ? "The save request timed out. Please try again."
            : "The save request was cancelled. Please try again."
        );
        return;
      }

      console.error(
        "Manual timetable raw text save failed:",
        error
      );

      setErrorMessage(DEFAULT_ERROR_MESSAGE);
    } finally {
      window.clearTimeout(timeoutId);

      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }

      if (mountedRef.current) {
        setSaveState((currentState) =>
          currentState === "saving"
            ? "idle"
            : currentState
        );
      }
    }
  }, [
    cleanImportId,
    isSaving,
    router,
    trimmedRawText,
    validationError,
  ]);

  const describedBy = [
    helpId,
    validationError ? validationId : null,
    message ? successId : null,
    errorMessage ? errorId : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={togglePanel}
        aria-expanded={open}
        aria-controls={panelId}
        className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-bold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
      >
        {open
          ? "Hide manual paste"
          : "Paste raw timetable text"}
      </button>

      {open ? (
        <section
          id={panelId}
          aria-labelledby={`${panelId}-heading`}
          className="mt-4 rounded-2xl border border-white/10 bg-black/40 p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3
                id={`${panelId}-heading`}
                className="text-sm font-bold text-yellow-400"
              >
                Manual timetable text
              </h3>

              <p
                id={helpId}
                className="mt-2 max-w-3xl text-xs leading-5 text-white/50"
              >
                Paste timetable text copied from a mosque
                website, PDF, OCR result, message, spreadsheet
                or document. Save it before selecting Parse
                timetable.
              </p>
            </div>

            {hasUnsavedChanges ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                Unsaved changes
              </div>
            ) : saveState === "success" ? (
              <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs text-green-300">
                Saved
              </div>
            ) : null}
          </div>

          <label
            htmlFor={textareaId}
            className="sr-only"
          >
            Raw timetable text
          </label>

          <textarea
            id={textareaId}
            value={rawText}
            onChange={(event) => {
              setRawText(event.target.value);
              clearFeedback();
            }}
            rows={12}
            maxLength={MAX_RAW_TEXT_LENGTH}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            placeholder={EXAMPLE_TEXT}
            aria-invalid={Boolean(validationError)}
            aria-describedby={describedBy || undefined}
            className="mt-4 min-h-64 w-full resize-y rounded-2xl border border-yellow-500/20 bg-black p-4 font-mono text-xs leading-5 text-white outline-none transition placeholder:text-white/25 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/40"
          />

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span
              className={
                characterCount >= MAX_RAW_TEXT_LENGTH
                  ? "text-red-300"
                  : "text-white/40"
              }
            >
              Characters: {characterCount.toLocaleString()} /{" "}
              {MAX_RAW_TEXT_LENGTH.toLocaleString()}
            </span>

            <span className="text-white/40">
              Leading and trailing whitespace is removed before
              saving.
            </span>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                void saveRawText();
              }}
              disabled={isSaveDisabled}
              aria-busy={isSaving}
              className="inline-flex min-h-10 items-center justify-center rounded-xl bg-yellow-500 px-4 py-2 text-xs font-bold text-black transition hover:bg-yellow-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <span
                    aria-hidden="true"
                    className="mr-2 size-3.5 animate-spin rounded-full border-2 border-black/30 border-t-black"
                  />
                  Saving...
                </>
              ) : saveState === "success" &&
                !hasUnsavedChanges ? (
                "Saved"
              ) : (
                "Save raw text"
              )}
            </button>

            <button
              type="button"
              onClick={resetText}
              disabled={isSaving || !hasUnsavedChanges}
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-bold text-white/70 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Reset changes
            </button>

            <button
              type="button"
              onClick={clearText}
              disabled={isSaving || rawText.length === 0}
              className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-2 text-xs font-bold text-red-300 transition hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clear text
            </button>
          </div>

          {validationError && !errorMessage ? (
            <div
              id={validationId}
              className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-5 text-amber-300"
            >
              {validationError}
            </div>
          ) : null}

          <div aria-live="polite" aria-atomic="true">
            {message ? (
              <div
                id={successId}
                role="status"
                className="mt-3 rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-xs leading-5 text-green-300"
              >
                {message}
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
        </section>
      ) : null}
    </div>
  );
}