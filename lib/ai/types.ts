import { z } from "zod";

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
  z.number().min(0).max(100);

export const OperationsRecommendationSchema =
  z.object({
    priority: z.enum([
      "monitor",
      "low",
      "medium",
      "high",
      "urgent",
    ]),

    title: z.string(),

    action: z.string(),

    reason: z.string(),

    affected_area: z.string(),

    confidence: OperationsConfidenceSchema,
  });

export type OperationsRecommendation =
  z.infer<
    typeof OperationsRecommendationSchema
  >;

export const OperationsPredictionSchema =
  z.object({
    metric: z.string(),

    direction: z.enum([
      "improving",
      "stable",
      "increasing",
      "decreasing",
      "uncertain",
    ]),

    summary: z.string(),

    projected_risk: OperationsRiskLevelSchema,

    confidence: OperationsConfidenceSchema,

    horizon: z.string(),
  });

export type OperationsPrediction =
  z.infer<
    typeof OperationsPredictionSchema
  >;

export const OperationsCauseSchema =
  z.object({
    cause: z.string(),

    confidence: OperationsConfidenceSchema,

    evidence: z.array(
      z.string()
    ),
  });

export type OperationsCause =
  z.infer<
    typeof OperationsCauseSchema
  >;

export const OperationsAreaAssessmentSchema =
  z.object({
    status: z.enum([
      "excellent",
      "healthy",
      "attention",
      "degraded",
      "critical",
      "unknown",
    ]),

    score: z.number().min(0).max(100),

    summary: z.string(),
  });

export const AIOperationsAssessmentSchema =
  z.object({
    executive_summary: z.string(),

    platform_status: z.enum([
      "excellent",
      "healthy",
      "attention",
      "degraded",
      "critical",
    ]),

    risk_level: OperationsRiskLevelSchema,

    confidence: OperationsConfidenceSchema,

    action_required: z.boolean(),

    immediate_action: z.string(),

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

    what_changed: z.array(
      z.string()
    ),

    likely_causes: z.array(
      OperationsCauseSchema
    ),

    recommendations: z.array(
      OperationsRecommendationSchema
    ),

    predictions: z.array(
      OperationsPredictionSchema
    ),

    watch_list: z.array(
      z.string()
    ),

    positive_signals: z.array(
      z.string()
    ),
  });

export type AIOperationsAssessment =
  z.infer<
    typeof AIOperationsAssessmentSchema
  >;

export type AIOperationsResult = {
  ok: boolean;

  source:
    | "openai"
    | "deterministic_fallback";

  assessment:
    AIOperationsAssessment;

  model: string | null;

  generated_at: string;

  response_id: string | null;

  error?: string;
};