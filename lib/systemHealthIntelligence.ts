import type {
  HealthSeverity,
  ServiceCheck,
  SystemHealthSnapshot,
  UsageMetric,
} from "@/lib/systemHealthTypes";

export const INTELLIGENCE_SEVERITIES = [
  "info",
  "low",
  "medium",
  "high",
  "critical",
] as const;

export type IntelligenceSeverity =
  (typeof INTELLIGENCE_SEVERITIES)[number];

export type IntelligenceCategory =
  | "availability"
  | "performance"
  | "quota"
  | "trend"
  | "configuration"
  | "recovery";

export type IntelligenceFinding = {
  id: string;
  title: string;
  message: string;
  severity: IntelligenceSeverity;
  category: IntelligenceCategory;
  serviceKey?: string;
  recommendation?: string;
  evidence?: Record<
    string,
    string | number | boolean | null
  >;
};

export type IntelligenceGrade =
  | "excellent"
  | "good"
  | "attention"
  | "degraded"
  | "critical";

export type HealthIntelligenceSummary = {
  score: number;
  grade: IntelligenceGrade;
  headline: string;
  explanation: string;
  findings: IntelligenceFinding[];
  healthyServices: number;
  warningServices: number;
  criticalServices: number;
  offlineServices: number;
  totalServices: number;
  slowestService: ServiceCheck | null;
  averageResponseTimeMs: number | null;
  highestUsageMetric: UsageMetric | null;
  generatedAt: string;
};

const HEALTHY_SCORE = 100;

const STATUS_DEDUCTIONS: Record<
  HealthSeverity,
  number
> = {
  healthy: 0,
  warning: 8,
  critical: 24,
  offline: 40,
};

const RESPONSE_WARNING_MS = 1_500;
const RESPONSE_CRITICAL_MS = 5_000;

const USAGE_WARNING_PERCENTAGE = 70;
const USAGE_HIGH_PERCENTAGE = 85;
const USAGE_CRITICAL_PERCENTAGE = 95;

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

function safeResponseTime(
  value: unknown
): number | null {
  const parsed = safeNumber(value);

  if (
    parsed === null ||
    parsed < 0
  ) {
    return null;
  }

  return Math.round(parsed);
}

function safePercentage(
  value: unknown
): number | null {
  const parsed = safeNumber(value);

  if (
    parsed === null ||
    parsed < 0
  ) {
    return null;
  }

  return Math.min(
    100,
    Math.round(parsed * 10) / 10
  );
}

