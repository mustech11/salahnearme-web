import "server-only";

import OpenAI from "openai";

const DEFAULT_TIMEOUT_MS = 30_000;
const MIN_TIMEOUT_MS = 5_000;
const MAX_TIMEOUT_MS = 120_000;

const DEFAULT_MAX_RETRIES = 2;
const MIN_MAX_RETRIES = 0;
const MAX_MAX_RETRIES = 5;

let cachedClient: OpenAI | null = null;
let cachedFingerprint: string | null = null;

function cleanEnvValue(
  value: string | undefined,
  maxLength = 500
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.trim().slice(0, maxLength);

  return cleaned.length > 0 ? cleaned : null;
}

function parseIntegerEnv(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(
    maximum,
    Math.max(
      minimum,
      Math.trunc(parsed)
    )
  );
}

function getApiKey(): string | null {
  return cleanEnvValue(
    process.env.OPENAI_API_KEY,
    2_000
  );
}

function getOrganisationId(): string | null {
  return cleanEnvValue(
    process.env.OPENAI_ORG_ID,
    250
  );
}

function getProjectId(): string | null {
  return cleanEnvValue(
    process.env.OPENAI_PROJECT_ID,
    250
  );
}

function getTimeoutMs(): number {
  return parseIntegerEnv(
    process.env.OPENAI_TIMEOUT_MS,
    DEFAULT_TIMEOUT_MS,
    MIN_TIMEOUT_MS,
    MAX_TIMEOUT_MS
  );
}

function getMaxRetries(): number {
  return parseIntegerEnv(
    process.env.OPENAI_MAX_RETRIES,
    DEFAULT_MAX_RETRIES,
    MIN_MAX_RETRIES,
    MAX_MAX_RETRIES
  );
}

function createConfigurationFingerprint(): string {
  return JSON.stringify({
    apiKey: getApiKey(),
    organisation: getOrganisationId(),
    project: getProjectId(),
    timeout: getTimeoutMs(),
    maxRetries: getMaxRetries(),
  });
}

export function isOpenAIConfigured(): boolean {
  return Boolean(getApiKey());
}

export type AIConfigurationStatus = {
  configured: boolean;

  provider: "openai";

  organisationConfigured: boolean;

  projectConfigured: boolean;

  timeoutMs: number;

  maxRetries: number;

  modelConfigured: boolean;

  model: string | null;
};

export function getAIConfigurationStatus(): AIConfigurationStatus {
  const model =
    cleanEnvValue(
      process.env.OPENAI_MODEL,
      120
    );

  return {
    configured: isOpenAIConfigured(),

    provider: "openai",

    organisationConfigured:
      Boolean(getOrganisationId()),

    projectConfigured:
      Boolean(getProjectId()),

    timeoutMs: getTimeoutMs(),

    maxRetries: getMaxRetries(),

    modelConfigured:
      Boolean(model),

    model,
  };
}

export function getOpenAIClient(): OpenAI {
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not configured."
    );
  }

  const fingerprint =
    createConfigurationFingerprint();

  if (
    cachedClient &&
    cachedFingerprint === fingerprint
  ) {
    return cachedClient;
  }

  const organisation =
    getOrganisationId();

  const project =
    getProjectId();

  cachedClient = new OpenAI({
    apiKey,

    timeout:
      getTimeoutMs(),

    maxRetries:
      getMaxRetries(),

    ...(organisation
      ? {
          organization:
            organisation,
        }
      : {}),

    ...(project
      ? {
          project,
        }
      : {}),
  });

  cachedFingerprint =
    fingerprint;

  return cachedClient;
}

/**
 * Primarily useful for tests and local development.
 *
 * Production code normally never needs to call this because
 * the OpenAI client is intentionally cached for reuse.
 */
export function resetOpenAIClient(): void {
  cachedClient = null;
  cachedFingerprint = null;
}