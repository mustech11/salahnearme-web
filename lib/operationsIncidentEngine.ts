import type {
  HealthSeverity,
  ServiceCheck,
  SystemHealthSnapshot,
} from "@/lib/systemHealthTypes";

/**
 * SalahNearMe Operations Incident Engine
 *
 * Purpose
 * -------
 * Converts historical deterministic system-health snapshots into
 * operational incidents, recoveries, anomalies and service trends.
 *
 * This engine is intentionally:
 *
 * - deterministic
 * - read-only
 * - AI-independent
 * - safe to run server-side
 * - suitable for Operations Centre dashboards
 *
 * AI may interpret the output of this engine, but AI must not override
 * the underlying deterministic evidence.
 */

export const OPERATIONS_INCIDENT_ENGINE_VERSION = 1 as const;

export const INCIDENT_SEVERITIES = [
  "info",
  "low",
  "medium",
  "high",
  "critical",
] as const;

export type OperationsIncidentSeverity =
  (typeof INCIDENT_SEVERITIES)[number];

export const INCIDENT_TYPES = [
  "service_warning",
  "service_critical",
  "service_offline",
  "service_recovery",
  "latency_degradation",
  "latency_spike",
  "sustained_latency",
  "recurring_degradation",
  "overall_degradation",
  "overall_recovery",
] as const;

export type OperationsIncidentType =
  (typeof INCIDENT_TYPES)[number];

export const INCIDENT_STATUSES = [
  "active",
  "monitoring",
  "resolved",
] as const;

export type OperationsIncidentStatus =
  (typeof INCIDENT_STATUSES)[number];

export type IncidentEvidenceValue =
  | string
  | number
  | boolean
  | null;

export type OperationsIncidentEvidence = Record<
  string,
  IncidentEvidenceValue
>;

export type OperationsIncident = {
  id: string;

  incidentKey: string;

  type: OperationsIncidentType;

  status: OperationsIncidentStatus;

  severity: OperationsIncidentSeverity;

  title: string;

  summary: string;

  serviceKey: string | null;

  serviceLabel: string | null;

  startedAt: string;

  lastDetectedAt: string;

  resolvedAt: string | null;

  durationMs: number | null;

  occurrenceCount: number;

  currentResponseTimeMs: number | null;

  baselineResponseTimeMs: number | null;

  peakResponseTimeMs: number | null;

  percentageChange: number | null;

  recommendation: string;

  evidence: OperationsIncidentEvidence;

  engineVersion: number;
};

export type ServiceIncidentSummary = {
  serviceKey: string;

  serviceLabel: string;

  currentStatus: HealthSeverity;

  currentResponseTimeMs: number | null;

  baselineResponseTimeMs: number | null;

  peakResponseTimeMs: number | null;

  incidentCount: number;

  activeIncidentCount: number;

  recoveryCount: number;

  degradationCount: number;

  trend:
    | "improving"
    | "stable"
    | "degrading"
    | "insufficient_data";

  trendPercentage: number | null;

  lastIncidentAt: string | null;

  lastRecoveryAt: string | null;
};

export type OperationsIncidentStatistics = {
  snapshotsAnalysed: number;

  servicesObserved: number;

  incidentsDetected: number;

  activeIncidents: number;

  resolvedIncidents: number;

  recoveriesDetected: number;

  criticalIncidents: number;

  highIncidents: number;

  mediumIncidents: number;

  lowIncidents: number;

  latencyIncidents: number;

  availabilityIncidents: number;

  recurringIncidents: number;
};

export type OperationsIncidentReport = {
  generatedAt: string;

  engineVersion: number;

  latestSnapshotAt: string | null;

  earliestSnapshotAt: string | null;

  incidents: OperationsIncident[];

  activeIncidents: OperationsIncident[];

  resolvedIncidents: OperationsIncident[];

  serviceSummaries: ServiceIncidentSummary[];

  statistics: OperationsIncidentStatistics;
};

type SnapshotServicePoint = {
  snapshotAt: string;

  snapshotStatus: HealthSeverity;

  service: ServiceCheck;
};

type ServiceTimeline = {
  key: string;

  label: string;

  points: SnapshotServicePoint[];
};

type ActiveIncidentBuilder = {
  incidentKey: string;

  type: OperationsIncidentType;

  severity: OperationsIncidentSeverity;

  serviceKey: string | null;

  serviceLabel: string | null;

  startedAt: string;

  lastDetectedAt: string;

  occurrenceCount: number;

  currentResponseTimeMs: number | null;

  baselineResponseTimeMs: number | null;

  peakResponseTimeMs: number | null;

  percentageChange: number | null;

  title: string;

  summary: string;

  recommendation: string;

  evidence: OperationsIncidentEvidence;
};

const MIN_BASELINE_POINTS = 3;

const LATENCY_WARNING_MS = 1_500;

const LATENCY_CRITICAL_MS = 5_000;

const LATENCY_SPIKE_MULTIPLIER = 2.5;

const LATENCY_SPIKE_MINIMUM_MS = 750;

const SUSTAINED_LATENCY_MINIMUM_POINTS = 3;

const RECURRING_DEGRADATION_THRESHOLD = 3;

const STABLE_TREND_PERCENTAGE = 15;

const MAX_INCIDENTS_RETURNED = 250;

