"use client";

import { useState } from "react";

type Props = {
  mosqueId: string;
  mosqueName?: string | null;
  mosqueSlug?: string | null;
  source?: string;
};

type SubmitState = "idle" | "submitting" | "success" | "error";

const REPORT_TYPES = [
  {
    value: "prayer_time_wrong",
    label: "Prayer time is wrong",
  },
  {
    value: "iqamah_missing",
    label: "Iqamah time is missing",
  },
  {
    value: "jumuah_time_wrong",
    label: "Jumuʿah time is wrong",
  },
  {
    value: "location_wrong",
    label: "Mosque location is wrong",
  },
  {
    value: "facilities_wrong",
    label: "Facilities are incorrect",
  },
  {
    value: "mosque_closed_or_moved",
    label: "Mosque is closed or moved",
  },
  {
    value: "duplicate_mosque",
    label: "Duplicate mosque listing",
  },
  {
    value: "other",
    label: "Other issue",
  },
];

function getSourceLabel(source: string) {
  if (source === "mosque_timetable_page") {
    return "Monthly timetable page";
  }

  if (source === "mosque_page") {
    return "Mosque profile page";
  }

  return "SalahNearMe page";
}

export default function MosqueCorrectionReportForm({
  mosqueId,
  mosqueName,
  mosqueSlug,
  source = "mosque_page",
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [reportType, setReportType] = useState(REPORT_TYPES[0].value);
  const [message, setMessage] = useState("");
  const [reporterName, setReporterName] = useState("");
  const [reporterEmail, setReporterEmail] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function submitReport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSubmitState("submitting");
    setErrorMessage("");

    try {
      const pageUrl =
        typeof window !== "undefined" ? window.location.href : null;

      const res = await fetch("/api/mosque/correction-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mosque_id: mosqueId,
          report_type: reportType,
          report_message: message,
          reporter_name: reporterName,
          reporter_email: reporterEmail,
          page_url: pageUrl,
          metadata: {
            source,
            source_label: getSourceLabel(source),
            mosque_name: mosqueName,
            mosque_slug: mosqueSlug,
          },
        }),
      });

      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };

      if (!res.ok || !json.ok) {
        setSubmitState("error");
        setErrorMessage(json.error ?? "Could not submit report.");
        return;
      }

      setSubmitState("success");
      setMessage("");
      setReporterName("");
      setReporterEmail("");
      setReportType(REPORT_TYPES[0].value);
      setIsOpen(false);
    } catch {
      setSubmitState("error");
      setErrorMessage("Could not submit report.");
    }
  }

  const canSubmit = submitState !== "submitting" && message.trim().length >= 5;

  return (
    <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-5 md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-yellow-400">
            Help improve this mosque page
          </div>

          <h2 className="mt-2 text-2xl font-black text-white">
            Report incorrect mosque data
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-7 text-white/55">
            If a prayer time, Jumuʿah time, location, or facility is incorrect,
            submit a correction. Reports help mosque managers and admins improve
            SalahNearMe data quality.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          className="w-fit rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-5 py-3 text-sm font-black text-yellow-300 hover:bg-yellow-500/20"
        >
          {isOpen ? "Close report form" : "Report an issue"}
        </button>
      </div>

      {submitState === "success" ? (
        <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
          JazakAllahu khayran. Your correction report has been submitted.
        </div>
      ) : null}

      {submitState === "error" ? (
        <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-100">
          {errorMessage}
        </div>
      ) : null}

      {!isOpen ? (
        <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm leading-7 text-white/50">
          Reports are reviewed before public data is changed. Urgent prayer
          timing matters should still be confirmed directly with the mosque.
        </div>
      ) : (
        <form onSubmit={submitReport} className="mt-6 grid gap-4">
          <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
            <div>
              <label className="text-sm font-bold text-white/80">
                What needs correcting?
              </label>

              <select
                value={reportType}
                onChange={(event) => setReportType(event.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-yellow-500/50"
              >
                {REPORT_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-bold text-white/80">
                Source
              </label>

              <div className="mt-2 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/60">
                {getSourceLabel(source)}
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm font-bold text-white/80">
              Describe the issue
            </label>

            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={5}
              required
              minLength={5}
              maxLength={2000}
              placeholder="Example: Isha iqamah is 8:45pm, not 8:30pm. The mosque poster confirms it."
              className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-yellow-500/50"
            />

            <div className="mt-2 text-xs text-white/35">
              Minimum 5 characters. Maximum 2000 characters.
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-bold text-white/80">
                Your name optional
              </label>

              <input
                value={reporterName}
                onChange={(event) => setReporterName(event.target.value)}
                maxLength={120}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-yellow-500/50"
                placeholder="Optional"
              />
            </div>

            <div>
              <label className="text-sm font-bold text-white/80">
                Email optional
              </label>

              <input
                value={reporterEmail}
                onChange={(event) => setReporterEmail(event.target.value)}
                maxLength={160}
                type="email"
                className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-yellow-500/50"
                placeholder="Optional, for follow-up"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded-xl bg-yellow-500 px-5 py-3 text-sm font-black text-black hover:bg-yellow-400 disabled:opacity-50"
            >
              {submitState === "submitting"
                ? "Submitting..."
                : "Submit correction"}
            </button>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white/70 hover:bg-white/10"
            >
              Cancel
            </button>

            <p className="text-xs leading-6 text-white/40">
              Reports are reviewed before public data is changed.
            </p>
          </div>
        </form>
      )}
    </section>
  );
}

