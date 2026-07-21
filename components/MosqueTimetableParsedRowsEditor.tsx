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

type ParsedPrayerRow = {
  date: string | null;
  fajr_begins: string | null;
  fajr_iqamah: string | null;
  sunrise: string | null;
  dhuhr_begins: string | null;
  dhuhr_iqamah: string | null;
  asr_begins: string | null;
  asr_iqamah: string | null;
  maghrib_begins: string | null;
  maghrib_iqamah: string | null;
  isha_begins: string | null;
  isha_iqamah: string | null;
};

type ParsedTimetable = {
  parser?: string;
  confidence_score?: number;
  month?: number | null;
  year?: number | null;
  rows?: ParsedPrayerRow[];
  warnings?: string[];
  detected_format?: string;
  [key: string]: unknown;
};

type Props = {
  importId: string;
  extractedJson: unknown;
};

type SaveState = "idle" | "saving" | "success" | "error";

type SaveResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  rows_count?: number;
};

type PrayerTimeField = Exclude<keyof ParsedPrayerRow, "date">;

type ColumnDefinition = {
  key: PrayerTimeField;
  label: string;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

const REQUEST_TIMEOUT_MS = 30_000;

const DEFAULT_ERROR_MESSAGE =
  "The reviewed timetable rows could not be saved. Please try again.";

const TIME_COLUMNS: ColumnDefinition[] = [
  { key: "fajr_begins", label: "Fajr begins" },
  { key: "fajr_iqamah", label: "Fajr iqamah" },
  { key: "sunrise", label: "Sunrise" },
  { key: "dhuhr_begins", label: "Dhuhr begins" },
  { key: "dhuhr_iqamah", label: "Dhuhr iqamah" },
  { key: "asr_begins", label: "Asr begins" },
  { key: "asr_iqamah", label: "Asr iqamah" },
  { key: "maghrib_begins", label: "Maghrib begins" },
  { key: "maghrib_iqamah", label: "Maghrib iqamah" },
  { key: "isha_begins", label: "Isha begins" },
  { key: "isha_iqamah", label: "Isha iqamah" },
];

function cleanString(value: string) {
  return value.trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value)
  );
}

function isParsedTimetable(value: unknown): value is ParsedTimetable {
  return isRecord(value);
}

function emptyRow(): ParsedPrayerRow {
  return {
    date: null,
    fajr_begins: null,
    fajr_iqamah: null,
    sunrise: null,
    dhuhr_begins: null,
    dhuhr_iqamah: null,
    asr_begins: null,
    asr_iqamah: null,
    maghrib_begins: null,
    maghrib_iqamah: null,
    isha_begins: null,
    isha_iqamah: null,
  };
}

function normaliseNullableString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = cleanString(value);

  return cleaned || null;
}

function normaliseTime(value: unknown) {
  const cleaned = normaliseNullableString(value);

  if (!cleaned || !TIME_REGEX.test(cleaned)) {
    return null;
  }

  return cleaned.length === 5 ? `${cleaned}:00` : cleaned;
}

function normaliseDate(value: unknown) {
  const cleaned = normaliseNullableString(value);

  if (!cleaned || !DATE_REGEX.test(cleaned)) {
    return null;
  }

  const parsedDate = new Date(`${cleaned}T00:00:00`);

  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== cleaned
  ) {
    return null;
  }

  return cleaned;
}

function normaliseRow(value: unknown): ParsedPrayerRow {
  const row = isRecord(value) ? value : {};

  return {
    date: normaliseDate(row.date),
    fajr_begins: normaliseTime(row.fajr_begins),
    fajr_iqamah: normaliseTime(row.fajr_iqamah),
    sunrise: normaliseTime(row.sunrise),
    dhuhr_begins: normaliseTime(row.dhuhr_begins),
    dhuhr_iqamah: normaliseTime(row.dhuhr_iqamah),
    asr_begins: normaliseTime(row.asr_begins),
    asr_iqamah: normaliseTime(row.asr_iqamah),
    maghrib_begins: normaliseTime(row.maghrib_begins),
    maghrib_iqamah: normaliseTime(row.maghrib_iqamah),
    isha_begins: normaliseTime(row.isha_begins),
    isha_iqamah: normaliseTime(row.isha_iqamah),
  };
}