function cleanText(
  value: unknown,
  maxLength = 500
): string {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function safeTimestamp(
  value: unknown
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function safeResponseTime(
  value: unknown
): number | null {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0
  ) {
    return null;
  }

  return Math.round(value);
}

function timestampToMs(
  value: string | null
): number | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value).getTime();

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function calculateDurationMs(
  start: string,
  end: string | null
): number | null {
  const startMs = timestampToMs(start);
  const endMs = timestampToMs(end);

  if (
    startMs === null ||
    endMs === null ||
    endMs < startMs
  ) {
    return null;
  }

  return endMs - startMs;
}

function roundPercentage(
  value: number
): number {
  return Math.round(value * 10) / 10;
}

function percentageDifference(
  current: number,
  baseline: number
): number | null {
  if (
    baseline <= 0 ||
    !Number.isFinite(current) ||
    !Number.isFinite(baseline)
  ) {
    return null;
  }

  return roundPercentage(
    ((current - baseline) / baseline) * 100
  );
}

function getMedian(
  values: number[]
): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort(
    (first, second) => first - second
  );

  const midpoint = Math.floor(
    sorted.length / 2
  );

  if (sorted.length % 2 === 0) {
    return Math.round(
      (sorted[midpoint - 1] +
        sorted[midpoint]) /
        2
    );
  }

  return Math.round(
    sorted[midpoint]
  );
}

function getAverage(
  values: number[]
): number | null {
  if (values.length === 0) {
    return null;
  }

  return Math.round(
    values.reduce(
      (total, value) =>
        total + value,
      0
    ) / values.length
  );
}

function getPeak(
  values: number[]
): number | null {
  if (values.length === 0) {
    return null;
  }

  return Math.max(...values);
}

function severityRank(
  severity: OperationsIncidentSeverity
): number {
  switch (severity) {
    case "critical":
      return 5;

    case "high":
      return 4;

    case "medium":
      return 3;

    case "low":
      return 2;

    case "info":
    default:
      return 1;
  }
}

function healthSeverityRank(
  status: HealthSeverity
): number {
  switch (status) {
    case "offline":
      return 4;

    case "critical":
      return 3;

    case "warning":
      return 2;

    case "healthy":
    default:
      return 1;
  }
}

function isDegradedHealth(
  status: HealthSeverity
): boolean {
  return (
    status === "warning" ||
    status === "critical" ||
    status === "offline"
  );
}

function availabilitySeverity(
  status: HealthSeverity
): OperationsIncidentSeverity {
  switch (status) {
    case "offline":
      return "critical";

    case "critical":
      return "high";

    case "warning":
      return "medium";

    case "healthy":
    default:
      return "info";
  }
}

function sanitizeIdSegment(
  value: string
): string {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 100) ||
    "unknown"
  );
}

function createIncidentId(
  incidentKey: string,
  startedAt: string
): string {
  return [
    sanitizeIdSegment(incidentKey),
    String(
      timestampToMs(startedAt) ?? 0
    ),
  ].join("-");
}

function normaliseSnapshots(
  snapshots: SystemHealthSnapshot[]
): SystemHealthSnapshot[] {
  return snapshots
    .filter((snapshot) => {
      return Boolean(
        safeTimestamp(
          snapshot.checked_at
        )
      );
    })
    .sort((first, second) => {
      const firstTime =
        timestampToMs(
          safeTimestamp(
            first.checked_at
          )
        ) ?? 0;

      const secondTime =
        timestampToMs(
          safeTimestamp(
            second.checked_at
          )
        ) ?? 0;

      return (
        firstTime - secondTime
      );
    });
}

function buildServiceTimelines(
  snapshots: SystemHealthSnapshot[]
): ServiceTimeline[] {
  const timelineMap = new Map<
    string,
    ServiceTimeline
  >();

  for (const snapshot of snapshots) {
    const snapshotAt =
      safeTimestamp(
        snapshot.checked_at
      );

    if (!snapshotAt) {
      continue;
    }

    const services =
      Array.isArray(
        snapshot.services
      )
        ? snapshot.services
        : [];

    for (const service of services) {
      const key =
        cleanText(
          service.key,
          120
        );

      if (!key) {
        continue;
      }

      const label =
        cleanText(
          service.label,
          160
        ) || key;

      const existing =
        timelineMap.get(key);

      const point: SnapshotServicePoint =
        {
          snapshotAt,
          snapshotStatus:
            snapshot.overall_status,
          service,
        };

      if (existing) {
        existing.points.push(point);

        if (
          !existing.label ||
          existing.label ===
            existing.key
        ) {
          existing.label =
            label;
        }

        continue;
      }

      timelineMap.set(key, {
        key,
        label,
        points: [point],
      });
    }
  }

  return Array.from(
    timelineMap.values()
  );
}

function getHistoricalBaseline(
  points: SnapshotServicePoint[],
  index: number
): number | null {
  if (index <= 0) {
    return null;
  }

  const previousValues =
    points
      .slice(
        Math.max(
          0,
          index - 10
        ),
        index
      )
      .map((point) =>
        safeResponseTime(
          point.service
            .response_time_ms
        )
      )
      .filter(
        (
          value
        ): value is number =>
          value !== null
      );

  if (
    previousValues.length <
    MIN_BASELINE_POINTS
  ) {
    return getAverage(
      previousValues
    );
  }

  return getMedian(
    previousValues
  );
}

