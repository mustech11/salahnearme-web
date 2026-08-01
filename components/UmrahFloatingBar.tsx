"use client";

import { useEffect, useMemo, useState } from "react";

type Props = { steps: { title: string }[] };

function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage is optional.
  }
}

function updateUrl(index: number) {
  const url = new URL(location.href);
  url.searchParams.set("step", String(index + 1));
  history.replaceState({}, "", url.toString());
}

export default function UmrahFloatingBar({ steps }: Props) {
  const safeSteps = useMemo(
    () =>
      (steps ?? []).filter(
        (step) =>
          typeof step?.title === "string" &&
          step.title.trim()
      ),
    [steps]
  );

  const [current, setCurrent] = useState(0);
  const [audioOn, setAudioOn] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");

  const safeCurrent =
    current >= 0 && current < safeSteps.length ? current : 0;

  const progress = safeSteps.length
    ? Math.round(((safeCurrent + 1) / safeSteps.length) * 100)
    : 0;

  useEffect(() => {
    if (!safeSteps.length) return;

    const raw = new URLSearchParams(location.search).get("step");
    const fromUrl = raw ? Number(raw) - 1 : Number.NaN;

    try {
      const saved = Number(localStorage.getItem("snm_umrah_step"));

      if (
        Number.isInteger(fromUrl) &&
        fromUrl >= 0 &&
        fromUrl < safeSteps.length
      ) {
        setCurrent(fromUrl);
      } else if (
        Number.isInteger(saved) &&
        saved >= 0 &&
        saved < safeSteps.length
      ) {
        setCurrent(saved);
      }

      setAudioOn(localStorage.getItem("snm_umrah_autoplay") === "true");
      setFocusMode(localStorage.getItem("snm_umrah_focus") === "true");
    } catch {
      // Storage is optional.
    }
  }, [safeSteps.length]);

  useEffect(() => {
    if (!safeSteps.length) return;

    writeStorage("snm_umrah_step", String(safeCurrent));
    updateUrl(safeCurrent);
  }, [safeCurrent, safeSteps.length]);

  useEffect(() => {
    writeStorage("snm_umrah_focus", String(focusMode));
    document.documentElement.classList.toggle(
      "umrah-focus-mode",
      focusMode
    );

    return () => {
      document.documentElement.classList.remove("umrah-focus-mode");
    };
  }, [focusMode]);

  useEffect(() => {
    const stepHandler = (event: Event) => {
      const next = (event as CustomEvent<number>).detail;

      if (
        Number.isInteger(next) &&
        next >= 0 &&
        next < safeSteps.length
      ) {
        setCurrent(next);
      }
    };

    const audioHandler = (event: Event) => {
      setAudioOn(Boolean((event as CustomEvent<boolean>).detail));
    };

    addEventListener("umrah-step-change", stepHandler);
    addEventListener("umrah-audio-toggle", audioHandler);

    return () => {
      removeEventListener("umrah-step-change", stepHandler);
      removeEventListener("umrah-audio-toggle", audioHandler);
    };
  }, [safeSteps.length]);

  if (!safeSteps.length) return null;

  function changeStep(nextStep: number) {
    const next = Math.min(
      safeSteps.length - 1,
      Math.max(0, nextStep)
    );

    if (next === safeCurrent) return;

    setCurrent(next);

    dispatchEvent(
      new CustomEvent("umrah-floating-step-change", {
        detail: next,
      })
    );

    document
      .getElementById("guided-umrah")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function toggleAudio() {
    const next = !audioOn;

    setAudioOn(next);
    writeStorage("snm_umrah_autoplay", String(next));

    dispatchEvent(
      new CustomEvent("umrah-audio-toggle", {
        detail: next,
      })
    );
  }

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
    <aside
      aria-label="Umrah guide controls"
      className="fixed bottom-4 left-1/2 z-50 w-[94%] max-w-5xl -translate-x-1/2 rounded-3xl border border-yellow-500/30 bg-black/90 shadow-[0_0_35px_rgba(212,175,55,0.18)] backdrop-blur-xl print:hidden"
    >
      <div className="h-1 overflow-hidden rounded-t-3xl bg-white/10">
        <div
          className="h-full bg-yellow-500 transition-[width] duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.2em] text-yellow-400">
            Current Umrah step
          </div>

          <div className="truncate text-sm font-black text-white">
            {safeCurrent + 1}. {safeSteps[safeCurrent]?.title}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            disabled={safeCurrent === 0}
            onClick={() => changeStep(safeCurrent - 1)}
            className="rounded-xl border border-yellow-500/30 px-3 py-2 text-xs font-black text-yellow-400 hover:bg-yellow-500/10 disabled:opacity-30"
          >
            ◀ Prev
          </button>

          <button
            type="button"
            disabled={safeCurrent === safeSteps.length - 1}
            onClick={() => changeStep(safeCurrent + 1)}
            className="rounded-xl bg-yellow-500 px-3 py-2 text-xs font-black text-black hover:bg-yellow-400 disabled:opacity-30"
          >
            Next ▶
          </button>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <button
            type="button"
            aria-pressed={audioOn}
            onClick={toggleAudio}
            className={
              audioOn
                ? "rounded-xl bg-yellow-500 px-3 py-2 font-black text-black"
                : "rounded-xl border border-white/10 px-3 py-2 font-black text-white/70 hover:border-yellow-500/30 hover:text-yellow-400"
            }
          >
            🎧 Audio
          </button>

          <button
            type="button"
            aria-pressed={focusMode}
            onClick={() => setFocusMode((value) => !value)}
            className={
              focusMode
                ? "rounded-xl bg-yellow-500 px-3 py-2 font-black text-black"
                : "rounded-xl border border-white/10 px-3 py-2 font-black text-white/70 hover:border-yellow-500/30 hover:text-yellow-400"
            }
          >
            🌙 Focus
          </button>

          <button
            type="button"
            onClick={() => void copyStepLink()}
            className="rounded-xl border border-white/10 px-3 py-2 font-black text-white/70 hover:border-yellow-500/30 hover:text-yellow-400"
          >
            🔗 Link
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-xl border border-white/10 px-3 py-2 font-black text-white/70 hover:border-yellow-500/30 hover:text-yellow-400"
          >
            🖨 Print
          </button>
        </div>
      </div>

      <div aria-live="polite" className="sr-only">
        {copyMessage}
      </div>
    </aside>
  );
}