function buildInitialRows(extractedJson: unknown): ParsedPrayerRow[] {
  if (!isParsedTimetable(extractedJson)) {
    return [];
  }

  if (!Array.isArray(extractedJson.rows)) {
    return [];
  }

  return extractedJson.rows.map(normaliseRow);
}

function toInputTime(value: string | null) {
  if (!value || !TIME_REGEX.test(value)) {
    return "";
  }

  return value.slice(0, 5);
}

function fromInputTime(value: string) {
  const cleaned = cleanString(value);

  if (!cleaned || !TIME_REGEX.test(cleaned)) {
    return null;
  }

  return `${cleaned.slice(0, 5)}:00`;
}

function hasAnyPrayerTime(row: ParsedPrayerRow) {
  return TIME_COLUMNS.some(({ key }) => Boolean(row[key]));
}

function compareRowsByDate(
  first: ParsedPrayerRow,
  second: ParsedPrayerRow
) {
  if (!first.date && !second.date) {
    return 0;
  }

  if (!first.date) {
    return 1;
  }

  if (!second.date) {
    return -1;
  }

  return first.date.localeCompare(second.date);
}

function getDuplicateDates(rows: ParsedPrayerRow[]) {
  const counts = new Map<string, number>();

  for (const row of rows) {
    if (row.date) {
      counts.set(row.date, (counts.get(row.date) ?? 0) + 1);
    }
  }

  return new Set(
    [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([date]) => date)
  );
}

