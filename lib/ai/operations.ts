import "server-only";

import {
  zodTextFormat,
} from "openai/helpers/zod";

import {
  getOpenAIClient,
  isOpenAIConfigured,
} from "@/lib/ai/client";

import {
  AI_LIMITS,
  getAIModel,
  getAIReasoningEffort,
} from "@/lib/ai/models";

import {
  OPERATIONS_ANALYSIS_PROMPT,
  OPERATIONS_SYSTEM_PROMPT,
} from "@/lib/ai/prompts";

import {
  AIOperationsAssessmentSchema,
  type AIOperationsAssessment,
  type AIOperationsResult,
  type OperationsAreaAssessment,
  type OperationsPlatformStatus,
  type OperationsPriority,
  type OperationsRiskLevel,
} from "@/lib/ai/types";

import type {
  SystemHealthSnapshot,
} from "@/lib/systemHealthTypes";

import type {
  HealthIntelligenceSummary,
  IntelligenceFinding,
} from "@/lib/systemHealthIntelligence";

export type OperationsHistoryService = {
  key?: string;
  label?: string;
  status?: string;

  response_time_ms?:
    | number
    | null;
};

export type OperationsHistoryUsageMetric = {
  key?: string;
  label?: string;

  percentage?:
    | number
    | null;
};

export type OperationsHistoryItem = {
  overall_status: string;

  response_time_ms:
    | number
    | null;

  checked_at: string;

  services?:
    OperationsHistoryService[];

  usage?:
    OperationsHistoryUsageMetric[];
};

export type GenerateOperationsAssessmentInput = {
  snapshot:
    | SystemHealthSnapshot
    | null;

  intelligence:
    HealthIntelligenceSummary;

  history?:
    OperationsHistoryItem[];
};

type DeterministicTrend = {
  direction:
    | "improving"
    | "stable"
    | "increasing"
    | "decreasing"
    | "uncertain";

  summary: string;

  confidence: number;
};

const MAX_HISTORY_SERVICE_ITEMS =
  30;

const MAX_HISTORY_USAGE_ITEMS =
  30;

const RESPONSE_WARNING_MS =
  1_500;

const RESPONSE_CRITICAL_MS =
  5_000;

const QUOTA_INFO_PERCENTAGE =
  50;

const QUOTA_WARNING_PERCENTAGE =
  70;

const QUOTA_HIGH_PERCENTAGE =
  85;

const QUOTA_CRITICAL_PERCENTAGE =
  95;

const DATABASE_SERVICE_KEYS = [
  "database",
  "db",
  "postgres",
  "postgresql",
  "supabase_db",
  "supabase_database",
] as const;

const PERFORMANCE_MINIMUM_HISTORY =
  3;

function cleanString(
  value: unknown,
  maxLength = 1_000
): string {
  if (
    typeof value !== "string" &&
    typeof value !== "number" &&
    typeof value !== "boolean"
  ) {
    return "";
  }

  return String(value)
    .replace(
      /[\u0000-\u001F\u007F]/g,
      " "
    )
    .trim()
    .replace(/\s+/g, " ")
    .slice(
      0,
      maxLength
    );
}

function clampScore(
  value: number
): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(value)
    )
  );
}

function clampConfidence(
  value: number
): number {
  return clampScore(value);
}

function safeNonNegativeNumber(
  value: unknown
): number | null {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0
  ) {
    return null;
  }

  return value;
}

function safeResponseTime(
  value: unknown
): number | null {
  const number =
    safeNonNegativeNumber(
      value
    );

  return number === null
    ? null
    : Math.round(number);
}

function safePercentage(
  value: unknown
): number | null {
  const numeric =
    safeNonNegativeNumber(
      value
    );

  if (numeric === null) {
    return null;
  }

  return Math.min(
    100,
    numeric
  );
}

function safeTimestamp(
  value: unknown
): string {
  const cleaned =
    cleanString(
      value,
      100
    );

  if (!cleaned) {
    return "";
  }

  const timestamp =
    Date.parse(cleaned);

  if (
    !Number.isFinite(timestamp)
  ) {
    return "";
  }

  return new Date(
    timestamp
  ).toISOString();
}

