import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type {
  AlertSeverity,
  GeneratedAlert,
  HealthSeverity,
  SystemHealthSnapshot,
  UsageMetric,
} from "@/lib/systemHealthTypes";

const monitoringDb =
  supabaseAdmin as unknown as SupabaseClient;

const USAGE_THRESHOLDS = [
  {
    threshold: 95,
    severity:
      "critical",
  },
  {
    threshold: 85,
    severity: "high",
  },
  {
    threshold: 70,
    severity:
      "warning",
  },
  {
    threshold: 50,
    severity: "info",
  },
] as const satisfies ReadonlyArray<{
  threshold: number;
  severity: AlertSeverity;
}>;

function severityFromHealth(
  status: HealthSeverity
): AlertSeverity {
  if (
    status === "offline"
  ) {
    return "critical";
  }

  if (
    status === "critical"
  ) {
    return "high";
  }

  return "warning";
}

function getUsageAlert(
  metric: UsageMetric
): GeneratedAlert | null {
  if (
    metric.percentage ===
    null
  ) {
    return null;
  }

  const matched =
    USAGE_THRESHOLDS.find(
      (item) =>
        metric.percentage! >=
        item.threshold
    );

  if (!matched) {
    return null;
  }

  return {
    alert_key:
      `usage:${metric.key}`,
    severity:
      matched.severity,
    title:
      `${metric.label} reached ${matched.threshold}%`,
    message:
      `${metric.label} is currently at ${metric.percentage.toFixed(
        1
      )}% of its configured allowance.`,
    metric_name:
      metric.key,
    metric_value:
      metric.percentage,
    threshold_value:
      matched.threshold,
    metadata: {
      used:
        metric.used,
      limit:
        metric.limit,
      unit:
        metric.unit,
      estimated:
        metric.estimated,
      source:
        metric.source,
    },
  };
}

function getServiceAlerts(
  snapshot: SystemHealthSnapshot
): GeneratedAlert[] {
  return snapshot.services
    .filter(
      (service) =>
        service.status !==
        "healthy"
    )
    .map(
      (service) => ({
        alert_key:
          `service:${service.key}`,
        severity:
          severityFromHealth(
            service.status
          ),
        title:
          `${service.label} is ${service.status}`,
        message:
          service.message,
        metric_name:
          service.key,
        metric_value:
          service.response_time_ms,
        threshold_value:
          null,
        metadata: {
          service_status:
            service.status,
          checked_at:
            service.checked_at,
          ...service.metadata,
        },
      })
    );
}

function getAnomalyAlerts(
  snapshot: SystemHealthSnapshot,
  previous:
    SystemHealthSnapshot | null
): GeneratedAlert[] {
  if (!previous) {
    return [];
  }

  const alerts:
    GeneratedAlert[] = [];

  for (
    const service of
    snapshot.services
  ) {
    const prior =
      previous.services.find(
        (item) =>
          item.key ===
          service.key
      );

    if (
      !prior ||
      prior.response_time_ms ===
        null ||
      service.response_time_ms ===
        null ||
      prior.response_time_ms <
        100
    ) {
      continue;
    }

    const multiplier =
      service.response_time_ms /
      prior.response_time_ms;

    if (
      multiplier >= 3 &&
      service.response_time_ms >=
        1_000
    ) {
      alerts.push({
        alert_key:
          `anomaly:latency:${service.key}`,
        severity:
          service.response_time_ms >=
          3_000
            ? "high"
            : "warning",
        title:
          `${service.label} latency increased sharply`,
        message:
          `${service.label} response time rose from ${prior.response_time_ms} ms to ${service.response_time_ms} ms.`,
        metric_name:
          `${service.key}_response_time_ms`,
        metric_value:
          service.response_time_ms,
        threshold_value:
          prior.response_time_ms *
          3,
        metadata: {
          previous_response_time_ms:
            prior.response_time_ms,
          multiplier:
            Number(
              multiplier.toFixed(
                2
              )
            ),
        },
      });
    }
  }

  return alerts;
}

export function generateAlerts(
  snapshot: SystemHealthSnapshot,
  previous:
    SystemHealthSnapshot | null = null
): GeneratedAlert[] {
  const alerts = [
    ...getServiceAlerts(
      snapshot
    ),
    ...getAnomalyAlerts(
      snapshot,
      previous
    ),
  ];

  for (
    const metric of
    snapshot.usage
  ) {
    const alert =
      getUsageAlert(
        metric
      );

    if (alert) {
      alerts.push(alert);
    }
  }

  if (
    snapshot.response_time_ms >
    5_000
  ) {
    alerts.push({
      alert_key:
        "system:check_latency",
      severity:
        "warning",
      title:
        "System health check is slow",
      message:
        `The complete health check took ${snapshot.response_time_ms} ms.`,
      metric_name:
        "health_check_response_time_ms",
      metric_value:
        snapshot.response_time_ms,
      threshold_value:
        5_000,
      metadata: {
        mode:
          snapshot.mode,
      },
    });
  }

  return alerts;
}

