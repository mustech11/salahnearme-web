"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  analyseSystemHealth,
  type HealthIntelligenceSummary,
  type IntelligenceFinding,
  type IntelligenceGrade,
  type IntelligenceSeverity,
} from "@/lib/systemHealthIntelligence";

import type {
  AlertSeverity,
  ApplicationMetric,
  HealthCheckMode,
  HealthMetadata,
  HealthSeverity,
  ServiceCheck,
  SystemHealthSnapshot,
  UsageMetric,
} from "@/lib/systemHealthTypes";

type RawSnapshotRow = {
  id?: unknown;
  overall_status?: unknown;
  mode?: unknown;
  service_status?: unknown;
  services?: unknown;
  metrics?: unknown;
  usage?: unknown;
  application?: unknown;
  response_time_ms?: unknown;
  checked_at?: unknown;
  created_at?: unknown;
  metadata?: unknown;
};

type RawAlertRow = {
  id?: unknown;
  alert_key?: unknown;
  severity?: unknown;
  title?: unknown;
  message?: unknown;
  status?: unknown;
  metric_name?: unknown;
  metric_value?: unknown;
  threshold_value?: unknown;
  first_detected_at?: unknown;
  last_detected_at?: unknown;
  acknowledged_at?: unknown;
  resolved_at?: unknown;
  metadata?: unknown;
};

type HealthAlert = {
  id: string;
  alertKey: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  status:
    | "active"
    | "acknowledged"
    | "resolved"
    | "unknown";
  metricName: string | null;
  metricValue: number | null;
  thresholdValue: number | null;
  firstDetectedAt: string | null;
  lastDetectedAt: string | null;
};

type NormalisedSnapshot = SystemHealthSnapshot & {
  id: string | null;
};

type HealthReadResponse = {
  ok?: boolean;
  latest?: RawSnapshotRow | null;
  history?: RawSnapshotRow[];
  alerts?: RawAlertRow[];
  error?: string;
};

type HealthCheckResponse = {
  ok?: boolean;
  snapshot_id?: string;
  snapshot?: SystemHealthSnapshot;
  alerts_created_or_updated?: number;
  error?: string;
};

type CheckState =
  | "idle"
  | "lightweight"
  | "daily";

const AUTO_REFRESH_INTERVAL_MS =
  60_000;

const HISTORY_LIMIT = 30;

const HEALTH_SEVERITIES: HealthSeverity[] = [
  "healthy",
  "warning",
  "critical",
  "offline",
];

const HEALTH_MODES: HealthCheckMode[] = [
  "lightweight",
  "daily",
];

const ALERT_SEVERITIES: AlertSeverity[] = [
  "info",
  "warning",
  "high",
  "critical",
];

function cleanString(
  value: unknown,
  maxLength = 2_000
): string {
  if (
    typeof value !== "string" &&
    typeof value !== "number" &&
    typeof value !== "boolean"
  ) {
    return "";
  }

  return String(value)
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function safeNumber(
  value: unknown
): number | null {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return null;
  }

  return value;
}

function safeNonNegativeNumber(
  value: unknown
): number | null {
  const number = safeNumber(value);

  if (
    number === null ||
    number < 0
  ) {
    return null;
  }

  return number;
}

function safeDateString(
  value: unknown
): string | null {
  const cleaned =
    cleanString(value, 100);

  if (!cleaned) {
    return null;
  }

  const timestamp =
    new Date(cleaned).getTime();

  return Number.isFinite(timestamp)
    ? cleaned
    : null;
}

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value)
  );
}

function isHealthSeverity(
  value: unknown
): value is HealthSeverity {
  return (
    typeof value === "string" &&
    HEALTH_SEVERITIES.includes(
      value as HealthSeverity
    )
  );
}

function isHealthMode(
  value: unknown
): value is HealthCheckMode {
  return (
    typeof value === "string" &&
    HEALTH_MODES.includes(
      value as HealthCheckMode
    )
  );
}

function isAlertSeverity(
  value: unknown
): value is AlertSeverity {
  return (
    typeof value === "string" &&
    ALERT_SEVERITIES.includes(
      value as AlertSeverity
    )
  );
}

function normaliseMetadata(
  value: unknown
): HealthMetadata {
  if (!isRecord(value)) {
    return {};
  }

  return value as HealthMetadata;
}

function normaliseService(
  value: unknown,
  index: number
): ServiceCheck | null {
  if (!isRecord(value)) {
    return null;
  }

  const key =
    cleanString(
      value.key,
      120
    ) || `service_${index + 1}`;

  const label =
    cleanString(
      value.label,
      180
    ) || key;

  const status =
    isHealthSeverity(value.status)
      ? value.status
      : "warning";

  const checkedAt =
    safeDateString(
      value.checked_at
    ) ?? new Date().toISOString();

  return {
    key,
    label,
    status,
    response_time_ms:
      safeNonNegativeNumber(
        value.response_time_ms
      ),
    message:
      cleanString(
        value.message,
        2_000
      ) ||
      "No service message was returned.",
    checked_at: checkedAt,
    metadata:
      normaliseMetadata(
        value.metadata
      ),
  };
}

function normaliseUsageMetric(
  value: unknown,
  index: number
): UsageMetric | null {
  if (!isRecord(value)) {
    return null;
  }

  const sourceValue =
    cleanString(
      value.source,
      80
    );

  const validSources: UsageMetric["source"][] =
    [
      "management_api",
      "database",
      "configuration",
      "unavailable",
    ];

  const source =
    validSources.includes(
      sourceValue as UsageMetric["source"]
    )
      ? (sourceValue as UsageMetric["source"])
      : "unavailable";

  const rawStatus =
    value.status;

  return {
    key:
      cleanString(
        value.key,
        120
      ) || `usage_${index + 1}`,
    label:
      cleanString(
        value.label,
        180
      ) || `Usage metric ${index + 1}`,
    used:
      safeNonNegativeNumber(
        value.used
      ),
    limit:
      safeNonNegativeNumber(
        value.limit
      ),
    unit:
      cleanString(
        value.unit,
        40
      ) || "units",
    percentage:
      safeNonNegativeNumber(
        value.percentage
      ),
    source,
    estimated:
      typeof value.estimated === "boolean"
        ? value.estimated
        : false,
    status:
      isHealthSeverity(rawStatus)
        ? rawStatus
        : undefined,
    message:
      cleanString(
        value.message,
        1_000
      ) || undefined,
    metadata:
      normaliseMetadata(
        value.metadata
      ),
  };
}

