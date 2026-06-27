"use client";

import { useEffect, useMemo, useState } from "react";
import HajjAudioPlayer from "@/components/HajjAudioPlayer";
import HajjImageFrame from "@/components/HajjImageFrame";

type HajjStep = {
  day: string;
  title: string;
  image: string;
  details: string;
};

type Props = {
  steps: HajjStep[];
};

const stepAudioMap: Record<string, { src: string; label: string }> = {
  "Entering Ihram": { src: "/audio/hajj/talbiyah.mp3", label: "Talbiyah" },
  "At the Miqat": { src: "/audio/hajj/talbiyah.mp3", label: "Talbiyah" },
  Talbiyah: { src: "/audio/hajj/talbiyah.mp3", label: "Talbiyah" },
  Mina: { src: "/audio/hajj/general-dhikr.mp3", label: "Dhikr" },
  Arafah: { src: "/audio/hajj/arafah-dua.mp3", label: "Du‘a of Arafah" },
  Muzdalifah: { src: "/audio/hajj/general-dhikr.mp3", label: "Dhikr" },
  Jamarat: { src: "/audio/hajj/general-dhikr.mp3", label: "Takbeer" },
  "Farewell Tawaf": { src: "/audio/hajj/general-dhikr.mp3", label: "Dhikr" },
};

function getStepFromUrl(totalSteps: number) {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("step");
  const parsed = raw ? Number(raw) : null;

  if (!parsed || !Number.isFinite(parsed)) return null;

  const index = parsed - 1;

  if (index < 0 || index >= totalSteps) return null;

  return index;
}

function updateStepUrl(index: number) {
  const url = new URL(window.location.href);
  url.searchParams.set("step", String(index + 1));

  window.history.replaceState({}, "", url.toString());
}

