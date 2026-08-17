import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/adminAuth";
import {
  analyseOperationsIncidents,
  getHighestActiveIncidentSeverity,
  hasCriticalOperationsIncident,
} from "@/lib/operationsIncidentEngine";
import {
  analyseOperationsTrends,
  getAtRiskServices,
  getLeastStableService,
  hasPredictiveOperationalRisk,
} from "@/lib/operationsTrendEngine";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type {
  ApplicationMetric,
  HealthCheckMode,
  HealthMetadata,
  HealthMetadataValue,
  HealthSeverity,
  ServiceCheck,
  SystemHealthSnapshot,
  UsageMetric,
} from "@/lib/systemHealthTypes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_HISTORY_LIMIT = 30;
const MIN_HISTORY_LIMIT = 5;
const MAX_HISTORY_LIMIT = 100;

const MAX_METADATA_DEPTH = 8;
const MAX_METADATA_KEYS = 200;
const MAX_METADATA_STRING_LENGTH = 10_000;

type SnapshotRow = {
  id?: unknown;
  overall_status?: unknown;
  mode?: unknown;
  service_status?: unknown;
  metrics?: unknown;
  response_time_ms?: unknown;
  checked_at?: unknown;
  metadata?: unknown;
};

type StoredMetrics = {
  usage?: unknown;
  application?: unknown;
};

type IncidentApiSummary = {
  snapshots_analyzed: number;
  overall_risk: string;
  active_incidents: number;
  critical_incident_present: boolean;
  predictive_risk_present: boolean;
  highest_active_incident_severity: string | null;
  at_risk_services: number;
  early_warnings: number;
  least_stable_service: {
    key: string;
    label: string;
    stability_score: number | null;
    risk: string;
    direction: string;
  } | null;
};

function jsonResponse(
  body: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control":
        "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      "Surrogate-Control": "no-store",
    },
  });
}

function cleanString(
  value: unknown,
  maxLength = 5_000
): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
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
  const parsed = safeNumber(value);

  if (parsed === null) {
    return null;
  }

  return Math.max(0, parsed);
}

function safeBoolean(
  value: unknown
): boolean | null {
  return typeof value === "boolean"
    ? value
    : null;
}

function safeObject(
  value: unknown
): Record<string, unknown> | null {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  return value as Record<string, unknown>;
}

function safeArray(
  value: unknown
): unknown[] {
  return Array.isArray(value)
    ? value
    : [];
}

function safeDateString(
  value: unknown
): string | null {
  const raw = cleanString(value, 100);

  if (!raw) {
    return null;
  }

  const timestamp = Date.parse(raw);

  if (!Number.isFinite(timestamp)) {
    return null;
  }

  return new Date(timestamp).toISOString();
}

/**
 * Converts untrusted database JSON into the recursive
 * HealthMetadataValue type used by the monitoring layer.
 *
 * This prevents Record<string, unknown> from escaping into
 * strongly typed service, usage and application metrics.
 */
function normaliseMetadataValue(
  value: unknown,
  depth = 0
): HealthMetadataValue | undefined {
  if (depth > MAX_METADATA_DEPTH) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value === "string") {
    return value.slice(
      0,
      MAX_METADATA_STRING_LENGTH
    );
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value)
      ? value
      : undefined;
  }

  if (Array.isArray(value)) {
    const result: HealthMetadataValue[] = [];

    for (const item of value) {
      const normalised =
        normaliseMetadataValue(
          item,
          depth + 1
        );

      if (normalised !== undefined) {
        result.push(normalised);
      }
    }

    return result;
  }

  const objectValue =
    safeObject(value);

  if (!objectValue) {
    return undefined;
  }

  const result: {
    [key: string]: HealthMetadataValue;
  } = {};

  let processedKeys = 0;

  for (
    const [rawKey, rawValue] of
    Object.entries(objectValue)
  ) {
    if (
      processedKeys >= MAX_METADATA_KEYS
    ) {
      break;
    }

    const key =
      cleanString(rawKey, 200);

    if (!key) {
      continue;
    }

    const normalised =
      normaliseMetadataValue(
        rawValue,
        depth + 1
      );

    if (normalised === undefined) {
      continue;
    }

    result[key] = normalised;
    processedKeys += 1;
  }

  return result;
}

