"use client";

import { useMemo, useRef, useState } from "react";
import {
  buildBusinessMergeSuggestions,
  type BusinessMergeRow,
} from "@/lib/businessMergeSuggestions";

type Props = {
  queueId: string;
  left: BusinessMergeRow;
  right: BusinessMergeRow;
};

type FieldKey = keyof BusinessMergeRow;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const REQUEST_TIMEOUT_MS = 25_000;

const fields: Array<{ key: FieldKey; label: string }> = [
  { key: "name", label: "Name" },
  { key: "slug", label: "Slug" },
  { key: "category", label: "Category" },
  { key: "city", label: "City" },
  { key: "area", label: "Area" },
  { key: "address", label: "Address" },
  { key: "postcode", label: "Postcode" },
  { key: "website", label: "Website" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "maps_url", label: "Maps URL" },
  { key: "latitude", label: "Latitude" },
  { key: "longitude", label: "Longitude" },
  { key: "is_verified", label: "Verified" },
  { key: "featured", label: "Featured" },
  { key: "featured_rank", label: "Featured rank" },
  { key: "can_advertise", label: "Can advertise" },
  { key: "is_claimed", label: "Is claimed" },
  { key: "pricing_tier", label: "Pricing tier" },
  { key: "paid_until", label: "Paid until" },
  { key: "sponsor_mosque_id", label: "Sponsor mosque ID" },
  { key: "submitted_by_email", label: "Submitted by email" },
  { key: "claimed_by_email", label: "Claimed by email" },
  { key: "stripe_customer_id", label: "Stripe customer ID" },
  { key: "stripe_subscription_id", label: "Stripe subscription ID" },
  { key: "status", label: "Status" },
];

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function sameValue(a: unknown, b: unknown) {
  return (a ?? null) === (b ?? null);
}

