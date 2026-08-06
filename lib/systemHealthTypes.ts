export const HEALTH_SEVERITIES = [
  "healthy",
  "warning",
  "critical",
  "offline",
] as const;

export type HealthSeverity =
  (typeof HEALTH_SEVERITIES)[number];

/**
 * Backward-compatible alias.
 *
 * Some Operations Centre modules refer to this type as HealthStatus.
 * Both names now resolve to the same strict union.
 */
export type HealthStatus = HealthSeverity;

export const HEALTH_CHECK_MODES = [
  "lightweight",
  "daily",
] as const;

export type HealthCheckMode =
  (typeof HEALTH_CHECK_MODES)[number];

export type HealthMetadataValue =
  | string
  | number
  | boolean
  | null
  | HealthMetadataValue[]
  | {
      [key: string]: HealthMetadataValue;
    };

export type HealthMetadata = Record<
  string,
  HealthMetadataValue
>;

export type ServiceCheck = {
  key: string;
  label: string;
  status: HealthSeverity;
  response_time_ms: number | null;
  message: string;
  checked_at: string;
  metadata?: HealthMetadata;
};

/**
 * Backward-compatible alias used by the intelligence layer.
 */
export type ServiceHealthResult =
  ServiceCheck;

export type UsageMetricSource =
  | "management_api"
  | "database"
  | "configuration"
  | "unavailable";

export type UsageMetric = {
  key: string;
  label: string;
  used: number | null;
  limit: number | null;
  unit: string;
  percentage: number | null;
  source: UsageMetricSource;
  estimated: boolean;
  status?: HealthSeverity;
  message?: string;
  metadata?: HealthMetadata;
};

export type ApplicationMetric = {
  key: string;
  label: string;
  value: number | null;
  status: HealthSeverity;
  message?: string;
  metadata?: HealthMetadata;
};

export type SystemHealthSnapshotMetadata = {
  project_ref_configured: boolean;
  management_api_configured: boolean;
  site_url: string | null;
  version: 1;
  [key: string]: HealthMetadataValue;
};

export type SystemHealthSnapshot = {
  overall_status: HealthSeverity;
  mode: HealthCheckMode;
  services: ServiceCheck[];
  usage: UsageMetric[];
  application: ApplicationMetric[];
  response_time_ms: number;
  checked_at: string;
  metadata: SystemHealthSnapshotMetadata;
};

export type PersistedSystemHealthSnapshot =
  SystemHealthSnapshot & {
    id: string;
    created_at?: string | null;
  };

export const ALERT_SEVERITIES = [
  "info",
  "warning",
  "high",
  "critical",
] as const;

export type AlertSeverity =
  (typeof ALERT_SEVERITIES)[number];

export type AlertStatus =
  | "active"
  | "acknowledged"
  | "resolved";

export type GeneratedAlert = {
  alert_key: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  metric_name: string | null;
  metric_value: number | null;
  threshold_value: number | null;
  metadata: HealthMetadata;
};

export type PersistedSystemHealthAlert =
  GeneratedAlert & {
    id: string;
    status: AlertStatus;
    first_detected_at: string;
    last_detected_at: string;
    acknowledged_at?: string | null;
    acknowledged_by?: string | null;
    resolved_at?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
  };

export type SystemHealthReadResponse = {
  ok: boolean;
  latest: PersistedSystemHealthSnapshot | null;
  history: PersistedSystemHealthSnapshot[];
  alerts: PersistedSystemHealthAlert[];
  error?: string;
};

export type SystemHealthCheckResponse = {
  ok: boolean;
  snapshot_id?: string;
  snapshot?: SystemHealthSnapshot;
  alerts_created_or_updated?: number;
  error?: string;
};

export function isHealthSeverity(
  value: unknown
): value is HealthSeverity {
  return (
    typeof value === "string" &&
    HEALTH_SEVERITIES.includes(
      value as HealthSeverity
    )
  );
}

export function isHealthCheckMode(
  value: unknown
): value is HealthCheckMode {
  return (
    typeof value === "string" &&
    HEALTH_CHECK_MODES.includes(
      value as HealthCheckMode
    )
  );
}

export function isAlertSeverity(
  value: unknown
): value is AlertSeverity {
  return (
    typeof value === "string" &&
    ALERT_SEVERITIES.includes(
      value as AlertSeverity
    )
  );
}

export function normaliseHealthSeverity(
  value: unknown,
  fallback: HealthSeverity = "warning"
): HealthSeverity {
  return isHealthSeverity(value)
    ? value
    : fallback;
}

export function normaliseHealthCheckMode(
  value: unknown,
  fallback: HealthCheckMode = "lightweight"
): HealthCheckMode {
  return isHealthCheckMode(value)
    ? value
    : fallback;
}