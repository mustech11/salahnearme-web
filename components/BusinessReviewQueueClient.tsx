"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Business = {
  id: string;
  name: string | null;
  slug: string | null;
  category: string | null;
  city: string | null;
  area: string | null;
  address: string | null;
  postcode: string | null;
  phone: string | null;
  website: string | null;
  maps_url: string | null;
  is_verified: boolean | null;
  featured: boolean | null;
  pricing_tier: string | null;
  halal_confidence: string | null;
  halal_score: number | null;
  halal_signals: string[] | null;
  import_source: string | null;
  import_notes: string | null;
  import_distance_km: number | null;
  imported_for_city: string | null;
  quality_status: string | null;
  quality_reason: string | null;
  review_status: string | null;
  review_notes: string | null;
  reviewed_at: string | null;
  is_live: boolean | null;
  latitude: number | null;
  longitude: number | null;
  google_place_id: string | null;
  osm_type: string | null;
  osm_id: number | null;
  created_at: string | null;
};

type ApiResponse = {
  ok?: boolean;
  count?: number;
  businesses?: Business[];
  error?: string;
};

const CATEGORY_OPTIONS = [
  "halal_restaurant",
  "halal_takeaway",
  "halal_butcher",
  "halal_grocery",
  "halal_supermarket",
  "islamic_bookstore",
  "muslim_clothing",
  "halal_business",
];

