"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

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
  jumuah_sittings?: number | string | null;
  khutbah_language?: string | null;
  typical_full_by?: string | null;
};

type DailyModePanelProps = {
  mosqueId?: string;
  defaultOpen?: boolean;
  title?: string;
  description?: string;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const REQUEST_TIMEOUT_MS = 15_000;
const REFRESH_INTERVAL_MS = 60_000;

function getLondonParts() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  return {
    hour: Number(parts.find((part) => part.type === "hour")?.value ?? "0"),
    minute: Number(parts.find((part) => part.type === "minute")?.value ?? "0"),
    weekday: parts.find((part) => part.type === "weekday")?.value ?? "",
  };
}

function getCurrentPrayer(): PrayerKey {
  const { hour, minute } = getLondonParts();
  const total = hour * 60 + minute;

  if (total >= 300 && total < 720) return "fajr";
  if (total >= 720 && total < 900) return "dhuhr";
  if (total >= 900 && total < 1080) return "asr";
  if (total >= 1080 && total < 1260) return "maghrib";
  return "isha";
}

function getPrayerLabel(prayer: PrayerKey): string {
  return {
    fajr: "Fajr",
    dhuhr: "Dhuhr",
    asr: "Asr",
    maghrib: "Maghrib",
    isha: "Isha",
  }[prayer];
}

function getIsFriday(): boolean {
  return getLondonParts().weekday === "Fri";
}

export default function DailyModePanel({
  mosqueId,
  defaultOpen = false,
  title = "Daily Mode",
  description,
}: DailyModePanelProps) {
  const headingId = useId();
  const contentId = useId();
  const abortControllerRef = useRef<AbortController | null>(null);

  const [open, setOpen] = useState(defaultOpen);
  const [fridayInfo, setFridayInfo] = useState<FridayInfo | null>(null);
  const [fridayLoading, setFridayLoading] = useState(false);
  const [fridayError, setFridayError] = useState("");
  const [prayer, setPrayer] = useState<PrayerKey>(() => getCurrentPrayer());
  const [isFriday, setIsFriday] = useState(() => getIsFriday());

  const cleanMosqueId = mosqueId?.trim() ?? "";
  const hasMosque = UUID_REGEX.test(cleanMosqueId);

  const panelDescription = useMemo(
    () =>
      description?.trim() ||
      (isFriday
        ? "Jumuʿah guidance, daily reminder and live community signal."
        : `Daily reminder, ${getPrayerLabel(prayer)} context and live community signal.`),
    [description, isFriday, prayer]
  );

  useEffect(() => {
    if (!open) return;

    const sync = () => {
      setPrayer(getCurrentPrayer());
      setIsFriday(getIsFriday());
    };

    sync();
    const intervalId = window.setInterval(sync, REFRESH_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [open]);

  useEffect(() => {
    if (!open || !isFriday || !hasMosque) {
      setFridayInfo(null);
      setFridayError("");
      return;
    }

    abortControllerRef.current?.abort();

    const controller = new AbortController();
    abortControllerRef.current = controller;
    let timedOut = false;

    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    async function loadFridayInfo() {
      try {
        setFridayLoading(true);
        setFridayError("");

        const params = new URLSearchParams({ mosque_id: cleanMosqueId });
        const response = await fetch(`/api/friday-info?${params.toString()}`, {
          method: "GET",
          headers: { Accept: "application/json" },
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        });

        const payload = (await response.json().catch(() => null)) as
          | { ok?: boolean; item?: FridayInfo | null; error?: string }
          | null;

        if (!response.ok || payload?.ok === false) {
          throw new Error(payload?.error || "Could not load Friday info.");
        }

        setFridayInfo(payload?.item ?? null);
      } catch (error) {
        if (controller.signal.aborted && !timedOut) return;

        setFridayInfo(null);
        setFridayError(
          error instanceof DOMException && error.name === "AbortError"
            ? "Friday guidance took too long to load."
            : error instanceof Error
              ? error.message
              : "Could not load Friday guidance."
        );
      } finally {
        window.clearTimeout(timeoutId);

        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }

        setFridayLoading(false);
      }
    }

    void loadFridayInfo();

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [cleanMosqueId, hasMosque, isFriday, open]);

  return (
    <section
      aria-labelledby={headingId}
      className="mt-5 overflow-hidden rounded-3xl border border-yellow-500/20 bg-[#071126]/90 shadow-2xl shadow-black/20"
    >
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls={contentId}
        className="flex w-full items-center justify-between gap-4 p-5 text-left transition hover:bg-yellow-500/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-yellow-300 md:p-6"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              id={headingId}
              className="text-sm font-black uppercase tracking-[0.25em] text-yellow-300"
            >
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

        <span className="shrink-0 rounded-2xl border border-white/10 bg-black/40 px-4 py-2 text-xs font-black text-white/70">
          {open ? "Hide" : "Show"}
        </span>
      </button>

      {open ? (
        <div
          id={contentId}
          className="space-y-4 border-t border-yellow-500/10 px-5 pb-5 pt-5 md:px-6 md:pb-6"
        >
          <DailyHadithCard />

          {isFriday ? (
            <div className="rounded-2xl border border-yellow-500/15 bg-black/20 p-1">
              {fridayLoading ? (
                <div
                  aria-busy="true"
                  className="animate-pulse rounded-2xl border border-white/10 bg-white/[0.03] p-5"
                >
                  <div className="h-4 w-44 rounded bg-white/10" />
                  <div className="mt-4 h-20 rounded bg-white/10" />
                </div>
              ) : (
                <FridaySmartCard {...(fridayInfo ?? {})} />
              )}

              {fridayError ? (
                <p role="alert" className="px-4 pb-4 text-xs text-red-200">
                  {fridayError}
                </p>
              ) : null}
            </div>
          ) : null}

          {hasMosque ? (
            <IqamahCommunityCard mosqueId={cleanMosqueId} prayer={prayer} />
          ) : (
            <div className="rounded-2xl border border-yellow-500/15 bg-yellow-500/10 p-5">
              <p className="text-sm font-black text-yellow-200">
                Mosque live signal unavailable
              </p>
              <p className="mt-2 text-sm leading-6 text-white/65">
                A valid mosque ID is required to show live iqamah and community
                reports.
              </p>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}