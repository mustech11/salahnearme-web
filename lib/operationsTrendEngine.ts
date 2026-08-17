import type {
  HealthSeverity,
  ServiceCheck,
  SystemHealthSnapshot,
  UsageMetric,
} from "@/lib/systemHealthTypes";

import type {
  OperationsIncidentReport,
  OperationsIncidentSeverity,
} from "@/lib/operationsIncidentEngine";

/**
 * SalahNearMe Operations Trend Engine
 *
 * Deterministic predictive intelligence for the Operations Centre.
 *
 * Responsibilities:
 *
 * - service latency trends
 * - rolling baselines
 * - volatility detection
 * - acceleration detection
 * - health-state deterioration
 * - quota/capacity trends
 * - early-warning risk
 * - service stability scoring
 * - platform-wide predictive risk
 *
 * IMPORTANT:
 *
 * This engine does NOT use AI.
 *
 * It produces deterministic operational evidence that can later
 * be supplied to the AI Operations layer for explanation.
 */

export const OPERATIONS_TREND_ENGINE_VERSION =
  1 as const;

export const TREND_DIRECTIONS = [
  "improving",
  "stable",
  "degrading",
  "rapidly_degrading",
  "recovering",
  "uncertain",
] as const;

export type OperationsTrendDirection =
  (typeof TREND_DIRECTIONS)[number];

export const TREND_RISKS = [
  "none",
  "low",
  "moderate",
  "high",
  "critical",
] as const;

export type OperationsTrendRisk =
  (typeof TREND_RISKS)[number];

export const CAPACITY_DIRECTIONS = [
  "increasing",
  "decreasing",
  "stable",
  "unknown",
] as const;

export type CapacityTrendDirection =
  (typeof CAPACITY_DIRECTIONS)[number];

export type OperationsTrendEvidenceValue =
  | string
  | number
  | boolean
  | null;

export type OperationsTrendEvidence =
  Record<
    string,
    OperationsTrendEvidenceValue
  >;

export type ServiceTrendAssessment = {
  serviceKey: string;

  serviceLabel: string;

  currentStatus: HealthSeverity;

  direction: OperationsTrendDirection;

  risk: OperationsTrendRisk;

  confidence: number;

  stabilityScore: number;

  sampleCount: number;

  currentResponseTimeMs: number | null;

  previousResponseTimeMs: number | null;

  averageResponseTimeMs: number | null;

  recentAverageResponseTimeMs: number | null;

  historicalAverageResponseTimeMs:
    | number
    | null;

  baselineResponseTimeMs: number | null;

  peakResponseTimeMs: number | null;

  minimumResponseTimeMs: number | null;

  latencyChangePercentage: number | null;

  volatilityPercentage: number | null;

  accelerationPercentage: number | null;

  warningSamples: number;

  criticalSamples: number;

  offlineSamples: number;

  consecutiveDegradedSamples: number;

  activeIncidentCount: number;

  forecast: {
    nextExpectedResponseTimeMs:
      | number
      | null;

    projectedThresholdBreach:
      | "none"
      | "warning"
      | "critical"
      | "unknown";

    estimatedSamplesToWarning:
      | number
      | null;

    estimatedSamplesToCritical:
      | number
      | null;
  };

  summary: string;

  recommendation: string;

  evidence: OperationsTrendEvidence;
};

export type CapacityTrendAssessment = {
  metricKey: string;

  label: string;

  unit: string;

  currentPercentage: number | null;

  previousPercentage: number | null;

  averagePercentage: number | null;

  peakPercentage: number | null;

  direction: CapacityTrendDirection;

  risk: OperationsTrendRisk;

  confidence: number;

  sampleCount: number;

  changePercentagePoints: number | null;

  estimatedSamplesToWarning:
    | number
    | null;

  estimatedSamplesToCritical:
    | number
    | null;

  summary: string;

  recommendation: string;
};

export type PlatformTrendSummary = {
  direction: OperationsTrendDirection;

  risk: OperationsTrendRisk;

  confidence: number;

  stabilityScore: number;

  servicesImproving: number;

  servicesStable: number;

  servicesDegrading: number;

  servicesRapidlyDegrading: number;

  servicesRecovering: number;

  servicesUncertain: number;

  highRiskServices: number;

  criticalRiskServices: number;

  activeIncidentCount: number;

  averageResponseTimeMs: number | null;

  recentAverageResponseTimeMs:
    | number
    | null;

  historicalAverageResponseTimeMs:
    | number
    | null;

  performanceChangePercentage:
    | number
    | null;

  headline: string;

  summary: string;
};

export type OperationsEarlyWarning = {
  id: string;

  severity: OperationsIncidentSeverity;

  serviceKey: string | null;

  title: string;

  message: string;

  recommendation: string;

  confidence: number;

  evidence: OperationsTrendEvidence;
};

export type OperationsTrendReport = {
  generatedAt: string;

  engineVersion: number;

  snapshotsAnalysed: number;

  earliestSnapshotAt: string | null;

  latestSnapshotAt: string | null;

  platform: PlatformTrendSummary;

  services: ServiceTrendAssessment[];

  capacity: CapacityTrendAssessment[];

  earlyWarnings: OperationsEarlyWarning[];
};

type ServicePoint = {
  checkedAt: string;

  responseTimeMs: number | null;

  status: HealthSeverity;
};

type ServiceTimeline = {
  key: string;

  label: string;

  points: ServicePoint[];
};

type CapacityPoint = {
  checkedAt: string;

  percentage: number | null;

  used: number | null;

  limit: number | null;
};

type CapacityTimeline = {
  key: string;

  label: string;

  unit: string;

  points: CapacityPoint[];
};

const RESPONSE_WARNING_MS =
  1_500;

const RESPONSE_CRITICAL_MS =
  5_000;

const CAPACITY_WARNING_PERCENTAGE =
  70;

const CAPACITY_HIGH_PERCENTAGE =
  85;

const CAPACITY_CRITICAL_PERCENTAGE =
  95;

const MINIMUM_TREND_SAMPLES =
  4;

const MINIMUM_FORECAST_SAMPLES =
  4;

const RECENT_WINDOW_SIZE =
  5;

