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

type LoadState =
  | "loading"
  | "success"
  | "error";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const REQUEST_TIMEOUT_MS = 20_000;

const ALLOWED_DAYS = new Set<AnalyticsDays>([
  7,
  30,
  90,
  365,
]);

function cleanString(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function normaliseDays(
  value: number | string | null | undefined
): AnalyticsDays {
  const parsed = Number(value);

  return ALLOWED_DAYS.has(
    parsed as AnalyticsDays
  )
    ? (parsed as AnalyticsDays)
    : 30;
}

function normaliseMetric(
  value: number | null | undefined
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return 0;
  }

  return Math.max(0, value);
}

function formatNumber(
  value: number | null | undefined
): string {
  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 1,
  }).format(normaliseMetric(value));
}

function formatPercent(
  value: number | null | undefined
): string {
  return `${new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 1,
  }).format(normaliseMetric(value))}%`;
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

function formatSource(value: string): string {
  const cleaned = cleanString(value);

  if (!cleaned) {
    return "Unknown";
  }

  return cleaned
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}

async function readResponse(
  response: Response
): Promise<MosqueAnalyticsSummary> {
  try {
    const value: unknown = await response.json();

    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value)
    ) {
      return {};
    }

    return value as MosqueAnalyticsSummary;
  } catch {
    return {};
  }
}