function normaliseMetadata(
  value: unknown
): HealthMetadata | undefined {
  const raw =
    safeObject(value);

  if (!raw) {
    return undefined;
  }

  const result: HealthMetadata = {};

  let processedKeys = 0;

  for (
    const [rawKey, rawValue] of
    Object.entries(raw)
  ) {
    if (
      processedKeys >= MAX_METADATA_KEYS
    ) {
      break;
    }

    const key =
      cleanString(rawKey, 200);

    if (!key) {
      continue;
    }

    const normalised =
      normaliseMetadataValue(
        rawValue,
        1
      );

    if (normalised === undefined) {
      continue;
    }

    result[key] = normalised;
    processedKeys += 1;
  }

  return result;
}

function normaliseHealthSeverity(
  value: unknown
): HealthSeverity {
  switch (
    cleanString(
      value,
      40
    ).toLowerCase()
  ) {
    case "healthy":
      return "healthy";

    case "warning":
      return "warning";

    case "critical":
      return "critical";

    case "offline":
      return "offline";

    default:
      /*
       * Unknown persisted states should not be silently
       * promoted to healthy.
       */
      return "warning";
  }
}

function normaliseOptionalHealthSeverity(
  value: unknown
): HealthSeverity | undefined {
  const raw =
    cleanString(
      value,
      40
    ).toLowerCase();

  if (!raw) {
    return undefined;
  }

  switch (raw) {
    case "healthy":
    case "warning":
    case "critical":
    case "offline":
      return raw;

    default:
      return undefined;
  }
}

function normaliseHealthCheckMode(
  value: unknown
): HealthCheckMode {
  return cleanString(
    value,
    40
  ).toLowerCase() === "daily"
    ? "daily"
    : "lightweight";
}

function normaliseService(
  value: unknown
): ServiceCheck | null {
  const row =
    safeObject(value);

  if (!row) {
    return null;
  }

  const key =
    cleanString(
      row.key,
      120
    );

  if (!key) {
    return null;
  }

  const label =
    cleanString(
      row.label,
      200
    ) || key;

  const checkedAt =
    safeDateString(
      row.checked_at
    ) ??
    new Date().toISOString();

  const responseTime =
    safeNonNegativeNumber(
      row.response_time_ms
    );

  const metadata =
    normaliseMetadata(
      row.metadata
    );

  return {
    key,
    label,

    status:
      normaliseHealthSeverity(
        row.status
      ),

    response_time_ms:
      responseTime === null
        ? null
        : Math.round(
            responseTime
          ),

    message:
      cleanString(
        row.message,
        2_000
      ),

    checked_at:
      checkedAt,

    ...(metadata
      ? {
          metadata,
        }
      : {}),
  };
}

function normaliseUsageMetric(
  value: unknown
): UsageMetric | null {
  const row =
    safeObject(value);

  if (!row) {
    return null;
  }

  const key =
    cleanString(
      row.key,
      120
    );

  if (!key) {
    return null;
  }

  const label =
    cleanString(
      row.label,
      200
    ) || key;

  const rawSource =
    cleanString(
      row.source,
      100
    ).toLowerCase();

  const source: UsageMetric["source"] =
    rawSource === "management_api" ||
    rawSource === "database" ||
    rawSource === "configuration" ||
    rawSource === "unavailable"
      ? rawSource
      : "unavailable";

  const used =
    safeNonNegativeNumber(
      row.used
    );

  const limit =
    safeNonNegativeNumber(
      row.limit
    );

  const percentageRaw =
    safeNumber(
      row.percentage
    );

  const percentage =
    percentageRaw === null
      ? null
      : Math.max(
          0,
          Math.min(
            100,
            percentageRaw
          )
        );

  const status =
    normaliseOptionalHealthSeverity(
      row.status
    );

  const message =
    cleanString(
      row.message,
      2_000
    );

  const metadata =
    normaliseMetadata(
      row.metadata
    );

  return {
    key,
    label,
    used,
    limit,

    unit:
      cleanString(
        row.unit,
        100
      ),

    percentage,
    source,

    estimated:
      safeBoolean(
        row.estimated
      ) ?? false,

    ...(status
      ? {
          status,
        }
      : {}),

    ...(message
      ? {
          message,
        }
      : {}),

    ...(metadata
      ? {
          metadata,
        }
      : {}),
  };
}