function normaliseApplicationMetric(
  value: unknown,
  index: number
): ApplicationMetric | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    key:
      cleanString(
        value.key,
        120
      ) || `application_${index + 1}`,
    label:
      cleanString(
        value.label,
        180
      ) || `Application metric ${index + 1}`,
    value:
      safeNonNegativeNumber(
        value.value
      ),
    status:
      isHealthSeverity(
        value.status
      )
        ? value.status
        : "warning",
    message:
      cleanString(
        value.message,
        1_000
      ) || undefined,
    metadata:
      normaliseMetadata(
        value.metadata
      ),
  };
}

function normaliseSnapshot(
  row: RawSnapshotRow | null | undefined
): NormalisedSnapshot | null {
  if (!row) {
    return null;
  }

  const metrics =
    isRecord(row.metrics)
      ? row.metrics
      : {};

  const rawServices =
    Array.isArray(row.services)
      ? row.services
      : Array.isArray(row.service_status)
        ? row.service_status
        : [];

  const rawUsage =
    Array.isArray(row.usage)
      ? row.usage
      : Array.isArray(metrics.usage)
        ? metrics.usage
        : [];

  const rawApplication =
    Array.isArray(row.application)
      ? row.application
      : Array.isArray(metrics.application)
        ? metrics.application
        : [];

  const services =
    rawServices
      .map(normaliseService)
      .filter(
        (
          value
        ): value is ServiceCheck =>
          value !== null
      );

  const usage =
    rawUsage
      .map(normaliseUsageMetric)
      .filter(
        (
          value
        ): value is UsageMetric =>
          value !== null
      );

  const application =
    rawApplication
      .map(normaliseApplicationMetric)
      .filter(
        (
          value
        ): value is ApplicationMetric =>
          value !== null
      );

  const checkedAt =
    safeDateString(
      row.checked_at
    ) ??
    safeDateString(
      row.created_at
    ) ??
    new Date().toISOString();

  const nestedMetadata =
    isRecord(metrics.metadata)
      ? metrics.metadata
      : {};

  const directMetadata =
    isRecord(row.metadata)
      ? row.metadata
      : {};

  const siteUrl =
    cleanString(
      directMetadata.site_url ??
        nestedMetadata.site_url,
      1_000
    );

  return {
    id:
      cleanString(
        row.id,
        120
      ) || null,
    overall_status:
      isHealthSeverity(
        row.overall_status
      )
        ? row.overall_status
        : "warning",
    mode:
      isHealthMode(row.mode)
        ? row.mode
        : "lightweight",
    services,
    usage,
    application,
    response_time_ms:
      Math.round(
        safeNonNegativeNumber(
          row.response_time_ms
        ) ?? 0
      ),
    checked_at: checkedAt,
    metadata: {
      project_ref_configured:
        Boolean(
          directMetadata.project_ref_configured ??
            nestedMetadata.project_ref_configured
        ),
      management_api_configured:
        Boolean(
          directMetadata.management_api_configured ??
            nestedMetadata.management_api_configured
        ),
      site_url:
        siteUrl || null,
      version: 1,
      ...normaliseMetadata(
        nestedMetadata
      ),
      ...normaliseMetadata(
        directMetadata
      ),
    },
  };
}

function normaliseAlert(
  row: RawAlertRow,
  index: number
): HealthAlert {
  const severity =
    isAlertSeverity(
      row.severity
    )
      ? row.severity
      : "warning";

  const statusValue =
    cleanString(
      row.status,
      50
    );

  const status:
    HealthAlert["status"] =
    statusValue === "active" ||
    statusValue === "acknowledged" ||
    statusValue === "resolved"
      ? statusValue
      : "unknown";

  return {
    id:
      cleanString(
        row.id,
        120
      ) || `alert_${index + 1}`,
    alertKey:
      cleanString(
        row.alert_key,
        160
      ) || `alert_${index + 1}`,
    severity,
    title:
      cleanString(
        row.title,
        300
      ) || "System health alert",
    message:
      cleanString(
        row.message,
        2_000
      ) || "No alert details were provided.",
    status,
    metricName:
      cleanString(
        row.metric_name,
        160
      ) || null,
    metricValue:
      safeNumber(
        row.metric_value
      ),
    thresholdValue:
      safeNumber(
        row.threshold_value
      ),
    firstDetectedAt:
      safeDateString(
        row.first_detected_at
      ),
    lastDetectedAt:
      safeDateString(
        row.last_detected_at
      ),
  };
}

function formatDateTime(
  value: string | null | undefined
): string {
  if (!value) {
    return "Not available";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Not available";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      dateStyle: "medium",
      timeStyle: "medium",
    }
  ).format(date);
}

function formatRelativeTime(
  value: string | null | undefined
): string {
  if (!value) {
    return "Never";
  }

  const timestamp =
    new Date(value).getTime();

  if (!Number.isFinite(timestamp)) {
    return "Unknown";
  }

  const differenceSeconds =
    Math.round(
      (timestamp - Date.now()) /
        1_000
    );

  const absoluteSeconds =
    Math.abs(
      differenceSeconds
    );

  let divisor = 1;
  let unit:
    | "second"
    | "minute"
    | "hour"
    | "day" = "second";

  if (absoluteSeconds >= 86_400) {
    divisor = 86_400;
    unit = "day";
  } else if (
    absoluteSeconds >= 3_600
  ) {
    divisor = 3_600;
    unit = "hour";
  } else if (
    absoluteSeconds >= 60
  ) {
    divisor = 60;
    unit = "minute";
  }

  return new Intl.RelativeTimeFormat(
    "en-GB",
    {
      numeric: "auto",
    }
  ).format(
    Math.round(
      differenceSeconds /
        divisor
    ),
    unit
  );
}

