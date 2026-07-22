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

import MosqueTimetableImportButton from "@/components/MosqueTimetableImportButton";

type TimetableSourceRow = {
  id?: string;
  mosque_id: string;
  source_url: string;
  source_type: string;
  auto_import_enabled: boolean;
  last_checked_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
};

type Props = {
  mosqueId: string;
  mosqueName: string;
  initialSources: TimetableSourceRow[];
};

type SourceType =
  | "website"
  | "pdf"
  | "image"
  | "csv"
  | "manual";

type FormRow = {
  clientKey: string;
  id?: string;
  source_url: string;
  source_type: SourceType;
  auto_import_enabled: boolean;
  last_checked_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
};

type SaveState = "idle" | "saving" | "success" | "error";

type SaveSourceResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  source?: TimetableSourceRow;
};

type RowValidation = {
  url: string;
  sourceType: string;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SOURCE_TYPES: ReadonlyArray<{
  value: SourceType;
  label: string;
}> = [
  {
    value: "website",
    label: "Website page",
  },
  {
    value: "pdf",
    label: "PDF timetable",
  },
  {
    value: "image",
    label: "Image timetable",
  },
  {
    value: "csv",
    label: "CSV / spreadsheet",
  },
  {
    value: "manual",
    label: "Manual source",
  },
];

const ALLOWED_SOURCE_TYPES = new Set<SourceType>(
  SOURCE_TYPES.map((option) => option.value)
);

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_SOURCE_ROWS = 20;
const MAX_URL_LENGTH = 2_048;

const DEFAULT_ERROR_MESSAGE =
  "The timetable sources could not be saved. Please try again.";

function createClientKey(): string {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

function isSourceType(value: unknown): value is SourceType {
  return (
    typeof value === "string" &&
    ALLOWED_SOURCE_TYPES.has(value as SourceType)
  );
}

function buildEmptyRow(): FormRow {
  return {
    clientKey: createClientKey(),
    source_url: "",
    source_type: "website",
    auto_import_enabled: false,
    last_checked_at: null,
    last_success_at: null,
    last_error: null,
  };
}

function buildInitialRows(
  initialSources: TimetableSourceRow[]
): FormRow[] {
  const mappedRows = initialSources
    .slice(0, MAX_SOURCE_ROWS)
    .map((source) => ({
      clientKey: source.id || createClientKey(),
      id: source.id,
      source_url: cleanString(source.source_url),
      source_type: isSourceType(source.source_type)
        ? source.source_type
        : "website",
      auto_import_enabled:
        source.auto_import_enabled === true,
      last_checked_at: source.last_checked_at ?? null,
      last_success_at: source.last_success_at ?? null,
      last_error: source.last_error ?? null,
    }));

  return mappedRows.length > 0
    ? mappedRows
    : [buildEmptyRow()];
}

function normaliseSourceUrl(
  value: string,
  sourceType: SourceType
): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  if (sourceType === "manual") {
    return trimmed;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

function validateSourceUrl(
  value: string,
  sourceType: SourceType
): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return "Enter a timetable source URL.";
  }

  if (trimmed.length > MAX_URL_LENGTH) {
    return `The source URL must not exceed ${MAX_URL_LENGTH.toLocaleString()} characters.`;
  }

  if (sourceType === "manual") {
    return "";
  }

  const normalisedUrl = normaliseSourceUrl(
    trimmed,
    sourceType
  );

  try {
    const parsedUrl = new URL(normalisedUrl);

    if (
      parsedUrl.protocol !== "http:" &&
      parsedUrl.protocol !== "https:"
    ) {
      return "Use a valid HTTP or HTTPS source URL.";
    }

    if (!parsedUrl.hostname) {
      return "Enter a valid source URL.";
    }

    return "";
  } catch {
    return "Enter a valid source URL.";
  }
}

function validateRow(row: FormRow): RowValidation {
  return {
    url: validateSourceUrl(
      row.source_url,
      row.source_type
    ),
    sourceType: isSourceType(row.source_type)
      ? ""
      : "Select a valid timetable source type.",
  };
}

function formatDateTime(
  value: string | null | undefined
): string {
  if (!value) {
    return "Never";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date.toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatSourceType(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

function serialiseRows(rows: FormRow[]): string {
  return JSON.stringify(
    rows.map((row) => ({
      id: row.id ?? null,
      source_url: row.source_url.trim(),
      source_type: row.source_type,
      auto_import_enabled:
        row.auto_import_enabled,
    }))
  );
}

async function readSaveResponse(
  response: Response
): Promise<SaveSourceResponse> {
  try {
    const value: unknown = await response.json();

    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value)
    ) {
      return {};
    }

    return value as SaveSourceResponse;
  } catch {
    return {};
  }
}

export default function MosqueTimetableSourcesEditor({
  mosqueId,
  mosqueName,
  initialSources,
}: Props) {
  const router = useRouter();
  const headingId = useId();
  const statusId = useId();

  const abortControllerRef =
    useRef<AbortController | null>(null);

  const mountedRef = useRef(true);

  const initialRows = useMemo(
    () => buildInitialRows(initialSources),
    [initialSources]
  );

  const [rows, setRows] =
    useState<FormRow[]>(initialRows);

  const [savedSnapshot, setSavedSnapshot] =
    useState(() => serialiseRows(initialRows));

  const [saveState, setSaveState] =
    useState<SaveState>("idle");

  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const nextRows = buildInitialRows(initialSources);

    setRows(nextRows);
    setSavedSnapshot(serialiseRows(nextRows));
    setSaveState("idle");
    setMessage("");
    setErrorMessage("");
  }, [initialSources, mosqueId]);

  const cleanMosqueId = useMemo(
    () => cleanString(mosqueId),
    [mosqueId]
  );

  const mosqueValidationError = useMemo(() => {
    if (!isUuid(cleanMosqueId)) {
      return "A valid mosque is required before timetable sources can be saved.";
    }

    return "";
  }, [cleanMosqueId]);

  const rowValidations = useMemo(
    () => rows.map(validateRow),
    [rows]
  );

  const duplicateUrlIndexes = useMemo(() => {
    const indexes = new Set<number>();
    const seen = new Map<string, number>();

    rows.forEach((row, index) => {
      const url = normaliseSourceUrl(
        row.source_url,
        row.source_type
      ).toLowerCase();

      if (!url) {
        return;
      }

      const previousIndex = seen.get(url);

      if (previousIndex !== undefined) {
        indexes.add(previousIndex);
        indexes.add(index);
        return;
      }

      seen.set(url, index);
    });

    return indexes;
  }, [rows]);

  const hasValidationErrors = useMemo(
    () =>
      Boolean(mosqueValidationError) ||
      rowValidations.some(
        (validation) =>
          Boolean(
            validation.url ||
              validation.sourceType
          )
      ) ||
      duplicateUrlIndexes.size > 0,
    [
      duplicateUrlIndexes,
      mosqueValidationError,
      rowValidations,
    ]
  );

  const hasUnsavedChanges =
    serialiseRows(rows) !== savedSnapshot;

  const isSaving = saveState === "saving";

  const clearFeedback = useCallback(() => {
    setSaveState("idle");
    setMessage("");
    setErrorMessage("");
  }, []);

  const updateRow = useCallback(
    <K extends keyof Pick<
      FormRow,
      | "source_url"
      | "source_type"
      | "auto_import_enabled"
    >>(
      index: number,
      field: K,
      value: FormRow[K]
    ) => {
      setRows((current) =>
        current.map((row, rowIndex) =>
          rowIndex === index
            ? {
                ...row,
                [field]: value,
              }
            : row
        )
      );

      clearFeedback();
    },
    [clearFeedback]
  );

  const addRow = useCallback(() => {
    setRows((current) => {
      if (current.length >= MAX_SOURCE_ROWS) {
        return current;
      }

      return [...current, buildEmptyRow()];
    });

    clearFeedback();
  }, [clearFeedback]);

  const removeRow = useCallback(
    (index: number) => {
      const row = rows[index];

      if (!row) {
        return;
      }

      if (row.id) {
        setErrorMessage(
          "Saved timetable sources cannot be removed from this editor yet. Disable automatic import or update the source instead."
        );
        setSaveState("error");
        return;
      }

      setRows((current) => {
        if (current.length === 1) {
          return [buildEmptyRow()];
        }

        return current.filter(
          (_, rowIndex) => rowIndex !== index
        );
      });

      clearFeedback();
    },
    [clearFeedback, rows]
  );

  const resetChanges = useCallback(() => {
    const nextRows = buildInitialRows(initialSources);

    setRows(nextRows);
    setSavedSnapshot(serialiseRows(nextRows));
    clearFeedback();
  }, [clearFeedback, initialSources]);

  const saveRows = useCallback(async () => {
    if (isSaving) {
      return;
    }

    setMessage("");
    setErrorMessage("");

    if (mosqueValidationError) {
      setSaveState("error");
      setErrorMessage(mosqueValidationError);
      return;
    }

    if (duplicateUrlIndexes.size > 0) {
      setSaveState("error");
      setErrorMessage(
        "Duplicate timetable source URLs were found. Each source URL must be unique."
      );
      return;
    }

    const firstInvalidRow = rowValidations.findIndex(
      (validation) =>
        Boolean(
          validation.url ||
            validation.sourceType
        )
    );

    if (firstInvalidRow >= 0) {
      setSaveState("error");
      setErrorMessage(
        `Correct the validation error in Source ${
          firstInvalidRow + 1
        } before saving.`
      );
      return;
    }

    if (rows.length === 0) {
      setSaveState("error");
      setErrorMessage(
        "Add at least one timetable source."
      );
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
      const updatedRows = [...rows];

      for (
        let index = 0;
        index < rows.length;
        index += 1
      ) {
        const row = rows[index];

        const response = await fetch(
          "/api/mosque/timetable-sources",
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
              id: row.id,
              mosque_id: cleanMosqueId,
              source_url: normaliseSourceUrl(
                row.source_url,
                row.source_type
              ),
              source_type: row.source_type,
              auto_import_enabled:
                row.auto_import_enabled,
            }),
          }
        );

        const data =
          await readSaveResponse(response);

        if (!response.ok || data.ok !== true) {
          throw new Error(
            cleanString(data.error) ||
              cleanString(data.message) ||
              `Could not save Source ${index + 1}.`
          );
        }

        if (!data.source) {
          throw new Error(
            `Source ${
              index + 1
            } was saved, but the server did not return the updated source.`
          );
        }

        const savedSource = data.source;

        updatedRows[index] = {
          clientKey:
            savedSource.id ||
            row.clientKey,
          id: savedSource.id,
          source_url: cleanString(
            savedSource.source_url
          ),
          source_type: isSourceType(
            savedSource.source_type
          )
            ? savedSource.source_type
            : row.source_type,
          auto_import_enabled:
            savedSource.auto_import_enabled === true,
          last_checked_at:
            savedSource.last_checked_at ?? null,
          last_success_at:
            savedSource.last_success_at ?? null,
          last_error:
            savedSource.last_error ?? null,
        };
      }

      if (!mountedRef.current) {
        return;
      }

      setRows(updatedRows);
      setSavedSnapshot(
        serialiseRows(updatedRows)
      );
      setSaveState("success");
      setErrorMessage("");
      setMessage(
        `${updatedRows.length.toLocaleString()} timetable source${
          updatedRows.length === 1 ? " was" : "s were"
        } saved successfully. Import controls are now available for saved sources.`
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
            ? "The timetable source save request timed out. Please try again."
            : "The timetable source save request was cancelled."
        );
        return;
      }

      const errorText =
        error instanceof Error
          ? error.message
          : DEFAULT_ERROR_MESSAGE;

      console.error(
        "Timetable source save failed:",
        error
      );

      setErrorMessage(
        errorText || DEFAULT_ERROR_MESSAGE
      );
    } finally {
      window.clearTimeout(timeoutId);

      if (
        abortControllerRef.current === controller
      ) {
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
    cleanMosqueId,
    duplicateUrlIndexes,
    isSaving,
    mosqueValidationError,
    router,
    rowValidations,
    rows,
  ]);

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6 md:p-8"
    >
      <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
        Timetable Sources
      </div>

      <h1
        id={headingId}
        className="mt-3 text-3xl font-black text-white"
      >
        Timetable sources for{" "}
        {cleanString(mosqueName) || "this mosque"}
      </h1>

      <p className="mt-3 max-w-3xl text-sm leading-6 text-white/60">
        Add the mosque website, PDF timetable,
        image timetable, CSV file or manual source.
        Save each source before using its Import
        timetable control.
      </p>

      {hasUnsavedChanges ? (
        <div className="mt-5 inline-flex rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-300">
          Unsaved source changes
        </div>
      ) : saveState === "success" ? (
        <div className="mt-5 inline-flex rounded-xl border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs font-semibold text-green-300">
          All changes saved
        </div>
      ) : null}

      <div
        id={statusId}
        aria-live="polite"
        aria-atomic="true"
      >
        {message ? (
          <div
            role="status"
            className="mt-5 rounded-2xl border border-green-500/30 bg-green-500/10 p-4 text-sm leading-6 text-green-300"
          >
            {message}
          </div>
        ) : null}

        {errorMessage ? (
          <div
            role="alert"
            className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm leading-6 text-red-300"
          >
            {errorMessage}
          </div>
        ) : null}
      </div>

      {mosqueValidationError ? (
        <div className="mt-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
          {mosqueValidationError}
        </div>
      ) : null}

      <div className="mt-8 grid gap-5">
        {rows.map((row, index) => {
          const validation =
            rowValidations[index] ?? {
              url: "",
              sourceType: "",
            };

          const cleanUrl =
            normaliseSourceUrl(
              row.source_url,
              row.source_type
            );

          const isSaved =
            Boolean(row.id && isUuid(row.id));

          const isDuplicate =
            duplicateUrlIndexes.has(index);

          return (
            <SourceEditorCard
              key={row.clientKey}
              index={index}
              row={row}
              validation={validation}
              isDuplicate={isDuplicate}
              isSaved={isSaved}
              cleanUrl={cleanUrl}
              mosqueId={cleanMosqueId}
              isSaving={isSaving}
              canRemove={
                !isSaved &&
                rows.length > 1
              }
              onUpdate={updateRow}
              onRemove={removeRow}
            />
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={addRow}
          disabled={
            isSaving ||
            rows.length >= MAX_SOURCE_ROWS
          }
          className="rounded-2xl border border-yellow-500/30 bg-black px-6 py-3 text-sm font-bold text-yellow-400 transition hover:bg-yellow-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add another source
        </button>

        <button
          type="button"
          onClick={() => {
            void saveRows();
          }}
          disabled={
            isSaving ||
            !hasUnsavedChanges ||
            hasValidationErrors
          }
          aria-busy={isSaving}
          aria-describedby={statusId}
          className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-yellow-500 px-6 py-3 text-sm font-bold text-black transition hover:bg-yellow-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? (
            <>
              <span
                aria-hidden="true"
                className="mr-2 size-4 animate-spin rounded-full border-2 border-black/30 border-t-black"
              />
              Saving sources...
            </>
          ) : (
            "Save sources"
          )}
        </button>

        <button
          type="button"
          onClick={resetChanges}
          disabled={
            isSaving || !hasUnsavedChanges
          }
          className="rounded-2xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-bold text-white/70 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Reset changes
        </button>
      </div>

      {rows.length >= MAX_SOURCE_ROWS ? (
        <p className="mt-3 text-xs text-amber-300">
          A maximum of{" "}
          {MAX_SOURCE_ROWS.toLocaleString()} timetable
          sources can be configured for one mosque.
        </p>
      ) : null}
    </section>
  );
}

function SourceEditorCard({
  index,
  row,
  validation,
  isDuplicate,
  isSaved,
  cleanUrl,
  mosqueId,
  isSaving,
  canRemove,
  onUpdate,
  onRemove,
}: {
  index: number;
  row: FormRow;
  validation: RowValidation;
  isDuplicate: boolean;
  isSaved: boolean;
  cleanUrl: string;
  mosqueId: string;
  isSaving: boolean;
  canRemove: boolean;
  onUpdate: <
    K extends keyof Pick<
      FormRow,
      | "source_url"
      | "source_type"
      | "auto_import_enabled"
    >,
  >(
    index: number,
    field: K,
    value: FormRow[K]
  ) => void;
  onRemove: (index: number) => void;
}) {
  const urlInputId = useId();
  const typeInputId = useId();
  const automaticInputId = useId();
  const urlErrorId = useId();

  const urlError =
    validation.url ||
    (isDuplicate
      ? "This source URL is duplicated."
      : "");

  return (
    <article className="rounded-2xl border border-white/10 bg-black/30 p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">
            Source {index + 1}
          </h2>

          {isSaved ? (
            <div className="mt-1 text-xs font-semibold text-green-300">
              Saved source — import is available
            </div>
          ) : (
            <div className="mt-1 text-xs font-semibold text-yellow-300">
              Unsaved source — save it before importing
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => onRemove(index)}
          disabled={isSaving || !canRemove}
          title={
            isSaved
              ? "Saved sources cannot currently be deleted from this editor."
              : !canRemove
                ? "At least one source row must remain."
                : undefined
          }
          className="rounded-xl border border-red-500/30 px-3 py-2 text-xs font-bold text-red-300 transition hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Remove
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-[1.5fr_0.7fr]">
        <div>
          <label
            htmlFor={urlInputId}
            className="text-sm font-semibold text-yellow-400"
          >
            Source URL
          </label>

          <input
            id={urlInputId}
            type={
              row.source_type === "manual"
                ? "text"
                : "url"
            }
            value={row.source_url}
            onChange={(event) =>
              onUpdate(
                index,
                "source_url",
                event.target.value
              )
            }
            placeholder={
              row.source_type === "manual"
                ? "Manual timetable source"
                : "https://mosque.org.uk/prayer-timetable.pdf"
            }
            maxLength={MAX_URL_LENGTH}
            disabled={isSaving}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            aria-invalid={Boolean(urlError)}
            aria-describedby={
              urlError ? urlErrorId : undefined
            }
            className="mt-2 w-full rounded-2xl border border-yellow-500/20 bg-black px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/40 disabled:opacity-60"
          />

          {urlError ? (
            <p
              id={urlErrorId}
              className="mt-2 text-xs text-red-300"
            >
              {urlError}
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor={typeInputId}
            className="text-sm font-semibold text-yellow-400"
          >
            Source type
          </label>

          <select
            id={typeInputId}
            value={row.source_type}
            onChange={(event) =>
              onUpdate(
                index,
                "source_type",
                event.target.value as SourceType
              )
            }
            disabled={isSaving}
            aria-invalid={Boolean(
              validation.sourceType
            )}
            className="mt-2 w-full rounded-2xl border border-yellow-500/20 bg-black px-4 py-3 text-sm text-white outline-none transition focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/40 disabled:opacity-60"
          >
            {SOURCE_TYPES.map((option) => (
              <option
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            ))}
          </select>

          {validation.sourceType ? (
            <p className="mt-2 text-xs text-red-300">
              {validation.sourceType}
            </p>
          ) : null}
        </div>
      </div>

      <label
        htmlFor={automaticInputId}
        className="mt-4 flex cursor-pointer items-center gap-3 text-sm text-white/70"
      >
        <input
          id={automaticInputId}
          type="checkbox"
          checked={row.auto_import_enabled}
          onChange={(event) =>
            onUpdate(
              index,
              "auto_import_enabled",
              event.target.checked
            )
          }
          disabled={isSaving}
          className="size-4 rounded border-white/20 bg-black accent-yellow-500"
        />

        Enable automatic monthly import checks when
        scheduled imports become available
      </label>

      {isSaved ? (
        <div className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-black/30 p-4 text-xs text-white/60 md:grid-cols-3">
          <InfoBlock
            label="Source type"
            value={formatSourceType(
              row.source_type
            )}
          />

          <InfoBlock
            label="Last checked"
            value={formatDateTime(
              row.last_checked_at
            )}
          />

          <InfoBlock
            label="Last success"
            value={formatDateTime(
              row.last_success_at
            )}
          />

          {row.last_error ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 leading-5 text-red-300 md:col-span-3">
              <span className="font-semibold">
                Last import error:
              </span>{" "}
              {row.last_error}
            </div>
          ) : null}
        </div>
      ) : null}

      {isSaved &&
      cleanUrl &&
      row.id &&
      isUuid(row.id) &&
      isUuid(mosqueId) ? (
        <MosqueTimetableImportButton
          mosqueId={mosqueId}
          sourceId={row.id}
          sourceUrl={cleanUrl}
          sourceType={row.source_type}
        />
      ) : (
        <div className="mt-4 rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-3 text-xs leading-5 text-yellow-100">
          Save this source successfully before starting
          a timetable import.
        </div>
      )}
    </article>
  );
}

function InfoBlock({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="font-semibold text-yellow-400">
        {label}
      </div>

      <div className="mt-1">{value}</div>
    </div>
  );
}