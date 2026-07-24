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

type Summary = {
  business_id: string;
  period_days: number;
  total_events: number;
  profile_views: number;
  profile_clicks: number;
  phone_clicks: number;
  website_clicks: number;
  maps_clicks: number;
  sponsor_impressions?: number;
  sponsor_clicks: number;
  engagement_events: number;
  engagement_rate?: number;
  conversion_rate?: number;
};

type ApiResponse = {
  ok?: boolean;
  summary?: Partial<Summary> | null;
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

const REQUEST_TIMEOUT_MS = 20_000;
const DEFAULT_PERIOD_DAYS = 30;
const MAX_PERIOD_DAYS = 365;

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

function normaliseSummary(
  value: Partial<Summary>,
  businessId: string,
  requestedDays: number
): Summary {
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
    total_events: safeInteger(value.total_events),
    profile_views: safeInteger(
      value.profile_views
    ),
    profile_clicks: safeInteger(
      value.profile_clicks
    ),
    phone_clicks: safeInteger(
      value.phone_clicks
    ),
    website_clicks: safeInteger(
      value.website_clicks
    ),
    maps_clicks: safeInteger(
      value.maps_clicks
    ),
    sponsor_impressions: safeInteger(
      value.sponsor_impressions
    ),
    sponsor_clicks: safeInteger(
      value.sponsor_clicks
    ),
    engagement_events: safeInteger(
      value.engagement_events
    ),
    engagement_rate: safeRate(engagementRate),
    conversion_rate: safeRate(
      value.conversion_rate
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
    const text = await response
      .text()
      .catch(() => "");

    return {
      ok: false,
      error:
        text.trim().slice(0, 180) ||
        `The analytics service returned an unexpected ${contentType || "response format"}.`,
    };
  }

  try {
    return (await response.json()) as ApiResponse;
  } catch {
    return {
      ok: false,
      error:
        "The analytics service returned invalid JSON.",
    };
  }
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-GB").format(
    value
  );
}

function formatRate(value: number): string {
  return `${new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 2,
  }).format(value)}%`;
}

