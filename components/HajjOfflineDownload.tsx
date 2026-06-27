"use client";

import { useState } from "react";

const hajjOfflineFiles = [
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
];

export default function HajjOfflineDownload() {
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );

  async function saveOffline() {
    try {
      setStatus("saving");

      if (!("caches" in window)) {
        setStatus("error");
        return;
      }

      const cache = await caches.open("salahnearme-hajj-guide-v1");

      await cache.addAll(hajjOfflineFiles);

      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <section className="rounded-3xl border border-yellow-500/20 bg-black/40 p-6 md:p-8">
      <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
        Offline Hajj Mode
      </div>

      <h2 className="mt-3 text-3xl font-bold text-white">
        Save this Hajj guide for offline use
      </h2>

      <p className="mt-3 max-w-3xl text-white/70">
        Save the guide and images on this device so you can access them during
        travel when signal is weak.
      </p>

      <button
        type="button"
        onClick={saveOffline}
        disabled={status === "saving"}
        className="mt-5 rounded-2xl bg-yellow-500 px-6 py-4 font-semibold text-black hover:bg-yellow-400 disabled:opacity-50"
      >
        {status === "saving"
          ? "Saving..."
          : status === "saved"
          ? "Saved offline"
          : "Save Hajj guide offline"}
      </button>

      {status === "error" && (
        <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
          Offline save failed. Make sure all image files exist in
          /public/images/hajj/.
        </div>
      )}
    </section>
  );
}

