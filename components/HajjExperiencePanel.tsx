"use client";

import {
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";

const STORAGE_KEY = "snm_hajj_experience_progress_v1";

const HAJJ_DAYS = [
  {
    key: "before",
    label: "Before 8 Dhul Hijjah",
    title: "Prepare for Hajj",
    items: [
      "Make sincere intention for Hajj",
      "Repent and clear rights owed to people",
      "Enter Ihram from the Miqat",
      "Begin saying the Talbiyah",
    ],
  },
  {
    key: "8",
    label: "8 Dhul Hijjah",
    title: "Mina",
    items: [
      "Travel to Mina",
      "Pray shortened prayers there",
      "Stay overnight in Mina",
      "Prepare for Arafah",
    ],
  },
  {
    key: "9",
    label: "9 Dhul Hijjah",
    title: "Arafah",
    items: [
      "Stand at Arafah after Dhuhr",
      "Make abundant du‘a and dhikr",
      "Stay until sunset",
      "Leave calmly for Muzdalifah",
    ],
  },
  {
    key: "10",
    label: "10 Dhul Hijjah",
    title: "Yawm an-Nahr",
    items: [
      "Stone Jamarat al-‘Aqabah",
      "Offer sacrifice if required",
      "Shave or trim hair",
      "Perform Tawaf al-Ifadah",
    ],
  },
  {
    key: "11-13",
    label: "11–13 Dhul Hijjah",
    title: "Days of Tashreeq",
    items: [
      "Stay in Mina",
      "Stone the three Jamarat after zawal",
      "Continue dhikr and takbeer",
      "Leave after 12th or stay until 13th",
    ],
  },
  {
    key: "farewell",
    label: "Before leaving Makkah",
    title: "Farewell Tawaf",
    items: [
      "Perform Tawaf al-Wada‘",
      "Make final du‘a",
      "Leave Makkah with humility",
      "Ask Allah to accept your Hajj",
    ],
  },
] as const;

export default function HajjExperiencePanel() {
  const headingId = useId();

  const [selected, setSelected] = useState("before");
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);

      if (saved) {
        const parsed = JSON.parse(saved) as {
          selected?: string;
          checked?: Record<string, boolean>;
        };

        if (HAJJ_DAYS.some((day) => day.key === parsed.selected)) {
          setSelected(parsed.selected ?? "before");
        }

        if (parsed.checked && typeof parsed.checked === "object") {
          setChecked(parsed.checked);
        }
      }
    } catch {
      // Saved progress is optional.
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ selected, checked })
      );
    } catch {
      // Storage is optional.
    }
  }, [checked, hydrated, selected]);

  const current = useMemo(
    () => HAJJ_DAYS.find((day) => day.key === selected) ?? HAJJ_DAYS[0],
    [selected]
  );

  const completed = current.items.filter(
    (item) => checked[`${current.key}-${item}`]
  ).length;

  const overall = useMemo(() => {
    const total = HAJJ_DAYS.reduce((sum, day) => sum + day.items.length, 0);
    const done = HAJJ_DAYS.reduce(
      (sum, day) =>
        sum +
        day.items.filter((item) => checked[`${day.key}-${item}`]).length,
      0
    );

    return {
      done,
      total,
      percentage: total ? Math.round((done / total) * 100) : 0,
    };
  }, [checked]);

  function resetProgress() {
    if (!window.confirm("Reset all Hajj companion progress?")) return;

    setChecked({});
    setSelected("before");

    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage is optional.
    }
  }

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6 md:p-8"
    >
      <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
        Live Hajj Companion
      </div>

      <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 id={headingId} className="text-3xl font-black text-white">
            Where are you in Hajj?
          </h2>

          <p className="mt-3 max-w-3xl text-sm leading-7 text-white/70">
            Select your Hajj day and follow the key actions. This guide does not
            replace your scholar, group leader or official Hajj instructions.
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
          <div className="text-xs uppercase tracking-[0.16em] text-emerald-300/70">
            Overall progress
          </div>
          <div className="mt-1 text-xl font-black text-emerald-300">
            {overall.percentage}%
          </div>
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Hajj journey days"
        className="mt-6 flex gap-3 overflow-x-auto pb-2"
      >
        {HAJJ_DAYS.map((day) => (
          <button
            key={day.key}
            type="button"
            role="tab"
            aria-selected={selected === day.key}
            onClick={() => setSelected(day.key)}
            className={
              selected === day.key
                ? "whitespace-nowrap rounded-2xl bg-yellow-500 px-4 py-3 text-sm font-black text-black"
                : "whitespace-nowrap rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-sm font-black text-yellow-400 hover:bg-yellow-500/10"
            }
          >
            {day.label}
          </button>
        ))}
      </div>

      <div className="mt-6 rounded-3xl border border-white/10 bg-black/30 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-sm font-black text-yellow-400">
              {current.label}
            </div>
            <h3 className="mt-2 text-3xl font-black text-white">
              {current.title}
            </h3>
          </div>

          <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-black text-emerald-300">
            {completed}/{current.items.length} complete
          </div>
        </div>

        <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-yellow-500 transition-[width]"
            style={{
              width: `${Math.round((completed / current.items.length) * 100)}%`,
            }}
          />
        </div>

        <div className="mt-6 space-y-3">
          {current.items.map((item) => {
            const id = `${current.key}-${item}`;
            const isChecked = Boolean(checked[id]);

            return (
              <label
                key={item}
                className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-black/40 p-4 transition hover:border-yellow-500/25"
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() =>
                    setChecked((previous) => ({
                      ...previous,
                      [id]: !previous[id],
                    }))
                  }
                  className="mt-1 size-5 accent-yellow-500"
                />

                <span
                  className={
                    isChecked ? "text-white/40 line-through" : "text-white/80"
                  }
                >
                  {item}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-white/40">
          Progress is saved on this device.
        </p>

        <button
          type="button"
          onClick={resetProgress}
          className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-xs font-bold text-red-200 transition hover:bg-red-500/20"
        >
          Reset progress
        </button>
      </div>
    </section>
  );
}