function normaliseApplicationMetric(
  value: unknown
): ApplicationMetric | null {
  const row =
    safeObject(value);

  if (!row) {
    return null;
  }

  const key =
    cleanString(
      row.key,
      120
    );

  if (!key) {
    return null;
  }

  const label =
    cleanString(
      row.label,
      200
    ) || key;

  const message =
    cleanString(
      row.message,
      2_000
    );

  const metadata =
    normaliseMetadata(
      row.metadata
    );

  return {
    key,
    label,

    value:
      safeNumber(
        row.value
      ),

    status:
      normaliseHealthSeverity(
        row.status
      ),

    ...(message
      ? {
          message,
        }
      : {}),

    ...(metadata
      ? {
          metadata,
        }
      : {}),
  };
}

function readMetadataBoolean(
  metadata:
    | HealthMetadata
    | undefined,
  key: string
): boolean {
  return metadata?.[key] === true;
}

function readMetadataString(
  metadata:
    | HealthMetadata
    | undefined,
  key: string
): string | null {
  const value =
    metadata?.[key];

  return typeof value === "string"
    ? cleanString(
        value,
        1_000
      ) || null
    : null;
}

function normaliseSnapshot(
  row: SnapshotRow
): SystemHealthSnapshot | null {
  const checkedAt =
    safeDateString(
      row.checked_at
    );

  if (!checkedAt) {
    return null;
  }

  const services =
    safeArray(
      row.service_status
    )
      .map(
        normaliseService
      )
      .filter(
        (
          service
        ): service is ServiceCheck =>
          service !== null
      );

  const metricsObject =
    safeObject(
      row.metrics
    );

  const metrics: StoredMetrics =
    metricsObject ?? {};

  const usage =
    safeArray(
      metrics.usage
    )
      .map(
        normaliseUsageMetric
      )
      .filter(
        (
          metric
        ): metric is UsageMetric =>
          metric !== null
      );

  const application =
    safeArray(
      metrics.application
    )
      .map(
        normaliseApplicationMetric
      )
      .filter(
        (
          metric
        ): metric is ApplicationMetric =>
          metric !== null
      );

  const rawMetadata =
    normaliseMetadata(
      row.metadata
    );

  const projectRefConfigured =
    readMetadataBoolean(
      rawMetadata,
      "project_ref_configured"
    );

  const managementApiConfigured =
    readMetadataBoolean(
      rawMetadata,
      "management_api_configured"
    );

  const siteUrl =
    readMetadataString(
      rawMetadata,
      "site_url"
    );

  const responseTime =
    safeNonNegativeNumber(
      row.response_time_ms
    );

  return {
    overall_status:
      normaliseHealthSeverity(
        row.overall_status
      ),

    mode:
      normaliseHealthCheckMode(
        row.mode
      ),

    services,
    usage,
    application,

    response_time_ms:
      responseTime === null
        ? 0
        : Math.round(
            responseTime
          ),

    checked_at:
      checkedAt,

    metadata: {
      project_ref_configured:
        projectRefConfigured,

      management_api_configured:
        managementApiConfigured,

      site_url:
        siteUrl,

      version: 1,

      /*
       * Preserve any additional safe persisted
       * monitoring metadata.
       */
      ...(rawMetadata ?? {}),
    },
  };
}