function formatMilliseconds(
  value: number | null | undefined
): string {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return "—";
  }

  return `${Math.round(
    value
  ).toLocaleString("en-GB")} ms`;
}

function formatMetricValue(
  value: number | null,
  unit?: string
): string {
  if (
    value === null ||
    !Number.isFinite(value)
  ) {
    return "Unavailable";
  }

  return `${value.toLocaleString(
    "en-GB",
    {
      maximumFractionDigits: 2,
    }
  )}${unit ? ` ${unit}` : ""}`;
}

function getStatusClasses(
  status: HealthSeverity
): string {
  switch (status) {
    case "healthy":
      return "border-emerald-400/25 bg-emerald-400/10 text-emerald-200";

    case "warning":
      return "border-amber-400/25 bg-amber-400/10 text-amber-200";

    case "critical":
      return "border-red-400/25 bg-red-400/10 text-red-200";

    case "offline":
      return "border-rose-500/30 bg-rose-500/15 text-rose-200";
  }
}

function getStatusDotClasses(
  status: HealthSeverity
): string {
  switch (status) {
    case "healthy":
      return "bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.7)]";

    case "warning":
      return "bg-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.65)]";

    case "critical":
      return "bg-red-400 shadow-[0_0_14px_rgba(248,113,113,0.7)]";

    case "offline":
      return "bg-rose-500 shadow-[0_0_14px_rgba(244,63,94,0.75)]";
  }
}

function getGradeClasses(
  grade: IntelligenceGrade
): string {
  switch (grade) {
    case "excellent":
      return "border-emerald-400/25 bg-emerald-400/10 text-emerald-200";

    case "good":
      return "border-green-400/25 bg-green-400/10 text-green-200";

    case "attention":
      return "border-amber-400/25 bg-amber-400/10 text-amber-200";

    case "degraded":
      return "border-orange-400/25 bg-orange-400/10 text-orange-200";

    case "critical":
      return "border-red-400/25 bg-red-400/10 text-red-200";
  }
}

function getFindingClasses(
  severity: IntelligenceSeverity
): string {
  switch (severity) {
    case "critical":
      return "border-red-400/25 bg-red-400/10";

    case "high":
      return "border-orange-400/25 bg-orange-400/10";

    case "medium":
      return "border-amber-400/25 bg-amber-400/10";

    case "low":
      return "border-sky-400/25 bg-sky-400/10";

    case "info":
      return "border-emerald-400/25 bg-emerald-400/10";
  }
}

function getAlertClasses(
  severity: AlertSeverity
): string {
  switch (severity) {
    case "critical":
      return "border-red-400/25 bg-red-400/10";

    case "high":
      return "border-orange-400/25 bg-orange-400/10";

    case "warning":
      return "border-amber-400/25 bg-amber-400/10";

    case "info":
      return "border-sky-400/25 bg-sky-400/10";
  }
}

function getUsageTone(
  percentage: number | null
): HealthSeverity {
  if (percentage === null) {
    return "warning";
  }

  if (percentage >= 95) {
    return "critical";
  }

  if (percentage >= 70) {
    return "warning";
  }

  return "healthy";
}

function clampPercentage(
  value: number | null
): number {
  if (
    value === null ||
    !Number.isFinite(value)
  ) {
    return 0;
  }

  return Math.min(
    100,
    Math.max(
      0,
      value
    )
  );
}

