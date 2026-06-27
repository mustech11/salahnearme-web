"use client";

import { useEffect, useMemo, useState } from "react";
import DailyHadithCard from "./DailyHadithCard";
import FridaySmartCard from "./FridaySmartCard";
import IqamahCommunityCard from "./IqamahCommunityCard";

function getCurrentPrayer() {
  const now = new Date(
    new Date().toLocaleString("en-GB", { timeZone: "Europe/London" })
  );

  const total = now.getHours() * 60 + now.getMinutes();

  // simple UK windows (same as list page)
  if (total >= 300 && total < 720) return "fajr";      // 05:00–12:00
  if (total >= 720 && total < 900) return "dhuhr";     // 12:00–15:00
  if (total >= 900 && total < 1080) return "asr";      // 15:00–18:00
  if (total >= 1080 && total < 1260) return "maghrib"; // 18:00–21:00
  return "isha";                                       // 21:00+
}


export default function DailyModePanel({
  mosqueId,
}: {
  mosqueId: string;
}) {
  const [open, setOpen] = useState(false);
  const [fridayInfo, setFridayInfo] = useState<any>(null);

  const isFriday = useMemo(() => new Date().getDay() === 5, []);
const [prayer, setPrayer] = useState<string>(() => getCurrentPrayer());
const [tick, setTick] = useState(0);


 useEffect(() => {
  if (!open || !isFriday) return;

  fetch(`/api/friday-info?mosque_id=${mosqueId}`)
    .then((r) => r.json())
    .then((d) => setFridayInfo(d?.item ?? null))
    .catch(() => setFridayInfo(null));
}, [open, isFriday, mosqueId]);



useEffect(() => {
  if (!open) return;

  // initial sync when opening
  setPrayer(getCurrentPrayer());
  setTick((t) => (t + 1) % 1000000);

  const id = setInterval(() => {
    setPrayer(getCurrentPrayer());
    setTick((t) => (t + 1) % 1000000);
  }, 60000);

  return () => clearInterval(id);
}, [open]);

  return (
    <div className="mt-5 rounded-2xl border border-white/10 bg-[rgb(var(--card))]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 p-5"
      >
        <div>
          <div className="text-sm font-semibold">Daily Mode</div>
          <div className="mt-1 text-xs text-white/60">
            Daily reminder + Friday guidance + live community signal.
          </div>
        </div>
        <div className="text-xs text-white/60">{open ? "Hide" : "Show"}</div>
      </button>

      {open && (
        <div className="space-y-4 px-5 pb-5">
          <DailyHadithCard />
          {isFriday && <FridaySmartCard {...(fridayInfo ?? {})} />}
          <IqamahCommunityCard
  key={`${mosqueId}-${prayer}-${tick}`}
  mosqueId={mosqueId}
  prayer={prayer}
/>

        </div>
      )}
    </div>
  );
}