function getRequestedLimit(
  req: Request
): number {
  try {
    const url =
      new URL(req.url);

    const raw =
      url.searchParams.get(
        "limit"
      );

    if (!raw) {
      return DEFAULT_HISTORY_LIMIT;
    }

    const parsed =
      Number.parseInt(
        raw,
        10
      );

    if (
      !Number.isFinite(parsed)
    ) {
      return DEFAULT_HISTORY_LIMIT;
    }

    return Math.min(
      MAX_HISTORY_LIMIT,
      Math.max(
        MIN_HISTORY_LIMIT,
        parsed
      )
    );
  } catch {
    return DEFAULT_HISTORY_LIMIT;
  }
}

async function loadHealthHistory(
  limit: number
): Promise<{
  snapshots: SystemHealthSnapshot[];
  latestSnapshotId: string | null;
}> {
  const {
    data,
    error,
  } = await supabaseAdmin
    .from(
      "system_health_snapshots"
    )
    .select(
      [
        "id",
        "overall_status",
        "mode",
        "service_status",
        "metrics",
        "response_time_ms",
        "checked_at",
        "metadata",
      ].join(",")
    )
    .order(
      "checked_at",
      {
        ascending: false,
      }
    )
    .limit(limit);

  if (error) {
    throw new Error(
      `Could not load system health history: ${error.message}`
    );
  }

  const rows: SnapshotRow[] =
    Array.isArray(data)
      ? (
          data as unknown as SnapshotRow[]
        )
      : [];

  const latestSnapshotId =
    rows.length > 0
      ? cleanString(
          rows[0]?.id,
          200
        ) || null
      : null;

  const snapshots =
    rows
      .map(
        normaliseSnapshot
      )
      .filter(
        (
          snapshot
        ): snapshot is SystemHealthSnapshot =>
          snapshot !== null
      )
      .sort(
        (
          first,
          second
        ) =>
          Date.parse(
            first.checked_at
          ) -
          Date.parse(
            second.checked_at
          )
      );

  return {
    snapshots,
    latestSnapshotId,
  };
}

/**
 * The two intelligence engines are strongly typed themselves,
 * but the API summary should not become tightly coupled to every
 * internal report-property rename.
 */
function readReportObject(
  value: unknown
): Record<string, unknown> {
  return safeObject(value) ?? {};
}

function readArrayLength(
  object: Record<string, unknown>,
  key: string
): number {
  return Array.isArray(
    object[key]
  )
    ? object[key].length
    : 0;
}

function readReportString(
  object: Record<string, unknown>,
  key: string
): string {
  return cleanString(
    object[key],
    200
  );
}

