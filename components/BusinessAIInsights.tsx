"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  businessId: string;
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

  // New preferred API field
  engagement_rate?: number;

  // Old fallback field so nothing breaks
  conversion_rate?: number;

  performance: string;
  recommendations?: string[];
};

type ApiResponse = {
  ok: boolean;
  insights?: Insights;
  error?: string;
};

async function readJsonSafely(res: Response): Promise<ApiResponse> {
  const contentType = res.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    const text = await res.text();

    return {
      ok: false,
      error: `API returned ${
        contentType || "unknown content type"
      }. First response text: ${text.slice(0, 140)}`,
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

export default function BusinessAIInsights({ businessId }: Props) {
  const [data, setData] = useState<Insights | null>(null);
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

        const res = await fetch("/api/business/ai-insights", {
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

        if (!res.ok || !json.ok || !json.insights) {
          setData(null);
          setErrorMessage(json.error || "Failed to load AI insights.");
          return;
        }

        setData(json.insights);
      } catch (error) {
        console.error("BusinessAIInsights error:", error);

        if (!cancelled) {
          setData(null);
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Failed to load AI insights."
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

  const engagementRate = useMemo(() => {
    if (!data) {
      return 0;
    }

    const rate = data.engagement_rate ?? data.conversion_rate ?? 0;

    return Math.min(Math.max(rate, 0), 100);
  }, [data]);

  if (loading) {
    return (
      <div className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6 text-white">
        Loading AI insights...
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="rounded-3xl border border-red-500/30 bg-red-950/30 p-6">
        <div className="text-lg font-bold text-red-300">
          AI insights unavailable
        </div>

        <p className="mt-2 text-sm leading-6 text-red-100/80">
          {errorMessage}
        </p>

        <p className="mt-4 text-xs text-red-100/50">
          Check that this route works: /api/business/ai-insights
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6 text-white">
        No AI insights available yet.
      </div>
    );
  }

  return (
    <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
            AI Insights
          </div>

          <div className="mt-2 text-3xl font-black text-white">
            {data.performance}
          </div>

          <p className="mt-2 text-sm text-white/50">
            Based on the last {data.period_days ?? 30} days of activity.
          </p>
        </div>

        <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 px-5 py-3 text-right">
          <div className="text-xs uppercase tracking-[0.2em] text-yellow-400">
            Engagement Rate
          </div>

          <div className="text-3xl font-black text-white">
            {engagementRate}%
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card title="Profile Views" value={data.profile_views} />
        <Card title="Profile Clicks" value={data.profile_clicks ?? 0} />
        <Card title="Phone Clicks" value={data.phone_clicks} />
        <Card title="Website Clicks" value={data.website_clicks} />
        <Card title="Maps Clicks" value={data.maps_clicks} />
        <Card title="Sponsor Clicks" value={data.sponsor_clicks} />
        <Card title="Engagement Events" value={data.engagement_events ?? 0} />
        <Card title="Engagement Score" value={data.engagement_score} />
        <Card title="Engagement Rate" value={`${engagementRate}%`} />
      </div>

      {data.recommendations && data.recommendations.length > 0 ? (
        <div className="mt-6 rounded-2xl border border-yellow-500/20 bg-black/30 p-5">
          <div className="text-sm font-bold uppercase tracking-[0.25em] text-yellow-400">
            Recommendations
          </div>

          <ul className="mt-4 space-y-3">
            {data.recommendations.map((item, index) => (
              <li
                key={`${item}-${index}`}
                className="flex gap-3 text-sm leading-6 text-white/75"
              >
                <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-yellow-400" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
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