function normaliseServiceKey(
  value: unknown
): string {
  return cleanString(
    value,
    120
  )
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      "_"
    )
    .replace(
      /^_+|_+$/g,
      ""
    );
}

function normaliseHistoryItem(
  item:
    OperationsHistoryItem
): OperationsHistoryItem {
  return {
    overall_status:
      cleanString(
        item.overall_status,
        50
      ) ||
      "unknown",

    response_time_ms:
      safeResponseTime(
        item.response_time_ms
      ),

    checked_at:
      safeTimestamp(
        item.checked_at
      ),

    services:
      Array.isArray(
        item.services
      )
        ? item.services
            .slice(
              0,
              MAX_HISTORY_SERVICE_ITEMS
            )
            .map(
              (service) => ({
                key:
                  cleanString(
                    service.key,
                    120
                  ) ||
                  undefined,

                label:
                  cleanString(
                    service.label,
                    160
                  ) ||
                  undefined,

                status:
                  cleanString(
                    service.status,
                    50
                  ) ||
                  undefined,

                response_time_ms:
                  safeResponseTime(
                    service
                      .response_time_ms
                  ),
              })
            )
        : [],

    usage:
      Array.isArray(
        item.usage
      )
        ? item.usage
            .slice(
              0,
              MAX_HISTORY_USAGE_ITEMS
            )
            .map(
              (metric) => ({
                key:
                  cleanString(
                    metric.key,
                    120
                  ) ||
                  undefined,

                label:
                  cleanString(
                    metric.label,
                    160
                  ) ||
                  undefined,

                percentage:
                  safePercentage(
                    metric.percentage
                  ),
              })
            )
        : [],
  };
}

function cleanHistory(
  history:
    | OperationsHistoryItem[]
    | undefined
): OperationsHistoryItem[] {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .map(
      normaliseHistoryItem
    )
    .filter(
      (item) =>
        Boolean(
          item.checked_at
        )
    )
    .sort(
      (
        first,
        second
      ) =>
        Date.parse(
          second.checked_at
        ) -
        Date.parse(
          first.checked_at
        )
    )
    .slice(
      0,
      AI_LIMITS
        .operationsHistorySnapshots
    );
}

function findingPriority(
  finding:
    IntelligenceFinding
): OperationsPriority {
  switch (
    finding.severity
  ) {
    case "critical":
      return "urgent";

    case "high":
      return "high";

    case "medium":
      return "medium";

    case "low":
      return "low";

    case "info":
    default:
      return "monitor";
  }
}

function getDatabaseService(
  snapshot:
    | SystemHealthSnapshot
    | null
) {
  if (
    !snapshot ||
    !Array.isArray(
      snapshot.services
    )
  ) {
    return null;
  }

  for (
    const service of
    snapshot.services
  ) {
    const key =
      normaliseServiceKey(
        service.key
      );

    if (
      DATABASE_SERVICE_KEYS.some(
        (candidate) =>
          key === candidate ||
          key.includes(
            candidate
          )
      )
    ) {
      return service;
    }
  }

  return null;
}

function statusToAreaStatus(
  status: string
): OperationsAreaAssessment["status"] {
  switch (
    status.toLowerCase()
  ) {
    case "healthy":
      return "healthy";

    case "warning":
      return "attention";

    case "critical":
      return "critical";

    case "offline":
      return "critical";

    default:
      return "unknown";
  }
}

