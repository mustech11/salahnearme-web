"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

type Confidence =
  | "none"
  | "low"
  | "medium"
  | "strong";

type LiveStatus =
  | "none"
  | "started"
  | "delayed"
  | "full"
  | "parking_full";

type ReportType =
  | "started"
  | "delayed"
  | "full"
  | "parking_full";

type LiveItem = {
  status: LiveStatus;
  total: number;
  confidence: Confidence;
};

type LiveResponse = {
  ok?: boolean;
  error?: string;
  map?: Record<string, LiveItem>;
};

type ReportResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
};

type Props = {
  mosqueId: string;
  prayer?: string;
};

type LoadState =
  | "idle"
  | "loading"
  | "success"
  | "error";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALLOWED_PRAYERS = new Set([
  "fajr",
  "dhuhr",
  "asr",
  "maghrib",
  "isha",
  "jumuah",
]);

const REFRESH_INTERVAL_MS = 60_000;
const REQUEST_TIMEOUT_MS = 12_000;

function cleanString(
  value: string | null | undefined
): string {
  return value?.trim() ?? "";
}

function normalisePrayer(value: string): string {
  const cleaned = value.trim().toLowerCase();

  return ALLOWED_PRAYERS.has(cleaned)
    ? cleaned
    : "isha";
}

function normaliseLiveItem(
  value: unknown
): LiveItem | null {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  const item = value as Partial<LiveItem>;

  const allowedStatuses: LiveStatus[] = [
    "none",
    "started",
    "delayed",
    "full",
    "parking_full",
  ];

  const allowedConfidence: Confidence[] = [
    "none",
    "low",
    "medium",
    "strong",
  ];

  const status = allowedStatuses.includes(
    item.status as LiveStatus
  )
    ? (item.status as LiveStatus)
    : "none";

  const confidence = allowedConfidence.includes(
    item.confidence as Confidence
  )
    ? (item.confidence as Confidence)
    : "none";

  const total =
    typeof item.total === "number" &&
    Number.isFinite(item.total)
      ? Math.max(0, Math.trunc(item.total))
      : 0;

  return {
    status,
    total,
    confidence,
  };
}

async function readJson<T>(
  response: Response
): Promise<T | null> {
  try {
    const value: unknown = await response.json();

    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value)
    ) {
      return null;
    }

    return value as T;
  } catch {
    return null;
  }
}

function getSignalLabel(
  item: LiveItem | null
): string {
  if (item?.status === "started") {
    return "Community reports suggest that iqamah has begun.";
  }

  if (item?.status === "delayed") {
    return "Community reports suggest a delay today.";
  }

  if (item?.status === "full") {
    return "Community reports suggest that the prayer hall is full.";
  }

  if (item?.status === "parking_full") {
    return "Community reports suggest that parking is full.";
  }

  if (item?.confidence === "strong") {
    return `Strong community signal based on ${item.total} recent reports.`;
  }

  if (item?.confidence === "medium") {
    return `Medium community signal based on ${item.total} recent reports.`;
  }

  if (item?.confidence === "low") {
    return `Low community signal based on ${item.total} recent report${
      item.total === 1 ? "" : "s"
    }.`;
  }

  return "No recent community reports yet.";
}

function getSignalTone(
  item: LiveItem | null
): string {
  if (item?.status === "started") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  }

  if (item?.status === "delayed") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  }

  if (
    item?.status === "full" ||
    item?.status === "parking_full"
  ) {
    return "border-red-500/30 bg-red-500/10 text-red-200";
  }

  if (item?.confidence === "strong") {
    return "border-green-500/30 bg-green-500/10 text-green-200";
  }

  if (item?.confidence === "medium") {
    return "border-yellow-500/30 bg-yellow-500/10 text-yellow-200";
  }

  return "border-white/10 bg-white/5 text-white/65";
}

