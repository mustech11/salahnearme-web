"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

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

type ApiResponse = {
  ok?: boolean;
  error?: string;
};

type DayDefinition = {
  key: DayKey;
  label: string;
};

const DAYS: DayDefinition[] = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
];

const REQUEST_TIMEOUT_MS = 20_000;
const MAX_NOTE_LENGTH = 500;

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

function normaliseTime(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value.trim());

  if (!match) {
    return fallback;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return fallback;
  }

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function normaliseInitialHours(initialHours?: Partial<OpeningHours> | null): OpeningHours {
  const defaults = defaultHours();
  const next = { ...defaults };

  for (const { key } of DAYS) {
    const source = initialHours?.[key];

    if (!source) {
      continue;
    }

    next[key] = {
      open: normaliseTime(source.open, defaults[key].open),
      close: normaliseTime(source.close, defaults[key].close),
      closed: Boolean(source.closed),
    };
  }

  return next;
}

function validateHours(hours: OpeningHours): Partial<Record<DayKey, string>> {
  const errors: Partial<Record<DayKey, string>> = {};

  for (const { key, label } of DAYS) {
    const day = hours[key];

    if (day.closed) {
      continue;
    }

    if (!day.open || !day.close) {
      errors[key] = `${label} requires both opening and closing times.`;
      continue;
    }

    if (day.open === day.close) {
      errors[key] = `${label} opening and closing times cannot be identical.`;
    }
  }

  return errors;
}