function createIncident(
  builder: ActiveIncidentBuilder,
  status: OperationsIncidentStatus,
  resolvedAt: string | null
): OperationsIncident {
  return {
    id: createIncidentId(
      builder.incidentKey,
      builder.startedAt
    ),

    incidentKey:
      builder.incidentKey,

    type:
      builder.type,

    status,

    severity:
      builder.severity,

    title:
      builder.title,

    summary:
      builder.summary,

    serviceKey:
      builder.serviceKey,

    serviceLabel:
      builder.serviceLabel,

    startedAt:
      builder.startedAt,

    lastDetectedAt:
      builder.lastDetectedAt,

    resolvedAt,

    durationMs:
      calculateDurationMs(
        builder.startedAt,
        resolvedAt ??
          builder.lastDetectedAt
      ),

    occurrenceCount:
      builder.occurrenceCount,

    currentResponseTimeMs:
      builder.currentResponseTimeMs,

    baselineResponseTimeMs:
      builder.baselineResponseTimeMs,

    peakResponseTimeMs:
      builder.peakResponseTimeMs,

    percentageChange:
      builder.percentageChange,

    recommendation:
      builder.recommendation,

    evidence:
      builder.evidence,

    engineVersion:
      OPERATIONS_INCIDENT_ENGINE_VERSION,
  };
}

function detectServiceAvailabilityIncidents(
  timeline: ServiceTimeline
): OperationsIncident[] {
  const incidents: OperationsIncident[] =
    [];

  let active:
    | ActiveIncidentBuilder
    | null = null;

  let previousStatus:
    | HealthSeverity
    | null = null;

  for (
    let index = 0;
    index <
    timeline.points.length;
    index += 1
  ) {
    const point =
      timeline.points[index];

    const service =
      point.service;

    const status =
      service.status;

    const responseTime =
      safeResponseTime(
        service.response_time_ms
      );

    const previousPoint =
      index > 0
        ? timeline.points[
            index - 1
          ]
        : null;

    if (isDegradedHealth(status)) {
      const type: OperationsIncidentType =
        status === "offline"
          ? "service_offline"
          : status ===
              "critical"
            ? "service_critical"
            : "service_warning";

      const severity =
        availabilitySeverity(
          status
        );

      if (
        !active ||
        active.type !== type
      ) {
        if (active) {
          incidents.push(
            createIncident(
              active,
              "resolved",
              point.snapshotAt
            )
          );
        }

        active = {
          incidentKey: [
            "availability",
            timeline.key,
            type,
          ].join(":"),

          type,

          severity,

          serviceKey:
            timeline.key,

          serviceLabel:
            timeline.label,

          startedAt:
            point.snapshotAt,

          lastDetectedAt:
            point.snapshotAt,

          occurrenceCount: 1,

          currentResponseTimeMs:
            responseTime,

          baselineResponseTimeMs:
            null,

          peakResponseTimeMs:
            responseTime,

          percentageChange:
            null,

          title:
            status ===
            "offline"
              ? `${timeline.label} is offline`
              : status ===
                  "critical"
                ? `${timeline.label} is critically degraded`
                : `${timeline.label} requires attention`,

          summary:
            cleanText(
              service.message,
              1_000
            ) ||
            `${timeline.label} reported a ${status} health state.`,

          recommendation:
            status ===
            "offline"
              ? "Check provider status, connectivity, credentials, deployment changes and service logs immediately."
              : status ===
                  "critical"
                ? "Investigate the service immediately and compare its latest telemetry with previous healthy snapshots."
                : "Monitor the service and inspect recent telemetry to confirm whether the warning is transient or developing.",

          evidence: {
            current_status:
              status,

            previous_status:
              previousStatus,

            response_time_ms:
              responseTime,

            checked_at:
              point.snapshotAt,
          },
        };
      } else {
        active.lastDetectedAt =
          point.snapshotAt;

        active.occurrenceCount +=
          1;

        active.currentResponseTimeMs =
          responseTime;

        if (
          responseTime !== null
        ) {
          active.peakResponseTimeMs =
            active.peakResponseTimeMs ===
            null
              ? responseTime
              : Math.max(
                  active.peakResponseTimeMs,
                  responseTime
                );
        }

        if (
          severityRank(severity) >
          severityRank(
            active.severity
          )
        ) {
          active.severity =
            severity;
        }
      }
    } else if (active) {
      incidents.push(
        createIncident(
          active,
          "resolved",
          point.snapshotAt
        )
      );

      incidents.push({
        id: createIncidentId(
          `recovery:${timeline.key}`,
          point.snapshotAt
        ),

        incidentKey:
          `recovery:${timeline.key}`,

        type:
          "service_recovery",

        status:
          "resolved",

        severity:
          "info",

        title:
          `${timeline.label} recovered`,

        summary:
          `${timeline.label} returned to a healthy state after a previous degradation.`,

        serviceKey:
          timeline.key,

        serviceLabel:
          timeline.label,

        startedAt:
          point.snapshotAt,

        lastDetectedAt:
          point.snapshotAt,

        resolvedAt:
          point.snapshotAt,

        durationMs:
          0,

        occurrenceCount:
          1,

        currentResponseTimeMs:
          responseTime,

        baselineResponseTimeMs:
          null,

        peakResponseTimeMs:
          responseTime,

        percentageChange:
          null,

        recommendation:
          "Continue monitoring the next few health checks to confirm the recovery remains stable.",

        evidence: {
          previous_status:
            previousStatus,

          current_status:
            status,

          response_time_ms:
            responseTime,

          checked_at:
            point.snapshotAt,
        },

        engineVersion:
          OPERATIONS_INCIDENT_ENGINE_VERSION,
      });

      active = null;
    }

    if (
      previousPoint &&
      healthSeverityRank(
        previousPoint.service
          .status
      ) >
        healthSeverityRank(
          status
        ) &&
      status === "healthy" &&
      !isDegradedHealth(
        previousPoint.service
          .status
      )
    ) {
      // No explicit recovery event is
      // required for healthy → healthy
      // transitions.
    }

    previousStatus =
      status;
  }

  if (active) {
    incidents.push(
      createIncident(
        active,
        "active",
        null
      )
    );
  }

  return incidents;
}

