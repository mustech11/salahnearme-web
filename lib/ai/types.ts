import { z } from "zod";

/**
 * Shared primitive constraints.
 */

const SHORT_TEXT_MAX = 300;
const SUMMARY_MAX = 2_500;
const ACTION_MAX = 2_000;
const EVIDENCE_MAX = 1_000;

const MAX_RECOMMENDATIONS = 8;
const MAX_PREDICTIONS = 6;
const MAX_CAUSES = 8;
const MAX_CHANGE_ITEMS = 12;
const MAX_WATCH_ITEMS = 12;
const MAX_POSITIVE_SIGNALS = 12;
const MAX_CAUSE_EVIDENCE = 8;

const boundedText = (
  maxLength: number
) =>
  z
    .string()
    .trim()
    .min(1)
    .max(maxLength);

export const OperationsRiskLevelSchema =
  z.enum([
    "none",
    "low",
    "moderate",
    "high",
    "critical",
  ]);

export type OperationsRiskLevel =
  z.infer<
    typeof OperationsRiskLevelSchema
  >;

export const OperationsConfidenceSchema =
  z
    .number()
    .finite()
    .min(0)
    .max(100);

export const OperationsScoreSchema =
  z
    .number()
    .finite()
    .min(0)
    .max(100);

export const OperationsPrioritySchema =
  z.enum([
    "monitor",
    "low",
    "medium",
    "high",
    "urgent",
  ]);

export type OperationsPriority =
  z.infer<
    typeof OperationsPrioritySchema
  >;

export const OperationsAreaStatusSchema =
  z.enum([
    "excellent",
    "healthy",
    "attention",
    "degraded",
    "critical",
    "unknown",
  ]);

export type OperationsAreaStatus =
  z.infer<
    typeof OperationsAreaStatusSchema
  >;

export const OperationsPlatformStatusSchema =
  z.enum([
    "excellent",
    "healthy",
    "attention",
    "degraded",
    "critical",
  ]);

export type OperationsPlatformStatus =
  z.infer<
    typeof OperationsPlatformStatusSchema
  >;

export const OperationsTrendDirectionSchema =
  z.enum([
    "improving",
    "stable",
    "increasing",
    "decreasing",
    "uncertain",
  ]);

export type OperationsTrendDirection =
  z.infer<
    typeof OperationsTrendDirectionSchema
  >;

export const OperationsRecommendationSchema =
  z
    .object({
      priority:
        OperationsPrioritySchema,

      title:
        boundedText(
          SHORT_TEXT_MAX
        ),

      action:
        boundedText(
          ACTION_MAX
        ),

      reason:
        boundedText(
          ACTION_MAX
        ),

      affected_area:
        boundedText(
          160
        ),

      confidence:
        OperationsConfidenceSchema,
    })
    .strict();

export type OperationsRecommendation =
  z.infer<
    typeof OperationsRecommendationSchema
  >;

export const OperationsPredictionSchema =
  z
    .object({
      metric:
        boundedText(
          200
        ),

      direction:
        OperationsTrendDirectionSchema,

      summary:
        boundedText(
          SUMMARY_MAX
        ),

      projected_risk:
        OperationsRiskLevelSchema,

      confidence:
        OperationsConfidenceSchema,

      horizon:
        boundedText(
          200
        ),
    })
    .strict();

export type OperationsPrediction =
  z.infer<
    typeof OperationsPredictionSchema
  >;

export const OperationsCauseSchema =
  z
    .object({
      cause:
        boundedText(
          SUMMARY_MAX
        ),

      confidence:
        OperationsConfidenceSchema,

      evidence:
        z
          .array(
            boundedText(
              EVIDENCE_MAX
            )
          )
          .max(
            MAX_CAUSE_EVIDENCE
          ),
    })
    .strict();

export type OperationsCause =
  z.infer<
    typeof OperationsCauseSchema
  >;

export const OperationsAreaAssessmentSchema =
  z
    .object({
      status:
        OperationsAreaStatusSchema,

      score:
        OperationsScoreSchema,

      summary:
        boundedText(
          SUMMARY_MAX
        ),
    })
    .strict();

export type OperationsAreaAssessment =
  z.infer<
    typeof OperationsAreaAssessmentSchema
  >;

export const AIOperationsAssessmentSchema =
  z
    .object({
      executive_summary:
        boundedText(
          4_000
        ),

      platform_status:
        OperationsPlatformStatusSchema,

      risk_level:
        OperationsRiskLevelSchema,

      confidence:
        OperationsConfidenceSchema,

      action_required:
        z.boolean(),

      immediate_action:
        boundedText(
          ACTION_MAX
        ),

      infrastructure:
        OperationsAreaAssessmentSchema,

      performance:
        OperationsAreaAssessmentSchema,

      database:
        OperationsAreaAssessmentSchema,

      quota:
        OperationsAreaAssessmentSchema,

      application:
        OperationsAreaAssessmentSchema,

      what_changed:
        z
          .array(
            boundedText(
              SUMMARY_MAX
            )
          )
          .max(
            MAX_CHANGE_ITEMS
          ),

      likely_causes:
        z
          .array(
            OperationsCauseSchema
          )
          .max(
            MAX_CAUSES
          ),

      recommendations:
        z
          .array(
            OperationsRecommendationSchema
          )
          .max(
            MAX_RECOMMENDATIONS
          ),

      predictions:
        z
          .array(
            OperationsPredictionSchema
          )
          .max(
            MAX_PREDICTIONS
          ),

      watch_list:
        z
          .array(
            boundedText(
              SUMMARY_MAX
            )
          )
          .max(
            MAX_WATCH_ITEMS
          ),

      positive_signals:
        z
          .array(
            boundedText(
              SUMMARY_MAX
            )
          )
          .max(
            MAX_POSITIVE_SIGNALS
          ),
    })
    .strict();

export type AIOperationsAssessment =
  z.infer<
    typeof AIOperationsAssessmentSchema
  >;

export type AIOperationsSource =
  | "openai"
  | "deterministic_fallback";

export type AIOperationsResult = {
  ok: boolean;

  source:
    AIOperationsSource;

  assessment:
    AIOperationsAssessment;

  model:
    string | null;

  generated_at:
    string;

  response_id:
    string | null;

  /**
   * OpenAI request identifier where available.
   * Useful when investigating provider-side API errors.
   */
  request_id?:
    string | null;

  duration_ms?:
    number | null;

  error?:
    string;
};