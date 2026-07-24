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

type AnalyticsCounts = {
  profile_view: number;
  profile_click: number;
  phone_click: number;
  website_click: number;
  maps_click: number;
  sponsor_impression: number;
  sponsor_click: number;
};

type AnalyticsResponse = {
  ok?: boolean;
  counts?: Partial<AnalyticsCounts> | null;
  period_days?: number;
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

const EMPTY_COUNTS: AnalyticsCounts = {
  profile_view: 0,
  profile_click: 0,
  phone_click: 0,
  website_click: 0,
  maps_click: 0,
  sponsor_impression: 0,
  sponsor_click: 0,
};

function cleanString(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function safeInteger(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return 0;
  }

  return Math.max(0, Math.trunc(value));
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

function normaliseCounts(
  value: Partial<AnalyticsCounts> | null | undefined
): AnalyticsCounts {
  return {
    profile_view: safeInteger(value?.profile_view),
    profile_click: safeInteger(
      value?.profile_click
    ),
    phone_click: safeInteger(value?.phone_click),
    website_click: safeInteger(
      value?.website_click
    ),
    maps_click: safeInteger(value?.maps_click),
    sponsor_impression: safeInteger(
      value?.sponsor_impression
    ),
    sponsor_click: safeInteger(
      value?.sponsor_click
    ),
  };
}

async function readJsonSafely(
  response: Response
): Promise<AnalyticsResponse> {
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
        "The analytics endpoint returned an unexpected response.",
    };
  }

  try {
    return (await response.json()) as AnalyticsResponse;
  } catch {
    return {
      ok: false,
      error:
        "The analytics endpoint returned invalid JSON.",
    };
  }
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-GB").format(
    value
  );
}

function calculateRate(
  actions: number,
  impressions: number
): number {
  if (impressions <= 0) {
    return 0;
  }

  return Math.min(
    100,
    Math.max(0, (actions / impressions) * 100)
  );
}