function getPerformanceAssessment(
  intelligence:
    HealthIntelligenceSummary
): OperationsAreaAssessment {
  const average =
    intelligence
      .averageResponseTimeMs;

  if (
    average === null ||
    !Number.isFinite(average)
  ) {
    return {
      status:
        "unknown",

      score:
        clampScore(
          intelligence.score
        ),

      summary:
        "No reliable response-time assessment is currently available.",
    };
  }

  if (
    average >=
    RESPONSE_CRITICAL_MS
  ) {
    return {
      status:
        "critical",

      score:
        clampScore(
          intelligence.score -
            20
        ),

      summary:
        `Average monitored response time is ${Math.round(
          average
        ).toLocaleString(
          "en-GB"
        )} ms, exceeding the critical ${RESPONSE_CRITICAL_MS.toLocaleString(
          "en-GB"
        )} ms threshold.`,
    };
  }

  if (
    average >=
    RESPONSE_WARNING_MS
  ) {
    return {
      status:
        "attention",

      score:
        clampScore(
          intelligence.score -
            8
        ),

      summary:
        `Average monitored response time is ${Math.round(
          average
        ).toLocaleString(
          "en-GB"
        )} ms, above the ${RESPONSE_WARNING_MS.toLocaleString(
          "en-GB"
        )} ms monitoring threshold.`,
    };
  }

  return {
    status:
      intelligence.score >= 95
        ? "excellent"
        : "healthy",

    score:
      clampScore(
        intelligence.score
      ),

    summary:
      `Average monitored response time is ${Math.round(
        average
      ).toLocaleString(
        "en-GB"
      )} ms.`,
  };
}

function getQuotaAssessment(
  intelligence:
    HealthIntelligenceSummary
): OperationsAreaAssessment {
  const metric =
    intelligence
      .highestUsageMetric;

  const percentage =
    safePercentage(
      metric?.percentage
    );

  if (
    percentage === null
  ) {
    return {
      status:
        "unknown",

      score:
        clampScore(
          intelligence.score
        ),

      summary:
        "No reliable capacity percentage is currently available for quota assessment.",
    };
  }

  const label =
    cleanString(
      metric?.label,
      200
    ) ||
    "The highest usage metric";

  if (
    percentage >=
    QUOTA_CRITICAL_PERCENTAGE
  ) {
    return {
      status:
        "critical",

      score:
        clampScore(
          intelligence.score -
            25
        ),

      summary:
        `${label} has reached ${percentage.toFixed(
          1
        )}% of its configured limit.`,
    };
  }

  if (
    percentage >=
    QUOTA_HIGH_PERCENTAGE
  ) {
    return {
      status:
        "degraded",

      score:
        clampScore(
          intelligence.score -
            15
        ),

      summary:
        `${label} is at ${percentage.toFixed(
          1
        )}% of its configured limit and requires capacity planning.`,
    };
  }

  if (
    percentage >=
    QUOTA_WARNING_PERCENTAGE
  ) {
    return {
      status:
        "attention",

      score:
        clampScore(
          intelligence.score -
            8
        ),

      summary:
        `${label} is currently at ${percentage.toFixed(
          1
        )}% of its configured limit.`,
    };
  }

  if (
    percentage >=
    QUOTA_INFO_PERCENTAGE
  ) {
    return {
      status:
        "healthy",

      score:
        clampScore(
          intelligence.score
        ),

      summary:
        `${label} is currently at ${percentage.toFixed(
          1
        )}% of its configured limit and remains within healthy capacity.`,
    };
  }

  return {
    status:
      intelligence.score >= 95
        ? "excellent"
        : "healthy",

    score:
      clampScore(
        intelligence.score
      ),

    summary:
      `${label} is currently at ${percentage.toFixed(
        1
      )}% of its configured limit.`,
  };
}

