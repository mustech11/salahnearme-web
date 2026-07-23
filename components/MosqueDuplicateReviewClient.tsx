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

function isSafeMosque(
  mosque: MosqueRow
): boolean {
  return UUID_REGEX.test(mosque.id);
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
          group.filter(isSafeMosque)
        )
        .filter((group) => group.length > 1),
    [visibleGroups]
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

      const confirmed = window.confirm(
        "Merge this duplicate into the selected keep record? Missing data may be copied and the duplicate record may be removed. This action cannot be undone from this screen."
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
            cleanText(data.error) ||
              cleanText(data.message) ||
              "The mosque duplicate could not be merged."
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
    [mergeState.state]
  );

  if (safeGroups.length === 0) {
    return (
      <section className="rounded-3xl border border-green-500/20 bg-green-500/10 p-8 text-green-200">
        No duplicate mosque groups require review.
      </section>
    );
  }

  return (
    <div className="space-y-6">
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
            className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6"
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
                label="Keep record"
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