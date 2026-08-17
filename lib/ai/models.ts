export const AI_MODEL_DEFAULTS = {
  /**
   * Operations Centre:
   * strong reasoning while keeping recurring monitoring
   * significantly cheaper than the flagship model.
   */
  operations:
    "gpt-5.6-terra",

  /**
   * General SalahNearMe intelligence.
   */
  general:
    "gpt-5.6-terra",

  /**
   * Large-volume classification, extraction,
   * ranking and repetitive intelligence jobs.
   */
  highVolume:
    "gpt-5.6-luna",

  /**
   * Difficult/high-value reasoning.
   *
   * gpt-5.6 is the current alias for GPT-5.6 Sol.
   */
  advanced:
    "gpt-5.6",
} as const;

export type SalahNearMeAIModelRole =
  keyof typeof AI_MODEL_DEFAULTS;

export const AI_REASONING_DEFAULTS = {
  /**
   * Operations assessments involve judgement over
   * multiple metrics, so medium is appropriate.
   */
  operations: "medium",

  general: "low",

  highVolume: "none",

  advanced: "high",
} as const;

export type SalahNearMeAIReasoningRole =
  keyof typeof AI_REASONING_DEFAULTS;

export type SalahNearMeReasoningEffort =
  | "none"
  | "low"
  | "medium"
  | "high"
  | "xhigh"
  | "max";

function cleanEnvValue(
  value:
    | string
    | undefined,
  maxLength = 120
): string | null {
  if (!value) {
    return null;
  }

  const cleaned =
    value
      .trim()
      .slice(
        0,
        maxLength
      );

  return cleaned.length > 0
    ? cleaned
    : null;
}

function isReasoningEffort(
  value: string
): value is SalahNearMeReasoningEffort {
  return (
    value === "none" ||
    value === "low" ||
    value === "medium" ||
    value === "high" ||
    value === "xhigh" ||
    value === "max"
  );
}

function getConfiguredReasoningEffort(
  envName: string,
  fallback:
    SalahNearMeReasoningEffort
): SalahNearMeReasoningEffort {
  const value =
    cleanEnvValue(
      process.env[envName],
      20
    );

  if (
    value &&
    isReasoningEffort(value)
  ) {
    return value;
  }

  return fallback;
}

export function getAIModel(
  role:
    SalahNearMeAIModelRole
): string {
  switch (role) {
    case "operations":
      return (
        cleanEnvValue(
          process.env
            .OPENAI_OPERATIONS_MODEL
        ) ??
        AI_MODEL_DEFAULTS
          .operations
      );

    case "highVolume":
      return (
        cleanEnvValue(
          process.env
            .OPENAI_HIGH_VOLUME_MODEL
        ) ??
        AI_MODEL_DEFAULTS
          .highVolume
      );

    case "advanced":
      return (
        cleanEnvValue(
          process.env
            .OPENAI_ADVANCED_MODEL
        ) ??
        AI_MODEL_DEFAULTS
          .advanced
      );

    case "general":
    default:
      return (
        cleanEnvValue(
          process.env
            .OPENAI_DEFAULT_MODEL
        ) ??
        AI_MODEL_DEFAULTS
          .general
      );
  }
}

export function getAIReasoningEffort(
  role:
    SalahNearMeAIReasoningRole
): SalahNearMeReasoningEffort {
  switch (role) {
    case "operations":
      return getConfiguredReasoningEffort(
        "OPENAI_OPERATIONS_REASONING_EFFORT",
        AI_REASONING_DEFAULTS.operations
      );

    case "highVolume":
      return getConfiguredReasoningEffort(
        "OPENAI_HIGH_VOLUME_REASONING_EFFORT",
        AI_REASONING_DEFAULTS.highVolume
      );

    case "advanced":
      return getConfiguredReasoningEffort(
        "OPENAI_ADVANCED_REASONING_EFFORT",
        AI_REASONING_DEFAULTS.advanced
      );

    case "general":
    default:
      return getConfiguredReasoningEffort(
        "OPENAI_DEFAULT_REASONING_EFFORT",
        AI_REASONING_DEFAULTS.general
      );
  }
}

/**
 * Central operational limits.
 *
 * Keep these limits in one place so that increasing dashboard
 * history does not accidentally increase AI cost or payload size.
 */
export const AI_LIMITS = {
  operationsHistorySnapshots:
    30,

  maxOperationalFindings:
    20,

  maxRecommendations:
    8,

  maxPredictions:
    6,

  maxLikelyCauses:
    8,

  maxWatchListItems:
    12,

  maxPositiveSignals:
    12,

  maxInputCharacters:
    75_000,

  operationsTimeoutMs:
    45_000,

  operationsMaxOutputTokens:
    4_000,
} as const;