export default function SystemHealthDashboard() {
  const [
    latest,
    setLatest,
  ] =
    useState<NormalisedSnapshot | null>(
      null
    );

  const [
    history,
    setHistory,
  ] =
    useState<NormalisedSnapshot[]>([]);

  const [
    alerts,
    setAlerts,
  ] =
    useState<HealthAlert[]>([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(false);

  const [
    checkState,
    setCheckState,
  ] =
    useState<CheckState>("idle");

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] =
    useState("");

  const [
    autoRefresh,
    setAutoRefresh,
  ] =
    useState(true);

  const [
    lastLoadedAt,
    setLastLoadedAt,
  ] =
    useState<string | null>(null);

  const mountedRef =
    useRef(true);

  const loadHealth =
    useCallback(
      async ({
        silent = false,
      }: {
        silent?: boolean;
      } = {}) => {
        if (!silent) {
          setRefreshing(true);
        }

        try {
          const response =
            await fetch(
              `/api/admin/system-health?limit=${HISTORY_LIMIT}`,
              {
                method: "GET",
                cache: "no-store",
                headers: {
                  Accept:
                    "application/json",
                },
              }
            );

          const payload =
            (await response
              .json()
              .catch(
                () =>
                  null
              )) as HealthReadResponse | null;

          if (
            !response.ok ||
            !payload?.ok
          ) {
            throw new Error(
              payload?.error ||
                "Could not load system health data."
            );
          }

          const normalisedLatest =
            normaliseSnapshot(
              payload.latest
            );

          const normalisedHistory =
            Array.isArray(
              payload.history
            )
              ? payload.history
                  .map(
                    normaliseSnapshot
                  )
                  .filter(
                    (
                      value
                    ): value is NormalisedSnapshot =>
                      value !== null
                  )
              : [];

          const normalisedAlerts =
            Array.isArray(
              payload.alerts
            )
              ? payload.alerts.map(
                  normaliseAlert
                )
              : [];

          if (!mountedRef.current) {
            return;
          }

          setLatest(
            normalisedLatest
          );

          setHistory(
            normalisedHistory
          );

          setAlerts(
            normalisedAlerts
          );

          setLastLoadedAt(
            new Date().toISOString()
          );

          setErrorMessage("");
        } catch (error) {
          if (!mountedRef.current) {
            return;
          }

          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Could not load Operations Centre data."
          );
        } finally {
          if (mountedRef.current) {
            setLoading(false);
            setRefreshing(false);
          }
        }
      },
      []
    );

  const runCheck =
    useCallback(
      async (
        mode: HealthCheckMode
      ) => {
        if (
          checkState !== "idle"
        ) {
          return;
        }

        setCheckState(mode);
        setErrorMessage("");
        setSuccessMessage("");

        try {
          const response =
            await fetch(
              "/api/admin/system-health/check",
              {
                method: "POST",
                cache: "no-store",
                headers: {
                  "Content-Type":
                    "application/json",
                  Accept:
                    "application/json",
                },
                body:
                  JSON.stringify({
                    mode,
                  }),
              }
            );

          const payload =
            (await response
              .json()
              .catch(
                () =>
                  null
              )) as HealthCheckResponse | null;

          if (
            !response.ok ||
            !payload?.ok
          ) {
            throw new Error(
              payload?.error ||
                "The system health check failed."
            );
          }

          setSuccessMessage(
            mode === "daily"
              ? "Daily deep health check completed successfully."
              : "Lightweight health check completed successfully."
          );

          await loadHealth({
            silent: true,
          });
        } catch (error) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "The system health check failed."
          );
        } finally {
          setCheckState("idle");
        }
      },
      [
        checkState,
        loadHealth,
      ]
    );

  useEffect(() => {
    mountedRef.current = true;

    void loadHealth();

    return () => {
      mountedRef.current = false;
    };
  }, [loadHealth]);

  useEffect(() => {
    if (!autoRefresh) {
      return;
    }

    const intervalId =
      window.setInterval(
        () => {
          void loadHealth({
            silent: true,
          });
        },
        AUTO_REFRESH_INTERVAL_MS
      );

    return () => {
      window.clearInterval(
        intervalId
      );
    };
  }, [
    autoRefresh,
    loadHealth,
  ]);

  const intelligence =
    useMemo(
      () =>
        analyseSystemHealth(
          latest
        ),
      [latest]
    );

  const activeAlerts =
    useMemo(
      () =>
        alerts.filter(
          (alert) =>
            alert.status ===
              "active" ||
            alert.status ===
              "acknowledged"
        ),
      [alerts]
    );

  const sortedServices =
    useMemo(
      () =>
        [...(latest?.services ?? [])].sort(
          (
            first,
            second
          ) => {
            const statusOrder:
              Record<
                HealthSeverity,
                number
              > = {
              offline: 4,
              critical: 3,
              warning: 2,
              healthy: 1,
            };

            const statusDifference =
              statusOrder[
                second.status
              ] -
              statusOrder[
                first.status
              ];

            if (
              statusDifference !==
              0
            ) {
              return statusDifference;
            }

            return first.label.localeCompare(
              second.label,
              "en-GB"
            );
          }
        ),
      [latest]
    );

  if (
    loading &&
    !latest
  ) {
    return (
      <OperationsLoading />
    );
  }

  return (
    <div className="space-y-6 pb-16">
      <OperationsHeader
        latest={latest}
        intelligence={
          intelligence
        }
        checkState={
          checkState
        }
        refreshing={
          refreshing
        }
        autoRefresh={
          autoRefresh
        }
        lastLoadedAt={
          lastLoadedAt
        }
        onCheck={
          runCheck
        }
        onRefresh={() =>
          void loadHealth()
        }
        onAutoRefreshChange={
          setAutoRefresh
        }
      />

      {errorMessage ? (
        <MessagePanel
          tone="error"
          message={
            errorMessage
          }
        />
      ) : null}

      {successMessage ? (
        <MessagePanel
          tone="success"
          message={
            successMessage
          }
        />
      ) : null}

      <IntelligenceOverview
        latest={latest}
        intelligence={
          intelligence
        }
        alertsCount={
          activeAlerts.length
        }
      />

      <section
        aria-labelledby="services-heading"
        className="rounded-[2rem] border border-yellow-500/15 bg-[#061024] p-5 shadow-2xl shadow-black/20 md:p-7"
      >
        <SectionHeading
          eyebrow="Live infrastructure"
          title="Monitored services"
          description="Current availability and response times from the latest platform health check."
        />

        {sortedServices.length >
        0 ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sortedServices.map(
              (service) => (
                <ServiceStatusCard
                  key={
                    service.key
                  }
                  service={
                    service
                  }
                />
              )
            )}
          </div>
        ) : (
          <EmptyPanel message="No service results are available. Run a health check to populate this section." />
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <HistoryPanel
          history={
            history
          }
        />

        <LatestSnapshotPanel
          latest={
            latest
          }
          lastLoadedAt={
            lastLoadedAt
          }
        />
      </div>

      <UsagePanel
        usage={
          latest?.usage ?? []
        }
      />

      <ApplicationMetricsPanel
        metrics={
          latest?.application ??
          []
        }
        latestMode={
          latest?.mode ?? null
        }
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <FindingsPanel
          findings={
            intelligence.findings
          }
        />

        <AlertsPanel
          alerts={
            activeAlerts
          }
        />
      </div>
    </div>
  );
}