function detectLatencyIncidents(
  timeline: ServiceTimeline
): OperationsIncident[] {
  const incidents: OperationsIncident[] =
    [];

  let sustainedStart:
    | number
    | null = null;

  for (
    let index = 0;
    index <
    timeline.points.length;
    index += 1
  ) {
    const point =
      timeline.points[index];

    const current =
      safeResponseTime(
        point.service
          .response_time_ms
      );

    if (current === null) {
      sustainedStart =
        null;

      continue;
    }

    const baseline =
      getHistoricalBaseline(
        timeline.points,
        index
      );

    const percentageChange =
      baseline !== null
        ? percentageDifference(
            current,
            baseline
          )
        : null;

    const spikeAgainstBaseline =
      baseline !== null &&
      baseline > 0 &&
      current >=
        LATENCY_SPIKE_MINIMUM_MS &&
      current >=
        baseline *
          LATENCY_SPIKE_MULTIPLIER;

    const criticalLatency =
      current >=
      LATENCY_CRITICAL_MS;

    const warningLatency =
      current >=
      LATENCY_WARNING_MS;

    if (
      criticalLatency ||
      spikeAgainstBaseline
    ) {
      const severity: OperationsIncidentSeverity =
        criticalLatency
          ? "high"
          : "medium";

      const type: OperationsIncidentType =
        spikeAgainstBaseline
          ? "latency_spike"
          : "latency_degradation";

      incidents.push({
        id: createIncidentId(
          `latency:${timeline.key}:${type}`,
          point.snapshotAt
        ),

        incidentKey:
          `latency:${timeline.key}:${type}`,

        type,

        status:
          index ===
          timeline.points.length -
            1
            ? "monitoring"
            : "resolved",

        severity,

        title:
          spikeAgainstBaseline
            ? `${timeline.label} latency increased sharply`
            : `${timeline.label} is responding very slowly`,

        summary:
          baseline !== null
            ? `${timeline.label} responded in ${current.toLocaleString(
                "en-GB"
              )} ms compared with a recent baseline of ${baseline.toLocaleString(
                "en-GB"
              )} ms.`
            : `${timeline.label} responded in ${current.toLocaleString(
                "en-GB"
              )} ms.`,

        serviceKey:
          timeline.key,

        serviceLabel:
          timeline.label,

        startedAt:
          point.snapshotAt,

        lastDetectedAt:
          point.snapshotAt,

        resolvedAt:
          index ===
          timeline.points.length -
            1
            ? null
            : point.snapshotAt,

        durationMs:
          index ===
          timeline.points.length -
            1
            ? null
            : 0,

        occurrenceCount:
          1,

        currentResponseTimeMs:
          current,

        baselineResponseTimeMs:
          baseline,

        peakResponseTimeMs:
          current,

        percentageChange,

        recommendation:
          criticalLatency
            ? "Review database queries, external APIs, deployment performance, network latency and server cold starts."
            : "Monitor subsequent checks and investigate if the latency increase persists.",

        evidence: {
          response_time_ms:
            current,

          baseline_response_time_ms:
            baseline,

          percentage_change:
            percentageChange,

          warning_threshold_ms:
            LATENCY_WARNING_MS,

          critical_threshold_ms:
            LATENCY_CRITICAL_MS,

          spike_multiplier:
            LATENCY_SPIKE_MULTIPLIER,
        },

        engineVersion:
          OPERATIONS_INCIDENT_ENGINE_VERSION,
      });
    }

    if (warningLatency) {
      if (
        sustainedStart === null
      ) {
        sustainedStart =
          index;
      }

      const sustainedLength =
        index -
        sustainedStart +
        1;

      if (
        sustainedLength ===
        SUSTAINED_LATENCY_MINIMUM_POINTS
      ) {
        const sustainedPoints =
          timeline.points.slice(
            sustainedStart,
            index + 1
          );

        const values =
          sustainedPoints
            .map((entry) =>
              safeResponseTime(
                entry.service
                  .response_time_ms
              )
            )
            .filter(
              (
                value
              ): value is number =>
                value !== null
            );

        const firstPoint =
          sustainedPoints[0];

        incidents.push({
          id: createIncidentId(
            `latency:${timeline.key}:sustained`,
            firstPoint.snapshotAt
          ),

          incidentKey:
            `latency:${timeline.key}:sustained`,

          type:
            "sustained_latency",

          status:
            index ===
            timeline.points.length -
              1
              ? "active"
              : "monitoring",

          severity:
            values.some(
              (value) =>
                value >=
                LATENCY_CRITICAL_MS
            )
              ? "high"
              : "medium",

          title:
            `${timeline.label} latency is persistently elevated`,

          summary:
            `${timeline.label} exceeded the ${LATENCY_WARNING_MS.toLocaleString(
              "en-GB"
            )} ms warning threshold across ${sustainedLength} consecutive monitoring samples.`,

          serviceKey:
            timeline.key,

          serviceLabel:
            timeline.label,

          startedAt:
            firstPoint.snapshotAt,

          lastDetectedAt:
            point.snapshotAt,

          resolvedAt:
            null,

          durationMs:
            calculateDurationMs(
              firstPoint.snapshotAt,
              point.snapshotAt
            ),

          occurrenceCount:
            sustainedLength,

          currentResponseTimeMs:
            current,

          baselineResponseTimeMs:
            baseline,

          peakResponseTimeMs:
            getPeak(values),

          percentageChange,

          recommendation:
            "Inspect the service for sustained performance degradation rather than treating this as a single transient latency spike.",

          evidence: {
            consecutive_samples:
              sustainedLength,

            average_response_time_ms:
              getAverage(values),

            peak_response_time_ms:
              getPeak(values),

            warning_threshold_ms:
              LATENCY_WARNING_MS,
          },

          engineVersion:
            OPERATIONS_INCIDENT_ENGINE_VERSION,
        });
      }
    } else {
      sustainedStart =
        null;
    }
  }

  return incidents;
}

