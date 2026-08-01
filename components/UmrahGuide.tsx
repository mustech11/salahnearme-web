"use client";

import { useEffect, useId, useMemo, useState } from "react";

import HajjAudioPlayer from "@/components/HajjAudioPlayer";
import HajjImageFrame from "@/components/HajjImageFrame";

type UmrahStep = {
  title: string;
  image: string;
  details: string;
};

type Props = {
  steps: UmrahStep[];
};

const STEP_AUDIO_MAP: Record<string, { src: string; label: string }> = {
  "Entering Ihram": { src: "/audio/hajj/talbiyah.mp3", label: "Talbiyah" },
  "At the Miqat": { src: "/audio/hajj/talbiyah.mp3", label: "Talbiyah" },
  Talbiyah: { src: "/audio/hajj/talbiyah.mp3", label: "Talbiyah" },
  Mina: { src: "/audio/hajj/general-dhikr.mp3", label: "Dhikr" },
  Arafah: { src: "/audio/hajj/arafah-dua.mp3", label: "Du‘a of Arafah" },
  Muzdalifah: { src: "/audio/hajj/general-dhikr.mp3", label: "Dhikr" },
  Jamarat: { src: "/audio/hajj/general-dhikr.mp3", label: "Takbeer" },
  "Farewell Tawaf": { src: "/audio/hajj/general-dhikr.mp3", label: "Dhikr" },
};

function clean(value: unknown, max = 8000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function normaliseSteps(steps: UmrahStep[]) {
  return (steps ?? [])
    .map((step) => ({
      title: clean(step.title, 240),
      image: clean(step.image, 1000),
      details: clean(step.details),
    }))
    .filter(
      (step) =>
        step.title &&
        step.image &&
        step.details &&
        (step.image.startsWith("/") || /^https?:\/\//i.test(step.image))
    );
}

function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage is optional.
  }
}

function stepFromUrl(total: number): number | null {
  const raw = new URLSearchParams(location.search).get("step");
  const parsed = raw ? Number(raw) - 1 : Number.NaN;

  return Number.isInteger(parsed) && parsed >= 0 && parsed < total
    ? parsed
    : null;
}

function updateUrl(index: number) {
  const url = new URL(location.href);
  url.searchParams.set("step", String(index + 1));
  history.replaceState({}, "", url.toString());
}

