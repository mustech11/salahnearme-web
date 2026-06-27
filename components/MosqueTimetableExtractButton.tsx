"use client";

import { useState } from "react";

type Props = {
  importId: string;
};

export default function MosqueTimetableExtractButton({ importId }: Props) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function extract() {
    try {
      setLoading(true);
      setMessage("");
      setErrorMessage("");

      const res = await fetch("/api/mosque/timetable-imports/extract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          import_id: importId,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };

      if (!res.ok || !data.ok) {
        setErrorMessage(data.error ?? "Could not extract timetable.");
        return;
      }

      setMessage("Raw timetable text extracted. Refresh to view updated status.");
    } catch {
      setErrorMessage("Could not extract timetable.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={extract}
        disabled={loading}
        className="rounded-xl border border-yellow-500/30 bg-black px-4 py-2 text-xs font-bold text-yellow-400 hover:bg-yellow-500/10 disabled:opacity-50"
      >
        {loading ? "Extracting..." : "Extract raw text"}
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