function detectRecurringDegradation(
  timeline: ServiceTimeline
): OperationsIncident[] {
  const degradationPoints =
    timeline.points.filter(
      (point) =>
        isDegradedHealth(
          point.service.status
        )
    );

  if (
    degradationPoints.length <
    RECURRING_DEGRADATION_THRESHOLD
  ) {
    return [];
  }

  const first =
    degradationPoints[0];

  const latest =
    degradationPoints[
      degradationPoints.length -
        1
    ];

  const latestStatus =
    latest.service.status;

  return [
    {
      id: createIncidentId(
        `recurring:${timeline.key}`,
        first.snapshotAt
      ),

      incidentKey:
        `recurring:${timeline.key}`,

      type:
        "recurring_degradation",

      status:
        isDegradedHealth(
          latestStatus
        )
          ? "monitoring"
          : "resolved",

      severity:
        degradationPoints.some(
          (point) =>
            point.service
              .status ===
              "offline"
        )
          ? "high"
          : degradationPoints.some(
                (point) =>
                  point.service
                    .status ===
                  "critical"
              )
            ? "high"
            : "medium",

      title:
        `${timeline.label} has repeated degraded health states`,

      summary:
        `${timeline.label} reported ${degradationPoints.length} degraded monitoring samples across the analysed history.`,

      serviceKey:
        timeline.key,

      serviceLabel:
        timeline.label,

      startedAt:
        first.snapshotAt,

      lastDetectedAt:
        latest.snapshotAt,

      resolvedAt:
        isDegradedHealth(
          latestStatus
        )
          ? null
          : latest.snapshotAt,

      durationMs:
        calculateDurationMs(
          first.snapshotAt,
          latest.snapshotAt
        ),

      occurrenceCount:
        degradationPoints.length,

      currentResponseTimeMs:
        safeResponseTime(
          latest.service
            .response_time_ms
        ),

      baselineResponseTimeMs:
        null,

      peakResponseTimeMs:
        getPeak(
          degradationPoints
            .map((point) =>
              safeResponseTime(
                point.service
                  .response_time_ms
              )
            )
            .filter(
              (
                value
              ): value is number =>
                value !== null
            )
        ),

      percentageChange:
        null,

      recommendation:
        "Review whether the repeated degradation has a shared cause such as scheduled workload, external dependency latency, recurring deployment behaviour or capacity pressure.",

      evidence: {
        degraded_samples:
          degradationPoints.length,

        analysed_samples:
          timeline.points.length,

        latest_status:
          latestStatus,
      },

      engineVersion:
        OPERATIONS_INCIDENT_ENGINE_VERSION,
    },
  ];
}

