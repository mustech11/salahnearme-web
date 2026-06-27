"use client";

import { useState } from "react";

type Props = {
  mosqueId: string;
};

type ApiResponse = {
  ok?: boolean;
  error?: string;
};

type ReportButton = {
  type:
    | "iqamah_started"
    | "khutbah_live"
    | "full"
    | "correction"
    | "parking_full"
    | "jumuah_first"
    | "jumuah_second"
    | "jumuah_third";
  label: string;
  successMessage: string;
  className: string;
};

const REPORT_BUTTONS: ReportButton[] = [
  {
    type: "iqamah_started",
    label: "🟢 Iqamah started",
    successMessage: "Iqamah report submitted.",
    className:
      "rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-2 text-sm font-semibold text-green-300 hover:bg-green-500/20 disabled:cursor-not-allowed disabled:opacity-50",
  },
  {
    type: "khutbah_live",
    label: "🟣 Khutbah live",
    successMessage: "Khutbah report submitted.",
    className:
      "rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 py-2 text-sm font-semibold text-purple-300 hover:bg-purple-500/20 disabled:cursor-not-allowed disabled:opacity-50",
  },
  {
    type: "full",
    label: "🔴 Full",
    successMessage: "Full-capacity report submitted.",
    className:
      "rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50",
  },
  {
    type: "correction",
    label: "⚠️ Time incorrect",
    successMessage: "Time correction report submitted.",
    className:
      "rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-sm font-semibold text-yellow-400 hover:bg-yellow-500/20 disabled:cursor-not-allowed disabled:opacity-50",
  },
  {
    type: "parking_full",
    label: "🚗 Parking full",
    successMessage: "Parking full report submitted.",
    className:
      "rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-2 text-sm font-semibold text-orange-300 hover:bg-orange-500/20 disabled:cursor-not-allowed disabled:opacity-50",
  },
  {
    type: "jumuah_first",
    label: "🕌 1st Jumu’ah",
    successMessage: "1st Jumu’ah report submitted.",
    className:
      "rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-300 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50",
  },
  {
    type: "jumuah_second",
    label: "🕌 2nd Jumu’ah",
    successMessage: "2nd Jumu’ah report submitted.",
    className:
      "rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-300 hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50",
  },
  {
    type: "jumuah_third",
    label: "🕌 3rd Jumu’ah",
    successMessage: "3rd Jumu’ah report submitted.",
    className:
      "rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-2 text-sm font-semibold text-indigo-300 hover:bg-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-50",
  },
];

export default function MosqueLiveReporter({ mosqueId }: Props) {
  const [loadingType, setLoadingType] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function send(reportType: ReportButton["type"], successMessage: string) {
    try {
      setLoadingType(reportType);
      setMessage("");
      setErrorMessage("");

      const res = await fetch("/api/mosque/report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mosque_id: mosqueId,
          report_type: reportType,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as ApiResponse;

      if (!res.ok) {
        if (res.status === 429) {
          setErrorMessage(
            data.error ??
              "You have sent too many reports recently. Please wait and try again."
          );
          return;
        }

        if (res.status === 400) {
          setErrorMessage(data.error ?? "Your report could not be accepted.");
          return;
        }

        if (res.status === 404) {
          setErrorMessage(data.error ?? "This mosque could not be found.");
          return;
        }

        setErrorMessage(data.error ?? "Could not submit report.");
        return;
      }

      setMessage(successMessage);

      window.setTimeout(() => {
        window.location.reload();
      }, 700);
    } catch {
      setErrorMessage("Something went wrong while submitting your report.");
    } finally {
      setLoadingType(null);
    }
  }

  function isLoading(type: ReportButton["type"]) {
    return loadingType === type;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {REPORT_BUTTONS.map((button) => (
          <button
            key={button.type}
            type="button"
            onClick={() => send(button.type, button.successMessage)}
            disabled={!!loadingType}
            className={button.className}
          >
            {isLoading(button.type) ? "Sending..." : button.label}
          </button>
        ))}
      </div>

      <div className="text-xs text-white/50">
        Community reports help surface live mosque activity. Repeated duplicate
        reports are rate-limited.
      </div>

      {message ? (
        <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-200">
          {message}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {errorMessage}
        </div>
      ) : null}
    </div>
  );
}

