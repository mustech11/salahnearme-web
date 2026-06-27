"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import BuyFeaturedButton from "@/components/BuyFeaturedButton";

type Business = {
  id: string;
  name?: string | null;
  slug?: string | null;
  category?: string | null;
  address?: string | null;
  postcode?: string | null;
  city?: string | null;
  phone?: string | null;
  website?: string | null;
  maps_url?: string | null;
  is_live?: boolean | null;
  is_verified?: boolean | null;
  is_claimed?: boolean | null;
  claimed_by_email?: string | null;
  featured?: boolean | null;
  featured_rank?: number | null;
  paid_until?: string | null;
  pricing_tier?: string | null;
  subscription_type?: string | null;
  sponsorship_active?: boolean | null;
  city_sponsor?: boolean | null;
  mosque_sponsor?: boolean | null;
  sponsor_mosque_id?: string | null;
  review_status?: string | null;
};

type Mosque = {
  id: string;
  name?: string | null;
  area?: string | null;
  postcode?: string | null;
};

type Props = {
  initialBusinesses: Business[];
  mosques: Mosque[];
  selectedMosqueId?: string;
  selectedPlan?: string;
};

type Patch = Partial<
  Pick<
    Business,
    | "is_live"
    | "featured"
    | "featured_rank"
    | "paid_until"
    | "pricing_tier"
    | "subscription_type"
    | "sponsorship_active"
    | "city_sponsor"
    | "mosque_sponsor"
    | "sponsor_mosque_id"
    | "website"
    | "phone"
    | "maps_url"
    | "is_verified"
  >
>;