function OperationsHeader({
  latest,
  intelligence,
  checkState,
  refreshing,
  autoRefresh,
  lastLoadedAt,
  onCheck,
  onRefresh,
  onAutoRefreshChange,
}: {
  latest: NormalisedSnapshot | null;
  intelligence: HealthIntelligenceSummary;
  checkState: CheckState;
  refreshing: boolean;
  autoRefresh: boolean;
  lastLoadedAt: string | null;
  onCheck: (
    mode: HealthCheckMode
  ) => Promise<void>;
  onRefresh: () => void;
  onAutoRefreshChange: (
    value: boolean
  ) => void;
}) {
  const disabled =
    checkState !== "idle";

  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-yellow-500/20 bg-[#061024] p-6 shadow-2xl shadow-black/25 md:p-8">
      <div className="pointer-events-none absolute -right-28 -top-28 size-80 rounded-full border border-yellow-500/10" />
      <div className="pointer-events-none absolute -right-10 -top-10 size-52 rounded-full border border-yellow-500/10" />

      <div className="relative flex flex-col gap-7 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-4xl">
          <div className="text-xs font-black uppercase tracking-[0.32em] text-yellow-400">
            SalahNearMe Operations Centre
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <h1 className="text-4xl font-black tracking-tight text-white md:text-6xl">
              Intelligent platform monitoring
            </h1>

            <span
              className={`rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.16em] ${getGradeClasses(
                intelligence.grade
              )}`}
            >
              {intelligence.grade}
            </span>
          </div>

          <p className="mt-4 max-w-3xl text-base leading-8 text-white/65 md:text-lg">
            Live infrastructure health,
            operational intelligence,
            quota awareness and automated
            service monitoring.
          </p>

          <div className="mt-5 flex flex-wrap gap-3 text-xs text-white/45">
            <span>
              Latest check:{" "}
              <strong className="text-white/75">
                {formatRelativeTime(
                  latest?.checked_at
                )}
              </strong>
            </span>

            <span aria-hidden="true">
              •
            </span>

            <span>
              Dashboard refreshed:{" "}
              <strong className="text-white/75">
                {formatRelativeTime(
                  lastLoadedAt
                )}
              </strong>
            </span>

            <span aria-hidden="true">
              •
            </span>

            <span>
              Auto-refresh:{" "}
              <strong
                className={
                  autoRefresh
                    ? "text-emerald-300"
                    : "text-white/60"
                }
              >
                {autoRefresh
                  ? "On"
                  : "Off"}
              </strong>
            </span>
          </div>
        </div>

        <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap xl:w-auto xl:justify-end">
          <button
            type="button"
            disabled={
              disabled
            }
            onClick={() =>
              void onCheck(
                "lightweight"
              )
            }
            className="rounded-2xl bg-yellow-500 px-5 py-3 text-sm font-black text-black transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {checkState ===
            "lightweight"
              ? "Checking..."
              : "Run quick check"}
          </button>

          <button
            type="button"
            disabled={
              disabled
            }
            onClick={() =>
              void onCheck(
                "daily"
              )
            }
            className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 px-5 py-3 text-sm font-black text-yellow-200 transition hover:bg-yellow-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {checkState ===
            "daily"
              ? "Running deep scan..."
              : "Run daily deep scan"}
          </button>

          <button
            type="button"
            onClick={
              onRefresh
            }
            disabled={
              refreshing
            }
            className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-white/75 transition hover:border-yellow-500/25 hover:text-yellow-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {refreshing
              ? "Refreshing..."
              : "Refresh data"}
          </button>

          <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/70">
            <span className="font-bold">
              Auto-refresh
            </span>

            <input
              type="checkbox"
              checked={
                autoRefresh
              }
              onChange={(
                event
              ) =>
                onAutoRefreshChange(
                  event.target
                    .checked
                )
              }
              className="size-5 accent-yellow-500"
            />
          </label>
        </div>
      </div>
    </section>
  );
}

function IntelligenceOverview({
  latest,
  intelligence,
  alertsCount,
}: {
  latest: NormalisedSnapshot | null;
  intelligence: HealthIntelligenceSummary;
  alertsCount: number;
}) {
  return (
    <section className="grid gap-5 xl:grid-cols-[340px_1fr]">
      <article className="rounded-[2rem] border border-yellow-500/20 bg-[#061024] p-6 shadow-2xl shadow-black/20">
        <div className="text-xs font-black uppercase tracking-[0.24em] text-yellow-400">
          Intelligence score
        </div>

        <div className="mt-5 flex items-end gap-3">
          <div className="text-7xl font-black tracking-tighter text-white">
            {intelligence.score}
          </div>

          <div className="pb-2 text-xl font-bold text-white/35">
            /100
          </div>
        </div>

        <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-yellow-500 transition-all duration-700"
            style={{
              width: `${clampPercentage(
                intelligence.score
              )}%`,
            }}
          />
        </div>

        <div
          className={`mt-5 rounded-2xl border p-4 ${getGradeClasses(
            intelligence.grade
          )}`}
        >
          <div className="text-sm font-black capitalize">
            {intelligence.grade}
          </div>

          <p className="mt-2 text-sm leading-6 text-current/80">
            {intelligence.headline}
          </p>
        </div>
      </article>

      <article className="rounded-[2rem] border border-yellow-500/15 bg-[#061024] p-6 shadow-2xl shadow-black/20 md:p-7">
        <div className="text-xs font-black uppercase tracking-[0.24em] text-yellow-400">
          Operational assessment
        </div>

        <h2 className="mt-3 text-2xl font-black text-white md:text-3xl">
          {intelligence.headline}
        </h2>

        <p className="mt-3 max-w-4xl text-sm leading-7 text-white/60">
          {intelligence.explanation}
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Healthy services"
            value={
              intelligence.healthyServices
            }
            tone="healthy"
          />

          <MetricCard
            label="Warnings"
            value={
              intelligence.warningServices
            }
            tone="warning"
          />

          <MetricCard
            label="Critical / offline"
            value={
              intelligence.criticalServices +
              intelligence.offlineServices
            }
            tone={
              intelligence.criticalServices +
                intelligence.offlineServices >
              0
                ? "critical"
                : "healthy"
            }
          />

          <MetricCard
            label="Active alerts"
            value={
              alertsCount
            }
            tone={
              alertsCount > 0
                ? "warning"
                : "healthy"
            }
          />
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <SmallInfoCard
            label="Overall status"
            value={
              latest?.overall_status ??
              "No snapshot"
            }
          />

          <SmallInfoCard
            label="Average response"
            value={formatMilliseconds(
              intelligence.averageResponseTimeMs
            )}
          />

          <SmallInfoCard
            label="Slowest service"
            value={
              intelligence.slowestService
                ? `${intelligence.slowestService.label} · ${formatMilliseconds(
                    intelligence
                      .slowestService
                      .response_time_ms
                  )}`
                : "Unavailable"
            }
          />
        </div>
      </article>
    </section>
  );
}