function buildFindingId(
  category: IntelligenceCategory,
  entityKey: string,
  suffix: string
): string {
  return [
    category,
    entityKey || "system",
    suffix,
  ]
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

function getGrade(
  score: number
): IntelligenceGrade {
  if (score >= 95) {
    return "excellent";
  }

  if (score >= 85) {
    return "good";
  }

  if (score >= 70) {
    return "attention";
  }

  if (score >= 45) {
    return "degraded";
  }

  return "critical";
}

function getHeadline(
  grade: IntelligenceGrade
): string {
  switch (grade) {
    case "excellent":
      return "All monitored systems are operating normally.";

    case "good":
      return "The platform is healthy with minor observations.";

    case "attention":
      return "The platform is available, but some areas need attention.";

    case "degraded":
      return "Important services are degraded and require investigation.";

    case "critical":
      return "Critical platform services require immediate attention.";
  }
}

function getExplanation(
  grade: IntelligenceGrade,
  warningServices: number,
  criticalServices: number,
  offlineServices: number,
  findingsCount: number
): string {
  if (
    grade === "excellent" &&
    findingsCount <= 1
  ) {
    return "No material availability, performance or quota problems were detected in the latest check.";
  }

  const issues: string[] = [];

  if (warningServices > 0) {
    issues.push(
      `${warningServices} warning ${
        warningServices === 1
          ? "service"
          : "services"
      }`
    );
  }

  if (criticalServices > 0) {
    issues.push(
      `${criticalServices} critical ${
        criticalServices === 1
          ? "service"
          : "services"
      }`
    );
  }

  if (offlineServices > 0) {
    issues.push(
      `${offlineServices} offline ${
        offlineServices === 1
          ? "service"
          : "services"
      }`
    );
  }

  if (issues.length > 0) {
    return `The latest check detected ${issues.join(
      ", "
    )}. Review the findings before they affect users.`;
  }

  return findingsCount > 0
    ? "The platform is operating, but the intelligence engine detected observations that should be reviewed."
    : "The latest check completed without enough information to produce a full assessment.";
}

function analyseService(
  service: ServiceCheck
): IntelligenceFinding[] {
  const findings: IntelligenceFinding[] = [];

  const serviceKey =
    cleanText(service.key, 120) ||
    "unknown";

  const label =
    cleanText(service.label, 160) ||
    serviceKey;

  const message =
    cleanText(service.message, 1_000);

  if (service.status === "offline") {
    findings.push({
      id: buildFindingId(
        "availability",
        serviceKey,
        "offline"
      ),
      title: `${label} is offline`,
      message:
        message ||
        `${label} did not respond during the latest health check.`,
      severity: "critical",
      category: "availability",
      serviceKey,
      recommendation:
        "Check provider status, credentials, network connectivity and recent deployments immediately.",
      evidence: {
        status: service.status,
        response_time_ms:
          safeResponseTime(
            service.response_time_ms
          ),
      },
    });
  } else if (
    service.status === "critical"
  ) {
    findings.push({
      id: buildFindingId(
        "availability",
        serviceKey,
        "critical"
      ),
      title: `${label} is critically degraded`,
      message:
        message ||
        `${label} returned a critical health state.`,
      severity: "high",
      category: "availability",
      serviceKey,
      recommendation:
        "Investigate this service immediately and review related platform logs.",
      evidence: {
        status: service.status,
        response_time_ms:
          safeResponseTime(
            service.response_time_ms
          ),
      },
    });
  } else if (
    service.status === "warning"
  ) {
    findings.push({
      id: buildFindingId(
        "availability",
        serviceKey,
        "warning"
      ),
      title: `${label} needs attention`,
      message:
        message ||
        `${label} returned a warning health state.`,
      severity: "medium",
      category: "availability",
      serviceKey,
      recommendation:
        "Review the service response and confirm the warning does not represent a developing incident.",
      evidence: {
        status: service.status,
        response_time_ms:
          safeResponseTime(
            service.response_time_ms
          ),
      },
    });
  }

  const responseTime =
    safeResponseTime(
      service.response_time_ms
    );

  if (
    responseTime !== null &&
    responseTime >= RESPONSE_CRITICAL_MS
  ) {
    findings.push({
      id: buildFindingId(
        "performance",
        serviceKey,
        "critical-latency"
      ),
      title: `${label} is responding very slowly`,
      message: `${label} took ${responseTime.toLocaleString(
        "en-GB"
      )} ms to respond.`,
      severity: "high",
      category: "performance",
      serviceKey,
      recommendation:
        "Review database queries, external API latency, cold starts and deployment performance.",
      evidence: {
        response_time_ms:
          responseTime,
        critical_threshold_ms:
          RESPONSE_CRITICAL_MS,
      },
    });
  } else if (
    responseTime !== null &&
    responseTime >= RESPONSE_WARNING_MS
  ) {
    findings.push({
      id: buildFindingId(
        "performance",
        serviceKey,
        "slow-response"
      ),
      title: `${label} response time is elevated`,
      message: `${label} took ${responseTime.toLocaleString(
        "en-GB"
      )} ms to respond.`,
      severity: "medium",
      category: "performance",
      serviceKey,
      recommendation:
        "Monitor the next few checks and investigate if response time continues to rise.",
      evidence: {
        response_time_ms:
          responseTime,
        warning_threshold_ms:
          RESPONSE_WARNING_MS,
      },
    });
  }

  return findings;
}

function analyseUsageMetric(
  metric: UsageMetric
): IntelligenceFinding[] {
  const percentage =
    safePercentage(
      metric.percentage
    );

  if (percentage === null) {
    return [];
  }

  const metricKey =
    cleanText(metric.key, 120) ||
    "unknown-metric";

  const label =
    cleanText(metric.label, 160) ||
    metricKey;

  if (
    percentage >=
    USAGE_CRITICAL_PERCENTAGE
  ) {
    return [
      {
        id: buildFindingId(
          "quota",
          metricKey,
          "critical"
        ),
        title: `${label} is close to its limit`,
        message: `${label} usage has reached ${percentage.toFixed(
          1
        )}%.`,
        severity: "critical",
        category: "quota",
        recommendation:
          "Reduce usage immediately, remove unnecessary data or increase the available quota.",
        evidence: {
          percentage,
          used: metric.used,
          limit: metric.limit,
          estimated: metric.estimated,
        },
      },
    ];
  }

  if (
    percentage >=
    USAGE_HIGH_PERCENTAGE
  ) {
    return [
      {
        id: buildFindingId(
          "quota",
          metricKey,
          "high"
        ),
        title: `${label} usage is high`,
        message: `${label} usage has reached ${percentage.toFixed(
          1
        )}%.`,
        severity: "high",
        category: "quota",
        recommendation:
          "Review growth and create capacity before the quota reaches a critical level.",
        evidence: {
          percentage,
          used: metric.used,
          limit: metric.limit,
          estimated: metric.estimated,
        },
      },
    ];
  }

  if (
    percentage >=
    USAGE_WARNING_PERCENTAGE
  ) {
    return [
      {
        id: buildFindingId(
          "quota",
          metricKey,
          "warning"
        ),
        title: `${label} usage is increasing`,
        message: `${label} usage has reached ${percentage.toFixed(
          1
        )}%.`,
        severity: "medium",
        category: "quota",
        recommendation:
          "Monitor this metric and review expected growth before it exceeds 85%.",
        evidence: {
          percentage,
          used: metric.used,
          limit: metric.limit,
          estimated: metric.estimated,
        },
      },
    ];
  }

  return [];
}

function getHighestUsageMetric(
  metrics: UsageMetric[]
): UsageMetric | null {
  let highest: UsageMetric | null =
    null;

  let highestPercentage = -1;

  for (const metric of metrics) {
    const percentage =
      safePercentage(
        metric.percentage
      );

    if (
      percentage !== null &&
      percentage > highestPercentage
    ) {
      highest = metric;
      highestPercentage =
        percentage;
    }
  }

  return highest;
}

export function analyseSystemHealth(
  snapshot: SystemHealthSnapshot | null
): HealthIntelligenceSummary {
  const generatedAt =
    new Date().toISOString();

  if (!snapshot) {
    return {
      score: 0,
      grade: "critical",
      headline:
        "No system health snapshot is available.",
      explanation:
        "Run a lightweight or daily health check to generate operational intelligence.",
      findings: [
        {
          id: "system-no-snapshot",
          title:
            "No monitoring data available",
          message:
            "The Operations Centre has not received a system health snapshot.",
          severity: "high",
          category: "configuration",
          recommendation:
            "Run the first health check from the Operations Centre.",
        },
      ],
      healthyServices: 0,
      warningServices: 0,
      criticalServices: 0,
      offlineServices: 0,
      totalServices: 0,
      slowestService: null,
      averageResponseTimeMs: null,
      highestUsageMetric: null,
      generatedAt,
    };
  }

  const services =
    Array.isArray(snapshot.services)
      ? snapshot.services
      : [];

  const usage =
    Array.isArray(snapshot.usage)
      ? snapshot.usage
      : [];

  let score = HEALTHY_SCORE;

  let healthyServices = 0;
  let warningServices = 0;
  let criticalServices = 0;
  let offlineServices = 0;

  const responseTimes: number[] = [];

  const findings: IntelligenceFinding[] =
    [];

  let slowestService: ServiceCheck | null =
    null;

  for (const service of services) {
    score -=
      STATUS_DEDUCTIONS[
        service.status
      ] ?? 10;

    switch (service.status) {
      case "healthy":
        healthyServices += 1;
        break;

      case "warning":
        warningServices += 1;
        break;

      case "critical":
        criticalServices += 1;
        break;

      case "offline":
        offlineServices += 1;
        break;
    }

    const responseTime =
      safeResponseTime(
        service.response_time_ms
      );

    if (responseTime !== null) {
      responseTimes.push(responseTime);

      const currentSlowest =
        slowestService
          ? safeResponseTime(
              slowestService.response_time_ms
            )
          : null;

      if (
        currentSlowest === null ||
        responseTime >
          currentSlowest
      ) {
        slowestService =
          service;
      }
    }

    findings.push(
      ...analyseService(service)
    );
  }

  for (const metric of usage) {
    const metricFindings =
      analyseUsageMetric(metric);

    findings.push(
      ...metricFindings
    );

    for (
      const finding of metricFindings
    ) {
      if (
        finding.severity ===
        "critical"
      ) {
        score -= 20;
      } else if (
        finding.severity ===
        "high"
      ) {
        score -= 12;
      } else if (
        finding.severity ===
        "medium"
      ) {
        score -= 5;
      }
    }
  }

  if (
    snapshot.overall_status ===
    "warning"
  ) {
    score -= 5;
  } else if (
    snapshot.overall_status ===
    "critical"
  ) {
    score -= 15;
  } else if (
    snapshot.overall_status ===
    "offline"
  ) {
    score -= 30;
  }

  if (
    services.length === 0
  ) {
    score -= 35;

    findings.push({
      id: "configuration-no-services",
      title:
        "No monitored services were returned",
      message:
        "The snapshot contains no service health results.",
      severity: "high",
      category: "configuration",
      recommendation:
        "Review the monitoring collector and confirm service checks are enabled.",
    });
  }

  const safeScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(score)
    )
  );

  const grade =
    getGrade(safeScore);

  const averageResponseTimeMs =
    responseTimes.length > 0
      ? Math.round(
          responseTimes.reduce(
            (
              total,
              value
            ) =>
              total + value,
            0
          ) /
            responseTimes.length
        )
      : null;

  if (findings.length === 0) {
    findings.push({
      id:
        "system-all-services-healthy",
      title:
        "No active operational problems detected",
      message:
        "All monitored services and available quota metrics reported healthy states.",
      severity: "info",
      category: "recovery",
      recommendation:
        "Continue normal daily monitoring.",
    });
  }

  const severityOrder: Record<
    IntelligenceSeverity,
    number
  > = {
    critical: 5,
    high: 4,
    medium: 3,
    low: 2,
    info: 1,
  };

  findings.sort(
    (first, second) =>
      severityOrder[
        second.severity
      ] -
      severityOrder[
        first.severity
      ]
  );

  return {
    score: safeScore,
    grade,
    headline:
      getHeadline(grade),
    explanation:
      getExplanation(
        grade,
        warningServices,
        criticalServices,
        offlineServices,
        findings.length
      ),
    findings,
    healthyServices,
    warningServices,
    criticalServices,
    offlineServices,
    totalServices:
      services.length,
    slowestService,
    averageResponseTimeMs,
    highestUsageMetric:
      getHighestUsageMetric(
        usage
      ),
    generatedAt,
  };
}