export default function UmrahGuide({ steps }: Props) {
  const headingId = useId();
  const safeSteps = useMemo(() => normaliseSteps(steps), [steps]);

  const [current, setCurrent] = useState(0);
  const [autoPlay, setAutoPlay] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");

  useEffect(() => {
    if (!safeSteps.length) {
      setLoaded(true);
      return;
    }

    const fromUrl = stepFromUrl(safeSteps.length);

    try {
      const saved = Number(localStorage.getItem("snm_umrah_step"));

      if (fromUrl !== null) {
        setCurrent(fromUrl);
      } else if (
        Number.isInteger(saved) &&
        saved >= 0 &&
        saved < safeSteps.length
      ) {
        setCurrent(saved);
      }

      setAutoPlay(localStorage.getItem("snm_umrah_autoplay") === "true");
    } catch {
      // Storage is optional.
    }

    setLoaded(true);
  }, [safeSteps.length]);

  useEffect(() => {
    if (!loaded || !safeSteps.length) return;

    writeStorage("snm_umrah_step", String(current));
    updateUrl(current);

    dispatchEvent(
      new CustomEvent("umrah-step-change", { detail: current })
    );
  }, [current, loaded, safeSteps.length]);

  useEffect(() => {
    if (!loaded) return;

    writeStorage("snm_umrah_autoplay", String(autoPlay));

    dispatchEvent(
      new CustomEvent("umrah-audio-toggle", { detail: autoPlay })
    );
  }, [autoPlay, loaded]);

  useEffect(() => {
    if (!loaded || !autoPlay) return;

    const timer = window.setTimeout(() => {
      document
        .querySelector<HTMLAudioElement>("[data-hajj-audio='true']")
        ?.play()
        .catch(() => undefined);
    }, 700);

    return () => window.clearTimeout(timer);
  }, [autoPlay, current, loaded]);

  useEffect(() => {
    const floatingHandler = (event: Event) => {
      const next = (event as CustomEvent<number>).detail;

      if (
        Number.isInteger(next) &&
        next >= 0 &&
        next < safeSteps.length
      ) {
        setCurrent(next);
      }
    };

    const popHandler = () => {
      const next = stepFromUrl(safeSteps.length);
      if (next !== null) setCurrent(next);
    };

    addEventListener("umrah-floating-step-change", floatingHandler);
    addEventListener("popstate", popHandler);

    return () => {
      removeEventListener("umrah-floating-step-change", floatingHandler);
      removeEventListener("popstate", popHandler);
    };
  }, [safeSteps.length]);

  if (!safeSteps.length) {
    return (
      <section className="rounded-3xl border border-white/10 bg-[rgb(var(--card))] p-6 text-sm text-white/55">
        Guided Umrah steps are not currently available.
      </section>
    );
  }

  const safeCurrent =
    current >= 0 && current < safeSteps.length ? current : 0;

  const step = safeSteps[safeCurrent];
  const audio = STEP_AUDIO_MAP[step.title] ?? null;
  const progress = Math.round(
    ((safeCurrent + 1) / safeSteps.length) * 100
  );

  async function copyStepLink() {
    updateUrl(safeCurrent);

    try {
      await navigator.clipboard.writeText(location.href);
      setCopyMessage("Step link copied.");
    } catch {
      setCopyMessage("Copy is unavailable.");
    }

    window.setTimeout(() => setCopyMessage(""), 2500);
  }

  return (
    <section
      id="guided-umrah"
      aria-labelledby={headingId}
      className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6 md:p-8"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
            Guided Umrah Mode
          </div>

          <h2 id={headingId} className="mt-3 text-3xl font-black text-white">
            Follow Umrah step by step
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-7 text-white/60">
            Step {safeCurrent + 1} of {safeSteps.length}. This guide supports
            your journey but does not replace qualified scholarly or official guidance.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void copyStepLink()}
            className="rounded-xl border border-white/10 bg-black px-4 py-3 text-sm font-bold text-white/70 hover:border-yellow-500/30 hover:text-yellow-400"
          >
            Copy step link
          </button>

          <button
            type="button"
            aria-pressed={autoPlay}
            onClick={() => setAutoPlay((value) => !value)}
            className={
              autoPlay
                ? "rounded-xl border border-yellow-500/30 bg-yellow-500 px-4 py-3 text-sm font-black text-black"
                : "rounded-xl border border-yellow-500/30 bg-black px-4 py-3 text-sm font-black text-yellow-400 hover:bg-yellow-500/10"
            }
          >
            {autoPlay ? "Auto audio: ON" : "Auto audio: OFF"}
          </button>

          <button
            type="button"
            disabled={safeCurrent === 0}
            onClick={() => setCurrent(0)}
            className="rounded-xl border border-white/10 bg-black px-4 py-3 text-sm font-bold text-white/70 hover:border-yellow-500/30 hover:text-yellow-400 disabled:opacity-40"
          >
            Restart
          </button>
        </div>
      </div>

      <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-yellow-500 transition-[width] duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mt-6 rounded-3xl border border-white/10 bg-black/30 p-4 md:p-6">
        <HajjImageFrame
          src={step.image}
          alt={step.title}
          priority={safeCurrent === 0}
        />

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-yellow-500 px-3 py-1 text-sm font-black text-black">
            {safeCurrent + 1}
          </span>

          <span className="text-sm font-black text-yellow-400">
            Umrah step
          </span>
        </div>

        <h3 className="mt-3 text-3xl font-black text-white">
          {step.title}
        </h3>

        <p
          dir="auto"
          className="mt-3 max-w-4xl whitespace-pre-wrap text-sm leading-7 text-white/70"
        >
          {step.details}
        </p>

        <div className="mt-5">
          <HajjAudioPlayer
            src={audio?.src ?? null}
            label={audio?.label ?? "Umrah audio guidance"}
          />
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          disabled={safeCurrent === 0}
          onClick={() => setCurrent((value) => Math.max(0, value - 1))}
          className="rounded-2xl border border-yellow-500/30 bg-black px-5 py-4 font-black text-yellow-400 hover:bg-yellow-500/10 disabled:opacity-30"
        >
          Previous
        </button>

        <button
          type="button"
          disabled={safeCurrent === safeSteps.length - 1}
          onClick={() =>
            setCurrent((value) =>
              Math.min(safeSteps.length - 1, value + 1)
            )
          }
          className="rounded-2xl bg-yellow-500 px-5 py-4 font-black text-black hover:bg-yellow-400 disabled:opacity-30"
        >
          Next
        </button>
      </div>

      <div aria-live="polite" className="sr-only">
        {copyMessage}
      </div>
    </section>
  );
}