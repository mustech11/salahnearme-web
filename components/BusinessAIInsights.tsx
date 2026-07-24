"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Props = {
  businessId: string;
  days?: number;
};

type Insights = {
  business_id?: string;
  period_days?: number;
  profile_views: number;
  profile_clicks?: number;
  website_clicks: number;
  phone_clicks: number;
  maps_clicks: number;
  sponsor_clicks: number;
  engagement_events?: number;
  engagement_score: number;
  engagement_rate?: number;
  conversion_rate?: number;
  performance: string;
  recommendations?: string[];
};

type ApiResponse = {
  ok?: boolean;
  insights?: Partial<Insights> | null;
  error?: string;
  message?: string;
};

type LoadState =
  | "idle"
  | "loading"
  | "success"
  | "error";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const REQUEST_TIMEOUT_MS = 25_000;
const DEFAULT_PERIOD_DAYS = 30;
const MAX_PERIOD_DAYS = 365;
const MAX_RECOMMENDATIONS = 10;

function cleanString(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function safeNumber(
  value: unknown,
  fallback = 0
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return fallback;
  }

  return Math.max(0, value);
}

function safeInteger(
  value: unknown,
  fallback = 0
): number {
  return Math.trunc(safeNumber(value, fallback));
}

function safeRate(value: unknown): number {
  return Math.min(100, safeNumber(value, 0));
}

function normaliseDays(value: number | undefined) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return DEFAULT_PERIOD_DAYS;
  }

  return Math.min(
    MAX_PERIOD_DAYS,
    Math.max(1, Math.trunc(value))
  );
}

function normaliseRecommendations(
  value: unknown
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const unique = new Set<string>();

  for (const recommendation of value) {
    const cleaned = cleanString(recommendation);

    if (cleaned) {
      unique.add(cleaned.slice(0, 500));
    }

    if (unique.size >= MAX_RECOMMENDATIONS) {
      break;
    }
  }

  return Array.from(unique);
}

function normaliseInsights(
  value: Partial<Insights>,
  businessId: string,
  requestedDays: number
): Insights {
  const engagementRate =
    value.engagement_rate ??
    value.conversion_rate ??
    0;

  return {
    business_id:
      cleanString(value.business_id) || businessId,
    period_days: Math.max(
      1,
      safeInteger(
        value.period_days,
        requestedDays
      )
    ),
    profile_views: safeInteger(
      value.profile_views
    ),
    profile_clicks: safeInteger(
      value.profile_clicks
    ),
    website_clicks: safeInteger(
      value.website_clicks
    ),
    phone_clicks: safeInteger(
      value.phone_clicks
    ),
    maps_clicks: safeInteger(
      value.maps_clicks
    ),
    sponsor_clicks: safeInteger(
      value.sponsor_clicks
    ),
    engagement_events: safeInteger(
      value.engagement_events
    ),
    engagement_score: safeNumber(
      value.engagement_score
    ),
    engagement_rate: safeRate(engagementRate),
    conversion_rate: safeRate(
      value.conversion_rate
    ),
    performance:
      cleanString(value.performance) ||
      "Building visibility",
    recommendations: normaliseRecommendations(
      value.recommendations
    ),
  };
}

