import "server-only";

import type { ZodType } from "zod";

export type AIRole =
  | "system"
  | "developer"
  | "user"
  | "assistant";

export type AIMessage = {
  role: AIRole;
  content: string;
};

export type AIJsonSchema = Record<string, unknown>;

export type AIStructuredOutput = {
  name: string;
  description?: string;
  schema: AIJsonSchema;
  strict?: boolean;
};

export type AIRequestOptions<T> = {
  messages: AIMessage[];

  schema?: ZodType<T>;

  structuredOutput?: AIStructuredOutput;

  model?: string;

  temperature?: number;

  maxOutputTokens?: number;

  timeoutMs?: number;

  metadata?: Record<
    string,
    string | number | boolean | null
  >;

  /**
   * Responses are not stored by default because SalahNearMe
   * can send operational/admin context.
   */
  store?: boolean;

  /**
   * Additional retry attempts after the initial request.
   */
  maxRetries?: number;
};

export type AIUsage = {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  cachedInputTokens: number | null;
  reasoningTokens: number | null;
};

export type AIResult<T> = {
  ok: true;

  text: string;

  parsed: T | null;

  structured: boolean;

  model: string;

  responseId: string | null;

  requestId: string | null;

  usage: AIUsage;

  durationMs: number;
};

export class AICoreError extends Error {
  status: number;

  code: string;

  details: Record<string, unknown> | null;

  constructor(
    message: string,
    options?: {
      status?: number;
      code?: string;
      details?: Record<string, unknown> | null;
    }
  ) {
    super(message);

    this.name = "AICoreError";

    this.status =
      options?.status ?? 500;

    this.code =
      options?.code ?? "AI_CORE_ERROR";

    this.details =
      options?.details ?? null;
  }
}

type OpenAIResponseContent = {
  type?: unknown;
  text?: unknown;
  refusal?: unknown;
};

type OpenAIResponseOutput = {
  type?: unknown;
  content?: unknown;
  status?: unknown;
};

type OpenAIUsageDetails = {
  cached_tokens?: unknown;
};

type OpenAIOutputTokenDetails = {
  reasoning_tokens?: unknown;
};

type OpenAIResponseBody = {
  id?: unknown;

  model?: unknown;

  status?: unknown;

  output_text?: unknown;

  output?: unknown;

  incomplete_details?: {
    reason?: unknown;
  };

  usage?: {
    input_tokens?: unknown;

    output_tokens?: unknown;

    total_tokens?: unknown;

    input_tokens_details?: OpenAIUsageDetails;

    output_tokens_details?: OpenAIOutputTokenDetails;
  };

  error?: {
    message?: unknown;
    code?: unknown;
    type?: unknown;
    param?: unknown;
  };
};

const OPENAI_RESPONSES_URL =
  "https://api.openai.com/v1/responses";

const DEFAULT_TIMEOUT_MS = 30_000;
const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 120_000;

const DEFAULT_MAX_OUTPUT_TOKENS = 2_500;
const MAX_OUTPUT_TOKENS = 8_000;

const MAX_MESSAGE_LENGTH = 100_000;
const MAX_OUTPUT_TEXT_LENGTH = 30_000;

const MAX_SCHEMA_NAME_LENGTH = 64;
const MAX_SCHEMA_DESCRIPTION_LENGTH = 500;

const MAX_METADATA_ENTRIES = 16;
const MAX_METADATA_KEY_LENGTH = 64;
const MAX_METADATA_VALUE_LENGTH = 500;

const DEFAULT_MAX_RETRIES = 2;
const MAX_RETRIES = 5;

const RETRYABLE_HTTP_STATUSES = new Set([
  408,
  409,
  429,
  500,
  502,
  503,
  504,
]);

function cleanString(
  value: unknown,
  maxLength = 10_000
): string {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(
      /[\u0000-\u001F\u007F]/g,
      " "
    )
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function safeNumber(
  value: unknown
): number | null {
  return (
    typeof value === "number" &&
    Number.isFinite(value)
  )
    ? value
    : null;
}

function clampInteger(
  value: number,
  minimum: number,
  maximum: number
): number {
  return Math.min(
    maximum,
    Math.max(
      minimum,
      Math.trunc(value)
    )
  );
}

function sleep(
  milliseconds: number
): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(
      resolve,
      milliseconds
    );
  });
}

