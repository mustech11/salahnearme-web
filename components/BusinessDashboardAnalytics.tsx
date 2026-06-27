"use client";

import { useEffect, useState } from "react";

type Props = {
  businessId: string;
};

type AnalyticsResponse = {
  ok?: boolean;
  counts?: {
    profile_view: number;
    phone_click: number;
    website_click: number;
    maps_click: number;
    sponsor_impression: number;
    sponsor_click: number;
  };
  error?: string;
};

type StatCardProps = {
  title: string;
  value: number;
  description: string;
};

function StatCard({
  title,
  value,
  description,
}: StatCardProps) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/30 p-6">
      <div className="text-xs uppercase tracking-[0.2em] text-yellow-400">
        {title}
      </div>

      <div className="mt-4 text-4xl font-black text-white">
        {value}
      </div>

      <div className="mt-2 text-sm text-white/60">
        {description}
      </div>
    </div>
  );
}

export default function BusinessDashboardAnalytics({
  businessId,
}: Props) {
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [counts, setCounts] = useState({
    profile_view: 0,
    phone_click: 0,
    website_click: 0,
    maps_click: 0,
    sponsor_impression: 0,
    sponsor_click: 0,
  });

  async function loadAnalytics() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch(
        `/api/business-dashboard/analytics?business_id=${businessId}`,
        {
          cache: "no-store",
        }
      );

      const data =
        (await res.json().catch(() => ({}))) as AnalyticsResponse;

      if (!res.ok || !data.ok) {
        setError(data.error ?? "Could not load analytics.");
        return;
      }

      if (data.counts) {
        setCounts(data.counts);
      }
    } catch {
      setError("Could not load analytics.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAnalytics();
  }, [businessId]);

  if (loading) {
    return (
      <section className="rounded-3xl border border-white/10 bg-[rgb(var(--card))] p-8">
        <div className="text-white/70">
          Loading analytics...
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-3xl border border-red-500/20 bg-red-500/10 p-8 text-red-300">
        {error}
      </section>
    );
  }

  const totalEngagement =
    counts.profile_view +
    counts.phone_click +
    counts.website_click +
    counts.maps_click;

  return (
    <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-sm uppercase tracking-[0.25em] text-yellow-400">
            Analytics
          </div>

          <h2 className="mt-3 text-3xl font-black text-white">
            Last 30 Days
          </h2>
        </div>

        <button
          type="button"
          onClick={loadAnalytics}
          className="rounded-2xl border border-yellow-500/30 px-5 py-3 text-sm font-semibold text-yellow-400 hover:bg-yellow-500/10"
        >
          Refresh
        </button>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StatCard
          title="Profile Views"
          value={counts.profile_view}
          description="Business page visits"
        />

        <StatCard
          title="Phone Clicks"
          value={counts.phone_click}
          description="Users tapped call"
        />

        <StatCard
          title="Website Clicks"
          value={counts.website_click}
          description="Outbound website visits"
        />

        <StatCard
          title="Maps Clicks"
          value={counts.maps_click}
          description="Direction requests"
        />

        <StatCard
          title="Sponsor Impressions"
          value={counts.sponsor_impression}
          description="Sponsor visibility"
        />

        <StatCard
          title="Sponsor Clicks"
          value={counts.sponsor_click}
          description="Sponsor engagement"
        />
      </div>

      <div className="mt-8 rounded-3xl border border-yellow-500/20 bg-black/30 p-6">
        <div className="text-xs uppercase tracking-[0.2em] text-yellow-400">
          Total Engagement
        </div>

        <div className="mt-3 text-5xl font-black text-white">
          {totalEngagement}
        </div>

        <div className="mt-2 text-sm text-white/60">
          Combined profile interactions across your listing
        </div>
      </div>
    </section>
  );
}

