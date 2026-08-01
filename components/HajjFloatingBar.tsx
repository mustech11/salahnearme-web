"use client";

import {
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";

type Step = {
  title: string;
  day?: string;
};

type Props = {
  steps: Step[];
};

function updateStepUrl(index: number) {
  const url = new URL(window.location.href);
  url.searchParams.set("step", String(index + 1));
  window.history.replaceState({}, "", url.toString());
}

function readBoolean(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "true";
  } catch {
    return false;
  }
}

function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage is optional.
  }
}

export default function HajjFloatingBar({ steps }: Props) {
  const statusId = useId();

  const safeSteps = useMemo(
    () =>
      (steps ?? []).filter(
        (step) => typeof step?.title === "string" && step.title.trim()
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

    const params = new URLSearchParams(window.location.search);
    const rawStep = params.get("step");
    const urlStep = rawStep ? Number(rawStep) - 1 : null;

    if (
      urlStep !== null &&
      Number.isInteger(urlStep) &&
      urlStep >= 0 &&
      urlStep < safeSteps.length
    ) {
      setCurrent(urlStep);
    } else {
      try {
        const parsed = Number(window.localStorage.getItem("snm_hajj_step"));

        if (
          Number.isInteger(parsed) &&
          parsed >= 0 &&
          parsed < safeSteps.length
        ) {
          setCurrent(parsed);
        }
      } catch {
        // Storage is optional.
      }
    }

    setAudioOn(readBoolean("snm_hajj_autoplay"));
    setFocusMode(readBoolean("snm_hajj_focus"));
  }, [safeSteps.length]);

  useEffect(() => {
    if (!safeSteps.length) return;

    writeStorage("snm_hajj_step", String(safeCurrent));
    updateStepUrl(safeCurrent);
  }, [safeCurrent, safeSteps.length]);

  useEffect(() => {
    writeStorage("snm_hajj_focus", String(focusMode));
    document.documentElement.classList.toggle("hajj-focus-mode", focusMode);

    return () => {
      document.documentElement.classList.remove("hajj-focus-mode");
    };
  }, [focusMode]);

  useEffect(() => {
    const stepHandler = (event: Event) => {
      const nextStep = (event as CustomEvent<number>).detail;

      if (
        Number.isInteger(nextStep) &&
        nextStep >= 0 &&
        nextStep < safeSteps.length
      ) {
        setCurrent(nextStep);
      }
    };

    const audioHandler = (event: Event) => {
      setAudioOn(Boolean((event as CustomEvent<boolean>).detail));
    };

    window.addEventListener("hajj-step-change", stepHandler);
    window.addEventListener("hajj-audio-toggle", audioHandler);

    return () => {
      window.removeEventListener("hajj-step-change", stepHandler);
      window.removeEventListener("hajj-audio-toggle", audioHandler);
    };
  }, [safeSteps.length]);

  function changeStep(nextStep: number) {
    const safeNext = Math.min(
      safeSteps.length - 1,
      Math.max(0, nextStep)
    );

    if (safeNext === safeCurrent) return;

    setCurrent(safeNext);

    window.dispatchEvent(
      new CustomEvent("hajj-floating-step-change", {
        detail: safeNext,
      })
    );

    document
      .getElementById("guided-mode")
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (event.key === "ArrowLeft") {
        changeStep(safeCurrent - 1);
      }

      if (event.key === "ArrowRight") {
        changeStep(safeCurrent + 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [safeCurrent, safeSteps.length]);

  if (!safeSteps.length) {
    return null;
  }

  function toggleAudio() {
    const nextAudio = !audioOn;

    setAudioOn(nextAudio);
    writeStorage("snm_hajj_autoplay", String(nextAudio));

    window.dispatchEvent(
      new CustomEvent("hajj-audio-toggle", {
        detail: nextAudio,
      })
    );
  }

  async function copyStepLink() {
    updateStepUrl(safeCurrent);

    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyMessage("Step link copied.");
    } catch {
      setCopyMessage("Copy is unavailable on this device.");
    }

    window.setTimeout(() => setCopyMessage(""), 2_500);
  }

  return (
    <aside
      aria-label="Hajj guide controls"
      className="fixed bottom-4 left-1/2 z-50 w-[94%] max-w-5xl -translate-x-1/2 rounded-3xl border border-yellow-500/30 bg-black/90 shadow-[0_0_35px_rgba(212,175,55,0.18)] backdrop-blur-xl print:hidden"
    >
      <div className="h-1 overflow-hidden rounded-t-3xl bg-white/10">
        <div
          className="h-full bg-yellow-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.2em] text-yellow-400">
            Current Hajj step
          </div>

          <div className="truncate text-sm font-black text-white">
            {safeCurrent + 1}. {safeSteps[safeCurrent]?.title}
          </div>

          {safeSteps[safeCurrent]?.day ? (
            <div className="truncate text-xs text-white/50">
              {safeSteps[safeCurrent].day}
            </div>
          ) : null}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            disabled={safeCurrent === 0}
            onClick={() => changeStep(safeCurrent - 1)}
            className="rounded-xl border border-yellow-500/30 px-3 py-2 text-xs font-black text-yellow-400 hover:bg-yellow-500/10 disabled:cursor-not-allowed disabled:opacity-30"
          >
            ◀ Prev
          </button>

          <button
            type="button"
            disabled={safeCurrent === safeSteps.length - 1}
            onClick={() => changeStep(safeCurrent + 1)}
            className="rounded-xl bg-yellow-500 px-3 py-2 text-xs font-black text-black hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-30"
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

      <div id={statusId} aria-live="polite" className="sr-only">
        {copyMessage}
      </div>
    </aside>
  );
}