async function getPreviousSnapshot(
  currentSnapshotId:
    string | null
): Promise<SystemHealthSnapshot | null> {
  let query =
    monitoringDb
      .from(
        "system_health_snapshots"
      )
      .select(
        "overall_status,mode,service_status,metrics,response_time_ms,checked_at"
      )
      .order(
        "checked_at",
        {
          ascending: false,
        }
      )
      .limit(1);

  if (
    currentSnapshotId
  ) {
    query =
      query.neq(
        "id",
        currentSnapshotId
      );
  }

  const {
    data,
    error,
  } = await query.maybeSingle();

  if (
    error ||
    !data
  ) {
    return null;
  }

  const metrics =
    data.metrics &&
    typeof data.metrics ===
      "object"
      ? data.metrics as {
          usage?: unknown;
          application?: unknown;
        }
      : {};

  return {
    overall_status:
      data.overall_status,
    mode:
      data.mode,
    services:
      Array.isArray(
        data.service_status
      )
        ? data.service_status
        : [],
    usage:
      Array.isArray(
        metrics.usage
      )
        ? metrics.usage
        : [],
    application:
      Array.isArray(
        metrics.application
      )
        ? metrics.application
        : [],
    response_time_ms:
      data.response_time_ms ??
      0,
    checked_at:
      data.checked_at,
    metadata: {
      project_ref_configured:
        false,
      management_api_configured:
        false,
      site_url: null,
      version: 1,
    },
  } as SystemHealthSnapshot;
}

export async function applyAlerts(
  snapshot: SystemHealthSnapshot,
  currentSnapshotId:
    string | null = null
): Promise<GeneratedAlert[]> {
  const previous =
    await getPreviousSnapshot(
      currentSnapshotId
    );

  const generated =
    generateAlerts(
      snapshot,
      previous
    );

  const now =
    new Date().toISOString();

  const activeKeys =
    generated.map(
      (alert) =>
        alert.alert_key
    );

  for (
    const alert of
    generated
  ) {
    const {
      data: existing,
      error: existingError,
    } = await monitoringDb
      .from(
        "system_health_alerts"
      )
      .select(
        "id,status"
      )
      .eq(
        "alert_key",
        alert.alert_key
      )
      .in(
        "status",
        [
          "active",
          "acknowledged",
        ]
      )
      .maybeSingle();

    if (existingError) {
      throw new Error(
        `Could not read system health alert: ${existingError.message}`
      );
    }

    if (
      existing?.id
    ) {
      const {
        error: updateError,
      } = await monitoringDb
        .from(
          "system_health_alerts"
        )
        .update({
          severity:
            alert.severity,
          title:
            alert.title,
          message:
            alert.message,
          metric_name:
            alert.metric_name,
          metric_value:
            alert.metric_value,
          threshold_value:
            alert.threshold_value,
          last_detected_at:
            now,
          metadata:
            alert.metadata,
          status:
            existing.status,
          resolved_at:
            null,
        })
        .eq(
          "id",
          existing.id
        );

      if (updateError) {
        throw new Error(
          `Could not update system health alert: ${updateError.message}`
        );
      }
    } else {
      const {
        error: insertError,
      } = await monitoringDb
        .from(
          "system_health_alerts"
        )
        .insert({
          ...alert,
          status:
            "active",
          first_detected_at:
            now,
          last_detected_at:
            now,
        });

      if (insertError) {
        throw new Error(
          `Could not create system health alert: ${insertError.message}`
        );
      }
    }
  }

  const {
    data: openAlerts,
    error: openAlertsError,
  } = await monitoringDb
    .from(
      "system_health_alerts"
    )
    .select(
      "id,alert_key"
    )
    .in(
      "status",
      [
        "active",
        "acknowledged",
      ]
    );

  if (openAlertsError) {
    throw new Error(
      `Could not read open system health alerts: ${openAlertsError.message}`
    );
  }

  const resolvedIds =
    (openAlerts ?? [])
      .filter(
        (row) =>
          !activeKeys.includes(
            String(
              row.alert_key
            )
          )
      )
      .map(
        (row) =>
          String(row.id)
      );

  if (
    resolvedIds.length > 0
  ) {
    const {
      error: resolveError,
    } = await monitoringDb
      .from(
        "system_health_alerts"
      )
      .update({
        status:
          "resolved",
        resolved_at:
          now,
      })
      .in(
        "id",
        resolvedIds
      );

    if (resolveError) {
      throw new Error(
        `Could not resolve system health alerts: ${resolveError.message}`
      );
    }
  }

  return generated;
}