const HISTORICAL_WINDOW_SIZE =
  10;

const STABLE_CHANGE_PERCENTAGE =
  12;

const RAPID_DEGRADATION_PERCENTAGE =
  60;

const HIGH_VOLATILITY_PERCENTAGE =
  45;

const CRITICAL_VOLATILITY_PERCENTAGE =
  80;

function cleanText(
  value: unknown,
  maxLength = 500
): string {
  if (
    typeof value !== "string"
  ) {
    return "";
  }

  return value
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
  const parsed =
    safeNumber(value);

  if (
    parsed === null ||
    parsed < 0
  ) {
    return null;
  }

  return parsed;
}

function safePercentage(
  value: unknown
): number | null {
  const parsed =
    safeNonNegativeNumber(
      value
    );

  if (parsed === null) {
    return null;
  }

  return Math.min(
    100,
    parsed
  );
}

function safeTimestamp(
  value: unknown
): string | null {
  if (
    typeof value !== "string"
  ) {
    return null;
  }

  const parsed =
    new Date(value);

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return null;
  }

  return parsed.toISOString();
}

function timestampMs(
  value: string
): number {
  const time =
    new Date(value).getTime();

  return Number.isFinite(time)
    ? time
    : 0;
}

function clamp(
  value: number,
  minimum: number,
  maximum: number
): number {
  return Math.min(
    maximum,
    Math.max(
      minimum,
      value
    )
  );
}

function round(
  value: number,
  decimals = 1
): number {
  const factor =
    10 ** decimals;

  return (
    Math.round(
      value * factor
    ) / factor
  );
}

function average(
  values: number[]
): number | null {
  if (
    values.length === 0
  ) {
    return null;
  }

  return (
    values.reduce(
      (
        total,
        value
      ) =>
        total + value,
      0
    ) /
    values.length
  );
}

function median(
  values: number[]
): number | null {
  if (
    values.length === 0
  ) {
    return null;
  }

  const sorted =
    [...values].sort(
      (
        first,
        second
      ) =>
        first - second
    );

  const middle =
    Math.floor(
      sorted.length / 2
    );

  if (
    sorted.length %
      2 ===
    0
  ) {
    return (
      sorted[middle - 1] +
      sorted[middle]
    ) / 2;
  }

  return sorted[middle];
}

function maximum(
  values: number[]
): number | null {
  return values.length > 0
    ? Math.max(...values)
    : null;
}

function minimum(
  values: number[]
): number | null {
  return values.length > 0
    ? Math.min(...values)
    : null;
}

function percentageChange(
  previous: number,
  current: number
): number | null {
  if (
    previous <= 0
  ) {
    return null;
  }

  return round(
    ((current - previous) /
      previous) *
      100
  );
}

function standardDeviation(
  values: number[]
): number | null {
  if (
    values.length < 2
  ) {
    return null;
  }

  const mean =
    average(values);

  if (mean === null) {
    return null;
  }

  const variance =
    values.reduce(
      (
        total,
        value
      ) =>
        total +
        (value - mean) ** 2,
      0
    ) /
    values.length;

  return Math.sqrt(
    variance
  );
}

function volatilityPercentage(
  values: number[]
): number | null {
  const mean =
    average(values);

  const deviation =
    standardDeviation(
      values
    );

  if (
    mean === null ||
    deviation === null ||
    mean <= 0
  ) {
    return null;
  }

  return round(
    (deviation / mean) *
      100
  );
}

/**
 * Ordinary least squares slope.
 *
 * We use sample position rather than actual elapsed time because
 * system-health samples can have different time intervals.
 */
function linearSlope(
  values: number[]
): number | null {
  if (
    values.length < 2
  ) {
    return null;
  }

  const count =
    values.length;

  const meanX =
    (count - 1) / 2;

  const meanY =
    average(values);

  if (meanY === null) {
    return null;
  }

  let numerator = 0;
  let denominator = 0;

  for (
    let index = 0;
    index < count;
    index += 1
  ) {
    numerator +=
      (index - meanX) *
      (values[index] -
        meanY);

    denominator +=
      (index - meanX) ** 2;
  }

  if (
    denominator === 0
  ) {
    return null;
  }

  return (
    numerator /
    denominator
  );
}

function getSlopePercentage(
  values: number[]
): number | null {
  const slope =
    linearSlope(values);

  const baseline =
    average(values);

  if (
    slope === null ||
    baseline === null ||
    baseline <= 0
  ) {
    return null;
  }

  return round(
    (slope / baseline) *
      100
  );
}

