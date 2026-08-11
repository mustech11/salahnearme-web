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
} from "@/lib/ai/models";

import {
  OPERATIONS_SYSTEM_PROMPT,
} from "@/lib/ai/prompts";

import {
  AIOperationsAssessmentSchema,
  type AIOperationsAssessment,
  type AIOperationsResult,
} from "@/lib/ai/types";

import type {
  SystemHealthSnapshot,
} from "@/lib/systemHealthTypes";

import type {
  HealthIntelligenceSummary,
} from "@/lib/systemHealthIntelligence";

export type OperationsHistoryItem = {
  overall_status: string;
  response_time_ms: number | null;
  checked_at: string;

  services?: Array<{
    key?: string;
    label?: string;
    status?: string;
    response_time_ms?: number | null;
  }>;

  usage?: Array<{
    key?: string;
    label?: string;
    percentage?: number | null;
  }>;
};

export type GenerateOperationsAssessmentInput = {
  snapshot:
    | SystemHealthSnapshot
    | null;

  intelligence:
    HealthIntelligenceSummary;

  history?: OperationsHistoryItem[];
};

function cleanHistory(
  history:
    | OperationsHistoryItem[]
    | undefined
): OperationsHistoryItem[] {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .slice(
      0,
      AI_LIMITS.operationsHistorySnapshots
    )
    .map((item) => ({
      overall_status:
        typeof item.overall_status === "string"
          ? item.overall_status.slice(0, 50)
          : "unknown",

      response_time_ms:
        typeof item.response_time_ms === "number" &&
        Number.isFinite(
          item.response_time_ms
        )
          ? Math.max(
              0,
              Math.round(
                item.response_time_ms
              )
            )
          : null,

      checked_at:
        typeof item.checked_at === "string"
          ? item.checked_at.slice(
              0,
              100
            )
          : "",

      services:
        Array.isArray(item.services)
          ? item.services
              .slice(0, 30)
              .map((service) => ({
                key:
                  typeof service.key ===
                  "string"
                    ? service.key.slice(
                        0,
                        120
                      )
                    : undefined,

                label:
                  typeof service.label ===
                  "string"
                    ? service.label.slice(
                        0,
                        160
                      )
                    : undefined,

                status:
                  typeof service.status ===
                  "string"
                    ? service.status.slice(
                        0,
                        50
                      )
                    : undefined,

                response_time_ms:
                  typeof service.response_time_ms ===
                    "number" &&
                  Number.isFinite(
                    service.response_time_ms
                  )
                    ? Math.max(
                        0,
                        Math.round(
                          service.response_time_ms
                        )
                      )
                    : null,
              }))
          : [],

      usage:
        Array.isArray(item.usage)
          ? item.usage
              .slice(0, 30)
              .map((metric) => ({
                key:
                  typeof metric.key ===
                  "string"
                    ? metric.key.slice(
                        0,
                        120
                      )
                    : undefined,

                label:
                  typeof metric.label ===
                  "string"
                    ? metric.label.slice(
                        0,
                        160
                      )
                    : undefined,

                percentage:
                  typeof metric.percentage ===
                    "number" &&
                  Number.isFinite(
                    metric.percentage
                  )
                    ? Math.max(
                        0,
                        Math.min(
                          100,
                          metric.percentage
                        )
                      )
                    : null,
              }))
          : [],
    }));
}