function ServiceStatusCard({
  service,
}: {
  service: ServiceCheck;
}) {
  return (
    <article className="rounded-3xl border border-white/10 bg-black/25 p-5 transition hover:border-yellow-500/20">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className={`size-3 shrink-0 rounded-full ${getStatusDotClasses(
                service.status
              )}`}
            />

            <h3 className="truncate text-lg font-black text-white">
              {service.label}
            </h3>
          </div>

          <div
            className={`mt-3 inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${getStatusClasses(
              service.status
            )}`}
          >
            {service.status}
          </div>
        </div>

        <div className="shrink-0 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-white/65">
          {formatMilliseconds(
            service.response_time_ms
          )}
        </div>
      </div>

      <p className="mt-4 min-h-12 text-sm leading-6 text-white/55">
        {service.message}
      </p>

      <div className="mt-4 border-t border-white/10 pt-4 text-xs text-white/35">
        Checked{" "}
        {formatRelativeTime(
          service.checked_at
        )}
      </div>
    </article>
  );
}

function HistoryPanel({
  history,
}: {
  history: NormalisedSnapshot[];
}) {
  const ordered =
    useMemo(
      () =>
        [...history]
          .filter(
            (item) =>
              Number.isFinite(
                item.response_time_ms
              )
          )
          .sort(
            (
              first,
              second
            ) =>
              new Date(
                first.checked_at
              ).getTime() -
              new Date(
                second.checked_at
              ).getTime()
          ),
      [history]
    );

  return (
    <section className="rounded-[2rem] border border-yellow-500/15 bg-[#061024] p-5 shadow-2xl shadow-black/20 md:p-7">
      <SectionHeading
        eyebrow="Performance history"
        title="Response-time trend"
        description={`Latest ${ordered.length} stored health snapshots.`}
      />

      {ordered.length >= 2 ? (
        <div className="mt-6">
          <HistoryChart
            snapshots={
              ordered
            }
          />

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <SmallInfoCard
              label="Latest"
              value={formatMilliseconds(
                ordered[
                  ordered.length -
                    1
                ]
                  ?.response_time_ms
              )}
            />

            <SmallInfoCard
              label="Fastest"
              value={formatMilliseconds(
                Math.min(
                  ...ordered.map(
                    (
                      item
                    ) =>
                      item.response_time_ms
                  )
                )
              )}
            />

            <SmallInfoCard
              label="Slowest"
              value={formatMilliseconds(
                Math.max(
                  ...ordered.map(
                    (
                      item
                    ) =>
                      item.response_time_ms
                  )
                )
              )}
            />
          </div>
        </div>
      ) : (
        <EmptyPanel message="Run more health checks to generate a response-time trend." />
      )}
    </section>
  );
}

function HistoryChart({
  snapshots,
}: {
  snapshots: NormalisedSnapshot[];
}) {
  const width = 900;
  const height = 260;
  const padding = 28;

  const values =
    snapshots.map(
      (snapshot) =>
        snapshot.response_time_ms
    );

  const maximum =
    Math.max(
      ...values,
      1
    );

  const minimum =
    Math.min(
      ...values,
      0
    );

  const range =
    Math.max(
      1,
      maximum - minimum
    );

  const points =
    snapshots.map(
      (
        snapshot,
        index
      ) => {
        const x =
          padding +
          (index /
            Math.max(
              1,
              snapshots.length -
                1
            )) *
            (width -
              padding * 2);

        const y =
          height -
          padding -
          ((snapshot.response_time_ms -
            minimum) /
            range) *
            (height -
              padding * 2);

        return {
          x,
          y,
          snapshot,
        };
      }
    );

  const path =
    points
      .map(
        (
          point,
          index
        ) =>
          `${index === 0 ? "M" : "L"} ${point.x.toFixed(
            2
          )} ${point.y.toFixed(
            2
          )}`
      )
      .join(" ");

  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-black/25 p-3">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="System health response time history"
        className="h-auto w-full"
      >
        <defs>
          <linearGradient
            id="health-chart-fill"
            x1="0"
            x2="0"
            y1="0"
            y2="1"
          >
            <stop
              offset="0%"
              stopColor="rgb(234 179 8)"
              stopOpacity="0.3"
            />
            <stop
              offset="100%"
              stopColor="rgb(234 179 8)"
              stopOpacity="0"
            />
          </linearGradient>
        </defs>

        {[0.25, 0.5, 0.75].map(
          (ratio) => (
            <line
              key={
                ratio
              }
              x1={
                padding
              }
              x2={
                width -
                padding
              }
              y1={
                padding +
                ratio *
                  (height -
                    padding *
                      2)
              }
              y2={
                padding +
                ratio *
                  (height -
                    padding *
                      2)
              }
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="1"
            />
          )
        )}

        <path
          d={`${path} L ${
            points[
              points.length -
                1
            ]?.x ?? padding
          } ${
            height -
            padding
          } L ${
            points[0]
              ?.x ?? padding
          } ${
            height -
            padding
          } Z`}
          fill="url(#health-chart-fill)"
        />

        <path
          d={path}
          fill="none"
          stroke="rgb(234 179 8)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {points.map(
          (
            point,
            index
          ) => (
            <g
              key={`${point.snapshot.id ?? "snapshot"}-${index}`}
            >
              <circle
                cx={
                  point.x
                }
                cy={
                  point.y
                }
                r="7"
                fill="rgb(6 16 36)"
                stroke="rgb(234 179 8)"
                strokeWidth="4"
              />

              <title>
                {`${formatDateTime(
                  point
                    .snapshot
                    .checked_at
                )}: ${formatMilliseconds(
                  point
                    .snapshot
                    .response_time_ms
                )}`}
              </title>
            </g>
          )
        )}
      </svg>
    </div>
  );
}

