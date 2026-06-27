"use client";

import { useMemo, useState } from "react";

type PrayerTimeRow = {
  id?: string;
  mosque_id: string;
  prayer_date: string;

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

  source: string | null;
  confidence: string | null;
  notes: string | null;
};

type FormState = {
  prayer_date: string;

  fajr_begins: string;
  fajr_iqamah: string;

  sunrise: string;

  dhuhr_begins: string;
  dhuhr_iqamah: string;

  asr_begins: string;
  asr_iqamah: string;

  maghrib_begins: string;
  maghrib_iqamah: string;

  isha_begins: string;
  isha_iqamah: string;

  source: string;
  confidence: string;
  notes: string;
};

type Props = {
  mosqueId: string;
  mosqueName: string;
  initialPrayerTime?: PrayerTimeRow | null;
};

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function toInputTime(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return value.slice(0, 5);
}

function buildInitialForm(initialPrayerTime?: PrayerTimeRow | null): FormState {
  return {
    prayer_date: initialPrayerTime?.prayer_date ?? todayIsoDate(),

    fajr_begins: toInputTime(initialPrayerTime?.fajr_begins),
    fajr_iqamah: toInputTime(initialPrayerTime?.fajr_iqamah),

    sunrise: toInputTime(initialPrayerTime?.sunrise),

    dhuhr_begins: toInputTime(initialPrayerTime?.dhuhr_begins),
    dhuhr_iqamah: toInputTime(initialPrayerTime?.dhuhr_iqamah),

    asr_begins: toInputTime(initialPrayerTime?.asr_begins),
    asr_iqamah: toInputTime(initialPrayerTime?.asr_iqamah),

    maghrib_begins: toInputTime(initialPrayerTime?.maghrib_begins),
    maghrib_iqamah: toInputTime(initialPrayerTime?.maghrib_iqamah),

    isha_begins: toInputTime(initialPrayerTime?.isha_begins),
    isha_iqamah: toInputTime(initialPrayerTime?.isha_iqamah),

    source: initialPrayerTime?.source ?? "manual",
    confidence: initialPrayerTime?.confidence ?? "official",
    notes: initialPrayerTime?.notes ?? "",
  };
}

