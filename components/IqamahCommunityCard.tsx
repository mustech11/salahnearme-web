"use client";

import { useEffect, useState } from "react";

type Confidence = "none" | "low" | "medium" | "strong";
type LiveItem = {
  status: "none" | "started" | "delayed" | "full" | "parking_full";
  total: number;
  confidence: Confidence;
};

export default function IqamahCommunityCard({
  mosqueId,
  prayer = "isha",
}: {
  mosqueId: string;
  prayer?: string;
}) {
  const [s, setS] = useState<LiveItem | null>(null);
  const [msg, setMsg] = useState("");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  async function load() {
    try {
      const res = await fetch(
        `/api/iqamah/live?mosque_ids=${encodeURIComponent(mosqueId)}&prayer=${encodeURIComponent(
          prayer
        )}`,
        { cache: "no-store" }
      );

      const data = await res.json().catch(() => null);
      const item = (data?.map?.[mosqueId] ?? null) as LiveItem | null;

      setS(item);
      setUpdatedAt(new Date());
    } catch {
      setS(null);
      setUpdatedAt(new Date());
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [mosqueId, prayer]);

  async function report(type: "started" | "delayed" | "full" | "parking_full") {
    setMsg("");
    const res = await fetch("/api/iqamah/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mosque_id: mosqueId, prayer, report_type: type }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(data?.error ?? "Could not submit.");
    setMsg("JazakAllahu khayran — noted.");
    load();
  }

  const label =
    s?.status === "started"
      ? "Community suggests iqamah has begun."
      : s?.status === "delayed"
      ? "Community suggests a delay today."
      : s?.status === "full"
      ? "Community suggests the hall is full."
      : s?.status === "parking_full"
      ? "Community suggests parking is full."
      : s?.confidence === "strong"
      ? `Strong signal — ${s?.total ?? 0} reports.`
      : s?.confidence === "medium"
      ? `Medium signal — ${s?.total ?? 0} reports so far.`
      : s?.confidence === "low"
      ? `Low signal — ${s?.total ?? 0} report${(s?.total ?? 0) === 1 ? "" : "s"} so far.`
      : "No recent reports yet.";

  // Pulse only when community suggests started
  const isLiveStarted = s?.status === "started";

  return (
    <div className="rounded-2xl border border-white/10 bg-[rgb(var(--card))] p-5">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Community Signal</div>
        <div className="text-[10px] text-white/60">{prayer.toUpperCase()}</div>
      </div>

      <p className="mt-2 text-sm text-white/70">{label}</p>

      {updatedAt && (
        <div className="mt-2 text-[10px] text-white/40">
          Updated{" "}
          {updatedAt.toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() => report("started")}
          className={[
            "rounded-xl px-3 py-2 text-xs font-semibold text-neutral-950 hover:opacity-90",
            isLiveStarted ? "bg-emerald-400 animate-pulse" : "bg-emerald-400",
          ].join(" ")}
        >
          ✅ Iqamah happened
        </button>

        <button
          onClick={() => report("delayed")}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold hover:bg-white/10"
        >
          ⏳ Delayed
        </button>

        <button
          onClick={() => report("full")}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold hover:bg-white/10"
        >
          👥 Hall full
        </button>

        <button
          onClick={() => report("parking_full")}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold hover:bg-white/10"
        >
          🅿 Parking full
        </button>
      </div>

      {msg && <p className="mt-3 text-xs text-emerald-200">{msg}</p>}

      <p className="mt-3 text-[10px] text-white/50">
        Community feedback only — not an official mosque announcement.
      </p>
    </div>
  );
}