export default function IqamahCommunityCard({
  mosqueId,
  prayer = "isha",
}: Props) {
  const feedbackId = useId();

  const loadAbortRef =
    useRef<AbortController | null>(null);

  const reportAbortRef =
    useRef<AbortController | null>(null);

  const [signal, setSignal] =
    useState<LiveItem | null>(null);

  const [loadState, setLoadState] =
    useState<LoadState>("idle");

  const [submittingType, setSubmittingType] =
    useState<ReportType | null>(null);

  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] =
    useState("");

  const [updatedAt, setUpdatedAt] =
    useState<Date | null>(null);

  const cleanMosqueId = useMemo(
    () => mosqueId.trim(),
    [mosqueId]
  );

  const cleanPrayer = useMemo(
    () => normalisePrayer(prayer),
    [prayer]
  );

  const validationError = useMemo(() => {
    if (!UUID_REGEX.test(cleanMosqueId)) {
      return "Community reporting is unavailable for this mosque.";
    }

    return "";
  }, [cleanMosqueId]);

  const load = useCallback(async () => {
    if (validationError) {
      setSignal(null);
      setLoadState("error");
      setErrorMessage(validationError);
      return;
    }

    loadAbortRef.current?.abort();

    const controller = new AbortController();
    loadAbortRef.current = controller;

    let timedOut = false;

    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    setLoadState((currentState) =>
      currentState === "idle"
        ? "loading"
        : currentState
    );

    try {
      const params = new URLSearchParams({
        mosque_ids: cleanMosqueId,
        prayer: cleanPrayer,
      });

      const response = await fetch(
        `/api/iqamah/live?${params.toString()}`,
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

      const data =
        await readJson<LiveResponse>(response);

      if (!response.ok || data?.ok === false) {
        setSignal(null);
        setLoadState("error");
        setErrorMessage(
          cleanString(data?.error) ||
            "Community signals could not be loaded."
        );
        return;
      }

      const item = normaliseLiveItem(
        data?.map?.[cleanMosqueId]
      );

      setSignal(item);
      setUpdatedAt(new Date());
      setLoadState("success");
      setErrorMessage("");
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        if (timedOut) {
          setLoadState("error");
          setErrorMessage(
            "Community signals took too long to load."
          );
        }

        return;
      }

      console.error(
        "Iqamah community signal load error:",
        error
      );

      setSignal(null);
      setLoadState("error");
      setErrorMessage(
        "Community signals could not be loaded."
      );
    } finally {
      window.clearTimeout(timeoutId);

      if (loadAbortRef.current === controller) {
        loadAbortRef.current = null;
      }
    }
  }, [
    cleanMosqueId,
    cleanPrayer,
    validationError,
  ]);

  useEffect(() => {
    void load();

    const intervalId = window.setInterval(() => {
      void load();
    }, REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
      loadAbortRef.current?.abort();
      reportAbortRef.current?.abort();
    };
  }, [load]);

  const report = useCallback(
    async (reportType: ReportType) => {
      if (
        submittingType ||
        validationError
      ) {
        return;
      }

      setMessage("");
      setErrorMessage("");

      reportAbortRef.current?.abort();

      const controller = new AbortController();
      reportAbortRef.current = controller;

      let timedOut = false;

      const timeoutId = window.setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, REQUEST_TIMEOUT_MS);

      setSubmittingType(reportType);

      try {
        const response = await fetch(
          "/api/iqamah/report",
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
              mosque_id: cleanMosqueId,
              prayer: cleanPrayer,
              report_type: reportType,
            }),
          }
        );

        const data =
          await readJson<ReportResponse>(response);

        if (!response.ok || data?.ok === false) {
          setErrorMessage(
            cleanString(data?.error) ||
              (response.status === 429
                ? "Too many recent reports. Please wait before trying again."
                : "The report could not be submitted.")
          );
          return;
        }

        setMessage(
          cleanString(data?.message) ||
            "JazakAllahu khayran — your report was recorded."
        );

        await load();
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          setErrorMessage(
            timedOut
              ? "The report request timed out."
              : "The report request was cancelled."
          );
          return;
        }

        console.error(
          "Iqamah community report error:",
          error
        );

        setErrorMessage(
          "The report could not be submitted."
        );
      } finally {
        window.clearTimeout(timeoutId);

        if (
          reportAbortRef.current === controller
        ) {
          reportAbortRef.current = null;
        }

        setSubmittingType(null);
      }
    },
    [
      cleanMosqueId,
      cleanPrayer,
      load,
      submittingType,
      validationError,
    ]
  );

  const label = getSignalLabel(signal);
  const signalTone = getSignalTone(signal);

  const buttonDisabled =
    Boolean(submittingType) ||
    Boolean(validationError);

  return (
    <section
      aria-labelledby="iqamah-community-heading"
      className="rounded-2xl border border-white/10 bg-[rgb(var(--card))] p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="iqamah-community-heading"
            className="text-sm font-black text-white"
          >
            Community signal
          </h2>

          <p className="mt-1 text-[11px] text-white/45">
            Recent reports for the selected salah.
          </p>
        </div>

        <span className="rounded-full border border-yellow-500/20 bg-yellow-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-yellow-300">
          {cleanPrayer}
        </span>
      </div>

      <div
        className={`mt-4 rounded-xl border p-4 text-sm leading-6 ${signalTone}`}
      >
        {loadState === "loading"
          ? "Loading recent community signals..."
          : label}
      </div>

      {updatedAt ? (
        <div className="mt-2 text-[10px] text-white/40">
          Last refreshed{" "}
          {updatedAt.toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <ReportButton
          label="✅ Iqamah happened"
          loadingLabel="Sending..."
          active={signal?.status === "started"}
          loading={submittingType === "started"}
          disabled={buttonDisabled}
          className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
          onClick={() => {
            void report("started");
          }}
        />

        <ReportButton
          label="⏳ Delayed"
          loadingLabel="Sending..."
          active={signal?.status === "delayed"}
          loading={submittingType === "delayed"}
          disabled={buttonDisabled}
          className="border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
          onClick={() => {
            void report("delayed");
          }}
        />

        <ReportButton
          label="👥 Hall full"
          loadingLabel="Sending..."
          active={signal?.status === "full"}
          loading={submittingType === "full"}
          disabled={buttonDisabled}
          className="border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20"
          onClick={() => {
            void report("full");
          }}
        />

        <ReportButton
          label="🅿 Parking full"
          loadingLabel="Sending..."
          active={
            signal?.status === "parking_full"
          }
          loading={
            submittingType === "parking_full"
          }
          disabled={buttonDisabled}
          className="border-sky-500/30 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20"
          onClick={() => {
            void report("parking_full");
          }}
        />
      </div>

      <div
        id={feedbackId}
        aria-live="polite"
        aria-atomic="true"
      >
        {message ? (
          <p
            role="status"
            className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-200"
          >
            {message}
          </p>
        ) : null}

        {errorMessage ? (
          <p
            role="alert"
            className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-200"
          >
            {errorMessage}
          </p>
        ) : null}
      </div>

      <p className="mt-3 text-[10px] leading-5 text-white/45">
        Community feedback only — not an official
        mosque announcement.
      </p>
    </section>
  );
}

function ReportButton({
  label,
  loadingLabel,
  active,
  loading,
  disabled,
  className,
  onClick,
}: {
  label: string;
  loadingLabel: string;
  active: boolean;
  loading: boolean;
  disabled: boolean;
  className: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={active}
      aria-busy={loading}
      onClick={onClick}
      className={`inline-flex min-h-9 items-center justify-center rounded-xl border px-3 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 disabled:cursor-not-allowed disabled:opacity-50 ${
        active ? "ring-2 ring-white/30" : ""
      } ${className}`}
    >
      {loading ? (
        <>
          <span
            aria-hidden="true"
            className="mr-2 size-3 animate-spin rounded-full border-2 border-current/30 border-t-current"
          />

          {loadingLabel}
        </>
      ) : (
        label
      )}
    </button>
  );
}