function detectOverallHealthIncidents(
  snapshots: SystemHealthSnapshot[]
): OperationsIncident[] {
  const incidents: OperationsIncident[] =
    [];

  let degradedStartedAt:
    | string
    | null = null;

  let previousStatus:
    | HealthSeverity
    | null = null;

  let degradedCount = 0;

  for (
    let index = 0;
    index <
    snapshots.length;
    index += 1
  ) {
    const snapshot =
      snapshots[index];

    const checkedAt =
      safeTimestamp(
        snapshot.checked_at
      );

    if (!checkedAt) {
      continue;
    }

    const currentStatus =
      snapshot.overall_status;

    if (
      isDegradedHealth(
        currentStatus
      )
    ) {
      degradedCount += 1;

      if (
        degradedStartedAt ===
        null
      ) {
        degradedStartedAt =
          checkedAt;
      }
    } else if (
      degradedStartedAt !==
      null
    ) {
      incidents.push({
        id: createIncidentId(
          "overall:degradation",
          degradedStartedAt
        ),

        incidentKey:
          "overall:degradation",

        type:
          "overall_degradation",

        status:
          "resolved",

        severity:
          previousStatus ===
          "offline"
            ? "critical"
            : previousStatus ===
                "critical"
              ? "high"
              : "medium",

        title:
          "Platform health degradation detected",

        summary:
          "The deterministic system-health engine recorded a period where overall platform health was degraded.",

        serviceKey:
          null,

        serviceLabel:
          null,

        startedAt:
          degradedStartedAt,

        lastDetectedAt:
          checkedAt,

        resolvedAt:
          checkedAt,

        durationMs:
          calculateDurationMs(
            degradedStartedAt,
            checkedAt
          ),

        occurrenceCount:
          degradedCount,

        currentResponseTimeMs:
          safeResponseTime(
            snapshot.response_time_ms
          ),

        baselineResponseTimeMs:
          null,

        peakResponseTimeMs:
          null,

        percentageChange:
          null,

        recommendation:
          "Review the service-level incidents within the same period to identify which monitored dependency caused the overall degraded state.",

        evidence: {
          previous_overall_status:
            previousStatus,

          current_overall_status:
            currentStatus,

          degraded_samples:
            degradedCount,
        },

        engineVersion:
          OPERATIONS_INCIDENT_ENGINE_VERSION,
      });

      incidents.push({
        id: createIncidentId(
          "overall:recovery",
          checkedAt
        ),

        incidentKey:
          "overall:recovery",

        type:
          "overall_recovery",

        status:
          "resolved",

        severity:
          "info",

        title:
          "Platform returned to healthy operation",

        summary:
          "The deterministic health engine recorded recovery from a previous overall degraded state.",

        serviceKey:
          null,

        serviceLabel:
          null,

        startedAt:
          checkedAt,

        lastDetectedAt:
          checkedAt,

        resolvedAt:
          checkedAt,

        durationMs:
          0,

        occurrenceCount:
          1,

        currentResponseTimeMs:
          safeResponseTime(
            snapshot.response_time_ms
          ),

        baselineResponseTimeMs:
          null,

        peakResponseTimeMs:
          null,

        percentageChange:
          null,

        recommendation:
          "Continue monitoring subsequent snapshots to confirm platform recovery remains stable.",

        evidence: {
          recovered_from:
            previousStatus,

          recovered_to:
            currentStatus,
        },

        engineVersion:
          OPERATIONS_INCIDENT_ENGINE_VERSION,
      });

      degradedStartedAt =
        null;

      degradedCount = 0;
    }

    previousStatus =
      currentStatus;
  }

  if (
    degradedStartedAt !==
      null &&
    snapshots.length > 0
  ) {
    const latest =
      snapshots[
        snapshots.length - 1
      ];

    const latestAt =
      safeTimestamp(
        latest.checked_at
      );

    if (latestAt) {
      incidents.push({
        id: createIncidentId(
          "overall:degradation",
          degradedStartedAt
        ),

        incidentKey:
          "overall:degradation",

        type:
          "overall_degradation",

        status:
          "active",

        severity:
          latest.overall_status ===
          "offline"
            ? "critical"
            : latest.overall_status ===
                "critical"
              ? "high"
              : "medium",

        title:
          "Platform health is currently degraded",

        summary:
          `The latest deterministic platform status is ${latest.overall_status}.`,

        serviceKey:
          null,

        serviceLabel:
          null,

        startedAt:
          degradedStartedAt,

        lastDetectedAt:
          latestAt,

        resolvedAt:
          null,

        durationMs:
          calculateDurationMs(
            degradedStartedAt,
            latestAt
          ),

        occurrenceCount:
          degradedCount,

        currentResponseTimeMs:
          safeResponseTime(
            latest.response_time_ms
          ),

        baselineResponseTimeMs:
          null,

        peakResponseTimeMs:
          null,

        percentageChange:
          null,

        recommendation:
          "Review active service incidents immediately and identify the monitored dependency responsible for the degraded overall state.",

        evidence: {
          current_overall_status:
            latest.overall_status,

          degraded_samples:
            degradedCount,
        },

        engineVersion:
          OPERATIONS_INCIDENT_ENGINE_VERSION,
      });
    }
  }

  return incidents;
}

function calculateServiceTrend(
  timeline: ServiceTimeline
): {
  trend:
    | "improving"
    | "stable"
    | "degrading"
    | "insufficient_data";

  percentage: number | null;
} {
  const values =
    timeline.points
      .map((point) =>
        safeResponseTime(
          point.service
            .response_time_ms
        )
      )
      .filter(
        (
          value
        ): value is number =>
          value !== null
      );

  if (values.length < 4) {
    return {
      trend:
        "insufficient_data",

      percentage:
        null,
    };
  }

  const midpoint =
    Math.floor(
      values.length / 2
    );

  const earlier =
    values.slice(
      0,
      midpoint
    );

  const later =
    values.slice(
      midpoint
    );

  const earlierAverage =
    getAverage(earlier);

  const laterAverage =
    getAverage(later);

  if (
    earlierAverage === null ||
    laterAverage === null ||
    earlierAverage <= 0
  ) {
    return {
      trend:
        "insufficient_data",

      percentage:
        null,
    };
  }

  const change =
    percentageDifference(
      laterAverage,
      earlierAverage
    );

  if (change === null) {
    return {
      trend:
        "insufficient_data",

      percentage:
        null,
    };
  }

  if (
    Math.abs(change) <=
    STABLE_TREND_PERCENTAGE
  ) {
    return {
      trend: "stable",
      percentage: change,
    };
  }

  return change > 0
    ? {
        trend:
          "degrading",

        percentage:
          change,
      }
    : {
        trend:
          "improving",

        percentage:
          change,
      };
}

