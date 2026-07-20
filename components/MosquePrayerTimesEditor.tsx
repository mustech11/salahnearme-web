"use client";

import { useMemo, useState } from "react";

type PrayerKey = "fajr" | "sunrise" | "dhuhr" | "asr" | "maghrib" | "isha";

type PrayerTimeRow = {
  id?: string | null;
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

  created_at?: string | null;
  updated_at?: string | null;
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

type LoadResponse = {
  ok?: boolean;
  error?: string;
  prayer_times?: PrayerTimeRow[];
};

type SaveResponse = {
  ok?: boolean;
  error?: string;
  prayer_time?: PrayerTimeRow;
};

const MAX_NOTES_LENGTH = 800;

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

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

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return !Number.isNaN(date.getTime());
}

function isValidTime(value: string) {
  if (!value) {
    return true;
  }

  if (!/^\d{2}:\d{2}$/.test(value)) {
    return false;
  }

  const [hoursRaw, minutesRaw] = value.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);

  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

function formatTime(value: string) {
  return value || "—";
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
    notes: (initialPrayerTime?.notes ?? "").slice(0, MAX_NOTES_LENGTH),
  };
}

function normaliseSavedForm(current: FormState, saved?: PrayerTimeRow): FormState {
  if (!saved) {
    return current;
  }

  return buildInitialForm(saved);
}

function getCompletionStats(form: FormState) {
  const beginsFields = [
    form.fajr_begins,
    form.sunrise,
    form.dhuhr_begins,
    form.asr_begins,
    form.maghrib_begins,
    form.isha_begins,
  ];

  const iqamahFields = [
    form.fajr_iqamah,
    form.dhuhr_iqamah,
    form.asr_iqamah,
    form.maghrib_iqamah,
    form.isha_iqamah,
  ];

  const beginsCount = beginsFields.filter(Boolean).length;
  const iqamahCount = iqamahFields.filter(Boolean).length;

  return {
    beginsCount,
    iqamahCount,
    totalBegins: beginsFields.length,
    totalIqamah: iqamahFields.length,
    complete: beginsCount === beginsFields.length,
  };
}

function validateForm(form: FormState) {
  if (!isValidDate(form.prayer_date)) {
    return "Timetable date must be a valid date.";
  }

  const timeFields: Array<[string, string]> = [
    ["Fajr begins", form.fajr_begins],
    ["Fajr iqamah", form.fajr_iqamah],
    ["Sunrise", form.sunrise],
    ["Dhuhr begins", form.dhuhr_begins],
    ["Dhuhr iqamah", form.dhuhr_iqamah],
    ["Asr begins", form.asr_begins],
    ["Asr iqamah", form.asr_iqamah],
    ["Maghrib begins", form.maghrib_begins],
    ["Maghrib iqamah", form.maghrib_iqamah],
    ["Isha begins", form.isha_begins],
    ["Isha iqamah", form.isha_iqamah],
  ];

  for (const [label, value] of timeFields) {
    if (!isValidTime(value)) {
      return `${label} must be a valid 24-hour time.`;
    }
  }

  const hasAnyTime = timeFields.some(([, value]) => value);

  if (!hasAnyTime) {
    return "Add at least one prayer time before saving.";
  }

  return null;
}

function sourceLabel(value: string) {
  const labels: Record<string, string> = {
    manual: "Manual entry",
    mosque_admin: "Mosque admin",
    imported: "Imported timetable",
    ai_import: "AI timetable import",
    community: "Community report",
  };

  return labels[value] ?? value;
}