export default function BusinessDashboardAnalytics({
  businessId,
  days = DEFAULT_PERIOD_DAYS,
}: Props) {
  const abortControllerRef =
    useRef<AbortController | null>(null);

  const [counts, setCounts] =
    useState<AnalyticsCounts>(EMPTY_COUNTS);
  const [loadState, setLoadState] =
    useState<LoadState>("idle");
  const [errorMessage, setErrorMessage] =
    useState("");
  const [lastUpdatedAt, setLastUpdatedAt] =
    useState<Date | null>(null);

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

  const loadAnalytics = useCallback(async () => {
    abortControllerRef.current?.abort();

    if (validationError) {
      setCounts(EMPTY_COUNTS);
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
      const params = new URLSearchParams({
        business_id: cleanBusinessId,
        days: String(periodDays),
      });

      const response = await fetch(
        `/api/business-dashboard/analytics?${params.toString()}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        }
      );

      const result =
        await readJsonSafely(response);

      if (
        !response.ok ||
        result.ok !== true
      ) {
        setLoadState("error");
        setErrorMessage(
          cleanString(
            result.error ?? result.message
          ) || "Could not load analytics."
        );
        return;
      }

      setCounts(normaliseCounts(result.counts));
      setLastUpdatedAt(new Date());
      setLoadState("success");
    } catch (error) {
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
        "Could not load analytics."
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
    void loadAnalytics();

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [loadAnalytics]);

  const totalCustomerActions = useMemo(
    () =>
      counts.profile_click +
      counts.phone_click +
      counts.website_click +
      counts.maps_click +
      counts.sponsor_click,
    [counts]
  );

  const totalRecordedEvents = useMemo(
    () =>
      counts.profile_view +
      counts.profile_click +
      counts.phone_click +
      counts.website_click +
      counts.maps_click +
      counts.sponsor_impression +
      counts.sponsor_click,
    [counts]
  );

  const listingEngagementRate = useMemo(
    () =>
      calculateRate(
        totalCustomerActions,
        counts.profile_view
      ),
    [counts.profile_view, totalCustomerActions]
  );

  const sponsorClickRate = useMemo(
    () =>
      calculateRate(
        counts.sponsor_click,
        counts.sponsor_impression
      ),
    [
      counts.sponsor_click,
      counts.sponsor_impression,
    ]
  );

  if (
    loadState === "idle" ||
    loadState === "loading"
  ) {
    return <DashboardAnalyticsSkeleton />;
  }

  if (loadState === "error") {
    return (
      <section
        role="alert"
        className="rounded-3xl border border-red-500/20 bg-red-500/10 p-8"
      >
        <div className="text-lg font-black text-red-200">
          Analytics unavailable
        </div>

        <p className="mt-2 text-sm leading-6 text-red-100/75">
          {errorMessage}
        </p>

        <button
          type="button"
          onClick={() => {
            void loadAnalytics();
          }}
          className="mt-5 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-200 transition hover:bg-red-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
        >
          Try again
        </button>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="dashboard-analytics-heading"
      className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6 md:p-8"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-yellow-400">
            Analytics
          </div>

          <h2
            id="dashboard-analytics-heading"
            className="mt-3 text-3xl font-black text-white"
          >
            Last {periodDays} days
          </h2>

          <p className="mt-2 text-sm leading-6 text-white/55">
            Monitor listing visibility and customer
            interactions.
          </p>

          {lastUpdatedAt ? (
            <p className="mt-2 text-xs text-white/35">
              Updated{" "}
              {lastUpdatedAt.toLocaleTimeString(
                "en-GB",
                {
                  hour: "2-digit",
                  minute: "2-digit",
                }
              )}
            </p>
          ) : null}
        </div>

        <button
        type="button"
        onClick={() => {
          void loadAnalytics();
        }}
        className="w-fit rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-5 py-3 text-sm font-bold text-yellow-300 transition hover:bg-yellow-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"
      >
        Refresh analytics
      </button>
            </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          title="Profile views"
          value={counts.profile_view}
          description="Visits to your public listing"
        />

        <StatCard
          title="Profile clicks"
          value={counts.profile_click}
          description="Clicks opening your business profile"
        />

        <StatCard
          title="Phone clicks"
          value={counts.phone_click}
          description="Users who selected the call action"
        />

        <StatCard
          title="Website clicks"
          value={counts.website_click}
          description="Customers sent to your website"
        />

        <StatCard
          title="Map clicks"
          value={counts.maps_click}
          description="Map and direction requests"
        />

        <StatCard
          title="Sponsor impressions"
          value={counts.sponsor_impression}
          description="Sponsored placement visibility"
        />

        <StatCard
          title="Sponsor clicks"
          value={counts.sponsor_click}
          description="Clicks from sponsored placements"
        />

        <StatCard
          title="Total customer actions"
          value={totalCustomerActions}
          description="Combined high-intent interactions"
        />

        <StatCard
          title="Total recorded events"
          value={totalRecordedEvents}
          description="All listing analytics events"
        />
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <RateCard
          label="Listing engagement rate"
          rate={listingEngagementRate}
          description="Customer actions divided by profile views."
        />

        <RateCard
          label="Sponsor click rate"
          rate={sponsorClickRate}
          description="Sponsor clicks divided by sponsor impressions."
        />
      </div>
    </section>
  );
}

function StatCard({
  title,
  value,
  description,
}: {
  title: string;
  value: number;
  description: string;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-black/30 p-5">
      <div className="text-xs uppercase tracking-[0.18em] text-yellow-400">
        {title}
      </div>

      <div className="mt-4 text-4xl font-black text-white">
        {formatNumber(value)}
      </div>

      <p className="mt-2 text-sm leading-6 text-white/55">
        {description}
      </p>
    </article>
  );
}

function RateCard({
  label,
  rate,
  description,
}: {
  label: string;
  rate: number;
  description: string;
}) {
  const formattedRate = `${new Intl.NumberFormat(
    "en-GB",
    {
      maximumFractionDigits: 2,
    }
  ).format(rate)}%`;

  return (
    <article className="rounded-2xl border border-yellow-500/20 bg-black/30 p-6">
      <div className="text-xs uppercase tracking-[0.18em] text-yellow-400">
        {label}
      </div>

      <div className="mt-3 text-4xl font-black text-white">
        {formattedRate}
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-yellow-400 transition-[width]"
          style={{
            width: `${Math.min(
              100,
              Math.max(0, rate)
            )}%`,
          }}
        />
      </div>

      <p className="mt-3 text-sm leading-6 text-white/55">
        {description}
      </p>
    </article>
  );
}

function DashboardAnalyticsSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-label="Loading dashboard analytics"
      className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6 md:p-8"
    >
      <div className="h-4 w-24 animate-pulse rounded bg-white/10" />
      <div className="mt-4 h-9 w-52 animate-pulse rounded bg-white/10" />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 9 }).map(
          (_, index) => (
            <div
              key={index}
              className="rounded-2xl border border-white/10 bg-black/30 p-5"
            >
              <div className="h-3 w-24 animate-pulse rounded bg-white/10" />
              <div className="mt-4 h-9 w-14 animate-pulse rounded bg-white/10" />
              <div className="mt-3 h-3 w-36 animate-pulse rounded bg-white/10" />
            </div>
          )
        )}
      </div>
    </section>
  );
}