export default function BusinessAnalyticsSummary({
  businessId,
  days = DEFAULT_PERIOD_DAYS,
}: Props) {
  const abortControllerRef =
    useRef<AbortController | null>(null);

  const [summary, setSummary] =
    useState<Summary | null>(null);
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
      return "A valid business is required to load analytics.";
    }

    return "";
  }, [cleanBusinessId]);

  const loadSummary = useCallback(async () => {
    abortControllerRef.current?.abort();

    if (validationError) {
      setSummary(null);
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
        "/api/business/analytics-summary",
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
        !result.summary
      ) {
        setSummary(null);
        setLoadState("error");
        setErrorMessage(
          cleanString(
            result.error ?? result.message
          ) ||
            "Could not load the analytics summary."
        );
        return;
      }

      setSummary(
        normaliseSummary(
          result.summary,
          cleanBusinessId,
          periodDays
        )
      );
      setLoadState("success");
    } catch (error) {
      setSummary(null);
      setLoadState("error");

      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        setErrorMessage(
          "The analytics request timed out. Please try again."
        );
        return;
      }

      setErrorMessage(
        "Could not load the analytics summary."
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
    void loadSummary();

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [loadSummary]);

  if (
    loadState === "idle" ||
    loadState === "loading"
  ) {
    return <AnalyticsSummarySkeleton />;
  }

  if (loadState === "error") {
    return (
      <section
        role="alert"
        className="rounded-3xl border border-red-500/30 bg-red-950/30 p-6"
      >
        <div className="text-lg font-bold text-red-300">
          Analytics unavailable
        </div>

        <p className="mt-2 text-sm leading-6 text-red-100/80">
          {errorMessage}
        </p>

        <button
          type="button"
          onClick={() => {
            void loadSummary();
          }}
          className="mt-5 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-200 transition hover:bg-red-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
        >
          Try again
        </button>
      </section>
    );
  }

  if (!summary) {
    return (
      <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6">
        <div className="text-lg font-bold text-white">
          No analytics available
        </div>

        <p className="mt-2 text-sm text-white/60">
          No activity was found for the selected
          period.
        </p>
      </section>
    );
  }

  const engagementRate =
    summary.engagement_rate ?? 0;

  return (
    <section
      aria-labelledby="business-analytics-summary-heading"
      className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-yellow-400">
            Analytics summary
          </div>

          <h2
            id="business-analytics-summary-heading"
            className="mt-2 text-2xl font-black text-white"
          >
            Last {summary.period_days} days
          </h2>

          <p className="mt-2 text-sm leading-6 text-white/55">
            Visibility and engagement across your
            business listing.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-full border border-yellow-500/20 bg-yellow-500/10 px-4 py-2 text-sm font-bold text-yellow-300">
            {formatRate(engagementRate)} engagement
          </div>

          <button
            type="button"
            onClick={() => {
              void loadSummary();
            }}
            className="rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-sm font-bold text-white/70 transition hover:border-yellow-500/30 hover:text-yellow-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          title="Total events"
          value={formatNumber(
            summary.total_events
          )}
          description="All recorded listing activity"
        />

        <MetricCard
          title="Profile views"
          value={formatNumber(
            summary.profile_views
          )}
          description="Visits to the public profile"
        />

        <MetricCard
          title="Profile clicks"
          value={formatNumber(
            summary.profile_clicks
          )}
          description="Clicks opening the listing"
        />

        <MetricCard
          title="Phone clicks"
          value={formatNumber(
            summary.phone_clicks
          )}
          description="Users who selected call"
        />

        <MetricCard
          title="Website clicks"
          value={formatNumber(
            summary.website_clicks
          )}
          description="Visits sent to the website"
        />

        <MetricCard
          title="Map clicks"
          value={formatNumber(
            summary.maps_clicks
          )}
          description="Direction and map requests"
        />

        <MetricCard
          title="Sponsor impressions"
          value={formatNumber(
            summary.sponsor_impressions ?? 0
          )}
          description="Times sponsored placement appeared"
        />

        <MetricCard
          title="Sponsor clicks"
          value={formatNumber(
            summary.sponsor_clicks
          )}
          description="Clicks from sponsored placement"
        />

        <MetricCard
          title="Engagement events"
          value={formatNumber(
            summary.engagement_events
          )}
          description="High-intent customer actions"
        />
      </div>

      <div className="mt-6 rounded-2xl border border-yellow-500/20 bg-black/30 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-yellow-400">
              Engagement rate
            </div>

            <div className="mt-2 text-4xl font-black text-white">
              {formatRate(engagementRate)}
            </div>
          </div>

          <div className="max-w-xl text-sm leading-6 text-white/55">
            Percentage of profile views that
            resulted in a measurable customer
            interaction.
          </div>
        </div>
      </div>
    </section>
  );
}

function MetricCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <article className="rounded-2xl border border-yellow-500/20 bg-black/30 p-5">
      <div className="text-xs uppercase tracking-[0.16em] text-yellow-400">
        {title}
      </div>

      <div className="mt-3 text-3xl font-black text-white">
        {value}
      </div>

      <p className="mt-2 text-xs leading-5 text-white/45">
        {description}
      </p>
    </article>
  );
}

function AnalyticsSummarySkeleton() {
  return (
    <section
      aria-busy="true"
      aria-label="Loading business analytics"
      className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6"
    >
      <div className="h-4 w-36 animate-pulse rounded bg-white/10" />
      <div className="mt-4 h-8 w-52 animate-pulse rounded bg-white/10" />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 9 }).map(
          (_, index) => (
            <div
              key={index}
              className="rounded-2xl border border-white/10 bg-black/30 p-5"
            >
              <div className="h-3 w-24 animate-pulse rounded bg-white/10" />
              <div className="mt-4 h-8 w-16 animate-pulse rounded bg-white/10" />
              <div className="mt-3 h-3 w-36 animate-pulse rounded bg-white/10" />
            </div>
          )
        )}
      </div>
    </section>
  );
}