function getApiKey(): string {
  const key =
    process.env.OPENAI_API_KEY?.trim();

  if (!key) {
    throw new AICoreError(
      "OPENAI_API_KEY is not configured.",
      {
        status: 503,
        code:
          "OPENAI_NOT_CONFIGURED",
      }
    );
  }

  return key;
}

function getModel(
  requestedModel?: string
): string {
  return (
    cleanString(
      requestedModel,
      120
    ) ||
    cleanString(
      process.env.OPENAI_MODEL,
      120
    ) ||
    "gpt-4o-mini"
  );
}

/**
 * Converts a user-provided structured-output schema name
 * into a safe API-compatible identifier.
 *
 * Keeps only letters, numbers, underscores and hyphens.
 */
function sanitizeSchemaName(
  value: string
): string {
  const cleaned =
    cleanString(
      value,
      MAX_SCHEMA_NAME_LENGTH * 2
    )
      .replace(
        /[^a-zA-Z0-9_-]/g,
        "_"
      )
      .replace(
        /_+/g,
        "_"
      )
      .replace(
        /^[_-]+|[_-]+$/g,
        ""
      )
      .slice(
        0,
        MAX_SCHEMA_NAME_LENGTH
      );

  return (
    cleaned ||
    "salahnearme_response"
  );
}

function sanitizeMetadata(
  metadata:
    | AIRequestOptions<unknown>["metadata"]
    | undefined
):
  | Record<
      string,
      string | number | boolean | null
    >
  | undefined {
  if (!metadata) {
    return undefined;
  }

  const sanitized: Record<
    string,
    string | number | boolean | null
  > = {};

  const entries =
    Object.entries(metadata).slice(
      0,
      MAX_METADATA_ENTRIES
    );

  for (const [rawKey, rawValue] of entries) {
    const safeKey =
      cleanString(
        rawKey,
        MAX_METADATA_KEY_LENGTH * 2
      )
        .replace(
          /[^a-zA-Z0-9_-]/g,
          "_"
        )
        .replace(
          /_+/g,
          "_"
        )
        .replace(
          /^[_-]+|[_-]+$/g,
          ""
        )
        .slice(
          0,
          MAX_METADATA_KEY_LENGTH
        );

    if (!safeKey) {
      continue;
    }

    if (rawValue === null) {
      sanitized[safeKey] = null;
      continue;
    }

    if (
      typeof rawValue === "string"
    ) {
      sanitized[safeKey] =
        cleanString(
          rawValue,
          MAX_METADATA_VALUE_LENGTH
        );

      continue;
    }

    if (
      typeof rawValue === "number"
    ) {
      sanitized[safeKey] =
        Number.isFinite(rawValue)
          ? rawValue
          : null;

      continue;
    }

    if (
      typeof rawValue === "boolean"
    ) {
      sanitized[safeKey] =
        rawValue;
    }
  }

  return Object.keys(
    sanitized
  ).length > 0
    ? sanitized
    : undefined;
}

function buildInput(
  messages: AIMessage[]
): AIMessage[] {
  const result: AIMessage[] = [];

  for (const message of messages) {
    const content =
      cleanString(
        message.content,
        MAX_MESSAGE_LENGTH
      );

    if (!content) {
      continue;
    }

    result.push({
      role: message.role,
      content,
    });
  }

  return result;
}

function buildTextConfiguration(
  structuredOutput?:
    AIStructuredOutput
):
  | {
      format: {
        type: "json_schema";
        name: string;
        description?: string;
        schema: AIJsonSchema;
        strict: boolean;
      };
    }
  | undefined {
  if (!structuredOutput) {
    return undefined;
  }

  const description =
    cleanString(
      structuredOutput.description,
      MAX_SCHEMA_DESCRIPTION_LENGTH
    );

  return {
    format: {
      type: "json_schema",

      name:
        sanitizeSchemaName(
          structuredOutput.name
        ),

      ...(description
        ? {
            description,
          }
        : {}),

      schema:
        structuredOutput.schema,

      strict:
        structuredOutput.strict ??
        true,
    },
  };
}

