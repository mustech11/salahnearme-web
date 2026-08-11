export const AI_MODEL_DEFAULTS = {
  operations: "gpt-5.6-terra",
  general: "gpt-5.6-terra",
  highVolume: "gpt-5.6-luna",
  advanced: "gpt-5.6",
} as const;

export type SalahNearMeAIModelRole =
  keyof typeof AI_MODEL_DEFAULTS;

function cleanEnvValue(
  value: string | undefined
): string | null {
  if (!value) {
    return null;
  }

  const cleaned = value.trim();

  return cleaned.length > 0
    ? cleaned
    : null;
}

export function getAIModel(
  role: SalahNearMeAIModelRole
): string {
  switch (role) {
    case "operations":
      return (
        cleanEnvValue(
          process.env.OPENAI_OPERATIONS_MODEL
        ) ??
        AI_MODEL_DEFAULTS.operations
      );

    case "highVolume":
      return (
        cleanEnvValue(
          process.env.OPENAI_HIGH_VOLUME_MODEL
        ) ??
        AI_MODEL_DEFAULTS.highVolume
      );

    case "advanced":
      return (
        cleanEnvValue(
          process.env.OPENAI_ADVANCED_MODEL
        ) ??
        AI_MODEL_DEFAULTS.advanced
      );

    case "general":
    default:
      return (
        cleanEnvValue(
          process.env.OPENAI_DEFAULT_MODEL
        ) ??
        AI_MODEL_DEFAULTS.general
      );
  }
}

export const AI_LIMITS = {
  operationsHistorySnapshots: 30,
  maxOperationalFindings: 20,
  maxRecommendations: 8,
  maxPredictions: 6,
  maxInputCharacters: 75_000,
} as const;