function LatestSnapshotPanel({
  latest,
  lastLoadedAt,
}: {
  latest: NormalisedSnapshot | null;
  lastLoadedAt: string | null;
}) {
  return (
    <section className="rounded-[2rem] border border-yellow-500/15 bg-[#061024] p-5 shadow-2xl shadow-black/20 md:p-7">
      <SectionHeading
        eyebrow="Latest snapshot"
        title="Monitoring details"
        description="Operational context from the latest stored platform check."
      />

      {latest ? (
        <div className="mt-6 space-y-3">
          <DetailRow
            label="Snapshot ID"
            value={
              latest.id ??
              "Unavailable"
            }
          />

          <DetailRow
            label="Mode"
            value={
              latest.mode
            }
          />

          <DetailRow
            label="Overall status"
            value={
              latest.overall_status
            }
          />

          <DetailRow
            label="Services"
            value={String(
              latest.services
                .length
            )}
          />

          <DetailRow
            label="Total check time"
            value={formatMilliseconds(
              latest.response_time_ms
            )}
          />

          <DetailRow
            label="Checked"
            value={formatDateTime(
              latest.checked_at
            )}
          />

          <DetailRow
            label="Dashboard loaded"
            value={formatDateTime(
              lastLoadedAt
            )}
          />
        </div>
      ) : (
        <EmptyPanel message="No health snapshot has been recorded." />
      )}
    </section>
  );
}

function UsagePanel({
  usage,
}: {
  usage: UsageMetric[];
}) {
  return (
    <section className="rounded-[2rem] border border-yellow-500/15 bg-[#061024] p-5 shadow-2xl shadow-black/20 md:p-7">
      <SectionHeading
        eyebrow="Capacity and quota"
        title="Usage monitoring"
        description="Configured Supabase capacity metrics and intelligent alert thresholds."
      />

      {usage.length > 0 ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {usage.map(
            (metric) => (
              <UsageGauge
                key={
                  metric.key
                }
                metric={
                  metric
                }
              />
            )
          )}
        </div>
      ) : (
        <EmptyPanel message="No quota metrics were returned by the latest health check." />
      )}
    </section>
  );
}

function UsageGauge({
  metric,
}: {
  metric: UsageMetric;
}) {
  const percentage =
    metric.percentage !==
      null
      ? clampPercentage(
          metric.percentage
        )
      : null;

  const tone =
    getUsageTone(
      percentage
    );

  return (
    <article className="rounded-3xl border border-white/10 bg-black/25 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-black text-white">
            {metric.label}
          </h3>

          <p className="mt-1 text-xs text-white/40">
            {metric.estimated
              ? "Estimated/configured"
              : "Live provider data"}
          </p>
        </div>

        <span
          className={`rounded-full border px-3 py-1 text-xs font-black ${getStatusClasses(
            tone
          )}`}
        >
          {percentage === null
            ? "Unavailable"
            : `${percentage.toFixed(
                1
              )}%`}
        </span>
      </div>

      <div className="mt-6 h-3 overflow-hidden rounded-full bg-white/10">
        <div
          className={
            tone ===
            "critical"
              ? "h-full rounded-full bg-red-400 transition-all duration-700"
              : tone ===
                  "warning"
                ? "h-full rounded-full bg-amber-400 transition-all duration-700"
                : "h-full rounded-full bg-emerald-400 transition-all duration-700"
          }
          style={{
            width: `${percentage ?? 0}%`,
          }}
        />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <SmallInfoCard
          label="Used"
          value={formatMetricValue(
            metric.used,
            metric.unit
          )}
        />

        <SmallInfoCard
          label="Limit"
          value={formatMetricValue(
            metric.limit,
            metric.unit
          )}
        />
      </div>

      <p className="mt-4 text-xs leading-6 text-white/40">
        {metric.message ||
          (percentage === null
            ? "Add configured usage and quota values to enable forecasting."
            : "Usage is being compared with the configured capacity limit.")}
      </p>
    </article>
  );
}

function ApplicationMetricsPanel({
  metrics,
  latestMode,
}: {
  metrics: ApplicationMetric[];
  latestMode: HealthCheckMode | null;
}) {
  return (
    <section className="rounded-[2rem] border border-yellow-500/15 bg-[#061024] p-5 shadow-2xl shadow-black/20 md:p-7">
      <SectionHeading
        eyebrow="Application intelligence"
        title="Platform record counts"
        description="Daily deep scans collect important SalahNearMe application metrics."
      />

      {metrics.length > 0 ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {metrics.map(
            (metric) => (
              <article
                key={
                  metric.key
                }
                className="rounded-3xl border border-white/10 bg-black/25 p-5"
              >
                <div className="text-xs font-black uppercase tracking-[0.16em] text-yellow-400">
                  {metric.label}
                </div>

                <div className="mt-4 text-3xl font-black text-white">
                  {metric.value !==
                  null
                    ? metric.value.toLocaleString(
                        "en-GB"
                      )
                    : "—"}
                </div>

                <div
                  className={`mt-4 inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase ${getStatusClasses(
                    metric.status
                  )}`}
                >
                  {metric.status}
                </div>

                {metric.message ? (
                  <p className="mt-3 text-xs leading-5 text-white/40">
                    {
                      metric.message
                    }
                  </p>
                ) : null}
              </article>
            )
          )}
        </div>
      ) : (
        <EmptyPanel
          message={
            latestMode ===
            "lightweight"
              ? "Application counts are collected during a daily deep scan. Use “Run daily deep scan” above."
              : "No application metrics were returned by the latest daily scan."
          }
        />
      )}
    </section>
  );
}