function extractRefusal(
  body: OpenAIResponseBody
): string | null {
  if (!Array.isArray(body.output)) {
    return null;
  }

  for (const rawOutput of body.output) {
    if (
      !rawOutput ||
      typeof rawOutput !== "object"
    ) {
      continue;
    }

    const output =
      rawOutput as OpenAIResponseOutput;

    if (
      !Array.isArray(
        output.content
      )
    ) {
      continue;
    }

    for (
      const rawContent of
      output.content
    ) {
      if (
        !rawContent ||
        typeof rawContent !== "object"
      ) {
        continue;
      }

      const content =
        rawContent as OpenAIResponseContent;

      const refusal =
        cleanString(
          content.refusal,
          2_000
        );

      if (refusal) {
        return refusal;
      }
    }
  }

  return null;
}

function extractOutputText(
  body: OpenAIResponseBody
): string {
  const direct =
    cleanString(
      body.output_text,
      MAX_OUTPUT_TEXT_LENGTH
    );

  if (direct) {
    return direct;
  }

  if (!Array.isArray(body.output)) {
    return "";
  }

  const parts: string[] = [];

  for (const rawOutput of body.output) {
    if (
      !rawOutput ||
      typeof rawOutput !== "object"
    ) {
      continue;
    }

    const output =
      rawOutput as OpenAIResponseOutput;

    if (
      !Array.isArray(
        output.content
      )
    ) {
      continue;
    }

    for (
      const rawContent of
      output.content
    ) {
      if (
        !rawContent ||
        typeof rawContent !== "object"
      ) {
        continue;
      }

      const content =
        rawContent as OpenAIResponseContent;

      const text =
        cleanString(
          content.text,
          MAX_OUTPUT_TEXT_LENGTH
        );

      if (text) {
        parts.push(text);
      }
    }
  }

  return parts
    .join("\n")
    .trim()
    .slice(
      0,
      MAX_OUTPUT_TEXT_LENGTH
    );
}

function stripMarkdownCodeFence(
  value: string
): string {
  const trimmed =
    value.trim();

  if (
    !trimmed.startsWith("```")
  ) {
    return trimmed;
  }

  return trimmed
    .replace(
      /^```(?:json)?\s*/i,
      ""
    )
    .replace(
      /\s*```$/,
      ""
    )
    .trim();
}

function extractJsonCandidate(
  value: string
): string {
  const cleaned =
    stripMarkdownCodeFence(value);

  if (
    cleaned.startsWith("{") &&
    cleaned.endsWith("}")
  ) {
    return cleaned;
  }

  const firstBrace =
    cleaned.indexOf("{");

  const lastBrace =
    cleaned.lastIndexOf("}");

  if (
    firstBrace >= 0 &&
    lastBrace > firstBrace
  ) {
    return cleaned.slice(
      firstBrace,
      lastBrace + 1
    );
  }

  return cleaned;
}

function parseStructuredOutput<T>(
  text: string,
  schema?: ZodType<T>
): T | null {
  if (!schema) {
    return null;
  }

  let json: unknown;

  try {
    json =
      JSON.parse(
        extractJsonCandidate(text)
      );
  } catch (error) {
    console.error(
      "AI structured JSON parsing failed:",
      error
    );

    return null;
  }

  const validation =
    schema.safeParse(json);

  if (!validation.success) {
    console.error(
      "AI structured output failed local schema validation:",
      validation.error.flatten()
    );

    return null;
  }

  return validation.data;
}

function buildUsage(
  body: OpenAIResponseBody
): AIUsage {
  return {
    inputTokens:
      safeNumber(
        body.usage?.input_tokens
      ),

    outputTokens:
      safeNumber(
        body.usage?.output_tokens
      ),

    totalTokens:
      safeNumber(
        body.usage?.total_tokens
      ),

    cachedInputTokens:
      safeNumber(
        body.usage
          ?.input_tokens_details
          ?.cached_tokens
      ),

    reasoningTokens:
      safeNumber(
        body.usage
          ?.output_tokens_details
          ?.reasoning_tokens
      ),
  };
}

function buildOpenAIError(
  body:
    | OpenAIResponseBody
    | null,
  httpStatus: number,
  requestId: string | null
): AICoreError {
  const message =
    cleanString(
      body?.error?.message,
      2_000
    ) ||
    `OpenAI returned HTTP ${httpStatus}.`;

  const code =
    cleanString(
      body?.error?.code,
      120
    ) ||
    cleanString(
      body?.error?.type,
      120
    ) ||
    "OPENAI_REQUEST_FAILED";

  return new AICoreError(
    message,
    {
      status:
        httpStatus,

      code,

      details: {
        http_status:
          httpStatus,

        request_id:
          requestId,

        parameter:
          cleanString(
            body?.error?.param,
            200
          ) ||
          null,
      },
    }
  );
}

