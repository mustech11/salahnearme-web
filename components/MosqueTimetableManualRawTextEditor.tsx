"use client";

import { useState } from "react";

type Props = {
  importId: string;
  initialRawText?: string | null;
};

export default function MosqueTimetableManualRawTextEditor({
  importId,
  initialRawText,
}: Props) {
  const [open, setOpen] = useState(false);
  const [rawText, setRawText] = useState(initialRawText ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function saveRawText() {
    try {
      setSaving(true);
      setMessage("");
      setErrorMessage("");

      const res = await fetch("/api/mosque/timetable-imports/manual-raw-text", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          import_id: importId,
          raw_text: rawText,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        raw_text_length?: number;
      };

      if (!res.ok || !data.ok) {
        setErrorMessage(data.error ?? "Could not save raw text.");
        return;
      }

      setMessage(
        `Raw timetable text saved. ${
          data.raw_text_length ?? rawText.length
        } characters stored. Refresh, then click Parse timetable.`
      );
    } catch {
      setErrorMessage("Could not save raw text.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-bold text-white hover:bg-white/10"
      >
        {open ? "Hide manual paste" : "Paste raw timetable text"}
      </button>

      {open ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/40 p-4">
          <div className="text-sm font-bold text-yellow-400">
            Manual timetable text
          </div>

          <p className="mt-2 text-xs text-white/50">
            Paste timetable text copied from a mosque website, PDF, image OCR,
            WhatsApp message, spreadsheet, or document. After saving, use Parse
            timetable.
          </p>

          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            rows={10}
            placeholder={`Example:\n1 Fajr 03:15 04:15 Sunrise 04:40 Dhuhr 13:15 14:00 Asr 17:15 18:00 Maghrib 21:35 21:35 Isha 22:40 23:00\n2 Fajr 03:14 04:15 Sunrise 04:39 Dhuhr 13:15 14:00 Asr 17:16 18:00 Maghrib 21:36 21:36 Isha 22:41 23:00`}
            className="mt-4 w-full rounded-2xl border border-yellow-500/20 bg-black p-4 font-mono text-xs text-white outline-none focus:border-yellow-400"
          />

          <div className="mt-3 text-xs text-white/40">
            Characters: {rawText.trim().length}
          </div>

          <button
            type="button"
            onClick={saveRawText}
            disabled={saving}
            className="mt-4 rounded-xl bg-yellow-500 px-4 py-2 text-xs font-bold text-black hover:bg-yellow-400 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save raw text"}
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
      ) : null}
    </div>
  );
}

