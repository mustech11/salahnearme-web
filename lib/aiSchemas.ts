import { z } from "zod";

/**
 * Shared severity levels used by SalahNearMe AI intelligence.
 *
 * These values are intentionally separate from infrastructure-health
 * severity levels because AI findings can include advisory information
 * that is not itself a platform incident.
 */
export const AI_SEVERITIES = [
  "info",
  "low",
  "medium",
  "high",
  "critical",
] as const;

export const aiSeveritySchema = z.enum(
  AI_SEVERITIES
);

export type AISeverity = z.infer<
  typeof aiSeveritySchema
>;

/**
 * Categories that the SalahNearMe intelligence layer may classify
 * recommendations under.
 */
export const AI_RECOMMENDATION_CATEGORIES = [
  "operations",
  "mosque",
  "business",
  "prayer_times",
  "seo",
  "growth",
  "data_quality",
  "security",
  "travel",
  "general",
] as const;

export const aiRecommendationCategorySchema =
  z.enum(
    AI_RECOMMENDATION_CATEGORIES
  );

export type AIRecommendationCategory =
  z.infer<
    typeof aiRecommendationCategorySchema
  >;

/**
 * One actionable recommendation produced by the AI intelligence layer.
 */
export const aiRecommendationSchema =
  z
    .object({
      title: z
        .string()
        .trim()
        .min(1)
        .max(200),

      reason: z
        .string()
        .trim()
        .min(1)
        .max(1500),

      priority:
        aiSeveritySchema,

      category:
        aiRecommendationCategorySchema,

      suggested_action: z
        .string()
        .trim()
        .max(1500)
        .nullable(),
    })
    .strict();

export type AIRecommendation =
  z.infer<
    typeof aiRecommendationSchema
  >;

/**
 * Strict response returned by the SalahNearMe admin intelligence
 * assistant.
 */
export const adminAssistantResponseSchema =
  z
    .object({
      answer: z
        .string()
        .trim()
        .min(1)
        .max(8000),

      summary: z
        .string()
        .trim()
        .min(1)
        .max(1500),

      confidence: z
        .number()
        .min(0)
        .max(100),

      risk_level:
        aiSeveritySchema,

      recommendations: z
        .array(
          aiRecommendationSchema
        )
        .max(12),

      requires_admin_action:
        z.boolean(),
    })
    .strict();

export type AdminAssistantResponse =
  z.infer<
    typeof adminAssistantResponseSchema
  >;

/**
 * JSON Schema used by OpenAI Structured Outputs.
 *
 * We deliberately define this explicitly rather than dynamically
 * converting the Zod schema. This keeps the production API contract
 * stable even if the installed Zod version changes.
 */
export const ADMIN_ASSISTANT_JSON_SCHEMA = {
  type: "object",

  additionalProperties: false,

  properties: {
    answer: {
      type: "string",
      minLength: 1,
      maxLength: 8000,
    },

    summary: {
      type: "string",
      minLength: 1,
      maxLength: 1500,
    },

    confidence: {
      type: "number",
      minimum: 0,
      maximum: 100,
    },

    risk_level: {
      type: "string",
      enum: [
        "info",
        "low",
        "medium",
        "high",
        "critical",
      ],
    },

    recommendations: {
      type: "array",

      maxItems: 12,

      items: {
        type: "object",

        additionalProperties:
          false,

        properties: {
          title: {
            type: "string",
            minLength: 1,
            maxLength: 200,
          },

          reason: {
            type: "string",
            minLength: 1,
            maxLength: 1500,
          },

          priority: {
            type: "string",
            enum: [
              "info",
              "low",
              "medium",
              "high",
              "critical",
            ],
          },

          category: {
            type: "string",
            enum: [
              "operations",
              "mosque",
              "business",
              "prayer_times",
              "seo",
              "growth",
              "data_quality",
              "security",
              "travel",
              "general",
            ],
          },

          suggested_action: {
            anyOf: [
              {
                type: "string",
                maxLength: 1500,
              },
              {
                type: "null",
              },
            ],
          },
        },

        required: [
          "title",
          "reason",
          "priority",
          "category",
          "suggested_action",
        ],
      },
    },

    requires_admin_action: {
      type: "boolean",
    },
  },

  required: [
    "answer",
    "summary",
    "confidence",
    "risk_level",
    "recommendations",
    "requires_admin_action",
  ],
} as const;