function shouldRetryStatus(
  status: number
): boolean {
  return RETRYABLE_HTTP_STATUSES.has(
    status
  );
}

function getRetryDelayMs(
  attempt: number,
  retryAfterHeader:
    | string
    | null
): number {
  if (retryAfterHeader) {
    const seconds =
      Number(retryAfterHeader);

    if (
      Number.isFinite(seconds) &&
      seconds >= 0
    ) {
      return Math.min(
        10_000,
        Math.round(
          seconds * 1_000
        )
      );
    }

    const retryDate =
      Date.parse(
        retryAfterHeader
      );

    if (
      Number.isFinite(retryDate)
    ) {
      return Math.min(
        10_000,
        Math.max(
          0,
          retryDate - Date.now()
        )
      );
    }
  }

  const exponential =
    500 * 2 ** attempt;

  const jitter =
    Math.floor(
      Math.random() * 250
    );

  return Math.min(
    8_000,
    exponential + jitter
  );
}

async function executeRequest(
  requestBody:
    Record<string, unknown>,
  apiKey: string,
  controller: AbortController,
  maxRetries: number
): Promise<{
  body: OpenAIResponseBody;
  requestId: string | null;
}> {
  let attempt = 0;

  while (true) {
    let response: Response;

    try {
      response =
        await fetch(
          OPENAI_RESPONSES_URL,
          {
            method: "POST",

            headers: {
              Authorization:
                `Bearer ${apiKey}`,

              "Content-Type":
                "application/json",
            },

            signal:
              controller.signal,

            body:
              JSON.stringify(
                requestBody
              ),
          }
        );
    } catch (error) {
      if (
        controller.signal.aborted
      ) {
        throw error;
      }

      if (
        attempt >= maxRetries
      ) {
        throw error;
      }

      await sleep(
        getRetryDelayMs(
          attempt,
          null
        )
      );

      attempt += 1;

      continue;
    }

    const requestId =
      cleanString(
        response.headers.get(
          "x-request-id"
        ),
        200
      ) ||
      null;

    const raw =
      await response.text();

    let body:
      | OpenAIResponseBody
      | null = null;

    try {
      body =
        JSON.parse(
          raw
        ) as OpenAIResponseBody;
    } catch {
      body = null;
    }

    if (
      !response.ok &&
      shouldRetryStatus(
        response.status
      ) &&
      attempt < maxRetries
    ) {
      const retryAfter =
        response.headers.get(
          "retry-after"
        );

      await sleep(
        getRetryDelayMs(
          attempt,
          retryAfter
        )
      );

      attempt += 1;

      continue;
    }

    if (!response.ok) {
      throw buildOpenAIError(
        body,
        response.status,
        requestId
      );
    }

    if (!body) {
      throw new AICoreError(
        "OpenAI returned an invalid JSON response envelope.",
        {
          status: 502,

          code:
            "INVALID_OPENAI_RESPONSE",

          details: {
            request_id:
              requestId,
          },
        }
      );
    }

    return {
      body,
      requestId,
    };
  }
}

export async function runAI<
  T = never
