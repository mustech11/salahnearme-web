"use client";

import { useState } from "react";

type JumuahTime = {
  id?: string;
  mosque_id: string;
  label: string | null;
  khutbah_time: string | null;
  salah_time: string | null;
  active: boolean | null;
  notes: string | null;
};

type JumuahForm = {
  id?: string;
  label: string;
  khutbah_time: string;
  salah_time: string;
  active: boolean;
  notes: string;
};

type Props = {
  mosqueId: string;
  mosqueName: string;
  initialJumuahTimes: JumuahTime[];
};

function toInputTime(value: string | null | undefined) {
  if (!value) return "";
  return value.slice(0, 5);
}

function createEmptySession(label: string): JumuahForm {
  return {
    label,
    khutbah_time: "",
    salah_time: "",
    active: true,
    notes: "",
  };
}

function toFormRow(row: JumuahTime): JumuahForm {
  return {
    id: row.id,
    label: row.label ?? "Jumu’ah",
    khutbah_time: toInputTime(row.khutbah_time),
    salah_time: toInputTime(row.salah_time),
    active: row.active ?? true,
    notes: row.notes ?? "",
  };
}

export default function MosqueJumuahTimesEditor({
  mosqueId,
  mosqueName,
  initialJumuahTimes,
}: Props) {
  const [sessions, setSessions] = useState<JumuahForm[]>(() => {
    if (initialJumuahTimes.length > 0) {
      return initialJumuahTimes.map(toFormRow);
    }

    return [
      createEmptySession("1st Jumu’ah"),
      createEmptySession("2nd Jumu’ah"),
      createEmptySession("3rd Jumu’ah"),
    ];
  });

  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  function updateSession(
    index: number,
    field: keyof JumuahForm,
    value: string | boolean
  ) {
    setSessions((current) =>
      current.map((session, i) =>
        i === index
          ? {
              ...session,
              [field]: value,
            }
          : session
      )
    );
  }

  function addSession() {
    setSessions((current) => [
      ...current,
      createEmptySession(`${current.length + 1}th Jumu’ah`),
    ]);
  }

  async function saveSession(index: number) {
    const session = sessions[index];

    if (!session.salah_time) {
      setErrorMessage("Salah time is required.");
      return;
    }

    try {
      setSavingIndex(index);
      setMessage("");
      setErrorMessage("");

      const res = await fetch("/api/mosque/jumuah-times", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: session.id,
          mosque_id: mosqueId,
          label: session.label,
          khutbah_time: session.khutbah_time || null,
          salah_time: session.salah_time,
          active: session.active,
          notes: session.notes || null,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        jumuah_time?: JumuahTime;
      };

      if (!res.ok || !data.ok) {
        setErrorMessage(data.error ?? "Could not save Jumu’ah session.");
        return;
      }

      if (data.jumuah_time?.id) {
        setSessions((current) =>
          current.map((item, i) =>
            i === index
              ? {
                  ...item,
                  id: data.jumuah_time?.id,
                }
              : item
          )
        );
      }

      setMessage(`${session.label} saved successfully.`);
    } catch {
      setErrorMessage("Could not save Jumu’ah session.");
    } finally {
      setSavingIndex(null);
    }
  }

  return (
    <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
      <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
        Jumuʿah Timetable
      </div>

      <h1 className="mt-3 text-3xl font-black text-white">
        Friday prayer sessions for {mosqueName}
      </h1>

      <p className="mt-3 max-w-3xl text-sm text-white/60">
        Add or update Jumuʿah khutbah and salah times. Active sessions appear on
        the public mosque page.
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
        {sessions.map((session, index) => (
          <div
            key={session.id ?? index}
            className="rounded-2xl border border-white/10 bg-black/30 p-5"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Session label"
                value={session.label}
                onChange={(value) => updateSession(index, "label", value)}
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
                onChange={(value) => updateSession(index, "salah_time", value)}
              />
            </div>

            <div className="mt-4">
              <label className="text-sm font-semibold text-yellow-400">
                Notes
              </label>

              <textarea
                value={session.notes}
                onChange={(e) =>
                  updateSession(index, "notes", e.target.value)
                }
                rows={3}
                className="mt-2 w-full rounded-2xl border border-yellow-500/20 bg-black px-4 py-3 text-sm text-white outline-none focus:border-yellow-400"
                placeholder="Optional notes, for example main hall, second hall, sisters area, Ramadan only..."
              />
            </div>

            <button
              type="button"
              onClick={() => saveSession(index)}
              disabled={savingIndex === index}
              className="mt-5 rounded-2xl bg-yellow-500 px-5 py-3 text-sm font-bold text-black hover:bg-yellow-400 disabled:opacity-50"
            >
              {savingIndex === index ? "Saving..." : "Save session"}
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addSession}
        className="mt-6 rounded-2xl border border-yellow-500/30 bg-black px-5 py-3 text-sm font-bold text-yellow-400 hover:bg-yellow-500/10"
      >
        Add another Jumuʿah session
      </button>
    </section>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="text-sm font-semibold text-yellow-400">{label}</label>

      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
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