function buildSummary(
  incidentReport: ReturnType<
    typeof analyseOperationsIncidents
  >,
  trendReport: ReturnType<
    typeof analyseOperationsTrends
  >
): IncidentApiSummary {
  const incidentObject =
    readReportObject(
      incidentReport
    );

  const trendObject =
    readReportObject(
      trendReport
    );

  const platform =
    readReportObject(
      trendObject.platform
    );

  const highestSeverity =
    getHighestActiveIncidentSeverity(
      incidentReport
    );

  const criticalIncidentPresent =
    hasCriticalOperationsIncident(
      incidentReport
    );

  const predictiveRiskPresent =
    hasPredictiveOperationalRisk(
      trendReport
    );

  const atRiskServices =
    getAtRiskServices(
      trendReport
    );

  const leastStableService =
    getLeastStableService(
      trendReport
    );

  const leastStableObject =
    readReportObject(
      leastStableService
    );

  const snapshotsAnalyzed =
    safeNumber(
      trendObject.snapshotsAnalysed
    ) ??
    safeNumber(
      trendObject.snapshotsAnalyzed
    ) ??
    safeNumber(
      trendObject.snapshotCount
    ) ??
    0;

  const overallRisk =
    readReportString(
      platform,
      "risk"
    ) ||
    readReportString(
      trendObject,
      "risk"
    ) ||
    "unknown";

  const activeIncidents =
    readArrayLength(
      incidentObject,
      "activeIncidents"
    ) ||
    readArrayLength(
      incidentObject,
      "active_incidents"
    );

  const earlyWarnings =
    readArrayLength(
      trendObject,
      "earlyWarnings"
    ) ||
    readArrayLength(
      trendObject,
      "early_warnings"
    );

  const leastStableKey =
    readReportString(
      leastStableObject,
      "serviceKey"
    ) ||
    readReportString(
      leastStableObject,
      "key"
    );

  const leastStableLabel =
    readReportString(
      leastStableObject,
      "serviceLabel"
    ) ||
    readReportString(
      leastStableObject,
      "label"
    ) ||
    leastStableKey;

  const stabilityScore =
    safeNumber(
      leastStableObject.stabilityScore
    ) ??
    safeNumber(
      leastStableObject.stability_score
    );

  const risk =
    readReportString(
      leastStableObject,
      "risk"
    ) || "unknown";

  const direction =
    readReportString(
      leastStableObject,
      "direction"
    ) || "unknown";

  return {
    snapshots_analyzed:
      Math.max(
        0,
        Math.round(
          snapshotsAnalyzed
        )
      ),

    overall_risk:
      overallRisk,

    active_incidents:
      activeIncidents,

    critical_incident_present:
      criticalIncidentPresent,

    predictive_risk_present:
      predictiveRiskPresent,

    highest_active_incident_severity:
      highestSeverity
        ? String(
            highestSeverity
          )
        : null,

    at_risk_services:
      Array.isArray(
        atRiskServices
      )
        ? atRiskServices.length
        : 0,

    early_warnings:
      earlyWarnings,

    least_stable_service:
      leastStableService &&
      leastStableKey
        ? {
            key:
              leastStableKey,

            label:
              leastStableLabel,

            stability_score:
              stabilityScore,

            risk,

            direction,
          }
        : null,
  };
}

async function buildOperationsIntelligence(
  req: Request
) {
  const limit =
    getRequestedLimit(
      req
    );

  const {
    snapshots,
    latestSnapshotId,
  } =
    await loadHealthHistory(
      limit
    );

  /*
   * Incident detection is deterministic and operates directly
   * against persisted monitoring history.
   */
  const incidents =
    analyseOperationsIncidents(
      snapshots
    );

  /*
   * Keep invocation compatible with the trend engine's exported
   * parameter contract while still providing both historical
   * snapshots and incident evidence when its signature supports it.
   */
  const trendArgs = [
    snapshots,
    incidents,
  ] as unknown as Parameters<
    typeof analyseOperationsTrends
  >;

  const trends =
    analyseOperationsTrends(
      ...trendArgs
    );

  const summary =
    buildSummary(
      incidents,
      trends
    );

  return {
    limit,
    latestSnapshotId,
    snapshots,
    incidents,
    trends,
    summary,
  };
}

export async function GET(
  req: Request
) {
  const startedAt =
    Date.now();

  try {
    const permission =
      await requireAdmin();

    if (!permission.ok) {
      return jsonResponse(
        {
          ok: false,
          error:
            permission.error,
        },
        permission.status
      );
    }

    const result =
      await buildOperationsIntelligence(
        req
      );

    return jsonResponse({
      ok: true,

      generated_at:
        new Date().toISOString(),

      duration_ms:
        Date.now() -
        startedAt,

      history_limit:
        result.limit,

      history_count:
        result.snapshots.length,

      latest_snapshot_id:
        result.latestSnapshotId,

      summary:
        result.summary,

      incidents:
        result.incidents,

      trends:
        result.trends,
    });
  } catch (error) {
    console.error(
      "system-health incidents GET error:",
      error
    );

    return jsonResponse(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : "Unable to generate Operations Centre incident intelligence.",

        generated_at:
          new Date().toISOString(),

        duration_ms:
          Date.now() -
          startedAt,
      },
      500
    );
  }
}

export async function POST(
  req: Request
) {
  /*
   * Deliberately read-only.
   *
   * POST currently re-runs the same deterministic analysis as GET.
   * No incident, monitoring or infrastructure data is mutated.
   */
  return GET(req);
}