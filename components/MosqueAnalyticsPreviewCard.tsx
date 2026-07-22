"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

type AnalyticsTotals = {
  impressions: number;
  best_shown: number;
  profile_clicks: number;
  maps_clicks: number;
  timetable_clicks: number;
  total_clicks: number;
};

type AnalyticsRates = {
  engagement_rate: number;
  profile_click_rate: number;
  maps_click_rate: number;
  timetable_click_rate: number;
  best_shown_rate: number;
};

type AnalyticsQuality = {
  average_salah_score: number | null;
};

type AnalyticsSummaryResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  summary?: {
    totals: AnalyticsTotals;
    rates: AnalyticsRates;
    quality: AnalyticsQuality;
  };
};

type Props = {
  mosqueId: string;
};

type LoadState =
  | "loading"
  | "success"
  | "error";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const REQUEST_TIMEOUT_MS = 15_000;
const ANALYTICS_DAYS = 30;

function cleanString(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function formatNumber(
  value: number | null | undefined
): string {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return "0";
  }

  return new Intl.NumberFormat("en-GB").format(
    Math.max(0, Math.trunc(value))
  );
}

function formatScore(
  value: number | null | undefined
): string {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return "—";
  }

  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 1,
  }).format(value);
}

async function readResponse(
  response: Response
): Promise<AnalyticsSummaryResponse> {
  try {
    const value: unknown = await response.json();

    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value)
    ) {
      return {};
    }

    return value as AnalyticsSummaryResponse;
  } catch {
    return {};
  }
}

export default function MosqueAnalyticsPreviewCard({
  mosqueId,
}: Props) {
  const statusId = useId();

  const abortControllerRef =
    useRef<AbortController | null>(null);

  const mountedRef = useRef(true);

  const cleanMosqueId = useMemo(
    () => cleanString(mosqueId),
    [mosqueId]
  );

  const [loadState, setLoadState] =
    useState<LoadState>("loading");

  const [errorMessage, setErrorMessage] =
    useState("");

  const [data, setData] =
    useState<AnalyticsSummaryResponse | null>(null);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, []);

  const loadPreview = useCallback(async () => {
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
            days: ANALYTICS_DAYS,
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
            "Could not load the analytics preview."
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
            ? "The analytics request timed out."
            : "The analytics request was cancelled."
        );
        return;
      }

      console.error(
        "Mosque analytics preview failed:",
        error
      );

      setErrorMessage(
        "Could not load the analytics preview."
      );
    } finally {
      window.clearTimeout(timeoutId);

      if (
        abortControllerRef.current === controller
      ) {
        abortControllerRef.current = null;
      }
    }
  }, [cleanMosqueId]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  const summary = data?.summary;

  return (
    <section
      aria-labelledby={`${statusId}-heading`}
      className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-emerald-300">
            Pray Near Me preview
          </div>

          <h3
            id={`${statusId}-heading`}
            className="mt-1 text-sm font-bold text-white"
          >
            Last 30 days activity
          </h3>

          <p className="mt-1 text-xs text-white/50">
            Visibility and engagement across mosque discovery
            journeys.
          </p>
        </div>

        <Link
          href={`/business-dashboard/mosques/${cleanMosqueId}/analytics`}
          className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
        >
          Full analytics
        </Link>
      </div>

      <div
        id={statusId}
        aria-live="polite"
        aria-atomic="true"
      >
        {loadState === "loading" ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map(
              (_, index) => (
                <PreviewSkeleton key={index} />
              )
            )}
          </div>
        ) : null}

        {loadState === "error" ? (
          <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3">
            <p className="text-xs leading-5 text-red-200">
              {errorMessage}
            </p>

            <button
              type="button"
              onClick={() => {
                void loadPreview();
              }}
              className="mt-3 rounded-lg border border-red-400/30 px-3 py-2 text-xs font-bold text-red-200 transition hover:bg-red-500/10"
            >
              Retry
            </button>
          </div>
        ) : null}

        {loadState === "success" && summary ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <PreviewMetric
              label="Shown"
              value={formatNumber(
                summary.totals.impressions
              )}
            />

            <PreviewMetric
              label="Best shown"
              value={formatNumber(
                summary.totals.best_shown
              )}
            />

            <PreviewMetric
              label="Clicks"
              value={formatNumber(
                summary.totals.total_clicks
              )}
            />

            <PreviewMetric
              label="Average score"
              value={formatScore(
                summary.quality.average_salah_score
              )}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}

function PreviewMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-3">
      <div className="text-[11px] uppercase tracking-[0.16em] text-white/40">
        {label}
      </div>

      <div className="mt-2 text-2xl font-black text-white">
        {value}
      </div>
    </div>
  );
}

function PreviewSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="animate-pulse rounded-xl border border-white/10 bg-black/30 p-3"
    >
      <div className="h-3 w-20 rounded bg-white/10" />
      <div className="mt-3 h-7 w-12 rounded bg-white/10" />
    </div>
  );
}