export default function MosqueTimetableParsedRowsEditor({
  importId,
  extractedJson,
}: Props) {
  const router = useRouter();
  const panelId = useId();
  const abortControllerRef = useRef<AbortController | null>(null);

  const parsedJson = useMemo<ParsedTimetable>(
    () =>
      isParsedTimetable(extractedJson)
        ? extractedJson
        : {},
    [extractedJson]
  );

  const initialRows = useMemo(
    () => buildInitialRows(extractedJson),
    [extractedJson]
  );

  const cleanImportId = useMemo(
    () => cleanString(importId),
    [importId]
  );

  const [open, setOpen] = useState(false);
  const [rows, setRows] =
    useState<ParsedPrayerRow[]>(initialRows);
  const [saveState, setSaveState] =
    useState<SaveState>("idle");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    setRows(initialRows);
    setSaveState("idle");
    setMessage("");
    setErrorMessage("");
  }, [initialRows]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const duplicateDates = useMemo(
    () => getDuplicateDates(rows),
    [rows]
  );

  const datedRowCount = useMemo(
    () => rows.filter((row) => Boolean(row.date)).length,
    [rows]
  );

  const incompleteRowCount = useMemo(
    () =>
      rows.filter(
        (row) =>
          Boolean(row.date) && !hasAnyPrayerTime(row)
      ).length,
    [rows]
  );

  const validationError = useMemo(() => {
    if (!UUID_REGEX.test(cleanImportId)) {
      return "A valid timetable import is required.";
    }

    if (rows.length === 0) {
      return "Add at least one timetable row.";
    }

    const rowsWithoutDates = rows.filter(
      (row) => !row.date && hasAnyPrayerTime(row)
    );

    if (rowsWithoutDates.length > 0) {
      return `${rowsWithoutDates.length} row${
        rowsWithoutDates.length === 1 ? "" : "s"
      } contain prayer times but do not have a valid date.`;
    }

    if (datedRowCount === 0) {
      return "Add at least one row with a valid date.";
    }

    if (duplicateDates.size > 0) {
      return `Duplicate dates found: ${[...duplicateDates]
        .sort()
        .join(", ")}.`;
    }

    if (incompleteRowCount > 0) {
      return `${incompleteRowCount} dated row${
        incompleteRowCount === 1 ? " has" : "s have"
      } no prayer times.`;
    }

    return "";
  }, [
    cleanImportId,
    datedRowCount,
    duplicateDates,
    incompleteRowCount,
    rows,
  ]);

  const isSaving = saveState === "saving";
  const isSaveDisabled =
    isSaving || Boolean(validationError);

  const updateRow = useCallback(
    (
      index: number,
      field: keyof ParsedPrayerRow,
      value: string | null
    ) => {
      setRows((currentRows) =>
        currentRows.map((row, rowIndex) =>
          rowIndex === index
            ? {
                ...row,
                [field]: value,
              }
            : row
        )
      );

      setSaveState("idle");
      setMessage("");
      setErrorMessage("");
    },
    []
  );

  const addRow = useCallback(() => {
    setRows((currentRows) => [
      ...currentRows,
      emptyRow(),
    ]);
    setSaveState("idle");
    setMessage("");
    setErrorMessage("");
  }, []);

  const removeRow = useCallback((index: number) => {
    setRows((currentRows) =>
      currentRows.filter(
        (_, rowIndex) => rowIndex !== index
      )
    );
    setSaveState("idle");
    setMessage("");
    setErrorMessage("");
  }, []);

  const sortRows = useCallback(() => {
    setRows((currentRows) =>
      [...currentRows].sort(compareRowsByDate)
    );
    setSaveState("idle");
    setMessage("");
    setErrorMessage("");
  }, []);

  const resetRows = useCallback(() => {
    setRows(initialRows);
    setSaveState("idle");
    setMessage("");
    setErrorMessage("");
  }, [initialRows]);

  const saveRows = useCallback(async () => {
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

    const reviewedRows = rows
      .filter((row) => row.date)
      .map(normaliseRow)
      .sort(compareRowsByDate);

    abortControllerRef.current?.abort();

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    try {
      setSaveState("saving");

      const response = await fetch(
        "/api/mosque/timetable-imports/update-parsed-json",
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
            extracted_json: {
              ...parsedJson,
              rows: reviewedRows,
            },
          }),
        }
      );

      const data = (await response
        .json()
        .catch(() => ({}))) as SaveResponse;

      if (!response.ok || data.ok !== true) {
        setSaveState("error");
        setErrorMessage(
          cleanString(data.error ?? "") ||
            DEFAULT_ERROR_MESSAGE
        );
        return;
      }

      const savedRowCount =
        typeof data.rows_count === "number"
          ? data.rows_count
          : reviewedRows.length;

      setRows(reviewedRows);
      setSaveState("success");
      setMessage(
        cleanString(data.message ?? "") ||
          `${savedRowCount} reviewed timetable row${
            savedRowCount === 1 ? " is" : "s are"
          } ready for approval.`
      );

      router.refresh();
    } catch (error) {
      setSaveState("error");

      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        setErrorMessage(
          "The save request took too long or was cancelled. Please try again."
        );
        return;
      }

      setErrorMessage(DEFAULT_ERROR_MESSAGE);
    } finally {
      window.clearTimeout(timeoutId);

      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }

      setSaveState((currentState) =>
        currentState === "saving"
          ? "idle"
          : currentState
      );
    }
  }, [
    cleanImportId,
    isSaving,
    parsedJson,
    router,
    rows,
    validationError,
  ]);

  if (initialRows.length === 0) {
    return null;
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => {
          setOpen((current) => !current);
        }}
        aria-expanded={open}
        aria-controls={panelId}
        className="inline-flex min-h-10 items-center justify-center rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 py-2 text-xs font-bold text-purple-200 transition hover:bg-purple-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
      >
        {open
          ? "Hide review table"
          : "Review / edit parsed rows"}
      </button>

      {open ? (
        <section
          id={panelId}
          className="mt-4 rounded-2xl border border-purple-500/20 bg-black/40 p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-yellow-400">
                Parsed timetable review
              </h3>

              <p className="mt-2 max-w-3xl text-xs leading-5 text-white/50">
                Check every date and prayer time before
                approval. Save the reviewed rows before
                publishing the timetable.
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/60">
              {datedRowCount} dated row
              {datedRowCount === 1 ? "" : "s"}
            </div>
          </div>

          {Array.isArray(parsedJson.warnings) &&
          parsedJson.warnings.length > 0 ? (
            <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
              <div className="text-xs font-bold text-amber-300">
                Parser warnings
              </div>

              <ul className="mt-2 space-y-1 text-xs leading-5 text-amber-200/80">
                {parsedJson.warnings.map(
                  (warning, index) => (
                    <li key={`${warning}-${index}`}>
                      • {warning}
                    </li>
                  )
                )}
              </ul>
            </div>
          ) : null}

          <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
            <table className="min-w-[1420px] border-collapse text-left text-xs">
              <thead className="bg-white/5 text-yellow-400">
                <tr>
                  <th
                    scope="col"
                    className="sticky left-0 z-20 bg-[#121212] px-3 py-3"
                  >
                    Date
                  </th>

                  {TIME_COLUMNS.map((column) => (
                    <th
                      key={column.key}
                      scope="col"
                      className="whitespace-nowrap px-3 py-3"
                    >
                      {column.label}
                    </th>
                  ))}

                  <th
                    scope="col"
                    className="px-3 py-3 text-right"
                  >
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {rows.map((row, index) => {
                  const hasDuplicateDate = Boolean(
                    row.date &&
                      duplicateDates.has(row.date)
                  );

                  return (
                    <tr
                      key={`${row.date ?? "row"}-${index}`}
                      className="border-t border-white/10 bg-black/60"
                    >
                      <td className="sticky left-0 z-10 bg-[#090909] px-3 py-2">
                        <label className="sr-only">
                          Date for row {index + 1}
                        </label>

                        <input
                          type="date"
                          value={row.date ?? ""}
                          onChange={(event) => {
                            updateRow(
                              index,
                              "date",
                              event.target.value || null
                            );
                          }}
                          aria-invalid={hasDuplicateDate}
                          className="w-36 rounded-lg border border-white/10 bg-black px-2 py-2 text-white outline-none transition focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/40 aria-[invalid=true]:border-red-500"
                        />

                        {hasDuplicateDate ? (
                          <div className="mt-1 text-[10px] text-red-300">
                            Duplicate date
                          </div>
                        ) : null}
                      </td>

                      {TIME_COLUMNS.map((column) => (
                        <TimeCell
                          key={column.key}
                          label={`${column.label} for row ${
                            index + 1
                          }`}
                          value={row[column.key]}
                          onChange={(value) => {
                            updateRow(
                              index,
                              column.key,
                              value
                            );
                          }}
                        />
                      ))}

                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            removeRow(index);
                          }}
                          disabled={
                            isSaving && rows.length === 1
                          }
                          className="rounded-lg border border-red-500/30 px-3 py-2 text-red-300 transition hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={addRow}
              disabled={isSaving}
              className="rounded-xl border border-yellow-500/30 bg-black px-4 py-2 text-xs font-bold text-yellow-400 transition hover:bg-yellow-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Add row
            </button>

            <button
              type="button"
              onClick={sortRows}
              disabled={isSaving || rows.length < 2}
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-bold text-white/80 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Sort by date
            </button>

            <button
              type="button"
              onClick={resetRows}
              disabled={isSaving}
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-bold text-white/70 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Reset changes
            </button>

            <button
              type="button"
              onClick={() => {
                void saveRows();
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
              ) : saveState === "success" ? (
                "Save again"
              ) : (
                "Save reviewed rows"
              )}
            </button>
          </div>

          {validationError && !errorMessage ? (
            <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-5 text-amber-300">
              {validationError}
            </div>
          ) : null}

          <div aria-live="polite" aria-atomic="true">
            {message ? (
              <div
                role="status"
                className="mt-3 rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-xs leading-5 text-green-300"
              >
                {message}
              </div>
            ) : null}

            {errorMessage ? (
              <div
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

function TimeCell({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  return (
    <td className="px-3 py-2">
      <label className="sr-only">{label}</label>

      <input
        type="time"
        step={60}
        value={toInputTime(value)}
        onChange={(event) => {
          onChange(fromInputTime(event.target.value));
        }}
        className="w-28 rounded-lg border border-white/10 bg-black px-2 py-2 text-white outline-none transition focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/40"
      />
    </td>
  );
}