function getDatabaseAssessment(
  snapshot:
    | SystemHealthSnapshot
    | null,
  intelligence:
    HealthIntelligenceSummary
): OperationsAreaAssessment {
  const database =
    getDatabaseService(
      snapshot
    );

  if (!database) {
    return {
      status:
        "unknown",

      score:
        clampScore(
          intelligence.score
        ),

      summary:
        "No dedicated database service result was available in the latest health snapshot.",
    };
  }

  const status =
    statusToAreaStatus(
      database.status
    );

  const responseTime =
    safeResponseTime(
      database.response_time_ms
    );

  const baseScore =
    status === "critical"
      ? 35
      : status === "attention"
        ? 70
        : responseTime !== null &&
            responseTime >=
              RESPONSE_CRITICAL_MS
          ? 55
          : responseTime !== null &&
              responseTime >=
                RESPONSE_WARNING_MS
            ? 78
            : 100;

  const responseDescription =
    responseTime === null
      ? ""
      : ` Response time was ${responseTime.toLocaleString(
          "en-GB"
        )} ms.`;

  return {
    status:
      status === "healthy" &&
      baseScore >= 95
        ? "excellent"
        : status,

    score:
      clampScore(
        baseScore
      ),

    summary:
      `${cleanString(
        database.message,
        1_500
      ) ||
        `Database service reported ${database.status}.`}${responseDescription}`,
  };
}

function getInfrastructureAssessment(
  intelligence:
    HealthIntelligenceSummary
): OperationsAreaAssessment {
  const serious =
    intelligence.offlineServices >
      0 ||
    intelligence.criticalServices >
      0;

  const warnings =
    intelligence.warningServices >
    0;

  return {
    status:
      serious
        ? "critical"
        : warnings
          ? "attention"
          : intelligence.score >=
              95
            ? "excellent"
            : "healthy",

    score:
      clampScore(
        intelligence.score
      ),

    summary:
      cleanString(
        intelligence.headline,
        1_500
      ) ||
      "Infrastructure monitoring completed.",
  };
}

function getApplicationAssessment(
  intelligence:
    HealthIntelligenceSummary
): OperationsAreaAssessment {
  const serious =
    intelligence.offlineServices >
      0 ||
    intelligence.criticalServices >
      0;

  const warnings =
    intelligence.warningServices >
    0;

  return {
    status:
      serious
        ? "critical"
        : warnings
          ? "attention"
          : intelligence.score >=
              95
            ? "excellent"
            : "healthy",

    score:
      clampScore(
        intelligence.score
      ),

    summary:
      cleanString(
        intelligence.explanation,
        2_000
      ) ||
      "Application health monitoring completed.",
  };
}

function getPlatformStatus(
  intelligence:
    HealthIntelligenceSummary
): OperationsPlatformStatus {
  if (
    intelligence.offlineServices >
      0 ||
    intelligence.criticalServices >
      0
  ) {
    return "critical";
  }

  if (
    intelligence.warningServices >
    0
  ) {
    return "attention";
  }

  switch (
    intelligence.grade
  ) {
    case "excellent":
      return "excellent";

    case "good":
      return "healthy";

    case "degraded":
      return "degraded";

    case "critical":
      return "critical";

    case "attention":
    default:
      return "attention";
  }
}

function getRiskLevel(
  intelligence:
    HealthIntelligenceSummary
): OperationsRiskLevel {
  if (
    intelligence.offlineServices >
      0 ||
    intelligence.criticalServices >
      0
  ) {
    return "critical";
  }

  if (
    intelligence.warningServices >
    0
  ) {
    return "moderate";
  }

  const percentage =
    safePercentage(
      intelligence
        .highestUsageMetric
        ?.percentage
    );

  if (
    percentage !== null &&
    percentage >=
      QUOTA_CRITICAL_PERCENTAGE
  ) {
    return "critical";
  }

  if (
    percentage !== null &&
    percentage >=
      QUOTA_HIGH_PERCENTAGE
  ) {
    return "high";
  }

  if (
    percentage !== null &&
    percentage >=
      QUOTA_WARNING_PERCENTAGE
  ) {
    return "moderate";
  }

  return intelligence.score >=
    95
    ? "none"
    : "low";
}

