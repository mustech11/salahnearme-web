"use client";

import { useState } from "react";

type DayKey =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

type DayHours = {
  open: string;
  close: string;
  closed: boolean;
};

type OpeningHours = Record<DayKey, DayHours>;

const DAYS: { key: DayKey; label: string }[] = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
];

function defaultHours(): OpeningHours {
  return {
    monday: { open: "09:00", close: "22:00", closed: false },
    tuesday: { open: "09:00", close: "22:00", closed: false },
    wednesday: { open: "09:00", close: "22:00", closed: false },
    thursday: { open: "09:00", close: "22:00", closed: false },
    friday: { open: "09:00", close: "22:00", closed: false },
    saturday: { open: "09:00", close: "22:00", closed: false },
    sunday: { open: "09:00", close: "22:00", closed: false },
  };
}

export default function BusinessOpeningHoursEditor({
  businessId,
  initialHours,
  initialNote,
}: {
  businessId: string;
  initialHours?: Partial<OpeningHours> | null;
  initialNote?: string | null;
}) {
  const [hours, setHours] = useState<OpeningHours>({
    ...defaultHours(),
    ...(initialHours ?? {}),
  });

  const [note, setNote] = useState(initialNote ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  function updateDay(day: DayKey, patch: Partial<DayHours>) {
    setHours((current) => ({
      ...current,
      [day]: {
        ...current[day],
        ...patch,
      },
    }));
  }

  async function save() {
    setSaving(true);
    setMessage("");

    const res = await fetch("/api/business-dashboard/opening-hours", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        business_id: businessId,
        opening_hours: hours,
        opening_hours_note: note,
      }),
    });

    const data = await res.json().catch(() => ({}));

    setSaving(false);

    if (!res.ok || !data.ok) {
      setMessage(data.error ?? "Could not save opening hours.");
      return;
    }

    setMessage("Opening hours saved.");
  }

  return (
    <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
      <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
        Opening Hours
      </div>

      <h2 className="mt-3 text-3xl font-black text-white">
        Manage weekly opening times
      </h2>

      <div className="mt-6 grid gap-4">
        {DAYS.map((day) => {
          const value = hours[day.key];

          return (
            <div
              key={day.key}
              className="grid gap-3 rounded-2xl border border-white/10 bg-black/30 p-4 md:grid-cols-[1fr_1fr_1fr_auto]"
            >
              <div className="font-semibold text-white">{day.label}</div>

              <input
                type="time"
                value={value.open}
                disabled={value.closed}
                onChange={(e) =>
                  updateDay(day.key, { open: e.target.value })
                }
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white disabled:opacity-40"
              />

              <input
                type="time"
                value={value.close}
                disabled={value.closed}
                onChange={(e) =>
                  updateDay(day.key, { close: e.target.value })
                }
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white disabled:opacity-40"
              />

              <label className="flex items-center gap-2 text-sm text-white/70">
                <input
                  type="checkbox"
                  checked={value.closed}
                  onChange={(e) =>
                    updateDay(day.key, { closed: e.target.checked })
                  }
                />
                Closed
              </label>
            </div>
          );
        })}
      </div>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        placeholder="Optional note, e.g. Ramadan hours may differ."
        className="mt-6 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-yellow-400"
      />

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="mt-5 rounded-2xl bg-yellow-500 px-6 py-3 text-sm font-semibold text-black hover:bg-yellow-400 disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save opening hours"}
      </button>

      {message && <div className="mt-4 text-sm text-white/70">{message}</div>}
    </section>
  );
}