function confidenceLabel(value: string) {
  const labels: Record<string, string> = {
    official: "Official",
    verified: "Verified",
    community_confirmed: "Community confirmed",
    needs_review: "Needs review",
  };

  return labels[value] ?? value;
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

  const stats = getCompletionStats(form);

  function updateField(field: keyof FormState, value: string) {
    setMessage("");
    setErrorMessage("");

    setForm((current) => ({
      ...current,
      [field]: field === "notes" ? value.slice(0, MAX_NOTES_LENGTH) : value,
    }));
  }

  async function loadDate(date: string) {
    if (!isValidDate(date)) {
      setMessage("");
      setErrorMessage("Choose a valid date first.");
      return;
    }

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

      const data = (await res.json().catch(() => ({}))) as LoadResponse;

      if (!res.ok || !data.ok) {
        setErrorMessage(data.error ?? "Could not load prayer times.");
        return;
      }

      const row = data.prayer_times?.[0] ?? null;

      setForm({
        ...buildInitialForm(row),
        prayer_date: date,
      });

      if (row) {
        setMessage("Timetable loaded for the selected date.");
      } else {
        setMessage("No timetable found for this date. You can create one now.");
      }
    } catch {
      setErrorMessage("Could not load prayer times.");
    } finally {
      setLoadingDate(false);
    }
  }

  async function save() {
    const validationError = validateForm(form);

    if (validationError) {
      setMessage("");
      setErrorMessage(validationError);
      return;
    }

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
          prayer_date: form.prayer_date,

          fajr_begins: form.fajr_begins || null,
          fajr_iqamah: form.fajr_iqamah || null,

          sunrise: form.sunrise || null,

          dhuhr_begins: form.dhuhr_begins || null,
          dhuhr_iqamah: form.dhuhr_iqamah || null,

          asr_begins: form.asr_begins || null,
          asr_iqamah: form.asr_iqamah || null,

          maghrib_begins: form.maghrib_begins || null,
          maghrib_iqamah: form.maghrib_iqamah || null,

          isha_begins: form.isha_begins || null,
          isha_iqamah: form.isha_iqamah || null,

          source: form.source,
          confidence: form.confidence,
          notes: form.notes.trim() ? form.notes.trim() : null,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as SaveResponse;

      if (!res.ok || !data.ok) {
        setErrorMessage(data.error ?? "Could not save prayer times.");
        return;
      }

      setForm((current) => normaliseSavedForm(current, data.prayer_time));
      setMessage("Mosque prayer times saved successfully.");
    } catch {
      setErrorMessage("Could not save prayer times.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
            Mosque Timetable
          </div>

          <h1 className="mt-3 text-3xl font-black text-white">
            Prayer times for {mosqueName}
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/60">
            Add or update mosque-specific begins and iqamah times. These are
            shown publicly on the mosque profile and help users know where to
            pray on time.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <StatusCard label="Begins" value={`${stats.beginsCount}/${stats.totalBegins}`} />
          <StatusCard label="Iqamah" value={`${stats.iqamahCount}/${stats.totalIqamah}`} />
          <StatusCard label="Ready" value={stats.complete ? "Yes" : "No"} />
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

      <div className="mt-6 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
        <Input
          label="Timetable date"
          type="date"
          value={form.prayer_date}
          onChange={(value) => updateField("prayer_date", value)}
          required
        />

        <button
          type="button"
          onClick={() => loadDate(form.prayer_date)}
          disabled={loadingDate || saving}
          className="rounded-2xl border border-yellow-500/30 bg-black px-6 py-3 text-sm font-bold text-yellow-400 transition hover:bg-yellow-500/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loadingDate ? "Loading..." : "Load date"}
        </button>
      </div>

      <div className="mt-8 grid gap-5">
        <PrayerRow
          prayer="Fajr"
          prayerKey="fajr"
          begins={form.fajr_begins}
          iqamah={form.fajr_iqamah}
          onBeginsChange={(value) => updateField("fajr_begins", value)}
          onIqamahChange={(value) => updateField("fajr_iqamah", value)}
        />

        <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-lg font-bold text-white">Sunrise</div>
              <div className="mt-1 text-xs text-white/40">
                Used for display only, not an iqamah prayer.
              </div>
            </div>

            <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-300">
              {formatTime(form.sunrise)}
            </span>
          </div>

          <Input
            label="Sunrise"
            type="time"
            value={form.sunrise}
            onChange={(value) => updateField("sunrise", value)}
          />
        </div>

        <PrayerRow
          prayer="Dhuhr"
          prayerKey="dhuhr"
          begins={form.dhuhr_begins}
          iqamah={form.dhuhr_iqamah}
          onBeginsChange={(value) => updateField("dhuhr_begins", value)}
          onIqamahChange={(value) => updateField("dhuhr_iqamah", value)}
        />

        <PrayerRow
          prayer="Asr"
          prayerKey="asr"
          begins={form.asr_begins}
          iqamah={form.asr_iqamah}
          onBeginsChange={(value) => updateField("asr_begins", value)}
          onIqamahChange={(value) => updateField("asr_iqamah", value)}
        />

        <PrayerRow
          prayer="Maghrib"
          prayerKey="maghrib"
          begins={form.maghrib_begins}
          iqamah={form.maghrib_iqamah}
          onBeginsChange={(value) => updateField("maghrib_begins", value)}
          onIqamahChange={(value) => updateField("maghrib_iqamah", value)}
        />

        <PrayerRow
          prayer="Isha"
          prayerKey="isha"
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

      <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4 text-xs leading-6 text-white/50">
        <div>
          Source:{" "}
          <span className="font-semibold text-yellow-300">
            {sourceLabel(form.source)}
          </span>
        </div>
        <div>
          Confidence:{" "}
          <span className="font-semibold text-yellow-300">
            {confidenceLabel(form.confidence)}
          </span>
        </div>
      </div>

      <div className="mt-4">
        <label className="text-sm font-semibold text-yellow-400">Notes</label>

        <textarea
          value={form.notes}
          onChange={(event) => updateField("notes", event.target.value)}
          rows={4}
          maxLength={MAX_NOTES_LENGTH}
          className="mt-2 w-full rounded-2xl border border-yellow-500/20 bg-black px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-yellow-400"
          placeholder="Optional notes, for example Ramadan timetable, temporary change, source details, or verification notes..."
        />

        <div className="mt-1 text-right text-xs text-white/40">
          {form.notes.length}/{MAX_NOTES_LENGTH}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving || loadingDate}
          className="rounded-2xl bg-yellow-500 px-6 py-3 text-sm font-bold text-black transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save prayer times"}
        </button>

        <button
          type="button"
          onClick={() => loadDate(todayIsoDate())}
          disabled={saving || loadingDate}
          className="rounded-2xl border border-yellow-500/30 bg-black px-6 py-3 text-sm font-bold text-yellow-400 transition hover:bg-yellow-500/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Load today
        </button>
      </div>
    </section>
  );
}

function PrayerRow({
  prayer,
  prayerKey,
  begins,
  iqamah,
  onBeginsChange,
  onIqamahChange,
}: {
  prayer: string;
  prayerKey: PrayerKey;
  begins: string;
  iqamah: string;
  onBeginsChange: (value: string) => void;
  onIqamahChange: (value: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-lg font-bold text-white">{prayer}</div>
          <div className="mt-1 text-xs text-white/40">
            {prayerKey === "maghrib"
              ? "For many mosques Maghrib iqamah is soon after begins."
              : "Beginning time and mosque iqamah / jamāʿah time."}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-300">
            Begins {formatTime(begins)}
          </span>

          <span className="rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-semibold text-green-300">
            Iqamah {formatTime(iqamah)}
          </span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Input
          label="Begins"
          type="time"
          value={begins}
          onChange={onBeginsChange}
        />

        <Input
          label="Iqamah / Jamāʿah"
          type="time"
          value={iqamah}
          onChange={onIqamahChange}
        />
      </div>
    </div>
  );
}

function StatusCard({ label, value }: { label: string; value: string }) {
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
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
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
        required={required}
        onChange={(event) => onChange(event.target.value)}
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