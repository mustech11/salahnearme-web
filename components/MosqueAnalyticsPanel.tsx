"use client";

import { useEffect, useMemo, useState } from "react";

type MosqueAnalyticsSummary = {
  ok?: boolean;
  error?: string;
  mosque?: {
    id: string;
    name: string | null;
    slug: string | null;
    city: string | null;
    area: string | null;
    postcode: string | null;
  };
  period?: {
    days: number;
    start_date: string;
    end_date: string;
  };
  summary?: {
    days: number;
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
    top_sources: {
      source: string;
      count: number;
    }[];
    daily_breakdown: {
      date: string;
      impressions: number;
      best_shown: number;
      profile_clicks: number;
      maps_clicks: number;
      timetable_clicks: number;
      total_clicks: number;
    }[];
  };
};

type Props = {
  mosqueId: string;
  initialDays?: number;
};

function formatNumber(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "0";
  }

  return new Intl.NumberFormat("en-GB").format(value);
}

function formatPercent(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "0%";
  }

  return `${value}%`;
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function MosqueAnalyticsPanel({
  mosqueId,
  initialDays = 30,
}: Props) {
  const [days, setDays] = useState(initialDays);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [data, setData] = useState<MosqueAnalyticsSummary | null>(null);

  const summary = data?.summary;

  const maxDailyValue = useMemo(() => {
    const values =
      summary?.daily_breakdown.map((day) =>
        Math.max(day.impressions, day.best_shown, day.total_clicks)
      ) ?? [];

    return Math.max(...values, 1);
  }, [summary]);

  useEffect(() => {
    let cancelled = false;

    async function loadAnalytics() {
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
            days,
          }),
        });

        const json = (await res.json().catch(() => ({}))) as MosqueAnalyticsSummary;

        if (cancelled) {
          return;
        }

        if (!res.ok || !json.ok) {
          setErrorMessage(json.error ?? "Could not load mosque analytics.");
          setData(null);
          return;
        }

        setData(json);
      } catch {
        if (!cancelled) {
          setErrorMessage("Could not load mosque analytics.");
          setData(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadAnalytics();

    return () => {
      cancelled = true;
    };
  }, [mosqueId, days]);

  return (
    <section className="rounded-3xl border border-yellow-500/20 bg-black/30 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
            Mosque analytics
          </div>

          <h2 className="mt-2 text-2xl font-black text-white">
            Pray Near Me performance
          </h2>

          <p className="mt-2 max-w-2xl text-sm text-white/60">
            See how often this mosque appears in Pray Near Me searches and how
            users engage with the mosque profile, map, and timetable.
          </p>
        </div>

        <select
          value={days}
          onChange={(event) => setDays(Number(event.target.value))}
          className="rounded-xl border border-yellow-500/20 bg-black px-4 py-3 text-sm font-semibold text-white outline-none"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={365}>Last 365 days</option>
        </select>
      </div>

      {loading ? (
        <div className="mt-6 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm text-yellow-100">
          Loading mosque analytics…
        </div>
      ) : null}

      {errorMessage ? (
        <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
          {errorMessage}
        </div>
      ) : null}

      {!loading && !errorMessage && summary ? (
        <>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="Impressions"
              value={formatNumber(summary.totals.impressions)}
              detail="Shown in Pray Near Me results"
            />

            <MetricCard
              title="Best option shown"
              value={formatNumber(summary.totals.best_shown)}
              detail={`${formatPercent(
                summary.rates.best_shown_rate
              )} of impressions`}
            />

            <MetricCard
              title="Total clicks"
              value={formatNumber(summary.totals.total_clicks)}
              detail={`${formatPercent(
                summary.rates.engagement_rate
              )} engagement rate`}
            />

            <MetricCard
              title="Average Salah Score"
              value={
                summary.quality.average_salah_score === null
                  ? "—"
                  : formatNumber(summary.quality.average_salah_score)
              }
              detail="Average score when shown"
            />
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <MetricCard
              title="Profile clicks"
              value={formatNumber(summary.totals.profile_clicks)}
              detail={`${formatPercent(
                summary.rates.profile_click_rate
              )} profile click rate`}
            />

            <MetricCard
              title="Map clicks"
              value={formatNumber(summary.totals.maps_clicks)}
              detail={`${formatPercent(
                summary.rates.maps_click_rate
              )} map click rate`}
            />

            <MetricCard
              title="Timetable clicks"
              value={formatNumber(summary.totals.timetable_clicks)}
              detail={`${formatPercent(
                summary.rates.timetable_click_rate
              )} timetable click rate`}
            />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
              <div className="text-sm font-bold text-white">
                Daily activity
              </div>

              {summary.daily_breakdown.length === 0 ? (
                <p className="mt-4 text-sm text-white/50">
                  No daily activity in this period yet.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {summary.daily_breakdown.slice(-14).map((day) => {
                    const impressionsWidth =
                      (day.impressions / maxDailyValue) * 100;
                    const clicksWidth = (day.total_clicks / maxDailyValue) * 100;

                    return (
                      <div key={day.date}>
                        <div className="mb-1 flex justify-between gap-3 text-xs text-white/50">
                          <span>{formatDate(day.date)}</span>
                          <span>
                            {day.impressions} shown • {day.total_clicks} clicks
                          </span>
                        </div>

                        <div className="overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-2 rounded-full bg-yellow-500"
                            style={{
                              width: `${Math.max(impressionsWidth, 3)}%`,
                            }}
                          />
                        </div>

                        <div className="mt-1 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-2 rounded-full bg-emerald-500"
                            style={{
                              width:
                                day.total_clicks > 0
                                  ? `${Math.max(clicksWidth, 3)}%`
                                  : "0%",
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
              <div className="text-sm font-bold text-white">Top sources</div>

              {summary.top_sources.length === 0 ? (
                <p className="mt-4 text-sm text-white/50">
                  No sources recorded yet.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {summary.top_sources.map((source) => (
                    <div
                      key={source.source}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-4 py-3"
                    >
                      <span className="text-sm text-white/70">
                        {source.source}
                      </span>

                      <span className="rounded-full border border-yellow-500/20 bg-yellow-500/10 px-3 py-1 text-xs font-bold text-yellow-300">
                        {source.count}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-5 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-xs text-yellow-100">
                Engagement rate can be over 100% during testing if you click
                multiple times after a small number of impressions.
              </div>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}

function MetricCard({
  title,
  value,
  detail,
}: {
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
      <div className="text-xs uppercase tracking-[0.18em] text-white/40">
        {title}
      </div>

      <div className="mt-3 text-3xl font-black text-white">{value}</div>

      <div className="mt-2 text-xs text-white/50">{detail}</div>
    </div>
  );
}

