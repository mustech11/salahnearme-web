"use client";

import {
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform?: string;
  }>;
};

const DISMISS_STORAGE_KEY = "snm_install_prompt_dismissed_at";
const DISMISS_FOR_MS = 7 * 24 * 60 * 60 * 1_000;

function isStandaloneMode(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      Boolean(
        (navigator as Navigator & {
          standalone?: boolean;
        }).standalone
      ))
  );
}

function wasRecentlyDismissed(): boolean {
  try {
    const value = Number(
      localStorage.getItem(DISMISS_STORAGE_KEY)
    );

    return (
      Number.isFinite(value) &&
      Date.now() - value < DISMISS_FOR_MS
    );
  } catch {
    return false;
  }
}

export default function InstallAppPrompt() {
  const titleId = useId();
  const descriptionId = useId();

  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  const [visible, setVisible] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installed, setInstalled] = useState(false);

  const canInstall = useMemo(
    () => Boolean(deferredPrompt) && !installed,
    [deferredPrompt, installed]
  );

  useEffect(() => {
    if (isStandaloneMode()) {
      setInstalled(true);
      return;
    }

    const handleBeforeInstallPrompt = (
      event: Event
    ) => {
      event.preventDefault();

      const installEvent =
        event as BeforeInstallPromptEvent;

      setDeferredPrompt(installEvent);

      if (!wasRecentlyDismissed()) {
        setVisible(true);
      }
    };

    const handleInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      setVisible(false);

      try {
        localStorage.removeItem(
          DISMISS_STORAGE_KEY
        );
      } catch {
        // Storage is optional.
      }
    };

    window.addEventListener(
      "beforeinstallprompt",
      handleBeforeInstallPrompt
    );

    window.addEventListener(
      "appinstalled",
      handleInstalled
    );

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );

      window.removeEventListener(
        "appinstalled",
        handleInstalled
      );
    };
  }, []);

  async function install() {
    if (
      !deferredPrompt ||
      installing
    ) {
      return;
    }

    try {
      setInstalling(true);

      await deferredPrompt.prompt();

      const choice =
        await deferredPrompt.userChoice;

      if (choice.outcome === "accepted") {
        setInstalled(true);
      }

      setDeferredPrompt(null);
      setVisible(false);
    } catch (error) {
      console.error(
        "PWA install prompt failed:",
        error
      );
    } finally {
      setInstalling(false);
    }
  }

  function dismiss() {
    setVisible(false);

    try {
      localStorage.setItem(
        DISMISS_STORAGE_KEY,
        String(Date.now())
      );
    } catch {
      // Storage is optional.
    }
  }

  if (
    !visible ||
    installed ||
    !canInstall
  ) {
    return null;
  }

  return (
    <aside
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className="fixed bottom-4 left-4 right-4 z-50 rounded-3xl border border-yellow-500/30 bg-black/95 p-5 shadow-2xl shadow-black/60 backdrop-blur-xl md:left-auto md:w-[430px]"
    >
      <div className="flex items-start gap-4">
        <div
          aria-hidden="true"
          className="grid size-12 shrink-0 place-items-center rounded-2xl border border-yellow-500/30 bg-yellow-500/10 text-xl"
        >
          📲
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-xs font-black uppercase tracking-[0.2em] text-yellow-400">
            Install SalahNearMe
          </div>

          <h2
            id={titleId}
            className="mt-2 text-lg font-black text-white"
          >
            Add SalahNearMe to your home screen
          </h2>

          <p
            id={descriptionId}
            className="mt-2 text-sm leading-6 text-white/70"
          >
            Open prayer times, mosque search, travel mode,
            Hajj and Umrah guides faster from your phone.
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void install()}
          disabled={installing}
          aria-busy={installing}
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-yellow-500 px-4 py-3 text-sm font-black text-black transition hover:bg-yellow-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 disabled:cursor-wait disabled:opacity-60"
        >
          {installing ? (
            <>
              <span
                aria-hidden="true"
                className="mr-2 size-4 animate-spin rounded-full border-2 border-black/30 border-t-black"
              />
              Installing…
            </>
          ) : (
            "Install app"
          )}
        </button>

        <button
          type="button"
          onClick={dismiss}
          disabled={installing}
          className="min-h-11 rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-white/70 transition hover:border-yellow-500/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 disabled:opacity-50"
        >
          Not now
        </button>
      </div>

      <p className="mt-4 text-xs leading-5 text-white/40">
        No app store is required. You can remove it at any time.
      </p>
    </aside>
  );
}