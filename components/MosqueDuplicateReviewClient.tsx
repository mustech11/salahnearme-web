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

type MergeResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
};

type MergeState = {
  removeId: string | null;
  state: "idle" | "saving" | "success" | "error";
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SLUG_REGEX =
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const REQUEST_TIMEOUT_MS = 30_000;

function cleanText(
  value: string | null | undefined
): string {
  return value?.trim() ?? "";
}

function displayValue(
  value: string | number | null | undefined
): string {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  return String(value);
}

function formatDate(
  value: string | null
): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function isCoordinate(
  value: number | null
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value)
  );
}

function mapUrl(mosque: MosqueRow): string {
  if (
    isCoordinate(mosque.latitude) &&
    isCoordinate(mosque.longitude)
  ) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${mosque.latitude},${mosque.longitude}`
    )}`;
  }

  const query = [
    mosque.name,
    mosque.address,
    mosque.postcode,
    mosque.city,
  ]
    .map(cleanText)
    .filter(Boolean)
    .join(", ");

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    query
  )}`;
}

function getCompletenessScore(
  mosque: MosqueRow
): number {
  const fields = [
    mosque.name,
    mosque.slug,
    mosque.city,
    mosque.postcode,
    mosque.address,
    mosque.area,
    mosque.source,
    mosque.verified_status,
  ];

  let score = fields.filter((field) =>
    Boolean(cleanText(field))
  ).length;

  if (
    isCoordinate(mosque.latitude) &&
    isCoordinate(mosque.longitude)
  ) {
    score += 2;
  }

  return score;
}

function getCreatedTimestamp(
  value: string | null
): number {
  if (!value) {
    return Number.POSITIVE_INFINITY;
  }

  const timestamp = new Date(value).getTime();

  return Number.isFinite(timestamp)
    ? timestamp
    : Number.POSITIVE_INFINITY;
}

function rankMosqueRecords(
  first: MosqueRow,
  second: MosqueRow
): number {
  const completenessDifference =
    getCompletenessScore(second) -
    getCompletenessScore(first);

  if (completenessDifference !== 0) {
    return completenessDifference;
  }

  const firstVerified =
    cleanText(first.verified_status).toLowerCase() ===
    "verified";

  const secondVerified =
    cleanText(second.verified_status).toLowerCase() ===
    "verified";

  if (firstVerified !== secondVerified) {
    return secondVerified ? 1 : -1;
  }

  return (
    getCreatedTimestamp(first.created_at) -
    getCreatedTimestamp(second.created_at)
  );
}

function isSafeMosque(
  mosque: MosqueRow
): boolean {
  return UUID_REGEX.test(mosque.id);
}

function getResponseError(
  response: Response,
  data: MergeResponse
): string {
  const apiMessage =
    cleanText(data.error) ||
    cleanText(data.message);

  if (apiMessage) {
    return apiMessage;
  }

  if (response.status === 400) {
    return "The selected mosque records are not valid for merging.";
  }

  if (response.status === 401) {
    return "Your session has expired. Sign in again and retry.";
  }

  if (response.status === 403) {
    return "You do not have permission to merge mosque records.";
  }

  if (response.status === 404) {
    return "One of the mosque records could not be found.";
  }

  if (response.status === 409) {
    return "These records changed while you were reviewing them. Refresh and try again.";
  }

  if (response.status >= 500) {
    return "The server could not complete the merge. Please try again shortly.";
  }

  return "The mosque duplicate could not be merged.";
}

async function readResponse(
  response: Response
): Promise<MergeResponse> {
  try {
    const value: unknown = await response.json();

    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value)
    ) {
      return {};
    }

    return value as MergeResponse;
  } catch {
    return {};
  }
}

export default function MosqueDuplicateReviewClient({
  groups,
}: Props) {
  const feedbackId = useId();

  const abortControllerRef =
    useRef<AbortController | null>(null);

  const mountedRef = useRef(true);

  const [visibleGroups, setVisibleGroups] =
    useState(groups);

  const [mergeState, setMergeState] =
    useState<MergeState>({
      removeId: null,
      state: "idle",
    });

  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    setVisibleGroups(groups);
    setMergeState({
      removeId: null,
      state: "idle",
    });
    setMessage("");
    setErrorMessage("");
  }, [groups]);

  const safeGroups = useMemo(
    () =>
      visibleGroups
        .map((group) =>
          group
            .filter(isSafeMosque)
            .sort(rankMosqueRecords)
        )
        .filter((group) => group.length > 1),
    [visibleGroups]
  );

  const duplicateRecordCount = useMemo(
    () =>
      safeGroups.reduce(
        (total, group) =>
          total + Math.max(0, group.length - 1),
        0
      ),
    [safeGroups]
  );

  const mergeDuplicate = useCallback(
    async (
      keepId: string,
      removeId: string
    ) => {
      if (
        mergeState.state === "saving" ||
        !UUID_REGEX.test(keepId) ||
        !UUID_REGEX.test(removeId) ||
        keepId === removeId
      ) {
        return;
      }

      const keepRecord = safeGroups
        .flat()
        .find((mosque) => mosque.id === keepId);

      const removeRecord = safeGroups
        .flat()
        .find((mosque) => mosque.id === removeId);

      const confirmed = window.confirm(
        `Merge "${cleanText(removeRecord?.name) || "this duplicate"}" into "${
          cleanText(keepRecord?.name) || "the recommended keep record"
        }"? Missing data may be copied and the duplicate record may be removed. This action cannot be undone from this screen.`
      );

      if (!confirmed) {
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

      setMergeState({
        removeId,
        state: "saving",
      });
      setMessage("");
      setErrorMessage("");

      try {
        const response = await fetch(
          "/api/admin/mosque-duplicates/merge",
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
              keep_id: keepId,
              remove_id: removeId,
            }),
          }
        );

        const data = await readResponse(response);

        if (!mountedRef.current) {
          return;
        }

        if (
          !response.ok ||
          data.ok !== true
        ) {
          setMergeState({
            removeId,
            state: "error",
          });
          setErrorMessage(
            getResponseError(response, data)
          );
          return;
        }

        setVisibleGroups((current) =>
          current
            .map((group) =>
              group.filter(
                (mosque) =>
                  mosque.id !== removeId
              )
            )
            .filter(
              (group) => group.length > 1
            )
        );

        setMergeState({
          removeId,
          state: "success",
        });

        setMessage(
          cleanText(data.message) ||
            "Mosque duplicate merged successfully."
        );
      } catch (error) {
        if (!mountedRef.current) {
          return;
        }

        setMergeState({
          removeId,
          state: "error",
        });

        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          setErrorMessage(
            timedOut
              ? "The merge request timed out. Please try again."
              : "The merge request was cancelled."
          );
          return;
        }

        console.error(
          "Mosque duplicate merge failed:",
          error
        );

        setErrorMessage(
          "The mosque duplicate could not be merged."
        );
      } finally {
        window.clearTimeout(timeoutId);

        if (
          abortControllerRef.current === controller
        ) {
          abortControllerRef.current = null;
        }
      }
    },
    [mergeState.state, safeGroups]
  );

  if (safeGroups.length === 0) {
    return (
      <section className="overflow-hidden rounded-3xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent p-8 shadow-[0_24px_80px_-36px_rgba(16,185,129,0.7)]">
        <div className="inline-flex rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-emerald-200">
          Duplicate review clear
        </div>
        <h2 className="mt-4 text-2xl font-black text-white">
          No mosque duplicates need attention
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">
          All currently detected mosque records have either been reviewed or no longer form a valid duplicate group.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-yellow-500/20 bg-gradient-to-br from-yellow-500/10 via-black/40 to-black/20 p-6 shadow-[0_24px_80px_-40px_rgba(234,179,8,0.65)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.22em] text-yellow-300">
              Duplicate control centre
            </div>
            <h1 className="mt-2 text-2xl font-black text-white sm:text-3xl">
              Review possible mosque duplicates
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
              The strongest record in each group is recommended automatically using completeness, verification and record age.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SummaryMetric label="Groups" value={safeGroups.length} />
            <SummaryMetric label="Duplicates" value={duplicateRecordCount} />
          </div>
        </div>
      </section>

      <div
        id={feedbackId}
        aria-live="polite"
        aria-atomic="true"
      >
        {message ? (
          <div
            role="status"
            className="rounded-2xl border border-green-500/30 bg-green-500/10 p-4 text-green-300"
          >
            {message}
          </div>
        ) : null}

        {errorMessage ? (
          <div
            role="alert"
            className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-300"
          >
            {errorMessage}
          </div>
        ) : null}
      </div>

      {safeGroups.map((group, index) => {
        const keep = group[0];
        const duplicates = group.slice(1);

        return (
          <section
            key={keep.id}
            aria-labelledby={`duplicate-group-${keep.id}`}
            className="overflow-hidden rounded-3xl border border-yellow-500/20 bg-gradient-to-br from-[rgb(var(--card))] via-[rgb(var(--card))] to-yellow-500/5 p-6 shadow-[0_22px_70px_-42px_rgba(234,179,8,0.7)]"
          >
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm uppercase tracking-[0.2em] text-yellow-400">
                  Duplicate group {index + 1}
                </div>

                <h2
                  id={`duplicate-group-${keep.id}`}
                  className="mt-2 text-xl font-bold text-white"
                >
                  Compare possible mosque duplicates
                </h2>
              </div>

              <div className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-400">
                {group.length.toLocaleString()} records
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <MosqueCard
                mosque={keep}
                label="Recommended keep record"
                mode="keep"
              />

              <div className="space-y-4">
                {duplicates.map((duplicate) => {
                  const isMerging =
                    mergeState.state === "saving" &&
                    mergeState.removeId ===
                      duplicate.id;

                  return (
                    <article
                      key={duplicate.id}
                      className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5"
                    >
                      <MosqueCard
                        mosque={duplicate}
                        label="Duplicate record"
                        mode="duplicate"
                      />

                      <button
                        type="button"
                        disabled={
                          mergeState.state ===
                          "saving"
                        }
                        onClick={() => {
                          void mergeDuplicate(
                            keep.id,
                            duplicate.id
                          );
                        }}
                        aria-busy={isMerging}
                        aria-describedby={feedbackId}
                        className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-yellow-500 px-4 py-3 text-sm font-semibold text-black transition hover:bg-yellow-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isMerging ? (
                          <>
                            <span
                              aria-hidden="true"
                              className="mr-2 size-4 animate-spin rounded-full border-2 border-black/30 border-t-black"
                            />
                            Merging...
                          </>
                        ) : (
                          "Merge into keep record"
                        )}
                      </button>
                    </article>
                  );
                })}
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

  const safeSlug =
    mosque.slug &&
    SLUG_REGEX.test(mosque.slug)
      ? mosque.slug
      : null;

  const completeness =
    getCompletenessScore(mosque);

  const completenessPercentage =
    Math.min(100, Math.max(0, completeness * 10));

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

      <h3 className="mt-3 break-words text-2xl font-bold text-white">
        {cleanText(mosque.name) ||
          "Unnamed mosque"}
      </h3>

      <div className="mt-3 grid gap-2 text-sm text-white/70">
        <DetailRow
          label="Address"
          value={displayValue(mosque.address)}
        />
        <DetailRow
          label="Area"
          value={displayValue(mosque.area)}
        />
        <DetailRow
          label="Postcode"
          value={displayValue(mosque.postcode)}
        />
        <DetailRow
          label="City"
          value={displayValue(mosque.city)}
        />
        <DetailRow
          label="Coordinates"
          value={
            isCoordinate(mosque.latitude) &&
            isCoordinate(mosque.longitude)
              ? `${mosque.latitude}, ${mosque.longitude}`
              : "—"
          }
        />
        <DetailRow
          label="Slug"
          value={displayValue(mosque.slug)}
        />
        <DetailRow
          label="Created"
          value={formatDate(
            mosque.created_at
          )}
        />
        <DetailRow
          label="Completeness"
          value={`${completeness}/10`}
        />
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.14em] text-white/45">
          <span>Record quality</span>
          <span>{completenessPercentage}%</span>
        </div>
        <div
          role="progressbar"
          aria-label={`${label} completeness`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={completenessPercentage}
          className="h-2 overflow-hidden rounded-full bg-white/10"
        >
          <div
            className={
              isKeep
                ? "h-full rounded-full bg-emerald-400 transition-[width]"
                : "h-full rounded-full bg-red-400 transition-[width]"
            }
            style={{ width: `${completenessPercentage}%` }}
          />
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
          {cleanText(
            mosque.verified_status
          ) || "unknown status"}
        </span>

        <span className="rounded-full border border-white/10 px-3 py-1 text-white/60">
          {cleanText(mosque.source) ||
            "unknown source"}
        </span>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        {safeSlug ? (
          <Link
            href={`/mosque/${safeSlug}`}
            className="rounded-xl border border-yellow-500/30 bg-black px-4 py-2 text-sm font-semibold text-yellow-400 transition hover:bg-yellow-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"
          >
            View page
          </Link>
        ) : null}

        <a
          href={mapUrl(mosque)}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl border border-white/10 bg-black px-4 py-2 text-sm font-semibold text-white transition hover:border-yellow-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"
        >
          Open map
        </a>
      </div>
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
    <div className="min-w-28 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-center">
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-white/40">
        {label}
      </div>
      <div className="mt-1 text-2xl font-black text-white">
        {value.toLocaleString("en-GB")}
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="break-words">
      <span className="text-white/40">
        {label}:
      </span>{" "}
      {value}
    </div>
  );
}