"use client";

import { useState } from "react";

type Props = {
  importId: string;
};

export default function MosqueTimetableParseButton({ importId }: Props) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function parseImport() {
    try {
      setLoading(true);
      setMessage("");
      setErrorMessage("");

      const res = await fetch("/api/mosque/timetable-imports/parse", {
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
        setErrorMessage(data.error ?? "Could not parse timetable.");
        return;
      }

      setMessage("Timetable parsed. Refresh to review extracted JSON.");
    } catch {
      setErrorMessage("Could not parse timetable.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={parseImport}
        disabled={loading}
        className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-2 text-xs font-bold text-green-300 hover:bg-green-500/20 disabled:opacity-50"
      >
        {loading ? "Parsing..." : "Parse timetable"}
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

