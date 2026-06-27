"use client";

import { useState } from "react";

const umrahOfflineFiles = [
  "/umrah",
  "/images/kaaba-bg.png",
  "/images/umrah/umrah-1-ihram-panel.png",
  "/images/umrah/umrah-2-haram-panel.png",
  "/images/umrah/umrah-3-tawaf-panel.png",
  "/images/umrah/umrah-4-two-rakah-panel.png",
  "/images/umrah/umrah-5-zamzam-panel.png",
  "/images/umrah/umrah-6-sai-panel.png",
  "/images/umrah/umrah-7-hair-panel.png",
];

export default function UmrahOfflineDownload() {
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

      const cache = await caches.open("salahnearme-umrah-guide-v1");
      await cache.addAll(umrahOfflineFiles);

      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <section className="rounded-3xl border border-yellow-500/20 bg-black/40 p-6 md:p-8">
      <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
        Offline Umrah Mode
      </div>

      <h2 className="mt-3 text-3xl font-bold text-white">
        Save this Umrah guide for offline use
      </h2>

      <p className="mt-3 max-w-3xl text-white/70">
        Save the guide and images on this device so you can access them in
        Makkah when signal is weak.
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
          : "Save Umrah guide offline"}
      </button>

      {status === "error" && (
        <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
          Offline save failed. Make sure all image files exist in
          /public/images/umrah/.
        </div>
      )}
    </section>
  );
}