function getHealthRank(
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

function getRiskRank(
  risk: OperationsTrendRisk
): number {
  switch (risk) {
    case "critical":
      return 5;

    case "high":
      return 4;

    case "moderate":
      return 3;

    case "low":
      return 2;

    case "none":
    default:
      return 1;
  }
}

function highestRisk(
  risks: OperationsTrendRisk[]
): OperationsTrendRisk {
  return risks.reduce<
    OperationsTrendRisk
  >(
    (
      current,
      risk
    ) =>
      getRiskRank(risk) >
      getRiskRank(current)
        ? risk
        : current,
    "none"
  );
}

function buildServiceTimelines(
  snapshots: SystemHealthSnapshot[]
): ServiceTimeline[] {
  const map =
    new Map<
      string,
      ServiceTimeline
    >();

  for (
    const snapshot of snapshots
  ) {
    const checkedAt =
      safeTimestamp(
        snapshot.checked_at
      );

    if (!checkedAt) {
      continue;
    }

    const services =
      Array.isArray(
        snapshot.services
      )
        ? snapshot.services
        : [];

    for (
      const service of services
    ) {
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

      const point: ServicePoint =
        {
          checkedAt,

          responseTimeMs:
            safeNonNegativeNumber(
              service.response_time_ms
            ),

          status:
            service.status,
        };

      const existing =
        map.get(key);

      if (existing) {
        existing.points.push(
          point
        );

        continue;
      }

      map.set(key, {
        key,
        label,
        points: [point],
      });
    }
  }

  return Array.from(
    map.values()
  );
}

function buildCapacityTimelines(
  snapshots: SystemHealthSnapshot[]
): CapacityTimeline[] {
  const map =
    new Map<
      string,
      CapacityTimeline
    >();

  for (
    const snapshot of snapshots
  ) {
    const checkedAt =
      safeTimestamp(
        snapshot.checked_at
      );

    if (!checkedAt) {
      continue;
    }

    const metrics =
      Array.isArray(
        snapshot.usage
      )
        ? snapshot.usage
        : [];

    for (
      const metric of metrics
    ) {
      const key =
        cleanText(
          metric.key,
          120
        );

      if (!key) {
        continue;
      }

      const label =
        cleanText(
          metric.label,
          160
        ) || key;

      const unit =
        cleanText(
          metric.unit,
          80
        );

      const point: CapacityPoint =
        {
          checkedAt,

          percentage:
            safePercentage(
              metric.percentage
            ),

          used:
            safeNonNegativeNumber(
              metric.used
            ),

          limit:
            safeNonNegativeNumber(
              metric.limit
            ),
        };

      const existing =
        map.get(key);

      if (existing) {
        existing.points.push(
          point
        );

        continue;
      }

      map.set(key, {
        key,
        label,
        unit,
        points: [point],
      });
    }
  }

  return Array.from(
    map.values()
  );
}

function normaliseSnapshots(
  history:
    | SystemHealthSnapshot[]
    | null
    | undefined
): SystemHealthSnapshot[] {
  if (
    !Array.isArray(history)
  ) {
    return [];
  }

  return history
    .filter(
      (snapshot) =>
        Boolean(
          safeTimestamp(
            snapshot.checked_at
          )
        )
    )
    .sort(
      (
        first,
        second
      ) =>
        timestampMs(
          safeTimestamp(
            first.checked_at
          ) ??
            ""
        ) -
        timestampMs(
          safeTimestamp(
            second.checked_at
          ) ??
            ""
        )
    );
}

function responseValues(
  timeline: ServiceTimeline
): number[] {
  return timeline.points
    .map(
      (point) =>
        point.responseTimeMs
    )
    .filter(
      (
        value
      ): value is number =>
        value !== null
    );
}

function countConsecutiveDegraded(
  timeline: ServiceTimeline
): number {
  let count = 0;

  for (
    let index =
      timeline.points.length -
      1;
    index >= 0;
    index -= 1
  ) {
    const point =
      timeline.points[index];

    if (
      point.status ===
      "healthy"
    ) {
      break;
    }

    count += 1;
  }

  return count;
}

function calculateAcceleration(
  values: number[]
): number | null {
  if (
    values.length < 6
  ) {
    return null;
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

  const recent =
    values.slice(
      midpoint
    );

  const earlierSlope =
    getSlopePercentage(
      earlier
    );

  const recentSlope =
    getSlopePercentage(
      recent
    );

  if (
    earlierSlope === null ||
    recentSlope === null
  ) {
    return null;
  }

  return round(
    recentSlope -
      earlierSlope
  );
}

function calculateTrendConfidence(
  sampleCount: number,
  volatility: number | null,
  status: HealthSeverity
): number {
  let confidence =
    Math.min(
      95,
      35 +
        sampleCount * 8
    );

  if (
    volatility !== null
  ) {
    if (
      volatility >
      CRITICAL_VOLATILITY_PERCENTAGE
    ) {
      confidence -= 20;
    } else if (
      volatility >
      HIGH_VOLATILITY_PERCENTAGE
    ) {
      confidence -= 10;
    }
  }

  if (
    status !== "healthy"
  ) {
    confidence += 5;
  }

  return Math.round(
    clamp(
      confidence,
      20,
      99
    )
  );
}

function calculateStabilityScore({
  volatility,
  degradedSamples,
  totalSamples,
  activeIncidentCount,
  currentStatus,
}: {
  volatility: number | null;

  degradedSamples: number;

  totalSamples: number;

  activeIncidentCount: number;

  currentStatus: HealthSeverity;
}): number {
  let score = 100;

  if (
    volatility !== null
  ) {
    score -=
      Math.min(
        35,
        volatility / 2
      );
  }

  if (
    totalSamples > 0
  ) {
    score -=
      Math.min(
        30,
        (degradedSamples /
          totalSamples) *
          60
      );
  }

  score -=
    Math.min(
      20,
      activeIncidentCount *
        5
    );

  switch (
    currentStatus
  ) {
    case "offline":
      score -= 40;
      break;

    case "critical":
      score -= 25;
      break;

    case "warning":
      score -= 10;
      break;

    case "healthy":
    default:
      break;
  }

  return Math.round(
    clamp(
      score,
      0,
      100
    )
  );
}

function determineDirection({
  currentStatus,
  previousStatus,
  changePercentage,
  acceleration,
  recentValues,
}: {
  currentStatus: HealthSeverity;

  previousStatus: HealthSeverity | null;

  changePercentage: number | null;

  acceleration: number | null;

  recentValues: number[];
}): OperationsTrendDirection {
  if (
    previousStatus &&
    getHealthRank(
      currentStatus
    ) <
      getHealthRank(
        previousStatus
      )
  ) {
    return "recovering";
  }

  if (
    currentStatus !==
      "healthy" &&
    previousStatus ===
      "healthy"
  ) {
    return "degrading";
  }

  if (
    recentValues.length <
    MINIMUM_TREND_SAMPLES
  ) {
    return "uncertain";
  }

  if (
    changePercentage ===
    null
  ) {
    return "uncertain";
  }

  if (
    changePercentage >=
      RAPID_DEGRADATION_PERCENTAGE ||
    (acceleration !== null &&
      acceleration >= 25)
  ) {
    return "rapidly_degrading";
  }

  if (
    changePercentage >
    STABLE_CHANGE_PERCENTAGE
  ) {
    return "degrading";
  }

  if (
    changePercentage <
    -STABLE_CHANGE_PERCENTAGE
  ) {
    return "improving";
  }

  return "stable";
}

function determineServiceRisk({
  currentStatus,
  direction,
  currentResponseTime,
  volatility,
  activeIncidentCount,
}: {
  currentStatus: HealthSeverity;

  direction: OperationsTrendDirection;

  currentResponseTime: number | null;

  volatility: number | null;

  activeIncidentCount: number;
}): OperationsTrendRisk {
  if (
    currentStatus ===
    "offline"
  ) {
    return "critical";
  }

  if (
    currentStatus ===
    "critical"
  ) {
    return "high";
  }

  if (
    currentResponseTime !==
      null &&
    currentResponseTime >=
      RESPONSE_CRITICAL_MS
  ) {
    return "high";
  }

  if (
    direction ===
    "rapidly_degrading"
  ) {
    return "high";
  }

  if (
    currentStatus ===
      "warning" ||
    direction ===
      "degrading" ||
    activeIncidentCount > 0
  ) {
    return "moderate";
  }

  if (
    volatility !== null &&
    volatility >=
      HIGH_VOLATILITY_PERCENTAGE
  ) {
    return "moderate";
  }

  if (
    direction ===
      "uncertain" ||
    direction ===
      "recovering"
  ) {
    return "low";
  }

  return "none";
}

function forecastThreshold(
  values: number[],
  threshold: number
): number | null {
  if (
    values.length <
    MINIMUM_FORECAST_SAMPLES
  ) {
    return null;
  }

  const slope =
    linearSlope(values);

  const current =
    values[
      values.length - 1
    ];

  if (
    slope === null ||
    slope <= 0 ||
    current >= threshold
  ) {
    return current >=
      threshold
      ? 0
      : null;
  }

  const samples =
    Math.ceil(
      (threshold -
        current) /
        slope
    );

  if (
    samples < 0 ||
    samples > 100
  ) {
    return null;
  }

  return samples;
}

function nextForecastValue(
  values: number[]
): number | null {
  if (
    values.length <
    MINIMUM_FORECAST_SAMPLES
  ) {
    return null;
  }

  const slope =
    linearSlope(values);

  if (slope === null) {
    return null;
  }

  return Math.max(
    0,
    Math.round(
      values[
        values.length -
          1
      ] + slope
    )
  );
}

function assessServiceTimeline(
  timeline: ServiceTimeline,
  incidents:
    | OperationsIncidentReport
    | null
    | undefined
): ServiceTrendAssessment {
  const points =
    timeline.points;

  const latest =
    points[
      points.length - 1
    ];

  const previous =
    points.length > 1
      ? points[
          points.length - 2
        ]
      : null;

  const values =
    responseValues(
      timeline
    );

  const recentValues =
    values.slice(
      -RECENT_WINDOW_SIZE
    );

  const historicalValues =
    values.slice(
      -(
        HISTORICAL_WINDOW_SIZE +
        RECENT_WINDOW_SIZE
      ),
      -RECENT_WINDOW_SIZE
    );

  const currentResponseTime =
    latest?.responseTimeMs ??
    null;

  const previousResponseTime =
    previous?.responseTimeMs ??
    null;

  const recentAverage =
    average(
      recentValues
    );

  const historicalAverage =
    average(
      historicalValues
    );

  const baseline =
    historicalValues.length > 0
      ? median(
          historicalValues
        )
      : values.length > 1
        ? median(
            values.slice(
              0,
              -1
            )
          )
        : null;

  const changePercentage =
    historicalAverage !==
        null &&
      recentAverage !== null
      ? percentageChange(
          historicalAverage,
          recentAverage
        )
      : previousResponseTime !==
            null &&
          currentResponseTime !==
            null
        ? percentageChange(
            previousResponseTime,
            currentResponseTime
          )
        : null;

  const volatility =
    volatilityPercentage(
      recentValues
    );

  const acceleration =
    calculateAcceleration(
      values.slice(-10)
    );

  const direction =
    determineDirection({
      currentStatus:
        latest?.status ??
        "offline",

      previousStatus:
        previous?.status ??
        null,

      changePercentage,

      acceleration,

      recentValues,
    });

  const serviceIncidents =
    incidents?.incidents.filter(
      (incident) =>
        incident.serviceKey ===
        timeline.key
    ) ?? [];

  const activeIncidentCount =
    serviceIncidents.filter(
      (incident) =>
        incident.status ===
          "active" ||
        incident.status ===
          "monitoring"
    ).length;

  const warningSamples =
    points.filter(
      (point) =>
        point.status ===
        "warning"
    ).length;

  const criticalSamples =
    points.filter(
      (point) =>
        point.status ===
        "critical"
    ).length;

  const offlineSamples =
    points.filter(
      (point) =>
        point.status ===
        "offline"
    ).length;

  const degradedSamples =
    warningSamples +
    criticalSamples +
    offlineSamples;

  const stabilityScore =
    calculateStabilityScore({
      volatility,

      degradedSamples,

      totalSamples:
        points.length,

      activeIncidentCount,

      currentStatus:
        latest?.status ??
        "offline",
    });

  const risk =
    determineServiceRisk({
      currentStatus:
        latest?.status ??
        "offline",

      direction,

      currentResponseTime,

      volatility,

      activeIncidentCount,
    });

  const confidence =
    calculateTrendConfidence(
      values.length,
      volatility,
      latest?.status ??
        "offline"
    );

  const forecastValues =
    recentValues.length >=
    MINIMUM_FORECAST_SAMPLES
      ? recentValues
      : values;

  const estimatedWarning =
    forecastThreshold(
      forecastValues,
      RESPONSE_WARNING_MS
    );

  const estimatedCritical =
    forecastThreshold(
      forecastValues,
      RESPONSE_CRITICAL_MS
    );

  let projectedThresholdBreach:
    | "none"
    | "warning"
    | "critical"
    | "unknown" =
    "unknown";

  if (
    currentResponseTime !==
      null &&
    currentResponseTime >=
      RESPONSE_CRITICAL_MS
  ) {
    projectedThresholdBreach =
      "critical";
  } else if (
    estimatedCritical !==
      null &&
    estimatedCritical <= 3
  ) {
    projectedThresholdBreach =
      "critical";
  } else if (
    currentResponseTime !==
      null &&
    currentResponseTime >=
      RESPONSE_WARNING_MS
  ) {
    projectedThresholdBreach =
      "warning";
  } else if (
    estimatedWarning !==
      null &&
    estimatedWarning <= 3
  ) {
    projectedThresholdBreach =
      "warning";
  } else if (
    values.length >=
    MINIMUM_FORECAST_SAMPLES
  ) {
    projectedThresholdBreach =
      "none";
  }

  const summary =
    buildServiceSummary({
      timeline,

      direction,

      risk,

      changePercentage,

      currentResponseTime,

      volatility,

      stabilityScore,
    });

  const recommendation =
    buildServiceRecommendation({
      direction,

      risk,

      projectedThresholdBreach,

      currentStatus:
        latest?.status ??
        "offline",
    });

  return {
    serviceKey:
      timeline.key,

    serviceLabel:
      timeline.label,

    currentStatus:
      latest?.status ??
      "offline",

    direction,

    risk,

    confidence,

    stabilityScore,

    sampleCount:
      points.length,

    currentResponseTimeMs:
      currentResponseTime,

    previousResponseTimeMs:
      previousResponseTime,

    averageResponseTimeMs:
      average(values) !==
      null
        ? Math.round(
            average(
              values
            ) as number
          )
        : null,

    recentAverageResponseTimeMs:
      recentAverage !==
      null
        ? Math.round(
            recentAverage
          )
        : null,

    historicalAverageResponseTimeMs:
      historicalAverage !==
      null
        ? Math.round(
            historicalAverage
          )
        : null,

    baselineResponseTimeMs:
      baseline !== null
        ? Math.round(
            baseline
          )
        : null,

    peakResponseTimeMs:
      maximum(values),

    minimumResponseTimeMs:
      minimum(values),

    latencyChangePercentage:
      changePercentage,

    volatilityPercentage:
      volatility,

    accelerationPercentage:
      acceleration,

    warningSamples,

    criticalSamples,

    offlineSamples,

    consecutiveDegradedSamples:
      countConsecutiveDegraded(
        timeline
      ),

    activeIncidentCount,

    forecast: {
      nextExpectedResponseTimeMs:
        nextForecastValue(
          forecastValues
        ),

      projectedThresholdBreach,

      estimatedSamplesToWarning:
        estimatedWarning,

      estimatedSamplesToCritical:
        estimatedCritical,
    },

    summary,

    recommendation,

    evidence: {
      recent_samples:
        recentValues.length,

      historical_samples:
        historicalValues.length,

      warning_threshold_ms:
        RESPONSE_WARNING_MS,

      critical_threshold_ms:
        RESPONSE_CRITICAL_MS,

      active_incidents:
        activeIncidentCount,
    },
  };
}

function buildServiceSummary({
  timeline,
  direction,
  risk,
  changePercentage,
  currentResponseTime,
  volatility,
  stabilityScore,
}: {
  timeline: ServiceTimeline;

  direction: OperationsTrendDirection;

  risk: OperationsTrendRisk;

  changePercentage: number | null;

  currentResponseTime: number | null;

  volatility: number | null;

  stabilityScore: number;
}): string {
  const parts: string[] =
    [];

  if (
    currentResponseTime !==
    null
  ) {
    parts.push(
      `Latest response time is ${Math.round(
        currentResponseTime
      ).toLocaleString(
        "en-GB"
      )} ms.`
    );
  }

  switch (direction) {
    case "rapidly_degrading":
      parts.push(
        "Recent latency is deteriorating rapidly."
      );
      break;

    case "degrading":
      parts.push(
        "Recent performance is trending slower."
      );
      break;

    case "improving":
      parts.push(
        "Recent performance is improving."
      );
      break;

    case "recovering":
      parts.push(
        "Service health shows evidence of recovery."
      );
      break;

    case "stable":
      parts.push(
        "Recent performance is broadly stable."
      );
      break;

    case "uncertain":
    default:
      parts.push(
        "There is not yet enough stable evidence for a strong trend conclusion."
      );
      break;
  }

  if (
    changePercentage !==
    null
  ) {
    parts.push(
      `Measured latency change is ${Math.abs(
        changePercentage
      ).toFixed(
        1
      )}% ${
        changePercentage >
        0
          ? "higher"
          : "lower"
      } than the comparison period.`
    );
  }

  if (
    volatility !== null &&
    volatility >=
      HIGH_VOLATILITY_PERCENTAGE
  ) {
    parts.push(
      `Response-time volatility is elevated at ${volatility.toFixed(
        1
      )}%.`
    );
  }

  parts.push(
    `Stability score is ${stabilityScore}/100 with ${risk} predictive risk.`
  );

  return `${timeline.label}: ${parts.join(
    " "
  )}`;
}

function buildServiceRecommendation({
  direction,
  risk,
  projectedThresholdBreach,
  currentStatus,
}: {
  direction: OperationsTrendDirection;

  risk: OperationsTrendRisk;

  projectedThresholdBreach:
    | "none"
    | "warning"
    | "critical"
    | "unknown";

  currentStatus: HealthSeverity;
}): string {
  if (
    currentStatus ===
      "offline" ||
    risk === "critical"
  ) {
    return "Investigate the service immediately and correlate the outage with provider status, application logs, database telemetry and recent deployment activity.";
  }

  if (
    currentStatus ===
      "critical" ||
    projectedThresholdBreach ===
      "critical"
  ) {
    return "Treat this as a high-priority operational risk. Review service latency, dependency health, resource pressure and recent changes before user impact increases.";
  }

  if (
    direction ===
      "rapidly_degrading" ||
    risk === "high"
  ) {
    return "Investigate the accelerating degradation now rather than waiting for a hard threshold breach.";
  }

  if (
    direction ===
      "degrading" ||
    risk === "moderate"
  ) {
    return "Monitor the next health checks closely and review recent application, database and external dependency performance.";
  }

  if (
    direction ===
    "recovering"
  ) {
    return "Continue monitoring until several consecutive healthy samples confirm the recovery is stable.";
  }

  if (
    direction ===
    "uncertain"
  ) {
    return "Collect additional health snapshots before making a strong operational conclusion.";
  }

  return "No immediate intervention is required. Continue normal automated monitoring.";
}

function assessCapacityTimeline(
  timeline: CapacityTimeline
): CapacityTrendAssessment {
  const measured =
    timeline.points.filter(
      (
        point
      ): point is CapacityPoint & {
        percentage: number;
      } =>
        point.percentage !==
        null
    );

  const percentages =
    measured.map(
      (point) =>
        point.percentage
    );

  const latest =
    measured.length > 0
      ? measured[
          measured.length - 1
        ]
      : null;

  const previous =
    measured.length > 1
      ? measured[
          measured.length - 2
        ]
      : null;

  const currentPercentage =
    latest?.percentage ??
    null;

  const previousPercentage =
    previous?.percentage ??
    null;

  const slope =
    linearSlope(
      percentages
    );

  let direction:
    CapacityTrendDirection =
    "unknown";

  if (
    percentages.length >= 3 &&
    slope !== null
  ) {
    if (
      Math.abs(slope) <
      1
    ) {
      direction =
        "stable";
    } else if (
      slope > 0
    ) {
      direction =
        "increasing";
    } else {
      direction =
        "decreasing";
    }
  }

  let risk:
    OperationsTrendRisk =
    "none";

  if (
    currentPercentage !==
    null
  ) {
    if (
      currentPercentage >=
      CAPACITY_CRITICAL_PERCENTAGE
    ) {
      risk =
        "critical";
    } else if (
      currentPercentage >=
      CAPACITY_HIGH_PERCENTAGE
    ) {
      risk =
        "high";
    } else if (
      currentPercentage >=
      CAPACITY_WARNING_PERCENTAGE
    ) {
      risk =
        "moderate";
    } else if (
      direction ===
      "increasing"
    ) {
      risk =
        "low";
    }
  }

  const confidence =
    currentPercentage ===
    null
      ? 25
      : Math.round(
          clamp(
            40 +
              percentages.length *
                10,
            40,
            98
          )
        );

  const warningSamples =
    forecastCapacityThreshold(
      percentages,
      CAPACITY_WARNING_PERCENTAGE
    );

  const criticalSamples =
    forecastCapacityThreshold(
      percentages,
      CAPACITY_CRITICAL_PERCENTAGE
    );

  return {
    metricKey:
      timeline.key,

    label:
      timeline.label,

    unit:
      timeline.unit,

    currentPercentage,

    previousPercentage,

    averagePercentage:
      average(percentages) !==
      null
        ? round(
            average(
              percentages
            ) as number
          )
        : null,

    peakPercentage:
      maximum(
        percentages
      ) !== null
        ? round(
            maximum(
              percentages
            ) as number
          )
        : null,

    direction,

    risk,

    confidence,

    sampleCount:
      percentages.length,

    changePercentagePoints:
      currentPercentage !==
          null &&
        previousPercentage !==
          null
        ? round(
            currentPercentage -
              previousPercentage
          )
        : null,

    estimatedSamplesToWarning:
      warningSamples,

    estimatedSamplesToCritical:
      criticalSamples,

    summary:
      buildCapacitySummary({
        timeline,
        currentPercentage,
        direction,
        risk,
      }),

    recommendation:
      buildCapacityRecommendation(
        risk,
        direction
      ),
  };
}

function forecastCapacityThreshold(
  values: number[],
  threshold: number
): number | null {
  if (
    values.length <
    MINIMUM_FORECAST_SAMPLES
  ) {
    return null;
  }

  const current =
    values[
      values.length - 1
    ];

  if (
    current >= threshold
  ) {
    return 0;
  }

  const slope =
    linearSlope(values);

  if (
    slope === null ||
    slope <= 0
  ) {
    return null;
  }

  const samples =
    Math.ceil(
      (threshold -
        current) /
        slope
    );

  return samples >= 0 &&
    samples <= 100
    ? samples
    : null;
}

function buildCapacitySummary({
  timeline,
  currentPercentage,
  direction,
  risk,
}: {
  timeline: CapacityTimeline;

  currentPercentage: number | null;

  direction: CapacityTrendDirection;

  risk: OperationsTrendRisk;
}): string {
  if (
    currentPercentage ===
    null
  ) {
    return `${timeline.label} utilisation cannot currently be measured because percentage telemetry is unavailable.`;
  }

  return `${timeline.label} is at ${currentPercentage.toFixed(
    1
  )}% utilisation and is ${direction}. Current predictive risk is ${risk}.`;
}

function buildCapacityRecommendation(
  risk: OperationsTrendRisk,
  direction: CapacityTrendDirection
): string {
  switch (risk) {
    case "critical":
      return "Capacity is critically constrained. Review usage immediately and prepare additional capacity or usage reduction.";

    case "high":
      return "Capacity headroom is becoming limited. Review growth and capacity planning before the metric reaches a critical threshold.";

    case "moderate":
      return "Monitor capacity closely and confirm expected growth will remain within available limits.";

    case "low":
      return direction ===
        "increasing"
        ? "Usage is increasing but remains within a healthy range. Continue monitoring the growth rate."
        : "Continue routine capacity monitoring.";

    case "none":
    default:
      return "No capacity intervention is currently required.";
  }
}

function buildEarlyWarnings(
  services: ServiceTrendAssessment[],
  capacity: CapacityTrendAssessment[]
): OperationsEarlyWarning[] {
  const warnings:
    OperationsEarlyWarning[] =
    [];

  for (
    const service of services
  ) {
    if (
      service.direction ===
      "rapidly_degrading"
    ) {
      warnings.push({
        id:
          `trend-rapid-${service.serviceKey}`,

        severity:
          service.risk ===
          "critical"
            ? "critical"
            : "high",

        serviceKey:
          service.serviceKey,

        title:
          `${service.serviceLabel} is deteriorating rapidly`,

        message:
          service.summary,

        recommendation:
          service.recommendation,

        confidence:
          service.confidence,

        evidence: {
          current_response_time_ms:
            service.currentResponseTimeMs,

          latency_change_percentage:
            service.latencyChangePercentage,

          acceleration_percentage:
            service.accelerationPercentage,

          stability_score:
            service.stabilityScore,
        },
      });
    }

    if (
      service.forecast
        .projectedThresholdBreach ===
      "critical"
    ) {
      warnings.push({
        id:
          `forecast-critical-${service.serviceKey}`,

        severity:
          "high",

        serviceKey:
          service.serviceKey,

        title:
          `${service.serviceLabel} may approach critical latency`,

        message:
          service.forecast
            .estimatedSamplesToCritical ===
          0
            ? `${service.serviceLabel} is already at or above the critical latency threshold.`
            : `${service.serviceLabel} is trending toward the critical latency threshold based on recent deterministic telemetry.`,

        recommendation:
          "Investigate the latency trend before the service reaches sustained critical performance.",

        confidence:
          service.confidence,

        evidence: {
          expected_next_response_time_ms:
            service.forecast
              .nextExpectedResponseTimeMs,

          estimated_samples_to_critical:
            service.forecast
              .estimatedSamplesToCritical,

          critical_threshold_ms:
            RESPONSE_CRITICAL_MS,
        },
      });
    }

    if (
      service.stabilityScore <
        50 &&
      service.risk !== "none"
    ) {
      warnings.push({
        id:
          `stability-${service.serviceKey}`,

        severity:
          service.stabilityScore <
          25
            ? "high"
            : "medium",

        serviceKey:
          service.serviceKey,

        title:
          `${service.serviceLabel} stability has weakened`,

        message:
          `${service.serviceLabel} currently has a stability score of ${service.stabilityScore}/100.`,

        recommendation:
          "Review response-time volatility, recurring warnings and recent service incidents.",

        confidence:
          service.confidence,

        evidence: {
          stability_score:
            service.stabilityScore,

          volatility_percentage:
            service.volatilityPercentage,

          active_incidents:
            service.activeIncidentCount,
        },
      });
    }
  }

  for (
    const metric of capacity
  ) {
    if (
      metric.risk ===
        "critical" ||
      metric.risk === "high"
    ) {
      warnings.push({
        id:
          `capacity-${metric.metricKey}`,

        severity:
          metric.risk ===
          "critical"
            ? "critical"
            : "high",

        serviceKey:
          null,

        title:
          `${metric.label} capacity requires attention`,

        message:
          metric.summary,

        recommendation:
          metric.recommendation,

        confidence:
          metric.confidence,

        evidence: {
          current_percentage:
            metric.currentPercentage,

          peak_percentage:
            metric.peakPercentage,

          estimated_samples_to_critical:
            metric.estimatedSamplesToCritical,
        },
      });
    }
  }

  return warnings
    .sort(
      (
        first,
        second
      ) => {
        const order:
          Record<
            OperationsIncidentSeverity,
            number
          > = {
          critical: 5,
          high: 4,
          medium: 3,
          low: 2,
          info: 1,
        };

        return (
          order[
            second.severity
          ] -
          order[
            first.severity
          ]
        );
      }
    )
    .slice(
      0,
      30
    );
}

function buildPlatformSummary(
  services: ServiceTrendAssessment[],
  incidents:
    | OperationsIncidentReport
    | null
    | undefined
): PlatformTrendSummary {
  const servicesImproving =
    services.filter(
      (service) =>
        service.direction ===
        "improving"
    ).length;

  const servicesStable =
    services.filter(
      (service) =>
        service.direction ===
        "stable"
    ).length;

  const servicesDegrading =
    services.filter(
      (service) =>
        service.direction ===
        "degrading"
    ).length;

  const servicesRapidlyDegrading =
    services.filter(
      (service) =>
        service.direction ===
        "rapidly_degrading"
    ).length;

  const servicesRecovering =
    services.filter(
      (service) =>
        service.direction ===
        "recovering"
    ).length;

  const servicesUncertain =
    services.filter(
      (service) =>
        service.direction ===
        "uncertain"
    ).length;

  const highRiskServices =
    services.filter(
      (service) =>
        service.risk ===
        "high"
    ).length;

  const criticalRiskServices =
    services.filter(
      (service) =>
        service.risk ===
        "critical"
    ).length;

  const currentValues =
    services
      .map(
        (service) =>
          service.currentResponseTimeMs
      )
      .filter(
        (
          value
        ): value is number =>
          value !== null
      );

  const recentValues =
    services
      .map(
        (service) =>
          service
            .recentAverageResponseTimeMs
      )
      .filter(
        (
          value
        ): value is number =>
          value !== null
      );

  const historicalValues =
    services
      .map(
        (service) =>
          service
            .historicalAverageResponseTimeMs
      )
      .filter(
        (
          value
        ): value is number =>
          value !== null
      );

  const recentAverage =
    average(
      recentValues
    );

  const historicalAverage =
    average(
      historicalValues
    );

  const performanceChange =
    recentAverage !== null &&
    historicalAverage !==
      null
      ? percentageChange(
          historicalAverage,
          recentAverage
        )
      : null;

  let direction:
    OperationsTrendDirection =
    "stable";

  if (
    criticalRiskServices > 0 ||
    servicesRapidlyDegrading >
      0
  ) {
    direction =
      "rapidly_degrading";
  } else if (
    servicesDegrading >
    servicesImproving +
      servicesRecovering
  ) {
    direction =
      "degrading";
  } else if (
    servicesRecovering > 0 &&
    servicesDegrading ===
      0 &&
    servicesRapidlyDegrading ===
      0
  ) {
    direction =
      "recovering";
  } else if (
    servicesImproving >
      servicesDegrading &&
    servicesImproving > 0
  ) {
    direction =
      "improving";
  } else if (
    services.length === 0 ||
    servicesUncertain ===
      services.length
  ) {
    direction =
      "uncertain";
  }

  const risk =
    highestRisk(
      services.map(
        (service) =>
          service.risk
      )
    );

  const stabilityScore =
    services.length > 0
      ? Math.round(
          services.reduce(
            (
              total,
              service
            ) =>
              total +
              service.stabilityScore,
            0
          ) /
            services.length
        )
      : 0;

  const confidence =
    services.length > 0
      ? Math.round(
          services.reduce(
            (
              total,
              service
            ) =>
              total +
              service.confidence,
            0
          ) /
            services.length
        )
      : 0;

  const activeIncidentCount =
    incidents?.activeIncidents
      .length ?? 0;

  let headline =
    "Platform performance is stable.";

  if (
    risk === "critical"
  ) {
    headline =
      "Critical operational risk is present.";
  } else if (
    direction ===
    "rapidly_degrading"
  ) {
    headline =
      "Platform telemetry shows rapid degradation.";
  } else if (
    direction ===
    "degrading"
  ) {
    headline =
      "Some monitored services are trending slower.";
  } else if (
    direction ===
    "recovering"
  ) {
    headline =
      "Platform telemetry shows recovery.";
  } else if (
    direction ===
    "improving"
  ) {
    headline =
      "Platform performance is improving.";
  } else if (
    direction ===
    "uncertain"
  ) {
    headline =
      "More monitoring history is required.";
  }

  const summary =
    [
      `${services.length} monitored services were analysed.`,

      `${servicesStable} stable, ${servicesImproving} improving, ${servicesRecovering} recovering, ${servicesDegrading} degrading and ${servicesRapidlyDegrading} rapidly degrading.`,

      `Platform stability score is ${stabilityScore}/100.`,

      activeIncidentCount > 0
        ? `${activeIncidentCount} active or monitored incidents are currently present.`
        : "No active deterministic incidents are currently recorded.",
    ].join(
      " "
    );

  return {
    direction,

    risk,

    confidence,

    stabilityScore,

    servicesImproving,

    servicesStable,

    servicesDegrading,

    servicesRapidlyDegrading,

    servicesRecovering,

    servicesUncertain,

    highRiskServices,

    criticalRiskServices,

    activeIncidentCount,

    averageResponseTimeMs:
      average(
        currentValues
      ) !== null
        ? Math.round(
            average(
              currentValues
            ) as number
          )
        : null,

    recentAverageResponseTimeMs:
      recentAverage !==
      null
        ? Math.round(
            recentAverage
          )
        : null,

    historicalAverageResponseTimeMs:
      historicalAverage !==
      null
        ? Math.round(
            historicalAverage
          )
        : null,

    performanceChangePercentage:
      performanceChange,

    headline,

    summary,
  };
}

/**
 * Main deterministic trend-analysis entry point.
 */
export function analyseOperationsTrends(
  history:
    | SystemHealthSnapshot[]
    | null
    | undefined,
  incidentReport?:
    | OperationsIncidentReport
    | null
): OperationsTrendReport {
  const generatedAt =
    new Date().toISOString();

  const snapshots =
    normaliseSnapshots(
      history
    );

  if (
    snapshots.length === 0
  ) {
    return {
      generatedAt,

      engineVersion:
        OPERATIONS_TREND_ENGINE_VERSION,

      snapshotsAnalysed:
        0,

      earliestSnapshotAt:
        null,

      latestSnapshotAt:
        null,

      platform: {
        direction:
          "uncertain",

        risk:
          "none",

        confidence:
          0,

        stabilityScore:
          0,

        servicesImproving:
          0,

        servicesStable:
          0,

        servicesDegrading:
          0,

        servicesRapidlyDegrading:
          0,

        servicesRecovering:
          0,

        servicesUncertain:
          0,

        highRiskServices:
          0,

        criticalRiskServices:
          0,

        activeIncidentCount:
          0,

        averageResponseTimeMs:
          null,

        recentAverageResponseTimeMs:
          null,

        historicalAverageResponseTimeMs:
          null,

        performanceChangePercentage:
          null,

        headline:
          "No trend data is available.",

        summary:
          "Run additional system-health checks to build enough historical evidence for predictive analysis.",
      },

      services: [],

      capacity: [],

      earlyWarnings: [],
    };
  }

  const serviceTimelines =
    buildServiceTimelines(
      snapshots
    );

  const capacityTimelines =
    buildCapacityTimelines(
      snapshots
    );

  const services =
    serviceTimelines
      .map(
        (timeline) =>
          assessServiceTimeline(
            timeline,
            incidentReport
          )
      )
      .sort(
        (
          first,
          second
        ) => {
          const riskDifference =
            getRiskRank(
              second.risk
            ) -
            getRiskRank(
              first.risk
            );

          if (
            riskDifference !==
            0
          ) {
            return riskDifference;
          }

          return (
            first.stabilityScore -
            second.stabilityScore
          );
        }
      );

  const capacity =
    capacityTimelines
      .map(
        (timeline) =>
          assessCapacityTimeline(
            timeline
          )
      )
      .sort(
        (
          first,
          second
        ) =>
          getRiskRank(
            second.risk
          ) -
          getRiskRank(
            first.risk
          )
      );

  const platform =
    buildPlatformSummary(
      services,
      incidentReport
    );

  const earlyWarnings =
    buildEarlyWarnings(
      services,
      capacity
    );

  return {
    generatedAt,

    engineVersion:
      OPERATIONS_TREND_ENGINE_VERSION,

    snapshotsAnalysed:
      snapshots.length,

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

    platform,

    services,

    capacity,

    earlyWarnings,
  };
}

/**
 * Returns only services that currently deserve operator attention.
 */
export function getAtRiskServices(
  report:
    | OperationsTrendReport
    | null
    | undefined
): ServiceTrendAssessment[] {
  if (!report) {
    return [];
  }

  return report.services.filter(
    (service) =>
      service.risk ===
        "moderate" ||
      service.risk ===
        "high" ||
      service.risk ===
        "critical" ||
      service.direction ===
        "rapidly_degrading"
  );
}

/**
 * Returns the most unstable monitored service.
 */
export function getLeastStableService(
  report:
    | OperationsTrendReport
    | null
    | undefined
): ServiceTrendAssessment | null {
  if (
    !report ||
    report.services.length ===
      0
  ) {
    return null;
  }

  return [...report.services].sort(
    (
      first,
      second
    ) =>
      first.stabilityScore -
      second.stabilityScore
  )[0];
}

/**
 * True when deterministic telemetry indicates material
 * predictive deterioration.
 */
export function hasPredictiveOperationalRisk(
  report:
    | OperationsTrendReport
    | null
    | undefined
): boolean {
  if (!report) {
    return false;
  }

  return (
    report.platform.risk ===
      "high" ||
    report.platform.risk ===
      "critical" ||
    report.platform
      .servicesRapidlyDegrading >
      0 ||
    report.earlyWarnings.some(
      (warning) =>
        warning.severity ===
          "high" ||
        warning.severity ===
          "critical"
    )
  );
}