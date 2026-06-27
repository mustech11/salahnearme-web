"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function InstallAppPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();

      const installEvent = event as BeforeInstallPromptEvent;
      setDeferredPrompt(installEvent);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  async function install() {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;

    setDeferredPrompt(null);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 rounded-3xl border border-yellow-500/30 bg-black/95 p-4 shadow-2xl md:left-auto md:w-[420px]">
      <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
        Install App
      </div>

      <div className="mt-2 text-lg font-bold text-white">
        Add SalahNearMe to your home screen
      </div>

      <p className="mt-2 text-sm text-white/70">
        Open prayer times, mosque search, travel mode, Hajj and Umrah guides
        faster from your phone.
      </p>

      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={install}
          className="rounded-xl bg-yellow-500 px-4 py-3 text-sm font-semibold text-black hover:bg-yellow-400"
        >
          Install
        </button>

        <button
          type="button"
          onClick={() => setVisible(false)}
          className="rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-white/70 hover:border-yellow-500/30"
        >
          Not now
        </button>
      </div>
    </div>
  );
}

