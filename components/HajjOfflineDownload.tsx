"use client";

import { useState } from "react";

const CACHE_NAME = "salahnearme-hajj-guide-v2";

const OFFLINE_FILES = [
  "/hajj",
  "/images/kaaba-bg.png",
  "/images/hajj/hajj-1-ihram-panel.png",
  "/images/hajj/hajj-2-miqat-panel.png",
  "/images/hajj/hajj-3-talbiyah-panel.png",
  "/images/hajj/hajj-4-masjid-haram-panel.png",
  "/images/hajj/hajj-5-tawaf-panel.png",
  "/images/hajj/hajj-6-sai-panel.png",
  "/images/hajj/hajj-7-mina-panel.png",
  "/images/hajj/hajj-8-arafah-panel.png",
  "/images/hajj/hajj-9-muzdalifah-panel.png",
  "/images/hajj/hajj-10-jamarat-panel.png",
  "/images/hajj/hajj-11-sacrifice-panel.png",
  "/images/hajj/hajj-12-hair-panel.png",
  "/images/hajj/hajj-13-farewell-panel.png",
] as const;

type Status = "idle" | "saving" | "saved" | "partial" | "error";

export default function HajjOfflineDownload() {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [savedCount, setSavedCount] = useState(0);

  async function saveOffline() {
    if (status === "saving") return;

    setStatus("saving");
    setMessage("");
    setSavedCount(0);

    if (!("caches" in window)) {
      setStatus("error");
      setMessage("Offline storage is not supported by this browser.");
      return;
    }

    try {
      const cache = await caches.open(CACHE_NAME);
      let successful = 0;
      let failed = 0;

      for (const path of OFFLINE_FILES) {
        try {
          const response = await fetch(path, {
            credentials: "same-origin",
            cache: "reload",
          });

          if (!response.ok) {
            failed += 1;
            continue;
          }

          await cache.put(path, response.clone());
          successful += 1;
          setSavedCount(successful);
        } catch {
          failed += 1;
        }
      }

      if (failed === 0) {
        setStatus("saved");
        setMessage("The Hajj guide is ready for offline use.");
      } else if (successful > 0) {
        setStatus("partial");
        setMessage(`${successful} files were saved, but ${failed} could not be cached.`);
      } else {
        setStatus("error");
        setMessage("No guide files could be saved.");
      }
    } catch {
      setStatus("error");
      setMessage("Offline save failed. Please try again.");
    }
  }

  return (
    <section
      aria-labelledby="hajj-offline-heading"
      className="rounded-3xl border border-yellow-500/20 bg-black/40 p-6 md:p-8"
    >
      <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
        Offline Hajj Mode
      </div>

      <h2 id="hajj-offline-heading" className="mt-3 text-3xl font-black text-white">
        Save this Hajj guide for offline use
      </h2>

      <p className="mt-3 max-w-3xl text-sm leading-7 text-white/70">
        Save the guide and its illustrations on this device for travel and weak-signal areas.
      </p>

      <button
        type="button"
        onClick={() => void saveOffline()}
        disabled={status === "saving"}
        aria-busy={status === "saving"}
        className="mt-5 inline-flex min-h-12 items-center justify-center rounded-2xl bg-yellow-500 px-6 py-4 font-black text-black transition hover:bg-yellow-400 disabled:opacity-50"
      >
        {status === "saving"
          ? `Saving ${savedCount}/${OFFLINE_FILES.length}…`
          : status === "saved"
            ? "Saved offline"
            : "Save Hajj guide offline"}
      </button>

      {message ? (
        <div
          role={status === "error" ? "alert" : "status"}
          className={`mt-4 rounded-xl border p-4 text-sm ${
            status === "error"
              ? "border-red-500/20 bg-red-500/10 text-red-200"
              : status === "partial"
                ? "border-amber-500/20 bg-amber-500/10 text-amber-200"
                : "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
          }`}
        >
          {message}
        </div>
      ) : null}
    </section>
  );
}