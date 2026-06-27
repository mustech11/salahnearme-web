"use client";

import { useState } from "react";

type Props = {
  importId: string;
};

export default function MosqueTimetableApproveButton({ importId }: Props) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function approveImport() {
    const confirmed = window.confirm(
      "Approve this parsed timetable and publish its rows to the public mosque prayer times?"
    );

    if (!confirmed) {
      return;
    }

    try {
      setLoading(true);
      setMessage("");
      setErrorMessage("");

      const res = await fetch("/api/mosque/timetable-imports/approve", {
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
        approved_rows?: number;
      };

      if (!res.ok || !data.ok) {
        setErrorMessage(data.error ?? "Could not approve timetable.");
        return;
      }

      setMessage(
        `Timetable approved. ${data.approved_rows ?? 0} rows published. Refresh to see updated status.`
      );
    } catch {
      setErrorMessage("Could not approve timetable.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={approveImport}
        disabled={loading}
        className="rounded-xl bg-green-500 px-4 py-2 text-xs font-bold text-black hover:bg-green-400 disabled:opacity-50"
      >
        {loading ? "Approving..." : "Approve & publish"}
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

