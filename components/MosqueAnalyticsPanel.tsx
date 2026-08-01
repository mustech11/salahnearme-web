"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

type AnalyticsDays = 7 | 30 | 90 | 365;

type DailyBreakdownRow = {
  date: string;
  impressions: number;
  best_shown: number;
  profile_clicks: number;
  maps_clicks: number;
  timetable_clicks: number;
  total_clicks: number;
};

type MosqueAnalyticsSummary = {
  ok?: boolean;
  error?: string;
  message?: string;
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
    daily_breakdown: DailyBreakdownRow[];
  };
};

type Props = {
  mosqueId: string;
  initialDays?: number;
};

type LoadState = "loading" | "success" | "error";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const REQUEST_TIMEOUT_MS = 20_000;
const ALLOWED_DAYS = new Set<AnalyticsDays>([7, 30, 90, 365]);

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normaliseDays(value: number | string | null | undefined): AnalyticsDays {
  const parsed = Number(value);
  return ALLOWED_DAYS.has(parsed as AnalyticsDays)
    ? (parsed as AnalyticsDays)
    : 30;
}

function normaliseMetric(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, value)
    : 0;
}

function formatNumber(value: number | null | undefined): string {
  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 1,
  }).format(normaliseMetric(value));
}

function formatPercent(value: number | null | undefined): string {
  return `${formatNumber(value)}%`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

function formatLongDate(value: string | null | undefined): string {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatSource(value: string): string {
  const cleaned = cleanString(value);
  if (!cleaned) return "Unknown";

  return cleaned
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

async function readResponse(
  response: Response
): Promise<MosqueAnalyticsSummary> {
  try {
    const value: unknown = await response.json();

    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }

    return value as MosqueAnalyticsSummary;
  } catch {
    return {};
  }
}

function calculateChange(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? 100 : null;
  return ((current - previous) / previous) * 100;
}

function splitPeriod(rows: DailyBreakdownRow[]) {
  if (rows.length < 2) {
    return {
      current: rows,
      previous: [] as DailyBreakdownRow[],
    };
  }

  const midpoint = Math.floor(rows.length / 2);

  return {
    previous: rows.slice(0, midpoint),
    current: rows.slice(midpoint),
  };
}

function sumRows(
  rows: DailyBreakdownRow[],
  key: keyof Omit<DailyBreakdownRow, "date">
): number {
  return rows.reduce((total, row) => total + normaliseMetric(row[key]), 0);
}

export default function MosqueAnalyticsPanel({
  mosqueId,
  initialDays = 30,
}: Props) {
  const headingId = useId();
  const statusId = useId();
  const periodInputId = useId();

  const abortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  const cleanMosqueId = useMemo(() => cleanString(mosqueId), [mosqueId]);
  const [days, setDays] = useState<AnalyticsDays>(
    normaliseDays(initialDays)
  );
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [data, setData] = useState<MosqueAnalyticsSummary | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const summary = data?.summary;

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, []);

  const allDailyRows = useMemo(() => {
    return [...(summary?.daily_breakdown ?? [])]
      .filter((row) => typeof row.date === "string" && row.date.length > 0)
      .sort((first, second) => first.date.localeCompare(second.date));
  }, [summary]);

  const visibleDailyRows = useMemo(
    () => allDailyRows.slice(-14),
    [allDailyRows]
  );

  const maxDailyValue = useMemo(() => {
    let maximum = 1;

    for (const day of visibleDailyRows) {
      maximum = Math.max(
        maximum,
        normaliseMetric(day.impressions),
        normaliseMetric(day.best_shown),
        normaliseMetric(day.total_clicks)
      );
    }

    return maximum;
  }, [visibleDailyRows]);

  const trendSummary = useMemo(() => {
    const { current, previous } = splitPeriod(allDailyRows);

    const currentImpressions = sumRows(current, "impressions");
    const previousImpressions = sumRows(previous, "impressions");
    const currentClicks = sumRows(current, "total_clicks");
    const previousClicks = sumRows(previous, "total_clicks");

    return {
      impressions: calculateChange(currentImpressions, previousImpressions),
      clicks: calculateChange(currentClicks, previousClicks),
    };
  }, [allDailyRows]);

  const loadAnalytics = useCallback(async () => {
    if (!UUID_REGEX.test(cleanMosqueId)) {
      setLoadState("error");
      setData(null);
      setErrorMessage("A valid mosque is required to load analytics.");
      return;
    }

    abortControllerRef.current?.abort();

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let timedOut = false;
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    setLoadState("loading");
    setErrorMessage("");

    try {
      const response = await fetch("/api/mosque/analytics-summary", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
        body: JSON.stringify({
          mosque_id: cleanMosqueId,
          days,
        }),
      });

      const json = await readResponse(response);

      if (!mountedRef.current) return;

      if (!response.ok || json.ok !== true || !json.summary) {
        setLoadState("error");
        setData(null);
        setErrorMessage(
          cleanString(json.error) ||
            cleanString(json.message) ||
            "Could not load mosque analytics."
        );
        return;
      }

      setData(json);
      setLastUpdatedAt(new Date());
      setErrorMessage("");
      setLoadState("success");
    } catch (error) {
      if (!mountedRef.current) return;

      setLoadState("error");
      setData(null);

      if (error instanceof DOMException && error.name === "AbortError") {
        setErrorMessage(
          timedOut
            ? "The analytics request timed out. Please try again."
            : "The analytics request was cancelled."
        );
        return;
      }

      console.error("Mosque analytics load failed:", error);
      setErrorMessage("Could not load mosque analytics.");
    } finally {
      window.clearTimeout(timeoutId);

      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  }, [cleanMosqueId, days]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  const mosqueName = cleanString(data?.mosque?.name) || "Mosque";
  const location = [data?.mosque?.area, data?.mosque?.city, data?.mosque?.postcode]
    .map(cleanString)
    .filter(Boolean)
    .join(" • ");

  return (
    <section
      aria-labelledby={headingId}
      className="overflow-hidden rounded-3xl border border-yellow-500/20 bg-black/30 shadow-2xl shadow-black/20"
    >
      <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(234,179,8,0.16),transparent_42%)] p-6 md:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
              Mosque analytics
            </div>

            <h2
              id={headingId}
              className="mt-2 text-2xl font-black tracking-tight text-white md:text-3xl"
            >
              Pray Near Me performance
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">
              Monitor how often {mosqueName} appears in discovery results and
              how visitors engage with its profile, directions and timetable.
            </p>

            {location ? (
              <p className="mt-2 text-xs font-medium text-white/40">
                {location}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div>
              <label htmlFor={periodInputId} className="sr-only">
                Analytics period
              </label>

              <select
                id={periodInputId}
                value={days}
                onChange={(event) =>
                  setDays(normaliseDays(event.target.value))
                }
                disabled={loadState === "loading"}
                className="min-h-11 rounded-xl border border-yellow-500/20 bg-black px-4 py-3 text-sm font-semibold text-white outline-none transition focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 disabled:cursor-wait disabled:opacity-60"
              >
                <option value={7}>Last 7 days</option>
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 90 days</option>
                <option value={365}>Last 365 days</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => void loadAnalytics()}
              disabled={loadState === "loading"}
              className="min-h-11 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white transition hover:border-yellow-500/30 hover:bg-yellow-500/10 hover:text-yellow-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 disabled:cursor-wait disabled:opacity-50"
            >
              {loadState === "loading" ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>

        {data?.period ? (
          <div className="mt-5 flex flex-wrap gap-2 text-xs text-white/45">
            <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1.5">
              {formatLongDate(data.period.start_date)} –{" "}
              {formatLongDate(data.period.end_date)}
            </span>

            {lastUpdatedAt ? (
              <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1.5">
                Refreshed{" "}
                {new Intl.DateTimeFormat("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(lastUpdatedAt)}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="p-6 md:p-8">
        <div id={statusId} aria-live="polite" aria-atomic="true">
          {loadState === "loading" ? <AnalyticsLoadingState /> : null}

          {loadState === "error" ? (
            <div
              role="alert"
              className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5"
            >
              <p className="text-sm leading-6 text-red-200">{errorMessage}</p>

              <button
                type="button"
                onClick={() => void loadAnalytics()}
                className="mt-3 rounded-xl border border-red-400/30 px-4 py-2 text-xs font-bold text-red-200 transition hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
              >
                Retry analytics
              </button>
            </div>
          ) : null}
        </div>

        {loadState === "success" && summary ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                title="Impressions"
                value={formatNumber(summary.totals.impressions)}
                detail="Shown in Pray Near Me results"
                trend={trendSummary.impressions}
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
                trend={trendSummary.clicks}
              />

              <MetricCard
                title="Average Salah Score"
                value={
                  summary.quality.average_salah_score === null
                    ? "—"
                    : formatNumber(summary.quality.average_salah_score)
                }
                detail="Average ranking score when shown"
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

            <div className="mt-6 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
              <DailyActivityPanel
                rows={visibleDailyRows}
                maxDailyValue={maxDailyValue}
              />

              <TopSourcesPanel sources={summary.top_sources ?? []} />
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}

function AnalyticsLoadingState() {
  return (
    <div>
      <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm text-yellow-100">
        Loading mosque analytics…
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            aria-hidden="true"
            className="animate-pulse rounded-2xl border border-white/10 bg-black/30 p-5"
          >
            <div className="h-3 w-24 rounded bg-white/10" />
            <div className="mt-4 h-8 w-16 rounded bg-white/10" />
            <div className="mt-3 h-3 w-32 rounded bg-white/10" />
          </div>
        ))}
      </div>
    </div>
  );
}

function DailyActivityPanel({
  rows,
  maxDailyValue,
}: {
  rows: DailyBreakdownRow[];
  maxDailyValue: number;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-black/30 p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-sm font-bold text-white">Daily activity</h3>
          <p className="mt-1 text-xs text-white/45">
            Latest {Math.min(rows.length, 14)} recorded days
          </p>
        </div>

        <div className="flex flex-wrap gap-4 text-xs text-white/50">
          <span className="inline-flex items-center gap-2">
            <span className="size-2 rounded-full bg-yellow-500" />
            Impressions
          </span>

          <span className="inline-flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-500" />
            Clicks
          </span>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-white/50">
          No daily activity in this period yet.
        </p>
      ) : (
        <div className="mt-5 space-y-4">
          {rows.map((day) => {
            const impressions = normaliseMetric(day.impressions);
            const clicks = normaliseMetric(day.total_clicks);
            const impressionsWidth = (impressions / maxDailyValue) * 100;
            const clicksWidth = (clicks / maxDailyValue) * 100;

            return (
              <div key={day.date}>
                <div className="mb-1.5 flex flex-col gap-1 text-xs text-white/50 sm:flex-row sm:justify-between">
                  <time dateTime={day.date}>{formatDate(day.date)}</time>

                  <span>
                    {formatNumber(impressions)} shown • {formatNumber(clicks)}{" "}
                    clicks
                  </span>
                </div>

                <div
                  aria-label={`${formatNumber(impressions)} impressions`}
                  className="overflow-hidden rounded-full bg-white/10"
                >
                  <div
                    className="h-2 rounded-full bg-yellow-500 transition-[width] duration-500"
                    style={{
                      width:
                        impressions > 0
                          ? `${Math.max(impressionsWidth, 3)}%`
                          : "0%",
                    }}
                  />
                </div>

                <div
                  aria-label={`${formatNumber(clicks)} clicks`}
                  className="mt-1.5 overflow-hidden rounded-full bg-white/10"
                >
                  <div
                    className="h-2 rounded-full bg-emerald-500 transition-[width] duration-500"
                    style={{
                      width:
                        clicks > 0 ? `${Math.max(clicksWidth, 3)}%` : "0%",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}

function TopSourcesPanel({
  sources,
}: {
  sources: NonNullable<MosqueAnalyticsSummary["summary"]>["top_sources"];
}) {
  const safeSources = [...sources]
    .filter(
      (source) =>
        typeof source.source === "string" &&
        typeof source.count === "number" &&
        Number.isFinite(source.count)
    )
    .sort((first, second) => second.count - first.count)
    .slice(0, 10);

  const maximum = Math.max(
    ...safeSources.map((source) => normaliseMetric(source.count)),
    1
  );

  return (
    <article className="rounded-2xl border border-white/10 bg-black/30 p-5">
      <h3 className="text-sm font-bold text-white">Top discovery sources</h3>
      <p className="mt-1 text-xs text-white/45">
        Where visitors discovered this mosque
      </p>

      {safeSources.length === 0 ? (
        <p className="mt-4 text-sm text-white/50">No sources recorded yet.</p>
      ) : (
        <div className="mt-5 space-y-3">
          {safeSources.map((source, index) => {
            const width =
              (normaliseMetric(source.count) / maximum) * 100;

            return (
              <div
                key={`${source.source}-${index}`}
                className="rounded-xl border border-white/10 bg-black/30 px-4 py-3"
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="min-w-0 truncate text-sm text-white/70">
                    {formatSource(source.source)}
                  </span>

                  <span className="shrink-0 text-xs font-bold text-yellow-300">
                    {formatNumber(source.count)}
                  </span>
                </div>

                <div className="mt-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-1.5 rounded-full bg-yellow-500"
                    style={{
                      width:
                        source.count > 0 ? `${Math.max(width, 4)}%` : "0%",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-5 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-xs leading-5 text-yellow-100">
        Engagement can exceed 100% when one visitor completes several tracked
        actions after a single impression.
      </div>
    </article>
  );
}

function MetricCard({
  title,
  value,
  detail,
  trend,
}: {
  title: string;
  value: string;
  detail: string;
  trend?: number | null;
}) {
  const trendLabel =
    trend === null || trend === undefined
      ? null
      : `${trend >= 0 ? "+" : ""}${formatNumber(trend)}%`;

  return (
    <article className="rounded-2xl border border-white/10 bg-black/30 p-5 transition hover:border-yellow-500/20 hover:bg-black/40">
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs uppercase tracking-[0.18em] text-white/40">
          {title}
        </div>

        {trendLabel ? (
          <span
            className={`rounded-full border px-2 py-1 text-[10px] font-bold ${
              (trend ?? 0) >= 0
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                : "border-red-500/20 bg-red-500/10 text-red-300"
            }`}
          >
            {trendLabel}
          </span>
        ) : null}
      </div>

      <div className="mt-3 text-3xl font-black text-white">{value}</div>
      <div className="mt-2 text-xs leading-5 text-white/50">{detail}</div>
    </article>
  );
}