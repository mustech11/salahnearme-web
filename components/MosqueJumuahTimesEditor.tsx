"use client";

import { useMemo, useState } from "react";

type JumuahTime = {
  id?: string | null;
  mosque_id: string;
  label: string | null;
  khutbah_time: string | null;
  salah_time: string | null;
  active: boolean | null;
  notes: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type JumuahForm = {
  id?: string | null;
  label: string;
  khutbah_time: string;
  salah_time: string;
  active: boolean;
  notes: string;
};

type SaveResponse = {
  ok?: boolean;
  error?: string;
  jumuah_time?: JumuahTime;
};

type Props = {
  mosqueId: string;
  mosqueName: string;
  initialJumuahTimes: JumuahTime[];
};

const MAX_SESSIONS = 8;
const MAX_LABEL_LENGTH = 80;
const MAX_NOTES_LENGTH = 500;

function toInputTime(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const trimmed = value.trim();

  if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed.slice(0, 5);
  }

  if (/^\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  return "";
}

function isValidTime(value: string) {
  if (!/^\d{2}:\d{2}$/.test(value)) {
    return false;
  }

  const [hoursRaw, minutesRaw] = value.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);

  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

function cleanText(value: string, maxLength: number) {
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function ordinalLabel(index: number) {
  const number = index + 1;

  if (number === 1) {
    return "1st Jumu’ah";
  }

  if (number === 2) {
    return "2nd Jumu’ah";
  }

  if (number === 3) {
    return "3rd Jumu’ah";
  }

  return `${number}th Jumu’ah`;
}

function createEmptySession(index: number): JumuahForm {
  return {
    id: null,
    label: ordinalLabel(index),
    khutbah_time: "",
    salah_time: "",
    active: true,
    notes: "",
  };
}

function toFormRow(row: JumuahTime, index: number): JumuahForm {
  return {
    id: row.id ?? null,
    label: cleanText(row.label ?? ordinalLabel(index), MAX_LABEL_LENGTH),
    khutbah_time: toInputTime(row.khutbah_time),
    salah_time: toInputTime(row.salah_time),
    active: row.active ?? true,
    notes: (row.notes ?? "").slice(0, MAX_NOTES_LENGTH),
  };
}

function buildInitialRows(initialJumuahTimes: JumuahTime[]) {
  if (initialJumuahTimes.length > 0) {
    return initialJumuahTimes.map(toFormRow);
  }

  return [0, 1, 2].map((index) => createEmptySession(index));
}

function formatSavedTime(value: string | null | undefined) {
  const inputTime = toInputTime(value);

  return inputTime || "—";
}

function getActiveCount(sessions: JumuahForm[]) {
  return sessions.filter((session) => session.active).length;
}

function getCompleteCount(sessions: JumuahForm[]) {
  return sessions.filter((session) => session.salah_time).length;
}

function normaliseSavedSession(
  current: JumuahForm,
  saved: JumuahTime
): JumuahForm {
  return {
    id: saved.id ?? current.id ?? null,
    label: cleanText(saved.label ?? current.label, MAX_LABEL_LENGTH),
    khutbah_time: toInputTime(saved.khutbah_time),
    salah_time: toInputTime(saved.salah_time),
    active: saved.active ?? current.active,
    notes: (saved.notes ?? current.notes ?? "").slice(0, MAX_NOTES_LENGTH),
  };
}

export default function MosqueJumuahTimesEditor({
  mosqueId,
  mosqueName,
  initialJumuahTimes,
}: Props) {
  const initialRows = useMemo(
    () => buildInitialRows(initialJumuahTimes),
    [initialJumuahTimes]
  );

  const [sessions, setSessions] = useState<JumuahForm[]>(initialRows);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const activeCount = getActiveCount(sessions);
  const completeCount = getCompleteCount(sessions);

  function updateSession(
    index: number,
    field: keyof JumuahForm,
    value: string | boolean
  ) {
    setMessage("");
    setErrorMessage("");

    setSessions((current) =>
      current.map((session, sessionIndex) =>
        sessionIndex === index
          ? {
              ...session,
              [field]:
                typeof value === "string" && field === "notes"
                  ? value.slice(0, MAX_NOTES_LENGTH)
                  : typeof value === "string" && field === "label"
                    ? value.slice(0, MAX_LABEL_LENGTH)
                    : value,
            }
          : session
      )
    );
  }

  function addSession() {
    setMessage("");
    setErrorMessage("");

    setSessions((current) => {
      if (current.length >= MAX_SESSIONS) {
        return current;
      }

      return [...current, createEmptySession(current.length)];
    });
  }

  function removeUnsavedSession(index: number) {
    setMessage("");
    setErrorMessage("");

    setSessions((current) => {
      if (current.length <= 1) {
        return current;
      }

      const row = current[index];

      if (row?.id) {
        return current.map((session, sessionIndex) =>
          sessionIndex === index
            ? {
                ...session,
                active: false,
              }
            : session
        );
      }

      return current.filter((_, sessionIndex) => sessionIndex !== index);
    });
  }

  function validateSession(session: JumuahForm) {
    const label = cleanText(session.label || "Jumu’ah", MAX_LABEL_LENGTH);

    if (!label) {
      return "Session label is required.";
    }

    if (!session.salah_time) {
      return "Salah time is required.";
    }

    if (!isValidTime(session.salah_time)) {
      return "Salah time must be a valid 24-hour time.";
    }

    if (session.khutbah_time && !isValidTime(session.khutbah_time)) {
      return "Khutbah time must be a valid 24-hour time.";
    }

    return null;
  }

  async function submitSession(session: JumuahForm) {
    const res = await fetch("/api/mosque/jumuah-times", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: session.id || null,
        mosque_id: mosqueId,
        label: cleanText(session.label || "Jumu’ah", MAX_LABEL_LENGTH),
        khutbah_time: session.khutbah_time || null,
        salah_time: session.salah_time,
        active: session.active,
        notes: session.notes.trim() ? session.notes.trim() : null,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as SaveResponse;

    if (!res.ok || !data.ok || !data.jumuah_time) {
      throw new Error(data.error ?? "Could not save Jumu’ah session.");
    }

    return data.jumuah_time;
  }

  async function saveSession(index: number) {
    const session = sessions[index];

    if (!session) {
      setErrorMessage("Session not found.");
      return;
    }

    const validationError = validateSession(session);

    if (validationError) {
      setMessage("");
      setErrorMessage(validationError);
      return;
    }

    try {
      setSavingIndex(index);
      setMessage("");
      setErrorMessage("");

      const saved = await submitSession(session);

      setSessions((current) =>
        current.map((item, itemIndex) =>
          itemIndex === index ? normaliseSavedSession(item, saved) : item
        )
      );

      setMessage(`${session.label || "Jumu’ah"} saved successfully.`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not save Jumu’ah session."
      );
    } finally {
      setSavingIndex(null);
    }
  }

  async function saveAllSessions() {
    const rowsToSave = sessions.filter(
      (session) => session.salah_time || session.id
    );

    if (rowsToSave.length === 0) {
      setMessage("");
      setErrorMessage("Add at least one Jumu’ah salah time before saving.");
      return;
    }

    for (const session of rowsToSave) {
      const validationError = validateSession(session);

      if (validationError) {
        setMessage("");
        setErrorMessage(`${session.label || "Jumu’ah"}: ${validationError}`);
        return;
      }
    }

    try {
      setSavingAll(true);
      setMessage("");
      setErrorMessage("");

      const savedRows: JumuahForm[] = [...sessions];

      for (const session of rowsToSave) {
        const index = sessions.indexOf(session);
        const saved = await submitSession(session);
        savedRows[index] = normaliseSavedSession(session, saved);
      }

      setSessions(savedRows);
      setMessage("All Jumu’ah sessions saved successfully.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not save all Jumu’ah sessions."
      );
    } finally {
      setSavingAll(false);
    }
  }

  return (
    <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
            Jumu’ah Timetable
          </div>

          <h1 className="mt-3 text-3xl font-black text-white">
            Friday prayer sessions for {mosqueName}
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/60">
            Add khutbah and salah times for each Friday session. Active sessions
            appear on the public mosque profile, while inactive sessions are
            kept safely for future use.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <StatusCard label="Sessions" value={sessions.length} />
          <StatusCard label="Active" value={activeCount} />
          <StatusCard label="Timed" value={completeCount} />
        </div>
      </div>

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
        {sessions.map((session, index) => {
          const isSaved = Boolean(session.id);
          const isSaving = savingIndex === index || savingAll;

          return (
            <div
              key={session.id ?? `new-${index}`}
              className="rounded-2xl border border-white/10 bg-black/30 p-5"
            >
              <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-lg font-bold text-white">
                    {session.label || ordinalLabel(index)}
                  </div>

                  <div className="mt-1 flex flex-wrap gap-2">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                        session.active
                          ? "border-green-500/30 bg-green-500/10 text-green-300"
                          : "border-white/10 bg-white/5 text-white/50"
                      }`}
                    >
                      {session.active ? "Active on public page" : "Inactive"}
                    </span>

                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                        isSaved
                          ? "border-green-500/30 bg-green-500/10 text-green-300"
                          : "border-yellow-500/30 bg-yellow-500/10 text-yellow-300"
                      }`}
                    >
                      {isSaved ? "Saved" : "Unsaved"}
                    </span>

                    {session.salah_time ? (
                      <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-300">
                        Salah {formatSavedTime(session.salah_time)}
                      </span>
                    ) : null}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => removeUnsavedSession(index)}
                  disabled={sessions.length <= 1 || isSaving}
                  className="rounded-xl border border-red-500/30 px-3 py-2 text-xs font-bold text-red-300 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {session.id ? "Mark inactive" : "Remove"}
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  label="Session label"
                  value={session.label}
                  onChange={(value) => updateSession(index, "label", value)}
                  placeholder={ordinalLabel(index)}
                  maxLength={MAX_LABEL_LENGTH}
                />

                <Select
                  label="Status"
                  value={session.active ? "active" : "inactive"}
                  onChange={(value) =>
                    updateSession(index, "active", value === "active")
                  }
                  options={[
                    ["active", "Active"],
                    ["inactive", "Inactive"],
                  ]}
                />

                <Input
                  label="Khutbah time"
                  type="time"
                  value={session.khutbah_time}
                  onChange={(value) =>
                    updateSession(index, "khutbah_time", value)
                  }
                />

                <Input
                  label="Salah time"
                  type="time"
                  value={session.salah_time}
                  onChange={(value) =>
                    updateSession(index, "salah_time", value)
                  }
                  required
                />
              </div>

              <div className="mt-4">
                <label className="text-sm font-semibold text-yellow-400">
                  Notes
                </label>

                <textarea
                  value={session.notes}
                  onChange={(event) =>
                    updateSession(index, "notes", event.target.value)
                  }
                  rows={3}
                  maxLength={MAX_NOTES_LENGTH}
                  className="mt-2 w-full rounded-2xl border border-yellow-500/20 bg-black px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-yellow-400"
                  placeholder="Optional notes, for example main hall, second hall, sisters area, Ramadan only..."
                />

                <div className="mt-1 text-right text-xs text-white/40">
                  {session.notes.length}/{MAX_NOTES_LENGTH}
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => saveSession(index)}
                  disabled={isSaving}
                  className="rounded-2xl bg-yellow-500 px-5 py-3 text-sm font-bold text-black hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingIndex === index ? "Saving..." : "Save session"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={addSession}
          disabled={sessions.length >= MAX_SESSIONS || savingAll}
          className="rounded-2xl border border-yellow-500/30 bg-black px-5 py-3 text-sm font-bold text-yellow-400 hover:bg-yellow-500/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add another Jumu’ah session
        </button>

        <button
          type="button"
          onClick={saveAllSessions}
          disabled={savingAll || savingIndex !== null}
          className="rounded-2xl bg-yellow-500 px-5 py-3 text-sm font-bold text-black hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {savingAll ? "Saving all..." : "Save all sessions"}
        </button>
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4 text-xs leading-6 text-white/50">
        Tip: to remove an already saved Jumu’ah session from the public page,
        mark it inactive and save it. This keeps an audit trail instead of
        deleting useful mosque data.
      </div>
    </section>
  );
}

function StatusCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
      <div className="text-lg font-black text-white">{value}</div>
      <div className="mt-1 uppercase tracking-[0.18em] text-white/40">
        {label}
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required = false,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
}) {
  return (
    <div>
      <label className="text-sm font-semibold text-yellow-400">
        {label}
        {required ? <span className="ml-1 text-red-300">*</span> : null}
      </label>

      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        maxLength={maxLength}
        className="mt-2 w-full rounded-2xl border border-yellow-500/20 bg-black px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-yellow-400"
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
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-yellow-500/20 bg-black px-4 py-3 text-sm text-white outline-none transition focus:border-yellow-400"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </div>
  );
}