export default function MosquePrayerTimesEditor({
  mosqueId,
  mosqueName,
  initialPrayerTime,
}: Props) {
  const initialForm = useMemo(
    () => buildInitialForm(initialPrayerTime),
    [initialPrayerTime]
  );

  const [form, setForm] = useState<FormState>(initialForm);
  const [saving, setSaving] = useState(false);
  const [loadingDate, setLoadingDate] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  function updateField(field: keyof FormState, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function loadDate(date: string) {
    try {
      setLoadingDate(true);
      setMessage("");
      setErrorMessage("");

      const res = await fetch(
        `/api/mosque/prayer-times?mosque_id=${encodeURIComponent(
          mosqueId
        )}&date=${encodeURIComponent(date)}`,
        {
          cache: "no-store",
        }
      );

      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        prayer_times?: PrayerTimeRow[];
        error?: string;
      };

      if (!res.ok || !data.ok) {
        setErrorMessage(data.error ?? "Could not load prayer times.");
        return;
      }

      const row = data.prayer_times?.[0] ?? null;

      setForm({
        ...buildInitialForm(row),
        prayer_date: date,
      });

      if (!row) {
        setMessage("No timetable found for this date. You can create one now.");
      }
    } catch {
      setErrorMessage("Could not load prayer times.");
    } finally {
      setLoadingDate(false);
    }
  }

  async function save() {
    try {
      setSaving(true);
      setMessage("");
      setErrorMessage("");

      const res = await fetch("/api/mosque/prayer-times", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mosque_id: mosqueId,
          ...form,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };

      if (!res.ok || !data.ok) {
        setErrorMessage(data.error ?? "Could not save prayer times.");
        return;
      }

      setMessage("Mosque prayer times saved successfully.");
    } catch {
      setErrorMessage("Could not save prayer times.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
      <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
        Mosque Timetable
      </div>

      <h1 className="mt-3 text-3xl font-black text-white">
        Prayer times for {mosqueName}
      </h1>

      <p className="mt-3 max-w-3xl text-sm text-white/60">
        Add or update today’s mosque-specific begins and iqamah times. These
        times appear publicly on the mosque page.
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

      <div className="mt-6 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
        <Input
          label="Timetable date"
          type="date"
          value={form.prayer_date}
          onChange={(value) => updateField("prayer_date", value)}
        />

        <button
          type="button"
          onClick={() => loadDate(form.prayer_date)}
          disabled={loadingDate}
          className="rounded-2xl border border-yellow-500/30 bg-black px-6 py-3 text-sm font-bold text-yellow-400 hover:bg-yellow-500/10 disabled:opacity-50"
        >
          {loadingDate ? "Loading..." : "Load date"}
        </button>
      </div>

      <div className="mt-8 grid gap-5">
        <PrayerRow
          prayer="Fajr"
          begins={form.fajr_begins}
          iqamah={form.fajr_iqamah}
          onBeginsChange={(value) => updateField("fajr_begins", value)}
          onIqamahChange={(value) => updateField("fajr_iqamah", value)}
        />

        <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
          <Input
            label="Sunrise"
            type="time"
            value={form.sunrise}
            onChange={(value) => updateField("sunrise", value)}
          />
        </div>

        <PrayerRow
          prayer="Dhuhr"
          begins={form.dhuhr_begins}
          iqamah={form.dhuhr_iqamah}
          onBeginsChange={(value) => updateField("dhuhr_begins", value)}
          onIqamahChange={(value) => updateField("dhuhr_iqamah", value)}
        />

        <PrayerRow
          prayer="Asr"
          begins={form.asr_begins}
          iqamah={form.asr_iqamah}
          onBeginsChange={(value) => updateField("asr_begins", value)}
          onIqamahChange={(value) => updateField("asr_iqamah", value)}
        />

        <PrayerRow
          prayer="Maghrib"
          begins={form.maghrib_begins}
          iqamah={form.maghrib_iqamah}
          onBeginsChange={(value) => updateField("maghrib_begins", value)}
          onIqamahChange={(value) => updateField("maghrib_iqamah", value)}
        />

        <PrayerRow
          prayer="Isha"
          begins={form.isha_begins}
          iqamah={form.isha_iqamah}
          onBeginsChange={(value) => updateField("isha_begins", value)}
          onIqamahChange={(value) => updateField("isha_iqamah", value)}
        />
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Select
          label="Source"
          value={form.source}
          onChange={(value) => updateField("source", value)}
          options={[
            ["manual", "Manual entry"],
            ["mosque_admin", "Mosque admin"],
            ["imported", "Imported timetable"],
            ["ai_import", "AI timetable import"],
            ["community", "Community report"],
          ]}
        />

        <Select
          label="Confidence"
          value={form.confidence}
          onChange={(value) => updateField("confidence", value)}
          options={[
            ["official", "Official"],
            ["verified", "Verified"],
            ["community_confirmed", "Community confirmed"],
            ["needs_review", "Needs review"],
          ]}
        />
      </div>

      <div className="mt-4">
        <label className="text-sm font-semibold text-yellow-400">Notes</label>

        <textarea
          value={form.notes}
          onChange={(e) => updateField("notes", e.target.value)}
          rows={4}
          className="mt-2 w-full rounded-2xl border border-yellow-500/20 bg-black px-4 py-3 text-sm text-white outline-none focus:border-yellow-400"
          placeholder="Optional notes, for example Ramadan timetable, temporary change, or source details..."
        />
      </div>

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="mt-6 rounded-2xl bg-yellow-500 px-6 py-3 text-sm font-bold text-black hover:bg-yellow-400 disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save prayer times"}
      </button>
    </section>
  );
}

function PrayerRow({
  prayer,
  begins,
  iqamah,
  onBeginsChange,
  onIqamahChange,
}: {
  prayer: string;
  begins: string;
  iqamah: string;
  onBeginsChange: (value: string) => void;
  onIqamahChange: (value: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
      <div className="mb-4 text-lg font-bold text-white">{prayer}</div>

      <div className="grid gap-4 md:grid-cols-2">
        <Input
          label="Begins"
          type="time"
          value={begins}
          onChange={onBeginsChange}
        />

        <Input
          label="Iqamah / Jamaʿah"
          type="time"
          value={iqamah}
          onChange={onIqamahChange}
        />
      </div>
    </div>
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

