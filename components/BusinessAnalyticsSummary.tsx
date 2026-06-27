"use client";

import { useEffect, useState } from "react";

type Props = {
  businessId: string;
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
  sponsor_clicks: number;
  engagement_events: number;
  conversion_rate: number;
};

type ApiResponse = {
  ok: boolean;
  summary?: Summary;
  error?: string;
};

async function readJsonSafely(res: Response): Promise<ApiResponse> {
  const contentType = res.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    const text = await res.text();

    return {
      ok: false,
      error: `API returned ${contentType || "unknown content type"}. This usually means the API route is missing or crashing. First response text: ${text.slice(
        0,
        120
      )}`,
    };
  }

  try {
    return (await res.json()) as ApiResponse;
  } catch {
    return {
      ok: false,
      error: "API returned invalid JSON.",
    };
  }
}

export default function BusinessAnalyticsSummary({ businessId }: Props) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!businessId) {
        setErrorMessage("Missing business ID.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setErrorMessage(null);

        const res = await fetch("/api/business/analytics-summary", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            business_id: businessId,
            days: 30,
          }),
          cache: "no-store",
        });

        const json = await readJsonSafely(res);

        if (cancelled) {
          return;
        }

        if (!res.ok || !json.ok || !json.summary) {
          setSummary(null);
          setErrorMessage(
            json.error || "Failed to load analytics summary."
          );
          return;
        }

        setSummary(json.summary);
      } catch (error) {
        console.error("BusinessAnalyticsSummary error:", error);

        if (!cancelled) {
          setSummary(null);
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Failed to load analytics summary."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [businessId]);

  if (loading) {
    return (
      <div className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6 text-white">
        Loading analytics...
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="rounded-3xl border border-red-500/30 bg-red-950/30 p-6">
        <div className="text-lg font-bold text-red-300">
          Analytics unavailable
        </div>

        <p className="mt-2 text-sm leading-6 text-red-100/80">
          {errorMessage}
        </p>

        <p className="mt-4 text-xs text-red-100/50">
          Check that this file exists: app/api/business/analytics-summary/route.ts
        </p>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6 text-white">
        No analytics found for the last 30 days.
      </div>
    );
  }

  return (
    <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xl font-bold text-white">
            Last {summary.period_days} Days
          </div>

          <p className="mt-1 text-sm text-white/50">
            Business activity and engagement summary.
          </p>
        </div>

        <div className="rounded-full border border-yellow-500/20 bg-yellow-500/10 px-4 py-2 text-sm font-semibold text-yellow-300">
          {summary.conversion_rate}% conversion
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card title="Total Events" value={summary.total_events} />
        <Card title="Profile Views" value={summary.profile_views} />
        <Card title="Profile Clicks" value={summary.profile_clicks} />
        <Card title="Phone Clicks" value={summary.phone_clicks} />
        <Card title="Website Clicks" value={summary.website_clicks} />
        <Card title="Map Clicks" value={summary.maps_clicks} />
        <Card title="Sponsor Clicks" value={summary.sponsor_clicks} />
        <Card title="Engagement Events" value={summary.engagement_events} />
        <Card title="Conversion Rate" value={`${summary.conversion_rate}%`} />
      </div>
    </section>
  );
}

function Card({
  title,
  value,
}: {
  title: string;
  value: number | string;
}) {
  return (
    <div className="rounded-2xl border border-yellow-500/20 bg-black/30 p-5">
      <div className="text-sm text-yellow-400">{title}</div>

      <div className="mt-2 text-3xl font-black text-white">{value}</div>
    </div>
  );
}