function buildPositiveSignals(
  intelligence:
    HealthIntelligenceSummary
): string[] {
  const signals: string[] =
    [];

  if (
    intelligence.healthyServices >
    0
  ) {
    signals.push(
      `${intelligence.healthyServices} monitored ${
        intelligence.healthyServices ===
        1
          ? "service is"
          : "services are"
      } currently healthy.`
    );
  }

  if (
    intelligence.criticalServices ===
      0 &&
    intelligence.offlineServices ===
      0
  ) {
    signals.push(
      "No monitored service is currently critical or offline."
    );
  }

  const usage =
    safePercentage(
      intelligence
        .highestUsageMetric
        ?.percentage
    );

  if (
    usage !== null &&
    usage <
      QUOTA_WARNING_PERCENTAGE
  ) {
    signals.push(
      "Available quota metrics remain below the operational warning threshold."
    );
  }

  const average =
    intelligence
      .averageResponseTimeMs;

  if (
    average !== null &&
    Number.isFinite(
      average
    ) &&
    average <
      RESPONSE_WARNING_MS
  ) {
    signals.push(
      `Average monitored response time remains below ${RESPONSE_WARNING_MS.toLocaleString(
        "en-GB"
      )} ms.`
    );
  }

  return signals.slice(
    0,
    AI_LIMITS
      .maxPositiveSignals
  );
}

function uniqueStrings(
  values: string[],
  maximum: number
): string[] {
  const seen =
    new Set<string>();

  const result:
    string[] = [];

  for (
    const raw of values
  ) {
    const value =
      cleanString(
        raw,
        2_500
      );

    if (!value) {
      continue;
    }

    const key =
      value.toLowerCase();

    if (
      seen.has(key)
    ) {
      continue;
    }

    seen.add(key);
    result.push(value);

    if (
      result.length >=
      maximum
    ) {
      break;
    }
  }

  return result;
}

function analyseResponseTrend(
  history:
    OperationsHistoryItem[]
): DeterministicTrend {
  const values =
    history
      .map(
        (item) =>
          item.response_time_ms
      )
      .filter(
        (
          value
        ): value is number =>
          typeof value ===
            "number" &&
          Number.isFinite(
            value
          )
      );

  if (
    values.length <
    PERFORMANCE_MINIMUM_HISTORY
  ) {
    return {
      direction:
        "uncertain",

      summary:
        "There is not yet enough response-time history for a reliable trend assessment.",

      confidence:
        30,
    };
  }

  const newest =
    values[0];

  const olderSample =
    values.slice(
      1,
      Math.min(
        values.length,
        6
      )
    );

  const olderAverage =
    olderSample.reduce(
      (total, value) =>
        total + value,
      0
    ) /
    olderSample.length;

  if (
    olderAverage <= 0
  ) {
    return {
      direction:
        "uncertain",

      summary:
        "Historical response-time values are insufficient for a reliable trend comparison.",

      confidence:
        35,
    };
  }

  const change =
    (
      newest -
      olderAverage
    ) /
    olderAverage;

  const percentage =
    Math.abs(
      change * 100
    );

  if (
    percentage < 15
  ) {
    return {
      direction:
        "stable",

      summary:
        `Latest response time is broadly stable compared with the recent historical average.`,

      confidence:
        clampConfidence(
          65 +
            Math.min(
              20,
              values.length * 2
            )
        ),
    };
  }

  if (
    change > 0
  ) {
    return {
      direction:
        "increasing",

      summary:
        `Latest response time is approximately ${percentage.toFixed(
          0
        )}% above the recent historical average.`,

      confidence:
        clampConfidence(
          65 +
            Math.min(
              20,
              values.length * 2
            )
        ),
    };
  }

  return {
    direction:
      "improving",

    summary:
      `Latest response time is approximately ${percentage.toFixed(
        0
      )}% below the recent historical average.`,

    confidence:
      clampConfidence(
        65 +
          Math.min(
            20,
            values.length * 2
          )
      ),
  };
}

function buildHistoricalChanges(
  history:
    OperationsHistoryItem[]
): string[] {
  if (
    history.length < 2
  ) {
    return [];
  }

  const changes:
    string[] = [];

  const latest =
    history[0];

  const previous =
    history[1];

  if (
    latest.overall_status &&
    previous.overall_status &&
    latest.overall_status !==
      previous.overall_status
  ) {
    changes.push(
      `Overall system status changed from ${previous.overall_status} to ${latest.overall_status}.`
    );
  }

  const trend =
    analyseResponseTrend(
      history
    );

  if (
    trend.direction !==
      "uncertain" &&
    trend.direction !==
      "stable"
  ) {
    changes.push(
      trend.summary
    );
  }

  return uniqueStrings(
    changes,
    12
  );
}

