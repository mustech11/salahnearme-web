"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  reportId: string;
  mosqueId: string;
  currentStatus: string;
  currentNotes?: string | null;
};

type SubmitState = "idle" | "saving" | "success" | "error";

const STATUSES = [
  {
    value: "new",
    label: "New",
  },
  {
    value: "reviewing",
    label: "Reviewing",
  },
  {
    value: "resolved",
    label: "Resolved",
  },
  {
    value: "rejected",
    label: "Rejected",
  },
];

function getQuickNote(status: string) {
  if (status === "reviewing") {
    return "We are reviewing this correction report.";
  }

  if (status === "resolved") {
    return "This report has been reviewed and resolved.";
  }

  if (status === "rejected") {
    return "This report was reviewed but not accepted.";
  }

  return "";
}

export default function MosqueCorrectionReportActions({
  reportId,
  mosqueId,
  currentStatus,
  currentNotes,
}: Props) {
  const router = useRouter();

  const [status, setStatus] = useState(currentStatus || "new");
  const [notes, setNotes] = useState(currentNotes ?? "");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function saveUpdate() {
    setSubmitState("saving");
    setErrorMessage("");

    try {
      const res = await fetch("/api/mosque/correction-report/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          report_id: reportId,
          mosque_id: mosqueId,
          status,
          admin_notes: notes,
        }),
      });

      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };

      if (!res.ok || !json.ok) {
        setSubmitState("error");
        setErrorMessage(json.error ?? "Could not update report.");
        return;
      }

      setSubmitState("success");
      router.refresh();
    } catch {
      setSubmitState("error");
      setErrorMessage("Could not update report.");
    }
  }

  function quickSet(nextStatus: string) {
    setStatus(nextStatus);

    const quickNote = getQuickNote(nextStatus);

    if (quickNote && notes.trim().length === 0) {
      setNotes(quickNote);
    }
  }

  return (
    <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4">
      <div className="text-xs uppercase tracking-[0.18em] text-cyan-300">
        Manager action
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[0.75fr_1.25fr]">
        <div>
          <label className="text-sm font-bold text-white/80">
            Report status
          </label>

          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-cyan-500/50"
          >
            {STATUSES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => quickSet("reviewing")}
              className="rounded-lg border border-cyan-500/30 px-3 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-500/10"
            >
              Mark reviewing
            </button>

            <button
              type="button"
              onClick={() => quickSet("resolved")}
              className="rounded-lg border border-emerald-500/30 px-3 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/10"
            >
              Mark resolved
            </button>

            <button
              type="button"
              onClick={() => quickSet("rejected")}
              className="rounded-lg border border-red-500/30 px-3 py-2 text-xs font-bold text-red-300 hover:bg-red-500/10"
            >
              Reject
            </button>
          </div>
        </div>

        <div>
          <label className="text-sm font-bold text-white/80">
            Manager notes
          </label>

          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="Add what was checked, what changed, or why the report was rejected."
            className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-500/50"
          />
        </div>
      </div>

      {submitState === "error" ? (
        <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-100">
          {errorMessage}
        </div>
      ) : null}

      {submitState === "success" ? (
        <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-100">
          Report updated successfully.
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={saveUpdate}
          disabled={submitState === "saving"}
          className="rounded-xl bg-cyan-500 px-5 py-3 text-sm font-black text-black hover:bg-cyan-400 disabled:opacity-50"
        >
          {submitState === "saving" ? "Saving..." : "Save report update"}
        </button>

        <p className="text-xs leading-6 text-white/45">
          Updating this report does not automatically change public prayer data.
        </p>
      </div>
    </div>
  );
}