async function readJsonSafely(
  response: Response
): Promise<ApiResponse> {
  const contentType =
    response.headers.get("content-type") ?? "";

  if (
    !contentType
      .toLowerCase()
      .includes("application/json")
  ) {
    const responseText = await response
      .text()
      .catch(() => "");

    return {
      ok: false,
      error:
        responseText.trim().slice(0, 180) ||
        "The AI insights service returned an unexpected response.",
    };
  }

  try {
    return (await response.json()) as ApiResponse;
  } catch {
    return {
      ok: false,
      error:
        "The AI insights service returned invalid JSON.",
    };
  }
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatRate(value: number): string {
  return `${formatNumber(value)}%`;
}

function performanceTone(
  rate: number
): string {
  if (rate >= 20) {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }

  if (rate >= 8) {
    return "border-yellow-500/30 bg-yellow-500/10 text-yellow-300";
  }

  return "border-cyan-500/30 bg-cyan-500/10 text-cyan-300";
}

export default function BusinessAIInsights({
  businessId,
  days = DEFAULT_PERIOD_DAYS,
}: Props) {
  const abortControllerRef =
    useRef<AbortController | null>(null);

  const [insights, setInsights] =
    useState<Insights | null>(null);
  const [loadState, setLoadState] =
    useState<LoadState>("idle");
  const [errorMessage, setErrorMessage] =
    useState("");

  const cleanBusinessId = useMemo(
    () => cleanString(businessId),
    [businessId]
  );

  const periodDays = useMemo(
    () => normaliseDays(days),
    [days]
  );

  const validationError = useMemo(() => {
    if (!UUID_REGEX.test(cleanBusinessId)) {
      return "A valid business is required to generate insights.";
    }

    return "";
  }, [cleanBusinessId]);

  const loadInsights = useCallback(async () => {
    abortControllerRef.current?.abort();

    if (validationError) {
      setInsights(null);
      setLoadState("error");
      setErrorMessage(validationError);
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    setLoadState("loading");
    setErrorMessage("");

    try {
      const response = await fetch(
        "/api/business/ai-insights",
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
            business_id: cleanBusinessId,
            days: periodDays,
          }),
        }
      );

      const result =
        await readJsonSafely(response);

      if (
        !response.ok ||
        result.ok !== true ||
        !result.insights
      ) {
        setInsights(null);
        setLoadState("error");
        setErrorMessage(
          cleanString(
            result.error ?? result.message
          ) ||
            "Could not generate AI insights."
        );
        return;
      }

      setInsights(
        normaliseInsights(
          result.insights,
          cleanBusinessId,
          periodDays
        )
      );
      setLoadState("success");
    } catch (error) {
      setInsights(null);
      setLoadState("error");

      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        setErrorMessage(
          "The AI insights request timed out. Please try again."
        );
        return;
      }

      setErrorMessage(
        "Could not generate AI insights."
      );
    } finally {
      window.clearTimeout(timeoutId);

      if (
        abortControllerRef.current === controller
      ) {
        abortControllerRef.current = null;
      }
    }
  }, [
    cleanBusinessId,
    periodDays,
    validationError,
  ]);

  useEffect(() => {
    void loadInsights();

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [loadInsights]);

  const engagementRate = useMemo(() => {
    return insights?.engagement_rate ?? 0;
  }, [insights]);

  if (
    loadState === "idle" ||
    loadState === "loading"
  ) {
    return <InsightsSkeleton />;
  }

  if (loadState === "error") {
    return (
      <section
        role="alert"
        className="rounded-3xl border border-red-500/30 bg-red-950/30 p-6"
      >
        <div className="text-lg font-bold text-red-300">
          AI insights unavailable
        </div>

        <p className="mt-2 text-sm leading-6 text-red-100/80">
          {errorMessage}
        </p>

        <button
          type="button"
          onClick={() => {
            void loadInsights();
          }}
          className="mt-5 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-200 transition hover:bg-red-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
        >
          Try again
        </button>
      </section>
    );
  }

  if (!insights) {
    return (
      <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6">
        <div className="text-lg font-bold text-white">
          No insights available
        </div>

        <p className="mt-2 text-sm text-white/60">
          More listing activity may be required
          before recommendations can be generated.
        </p>
      </section>
    );
  }

  const recommendations =
    insights.recommendations ?? [];

  return (
    <section
      aria-labelledby="business-ai-insights-heading"
      className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6"
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-yellow-400">
            AI insights
          </div>

          <h2
            id="business-ai-insights-heading"
            className="mt-2 text-3xl font-black text-white"
          >
            {insights.performance}
          </h2>

          <p className="mt-2 text-sm leading-6 text-white/55">
            Based on the last{" "}
            {insights.period_days ??
              DEFAULT_PERIOD_DAYS}{" "}
            days of listing activity.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div
            className={`rounded-2xl border px-5 py-3 ${performanceTone(
              engagementRate
            )}`}
          >
            <div className="text-xs uppercase tracking-[0.18em] opacity-70">
              Engagement rate
            </div>

            <div className="mt-1 text-3xl font-black">
              {formatRate(engagementRate)}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              void loadInsights();
            }}
            className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-bold text-white/70 transition hover:border-yellow-500/30 hover:text-yellow-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"
          >
            Refresh insights
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <InsightMetric
          title="Profile views"
          value={insights.profile_views}
        />

        <InsightMetric
          title="Profile clicks"
          value={insights.profile_clicks ?? 0}
        />

        <InsightMetric
          title="Phone clicks"
          value={insights.phone_clicks}
        />

        <InsightMetric
          title="Website clicks"
          value={insights.website_clicks}
        />

        <InsightMetric
          title="Map clicks"
          value={insights.maps_clicks}
        />

        <InsightMetric
          title="Sponsor clicks"
          value={insights.sponsor_clicks}
        />

        <InsightMetric
          title="Engagement events"
          value={insights.engagement_events ?? 0}
        />

        <InsightMetric
          title="Engagement score"
          value={insights.engagement_score}
        />

        <InsightMetric
          title="Engagement rate"
          value={formatRate(engagementRate)}
        />
      </div>

      <div className="mt-6 rounded-2xl border border-yellow-500/20 bg-black/30 p-5">
        <div className="text-sm font-bold uppercase tracking-[0.22em] text-yellow-400">
          Recommended actions
        </div>

        {recommendations.length > 0 ? (
          <ol className="mt-5 space-y-3">
            {recommendations.map(
              (recommendation, index) => (
                <li
                  key={`${index}-${recommendation}`}
                  className="flex gap-4 rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm leading-6 text-white/75"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-yellow-500/30 bg-yellow-500/10 text-xs font-black text-yellow-300">
                    {index + 1}
                  </span>

                  <span>{recommendation}</span>
                </li>
              )
            )}
          </ol>
        ) : (
          <p className="mt-4 text-sm leading-6 text-white/55">
            No specific recommendations are
            available yet. Continue improving your
            profile and generating customer
            engagement.
          </p>
        )}
      </div>
    </section>
  );
}

function InsightMetric({
  title,
  value,
}: {
  title: string;
  value: number | string;
}) {
  return (
    <article className="rounded-2xl border border-yellow-500/20 bg-black/30 p-5">
      <div className="text-xs uppercase tracking-[0.16em] text-yellow-400">
        {title}
      </div>

      <div className="mt-3 text-3xl font-black text-white">
        {typeof value === "number"
          ? formatNumber(value)
          : value}
      </div>
    </article>
  );
}

function InsightsSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-label="Loading AI business insights"
      className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6"
    >
      <div className="h-4 w-28 animate-pulse rounded bg-white/10" />
      <div className="mt-4 h-9 w-64 animate-pulse rounded bg-white/10" />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 9 }).map(
          (_, index) => (
            <div
              key={index}
              className="rounded-2xl border border-white/10 bg-black/30 p-5"
            >
              <div className="h-3 w-24 animate-pulse rounded bg-white/10" />
              <div className="mt-4 h-8 w-16 animate-pulse rounded bg-white/10" />
            </div>
          )
        )}
      </div>
    </section>
  );
}