"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type BusinessNotification = {
  id: string;
  title: string;
  body: string | null;
  read: boolean;
  created_at: string;
};

type Props = {
  businessId: string;
};

type ApiResponse = {
  ok?: boolean;
  notifications?: unknown;
  error?: string;
  message?: string;
};

type LoadState =
  | "idle"
  | "loading"
  | "success"
  | "error";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const REQUEST_TIMEOUT_MS = 20_000;
const MAX_NOTIFICATIONS = 100;

function cleanString(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function normaliseNotification(
  value: unknown
): BusinessNotification | null {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  const row = value as Record<string, unknown>;

  const id = cleanString(row.id);
  const title = cleanString(row.title);
  const createdAt = cleanString(row.created_at);

  if (!id || !title || !createdAt) {
    return null;
  }

  const createdDate = new Date(createdAt);

  if (Number.isNaN(createdDate.getTime())) {
    return null;
  }

  return {
    id,
    title: title.slice(0, 240),
    body:
      cleanString(row.body).slice(0, 3000) ||
      null,
    read: row.read === true,
    created_at: createdDate.toISOString(),
  };
}

function normaliseNotifications(
  value: unknown
): BusinessNotification[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const notifications: BusinessNotification[] = [];

  for (const item of value) {
    const notification =
      normaliseNotification(item);

    if (
      !notification ||
      seen.has(notification.id)
    ) {
      continue;
    }

    seen.add(notification.id);
    notifications.push(notification);

    if (
      notifications.length >= MAX_NOTIFICATIONS
    ) {
      break;
    }
  }

  return notifications.sort(
    (left, right) =>
      new Date(right.created_at).getTime() -
      new Date(left.created_at).getTime()
  );
}

async function readJsonSafely(
  response: Response
): Promise<ApiResponse> {
  const contentType =
    response.headers.get("content-type") ?? "";

  if (
    !contentType
      .toLowerCase()
      .includes("application/json")
  ) {
    const text = await response
      .text()
      .catch(() => "");

    return {
      ok: false,
      error:
        text.trim().slice(0, 180) ||
        "The notifications endpoint returned an unexpected response.",
    };
  }

  try {
    return (await response.json()) as ApiResponse;
  } catch {
    return {
      ok: false,
      error:
        "The notifications endpoint returned invalid JSON.",
    };
  }
}

function formatNotificationDate(
  value: string
): string {
  const date = new Date(value);

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function BusinessDashboardNotifications({
  businessId,
}: Props) {
  const abortControllerRef =
    useRef<AbortController | null>(null);

  const [notifications, setNotifications] =
    useState<BusinessNotification[]>([]);
  const [loadState, setLoadState] =
    useState<LoadState>("idle");
  const [errorMessage, setErrorMessage] =
    useState("");
  const [showUnreadOnly, setShowUnreadOnly] =
    useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] =
    useState<Date | null>(null);

  const cleanBusinessId = useMemo(
    () => cleanString(businessId),
    [businessId]
  );

  const validationError = useMemo(() => {
    if (!UUID_REGEX.test(cleanBusinessId)) {
      return "A valid business is required to load notifications.";
    }

    return "";
  }, [cleanBusinessId]);

  const loadNotifications =
    useCallback(async () => {
      abortControllerRef.current?.abort();

      if (validationError) {
        setNotifications([]);
        setLoadState("error");
        setErrorMessage(validationError);
        return;
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const timeoutId = window.setTimeout(() => {
        controller.abort();
      }, REQUEST_TIMEOUT_MS);

      setLoadState("loading");
      setErrorMessage("");

      try {
        const params = new URLSearchParams({
          business_id: cleanBusinessId,
        });

        const response = await fetch(
          `/api/business-dashboard/notifications?${params.toString()}`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
            },
            credentials: "same-origin",
            cache: "no-store",
            signal: controller.signal,
          }
        );

        const result =
          await readJsonSafely(response);

        if (
          !response.ok ||
          result.ok !== true
        ) {
          setLoadState("error");
          setErrorMessage(
            cleanString(
              result.error ?? result.message
            ) ||
              "Could not load notifications."
          );
          return;
        }

        setNotifications(
          normaliseNotifications(
            result.notifications
          )
        );
        setLastUpdatedAt(new Date());
        setLoadState("success");
      } catch (error) {
        setLoadState("error");

        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          setErrorMessage(
            "The notifications request timed out. Please try again."
          );
          return;
        }

        setErrorMessage(
          "Could not load notifications."
        );
      } finally {
        window.clearTimeout(timeoutId);

        if (
          abortControllerRef.current === controller
        ) {
          abortControllerRef.current = null;
        }
      }
    }, [cleanBusinessId, validationError]);

  useEffect(() => {
    void loadNotifications();

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [loadNotifications]);

  const unreadCount = useMemo(
    () =>
      notifications.filter(
        (notification) => !notification.read
      ).length,
    [notifications]
  );

  const visibleNotifications = useMemo(() => {
    if (!showUnreadOnly) {
      return notifications;
    }

    return notifications.filter(
      (notification) => !notification.read
    );
  }, [notifications, showUnreadOnly]);

  return (
    <section
      aria-labelledby="business-notifications-heading"
      className="rounded-3xl border border-yellow-500/20 bg-[rgb(var(--card))] p-6 md:p-8"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-yellow-400">
            Notifications
          </div>

          <h2
            id="business-notifications-heading"
            className="mt-3 text-3xl font-black text-white"
          >
            Business updates
          </h2>

          <p className="mt-2 text-sm leading-6 text-white/55">
            Account, listing, payment and promotion
            updates for this business.
          </p>

          {lastUpdatedAt ? (
            <p className="mt-2 text-xs text-white/35">
              Updated{" "}
              {lastUpdatedAt.toLocaleTimeString(
                "en-GB",
                {
                  hour: "2-digit",
                  minute: "2-digit",
                }
              )}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-xs font-bold text-yellow-300">
            {unreadCount.toLocaleString("en-GB")}{" "}
            unread
          </div>

          <button
            type="button"
            onClick={() => {
              void loadNotifications();
            }}
            disabled={loadState === "loading"}
            className="rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-sm font-bold text-white/70 transition hover:border-yellow-500/30 hover:text-yellow-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadState === "loading"
              ? "Refreshing..."
              : "Refresh"}
          </button>
        </div>
      </div>

      {notifications.length > 0 ? (
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            aria-pressed={!showUnreadOnly}
            onClick={() => {
              setShowUnreadOnly(false);
            }}
            className={
              !showUnreadOnly
                ? "rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-xs font-bold text-yellow-300"
                : "rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-xs font-bold text-white/60 hover:border-yellow-500/30"
            }
          >
            All ({notifications.length})
          </button>

          <button
            type="button"
            aria-pressed={showUnreadOnly}
            onClick={() => {
              setShowUnreadOnly(true);
            }}
            className={
              showUnreadOnly
                ? "rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-xs font-bold text-yellow-300"
                : "rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-xs font-bold text-white/60 hover:border-yellow-500/30"
            }
          >
            Unread ({unreadCount})
          </button>
        </div>
      ) : null}

      <div
        aria-live="polite"
        className="mt-6 space-y-3"
      >
        {loadState === "loading" &&
        notifications.length === 0 ? (
          <NotificationsSkeleton />
        ) : null}

        {loadState === "error" ? (
          <div
            role="alert"
            className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5"
          >
            <div className="font-bold text-red-200">
              Notifications unavailable
            </div>

            <p className="mt-2 text-sm leading-6 text-red-100/75">
              {errorMessage}
            </p>

            <button
              type="button"
              onClick={() => {
                void loadNotifications();
              }}
              className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-200 hover:bg-red-500/20"
            >
              Try again
            </button>
          </div>
        ) : null}

        {loadState === "success" &&
        visibleNotifications.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/30 p-5 text-sm leading-6 text-white/60">
            {showUnreadOnly
              ? "You have no unread notifications."
              : "No notifications have been created for this business yet."}
          </div>
        ) : null}

        {visibleNotifications.map(
          (notification) => (
            <article
              key={notification.id}
              className={
                notification.read
                  ? "rounded-2xl border border-white/10 bg-black/30 p-5"
                  : "rounded-2xl border border-yellow-500/25 bg-yellow-500/[0.06] p-5"
              }
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="font-bold text-white">
                    {notification.title}
                  </div>

                  {notification.body ? (
                    <p className="mt-2 whitespace-pre-line text-sm leading-6 text-white/65">
                      {notification.body}
                    </p>
                  ) : null}
                </div>

                {!notification.read ? (
                  <span className="w-fit shrink-0 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-400">
                    New
                  </span>
                ) : (
                  <span className="w-fit shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/40">
                    Read
                  </span>
                )}
              </div>

              <time
                dateTime={notification.created_at}
                className="mt-4 block text-xs text-white/40"
              >
                {formatNotificationDate(
                  notification.created_at
                )}
              </time>
            </article>
          )
        )}
      </div>
    </section>
  );
}

function NotificationsSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading notifications"
      className="space-y-3"
    >
      {Array.from({ length: 3 }).map(
        (_, index) => (
          <div
            key={index}
            className="rounded-2xl border border-white/10 bg-black/30 p-5"
          >
            <div className="h-4 w-48 animate-pulse rounded bg-white/10" />
            <div className="mt-3 h-3 w-full animate-pulse rounded bg-white/10" />
            <div className="mt-2 h-3 w-3/4 animate-pulse rounded bg-white/10" />
            <div className="mt-4 h-3 w-24 animate-pulse rounded bg-white/10" />
          </div>
        )
      )}
    </div>
  );
}