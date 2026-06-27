"use client";

import { useMemo, useState } from "react";

const hajjDays = [
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
];

export default function HajjExperiencePanel() {
  const [selected, setSelected] = useState("before");
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const current = useMemo(
    () => hajjDays.find((d) => d.key === selected) ?? hajjDays[0],
    [selected]
  );

  const completed = current.items.filter(
    (item) => checked[`${current.key}-${item}`]
  ).length;

  return (
    <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
      <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
        Live Hajj Companion
      </div>

      <h2 className="mt-3 text-3xl font-bold text-white">
        Where are you in Hajj?
      </h2>

      <p className="mt-3 max-w-3xl text-white/70">
        Select your Hajj day and follow the key actions. This does not replace
        your scholar, group leader, or official Hajj instructions.
      </p>

      <div className="mt-6 flex gap-3 overflow-x-auto pb-2">
        {hajjDays.map((day) => (
          <button
            key={day.key}
            type="button"
            onClick={() => setSelected(day.key)}
            className={
              selected === day.key
                ? "whitespace-nowrap rounded-2xl bg-yellow-500 px-4 py-3 text-sm font-semibold text-black"
                : "whitespace-nowrap rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-sm font-semibold text-yellow-400 hover:bg-yellow-500/10"
            }
          >
            {day.label}
          </button>
        ))}
      </div>

      <div className="mt-6 rounded-3xl border border-white/10 bg-black/30 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-yellow-400">
              {current.label}
            </div>
            <h3 className="mt-2 text-3xl font-bold text-white">
              {current.title}
            </h3>
          </div>

          <div className="rounded-full border border-green-500/30 bg-green-500/10 px-4 py-2 text-sm font-semibold text-green-300">
            {completed}/{current.items.length} complete
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {current.items.map((item) => {
            const id = `${current.key}-${item}`;
            const isChecked = !!checked[id];

            return (
              <label
                key={item}
                className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-black/40 p-4"
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() =>
                    setChecked((prev) => ({
                      ...prev,
                      [id]: !prev[id],
                    }))
                  }
                  className="mt-1 h-5 w-5 accent-yellow-500"
                />

                <span
                  className={
                    isChecked
                      ? "text-white/40 line-through"
                      : "text-white/80"
                  }
                >
                  {item}
                </span>
              </label>
            );
          })}
        </div>
      </div>
    </section>
  );
}

