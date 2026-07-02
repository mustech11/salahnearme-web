"use client";

import { useEffect, useMemo, useState } from "react";

import DailyHadithCard from "@/components/DailyHadithCard";
import FridaySmartCard from "@/components/FridaySmartCard";
import IqamahCommunityCard from "@/components/IqamahCommunityCard";

type PrayerKey = "fajr" | "dhuhr" | "asr" | "maghrib" | "isha";

type FridayInfo = {
  id?: string;
  mosque_id?: string;
  jummah_time?: string | null;
  jummah_times?: string[] | null;
  khutbah_time?: string | null;
  imam_name?: string | null;
  topic?: string | null;
  notes?: string | null;
  parking_note?: string | null;
  women_facilities?: boolean | null;
  family_facilities?: boolean | null;
};

type DailyModePanelProps = {
  mosqueId?: string;
  defaultOpen?: boolean;
  title?: string;
  description?: string;
};

function getLondonNow() {
  return new Date(
    new Date().toLocaleString("en-GB", {
      timeZone: "Europe/London",
    })
  );
}

function getCurrentPrayer(): PrayerKey {
  const now = getLondonNow();
  const total = now.getHours() * 60 + now.getMinutes();

  if (total >= 300 && total < 720) {
    return "fajr";
  }

  if (total >= 720 && total < 900) {
    return "dhuhr";
  }

  if (total >= 900 && total < 1080) {
    return "asr";
  }

  if (total >= 1080 && total < 1260) {
    return "maghrib";
  }

  return "isha";
}

function getPrayerLabel(prayer: PrayerKey) {
  const labels: Record<PrayerKey, string> = {
    fajr: "Fajr",
    dhuhr: "Dhuhr",
    asr: "Asr",
    maghrib: "Maghrib",
    isha: "Isha",
  };

  return labels[prayer];
}

function getIsFriday() {
  return getLondonNow().getDay() === 5;
}

function getDailyModeMessage(isFriday: boolean, prayer: PrayerKey) {
  if (isFriday) {
    return "Jumuʿah guidance, daily reminder, and live community signal.";
  }

  return `Daily reminder, ${getPrayerLabel(
    prayer
  )} context, and live community signal.`;
}

export default function DailyModePanel({
  mosqueId,
  defaultOpen = false,
  title = "Daily Mode",
  description,
}: DailyModePanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [fridayInfo, setFridayInfo] = useState<FridayInfo | null>(null);
  const [fridayLoading, setFridayLoading] = useState(false);
  const [fridayError, setFridayError] = useState("");
  const [prayer, setPrayer] = useState<PrayerKey>(() => getCurrentPrayer());
  const [isFriday, setIsFriday] = useState(() => getIsFriday());
  const [refreshKey, setRefreshKey] = useState(0);

  const hasMosque = typeof mosqueId === "string" && mosqueId.trim().length > 0;

  const panelDescription = useMemo(() => {
    return description || getDailyModeMessage(isFriday, prayer);
  }, [description, isFriday, prayer]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function syncDailyState() {
      setPrayer(getCurrentPrayer());
      setIsFriday(getIsFriday());
      setRefreshKey((current) => (current + 1) % 1_000_000);
    }

    syncDailyState();

    const intervalId = window.setInterval(syncDailyState, 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !isFriday || !hasMosque) {
      return;
    }

    const controller = new AbortController();

    async function loadFridayInfo() {
      try {
        setFridayLoading(true);
        setFridayError("");

        const params = new URLSearchParams({
          mosque_id: mosqueId as string,
        });

        const response = await fetch(`/api/friday-info?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });

        const payload = (await response.json().catch(() => null)) as {
          ok?: boolean;
          item?: FridayInfo | null;
          error?: string;
        } | null;

        if (!response.ok) {
          throw new Error(payload?.error || "Could not load Friday info.");
        }

        setFridayInfo(payload?.item ?? null);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        console.error("DailyModePanel Friday info error:", error);

        setFridayInfo(null);
        setFridayError(
          error instanceof Error
            ? error.message
            : "Could not load Friday guidance."
        );
      } finally {
        if (!controller.signal.aborted) {
          setFridayLoading(false);
        }
      }
    }

    void loadFridayInfo();

    return () => {
      controller.abort();
    };
  }, [open, isFriday, hasMosque, mosqueId]);

  return (
    <section className="mt-5 overflow-hidden rounded-3xl border border-yellow-500/20 bg-[#071126]/90 shadow-2xl shadow-black/20">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 p-5 text-left transition hover:bg-yellow-500/5 md:p-6"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-black uppercase tracking-[0.25em] text-yellow-300">
              {title}
            </span>

            <span className="rounded-full border border-yellow-500/25 bg-yellow-500/10 px-3 py-1 text-[11px] font-black uppercase text-yellow-200">
              {getPrayerLabel(prayer)}
            </span>

            {isFriday ? (
              <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-[11px] font-black uppercase text-emerald-200">
                Jumuʿah
              </span>
            ) : null}
          </div>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">
            {panelDescription}
          </p>
        </div>

        <div className="shrink-0 rounded-2xl border border-white/10 bg-black/40 px-4 py-2 text-xs font-black text-white/70">
          {open ? "Hide" : "Show"}
        </div>
      </button>

      {open ? (
        <div className="space-y-4 border-t border-yellow-500/10 px-5 pb-5 pt-5 md:px-6 md:pb-6">
          <DailyHadithCard />

          {isFriday ? (
            <div className="rounded-2xl border border-yellow-500/15 bg-black/20 p-1">
              {fridayLoading ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                  <p className="text-sm font-bold text-white/70">
                    Loading Friday guidance...
                  </p>
                </div>
              ) : (
                <FridaySmartCard {...(fridayInfo ?? {})} />
              )}

              {fridayError ? (
                <p className="px-4 pb-4 text-xs text-red-200">
                  {fridayError}
                </p>
              ) : null}
            </div>
          ) : null}

          {hasMosque ? (
            <IqamahCommunityCard
              key={`${mosqueId}-${prayer}-${refreshKey}`}
              mosqueId={mosqueId as string}
              prayer={prayer}
            />
          ) : (
            <div className="rounded-2xl border border-yellow-500/15 bg-yellow-500/10 p-5">
              <p className="text-sm font-black text-yellow-200">
                Mosque live signal unavailable
              </p>

              <p className="mt-2 text-sm leading-6 text-white/65">
                Add a mosque ID to this panel to show live iqamah and community
                reports.
              </p>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}