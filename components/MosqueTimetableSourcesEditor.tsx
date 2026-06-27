"use client";

import { useState } from "react";

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

type FormRow = {
  id?: string;
  source_url: string;
  source_type: string;
  auto_import_enabled: boolean;
  last_checked_at?: string | null;
  last_success_at?: string | null;
  last_error?: string | null;
};

type SaveSourceResponse = {
  ok?: boolean;
  error?: string;
  source?: TimetableSourceRow;
};

function buildEmptyRow(): FormRow {
  return {
    source_url: "",
    source_type: "website",
    auto_import_enabled: false,
    last_checked_at: null,
    last_success_at: null,
    last_error: null,
  };
}

function normaliseUrlForDisplay(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

function formatDateTime(value: string | null | undefined) {
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

function formatSourceType(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function MosqueTimetableSourcesEditor({
  mosqueId,
  mosqueName,
  initialSources,
}: Props) {
  const [rows, setRows] = useState<FormRow[]>(
    initialSources.length > 0
      ? initialSources.map((source) => ({
          id: source.id,
          source_url: source.source_url ?? "",
          source_type: source.source_type ?? "website",
          auto_import_enabled: source.auto_import_enabled ?? false,
          last_checked_at: source.last_checked_at,
          last_success_at: source.last_success_at,
          last_error: source.last_error,
        }))
      : [buildEmptyRow()]
  );

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  function updateRow(
    index: number,
    field: keyof FormRow,
    value: string | boolean
  ) {
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
  }

  function addRow() {
    setRows((current) => [...current, buildEmptyRow()]);
  }

  function removeRow(index: number) {
    setRows((current) => {
      if (current.length === 1) {
        return current;
      }

      return current.filter((_, rowIndex) => rowIndex !== index);
    });
  }

  async function saveRows() {
    try {
      setSaving(true);
      setMessage("");
      setErrorMessage("");

      const rowsToSave = rows
        .map((row, index) => ({
          ...row,
          index,
          source_url: row.source_url.trim(),
        }))
        .filter((row) => row.source_url.length > 0);

      if (rowsToSave.length === 0) {
        setErrorMessage("Add at least one timetable source URL.");
        return;
      }

      const updatedRows = [...rows];

      for (const row of rowsToSave) {
        const res = await fetch("/api/mosque/timetable-sources", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: row.id,
            mosque_id: mosqueId,
            source_url: row.source_url,
            source_type: row.source_type,
            auto_import_enabled: row.auto_import_enabled,
          }),
        });

        const data = (await res.json().catch(() => ({}))) as SaveSourceResponse;

        if (!res.ok || !data.ok || !data.source) {
          setErrorMessage(data.error ?? "Could not save timetable source.");
          return;
        }

        updatedRows[row.index] = {
          id: data.source.id,
          source_url: data.source.source_url,
          source_type: data.source.source_type,
          auto_import_enabled: data.source.auto_import_enabled,
          last_checked_at: data.source.last_checked_at,
          last_success_at: data.source.last_success_at,
          last_error: data.source.last_error,
        };
      }

      setRows(updatedRows);
      setMessage(
        "Timetable sources saved successfully. The Import timetable button is now available."
      );
    } catch {
      setErrorMessage("Could not save timetable sources.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
      <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
        Timetable Sources
      </div>

      <h1 className="mt-3 text-3xl font-black text-white">
        Timetable sources for {mosqueName}
      </h1>

      <p className="mt-3 max-w-3xl text-sm text-white/60">
        Add the mosque website, PDF timetable, image timetable, or CSV source.
        Save the source first, then use Import timetable to create an import
        queue item.
      </p>

      {message ? (
        <div className="mt-5 rounded-2xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-300">
          {message}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {errorMessage}
        </div>
      ) : null}

      <div className="mt-8 grid gap-5">
        {rows.map((row, index) => {
          const cleanUrl = normaliseUrlForDisplay(row.source_url);
          const isSaved = Boolean(row.id);

          return (
            <div
              key={row.id ?? index}
              className="rounded-2xl border border-white/10 bg-black/30 p-5"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-bold text-white">
                    Source {index + 1}
                  </div>

                  {isSaved ? (
                    <div className="mt-1 text-xs text-green-300">
                      Saved source — import is available
                    </div>
                  ) : (
                    <div className="mt-1 text-xs text-yellow-300">
                      Unsaved source — click Save sources first
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => removeRow(index)}
                  disabled={rows.length === 1}
                  className="rounded-xl border border-red-500/30 px-3 py-2 text-xs font-bold text-red-300 hover:bg-red-500/10 disabled:opacity-40"
                >
                  Remove
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-[1.5fr_0.7fr]">
                <Input
                  label="Source URL"
                  value={row.source_url}
                  onChange={(value) => updateRow(index, "source_url", value)}
                  placeholder="https://mosque.org.uk/prayer-timetable.pdf"
                />

                <Select
                  label="Source type"
                  value={row.source_type}
                  onChange={(value) => updateRow(index, "source_type", value)}
                  options={[
                    ["website", "Website page"],
                    ["pdf", "PDF timetable"],
                    ["image", "Image timetable"],
                    ["csv", "CSV / spreadsheet"],
                    ["manual", "Manual source"],
                  ]}
                />
              </div>

              <label className="mt-4 flex items-center gap-3 text-sm text-white/70">
                <input
                  type="checkbox"
                  checked={row.auto_import_enabled}
                  onChange={(e) =>
                    updateRow(index, "auto_import_enabled", e.target.checked)
                  }
                />
                Enable automatic monthly import check later
              </label>

              {isSaved ? (
                <div className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-black/30 p-4 text-xs text-white/60 md:grid-cols-3">
                  <div>
                    <div className="font-semibold text-yellow-400">
                      Source type
                    </div>
                    <div className="mt-1">
                      {formatSourceType(row.source_type)}
                    </div>
                  </div>

                  <div>
                    <div className="font-semibold text-yellow-400">
                      Last checked
                    </div>
                    <div className="mt-1">
                      {formatDateTime(row.last_checked_at)}
                    </div>
                  </div>

                  <div>
                    <div className="font-semibold text-yellow-400">
                      Last success
                    </div>
                    <div className="mt-1">
                      {formatDateTime(row.last_success_at)}
                    </div>
                  </div>

                  {row.last_error ? (
                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-red-300 md:col-span-3">
                      {row.last_error}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {isSaved && cleanUrl ? (
                <MosqueTimetableImportButton
                  mosqueId={mosqueId}
                  sourceId={row.id}
                  sourceUrl={cleanUrl}
                  sourceType={row.source_type}
                />
              ) : (
                <div className="mt-4 rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-3 text-xs text-yellow-100">
                  Save this source first before importing.
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={addRow}
          className="rounded-2xl border border-yellow-500/30 bg-black px-6 py-3 text-sm font-bold text-yellow-400 hover:bg-yellow-500/10"
        >
          Add another source
        </button>

        <button
          type="button"
          onClick={saveRows}
          disabled={saving}
          className="rounded-2xl bg-yellow-500 px-6 py-3 text-sm font-bold text-black hover:bg-yellow-400 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save sources"}
        </button>
      </div>
    </section>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-sm font-semibold text-yellow-400">{label}</label>

      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-2xl border border-yellow-500/20 bg-black px-4 py-3 text-sm text-white outline-none focus:border-yellow-400"
      />
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <div>
      <label className="text-sm font-semibold text-yellow-400">{label}</label>

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-2xl border border-yellow-500/20 bg-black px-4 py-3 text-sm text-white outline-none focus:border-yellow-400"
      >
        {options.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}