async function readJsonSafely(res: Response): Promise<ApiResponse> {
  const contentType = res.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    const text = await res.text().catch(() => "");
    return {
      ok: false,
      error: `Unexpected server response (${res.status}). ${text.slice(0, 140).trim()}`.trim(),
    };
  }

  try {
    return (await res.json()) as ApiResponse;
  } catch {
    return { ok: false, error: "The server returned invalid JSON." };
  }
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
  const router = useRouter();
  const initialHoursRef = useRef<OpeningHours>(normaliseInitialHours(initialHours));
  const initialNoteRef = useRef(initialNote?.trim() ?? "");

  const [hours, setHours] = useState<OpeningHours>(initialHoursRef.current);
  const [note, setNote] = useState(initialNoteRef.current);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [dayErrors, setDayErrors] = useState<Partial<Record<DayKey, string>>>({});

  const isDirty = useMemo(
    () =>
      JSON.stringify(hours) !== JSON.stringify(initialHoursRef.current) ||
      note !== initialNoteRef.current,
    [hours, note]
  );

  function clearMessages() {
    setMessage("");
    setErrorMessage("");
  }

  function updateDay(day: DayKey, patch: Partial<DayHours>) {
    setHours((current) => ({
      ...current,
      [day]: {
        ...current[day],
        ...patch,
      },
    }));

    setDayErrors((current) => ({ ...current, [day]: undefined }));
    clearMessages();
  }

  function copyMondayToWeekdays() {
    const monday = hours.monday;

    setHours((current) => ({
      ...current,
      tuesday: { ...monday },
      wednesday: { ...monday },
      thursday: { ...monday },
      friday: { ...monday },
    }));

    setDayErrors({});
    clearMessages();
  }

  function resetHours() {
    setHours(initialHoursRef.current);
    setNote(initialNoteRef.current);
    setDayErrors({});
    clearMessages();
  }

  async function save() {
    if (saving || !businessId) {
      return;
    }

    const validationErrors = validateHours(hours);

    if (Object.keys(validationErrors).length > 0) {
      setDayErrors(validationErrors);
      setErrorMessage("Please correct the highlighted opening hours.");
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      setSaving(true);
      clearMessages();
      setDayErrors({});

      const payload = {
        business_id: businessId,
        opening_hours: hours,
        opening_hours_note: note.trim(),
      };

      const res = await fetch("/api/business-dashboard/opening-hours", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
        body: JSON.stringify(payload),
      });

      const data = await readJsonSafely(res);

      if (!res.ok || !data.ok) {
        setErrorMessage(data.error ?? "Could not save opening hours.");
        return;
      }

      initialHoursRef.current = hours;
      initialNoteRef.current = note.trim();
      setNote(note.trim());
      setMessage("Opening hours saved successfully.");
      router.refresh();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setErrorMessage("The request timed out. Please try again.");
      } else {
        console.error("BusinessOpeningHoursEditor save error:", error);
        setErrorMessage("Could not save opening hours. Please try again.");
      }
    } finally {
      window.clearTimeout(timeoutId);
      setSaving(false);
    }
  }

  return (
    <section
      aria-labelledby="business-hours-editor-heading"
      className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6 md:p-8"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
            Opening hours
          </div>

          <h2 id="business-hours-editor-heading" className="mt-3 text-3xl font-black text-white">
            Manage weekly opening times
          </h2>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/60">
            Set accurate hours for each day. Mark a day closed instead of leaving
            its times blank.
          </p>
        </div>

        <span
          className={`w-fit rounded-full border px-3 py-1 text-xs font-bold ${
            isDirty
              ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-300"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          }`}
        >
          {isDirty ? "Unsaved changes" : "Saved"}
        </span>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={copyMondayToWeekdays}
          disabled={saving}
          className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-sm font-bold text-yellow-300 transition hover:bg-yellow-500/20 disabled:opacity-50"
        >
          Copy Monday to weekdays
        </button>

        <button
          type="button"
          onClick={() => setHours(defaultHours())}
          disabled={saving}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white/70 transition hover:bg-white/10 disabled:opacity-50"
        >
          Use 09:00–22:00 template
        </button>
      </div>

      <div aria-live="polite">
        {message ? (
          <div className="mt-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
            {message}
          </div>
        ) : null}

        {errorMessage ? (
          <div role="alert" className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {errorMessage}
          </div>
        ) : null}
      </div>

      <div className="mt-6 grid gap-4">
        {DAYS.map(({ key, label }) => {
          const value = hours[key];
          const error = dayErrors[key];

          return (
            <div
              key={key}
              className={`grid gap-3 rounded-2xl border bg-black/30 p-4 md:grid-cols-[1fr_1fr_1fr_auto] md:items-center ${
                error ? "border-red-500/40" : "border-white/10"
              }`}
            >
              <div>
                <div className="font-semibold text-white">{label}</div>
                {error ? <div className="mt-1 text-xs text-red-300">{error}</div> : null}
              </div>

              <label className="text-xs uppercase tracking-[0.14em] text-white/45">
                Opens
                <input
                  type="time"
                  value={value.open}
                  disabled={value.closed || saving}
                  onChange={(event) => updateDay(key, { open: event.target.value })}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-yellow-400 disabled:opacity-40"
                />
              </label>

              <label className="text-xs uppercase tracking-[0.14em] text-white/45">
                Closes
                <input
                  type="time"
                  value={value.close}
                  disabled={value.closed || saving}
                  onChange={(event) => updateDay(key, { close: event.target.value })}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-yellow-400 disabled:opacity-40"
                />
              </label>

              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70">
                <input
                  type="checkbox"
                  checked={value.closed}
                  disabled={saving}
                  onChange={(event) => updateDay(key, { closed: event.target.checked })}
                />
                Closed
              </label>
            </div>
          );
        })}
      </div>

      <div className="mt-6">
        <label htmlFor="opening-hours-note" className="text-sm font-semibold text-yellow-400">
          Public note
        </label>

        <textarea
          id="opening-hours-note"
          value={note}
          onChange={(event) => {
            setNote(event.target.value);
            clearMessages();
          }}
          rows={3}
          maxLength={MAX_NOTE_LENGTH}
          placeholder="Optional: Ramadan, bank holiday or seasonal hours may differ."
          className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none placeholder:text-white/30 focus:border-yellow-400"
        />

        <div className="mt-2 text-right text-xs text-white/40">
          {note.length}/{MAX_NOTE_LENGTH}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || !isDirty}
          className="rounded-2xl bg-yellow-500 px-6 py-3 text-sm font-semibold text-black transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save opening hours"}
        </button>

        <button
          type="button"
          onClick={resetHours}
          disabled={saving || !isDirty}
          className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white/70 transition hover:bg-white/10 disabled:opacity-40"
        >
          Reset changes
        </button>
      </div>
    </section>
  );
}