export default function BusinessMergeEditor({ queueId, left, right }: Props) {
  const suggestions = useMemo(
    () => buildBusinessMergeSuggestions(left, right),
    [left, right]
  );

  const requestControllerRef = useRef<AbortController | null>(null);
  const [primarySide, setPrimarySide] = useState<"left" | "right">("left");
  const [selected, setSelected] = useState<Record<string, "left" | "right">>(() =>
    Object.fromEntries(
      fields.map((field) => [
        field.key,
        suggestions[field.key]?.side ?? "left",
      ])
    )
  );
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const primaryId = primarySide === "left" ? left.id : right.id;
  const duplicateId = primarySide === "left" ? right.id : left.id;

  const differingFields = useMemo(
    () => fields.filter((field) => !sameValue(left[field.key], right[field.key])),
    [left, right]
  );

  const suggestedSelectionCount = useMemo(
    () =>
      fields.filter(
        (field) =>
          selected[field.key] === (suggestions[field.key]?.side ?? "left")
      ).length,
    [selected, suggestions]
  );

  const merged = useMemo(() => {
    const result: Record<string, unknown> = {};

    for (const field of fields) {
      const source = selected[field.key] ?? "left";
      result[field.key] = source === "left" ? left[field.key] : right[field.key];
    }

    return result;
  }, [left, right, selected]);

  function chooseAll(side: "left" | "right") {
    setSelected(Object.fromEntries(fields.map((field) => [field.key, side])));
  }

  function chooseSuggested() {
    setSelected(
      Object.fromEntries(
        fields.map((field) => [
          field.key,
          suggestions[field.key]?.side ?? "left",
        ])
      )
    );
  }

  async function submitMerge() {
    if (
      !UUID_REGEX.test(queueId) ||
      !UUID_REGEX.test(primaryId) ||
      !UUID_REGEX.test(duplicateId) ||
      primaryId === duplicateId
    ) {
      setErrorMessage("The merge identifiers are invalid.");
      return;
    }

    const confirmed = window.confirm(
      `Merge "${displayValue(
        primarySide === "left" ? left.name : right.name
      )}" and permanently remove the duplicate record?`
    );

    if (!confirmed) return;

    requestControllerRef.current?.abort();

    const controller = new AbortController();
    requestControllerRef.current = controller;
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS
    );

    try {
      setLoading(true);
      setErrorMessage("");

      const response = await fetch("/api/admin/duplicates/merge-business", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
        body: JSON.stringify({
          queue_id: queueId,
          primary_id: primaryId,
          duplicate_id: duplicateId,
          merged,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };

      if (!response.ok || data.ok === false) {
        setErrorMessage(data.error ?? "Could not merge businesses.");
        return;
      }

      window.location.assign("/admin/duplicates");
    } catch (error) {
      setErrorMessage(
        error instanceof DOMException && error.name === "AbortError"
          ? "The merge request timed out. Please try again."
          : "Something went wrong during merge."
      );
    } finally {
      window.clearTimeout(timeoutId);

      if (requestControllerRef.current === controller) {
        requestControllerRef.current = null;
      }

      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xl font-semibold text-yellow-400">
              Merge controls
            </div>
            <p className="mt-3 max-w-3xl text-white/70">
              The system has preselected recommended values. Review them before
              confirming the merge.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setPrimarySide("left")}
              className={`rounded-xl px-4 py-3 text-sm font-semibold ${
                primarySide === "left"
                  ? "bg-yellow-500 text-black"
                  : "border border-white/10 bg-white/5 text-white/80"
              }`}
            >
              Keep left as primary
            </button>

            <button
              type="button"
              onClick={() => setPrimarySide("right")}
              className={`rounded-xl px-4 py-3 text-sm font-semibold ${
                primarySide === "right"
                  ? "bg-yellow-500 text-black"
                  : "border border-white/10 bg-white/5 text-white/80"
              }`}
            >
              Keep right as primary
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <SummaryMetric label="Fields compared" value={fields.length} />
          <SummaryMetric label="Differences" value={differingFields.length} />
          <SummaryMetric
            label="Smart choices used"
            value={suggestedSelectionCount}
          />
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={chooseSuggested}
            className="rounded-xl bg-yellow-500 px-4 py-3 text-sm font-semibold text-black hover:bg-yellow-400"
          >
            Use smart suggestions
          </button>

          <button
            type="button"
            onClick={() => chooseAll("left")}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/80 hover:bg-white/10"
          >
            Choose all left values
          </button>

          <button
            type="button"
            onClick={() => chooseAll("right")}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/80 hover:bg-white/10"
          >
            Choose all right values
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))]">
        <div className="overflow-x-auto">
        <div className="min-w-[980px] grid grid-cols-[220px_1fr_1fr_220px] border-b border-white/10 bg-black/30">
          <div className="p-4 text-sm font-semibold uppercase tracking-[0.2em] text-yellow-400">
            Field
          </div>
          <div className="p-4 text-sm font-semibold uppercase tracking-[0.2em] text-yellow-400">
            Left
          </div>
          <div className="p-4 text-sm font-semibold uppercase tracking-[0.2em] text-yellow-400">
            Right
          </div>
          <div className="p-4 text-sm font-semibold uppercase tracking-[0.2em] text-yellow-400">
            Suggestion
          </div>
        </div>

        {fields.map((field) => {
          const leftValue = left[field.key];
          const rightValue = right[field.key];
          const equal = sameValue(leftValue, rightValue);
          const suggestion = suggestions[field.key];

          return (
            <div
              key={field.key}
              className={`min-w-[980px] grid grid-cols-[220px_1fr_1fr_220px] border-b border-white/10 ${
                equal ? "bg-black/20" : "bg-yellow-500/[0.03]"
              }`}
            >
              <div className="p-4 text-sm font-medium text-white/70">
                {field.label}
              </div>

              <div className="p-4 text-sm text-white">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="radio"
                    name={`field-${field.key}`}
                    checked={selected[field.key] === "left"}
                    onChange={() =>
                      setSelected((prev) => ({ ...prev, [field.key]: "left" }))
                    }
                  />
                  <span>{displayValue(leftValue)}</span>
                </label>
              </div>

              <div className="p-4 text-sm text-white">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="radio"
                    name={`field-${field.key}`}
                    checked={selected[field.key] === "right"}
                    onChange={() =>
                      setSelected((prev) => ({ ...prev, [field.key]: "right" }))
                    }
                  />
                  <span>{displayValue(rightValue)}</span>
                </label>
              </div>

              <div className="p-4 text-sm">
                <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3 text-yellow-300">
                  <div className="font-semibold">
                    {suggestion?.side === "left" ? "Use left" : "Use right"}
                  </div>
                  <div className="mt-1 text-xs text-yellow-200/80">
                    {suggestion?.reason ?? "No suggestion"}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        </div>
      </section>

      <section className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-8">
        <div className="text-xl font-semibold text-yellow-400">
          Merge summary
        </div>

        <div className="mt-4 space-y-2 text-white/80">
          <div>
            <span className="text-white/50">Primary record:</span>{" "}
            {primarySide === "left" ? left.name ?? left.id : right.name ?? right.id}
          </div>
          <div>
            <span className="text-white/50">Duplicate to remove:</span>{" "}
            {primarySide === "left" ? right.name ?? right.id : left.name ?? left.id}
          </div>
        </div>

        {errorMessage && (
          <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {errorMessage}
          </div>
        )}

        <div className="mt-6">
          <button
            type="button"
            onClick={submitMerge}
            disabled={loading}
            className="rounded-xl bg-yellow-500 px-5 py-3 text-sm font-semibold text-black hover:bg-yellow-400 disabled:opacity-50"
          >
            {loading ? "Merging..." : "Confirm merge"}
          </button>
        </div>
      </section>
    </div>
  );
}



function SummaryMetric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="text-xs uppercase tracking-[0.16em] text-white/40">
        {label}
      </div>
      <div className="mt-2 text-2xl font-black text-white">{value}</div>
    </div>
  );
}