function buildServiceSummaries(
  timelines: ServiceTimeline[],
  incidents: OperationsIncident[]
): ServiceIncidentSummary[] {
  return timelines.map(
    (timeline) => {
      const latest =
        timeline.points[
          timeline.points.length -
            1
        ];

      const serviceIncidents =
        incidents.filter(
          (incident) =>
            incident.serviceKey ===
            timeline.key
        );

      const responseValues =
        timeline.points
          .map((point) =>
            safeResponseTime(
              point.service
                .response_time_ms
            )
          )
          .filter(
            (
              value
            ): value is number =>
              value !== null
          );

      const baselineValues =
        responseValues.length > 1
          ? responseValues.slice(
              0,
              -1
            )
          : responseValues;

      const trend =
        calculateServiceTrend(
          timeline
        );

      const lastIncident =
        [...serviceIncidents]
          .filter(
            (incident) =>
              incident.type !==
              "service_recovery"
          )
          .sort(
            (
              first,
              second
            ) =>
              (timestampToMs(
                second.lastDetectedAt
              ) ?? 0) -
              (timestampToMs(
                first.lastDetectedAt
              ) ?? 0)
          )[0];

      const lastRecovery =
        [...serviceIncidents]
          .filter(
            (incident) =>
              incident.type ===
              "service_recovery"
          )
          .sort(
            (
              first,
              second
            ) =>
              (timestampToMs(
                second.lastDetectedAt
              ) ?? 0) -
              (timestampToMs(
                first.lastDetectedAt
              ) ?? 0)
          )[0];

      return {
        serviceKey:
          timeline.key,

        serviceLabel:
          timeline.label,

        currentStatus:
          latest?.service
            .status ??
          "offline",

        currentResponseTimeMs:
          latest
            ? safeResponseTime(
                latest.service
                  .response_time_ms
              )
            : null,

        baselineResponseTimeMs:
          getMedian(
            baselineValues
          ),

        peakResponseTimeMs:
          getPeak(
            responseValues
          ),

        incidentCount:
          serviceIncidents.filter(
            (incident) =>
              incident.type !==
              "service_recovery"
          ).length,

        activeIncidentCount:
          serviceIncidents.filter(
            (incident) =>
              incident.status ===
                "active" ||
              incident.status ===
                "monitoring"
          ).length,

        recoveryCount:
          serviceIncidents.filter(
            (incident) =>
              incident.type ===
              "service_recovery"
          ).length,

        degradationCount:
          timeline.points.filter(
            (point) =>
              isDegradedHealth(
                point.service.status
              )
          ).length,

        trend:
          trend.trend,

        trendPercentage:
          trend.percentage,

        lastIncidentAt:
          lastIncident?.lastDetectedAt ??
          null,

        lastRecoveryAt:
          lastRecovery?.lastDetectedAt ??
          null,
      };
    }
  );
}

function deduplicateIncidents(
  incidents: OperationsIncident[]
): OperationsIncident[] {
  const seen =
    new Set<string>();

  const result:
    OperationsIncident[] = [];

  for (const incident of incidents) {
    const key = [
      incident.incidentKey,
      incident.startedAt,
      incident.type,
    ].join("|");

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    result.push(incident);
  }

  return result;
}

function sortIncidents(
  incidents: OperationsIncident[]
): OperationsIncident[] {
  return [...incidents].sort(
    (first, second) => {
      const firstActive =
        first.status === "active"
          ? 1
          : 0;

      const secondActive =
        second.status ===
        "active"
          ? 1
          : 0;

      if (
        firstActive !==
        secondActive
      ) {
        return (
          secondActive -
          firstActive
        );
      }

      const severityDifference =
        severityRank(
          second.severity
        ) -
        severityRank(
          first.severity
        );

      if (
        severityDifference !==
        0
      ) {
        return severityDifference;
      }

      return (
        (timestampToMs(
          second.lastDetectedAt
        ) ?? 0) -
        (timestampToMs(
          first.lastDetectedAt
        ) ?? 0)
      );
    }
  );
}

function buildStatistics(
  snapshots: SystemHealthSnapshot[],
  timelines: ServiceTimeline[],
  incidents: OperationsIncident[]
): OperationsIncidentStatistics {
  return {
    snapshotsAnalysed:
      snapshots.length,

    servicesObserved:
      timelines.length,

    incidentsDetected:
      incidents.length,

    activeIncidents:
      incidents.filter(
        (incident) =>
          incident.status ===
            "active" ||
          incident.status ===
            "monitoring"
      ).length,

    resolvedIncidents:
      incidents.filter(
        (incident) =>
          incident.status ===
          "resolved"
      ).length,

    recoveriesDetected:
      incidents.filter(
        (incident) =>
          incident.type ===
            "service_recovery" ||
          incident.type ===
            "overall_recovery"
      ).length,

    criticalIncidents:
      incidents.filter(
        (incident) =>
          incident.severity ===
          "critical"
      ).length,

    highIncidents:
      incidents.filter(
        (incident) =>
          incident.severity ===
          "high"
      ).length,

    mediumIncidents:
      incidents.filter(
        (incident) =>
          incident.severity ===
          "medium"
      ).length,

    lowIncidents:
      incidents.filter(
        (incident) =>
          incident.severity ===
          "low"
      ).length,

    latencyIncidents:
      incidents.filter(
        (incident) =>
          incident.type ===
            "latency_spike" ||
          incident.type ===
            "latency_degradation" ||
          incident.type ===
            "sustained_latency"
      ).length,

    availabilityIncidents:
      incidents.filter(
        (incident) =>
          incident.type ===
            "service_warning" ||
          incident.type ===
            "service_critical" ||
          incident.type ===
            "service_offline" ||
          incident.type ===
            "overall_degradation"
      ).length,

    recurringIncidents:
      incidents.filter(
        (incident) =>
          incident.type ===
          "recurring_degradation"
      ).length,
  };
}