>(
  options:
    AIRequestOptions<T>
): Promise<AIResult<T>> {
  const startedAt =
    Date.now();

  const apiKey =
    getApiKey();

  const model =
    getModel(
      options.model
    );

  const timeoutMs =
    clampInteger(
      options.timeoutMs ??
        DEFAULT_TIMEOUT_MS,
      MIN_TIMEOUT_MS,
      MAX_TIMEOUT_MS
    );

  const maxOutputTokens =
    clampInteger(
      options.maxOutputTokens ??
        DEFAULT_MAX_OUTPUT_TOKENS,
      256,
      MAX_OUTPUT_TOKENS
    );

  const maxRetries =
    clampInteger(
      options.maxRetries ??
        DEFAULT_MAX_RETRIES,
      0,
      MAX_RETRIES
    );

  const input =
    buildInput(
      options.messages
    );

  if (input.length === 0) {
    throw new AICoreError(
      "AI request contains no messages.",
      {
        status: 400,

        code:
          "EMPTY_AI_INPUT",
      }
    );
  }

  if (
    options.structuredOutput &&
    !options.structuredOutput.schema
  ) {
    throw new AICoreError(
      "Structured output requires a JSON schema.",
      {
        status: 400,

        code:
          "MISSING_JSON_SCHEMA",
      }
    );
  }

  const textConfiguration =
    buildTextConfiguration(
      options.structuredOutput
    );

  const metadata =
    sanitizeMetadata(
      options.metadata
    );

  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () =>
        controller.abort(),
      timeoutMs
    );

  try {
    const requestBody:
      Record<string, unknown> = {
      model,

      input,

      store:
        options.store ??
        false,

      max_output_tokens:
        maxOutputTokens,

      ...(typeof options.temperature ===
      "number"
        ? {
            temperature:
              Math.max(
                0,
                Math.min(
                  2,
                  options.temperature
                )
              ),
          }
        : {}),

      ...(textConfiguration
        ? {
            text:
              textConfiguration,
          }
        : {}),

      ...(metadata
        ? {
            metadata,
          }
        : {}),
    };

    const {
      body,
      requestId,
    } =
      await executeRequest(
        requestBody,
        apiKey,
        controller,
        maxRetries
      );

    const refusal =
      extractRefusal(body);

    if (refusal) {
      throw new AICoreError(
        refusal,
        {
          status: 422,

          code:
            "AI_REFUSAL",

          details: {
            request_id:
              requestId,
          },
        }
      );
    }

    const responseStatus =
      cleanString(
        body.status,
        80
      );

    if (
      responseStatus ===
      "failed"
    ) {
      throw new AICoreError(
        "OpenAI reported that the response failed.",
        {
          status: 502,

          code:
            "OPENAI_RESPONSE_FAILED",

          details: {
            request_id:
              requestId,
          },
        }
      );
    }

    if (
      responseStatus ===
      "incomplete"
    ) {
      const reason =
        cleanString(
          body
            .incomplete_details
            ?.reason,
          200
        );

      throw new AICoreError(
        reason
          ? `OpenAI response was incomplete: ${reason}.`
          : "OpenAI response was incomplete.",
        {
          status: 502,

          code:
            "OPENAI_RESPONSE_INCOMPLETE",

          details: {
            request_id:
              requestId,

            reason:
              reason || null,
          },
        }
      );
    }

    const text =
      extractOutputText(body);

    if (!text) {
      throw new AICoreError(
        "OpenAI returned no usable text output.",
        {
          status: 502,

          code:
            "EMPTY_OPENAI_OUTPUT",

          details: {
            request_id:
              requestId,
          },
        }
      );
    }

    const parsed =
      parseStructuredOutput(
        text,
        options.schema
      );

    if (
      options.structuredOutput &&
      options.schema &&
      parsed === null
    ) {
      throw new AICoreError(
        "The AI response did not pass SalahNearMe structured-output validation.",
        {
          status: 502,

          code:
            "AI_SCHEMA_VALIDATION_FAILED",

          details: {
            request_id:
              requestId,

            response_id:
              cleanString(
                body.id,
                200
              ) ||
              null,

            model:
              cleanString(
                body.model,
                120
              ) ||
              model,
          },
        }
      );
    }

    return {
      ok: true,

      text,

      parsed,

      structured:
        parsed !== null,

      model:
        cleanString(
          body.model,
          120
        ) ||
        model,

      responseId:
        cleanString(
          body.id,
          200
        ) ||
        null,

      requestId,

      usage:
        buildUsage(body),

      durationMs:
        Date.now() -
        startedAt,
    };
  } catch (error) {
    if (
      error instanceof
      AICoreError
    ) {
      throw error;
    }

    if (
      error instanceof Error &&
      (
        error.name ===
          "AbortError" ||
        controller.signal
          .aborted
      )
    ) {
      throw new AICoreError(
        `AI request timed out after ${timeoutMs}ms.`,
        {
          status: 504,

          code:
            "AI_TIMEOUT",

          details: {
            timeout_ms:
              timeoutMs,
          },
        }
      );
    }

    throw new AICoreError(
      error instanceof Error
        ? error.message
        : "Unexpected AI request failure.",
      {
        status: 500,

        code:
          "AI_CORE_UNEXPECTED_ERROR",
      }
    );
  } finally {
    clearTimeout(timer);
  }
}