function buildFallbackPredictions(
  history:
    OperationsHistoryItem[],
  intelligence:
    HealthIntelligenceSummary
): AIOperationsAssessment["predictions"] {
  const trend =
    analyseResponseTrend(
      history
    );

  if (
    trend.direction ===
    "uncertain"
  ) {
    return [];
  }

  const risk:
    OperationsRiskLevel =
    trend.direction ===
      "increasing" &&
    (
      intelligence
        .averageResponseTimeMs ??
      0
    ) >=
      RESPONSE_WARNING_MS
      ? "moderate"
      : "low";

  return [
    {
      metric:
        "monitored_response_time",

      direction:
        trend.direction,

      summary:
        trend.summary,

      projected_risk:
        risk,

      confidence:
        trend.confidence,

      horizon:
        "next several health checks",
    },
  ].slice(
    0,
    AI_LIMITS
      .maxPredictions
  );
}

function buildFallbackAssessment(
  input:
    GenerateOperationsAssessmentInput
): AIOperationsAssessment {
  const intelligence =
    input.intelligence;

  const history =
    cleanHistory(
      input.history
    );

  const seriousIssue =
    intelligence.offlineServices >
      0 ||
    intelligence.criticalServices >
      0;

  const hasWarning =
    intelligence.warningServices >
    0;

  const findings =
    intelligence.findings.slice(
      0,
      AI_LIMITS
        .maxOperationalFindings
    );

  const recommendations =
    findings
      .filter(
        (finding) =>
          Boolean(
            finding.recommendation
          )
      )
      .slice(
        0,
        AI_LIMITS
          .maxRecommendations
      )
      .map(
        (finding) => ({
          priority:
            findingPriority(
              finding
            ),

          title:
            cleanString(
              finding.title,
              200
            ) ||
            "Operational recommendation",

          action:
            cleanString(
              finding.recommendation,
              1_500
            ) ||
            "Continue monitoring.",

          reason:
            cleanString(
              finding.message,
              1_500
            ) ||
            "Generated from deterministic monitoring evidence.",

          affected_area:
            cleanString(
              finding.category,
              120
            ) ||
            "operations",

          confidence:
            100,
        })
      );

  const watchList =
    uniqueStrings(
      findings
        .filter(
          (finding) =>
            finding.severity !==
            "info"
        )
        .map(
          (finding) =>
            finding.title
        ),
      AI_LIMITS
        .maxWatchListItems
    );

  return {
    executive_summary:
      cleanString(
        intelligence.explanation,
        3_000
      ) ||
      cleanString(
        intelligence.headline,
        1_000
      ) ||
      "Deterministic monitoring assessment completed.",

    platform_status:
      getPlatformStatus(
        intelligence
      ),

    risk_level:
      getRiskLevel(
        intelligence
      ),

    confidence:
      100,

    action_required:
      seriousIssue ||
      hasWarning,

    immediate_action:
      seriousIssue
        ? "Review critical and offline Operations Centre findings immediately."
        : hasWarning
          ? "Review warning findings and confirm whether they persist in subsequent health checks."
          : "No immediate operational intervention is required.",

    infrastructure:
      getInfrastructureAssessment(
        intelligence
      ),

    performance:
      getPerformanceAssessment(
        intelligence
      ),

    database:
      getDatabaseAssessment(
        input.snapshot,
        intelligence
      ),

    quota:
      getQuotaAssessment(
        intelligence
      ),

    application:
      getApplicationAssessment(
        intelligence
      ),

    what_changed:
      buildHistoricalChanges(
        history
      ),

    /**
     * Deterministic monitoring does not attempt speculative
     * root-cause attribution.
     */
    likely_causes: [],

    recommendations,

    predictions:
      buildFallbackPredictions(
        history,
        intelligence
      ),

    watch_list:
      watchList,

    positive_signals:
      buildPositiveSignals(
        intelligence
      ),
  };
}