function FindingsPanel({
  findings,
}: {
  findings: IntelligenceFinding[];
}) {
  return (
    <section className="rounded-[2rem] border border-yellow-500/15 bg-[#061024] p-5 shadow-2xl shadow-black/20 md:p-7">
      <SectionHeading
        eyebrow="Intelligent analysis"
        title="Operational findings"
        description="Prioritised observations and recommended actions generated from the latest snapshot."
      />

      <div className="mt-6 space-y-4">
        {findings.map(
          (finding) => (
            <article
              key={
                finding.id
              }
              className={`rounded-3xl border p-5 ${getFindingClasses(
                finding.severity
              )}`}
            >
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white/70">
                  {
                    finding.severity
                  }
                </span>

                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-white/40">
                  {
                    finding.category
                  }
                </span>
              </div>

              <h3 className="mt-4 text-lg font-black text-white">
                {finding.title}
              </h3>

              <p className="mt-2 text-sm leading-6 text-white/60">
                {finding.message}
              </p>

              {finding.recommendation ? (
                <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-xs font-black uppercase tracking-[0.14em] text-yellow-300">
                    Recommended action
                  </div>

                  <p className="mt-2 text-sm leading-6 text-white/60">
                    {
                      finding.recommendation
                    }
                  </p>
                </div>
              ) : null}
            </article>
          )
        )}
      </div>
    </section>
  );
}

function AlertsPanel({
  alerts,
}: {
  alerts: HealthAlert[];
}) {
  return (
    <section className="rounded-[2rem] border border-yellow-500/15 bg-[#061024] p-5 shadow-2xl shadow-black/20 md:p-7">
      <SectionHeading
        eyebrow="Alert centre"
        title="Active alerts"
        description="Open or acknowledged platform alerts generated by the monitoring engine."
      />

      {alerts.length > 0 ? (
        <div className="mt-6 space-y-4">
          {alerts.map(
            (alert) => (
              <article
                key={
                  alert.id
                }
                className={`rounded-3xl border p-5 ${getAlertClasses(
                  alert.severity
                )}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white/70">
                      {
                        alert.severity
                      }
                    </span>

                    <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white/55">
                      {
                        alert.status
                      }
                    </span>
                  </div>

                  <span className="text-xs text-white/35">
                    {formatRelativeTime(
                      alert.lastDetectedAt
                    )}
                  </span>
                </div>

                <h3 className="mt-4 text-lg font-black text-white">
                  {alert.title}
                </h3>

                <p className="mt-2 text-sm leading-6 text-white/60">
                  {alert.message}
                </p>

                {alert.metricName ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <SmallInfoCard
                      label="Metric"
                      value={
                        alert.metricName
                      }
                    />

                    <SmallInfoCard
                      label="Value"
                      value={
                        alert.metricValue !==
                        null
                          ? String(
                              alert.metricValue
                            )
                          : "—"
                      }
                    />

                    <SmallInfoCard
                      label="Threshold"
                      value={
                        alert.thresholdValue !==
                        null
                          ? String(
                              alert.thresholdValue
                            )
                          : "—"
                      }
                    />
                  </div>
                ) : null}
              </article>
            )
          )}
        </div>
      ) : (
        <div className="mt-6 rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-6">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="size-3 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.7)]"
            />

            <div className="text-lg font-black text-emerald-200">
              No active alerts
            </div>
          </div>

          <p className="mt-3 text-sm leading-6 text-white/55">
            The monitoring engine has not detected any active or acknowledged incidents.
          </p>
        </div>
      )}
    </section>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: HealthSeverity;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="text-xs font-black uppercase tracking-[0.14em] text-white/40">
        {label}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="text-3xl font-black text-white">
          {value.toLocaleString(
            "en-GB"
          )}
        </div>

        <span
          className={`size-3 rounded-full ${getStatusDotClasses(
            tone
          )}`}
        />
      </div>
    </div>
  );
}

function SmallInfoCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.14em] text-white/35">
        {label}
      </div>

      <div
        className="mt-2 truncate text-sm font-black capitalize text-white/80"
        title={value}
      >
        {value}
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
    <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-xs font-black uppercase tracking-[0.14em] text-white/35">
        {label}
      </div>

      <div
        className="max-w-full break-all text-sm font-bold capitalize text-white/75"
        title={value}
      >
        {value}
      </div>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <div className="text-xs font-black uppercase tracking-[0.24em] text-yellow-400">
        {eyebrow}
      </div>

      <h2
        id={`${title
          .toLowerCase()
          .replace(
            /[^a-z0-9]+/g,
            "-"
          )}-heading`}
        className="mt-3 text-2xl font-black text-white md:text-3xl"
      >
        {title}
      </h2>

      <p className="mt-2 max-w-3xl text-sm leading-7 text-white/50">
        {description}
      </p>
    </div>
  );
}

function MessagePanel({
  tone,
  message,
}: {
  tone:
    | "error"
    | "success";
  message: string;
}) {
  return (
    <div
      role={
        tone === "error"
          ? "alert"
          : "status"
      }
      className={
        tone === "error"
          ? "rounded-2xl border border-red-400/25 bg-red-400/10 p-5 text-sm font-bold text-red-200"
          : "rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-5 text-sm font-bold text-emerald-200"
      }
    >
      {message}
    </div>
  );
}

function EmptyPanel({
  message,
}: {
  message: string;
}) {
  return (
    <div className="mt-6 rounded-3xl border border-white/10 bg-black/20 p-8 text-center text-sm leading-7 text-white/45">
      {message}
    </div>
  );
}

function OperationsLoading() {
  return (
    <section
      aria-busy="true"
      aria-live="polite"
      className="rounded-[2rem] border border-yellow-500/20 bg-[#061024] p-8 shadow-2xl shadow-black/25"
    >
      <div className="flex items-center gap-4">
        <span className="size-6 animate-spin rounded-full border-2 border-yellow-400/25 border-t-yellow-400" />

        <div>
          <div className="text-lg font-black text-white">
            Loading Operations Centre
          </div>

          <p className="mt-1 text-sm text-white/50">
            Retrieving the latest monitoring snapshot, alerts and operational intelligence.
          </p>
        </div>
      </div>
    </section>
  );
}