/**
 * Main Operations Centre incident analysis function.
 *
 * Pass the historical SystemHealthSnapshot records in any order.
 * They will automatically be sorted chronologically.
 */
export function analyseOperationsIncidents(
  history:
    | SystemHealthSnapshot[]
    | null
    | undefined
): OperationsIncidentReport {
  const generatedAt =
    new Date().toISOString();

  const snapshots =
    normaliseSnapshots(
      Array.isArray(history)
        ? history
        : []
    );

  if (snapshots.length === 0) {
    return {
      generatedAt,

      engineVersion:
        OPERATIONS_INCIDENT_ENGINE_VERSION,

      latestSnapshotAt:
        null,

      earliestSnapshotAt:
        null,

      incidents: [],

      activeIncidents: [],

      resolvedIncidents: [],

      serviceSummaries: [],

      statistics: {
        snapshotsAnalysed: 0,
        servicesObserved: 0,
        incidentsDetected: 0,
        activeIncidents: 0,
        resolvedIncidents: 0,
        recoveriesDetected: 0,
        criticalIncidents: 0,
        highIncidents: 0,
        mediumIncidents: 0,
        lowIncidents: 0,
        latencyIncidents: 0,
        availabilityIncidents: 0,
        recurringIncidents: 0,
      },
    };
  }

  const timelines =
    buildServiceTimelines(
      snapshots
    );

  const rawIncidents:
    OperationsIncident[] = [
      ...detectOverallHealthIncidents(
        snapshots
      ),
    ];

  for (const timeline of timelines) {
    rawIncidents.push(
      ...detectServiceAvailabilityIncidents(
        timeline
      )
    );

    rawIncidents.push(
      ...detectLatencyIncidents(
        timeline
      )
    );

    rawIncidents.push(
      ...detectRecurringDegradation(
        timeline
      )
    );
  }

  const incidents =
    sortIncidents(
      deduplicateIncidents(
        rawIncidents
      )
    ).slice(
      0,
      MAX_INCIDENTS_RETURNED
    );

  const activeIncidents =
    incidents.filter(
      (incident) =>
        incident.status ===
          "active" ||
        incident.status ===
          "monitoring"
    );

  const resolvedIncidents =
    incidents.filter(
      (incident) =>
        incident.status ===
        "resolved"
    );

  const serviceSummaries =
    buildServiceSummaries(
      timelines,
      incidents
    ).sort(
      (first, second) => {
        const firstRank =
          healthSeverityRank(
            first.currentStatus
          );

        const secondRank =
          healthSeverityRank(
            second.currentStatus
          );

        if (
          firstRank !==
          secondRank
        ) {
          return (
            secondRank -
            firstRank
          );
        }

        return (
          (second.currentResponseTimeMs ??
            0) -
          (first.currentResponseTimeMs ??
            0)
        );
      }
    );

  return {
    generatedAt,

    engineVersion:
      OPERATIONS_INCIDENT_ENGINE_VERSION,

    earliestSnapshotAt:
      safeTimestamp(
        snapshots[0]
          .checked_at
      ),

    latestSnapshotAt:
      safeTimestamp(
        snapshots[
          snapshots.length - 1
        ].checked_at
      ),

    incidents,

    activeIncidents,

    resolvedIncidents,

    serviceSummaries,

    statistics:
      buildStatistics(
        snapshots,
        timelines,
        incidents
      ),
  };
}

/**
 * Convenience helper for dashboard badges.
 */
export function getHighestActiveIncidentSeverity(
  report:
    | OperationsIncidentReport
    | null
    | undefined
): OperationsIncidentSeverity {
  if (
    !report ||
    report.activeIncidents
      .length === 0
  ) {
    return "info";
  }

  return report.activeIncidents.reduce<
    OperationsIncidentSeverity
  >(
    (highest, incident) =>
      severityRank(
        incident.severity
      ) >
      severityRank(highest)
        ? incident.severity
        : highest,
    "info"
  );
}

/**
 * Convenience helper used by the Operations Centre UI.
 */
export function hasCriticalOperationsIncident(
  report:
    | OperationsIncidentReport
    | null
    | undefined
): boolean {
  return Boolean(
    report?.activeIncidents.some(
      (incident) =>
        incident.severity ===
        "critical"
    )
  );
}

/**
 * Returns incidents affecting a particular monitored service.
 */
export function getIncidentsForService(
  report:
    | OperationsIncidentReport
    | null
    | undefined,
  serviceKey: string
): OperationsIncident[] {
  const key =
    cleanText(
      serviceKey,
      120
    );

  if (!report || !key) {
    return [];
  }

  return report.incidents.filter(
    (incident) =>
      incident.serviceKey ===
      key
  );
}