"use client";

import { useState } from "react";

type Props = {
  mosqueId: string;
  sourceId?: string | null;
  sourceUrl: string;
  sourceType: string;
};

function getCurrentMonth() {
  return new Date().getMonth() + 1;
}

function getCurrentYear() {
  return new Date().getFullYear();
}

export default function MosqueTimetableImportButton({
  mosqueId,
  sourceId,
  sourceUrl,
  sourceType,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function createImport() {
    try {
      setLoading(true);
      setMessage("");
      setErrorMessage("");

      const res = await fetch("/api/mosque/timetable-imports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mosque_id: mosqueId,
          source_id: sourceId,
          source_url: sourceUrl,
          source_type: sourceType,
          import_month: getCurrentMonth(),
          import_year: getCurrentYear(),
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };

      if (!res.ok || !data.ok) {
        setErrorMessage(data.error ?? "Could not create import.");
        return;
      }

      setMessage("Import queued successfully.");
    } catch {
      setErrorMessage("Could not create import.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={createImport}
        disabled={loading}
        className="rounded-xl bg-yellow-500 px-4 py-2 text-xs font-bold text-black hover:bg-yellow-400 disabled:opacity-50"
      >
        {loading ? "Queuing..." : "Import timetable"}
      </button>

      {message ? (
        <div className="mt-3 rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-xs text-green-300">
          {message}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
          {errorMessage}
        </div>
      ) : null}
    </div>
  );
}

