"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

type Hadith = {
  title_en?: string | null;
  arabic_text: string;
  english_text?: string | null;
  grade?: string | null;
  canonical_url?: string | null;
  attribution?: string | null;
};

type HadithResponse = {
  ok?: boolean;
  item?: Hadith | null;
  error?: string;
};

type LoadState =
  | "loading"
  | "success"
  | "error";

const REQUEST_TIMEOUT_MS = 15_000;

function cleanText(
  value: unknown,
  maxLength = 5_000
): string {
  return typeof value === "string"
    ? value.trim().slice(0, maxLength)
    : "";
}

function getTodayKey(): string {
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  return `snm_hide_hadith_${date}`;
}

function getSafeUrl(
  value: string | null | undefined
): string | null {
  const raw = cleanText(value, 1_000);

  if (!raw) {
    return null;
  }

  try {
    const url = new URL(raw);

    return (
      url.protocol === "http:" ||
      url.protocol === "https:"
    )
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export default function DailyHadithCard() {
  const headingId = useId();
  const feedbackId = useId();
  const abortControllerRef =
    useRef<AbortController | null>(null);

  const [item, setItem] =
    useState<Hadith | null>(null);

  const [hidden, setHidden] =
    useState(true);

  const [loadState, setLoadState] =
    useState<LoadState>("loading");

  const [errorMessage, setErrorMessage] =
    useState("");

  const todayKey = useMemo(
    () => getTodayKey(),
    []
  );

  useEffect(() => {
    try {
      setHidden(
        localStorage.getItem(todayKey) === "1"
      );
    } catch {
      setHidden(false);
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let timedOut = false;

    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    async function loadHadith() {
      try {
        const response = await fetch(
          "/api/hadith/today",
          {
            headers: {
              Accept: "application/json",
            },
            credentials: "same-origin",
            cache: "no-store",
            signal: controller.signal,
          }
        );

        const data = (await response
          .json()
          .catch(() => ({}))) as HadithResponse;

        if (
          !response.ok ||
          data.ok === false ||
          !data.item
        ) {
          setLoadState("error");
          setErrorMessage(
            cleanText(data.error, 300) ||
              "Today's reminder could not be loaded."
          );
          return;
        }

        const arabicText = cleanText(
          data.item.arabic_text,
          10_000
        );

        if (!arabicText) {
          setLoadState("error");
          setErrorMessage(
            "Today's reminder is unavailable."
          );
          return;
        }

        setItem({
          ...data.item,
          arabic_text: arabicText,
          title_en:
            cleanText(data.item.title_en, 300) ||
            null,
          english_text:
            cleanText(
              data.item.english_text,
              10_000
            ) || null,
          grade:
            cleanText(data.item.grade, 120) ||
            null,
          attribution:
            cleanText(
              data.item.attribution,
              500
            ) || null,
        });

        setLoadState("success");
      } catch (error) {
        setLoadState("error");

        setErrorMessage(
          error instanceof DOMException &&
            error.name === "AbortError"
            ? timedOut
              ? "Today's reminder took too long to load."
              : "Today's reminder request was cancelled."
            : "Today's reminder could not be loaded."
        );
      } finally {
        window.clearTimeout(timeoutId);

        if (
          abortControllerRef.current === controller
        ) {
          abortControllerRef.current = null;
        }
      }
    }

    void loadHadith();

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [todayKey]);

  function hideToday() {
    try {
      localStorage.setItem(todayKey, "1");
    } catch {
      // Storage is optional.
    }

    setHidden(true);
  }

  if (hidden) {
    return null;
  }

  if (
    loadState === "loading" &&
    !item
  ) {
    return (
      <div
        aria-busy="true"
        className="animate-pulse rounded-2xl border border-white/10 bg-[rgb(var(--card))] p-5"
      >
        <div className="h-4 w-40 rounded bg-white/10" />
        <div className="mt-5 h-20 rounded bg-white/10" />
        <div className="mt-4 h-14 rounded bg-white/10" />
      </div>
    );
  }

  if (
    loadState === "error" ||
    !item
  ) {
    return (
      <div
        id={feedbackId}
        role="status"
        className="rounded-2xl border border-white/10 bg-[rgb(var(--card))] p-5 text-sm text-white/55"
      >
        {errorMessage}
      </div>
    );
  }

  const sourceUrl = getSafeUrl(
    item.canonical_url
  );

  return (
    <article
      aria-labelledby={headingId}
      className="rounded-2xl border border-white/10 bg-[rgb(var(--card))] p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.18em] text-yellow-400">
            Daily reminder
          </div>

          <h2
            id={headingId}
            className="mt-1 text-sm font-black text-white"
          >
            📖 Hadith of the day
          </h2>

          {item.title_en ? (
            <div className="mt-2 text-xs leading-5 text-white/60">
              {item.title_en}
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={hideToday}
          className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white/60 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"
        >
          Hide today
        </button>
      </div>

      <p
        dir="rtl"
        lang="ar"
        className="mt-5 text-right text-xl leading-[2] text-white"
      >
        {item.arabic_text}
      </p>

      {item.english_text ? (
        <p
          dir="auto"
          className="mt-5 text-sm leading-7 text-white/75"
        >
          {item.english_text}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {item.grade ? (
          <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-bold text-emerald-300">
            {item.grade}
          </span>
        ) : null}

        {sourceUrl ? (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            referrerPolicy="no-referrer"
            className="text-[10px] font-bold text-yellow-300 underline decoration-yellow-500/40 underline-offset-4 hover:text-yellow-200"
          >
            View source
          </a>
        ) : null}
      </div>

      {item.attribution ? (
        <p className="mt-4 text-[10px] leading-5 text-white/45">
          {item.attribution}
        </p>
      ) : null}
    </article>
  );
}