function buildOperationsPayload(
  input:
    GenerateOperationsAssessmentInput
) {
  return {
    latest_snapshot:
      input.snapshot,

    deterministic_intelligence:
      input.intelligence,

    deterministic_history_analysis:
      {
        what_changed:
          buildHistoricalChanges(
            cleanHistory(
              input.history
            )
          ),

        response_time_trend:
          analyseResponseTrend(
            cleanHistory(
              input.history
            )
          ),
      },

    recent_history:
      cleanHistory(
        input.history
      ),
  };
}

function serializeInput(
  input:
    GenerateOperationsAssessmentInput
): string {
  const serialized =
    JSON.stringify(
      buildOperationsPayload(
        input
      ),
      null,
      2
    );

  return serialized.slice(
    0,
    AI_LIMITS
      .maxInputCharacters
  );
}

function validateAssessment(
  value: unknown
): AIOperationsAssessment | null {
  const validation =
    AIOperationsAssessmentSchema.safeParse(
      value
    );

  if (
    !validation.success
  ) {
    console.error(
      "Operations AI structured response failed validation:",
      validation.error.flatten()
    );

    return null;
  }

  return validation.data;
}

function reconcileAssessment(
  ai:
    AIOperationsAssessment,
  fallback:
    AIOperationsAssessment,
  input:
    GenerateOperationsAssessmentInput
): AIOperationsAssessment {
  const intelligence =
    input.intelligence;

  const hasCritical =
    intelligence.criticalServices >
      0 ||
    intelligence.offlineServices >
      0;

  const hasWarning =
    intelligence.warningServices >
    0;

  /**
   * AI may add interpretation, but it cannot downgrade
   * authoritative deterministic service severity.
   */
  const platformStatus:
    OperationsPlatformStatus =
    hasCritical
      ? "critical"
      : hasWarning &&
          (
            ai.platform_status ===
              "excellent" ||
            ai.platform_status ===
              "healthy"
          )
        ? "attention"
        : ai.platform_status;

  const riskLevel:
    OperationsRiskLevel =
    hasCritical
      ? "critical"
      : hasWarning &&
          (
            ai.risk_level ===
              "none" ||
            ai.risk_level ===
              "low"
          )
        ? "moderate"
        : ai.risk_level;

  const actionRequired =
    hasCritical ||
    hasWarning ||
    ai.action_required;

  const deterministicChanges =
    buildHistoricalChanges(
      cleanHistory(
        input.history
      )
    );

  return {
    ...ai,

    platform_status:
      platformStatus,

    risk_level:
      riskLevel,

    action_required:
      actionRequired,

    confidence:
      clampConfidence(
        ai.confidence
      ),

    infrastructure: {
      ...ai.infrastructure,
      score:
        clampScore(
          ai.infrastructure.score
        ),
    },

    performance: {
      ...ai.performance,
      score:
        clampScore(
          ai.performance.score
        ),
    },

    database: {
      ...ai.database,
      score:
        clampScore(
          ai.database.score
        ),
    },

    quota: {
      ...ai.quota,
      score:
        clampScore(
          ai.quota.score
        ),
    },

    application: {
      ...ai.application,
      score:
        clampScore(
          ai.application.score
        ),
    },

    what_changed:
      deterministicChanges
        .length > 0
        ? uniqueStrings(
            [
              ...deterministicChanges,
              ...ai.what_changed,
            ],
            12
          )
        : [],

    recommendations:
      ai.recommendations.slice(
        0,
        AI_LIMITS
          .maxRecommendations
      ),

    predictions:
      ai.predictions.slice(
        0,
        AI_LIMITS
          .maxPredictions
      ),

    likely_causes:
      ai.likely_causes.slice(
        0,
        AI_LIMITS
          .maxLikelyCauses
      ),

    watch_list:
      uniqueStrings(
        ai.watch_list,
        AI_LIMITS
          .maxWatchListItems
      ),

    positive_signals:
      uniqueStrings(
        [
          ...fallback
            .positive_signals,
          ...ai
            .positive_signals,
        ],
        AI_LIMITS
          .maxPositiveSignals
      ),
  };
}

