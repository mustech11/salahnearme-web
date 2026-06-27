"use client";

import { useMemo, useState } from "react";

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
};

type Props = {
  importId: string;
  extractedJson: unknown;
};

function isParsedTimetable(value: unknown): value is ParsedTimetable {
  return Boolean(value && typeof value === "object");
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

function toInputTime(value: string | null) {
  if (!value) {
    return "";
  }

  return value.slice(0, 5);
}

function fromInputTime(value: string) {
  if (!value) {
    return null;
  }

  return `${value}:00`;
}

function buildInitialRows(extractedJson: unknown): ParsedPrayerRow[] {
  if (!isParsedTimetable(extractedJson)) {
    return [];
  }

  if (!Array.isArray(extractedJson.rows)) {
    return [];
  }

  return extractedJson.rows.map((row) => ({
    ...emptyRow(),
    ...row,
  }));
}

export default function MosqueTimetableParsedRowsEditor({
  importId,
  extractedJson,
}: Props) {
  const parsedJson = isParsedTimetable(extractedJson) ? extractedJson : {};

  const initialRows = useMemo(
    () => buildInitialRows(extractedJson),
    [extractedJson]
  );

  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ParsedPrayerRow[]>(initialRows);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  function updateRow(
    index: number,
    field: keyof ParsedPrayerRow,
    value: string | null
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
    setRows((current) => [...current, emptyRow()]);
  }

  function removeRow(index: number) {
    setRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
  }

  async function saveRows() {
    try {
      setSaving(true);
      setMessage("");
      setErrorMessage("");

      const validRows = rows.filter((row) => row.date);

      if (validRows.length === 0) {
        setErrorMessage("Add at least one row with a valid date.");
        return;
      }

      const res = await fetch(
        "/api/mosque/timetable-imports/update-parsed-json",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            import_id: importId,
            extracted_json: {
              ...parsedJson,
              rows: validRows,
            },
          }),
        }
      );

      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        rows_count?: number;
      };

      if (!res.ok || !data.ok) {
        setErrorMessage(data.error ?? "Could not save reviewed rows.");
        return;
      }

      setMessage(
        `Reviewed timetable saved. ${
          data.rows_count ?? validRows.length
        } rows are ready for approval. Refresh page before approving.`
      );
    } catch {
      setErrorMessage("Could not save reviewed rows.");
    } finally {
      setSaving(false);
    }
  }

  if (initialRows.length === 0) {
    return null;
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 py-2 text-xs font-bold text-purple-200 hover:bg-purple-500/20"
      >
        {open ? "Hide review table" : "Review / edit parsed rows"}
      </button>

      {open ? (
        <div className="mt-4 rounded-2xl border border-purple-500/20 bg-black/40 p-4">
          <div className="text-sm font-bold text-yellow-400">
            Parsed timetable review
          </div>

          <p className="mt-2 text-xs text-white/50">
            Check every row before approval. You can correct dates and prayer
            times here, then save the reviewed JSON before publishing.
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-[1100px] border-separate border-spacing-y-2 text-left text-xs">
              <thead className="text-yellow-400">
                <tr>
                  <th className="px-2 py-2">Date</th>
                  <th className="px-2 py-2">Fajr Begins</th>
                  <th className="px-2 py-2">Fajr Iqamah</th>
                  <th className="px-2 py-2">Sunrise</th>
                  <th className="px-2 py-2">Dhuhr Begins</th>
                  <th className="px-2 py-2">Dhuhr Iqamah</th>
                  <th className="px-2 py-2">Asr Begins</th>
                  <th className="px-2 py-2">Asr Iqamah</th>
                  <th className="px-2 py-2">Maghrib Begins</th>
                  <th className="px-2 py-2">Maghrib Iqamah</th>
                  <th className="px-2 py-2">Isha Begins</th>
                  <th className="px-2 py-2">Isha Iqamah</th>
                  <th className="px-2 py-2">Remove</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${row.date ?? "row"}-${index}`} className="bg-black">
                    <td className="px-2 py-2">
                      <input
                        type="date"
                        value={row.date ?? ""}
                        onChange={(e) =>
                          updateRow(index, "date", e.target.value || null)
                        }
                        className="w-36 rounded-lg border border-white/10 bg-black px-2 py-2 text-white outline-none focus:border-yellow-400"
                      />
                    </td>

                    <TimeCell
                      value={row.fajr_begins}
                      onChange={(value) =>
                        updateRow(index, "fajr_begins", value)
                      }
                    />

                    <TimeCell
                      value={row.fajr_iqamah}
                      onChange={(value) =>
                        updateRow(index, "fajr_iqamah", value)
                      }
                    />

                    <TimeCell
                      value={row.sunrise}
                      onChange={(value) => updateRow(index, "sunrise", value)}
                    />

                    <TimeCell
                      value={row.dhuhr_begins}
                      onChange={(value) =>
                        updateRow(index, "dhuhr_begins", value)
                      }
                    />

                    <TimeCell
                      value={row.dhuhr_iqamah}
                      onChange={(value) =>
                        updateRow(index, "dhuhr_iqamah", value)
                      }
                    />

                    <TimeCell
                      value={row.asr_begins}
                      onChange={(value) =>
                        updateRow(index, "asr_begins", value)
                      }
                    />

                    <TimeCell
                      value={row.asr_iqamah}
                      onChange={(value) =>
                        updateRow(index, "asr_iqamah", value)
                      }
                    />

                    <TimeCell
                      value={row.maghrib_begins}
                      onChange={(value) =>
                        updateRow(index, "maghrib_begins", value)
                      }
                    />

                    <TimeCell
                      value={row.maghrib_iqamah}
                      onChange={(value) =>
                        updateRow(index, "maghrib_iqamah", value)
                      }
                    />

                    <TimeCell
                      value={row.isha_begins}
                      onChange={(value) =>
                        updateRow(index, "isha_begins", value)
                      }
                    />

                    <TimeCell
                      value={row.isha_iqamah}
                      onChange={(value) =>
                        updateRow(index, "isha_iqamah", value)
                      }
                    />

                    <td className="px-2 py-2">
                      <button
                        type="button"
                        onClick={() => removeRow(index)}
                        className="rounded-lg border border-red-500/30 px-3 py-2 text-red-300 hover:bg-red-500/10"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={addRow}
              className="rounded-xl border border-yellow-500/30 bg-black px-4 py-2 text-xs font-bold text-yellow-400 hover:bg-yellow-500/10"
            >
              Add row
            </button>

            <button
              type="button"
              onClick={saveRows}
              disabled={saving}
              className="rounded-xl bg-yellow-500 px-4 py-2 text-xs font-bold text-black hover:bg-yellow-400 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save reviewed rows"}
            </button>
          </div>

          {message ? (
            <div className="mt-3 rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-xs text-green-300">
              {message}
            </div>
          ) : null}

          {errorMessage ? (
            <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
              {errorMessage}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function TimeCell({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  return (
    <td className="px-2 py-2">
      <input
        type="time"
        value={toInputTime(value)}
        onChange={(e) => onChange(fromInputTime(e.target.value))}
        className="w-28 rounded-lg border border-white/10 bg-black px-2 py-2 text-white outline-none focus:border-yellow-400"
      />
    </td>
  );
}