function buildFallbackAssessment(
  intelligence:
    HealthIntelligenceSummary
): AIOperationsAssessment {
  const hasSeriousIssue =
    intelligence.criticalServices > 0 ||
    intelligence.offlineServices > 0;

  const hasWarning =
    intelligence.warningServices > 0;

  const status:
    AIOperationsAssessment["platform_status"] =
    hasSeriousIssue
      ? "critical"
      : hasWarning
        ? "attention"
        : intelligence.grade ===
            "excellent"
          ? "excellent"
          : "healthy";

  const riskLevel:
    AIOperationsAssessment["risk_level"] =
    hasSeriousIssue
      ? "critical"
      : hasWarning
        ? "moderate"
        : "low";

  const findings =
    intelligence.findings.slice(
      0,
      AI_LIMITS.maxOperationalFindings
    );

  return {
    executive_summary:
      intelligence.explanation,

    platform_status: status,

    risk_level: riskLevel,

    confidence: 100,

    action_required:
      hasSeriousIssue ||
      hasWarning,

    immediate_action:
      hasSeriousIssue
        ? "Review the critical Operations Centre findings immediately."
        : hasWarning
          ? "Review the warning findings and monitor the next health check."
          : "No immediate operational action is required.",

    infrastructure: {
      status:
        hasSeriousIssue
          ? "critical"
          : hasWarning
            ? "attention"
            : "healthy",

      score:
        intelligence.score,

      summary:
        intelligence.headline,
    },

    performance: {
      status:
        intelligence.averageResponseTimeMs !==
          null &&
        intelligence.averageResponseTimeMs >=
          5_000
          ? "critical"
          : intelligence.averageResponseTimeMs !==
                null &&
              intelligence.averageResponseTimeMs >=
                1_500
            ? "attention"
            : "healthy",

      score:
        intelligence.score,

      summary:
        intelligence.averageResponseTimeMs ===
        null
          ? "No response-time assessment is available."
          : `Average monitored response time is ${intelligence.averageResponseTimeMs} ms.`,
    },

    database: {
      status:
        hasSeriousIssue
          ? "attention"
          : "healthy",

      score:
        intelligence.score,

      summary:
        "Database health follows the deterministic monitoring evidence.",
    },

    quota: {
      status:
        intelligence.highestUsageMetric
          ?.percentage !== null &&
        intelligence.highestUsageMetric
          ?.percentage !== undefined &&
        intelligence.highestUsageMetric
          .percentage >= 95
          ? "critical"
          : intelligence.highestUsageMetric
                ?.percentage !== null &&
              intelligence.highestUsageMetric
                ?.percentage !==
                undefined &&
              intelligence.highestUsageMetric
                .percentage >= 70
            ? "attention"
            : "healthy",

      score:
        intelligence.score,

      summary:
        intelligence.highestUsageMetric
          ?.percentage === null ||
        intelligence.highestUsageMetric
          ?.percentage === undefined
          ? "No material quota pressure was identified from available metrics."
          : `${intelligence.highestUsageMetric.label} is the highest reported usage metric at ${intelligence.highestUsageMetric.percentage}%.`,
    },

    application: {
      status:
        hasSeriousIssue
          ? "critical"
          : hasWarning
            ? "attention"
            : "healthy",

      score:
        intelligence.score,

      summary:
        intelligence.explanation,
    },

    what_changed: [],

    likely_causes: [],

    recommendations:
      findings
        .filter(
          (finding) =>
            Boolean(
              finding.recommendation
            )
        )
        .slice(
          0,
          AI_LIMITS.maxRecommendations
        )
        .map((finding) => ({
          priority:
            finding.severity ===
              "critical"
              ? "urgent"
              : finding.severity ===
                  "high"
                ? "high"
                : finding.severity ===
                    "medium"
                  ? "medium"
                  : "monitor",

          title:
            finding.title,

          action:
            finding.recommendation ??
            "Continue monitoring.",

          reason:
            finding.message,

          affected_area:
            finding.category,

          confidence: 100,
        })),

    predictions: [],

    watch_list:
      findings
        .filter(
          (finding) =>
            finding.severity !==
            "info"
        )
        .slice(0, 8)
        .map(
          (finding) =>
            finding.title
        ),

    positive_signals:
      intelligence.healthyServices > 0
        ? [
            `${intelligence.healthyServices} monitored services are healthy.`,
          ]
        : [],
  };
}

function serializeInput(
  input:
    GenerateOperationsAssessmentInput
): string {
  const payload = {
    latest_snapshot:
      input.snapshot,

    deterministic_intelligence:
      input.intelligence,

    recent_history:
      cleanHistory(
        input.history
      ),
  };

  const serialized =
    JSON.stringify(
      payload,
      null,
      2
    );

  return serialized.slice(
    0,
    AI_LIMITS.maxInputCharacters
  );
}

export async function generateOperationsAssessment(
  input:
    GenerateOperationsAssessmentInput
): Promise<AIOperationsResult> {
  const generatedAt =
    new Date().toISOString();

  const fallback =
    buildFallbackAssessment(
      input.intelligence
    );

  if (!isOpenAIConfigured()) {
    return {
      ok: true,
      source:
        "deterministic_fallback",
      assessment: fallback,
      model: null,
      generated_at:
        generatedAt,
      response_id: null,
      error:
        "OPENAI_API_KEY is not configured.",
    };
  }

  const model =
    getAIModel("operations");

  try {
    const openai =
      getOpenAIClient();

    const response =
      await openai.responses.parse({
        model,

        store: false,

        reasoning: {
          effort: "low",
        },

        input: [
          {
            role: "system",
            content:
              OPERATIONS_SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: `
Analyse the following SalahNearMe Operations Centre data.

The deterministic intelligence is authoritative.
Use recent history only to identify meaningful changes or trends.

Do not invent missing information.

If historical evidence is insufficient for forecasting,
return an uncertain or empty prediction rather than guessing.

OPERATIONS DATA:

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
      response.output_parsed;

    if (!parsed) {
      return {
        ok: true,
        source:
          "deterministic_fallback",
        assessment: fallback,
        model,
        generated_at:
          generatedAt,
        response_id:
          response.id ?? null,
        error:
          "OpenAI returned no structured assessment.",
      };
    }

    return {
      ok: true,
      source: "openai",
      assessment: parsed,
      model,
      generated_at:
        generatedAt,
      response_id:
        response.id ?? null,
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
      assessment: fallback,
      model,
      generated_at:
        generatedAt,
      response_id: null,
      error:
        error instanceof Error
          ? error.message
          : "AI Operations assessment failed.",
    };
  }
}