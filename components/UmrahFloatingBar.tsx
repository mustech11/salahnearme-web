"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  steps: { title: string }[];
};

function updateStepUrl(index: number) {
  const url = new URL(window.location.href);
  url.searchParams.set("step", String(index + 1));
  window.history.replaceState({}, "", url.toString());
}

export default function UmrahFloatingBar({ steps }: Props) {
  const [current, setCurrent] = useState(0);
  const [audioOn, setAudioOn] = useState(false);
  const [focusMode, setFocusMode] = useState(false);

  const safeCurrent = current >= 0 && current < steps.length ? current : 0;

  const progress = useMemo(() => {
    return Math.round(((safeCurrent + 1) / steps.length) * 100);
  }, [safeCurrent, steps.length]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rawStep = params.get("step");
    const urlStep = rawStep ? Number(rawStep) - 1 : null;

    if (
      urlStep !== null &&
      Number.isFinite(urlStep) &&
      urlStep >= 0 &&
      urlStep < steps.length
    ) {
      setCurrent(urlStep);
    } else {
      const saved = window.localStorage.getItem("snm_umrah_step");
      const parsed = saved ? Number(saved) : 0;

      if (Number.isFinite(parsed) && parsed >= 0 && parsed < steps.length) {
        setCurrent(parsed);
      }
    }

    setAudioOn(window.localStorage.getItem("snm_umrah_autoplay") === "true");
    setFocusMode(window.localStorage.getItem("snm_umrah_focus") === "true");
  }, [steps.length]);

  useEffect(() => {
    window.localStorage.setItem("snm_umrah_step", String(safeCurrent));
    updateStepUrl(safeCurrent);
  }, [safeCurrent]);

  useEffect(() => {
    window.localStorage.setItem("snm_umrah_focus", String(focusMode));
    document.documentElement.classList.toggle("umrah-focus-mode", focusMode);

    return () => {
      document.documentElement.classList.remove("umrah-focus-mode");
    };
  }, [focusMode]);

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<number>;
      const nextStep = customEvent.detail;

      if (
        Number.isFinite(nextStep) &&
        nextStep >= 0 &&
        nextStep < steps.length
      ) {
        setCurrent(nextStep);
      }
    };

    window.addEventListener("umrah-step-change", handler);

    return () => {
      window.removeEventListener("umrah-step-change", handler);
    };
  }, [steps.length]);

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<boolean>;
      setAudioOn(Boolean(customEvent.detail));
    };

    window.addEventListener("umrah-audio-toggle", handler);

    return () => {
      window.removeEventListener("umrah-audio-toggle", handler);
    };
  }, []);

  function changeStep(nextStep: number) {
    const safeNext = Math.min(steps.length - 1, Math.max(0, nextStep));

    setCurrent(safeNext);
    updateStepUrl(safeNext);
    window.localStorage.setItem("snm_umrah_step", String(safeNext));

    window.dispatchEvent(
      new CustomEvent("umrah-floating-step-change", { detail: safeNext })
    );

    document
      .getElementById("guided-umrah")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function toggleAudio() {
    const nextAudio = !audioOn;

    setAudioOn(nextAudio);
    window.localStorage.setItem("snm_umrah_autoplay", String(nextAudio));

    window.dispatchEvent(
      new CustomEvent("umrah-audio-toggle", { detail: nextAudio })
    );
  }

  function copyStepLink() {
    updateStepUrl(safeCurrent);
    navigator.clipboard?.writeText(window.location.href).catch(() => {});
  }

  return (
    <div className="fixed bottom-4 left-1/2 z-50 w-[94%] max-w-5xl -translate-x-1/2 rounded-3xl border border-yellow-500/30 bg-black/90 shadow-[0_0_35px_rgba(212,175,55,0.18)] backdrop-blur-xl">
      <div className="h-1 overflow-hidden rounded-t-3xl bg-white/10">
        <div
          className="h-full bg-yellow-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.2em] text-yellow-400">
            Current Umrah Step
          </div>

          <div className="truncate text-sm font-semibold text-white">
            {safeCurrent + 1}. {steps[safeCurrent]?.title}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            disabled={safeCurrent === 0}
            onClick={() => changeStep(safeCurrent - 1)}
            className="rounded-xl border border-yellow-500/30 px-3 py-2 text-xs font-semibold text-yellow-400 hover:bg-yellow-500/10 disabled:cursor-not-allowed disabled:opacity-30"
          >
            ◀ Prev
          </button>

          <button
            type="button"
            disabled={safeCurrent === steps.length - 1}
            onClick={() => changeStep(safeCurrent + 1)}
            className="rounded-xl bg-yellow-500 px-3 py-2 text-xs font-semibold text-black hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-30"
          >
            Next ▶
          </button>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <button
            type="button"
            onClick={toggleAudio}
            className={
              audioOn
                ? "rounded-xl bg-yellow-500 px-3 py-2 font-semibold text-black"
                : "rounded-xl border border-white/10 px-3 py-2 font-semibold text-white/70 hover:border-yellow-500/30 hover:text-yellow-400"
            }
          >
            🎧 Audio
          </button>

          <button
            type="button"
            onClick={() => setFocusMode((value) => !value)}
            className={
              focusMode
                ? "rounded-xl bg-yellow-500 px-3 py-2 font-semibold text-black"
                : "rounded-xl border border-white/10 px-3 py-2 font-semibold text-white/70 hover:border-yellow-500/30 hover:text-yellow-400"
            }
          >
            🌙 Focus
          </button>

          <button
            type="button"
            onClick={copyStepLink}
            className="rounded-xl border border-white/10 px-3 py-2 font-semibold text-white/70 hover:border-yellow-500/30 hover:text-yellow-400"
          >
            🔗 Link
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-xl border border-white/10 px-3 py-2 font-semibold text-white/70 hover:border-yellow-500/30 hover:text-yellow-400"
          >
            📥 Save
          </button>
        </div>
      </div>
    </div>
  );
}

