"use client";

import Link from "next/link";
import { useState } from "react";

type MosqueRow = {
  id: string;
  name: string | null;
  slug: string | null;
  city: string | null;
  postcode: string | null;
  address: string | null;
  area: string | null;
  source: string | null;
  verified_status: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string | null;
};

type Props = {
  groups: MosqueRow[][];
};

function value(v: string | number | null | undefined) {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function mapUrl(m: MosqueRow) {
  if (typeof m.latitude === "number" && typeof m.longitude === "number") {
    return `https://www.google.com/maps/search/?api=1&query=${m.latitude},${m.longitude}`;
  }

  const q = [m.name, m.address, m.postcode, m.city].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    q
  )}`;
}

export default function MosqueDuplicateReviewClient({ groups }: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function mergeDuplicate(keepId: string, removeId: string) {
    try {
      setLoading(removeId);
      setMessage("");

      const confirmed = window.confirm(
        "Merge this duplicate into the keep record? This will delete the weaker duplicate after copying missing data."
      );

      if (!confirmed) return;

      const res = await fetch("/api/admin/mosque-duplicates/merge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          keep_id: keepId,
          remove_id: removeId,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMessage(data.error ?? "Merge failed.");
        return;
      }

      setMessage("Mosque duplicate merged successfully.");

      setTimeout(() => {
        window.location.reload();
      }, 700);
    } finally {
      setLoading(null);
    }
  }

  if (!groups.length) {
    return (
      <section className="rounded-3xl border border-green-500/20 bg-green-500/10 p-8 text-green-200">
        No duplicate mosque groups found.
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {message && (
        <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-yellow-300">
          {message}
        </div>
      )}

      {groups.map((group, index) => {
        const keep = group[0];
        const duplicates = group.slice(1);

        return (
          <section
            key={`${keep.id}-${index}`}
            className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6"
          >
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
                Duplicate Group {index + 1}
              </div>

              <div className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-400">
                {group.length} records
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <MosqueCard mosque={keep} label="Keep Record" mode="keep" />

              <div className="space-y-4">
                {duplicates.map((duplicate) => (
                  <div
                    key={duplicate.id}
                    className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5"
                  >
                    <MosqueCard
                      mosque={duplicate}
                      label="Duplicate Record"
                      mode="duplicate"
                    />

                    <button
                      type="button"
                      disabled={loading === duplicate.id}
                      onClick={() => mergeDuplicate(keep.id, duplicate.id)}
                      className="mt-5 rounded-xl bg-yellow-500 px-4 py-3 text-sm font-semibold text-black hover:bg-yellow-400 disabled:opacity-50"
                    >
                      {loading === duplicate.id
                        ? "Merging..."
                        : "Merge into keep record"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function MosqueCard({
  mosque,
  label,
  mode,
}: {
  mosque: MosqueRow;
  label: string;
  mode: "keep" | "duplicate";
}) {
  const isKeep = mode === "keep";

  return (
    <div
      className={
        isKeep
          ? "rounded-2xl border border-green-500/30 bg-green-500/10 p-5"
          : ""
      }
    >
      <div
        className={
          isKeep
            ? "text-xs uppercase tracking-[0.2em] text-green-300"
            : "text-xs uppercase tracking-[0.2em] text-red-300"
        }
      >
        {label}
      </div>

      <h2 className="mt-3 text-2xl font-bold text-white">{mosque.name}</h2>

      <div className="mt-3 grid gap-2 text-sm text-white/70">
        <div>
          <span className="text-white/40">Address:</span>{" "}
          {value(mosque.address)}
        </div>
        <div>
          <span className="text-white/40">Area:</span> {value(mosque.area)}
        </div>
        <div>
          <span className="text-white/40">Postcode:</span>{" "}
          {value(mosque.postcode)}
        </div>
        <div>
          <span className="text-white/40">City:</span> {value(mosque.city)}
        </div>
        <div>
          <span className="text-white/40">Coordinates:</span>{" "}
          {typeof mosque.latitude === "number" &&
          typeof mosque.longitude === "number"
            ? `${mosque.latitude}, ${mosque.longitude}`
            : "—"}
        </div>
        <div>
          <span className="text-white/40">Slug:</span> {value(mosque.slug)}
        </div>
        <div>
          <span className="text-white/40">Created:</span>{" "}
          {formatDate(mosque.created_at)}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <span
          className={
            isKeep
              ? "rounded-full border border-green-500/30 px-3 py-1 text-green-300"
              : "rounded-full border border-red-500/30 px-3 py-1 text-red-300"
          }
        >
          {mosque.verified_status ?? "unknown"}
        </span>

        <span className="rounded-full border border-white/10 px-3 py-1 text-white/60">
          {mosque.source ?? "unknown source"}
        </span>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        {mosque.slug && (
          <Link
            href={`/mosque/${mosque.slug}`}
            className="rounded-xl border border-yellow-500/30 bg-black px-4 py-2 text-sm font-semibold text-yellow-400 hover:bg-yellow-500/10"
          >
            View page
          </Link>
        )}

        <a
          href={mapUrl(mosque)}
          target="_blank"
          rel="noreferrer"
          className="rounded-xl border border-white/10 bg-black px-4 py-2 text-sm font-semibold text-white hover:border-yellow-500/30"
        >
          Open map
        </a>
      </div>
    </div>
  );
}

