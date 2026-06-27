"use client";

import { useEffect, useState } from "react";

type Hadith = {
  title_en?: string | null;
  arabic_text: string;
  english_text?: string | null;
  grade?: string | null;
  canonical_url?: string | null;
  attribution?: string | null;
};

export default function DailyHadithCard() {
  const [item, setItem] = useState<Hadith | null>(null);
  const [hidden, setHidden] = useState(false);

  const todayKey = "snm_hide_hadith_" + new Date().toISOString().slice(0, 10);

  useEffect(() => {
    setHidden(localStorage.getItem(todayKey) === "1");

    fetch("/api/hadith/today")
      .then((r) => r.json())
      .then((d) => setItem(d?.item ?? null))
      .catch(() => setItem(null));
  }, []);

  if (hidden || !item) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-[rgb(var(--card))] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold">📖 Daily Reminder</div>
          {item.title_en && <div className="mt-1 text-xs text-white/60">{item.title_en}</div>}
        </div>

        <button
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10"
          onClick={() => {
            localStorage.setItem(todayKey, "1");
            setHidden(true);
          }}
        >
          Hide today
        </button>
      </div>

      <p dir="rtl" className="mt-4 text-lg leading-relaxed">
        {item.arabic_text}
      </p>

      {item.english_text && (
        <p className="mt-4 text-sm text-white/70 leading-relaxed">
          {item.english_text}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {item.grade && (
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] text-white/60">
            {item.grade}
          </span>
        )}

        {item.canonical_url && (
          <a
            href={item.canonical_url}
            target="_blank"
            rel="noreferrer"
            className="text-[10px] underline text-white/70 hover:text-white"
          >
            View source
          </a>
        )}
      </div>

      {item.attribution && (
        <p className="mt-3 text-[10px] text-white/50">{item.attribution}</p>
      )}
    </div>
  );
}

