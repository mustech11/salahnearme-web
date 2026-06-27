"use client";

import { useState } from "react";

type Props = {
  mosque: {
    id: string;
    name: string | null;
    area: string | null;
    city: string | null;
    postcode: string | null;
    address: string | null;
    maps_url: string | null;
    jumuah_enabled: boolean | null;
    jumuah_khutbah_1: string | null;
    jumuah_salah_1: string | null;
    jumuah_khutbah_2: string | null;
    jumuah_salah_2: string | null;
    jumuah_khutbah_3: string | null;
    jumuah_salah_3: string | null;
    jumuah_notes: string | null;
  };
  prayerTimes: {
    fajr_start: string | null;
    sunrise: string | null;
    dhuhr_start: string | null;
    asr_start: string | null;
    maghrib_start: string | null;
    isha_start: string | null;
  } | null;
};

export default function MosqueManagementEditor({ mosque, prayerTimes }: Props) {
  const [form, setForm] = useState({
    name: mosque.name ?? "",
    area: mosque.area ?? "",
    city: mosque.city ?? "",
    postcode: mosque.postcode ?? "",
    address: mosque.address ?? "",
    maps_url: mosque.maps_url ?? "",
    jumuah_enabled: Boolean(mosque.jumuah_enabled),
    jumuah_khutbah_1: mosque.jumuah_khutbah_1 ?? "",
    jumuah_salah_1: mosque.jumuah_salah_1 ?? "",
    jumuah_khutbah_2: mosque.jumuah_khutbah_2 ?? "",
    jumuah_salah_2: mosque.jumuah_salah_2 ?? "",
    jumuah_khutbah_3: mosque.jumuah_khutbah_3 ?? "",
    jumuah_salah_3: mosque.jumuah_salah_3 ?? "",
    jumuah_notes: mosque.jumuah_notes ?? "",
    fajr_start: prayerTimes?.fajr_start ?? "",
    sunrise: prayerTimes?.sunrise ?? "",
    dhuhr_start: prayerTimes?.dhuhr_start ?? "",
    asr_start: prayerTimes?.asr_start ?? "",
    maghrib_start: prayerTimes?.maghrib_start ?? "",
    isha_start: prayerTimes?.isha_start ?? "",
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function save() {
    try {
      setLoading(true);
      setMessage("");
      setErrorMessage("");

      const res = await fetch("/api/dashboard/mosque/save-settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mosque_id: mosque.id,
          payload: form,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErrorMessage(data.error ?? "Could not save mosque settings.");
        return;
      }

      setMessage("Mosque settings saved successfully.");
    } catch {
      setErrorMessage("Something went wrong while saving.");
    } finally {
      setLoading(false);
    }
  }

  function updateField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
        <div className="text-xl font-semibold text-yellow-400">
          Mosque profile
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Field label="Mosque name">
            <input
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              className="w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none focus:border-yellow-400"
            />
          </Field>

          <Field label="Area">
            <input
              value={form.area}
              onChange={(e) => updateField("area", e.target.value)}
              className="w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none focus:border-yellow-400"
            />
          </Field>

          <Field label="City">
            <input
              value={form.city}
              onChange={(e) => updateField("city", e.target.value)}
              className="w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none focus:border-yellow-400"
            />
          </Field>

          <Field label="Postcode">
            <input
              value={form.postcode}
              onChange={(e) => updateField("postcode", e.target.value)}
              className="w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none focus:border-yellow-400"
            />
          </Field>

          <Field label="Address" full>
            <input
              value={form.address}
              onChange={(e) => updateField("address", e.target.value)}
              className="w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none focus:border-yellow-400"
            />
          </Field>

          <Field label="Maps URL" full>
            <input
              value={form.maps_url}
              onChange={(e) => updateField("maps_url", e.target.value)}
              className="w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none focus:border-yellow-400"
            />
          </Field>
        </div>
      </section>

      <section className="rounded-3xl border border-green-500/20 bg-[rgb(var(--card))] p-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xl font-semibold text-green-300">
              Jumu’ah management
            </div>
            <p className="mt-2 text-white/70">
              Configure first, second, and third Jumu’ah sessions so Friday mode
              becomes much more accurate.
            </p>
          </div>

          <label className="flex items-center gap-3 text-sm text-white/80">
            <input
              type="checkbox"
              checked={form.jumuah_enabled}
              onChange={(e) => updateField("jumuah_enabled", e.target.checked)}
            />
            Enable Jumu’ah times
          </label>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <TimeField
            label="1st Khutbah"
            value={form.jumuah_khutbah_1}
            onChange={(v) => updateField("jumuah_khutbah_1", v)}
          />
          <TimeField
            label="1st Salah"
            value={form.jumuah_salah_1}
            onChange={(v) => updateField("jumuah_salah_1", v)}
          />

          <TimeField
            label="2nd Khutbah"
            value={form.jumuah_khutbah_2}
            onChange={(v) => updateField("jumuah_khutbah_2", v)}
          />
          <TimeField
            label="2nd Salah"
            value={form.jumuah_salah_2}
            onChange={(v) => updateField("jumuah_salah_2", v)}
          />

          <TimeField
            label="3rd Khutbah"
            value={form.jumuah_khutbah_3}
            onChange={(v) => updateField("jumuah_khutbah_3", v)}
          />
          <TimeField
            label="3rd Salah"
            value={form.jumuah_salah_3}
            onChange={(v) => updateField("jumuah_salah_3", v)}
          />
        </div>

        <div className="mt-4">
          <Field label="Jumu’ah notes" full>
            <textarea
              value={form.jumuah_notes}
              onChange={(e) => updateField("jumuah_notes", e.target.value)}
              rows={4}
              className="w-full rounded-2xl border border-green-500/30 bg-black px-4 py-3 text-white outline-none focus:border-green-400"
            />
          </Field>
        </div>
      </section>

      <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
        <div className="text-xl font-semibold text-yellow-400">
          City prayer times
        </div>
        <p className="mt-2 text-white/70">
          These are city-level prayer times used for prayer-aware travel logic.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TimeField label="Fajr" value={form.fajr_start} onChange={(v) => updateField("fajr_start", v)} />
          <TimeField label="Sunrise" value={form.sunrise} onChange={(v) => updateField("sunrise", v)} />
          <TimeField label="Dhuhr" value={form.dhuhr_start} onChange={(v) => updateField("dhuhr_start", v)} />
          <TimeField label="Asr" value={form.asr_start} onChange={(v) => updateField("asr_start", v)} />
          <TimeField label="Maghrib" value={form.maghrib_start} onChange={(v) => updateField("maghrib_start", v)} />
          <TimeField label="Isha" value={form.isha_start} onChange={(v) => updateField("isha_start", v)} />
        </div>
      </section>

      {errorMessage && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {errorMessage}
        </div>
      )}

      {message && (
        <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-200">
          {message}
        </div>
      )}

      <div>
        <button
          type="button"
          onClick={save}
          disabled={loading}
          className="rounded-xl bg-yellow-500 px-5 py-3 text-sm font-semibold text-black hover:bg-yellow-400 disabled:opacity-50"
        >
          {loading ? "Saving..." : "Save mosque settings"}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  full = false,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <label className="mb-2 block text-sm font-medium text-white/80">
        {label}
      </label>
      {children}
    </div>
  );
}

function TimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white outline-none focus:border-yellow-400"
      />
    </Field>
  );
}

