"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type AnalyticsSummaryResponse = {
  ok?: boolean;
  error?: string;
  summary?: {
    totals: {
      impressions: number;
      best_shown: number;
      profile_clicks: number;
      maps_clicks: number;
      timetable_clicks: number;
      total_clicks: number;
    };
    rates: {
      engagement_rate: number;
      profile_click_rate: number;
      maps_click_rate: number;
      timetable_click_rate: number;
      best_shown_rate: number;
    };
    quality: {
      average_salah_score: number | null;
    };
  };
};

type Props = {
  mosqueId: string;
};

function formatNumber(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "0";
  }

  return new Intl.NumberFormat("en-GB").format(value);
}

function formatScore(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "—";
  }

  return String(value);
}

export default function MosqueAnalyticsPreviewCard({ mosqueId }: Props) {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [data, setData] = useState<AnalyticsSummaryResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPreview() {
      try {
        setLoading(true);
        setErrorMessage("");

        const res = await fetch("/api/mosque/analytics-summary", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          cache: "no-store",
          body: JSON.stringify({
            mosque_id: mosqueId,
            days: 30,
          }),
        });

        const json = (await res.json().catch(() => ({}))) as AnalyticsSummaryResponse;

        if (cancelled) {
          return;
        }

        if (!res.ok || !json.ok) {
          setErrorMessage(json.error ?? "Could not load preview.");
          setData(null);
          return;
        }

        setData(json);
      } catch {
        if (!cancelled) {
          setErrorMessage("Could not load preview.");
          setData(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadPreview();

    return () => {
      cancelled = true;
    };
  }, [mosqueId]);

  const summary = data?.summary;

  return (
    <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-emerald-300">
            Pray Near Me preview
          </div>

          <p className="mt-1 text-xs text-white/50">
            Last 30 days mosque journey activity.
          </p>
        </div>

        <Link
          href={`/business-dashboard/mosques/${mosqueId}/analytics`}
          className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20"
        >
          Full analytics
        </Link>
      </div>

      {loading ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <PreviewSkeleton />
          <PreviewSkeleton />
          <PreviewSkeleton />
          <PreviewSkeleton />
        </div>
      ) : null}

      {!loading && errorMessage ? (
        <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-200">
          {errorMessage}
        </div>
      ) : null}

      {!loading && !errorMessage && summary ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <PreviewMetric
            label="Shown"
            value={formatNumber(summary.totals.impressions)}
          />

          <PreviewMetric
            label="Best shown"
            value={formatNumber(summary.totals.best_shown)}
          />

          <PreviewMetric
            label="Clicks"
            value={formatNumber(summary.totals.total_clicks)}
          />

          <PreviewMetric
            label="Avg score"
            value={formatScore(summary.quality.average_salah_score)}
          />
        </div>
      ) : null}
    </div>
  );
}

function PreviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-3">
      <div className="text-[11px] uppercase tracking-[0.16em] text-white/40">
        {label}
      </div>

      <div className="mt-2 text-2xl font-black text-white">{value}</div>
    </div>
  );
}

function PreviewSkeleton() {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-3">
      <div className="h-3 w-20 rounded bg-white/10" />
      <div className="mt-3 h-7 w-10 rounded bg-white/10" />
    </div>
  );
}