export default function MosqueAnalyticsPanel({
  mosqueId,
  initialDays = 30,
}: Props) {
  const statusId = useId();
  const periodInputId = useId();

  const abortControllerRef =
    useRef<AbortController | null>(null);

  const mountedRef = useRef(true);

  const cleanMosqueId = useMemo(
    () => cleanString(mosqueId),
    [mosqueId]
  );

  const [days, setDays] =
    useState<AnalyticsDays>(
      normaliseDays(initialDays)
    );

  const [loadState, setLoadState] =
    useState<LoadState>("loading");

  const [errorMessage, setErrorMessage] =
    useState("");

  const [data, setData] =
    useState<MosqueAnalyticsSummary | null>(null);

  const summary = data?.summary;

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, []);

  const dailyRows = useMemo(() => {
    const rows =
      summary?.daily_breakdown ?? [];

    return [...rows]
      .filter(
        (row) =>
          typeof row.date === "string" &&
          row.date.length > 0
      )
      .sort((first, second) =>
        first.date.localeCompare(second.date)
      )
      .slice(-14);
  }, [summary]);

  const maxDailyValue = useMemo(() => {
    let maximum = 1;

    for (const day of dailyRows) {
      maximum = Math.max(
        maximum,
        normaliseMetric(day.impressions),
        normaliseMetric(day.best_shown),
        normaliseMetric(day.total_clicks)
      );
    }

    return maximum;
  }, [dailyRows]);

  const loadAnalytics = useCallback(async () => {
    if (!UUID_REGEX.test(cleanMosqueId)) {
      setLoadState("error");
      setData(null);
      setErrorMessage(
        "A valid mosque is required to load analytics."
      );
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
      const response = await fetch(
        "/api/mosque/analytics-summary",
        {
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
        }
      );

      const json = await readResponse(response);

      if (!mountedRef.current) {
        return;
      }

      if (
        !response.ok ||
        json.ok !== true ||
        !json.summary
      ) {
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
      setErrorMessage("");
      setLoadState("success");
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }

      setLoadState("error");
      setData(null);

      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        setErrorMessage(
          timedOut
            ? "The analytics request timed out. Please try again."
            : "The analytics request was cancelled."
        );
        return;
      }

      console.error(
        "Mosque analytics load failed:",
        error
      );

      setErrorMessage(
        "Could not load mosque analytics."
      );
    } finally {
      window.clearTimeout(timeoutId);

      if (
        abortControllerRef.current === controller
      ) {
        abortControllerRef.current = null;
      }
    }
  }, [cleanMosqueId, days]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  return (
    <section
      aria-labelledby={`${statusId}-heading`}
      className="rounded-3xl border border-yellow-500/20 bg-black/30 p-6"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
            Mosque analytics
          </div>

          <h2
            id={`${statusId}-heading`}
            className="mt-2 text-2xl font-black text-white"
          >
            Pray Near Me performance
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">
            See how often this mosque appears in Pray Near Me
            searches and how visitors engage with its profile,
            directions and timetable.
          </p>
        </div>

        <div>
          <label
            htmlFor={periodInputId}
            className="sr-only"
          >
            Analytics period
          </label>

          <select
            id={periodInputId}
            value={days}
            onChange={(event) =>
              setDays(
                normaliseDays(
                  event.target.value
                )
              )
            }
            disabled={loadState === "loading"}
            className="rounded-xl border border-yellow-500/20 bg-black px-4 py-3 text-sm font-semibold text-white outline-none transition focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/30 disabled:opacity-60"
          >
            <option value={7}>
              Last 7 days
            </option>
            <option value={30}>
              Last 30 days
            </option>
            <option value={90}>
              Last 90 days
            </option>
            <option value={365}>
              Last 365 days
            </option>
          </select>
        </div>
      </div>

      <div
        id={statusId}
        aria-live="polite"
        aria-atomic="true"
      >
        {loadState === "loading" ? (
          <AnalyticsLoadingState />
        ) : null}

        {loadState === "error" ? (
          <div
            role="alert"
            className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-4"
          >
            <p className="text-sm text-red-200">
              {errorMessage}
            </p>

            <button
              type="button"
              onClick={() => {
                void loadAnalytics();
              }}
              className="mt-3 rounded-xl border border-red-400/30 px-4 py-2 text-xs font-bold text-red-200 transition hover:bg-red-500/10"
            >
              Retry analytics
            </button>
          </div>
        ) : null}
      </div>

      {loadState === "success" && summary ? (
        <>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="Impressions"
              value={formatNumber(
                summary.totals.impressions
              )}
              detail="Shown in Pray Near Me results"
            />

            <MetricCard
              title="Best option shown"
              value={formatNumber(
                summary.totals.best_shown
              )}
              detail={`${formatPercent(
                summary.rates.best_shown_rate
              )} of impressions`}
            />

            <MetricCard
              title="Total clicks"
              value={formatNumber(
                summary.totals.total_clicks
              )}
              detail={`${formatPercent(
                summary.rates.engagement_rate
              )} engagement rate`}
            />

            <MetricCard
              title="Average Salah Score"
              value={
                summary.quality
                  .average_salah_score === null
                  ? "—"
                  : formatNumber(
                      summary.quality
                        .average_salah_score
                    )
              }
              detail="Average ranking score when shown"
            />
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <MetricCard
              title="Profile clicks"
              value={formatNumber(
                summary.totals.profile_clicks
              )}
              detail={`${formatPercent(
                summary.rates.profile_click_rate
              )} profile click rate`}
            />

            <MetricCard
              title="Map clicks"
              value={formatNumber(
                summary.totals.maps_clicks
              )}
              detail={`${formatPercent(
                summary.rates.maps_click_rate
              )} map click rate`}
            />

            <MetricCard
              title="Timetable clicks"
              value={formatNumber(
                summary.totals.timetable_clicks
              )}
              detail={`${formatPercent(
                summary.rates
                  .timetable_click_rate
              )} timetable click rate`}
            />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <DailyActivityPanel
              rows={dailyRows}
              maxDailyValue={maxDailyValue}
            />

            <TopSourcesPanel
              sources={
                summary.top_sources ?? []
              }
            />
          </div>
        </>
      ) : null}
    </section>
  );
}

function AnalyticsLoadingState() {
  return (
    <div className="mt-6">
      <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm text-yellow-100">
        Loading mosque analytics…
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map(
          (_, index) => (
            <div
              key={index}
              aria-hidden="true"
              className="animate-pulse rounded-2xl border border-white/10 bg-black/30 p-5"
            >
              <div className="h-3 w-24 rounded bg-white/10" />
              <div className="mt-4 h-8 w-16 rounded bg-white/10" />
              <div className="mt-3 h-3 w-32 rounded bg-white/10" />
            </div>
          )
        )}
      </div>
    </div>
  );
}

