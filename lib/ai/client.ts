import OpenAI from "openai";

let cachedClient: OpenAI | null = null;

function getApiKey(): string | null {
  const value =
    process.env.OPENAI_API_KEY?.trim();

  return value
    ? value
    : null;
}

export function isOpenAIConfigured(): boolean {
  return Boolean(getApiKey());
}

export function getOpenAIClient(): OpenAI {
  if (cachedClient) {
    return cachedClient;
  }

  const apiKey = getApiKey();

  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not configured."
    );
  }

  cachedClient = new OpenAI({
    apiKey,
    timeout: 30_000,
    maxRetries: 2,
  });

  return cachedClient;
}

export type AIConfigurationStatus = {
  configured: boolean;
  provider: "openai";
};

export function getAIConfigurationStatus():
  AIConfigurationStatus {
  return {
    configured: isOpenAIConfigured(),
    provider: "openai",
  };
}