function label(value: string | null | undefined) {
  if (!value) return "Not set";

  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function badgeClass(
  type: "status" | "confidence" | "quality",
  value: string | null
) {
  if (type === "status") {
    if (value === "approved") {
      return "border-green-500/30 bg-green-500/10 text-green-300";
    }

    if (value === "rejected") {
      return "border-red-500/30 bg-red-500/10 text-red-300";
    }

    return "border-yellow-500/30 bg-yellow-500/10 text-yellow-300";
  }

  if (type === "confidence") {
    if (value === "high") {
      return "border-green-500/30 bg-green-500/10 text-green-300";
    }

    if (value === "medium") {
      return "border-yellow-500/30 bg-yellow-500/10 text-yellow-300";
    }

    return "border-white/10 bg-white/5 text-white/60";
  }

  if (value?.includes("approved") || value?.includes("verified")) {
    return "border-green-500/30 bg-green-500/10 text-green-300";
  }

  if (value?.includes("rejected")) {
    return "border-red-500/30 bg-red-500/10 text-red-300";
  }

  return "border-blue-500/30 bg-blue-500/10 text-blue-300";
}

export default function BusinessReviewQueueClient() {
  const [status, setStatus] = useState("pending");
  const [confidence, setConfidence] = useState("all");
  const [quality, setQuality] = useState("all");
  const [city, setCity] = useState("all");

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const cities = useMemo(() => {
    return Array.from(
      new Set(businesses.map((b) => b.city).filter(Boolean) as string[])
    ).sort();
  }, [businesses]);

  const stats = useMemo(() => {
    return {
      total: businesses.length,
      live: businesses.filter((b) => b.is_live).length,
      verified: businesses.filter((b) => b.is_verified).length,
      featured: businesses.filter((b) => b.featured).length,
      selected: selectedIds.length,
    };
  }, [businesses, selectedIds]);

  const allVisibleSelected =
    businesses.length > 0 &&
    businesses.every((b) => selectedIds.includes(b.id));

  function toggleSelected(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((x) => x !== id)
        : [...current, id]
    );
  }

  function toggleAllVisible() {
    if (allVisibleSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(businesses.map((b) => b.id));
    }
  }

  async function loadQueue() {
    try {
      setLoading(true);
      setMessage("");
      setErrorMessage("");

      const params = new URLSearchParams({
        status,
        confidence,
        quality,
        city,
        limit: "200",
      });

      const res = await fetch(
        `/api/admin/business-review?${params.toString()}`,
        {
          cache: "no-store",
        }
      );

      const data = (await res.json().catch(() => ({}))) as ApiResponse;

      if (!res.ok || !data.ok) {
        setErrorMessage(data.error ?? "Could not load queue.");
        return;
      }

      setBusinesses(data.businesses ?? []);
      setSelectedIds([]);
    } catch {
      setErrorMessage("Could not load review queue.");
    } finally {
      setLoading(false);
    }
  }

  async function updateBusiness(
    businessId: string,
    action: string,
    extra?: {
      category?: string;
      review_notes?: string;
    }
  ) {
    try {
      setActionLoadingId(businessId);
      setMessage("");
      setErrorMessage("");

      const res = await fetch("/api/admin/business-review", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          business_id: businessId,
          action,
          ...extra,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };

      if (!res.ok || !data.ok) {
        setErrorMessage(data.error ?? "Could not update business.");
        return;
      }

      setMessage("Business updated successfully.");
      await loadQueue();
    } catch {
      setErrorMessage("Could not update business.");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function bulkAction(action: string) {
    if (!selectedIds.length) {
      setErrorMessage("Select at least one business.");
      return;
    }

    try {
      setBulkLoading(true);
      setMessage("");
      setErrorMessage("");

      const res = await fetch("/api/admin/business-review", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bulk: true,
          action,
          business_ids: selectedIds,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        updated?: number;
        error?: string;
      };

      if (!res.ok || !data.ok) {
        setErrorMessage(data.error ?? "Bulk action failed.");
        return;
      }

      setMessage(
        `Updated ${data.updated ?? 0} businesses successfully.`
      );

      await loadQueue();
    } catch {
      setErrorMessage("Bulk action failed.");
    } finally {
      setBulkLoading(false);
    }
  }

  useEffect(() => {
    loadQueue();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, confidence, quality, city]);

  return (
    <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6 md:p-8">
      <div className="grid gap-4 xl:grid-cols-5">
        <Filter label="Status" value={status} onChange={setStatus}>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="all">All</option>
        </Filter>

        <Filter
          label="Confidence"
          value={confidence}
          onChange={setConfidence}
        >
          <option value="all">All</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </Filter>

        <Filter label="Quality" value={quality} onChange={setQuality}>
          <option value="all">All</option>
          <option value="auto_approved">Auto approved</option>
          <option value="needs_review">Needs review</option>
          <option value="auto_rejected">Auto rejected</option>
          <option value="manual_approved">Manual approved</option>
          <option value="manual_rejected">Manual rejected</option>
          <option value="manual_verified">Manual verified</option>
        </Filter>

        <Filter label="City" value={city} onChange={setCity}>
          <option value="all">All cities</option>

          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Filter>

        <div className="flex items-end">
          <button
            type="button"
            onClick={loadQueue}
            disabled={loading}
            className="w-full rounded-2xl bg-yellow-500 px-5 py-3 font-semibold text-black hover:bg-yellow-400 disabled:opacity-50"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-5">
        <Stat label="Showing" value={stats.total} />
        <Stat label="Selected" value={stats.selected} />
        <Stat label="Live" value={stats.live} />
        <Stat label="Verified" value={stats.verified} />
        <Stat label="Featured" value={stats.featured} />
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={toggleAllVisible}
            className="rounded-xl border border-white/10 bg-black px-4 py-2 text-sm font-semibold text-white hover:border-yellow-500/30"
          >
            {allVisibleSelected
              ? "Clear selection"
              : "Select all visible"}
          </button>

          <button
            type="button"
            onClick={() => bulkAction("approve")}
            disabled={bulkLoading || !selectedIds.length}
            className="rounded-xl bg-green-500 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
          >
            Approve selected
          </button>

          <button
            type="button"
            onClick={() => bulkAction("verify")}
            disabled={bulkLoading || !selectedIds.length}
            className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-300 disabled:opacity-50"
          >
            Verify selected
          </button>

          <button
            type="button"
            onClick={() => bulkAction("hide")}
            disabled={bulkLoading || !selectedIds.length}
            className="rounded-xl border border-white/10 bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Hide selected
          </button>

          <button
            type="button"
            onClick={() => bulkAction("reject")}
            disabled={bulkLoading || !selectedIds.length}
            className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Reject selected
          </button>
        </div>
      </div>

      {message && (
        <div className="mt-6 rounded-2xl border border-green-500/30 bg-green-500/10 p-4 text-green-200">
          {message}
        </div>
      )}

      {errorMessage && (
        <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
          {errorMessage}
        </div>
      )}

      <div className="mt-8 space-y-4">
        {businesses.map((business) => (
          <BusinessReviewCard
            key={business.id}
            business={business}
            selected={selectedIds.includes(business.id)}
            loading={actionLoadingId === business.id}
            onSelect={toggleSelected}
            onAction={updateBusiness}
          />
        ))}
      </div>

      {!loading && businesses.length === 0 && (
        <div className="mt-8 rounded-2xl border border-white/10 bg-black/30 p-6 text-white/60">
          No businesses found for this filter.
        </div>
      )}
    </section>
  );
}

function Filter({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-sm font-semibold text-yellow-400">
        {label}
      </label>

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white"
      >
        {children}
      </select>
    </div>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <div className="text-xs uppercase tracking-[0.2em] text-white/50">
        {label}
      </div>

      <div className="mt-2 text-3xl font-bold text-white">
        {value}
      </div>
    </div>
  );
}

function BusinessReviewCard({
  business,
  selected,
  loading,
  onSelect,
  onAction,
}: {
  business: Business;
  selected: boolean;
  loading: boolean;
  onSelect: (id: string) => void;
  onAction: (
    businessId: string,
    action: string,
    extra?: {
      category?: string;
      review_notes?: string;
    }
  ) => Promise<void>;
}) {
  const [category, setCategory] = useState(
    business.category ?? "halal_business"
  );

  const [notes, setNotes] = useState(
    business.review_notes ?? ""
  );

  return (
    <div className="rounded-3xl border border-yellow-500/20 bg-black/30 p-5">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-4 flex items-center gap-3">
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onSelect(business.id)}
              className="h-5 w-5"
            />

            <span className="text-sm text-white/50">
              Select
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-2xl font-bold text-white">
              {business.name}
            </h3>

            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${badgeClass(
                "status",
                business.review_status
              )}`}
            >
              {label(business.review_status)}
            </span>

            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${badgeClass(
                "confidence",
                business.halal_confidence
              )}`}
            >
              {label(business.halal_confidence)} confidence
            </span>

            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${badgeClass(
                "quality",
                business.quality_status
              )}`}
            >
              {label(business.quality_status)}
            </span>

            {business.is_live && (
              <span className="rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-semibold text-green-300">
                Live
              </span>
            )}

            {business.is_verified && (
              <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-300">
                Verified
              </span>
            )}
          </div>

          <div className="mt-3 text-white/70">
            {[
              label(business.category),
              business.area,
              business.city,
              business.postcode,
            ]
              .filter(Boolean)
              .join(" • ")}
          </div>

          {business.address && (
            <div className="mt-2 text-sm text-white/60">
              {business.address}
            </div>
          )}

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <InfoBox title="Import intelligence">
              <div>Score: {business.halal_score ?? "—"}</div>

              <div>
                Source: {label(business.import_source)}
              </div>

              <div>
                Imported for:{" "}
                {business.imported_for_city ?? "—"}
              </div>

              <div>
                Distance:{" "}
                {business.import_distance_km
                  ? `${Number(
                      business.import_distance_km
                    ).toFixed(1)}km`
                  : "—"}
              </div>
            </InfoBox>

            <InfoBox title="Quality reason">
              {business.quality_reason ??
                business.import_notes ??
                "No reason saved."}
            </InfoBox>

            <InfoBox title="Signals">
              <div className="flex flex-wrap gap-2">
                {(business.halal_signals ?? []).length > 0 ? (
                  business.halal_signals?.map((signal) => (
                    <span
                      key={signal}
                      className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/70"
                    >
                      {signal}
                    </span>
                  ))
                ) : (
                  <span>No signals</span>
                )}
              </div>
            </InfoBox>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {business.slug && (
              <Link
                href={`/business/${business.slug}`}
                target="_blank"
                className="rounded-xl border border-yellow-500/30 bg-black px-4 py-2 text-sm font-semibold text-yellow-400 hover:bg-yellow-500/10"
              >
                View page
              </Link>
            )}

            {business.maps_url && (
              <a
                href={business.maps_url}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-yellow-500/30 bg-black px-4 py-2 text-sm font-semibold text-yellow-400 hover:bg-yellow-500/10"
              >
                Open map
              </a>
            )}

            {business.website && (
              <a
                href={business.website}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-white/10 bg-black px-4 py-2 text-sm font-semibold text-white hover:border-yellow-500/30"
              >
                Website
              </a>
            )}

            {business.phone && (
              <a
                href={`tel:${business.phone}`}
                className="rounded-xl border border-white/10 bg-black px-4 py-2 text-sm font-semibold text-white hover:border-yellow-500/30"
              >
                Call
              </a>
            )}
          </div>
        </div>

        <div className="w-full shrink-0 xl:w-[360px]">
          <div>
            <label className="text-sm font-semibold text-yellow-400">
              Category
            </label>

            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white"
            >
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {label(option)}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4">
            <label className="text-sm font-semibold text-yellow-400">
              Review notes
            </label>

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-2 w-full rounded-2xl border border-yellow-500/30 bg-black px-4 py-3 text-white"
              placeholder="Optional admin note"
            />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() =>
                onAction(business.id, "approve", {
                  review_notes: notes,
                })
              }
              className="rounded-xl bg-green-500 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
            >
              Approve
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() =>
                onAction(business.id, "reject", {
                  review_notes: notes,
                })
              }
              className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Reject
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() =>
                onAction(business.id, "verify", {
                  review_notes: notes,
                })
              }
              className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-300 disabled:opacity-50"
            >
              Verify
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() =>
                onAction(business.id, "hide", {
                  review_notes: notes,
                })
              }
              className="rounded-xl border border-white/10 bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Hide
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() =>
                onAction(business.id, "update", {
                  category,
                  review_notes: notes,
                })
              }
              className="col-span-2 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-sm font-semibold text-yellow-400 disabled:opacity-50"
            >
              Save category / notes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoBox({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 p-4 text-sm text-white/70">
      <div className="mb-2 text-xs uppercase tracking-[0.2em] text-yellow-400">
        {title}
      </div>

      {children}
    </div>
  );
}