export default function HajjGuide({ steps }: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [autoPlay, setAutoPlay] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const urlStep = getStepFromUrl(steps.length);

    if (urlStep !== null) {
      setCurrentStep(urlStep);
    } else {
      const savedStep = window.localStorage.getItem("snm_hajj_step");
      const parsedStep = savedStep ? Number(savedStep) : 0;

      if (
        Number.isFinite(parsedStep) &&
        parsedStep >= 0 &&
        parsedStep < steps.length
      ) {
        setCurrentStep(parsedStep);
      }
    }

    const savedAutoPlay = window.localStorage.getItem("snm_hajj_autoplay");
    setAutoPlay(savedAutoPlay === "true");

    setLoaded(true);
  }, [steps.length]);

  useEffect(() => {
    if (!loaded) return;

    window.localStorage.setItem("snm_hajj_step", String(currentStep));
    updateStepUrl(currentStep);

    window.dispatchEvent(
      new CustomEvent("hajj-step-change", { detail: currentStep })
    );

    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentStep, loaded]);

  useEffect(() => {
    if (!loaded) return;

    window.localStorage.setItem("snm_hajj_autoplay", String(autoPlay));

    window.dispatchEvent(
      new CustomEvent("hajj-audio-toggle", { detail: autoPlay })
    );
  }, [autoPlay, loaded]);

  useEffect(() => {
    if (!loaded || !autoPlay) return;

    const timer = window.setTimeout(() => {
      const audio = document.querySelector<HTMLAudioElement>(
        "[data-hajj-audio='true']"
      );

      audio?.play().catch(() => {});
    }, 600);

    return () => window.clearTimeout(timer);
  }, [currentStep, autoPlay, loaded]);

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<number>;
      const nextStep = customEvent.detail;

      if (
        Number.isFinite(nextStep) &&
        nextStep >= 0 &&
        nextStep < steps.length
      ) {
        setCurrentStep(nextStep);
      }
    };

    window.addEventListener("hajj-floating-step-change", handler);

    return () => {
      window.removeEventListener("hajj-floating-step-change", handler);
    };
  }, [steps.length]);

  useEffect(() => {
    const handler = () => {
      const urlStep = getStepFromUrl(steps.length);
      if (urlStep !== null) setCurrentStep(urlStep);
    };

    window.addEventListener("popstate", handler);

    return () => {
      window.removeEventListener("popstate", handler);
    };
  }, [steps.length]);

  const safeStepIndex =
    currentStep >= 0 && currentStep < steps.length ? currentStep : 0;

  const step = steps[safeStepIndex];
  const audio = stepAudioMap[step.title] ?? null;

  const progress = useMemo(() => {
    return Math.round(((safeStepIndex + 1) / steps.length) * 100);
  }, [safeStepIndex, steps.length]);

  function goPrevious() {
    setCurrentStep((stepIndex) => Math.max(0, stepIndex - 1));
  }

  function goNext() {
    setCurrentStep((stepIndex) => Math.min(steps.length - 1, stepIndex + 1));
  }

  function restart() {
    setCurrentStep(0);
  }

  function copyStepLink() {
    updateStepUrl(safeStepIndex);
    navigator.clipboard?.writeText(window.location.href).catch(() => {});
  }

  return (
    <section
      id="guided-mode"
      className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6 md:p-8"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
            Guided Hajj Mode
          </div>

          <h2 className="mt-3 text-3xl font-bold text-white">
            Continue your Hajj journey
          </h2>

          <p className="mt-2 max-w-3xl text-white/60">
            Step {safeStepIndex + 1} of {steps.length}. Shareable link:
            <span className="text-yellow-400"> /hajj?step={safeStepIndex + 1}</span>
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={copyStepLink}
            className="rounded-xl border border-white/10 bg-black px-4 py-3 text-sm font-semibold text-white/70 hover:border-yellow-500/30 hover:text-yellow-400"
          >
            Copy step link
          </button>

          <button
            type="button"
            onClick={() => setAutoPlay((value) => !value)}
            className={
              autoPlay
                ? "rounded-xl border border-yellow-500/30 bg-yellow-500 px-4 py-3 text-sm font-semibold text-black"
                : "rounded-xl border border-yellow-500/30 bg-black px-4 py-3 text-sm font-semibold text-yellow-400 hover:bg-yellow-500/10"
            }
          >
            {autoPlay ? "Auto audio: ON" : "Auto audio: OFF"}
          </button>

          <button
            type="button"
            onClick={restart}
            className="rounded-xl border border-white/10 bg-black px-4 py-3 text-sm font-semibold text-white/70 hover:border-yellow-500/30 hover:text-yellow-400"
          >
            Restart
          </button>
        </div>
      </div>

      <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-yellow-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mt-6 rounded-3xl border border-white/10 bg-black/30 p-4 md:p-6">
        <HajjImageFrame
          src={step.image}
          alt={step.title}
          priority={safeStepIndex === 0}
        />

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-yellow-500 px-3 py-1 text-sm font-bold text-black">
            {safeStepIndex + 1}
          </span>

          <span className="text-sm font-semibold text-yellow-400">
            {step.day}
          </span>
        </div>

        <h3 className="mt-3 text-3xl font-bold text-white">{step.title}</h3>

        <p className="mt-3 max-w-4xl text-white/70">{step.details}</p>

        <div className="mt-5">
          <HajjAudioPlayer
            src={audio?.src ?? null}
            label={audio?.label ?? "Du‘a"}
          />
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          disabled={safeStepIndex === 0}
          onClick={goPrevious}
          className="rounded-2xl border border-yellow-500/30 bg-black px-5 py-4 font-semibold text-yellow-400 hover:bg-yellow-500/10 disabled:cursor-not-allowed disabled:opacity-30"
        >
          Previous
        </button>

        <button
          type="button"
          disabled={safeStepIndex === steps.length - 1}
          onClick={goNext}
          className="rounded-2xl bg-yellow-500 px-5 py-4 font-semibold text-black hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-30"
        >
          Next
        </button>
      </div>
    </section>
  );
}