export async function generateOperationsAssessment(
  input:
    GenerateOperationsAssessmentInput
): Promise<AIOperationsResult> {
  const startedAt =
    Date.now();

  const generatedAt =
    new Date().toISOString();

  const fallback =
    buildFallbackAssessment(
      input
    );

  /**
   * Without a live snapshot, deterministic output is safer
   * than asking the model to reason about incomplete state.
   */
  if (!input.snapshot) {
    return {
      ok: true,

      source:
        "deterministic_fallback",

      assessment:
        fallback,

      model:
        null,

      generated_at:
        generatedAt,

      response_id:
        null,

      request_id:
        null,

      duration_ms:
        Date.now() -
        startedAt,

      error:
        "No system health snapshot was available for AI analysis.",
    };
  }

  if (
    !isOpenAIConfigured()
  ) {
    return {
      ok: true,

      source:
        "deterministic_fallback",

      assessment:
        fallback,

      model:
        null,

      generated_at:
        generatedAt,

      response_id:
        null,

      request_id:
        null,

      duration_ms:
        Date.now() -
        startedAt,

      error:
        "OPENAI_API_KEY is not configured.",
    };
  }

  const model =
    getAIModel(
      "operations"
    );

  const reasoningEffort =
    getAIReasoningEffort(
      "operations"
    );

  try {
    const openai =
      getOpenAIClient();

    const response =
      await openai.responses.parse({
        model,

        /**
         * Operations snapshots contain internal monitoring
         * context and should not be persisted by default.
         */
        store: false,

        reasoning: {
          effort:
            reasoningEffort,
        },

        max_output_tokens:
          AI_LIMITS
            .operationsMaxOutputTokens,

        input: [
          {
            role:
              "system",

            content:
              OPERATIONS_SYSTEM_PROMPT,
          },

          {
            role:
              "user",

            content: `
${OPERATIONS_ANALYSIS_PROMPT}

OPERATIONS DATA

${serializeInput(input)}
            `.trim(),
          },
        ],

        text: {
          format:
            zodTextFormat(
              AIOperationsAssessmentSchema,
              "salahnearme_operations_assessment"
            ),
        },
      });

    const parsed =
      validateAssessment(
        response.output_parsed
      );

    if (!parsed) {
      return {
        ok: true,

        source:
          "deterministic_fallback",

        assessment:
          fallback,

        model,

        generated_at:
          generatedAt,

        response_id:
          response.id ??
          null,

        request_id:
          response._request_id ??
          null,

        duration_ms:
          Date.now() -
          startedAt,

        error:
          "OpenAI returned no valid structured Operations Centre assessment.",
      };
    }

    const reconciled =
      reconcileAssessment(
        parsed,
        fallback,
        input
      );

    return {
      ok: true,

      source:
        "openai",

      assessment:
        reconciled,

      model:
        response.model ??
        model,

      generated_at:
        generatedAt,

      response_id:
        response.id ??
        null,

      request_id:
        response._request_id ??
        null,

      duration_ms:
        Date.now() -
        startedAt,
    };
  } catch (error) {
    console.error(
      "Operations AI assessment failed:",
      error
    );

    return {
      ok: true,

      source:
        "deterministic_fallback",

      assessment:
        fallback,

      model,

      generated_at:
        generatedAt,

      response_id:
        null,

      request_id:
        null,

      duration_ms:
        Date.now() -
        startedAt,

      error:
        error instanceof Error
          ? cleanString(
              error.message,
              1_500
            ) ||
            "AI Operations assessment failed."
          : "AI Operations assessment failed.",
    };
  }
}