function DailyActivityPanel({
  rows,
  maxDailyValue,
}: {
  rows: NonNullable<
    MosqueAnalyticsSummary["summary"]
  >["daily_breakdown"];
  maxDailyValue: number;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
      <div className="text-sm font-bold text-white">
        Daily activity
      </div>

      <div className="mt-2 flex flex-wrap gap-4 text-xs text-white/50">
        <span className="inline-flex items-center gap-2">
          <span className="size-2 rounded-full bg-yellow-500" />
          Impressions
        </span>

        <span className="inline-flex items-center gap-2">
          <span className="size-2 rounded-full bg-emerald-500" />
          Clicks
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-white/50">
          No daily activity in this period yet.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {rows.map((day) => {
            const impressions =
              normaliseMetric(
                day.impressions
              );

            const clicks =
              normaliseMetric(
                day.total_clicks
              );

            const impressionsWidth =
              (impressions /
                maxDailyValue) *
              100;

            const clicksWidth =
              (clicks /
                maxDailyValue) *
              100;

            return (
              <div key={day.date}>
                <div className="mb-1 flex flex-col gap-1 text-xs text-white/50 sm:flex-row sm:justify-between">
                  <time dateTime={day.date}>
                    {formatDate(day.date)}
                  </time>

                  <span>
                    {formatNumber(impressions)} shown
                    {" • "}
                    {formatNumber(clicks)} clicks
                  </span>
                </div>

                <div
                  aria-label={`${formatNumber(
                    impressions
                  )} impressions`}
                  className="overflow-hidden rounded-full bg-white/10"
                >
                  <div
                    className="h-2 rounded-full bg-yellow-500"
                    style={{
                      width:
                        impressions > 0
                          ? `${Math.max(
                              impressionsWidth,
                              3
                            )}%`
                          : "0%",
                    }}
                  />
                </div>

                <div
                  aria-label={`${formatNumber(
                    clicks
                  )} clicks`}
                  className="mt-1 overflow-hidden rounded-full bg-white/10"
                >
                  <div
                    className="h-2 rounded-full bg-emerald-500"
                    style={{
                      width:
                        clicks > 0
                          ? `${Math.max(
                              clicksWidth,
                              3
                            )}%`
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
  );
}

function TopSourcesPanel({
  sources,
}: {
  sources: NonNullable<
    MosqueAnalyticsSummary["summary"]
  >["top_sources"];
}) {
  const safeSources = [...sources]
    .filter(
      (source) =>
        typeof source.source === "string" &&
        typeof source.count === "number" &&
        Number.isFinite(source.count)
    )
    .sort(
      (first, second) =>
        second.count - first.count
    )
    .slice(0, 10);

  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
      <div className="text-sm font-bold text-white">
        Top sources
      </div>

      {safeSources.length === 0 ? (
        <p className="mt-4 text-sm text-white/50">
          No sources recorded yet.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {safeSources.map(
            (source, index) => (
              <div
                key={`${source.source}-${index}`}
                className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/30 px-4 py-3"
              >
                <span className="min-w-0 truncate text-sm text-white/70">
                  {formatSource(
                    source.source
                  )}
                </span>

                <span className="shrink-0 rounded-full border border-yellow-500/20 bg-yellow-500/10 px-3 py-1 text-xs font-bold text-yellow-300">
                  {formatNumber(source.count)}
                </span>
              </div>
            )
          )}
        </div>
      )}

      <div className="mt-5 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-xs leading-5 text-yellow-100">
        Engagement can exceed 100% when one user
        completes several tracked actions after a single
        impression, especially during testing.
      </div>
    </div>
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
    <article className="rounded-2xl border border-white/10 bg-black/30 p-5">
      <div className="text-xs uppercase tracking-[0.18em] text-white/40">
        {title}
      </div>

      <div className="mt-3 text-3xl font-black text-white">
        {value}
      </div>

      <div className="mt-2 text-xs leading-5 text-white/50">
        {detail}
      </div>
    </article>
  );
}