function isoToDateInput(iso?: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function dateInputToIso(value: string) {
  return new Date(`${value}T23:59:59.999Z`).toISOString();
}

function isPaidActive(value?: string | null) {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time > Date.now();
}

function isExpiringSoon(value?: string | null) {
  if (!value) return false;

  const expiry = new Date(value).getTime();
  if (!Number.isFinite(expiry)) return false;

  const now = Date.now();
  const sevenDays = now + 7 * 24 * 60 * 60 * 1000;

  return expiry >= now && expiry <= sevenDays;
}

function isExpired(value?: string | null) {
  if (!value) return false;
  const expiry = new Date(value).getTime();
  return Number.isFinite(expiry) && expiry < Date.now();
}

function formatLabel(value?: string | null) {
  if (!value) return "Free";

  return value
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

async function postManage(body: unknown) {
  const res = await fetch("/api/admin/businesses/manage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok || !json.ok) {
    throw new Error(json.error ?? "Business update failed.");
  }

  return json;
}

export default function AdminBusinessesClient({
  initialBusinesses,
  mosques,
  selectedMosqueId,
  selectedPlan,
}: Props) {
  const [rows, setRows] = useState<Business[]>(initialBusinesses ?? []);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filterCity, setFilterCity] = useState("");
  const [filterFeatured, setFilterFeatured] = useState("");
  const [filterLive, setFilterLive] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const selectedMosque = useMemo(() => {
    return (mosques ?? []).find((m) => m.id === selectedMosqueId) ?? null;
  }, [mosques, selectedMosqueId]);

  const mosqueOptions = useMemo(
    () =>
      (mosques ?? []).map((m) => ({
        id: m.id,
        label: `${m.name ?? "Mosque"}${m.area ? ` - ${m.area}` : ""}${
          m.postcode ? ` (${m.postcode})` : ""
        }`,
      })),
    [mosques]
  );

  const cityOptions = useMemo(() => {
    return Array.from(
      new Set(rows.map((r) => r.city).filter(Boolean) as string[])
    ).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    let result = rows;

    const query = q.trim().toLowerCase();

    if (query) {
      result = result.filter((r) =>
        [r.name, r.category, r.city, r.postcode, r.address]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query)
      );
    }

    if (filterCity) result = result.filter((r) => r.city === filterCity);
    if (filterFeatured === "featured") result = result.filter((r) => r.featured);
    if (filterFeatured === "not_featured")
      result = result.filter((r) => !r.featured);
    if (filterLive === "live") result = result.filter((r) => r.is_live);
    if (filterLive === "hidden") result = result.filter((r) => !r.is_live);

    return result;
  }, [rows, q, filterCity, filterFeatured, filterLive]);

  const featured = useMemo(() => {
    return rows
      .filter((r) => r.featured)
      .sort((a, b) => (a.featured_rank ?? 9999) - (b.featured_rank ?? 9999));
  }, [rows]);

  const stats = useMemo(() => {
    return {
      total: rows.length,
      live: rows.filter((r) => r.is_live).length,
      featured: rows.filter((r) => r.featured).length,
      paidActive: rows.filter((r) => isPaidActive(r.paid_until)).length,
      sponsoredMosques: rows.filter((r) => r.sponsor_mosque_id).length,
      expiringSoon: rows.filter((r) => isExpiringSoon(r.paid_until)).length,
      expired: rows.filter((r) => isExpired(r.paid_until)).length,
    };
  }, [rows]);

  async function updateBusiness(id: string, patch: Patch) {
    try {
      setSavingId(id);
      setMessage("");
      setErrorMessage("");

      await postManage({
        business_id: id,
        patch,
      });

      setRows((prev) =>
        prev.map((row) => (row.id === id ? { ...row, ...patch } : row))
      );

      setMessage("Business updated.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not update business."
      );
    } finally {
      setSavingId(null);
    }
  }

  async function bulkUpdate(patch: Patch) {
    if (selected.size === 0) {
      setErrorMessage("Select at least one business first.");
      return;
    }

    try {
      setMessage("");
      setErrorMessage("");

      const ids = Array.from(selected);

      await postManage({
        bulk: true,
        business_ids: ids,
        patch,
      });

      setRows((prev) =>
        prev.map((row) => (selected.has(row.id) ? { ...row, ...patch } : row))
      );

      setSelected(new Set());
      setMessage(`Updated ${ids.length} businesses.`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Bulk update failed."
      );
    }
  }

  async function saveRanks() {
    try {
      setMessage("");
      setErrorMessage("");

      const orderedIds = featured.map((item) => item.id);

      await postManage({
        reorder_featured: true,
        ordered_ids: orderedIds,
      });

      setMessage("Featured ranks saved.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not save ranks."
      );
    }
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      {selectedPlan === "sponsor" && selectedMosque && (
        <section className="rounded-3xl border border-yellow-500/30 bg-yellow-500/10 p-5">
          <div className="text-lg font-bold text-yellow-400">
            Mosque Sponsorship Flow
          </div>
          <p className="mt-2 text-sm text-white/70">
            You are preparing a sponsorship for{" "}
            <span className="font-semibold text-white">
              {selectedMosque.name}
            </span>
            . Choose a business below and attach it to this mosque.
          </p>
        </section>
      )}

      <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-7">
        <Stat title="Total" value={stats.total} />
        <Stat title="Live" value={stats.live} />
        <Stat title="Featured" value={stats.featured} />
        <Stat title="Paid Active" value={stats.paidActive} />
        <Stat title="Mosque Sponsors" value={stats.sponsoredMosques} />
        <Stat title="Expiring Soon" value={stats.expiringSoon} warning />
        <Stat title="Expired" value={stats.expired} danger />
      </section>

      {message && (
        <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-200">
          {message}
        </div>
      )}

      {errorMessage && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {errorMessage}
        </div>
      )}

      {selected.size > 0 && (
        <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-green-500/30 bg-green-500/10 p-4">
          <div className="text-sm font-semibold text-green-200">
            {selected.size} selected
          </div>

          <button
            onClick={() => bulkUpdate({ is_live: true })}
            className="rounded-xl bg-green-500 px-3 py-2 text-xs font-semibold text-black"
            type="button"
          >
            Make live
          </button>

          <button
            onClick={() => bulkUpdate({ is_live: false })}
            className="rounded-xl bg-red-500 px-3 py-2 text-xs font-semibold text-white"
            type="button"
          >
            Hide
          </button>

          <button
            onClick={() => bulkUpdate({ featured: true })}
            className="rounded-xl bg-yellow-500 px-3 py-2 text-xs font-semibold text-black"
            type="button"
          >
            Feature
          </button>

          <button
            onClick={() =>
              bulkUpdate({
                featured: false,
                featured_rank: null,
                sponsorship_active: false,
                city_sponsor: false,
                mosque_sponsor: false,
                sponsor_mosque_id: null,
              })
            }
            className="rounded-xl border border-white/10 bg-black px-3 py-2 text-xs font-semibold text-white"
            type="button"
          >
            Remove sponsor
          </button>

          <button
            onClick={() => setSelected(new Set())}
            className="rounded-xl border border-white/10 bg-black px-3 py-2 text-xs text-white/70"
            type="button"
          >
            Clear
          </button>
        </section>
      )}

      <section className="grid gap-3 md:grid-cols-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search businesses..."
          className="rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white"
        />

        <select
          value={filterCity}
          onChange={(e) => setFilterCity(e.target.value)}
          className="rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white"
        >
          <option value="">All cities</option>
          {cityOptions.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>

        <select
          value={filterFeatured}
          onChange={(e) => setFilterFeatured(e.target.value)}
          className="rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white"
        >
          <option value="">All listings</option>
          <option value="featured">Featured</option>
          <option value="not_featured">Not featured</option>
        </select>

        <select
          value={filterLive}
          onChange={(e) => setFilterLive(e.target.value)}
          className="rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white"
        >
          <option value="">All visibility</option>
          <option value="live">Live</option>
          <option value="hidden">Hidden</option>
        </select>
      </section>

      <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-lg font-bold text-yellow-400">
              Featured ranking
            </div>
            <p className="mt-1 text-xs text-white/60">
              Lower rank appears higher. Edit ranks below, then save.
            </p>
          </div>

          <button
            type="button"
            onClick={saveRanks}
            className="rounded-xl border border-yellow-500/30 bg-black px-4 py-2 text-sm font-semibold text-yellow-400 hover:bg-yellow-500/10"
          >
            Save ranks
          </button>
        </div>

        <div className="mt-4 grid gap-3">
          {featured.length === 0 ? (
            <div className="text-sm text-white/60">
              No featured businesses yet.
            </div>
          ) : (
            featured.map((business) => (
              <div
                key={business.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/30 p-4"
              >
                <div>
                  <div className="font-semibold text-white">
                    {business.name ?? "Untitled"}
                  </div>
                  <div className="text-xs text-white/50">
                    {business.city ?? "No city"} •{" "}
                    {formatLabel(business.pricing_tier)}
                  </div>
                </div>

                <input
                  type="number"
                  value={business.featured_rank ?? 100}
                  onChange={(e) =>
                    updateBusiness(business.id, {
                      featured_rank: Number(e.target.value),
                    })
                  }
                  className="w-24 rounded-xl border border-white/10 bg-black px-3 py-2 text-xs text-white"
                />
              </div>
            ))
          )}
        </div>
      </section>

      <section className="grid gap-4">
        {filtered.map((business) => (
          <BusinessCard
            key={business.id}
            business={business}
            selected={selected.has(business.id)}
            saving={savingId === business.id}
            mosqueOptions={mosqueOptions}
            selectedMosqueId={selectedMosqueId}
            selectedPlan={selectedPlan}
            onSelect={toggleSelected}
            onUpdate={updateBusiness}
          />
        ))}
      </section>
    </div>
  );
}

function BusinessCard({
  business,
  selected,
  saving,
  mosqueOptions,
  selectedMosqueId,
  selectedPlan,
  onSelect,
  onUpdate,
}: {
  business: Business;
  selected: boolean;
  saving: boolean;
  mosqueOptions: Array<{ id: string; label: string }>;
  selectedMosqueId?: string;
  selectedPlan?: string;
  onSelect: (id: string) => void;
  onUpdate: (id: string, patch: Patch) => Promise<void>;
}) {
  const paidActive = isPaidActive(business.paid_until);

  return (
    <div className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-5">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onSelect(business.id)}
              className="mt-1 h-4 w-4"
            />

            <div>
              <div className="text-xl font-bold text-white">
                {business.name ?? "Untitled"}
              </div>

              <div className="mt-1 text-sm text-white/60">
                {[business.category, business.city, business.postcode]
                  .filter(Boolean)
                  .join(" • ")}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {business.is_live && <Badge text="Live" green />}
                {business.featured && <Badge text="Featured" />}
                {business.is_verified && <Badge text="Verified" green />}
                {business.sponsorship_active && <Badge text="Sponsor Active" />}
                {business.city_sponsor && <Badge text="City Sponsor" />}
                {business.mosque_sponsor && <Badge text="Mosque Sponsor" />}
                {paidActive && <Badge text="Paid Active" green />}
                {isExpiringSoon(business.paid_until) && (
                  <Badge text="Expiring Soon" />
                )}
                {isExpired(business.paid_until) && (
                  <Badge text="Expired" danger />
                )}
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {business.slug && (
              <Link
                href={`/business/${business.slug}`}
                target="_blank"
                className="rounded-xl border border-yellow-500/30 bg-black px-4 py-2 text-xs font-semibold text-yellow-400 hover:bg-yellow-500/10"
              >
                View page
              </Link>
            )}

            <BuyFeaturedButton businessId={business.id} plan="featured" />

            {(business.sponsor_mosque_id ||
              (selectedPlan === "sponsor" && selectedMosqueId)) && (
              <BuyFeaturedButton
                businessId={business.id}
                plan="sponsor"
                sponsorMosqueId={
                  business.sponsor_mosque_id ??
                  (selectedPlan === "sponsor" ? selectedMosqueId ?? null : null)
                }
              />
            )}
          </div>
        </div>

        <div className="grid w-full gap-3 xl:w-[520px]">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex items-center gap-2 text-xs text-white/70">
              <input
                type="checkbox"
                checked={Boolean(business.is_live)}
                onChange={(e) =>
                  onUpdate(business.id, { is_live: e.target.checked })
                }
              />
              Live
            </label>

            <label className="flex items-center gap-2 text-xs text-white/70">
              <input
                type="checkbox"
                checked={Boolean(business.featured)}
                onChange={(e) =>
                  onUpdate(business.id, { featured: e.target.checked })
                }
              />
              Featured
            </label>

            <label className="flex items-center gap-2 text-xs text-white/70">
              <input
                type="checkbox"
                checked={Boolean(business.is_verified)}
                onChange={(e) =>
                  onUpdate(business.id, { is_verified: e.target.checked })
                }
              />
              Verified
            </label>

            <label className="flex items-center gap-2 text-xs text-white/70">
              <input
                type="checkbox"
                checked={Boolean(business.sponsorship_active)}
                onChange={(e) =>
                  onUpdate(business.id, {
                    sponsorship_active: e.target.checked,
                  })
                }
              />
              Sponsorship active
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <input
              type="number"
              value={business.featured_rank ?? 100}
              onChange={(e) =>
                onUpdate(business.id, {
                  featured_rank: Number(e.target.value),
                })
              }
              className="rounded-xl border border-white/10 bg-black px-3 py-2 text-xs text-white"
              placeholder="Rank"
            />

            <select
              value={business.pricing_tier ?? "free"}
              onChange={(e) =>
                onUpdate(business.id, {
                  pricing_tier: e.target.value,
                  subscription_type: e.target.value,
                })
              }
              className="rounded-xl border border-white/10 bg-black px-3 py-2 text-xs text-white"
            >
              <option value="free">Free</option>
              <option value="verified">Verified</option>
              <option value="bronze">Bronze</option>
              <option value="silver">Silver</option>
              <option value="gold">Gold</option>
              <option value="platinum">Platinum</option>
              <option value="featured">Featured</option>
              <option value="mosque_sponsor">Mosque Sponsor</option>
              <option value="city_sponsor">City Sponsor</option>
            </select>

            <input
              type="date"
              value={isoToDateInput(business.paid_until)}
              onChange={(e) =>
                onUpdate(business.id, {
                  paid_until: e.target.value
                    ? dateInputToIso(e.target.value)
                    : null,
                })
              }
              className="rounded-xl border border-white/10 bg-black px-3 py-2 text-xs text-white"
            />
          </div>

          <select
            value={
              business.sponsor_mosque_id ??
              (selectedPlan === "sponsor" ? selectedMosqueId ?? "" : "")
            }
            onChange={(e) =>
              onUpdate(business.id, {
                sponsor_mosque_id: e.target.value || null,
                mosque_sponsor: Boolean(e.target.value),
              })
            }
            className="rounded-xl border border-white/10 bg-black px-3 py-2 text-xs text-white"
          >
            <option value="">No sponsored mosque</option>
            {mosqueOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>

          <div className="grid gap-3 md:grid-cols-3">
            <input
              value={business.website ?? ""}
              onChange={(e) =>
                onUpdate(business.id, { website: e.target.value })
              }
              className="rounded-xl border border-white/10 bg-black px-3 py-2 text-xs text-white"
              placeholder="Website"
            />

            <input
              value={business.phone ?? ""}
              onChange={(e) =>
                onUpdate(business.id, { phone: e.target.value })
              }
              className="rounded-xl border border-white/10 bg-black px-3 py-2 text-xs text-white"
              placeholder="Phone"
            />

            <input
              value={business.maps_url ?? ""}
              onChange={(e) =>
                onUpdate(business.id, { maps_url: e.target.value })
              }
              className="rounded-xl border border-white/10 bg-black px-3 py-2 text-xs text-white"
              placeholder="Maps URL"
            />
          </div>

          {saving && <div className="text-xs text-yellow-400">Saving...</div>}
        </div>
      </div>
    </div>
  );
}

function Stat({
  title,
  value,
  warning,
  danger,
}: {
  title: string;
  value: number;
  warning?: boolean;
  danger?: boolean;
}) {
  const className = danger
    ? "border-red-500/30 bg-red-500/10"
    : warning
    ? "border-yellow-500/30 bg-yellow-500/10"
    : "border-white/10 bg-[rgb(var(--card))]";

  return (
    <div className={`rounded-2xl border p-4 ${className}`}>
      <div className="text-xs uppercase tracking-[0.2em] text-white/50">
        {title}
      </div>
      <div className="mt-2 text-2xl font-bold text-white">{value}</div>
    </div>
  );
}

function Badge({
  text,
  green,
  danger,
}: {
  text: string;
  green?: boolean;
  danger?: boolean;
}) {
  const className = danger
    ? "border-red-500/30 bg-red-500/10 text-red-300"
    : green
    ? "border-green-500/30 bg-green-500/10 text-green-300"
    : "border-yellow-500/30 bg-yellow-500/10 text-yellow-400";

  return (
    <span className={`rounded-full border px-2 py-1 text-xs ${className}`}>
      {text}
    </span>
  );
}

