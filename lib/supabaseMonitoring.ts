import type {
  SupabaseClient,
} from "@supabase/supabase-js";

import {
  supabaseAdmin,
} from "@/lib/supabaseAdmin";

import type {
  ApplicationMetric,
  HealthCheckMode,
  HealthMetadata,
  HealthMetadataValue,
  HealthSeverity,
  ServiceCheck,
  SystemHealthSnapshot,
  UsageMetric,
} from "@/lib/systemHealthTypes";

type ManagementHealthItem = {
  name?: unknown;
  status?: unknown;
  healthy?: unknown;
  message?: unknown;
  info?: unknown;
};

type TimedResult<T> = {
  value: T;
  durationMs: number;
};

type ApplicationMetricDefinition = {
  table: string;
  label: string;
};

type UsageMetricDefinition = {
  key: string;
  label: string;
  usedEnvironmentVariable: string;
  limitEnvironmentVariable: string;
  unit: string;
};

const REQUEST_TIMEOUT_MS = 10_000;
const DATABASE_TIMEOUT_MS = 10_000;
const APPLICATION_METRIC_TIMEOUT_MS = 12_000;

const LIGHTWEIGHT_RETENTION_DAYS = 30;
const DAILY_RETENTION_DAYS = 365;

const WEBSITE_WARNING_MS = 2_500;
const SUPABASE_WARNING_MS = 1_500;
const DATABASE_WARNING_MS = 1_500;

const MAX_METADATA_DEPTH = 5;
const MAX_METADATA_KEYS = 60;
const MAX_METADATA_ARRAY_ITEMS = 60;

const MANAGEMENT_API_BASE_URL =
  "https://api.supabase.com/v1";

const MONITORING_USER_AGENT =
  "SalahNearMe-System-Health/2.0";

const MANAGEMENT_HEALTH_SERVICES = [
  "auth",
  "db",
  "rest",
  "realtime",
  "storage",
] as const;

const PROJECT_REF_REGEX =
  /^[a-z0-9]{10,64}$/i;

const APPLICATION_METRICS: readonly ApplicationMetricDefinition[] =
  [
    {
      table: "cities",
      label: "City records",
    },
    {
      table: "mosques",
      label: "Mosques",
    },
    {
      table: "businesses",
      label: "Businesses",
    },
    {
      table: "mosque_claims",
      label: "Mosque claims",
    },
    {
      table: "business_claims",
      label: "Business claims",
    },
    {
      table: "mosque_timetable_imports",
      label: "Timetable imports",
    },
  ];

const USAGE_METRICS: readonly UsageMetricDefinition[] =
  [
    {
      key: "egress",
      label: "Supabase egress",
      usedEnvironmentVariable:
        "SUPABASE_EGRESS_USED_GB",
      limitEnvironmentVariable:
        "SUPABASE_EGRESS_QUOTA_GB",
      unit: "GB",
    },
    {
      key: "database",
      label: "Database disk",
      usedEnvironmentVariable:
        "SUPABASE_DATABASE_USED_GB",
      limitEnvironmentVariable:
        "SUPABASE_DATABASE_QUOTA_GB",
      unit: "GB",
    },
    {
      key: "storage",
      label: "Storage",
      usedEnvironmentVariable:
        "SUPABASE_STORAGE_USED_GB",
      limitEnvironmentVariable:
        "SUPABASE_STORAGE_QUOTA_GB",
      unit: "GB",
    },
  ];

const monitoringDb =
  supabaseAdmin as unknown as SupabaseClient;

function cleanString(
  value: unknown,
  maxLength = 2_000
): string {
  if (
    typeof value !== "string" &&
    typeof value !== "number" &&
    typeof value !== "boolean"
  ) {
    return "";
  }

  return String(value)
    .replace(
      /[\u0000-\u001F\u007F]/g,
      ""
    )
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function sanitiseMetadataValue(
  value: unknown,
  depth = 0
): HealthMetadataValue | undefined {
  if (depth > MAX_METADATA_DEPTH) {
    return undefined;
  }

  if (
    value === null ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value)
      ? value
      : undefined;
  }

  if (typeof value === "string") {
    return cleanString(
      value,
      2_000
    );
  }

  if (Array.isArray(value)) {
    return value
      .slice(
        0,
        MAX_METADATA_ARRAY_ITEMS
      )
      .map((item) =>
        sanitiseMetadataValue(
          item,
          depth + 1
        )
      )
      .filter(
        (
          item
        ): item is HealthMetadataValue =>
          item !== undefined
      );
  }

  if (
    typeof value === "object" &&
    value !== null
  ) {
    const result: HealthMetadata =
      {};

    const entries =
      Object.entries(
        value as Record<
          string,
          unknown
        >
      ).slice(
        0,
        MAX_METADATA_KEYS
      );

    for (const [
      rawKey,
      rawValue,
    ] of entries) {
      const key =
        cleanString(
          rawKey,
          120
        );

      if (!key) {
        continue;
      }

      const sanitised =
        sanitiseMetadataValue(
          rawValue,
          depth + 1
        );

      if (
        sanitised !== undefined
      ) {
        result[key] =
          sanitised;
      }
    }

    return result;
  }

  return undefined;
}

function sanitiseMetadata(
  value: unknown
): HealthMetadata {
  const sanitised =
    sanitiseMetadataValue(
      value
    );

  if (
    sanitised &&
    typeof sanitised ===
      "object" &&
    !Array.isArray(
      sanitised
    )
  ) {
    return sanitised;
  }

  return {};
}

function normaliseServiceKey(
  value: string,
  fallback: string
): string {
  const normalised =
    value
      .toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        "_"
      )
      .replace(
        /^_+|_+$/g,
        ""
      )
      .slice(0, 100);

  return normalised || fallback;
}

function formatServiceLabel(
  value: string
): string {
  return value
    .replace(
      /[_-]+/g,
      " "
    )
    .split(" ")
    .filter(Boolean)
    .map(
      (part) =>
        part
          .charAt(0)
          .toUpperCase() +
        part.slice(1)
    )
    .join(" ");
}

function getEnvironmentValue(
  key: string
): string | undefined {
  return process.env[key];
}

function parseOptionalNumber(
  value: string | undefined
): number | null {
  if (
    value === undefined ||
    value.trim() === ""
  ) {
    return null;
  }

  const parsed =
    Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed < 0
  ) {
    return null;
  }

  return parsed;
}

function isAbortError(
  error: unknown
): boolean {
  return (
    error instanceof Error &&
    error.name ===
      "AbortError"
  );
}

function getErrorMessage(
  error: unknown,
  fallback: string
): string {
  if (
    error instanceof Error
  ) {
    return (
      cleanString(
        error.message,
        1_000
      ) || fallback
    );
  }

  return fallback;
}

function createServiceCheck({
  key,
  label,
  status,
  responseTimeMs,
  message,
  checkedAt,
  metadata,
}: {
  key: string;
  label: string;
  status: HealthSeverity;
  responseTimeMs:
    | number
    | null;
  message: string;
  checkedAt: string;
  metadata?: unknown;
}): ServiceCheck {
  const result: ServiceCheck =
    {
      key:
        cleanString(
          key,
          120
        ) || "unknown",
      label:
        cleanString(
          label,
          180
        ) || "Unknown service",
      status,
      response_time_ms:
        typeof responseTimeMs ===
          "number" &&
        Number.isFinite(
          responseTimeMs
        ) &&
        responseTimeMs >= 0
          ? Math.round(
              responseTimeMs
            )
          : null,
      message:
        cleanString(
          message,
          2_000
        ) ||
        "No service message was returned.",
      checked_at:
        checkedAt,
    };

  if (
    metadata !== undefined
  ) {
    result.metadata =
      sanitiseMetadata(
        metadata
      );
  }

  return result;
}

function buildManagementHealthUrl(
  projectRef: string
): URL {
  const url =
    new URL(
      `${MANAGEMENT_API_BASE_URL}/projects/${encodeURIComponent(
        projectRef
      )}/health`
    );

  for (
    const service of
    MANAGEMENT_HEALTH_SERVICES
  ) {
    url.searchParams.append(
      "services",
      service
    );
  }

  return url;
}

async function readErrorResponse(
  response: Response
): Promise<string> {
  const clonedResponse =
    response.clone();

  const contentType =
    response.headers.get(
      "content-type"
    ) ?? "";

  if (
    contentType
      .toLowerCase()
      .includes(
        "application/json"
      )
  ) {
    const payload: unknown =
      await response
        .json()
        .catch(() => null);

    if (
      payload &&
      typeof payload ===
        "object" &&
      !Array.isArray(
        payload
      )
    ) {
      const record =
        payload as Record<
          string,
          unknown
        >;

      const message =
        cleanString(
          record.message,
          1_000
        ) ||
        cleanString(
          record.error,
          1_000
        ) ||
        cleanString(
          record.error_description,
          1_000
        ) ||
        cleanString(
          record.details,
          1_000
        );

      if (message) {
        return message;
      }
    }
  }

  return cleanString(
    await clonedResponse
      .text()
      .catch(() => ""),
    1_000
  );
}

function isManagementHealthItem(
  value: unknown
): value is ManagementHealthItem {
  return Boolean(
    value &&
      typeof value ===
        "object" &&
      !Array.isArray(
        value
      )
  );
}

function parseManagementHealthItems(
  payload: unknown
): ManagementHealthItem[] {
  if (
    Array.isArray(payload)
  ) {
    return payload.filter(
      isManagementHealthItem
    );
  }

  if (
    payload &&
    typeof payload ===
      "object" &&
    !Array.isArray(payload)
  ) {
    const record =
      payload as Record<
        string,
        unknown
      >;

    const possibleArrays = [
      record.services,
      record.data,
      record.results,
    ];

    for (
      const candidate of
      possibleArrays
    ) {
      if (
        Array.isArray(
          candidate
        )
      ) {
        return candidate.filter(
          isManagementHealthItem
        );
      }
    }
  }

  return [];
}

function getSiteUrl(): string | null {
  const explicit =
    cleanString(
      process.env
        .NEXT_PUBLIC_SITE_URL ??
        process.env.SITE_URL ??
        process.env
          .VERCEL_PROJECT_PRODUCTION_URL,
      1_000
    );

  if (!explicit) {
    return null;
  }

  const candidate =
    explicit.startsWith(
      "http://"
    ) ||
    explicit.startsWith(
      "https://"
    )
      ? explicit
      : `https://${explicit}`;

  try {
    const url =
      new URL(candidate);

    if (
      url.protocol !==
        "http:" &&
      url.protocol !==
        "https:"
    ) {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

function getSupabaseUrl(): string | null {
  const value =
    cleanString(
      process.env
        .NEXT_PUBLIC_SUPABASE_URL ??
        process.env.SUPABASE_URL,
      1_000
    );

  if (!value) {
    return null;
  }

  try {
    const url =
      new URL(value);

    if (
      url.protocol !==
        "https:" &&
      url.protocol !==
        "http:"
    ) {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

function getSupabasePublicKey(): string | null {
  const key =
    cleanString(
      process.env
        .NEXT_PUBLIC_SUPABASE_ANON_KEY ??
        process.env
          .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
        process.env
          .SUPABASE_ANON_KEY,
      4_000
    );

  return key || null;
}

function mapManagementStatus(
  value: unknown
): HealthSeverity {
  const status =
    cleanString(
      value,
      100
    ).toUpperCase();

  if (
    status.includes(
      "ACTIVE_HEALTHY"
    ) ||
    status === "HEALTHY" ||
    status === "UP" ||
    status === "ACTIVE"
  ) {
    return "healthy";
  }

  if (
    status.includes(
      "DEGRADED"
    ) ||
    status.includes(
      "WARNING"
    ) ||
    status.includes(
      "STARTING"
    )
  ) {
    return "warning";
  }

  if (
    status.includes(
      "INACTIVE"
    ) ||
    status.includes(
      "UNHEALTHY"
    ) ||
    status.includes(
      "DOWN"
    ) ||
    status.includes(
      "ERROR"
    ) ||
    status.includes(
      "FAILED"
    )
  ) {
    return "critical";
  }

  return "warning";
}

function getOverallStatus(
  services: readonly ServiceCheck[],
  application:
    readonly ApplicationMetric[]
): HealthSeverity {
  const statuses = [
    ...services.map(
      (item) =>
        item.status
    ),
    ...application.map(
      (item) =>
        item.status
    ),
  ];

  if (
    statuses.includes(
      "offline"
    )
  ) {
    return "offline";
  }

  if (
    statuses.includes(
      "critical"
    )
  ) {
    return "critical";
  }

  if (
    statuses.includes(
      "warning"
    )
  ) {
    return "warning";
  }

  return "healthy";
}

function deduplicateServiceChecks(
  services: readonly ServiceCheck[]
): ServiceCheck[] {
  const seen =
    new Set<string>();

  const results:
    ServiceCheck[] = [];

  for (
    const service of
    services
  ) {
    let key =
      service.key;

    let suffix = 2;

    while (
      seen.has(key)
    ) {
      key =
        `${service.key}_${suffix}`;
      suffix += 1;
    }

    seen.add(key);

    results.push({
      ...service,
      key,
    });
  }

  return results;
}

async function withTimeout<T>(
  operation: (
    signal: AbortSignal
  ) => Promise<T>,
  timeoutMs =
    REQUEST_TIMEOUT_MS
): Promise<TimedResult<T>> {
  const controller =
    new AbortController();

  const startedAt =
    performance.now();

  const timeoutId =
    setTimeout(
      () => {
        controller.abort();
      },
      Math.max(
        1,
        timeoutMs
      )
    );

  try {
    const value =
      await operation(
        controller.signal
      );

    return {
      value,
      durationMs:
        Math.max(
          0,
          Math.round(
            performance.now() -
              startedAt
          )
        ),
    };
  } finally {
    clearTimeout(
      timeoutId
    );
  }
}

async function fetchWebsiteHealth(
  siteUrl: string,
  method: "HEAD" | "GET"
): Promise<TimedResult<Response>> {
  return withTimeout(
    (signal) =>
      fetch(siteUrl, {
        method,
        cache: "no-store",
        redirect: "follow",
        signal,
        headers: {
          Accept:
            "text/html,application/xhtml+xml",
          "User-Agent":
            MONITORING_USER_AGENT,
        },
      })
  );
}

async function checkWebsite(
  siteUrl: string | null
): Promise<ServiceCheck> {
  const checkedAt =
    new Date().toISOString();

  if (!siteUrl) {
    return createServiceCheck({
      key: "website",
      label: "Website",
      status: "warning",
      responseTimeMs: null,
      message:
        "NEXT_PUBLIC_SITE_URL or SITE_URL is not configured.",
      checkedAt,
    });
  }

  try {
    let result =
      await fetchWebsiteHealth(
        siteUrl,
        "HEAD"
      );

    /*
     * Some platforms do not implement HEAD even
     * though GET works normally.
     */
    if (
      result.value.status ===
        405 ||
      result.value.status ===
        501
    ) {
      result =
        await fetchWebsiteHealth(
          siteUrl,
          "GET"
        );
    }

    const httpStatus =
      result.value.status;

    const status:
      HealthSeverity =
      result.value.ok
        ? result.durationMs >
          WEBSITE_WARNING_MS
          ? "warning"
          : "healthy"
        : httpStatus >= 500
          ? "critical"
          : "warning";

    return createServiceCheck({
      key: "website",
      label: "Website",
      status,
      responseTimeMs:
        result.durationMs,
      message:
        result.value.ok
          ? `Homepage responded with HTTP ${httpStatus}.`
          : `Homepage returned HTTP ${httpStatus}.`,
      checkedAt,
      metadata: {
        http_status:
          httpStatus,
        url: siteUrl,
        redirected:
          result.value.redirected,
        response_url:
          result.value.url,
      },
    });
  } catch (error) {
    return createServiceCheck({
      key: "website",
      label: "Website",
      status: "offline",
      responseTimeMs: null,
      message:
        isAbortError(error)
          ? "Homepage health check timed out."
          : getErrorMessage(
              error,
              "Homepage could not be reached."
            ),
      checkedAt,
    });
  }
}

async function checkSupabaseAuth(): Promise<ServiceCheck> {
  const checkedAt =
    new Date().toISOString();

  const supabaseUrl =
    getSupabaseUrl();

  const publicKey =
    getSupabasePublicKey();

  if (
    !supabaseUrl ||
    !publicKey
  ) {
    return createServiceCheck({
      key:
        "supabase_auth",
      label:
        "Supabase Auth",
      status: "warning",
      responseTimeMs: null,
      message:
        "Supabase URL or public API key is not configured.",
      checkedAt,
    });
  }

  try {
    const result =
      await withTimeout(
        (signal) =>
          fetch(
            `${supabaseUrl}/auth/v1/health`,
            {
              method: "GET",
              cache: "no-store",
              signal,
              headers: {
                Accept:
                  "application/json",
                apikey:
                  publicKey,
                Authorization:
                  `Bearer ${publicKey}`,
                "User-Agent":
                  MONITORING_USER_AGENT,
              },
            }
          )
      );

    const status:
      HealthSeverity =
      result.value.ok
        ? result.durationMs >
          SUPABASE_WARNING_MS
          ? "warning"
          : "healthy"
        : result.value.status >=
            500
          ? "critical"
          : "warning";

    return createServiceCheck({
      key:
        "supabase_auth",
      label:
        "Supabase Auth",
      status,
      responseTimeMs:
        result.durationMs,
      message:
        result.value.ok
          ? "Authentication service is responding."
          : `Authentication health returned HTTP ${result.value.status}.`,
      checkedAt,
      metadata: {
        http_status:
          result.value.status,
        response_url:
          result.value.url,
      },
    });
  } catch (error) {
    return createServiceCheck({
      key:
        "supabase_auth",
      label:
        "Supabase Auth",
      status: "offline",
      responseTimeMs: null,
      message:
        isAbortError(error)
          ? "Authentication health check timed out."
          : getErrorMessage(
              error,
              "Authentication health check failed."
            ),
      checkedAt,
    });
  }
}

async function checkDatabase(): Promise<ServiceCheck> {
  const checkedAt =
    new Date().toISOString();

  const startedAt =
    performance.now();

  try {
    const controller =
      new AbortController();

    const timeoutId =
      setTimeout(
        () =>
          controller.abort(),
        DATABASE_TIMEOUT_MS
      );

    try {
      const {
        error,
      } =
        await monitoringDb
          .from("cities")
          .select("id")
          .limit(1)
          .abortSignal(
            controller.signal
          );

      const durationMs =
        Math.max(
          0,
          Math.round(
            performance.now() -
              startedAt
          )
        );

      if (error) {
        const message =
          cleanString(
            error.message,
            1_000
          );

        const lowerMessage =
          message.toLowerCase();

        const status:
          HealthSeverity =
          lowerMessage.includes(
            "restricted"
          ) ||
          lowerMessage.includes(
            "quota"
          ) ||
          lowerMessage.includes(
            "egress"
          ) ||
          lowerMessage.includes(
            "read only"
          )
            ? "critical"
            : "warning";

        return createServiceCheck({
          key: "database",
          label: "Database",
          status,
          responseTimeMs:
            durationMs,
          message:
            message ||
            "Database query returned an error.",
          checkedAt,
        });
      }

      return createServiceCheck({
        key: "database",
        label: "Database",
        status:
          durationMs >
          DATABASE_WARNING_MS
            ? "warning"
            : "healthy",
        responseTimeMs:
          durationMs,
        message:
          "Database query completed successfully.",
        checkedAt,
      });
    } finally {
      clearTimeout(
        timeoutId
      );
    }
  } catch (error) {
    return createServiceCheck({
      key: "database",
      label: "Database",
      status: "offline",
      responseTimeMs:
        Math.max(
          0,
          Math.round(
            performance.now() -
              startedAt
          )
        ),
      message:
        isAbortError(error)
          ? "Database health check timed out."
          : getErrorMessage(
              error,
              "Database health check failed."
            ),
      checkedAt,
    });
  }
}

async function checkManagementApi(): Promise<ServiceCheck[]> {
  const checkedAt =
    new Date().toISOString();

  const projectRef =
    cleanString(
      process.env
        .SUPABASE_PROJECT_REF,
      100
    );

  const accessToken =
    cleanString(
      process.env
        .SUPABASE_MANAGEMENT_ACCESS_TOKEN,
      4_000
    );

  if (
    !projectRef ||
    !accessToken
  ) {
    return [
      createServiceCheck({
        key:
          "supabase_management",
        label:
          "Supabase Management API",
        status: "warning",
        responseTimeMs: null,
        message:
          "Management API credentials are not configured.",
        checkedAt,
      }),
    ];
  }

  if (
    !PROJECT_REF_REGEX.test(
      projectRef
    )
  ) {
    return [
      createServiceCheck({
        key:
          "supabase_management",
        label:
          "Supabase Management API",
        status: "warning",
        responseTimeMs: null,
        message:
          "SUPABASE_PROJECT_REF is not in a valid project-reference format.",
        checkedAt,
      }),
    ];
  }

  const healthUrl =
    buildManagementHealthUrl(
      projectRef
    );

  try {
    const result =
      await withTimeout(
        (signal) =>
          fetch(
            healthUrl,
            {
              method: "GET",
              cache: "no-store",
              redirect: "follow",
              signal,
              headers: {
                Accept:
                  "application/json",
                Authorization:
                  `Bearer ${accessToken}`,
                "User-Agent":
                  MONITORING_USER_AGENT,
              },
            }
          )
      );

    if (!result.value.ok) {
      const errorMessage =
        await readErrorResponse(
          result.value
        );

      return [
        createServiceCheck({
          key:
            "supabase_management",
          label:
            "Supabase Management API",
          status:
            result.value.status >=
            500
              ? "critical"
              : "warning",
          responseTimeMs:
            result.durationMs,
          message:
            errorMessage
              ? `Management API returned HTTP ${result.value.status}: ${errorMessage}`
              : `Management API returned HTTP ${result.value.status}.`,
          checkedAt,
          metadata: {
            http_status:
              result.value.status,
            requested_services:
              [
                ...MANAGEMENT_HEALTH_SERVICES,
              ],
          },
        }),
      ];
    }

    const payload: unknown =
      await result.value
        .json()
        .catch(() => null);

    const items =
      parseManagementHealthItems(
        payload
      );

    if (
      items.length === 0
    ) {
      return [
        createServiceCheck({
          key:
            "supabase_management",
          label:
            "Supabase Management API",
          status: "warning",
          responseTimeMs:
            result.durationMs,
          message:
            "Management API responded successfully but returned no service health records.",
          checkedAt,
          metadata: {
            http_status:
              result.value.status,
            requested_services:
              [
                ...MANAGEMENT_HEALTH_SERVICES,
              ],
          },
        }),
      ];
    }

    return items.map(
      (
        item,
        index
      ) => {
        const rawName =
          cleanString(
            item.name,
            120
          ) ||
          `service_${index + 1}`;

        const serviceKey =
          normaliseServiceKey(
            rawName,
            `service_${index + 1}`
          );

        const rawStatus =
          cleanString(
            item.status,
            120
          );

        const healthy =
          typeof item.healthy ===
          "boolean"
            ? item.healthy
            : null;

        const severity:
          HealthSeverity =
          healthy !== null
            ? healthy
              ? "healthy"
              : "critical"
            : mapManagementStatus(
                rawStatus
              );

        const itemMessage =
          cleanString(
            item.message,
            500
          );

        return createServiceCheck({
          key:
            `supabase_management_${serviceKey}`,
          label:
            `Supabase ${formatServiceLabel(
              rawName
            )}`,
          status:
            severity,
          responseTimeMs:
            result.durationMs,
          message:
            itemMessage ||
            rawStatus ||
            (severity ===
            "healthy"
              ? "Service is active and healthy."
              : "Service health requires attention."),
          checkedAt,
          metadata: {
            http_status:
              result.value.status,
            service_name:
              rawName,
            healthy,
            raw_status:
              rawStatus || null,
            info:
              sanitiseMetadataValue(
                item.info
              ) ?? null,
          },
        });
      }
    );
  } catch (error) {
    return [
      createServiceCheck({
        key:
          "supabase_management",
        label:
          "Supabase Management API",
        status: "offline",
        responseTimeMs: null,
        message:
          isAbortError(error)
            ? "Management API health check timed out."
            : getErrorMessage(
                error,
                "Management API health check failed."
              ),
        checkedAt,
        metadata: {
          requested_services:
            [
              ...MANAGEMENT_HEALTH_SERVICES,
            ],
        },
      }),
    ];
  }
}

async function countTable(
  definition: ApplicationMetricDefinition
): Promise<ApplicationMetric> {
  const startedAt =
    performance.now();

  const controller =
    new AbortController();

  const timeoutId =
    setTimeout(
      () =>
        controller.abort(),
      APPLICATION_METRIC_TIMEOUT_MS
    );

  try {
    const {
      count,
      error,
    } =
      await monitoringDb
        .from(
          definition.table
        )
        .select("id", {
          count: "exact",
          head: true,
        })
        .abortSignal(
          controller.signal
        );

    const durationMs =
      Math.max(
        0,
        Math.round(
          performance.now() -
            startedAt
        )
      );

    if (error) {
      return {
        key:
          definition.table,
        label:
          definition.label,
        value: null,
        status: "warning",
        message:
          cleanString(
            error.message,
            1_000
          ) ||
          "Record count unavailable.",
        metadata: {
          response_time_ms:
            durationMs,
        },
      };
    }

    return {
      key:
        definition.table,
      label:
        definition.label,
      value:
        typeof count ===
          "number"
          ? count
          : 0,
      status: "healthy",
      metadata: {
        response_time_ms:
          durationMs,
      },
    };
  } catch (error) {
    return {
      key:
        definition.table,
      label:
        definition.label,
      value: null,
      status: "warning",
      message:
        isAbortError(error)
          ? "Record count timed out."
          : getErrorMessage(
              error,
              "Record count unavailable."
            ),
      metadata: {
        response_time_ms:
          Math.max(
            0,
            Math.round(
              performance.now() -
                startedAt
            )
          ),
      },
    };
  } finally {
    clearTimeout(
      timeoutId
    );
  }
}

async function getApplicationMetrics(
  mode: HealthCheckMode
): Promise<ApplicationMetric[]> {
  if (
    mode === "lightweight"
  ) {
    return [];
  }

  return Promise.all(
    APPLICATION_METRICS.map(
      (definition) =>
        countTable(
          definition
        )
    )
  );
}

function buildUsageMetric({
  key,
  label,
  used,
  limit,
  unit,
}: {
  key: string;
  label: string;
  used: number | null;
  limit: number | null;
  unit: string;
}): UsageMetric {
  const percentage =
    used !== null &&
    limit !== null &&
    limit > 0
      ? Math.min(
          100,
          Math.max(
            0,
            (used / limit) *
              100
          )
        )
      : null;

  return {
    key:
      cleanString(
        key,
        100
      ),
    label:
      cleanString(
        label,
        180
      ),
    used,
    limit,
    unit:
      cleanString(
        unit,
        40
      ),
    percentage:
      percentage === null
        ? null
        : Math.round(
            percentage * 100
          ) / 100,
    source:
      percentage === null
        ? "unavailable"
        : "configuration",
    estimated: true,
    status:
      percentage === null
        ? "warning"
        : percentage >= 95
          ? "critical"
          : percentage >= 70
            ? "warning"
            : "healthy",
    message:
      percentage === null
        ? "Usage data has not been configured."
        : `${percentage.toFixed(
            1
          )}% of the configured quota is in use.`,
  };
}

function getConfiguredUsageMetrics(): UsageMetric[] {
  return USAGE_METRICS.map(
    (definition) =>
      buildUsageMetric({
        key:
          definition.key,
        label:
          definition.label,
        used:
          parseOptionalNumber(
            getEnvironmentValue(
              definition.usedEnvironmentVariable
            )
          ),
        limit:
          parseOptionalNumber(
            getEnvironmentValue(
              definition.limitEnvironmentVariable
            )
          ),
        unit:
          definition.unit,
      })
  );
}

function validateSnapshot(
  snapshot: SystemHealthSnapshot
): void {
  if (
    !snapshot.checked_at ||
    Number.isNaN(
      new Date(
        snapshot.checked_at
      ).getTime()
    )
  ) {
    throw new Error(
      "System health snapshot has an invalid checked_at value."
    );
  }

  if (
    !Array.isArray(
      snapshot.services
    ) ||
    snapshot.services.length ===
      0
  ) {
    throw new Error(
      "System health snapshot must contain at least one service result."
    );
  }

  if (
    !Number.isFinite(
      snapshot.response_time_ms
    ) ||
    snapshot.response_time_ms <
      0
  ) {
    throw new Error(
      "System health snapshot has an invalid response time."
    );
  }
}

export async function collectSystemHealth(
  mode: HealthCheckMode
): Promise<SystemHealthSnapshot> {
  const startedAt =
    performance.now();

  const checkedAt =
    new Date().toISOString();

  const [
    website,
    auth,
    database,
    management,
    application,
  ] = await Promise.all([
    checkWebsite(
      getSiteUrl()
    ),
    checkSupabaseAuth(),
    checkDatabase(),
    checkManagementApi(),
    getApplicationMetrics(
      mode
    ),
  ]);

  const services =
    deduplicateServiceChecks([
      website,
      auth,
      database,
      ...management,
    ]);

  const usage =
    getConfiguredUsageMetrics();

  const snapshot:
    SystemHealthSnapshot =
    {
      overall_status:
        getOverallStatus(
          services,
          application
        ),
      mode,
      services,
      usage,
      application,
      response_time_ms:
        Math.max(
          0,
          Math.round(
            performance.now() -
              startedAt
          )
        ),
      checked_at:
        checkedAt,
      metadata: {
        project_ref_configured:
          Boolean(
            cleanString(
              process.env
                .SUPABASE_PROJECT_REF,
              100
            )
          ),
        management_api_configured:
          Boolean(
            cleanString(
              process.env
                .SUPABASE_MANAGEMENT_ACCESS_TOKEN,
              4_000
            )
          ),
        site_url:
          getSiteUrl(),
        version: 1,
        monitored_services:
          services.length,
        application_metrics:
          application.length,
        usage_metrics:
          usage.length,
      },
    };

  validateSnapshot(
    snapshot
  );

  return snapshot;
}

export async function persistSystemHealthSnapshot(
  snapshot: SystemHealthSnapshot
): Promise<string> {
  validateSnapshot(
    snapshot
  );

  const failedServices =
    snapshot.services.filter(
      (service) =>
        service.status ===
          "critical" ||
        service.status ===
          "offline"
    );

  const warningServices =
    snapshot.services.filter(
      (service) =>
        service.status ===
        "warning"
    );

  const {
    data,
    error,
  } =
    await monitoringDb
      .from(
        "system_health_snapshots"
      )
      .insert({
        overall_status:
          snapshot.overall_status,
        mode:
          snapshot.mode,
        service_status:
          snapshot.services,
        metrics: {
          usage:
            snapshot.usage,
          application:
            snapshot.application,
          metadata:
            snapshot.metadata,
        },
        error_summary: {
          failed_services:
            failedServices,
          warning_services:
            warningServices,
          failed_count:
            failedServices.length,
          warning_count:
            warningServices.length,
        },
        usage_summary:
          snapshot.usage,
        response_time_ms:
          snapshot.response_time_ms,
        checked_at:
          snapshot.checked_at,
      })
      .select("id")
      .single();

  if (error) {
    throw new Error(
      `Could not save system health snapshot: ${cleanString(
        error.message,
        1_000
      )}`
    );
  }

  const id =
    cleanString(
      data?.id,
      120
    );

  if (!id) {
    throw new Error(
      "The system health snapshot was saved but no snapshot ID was returned."
    );
  }

  return id;
}

function getRetentionCutoff(
  retentionDays: number
): string {
  return new Date(
    Date.now() -
      retentionDays *
        24 *
        60 *
        60 *
        1_000
  ).toISOString();
}

export async function pruneSystemHealthHistory(): Promise<void> {
  const lightweightCutoff =
    getRetentionCutoff(
      LIGHTWEIGHT_RETENTION_DAYS
    );

  const dailyCutoff =
    getRetentionCutoff(
      DAILY_RETENTION_DAYS
    );

  const results =
    await Promise.allSettled([
      monitoringDb
        .from(
          "system_health_snapshots"
        )
        .delete()
        .eq(
          "mode",
          "lightweight"
        )
        .lt(
          "checked_at",
          lightweightCutoff
        ),

      monitoringDb
        .from(
          "system_health_snapshots"
        )
        .delete()
        .eq(
          "mode",
          "daily"
        )
        .lt(
          "checked_at",
          dailyCutoff
        ),
    ]);

  const errors: string[] =
    [];

  for (
    const result of results
  ) {
    if (
      result.status ===
      "rejected"
    ) {
      errors.push(
        getErrorMessage(
          result.reason,
          "Unknown retention error."
        )
      );

      continue;
    }

    if (
      result.value.error
    ) {
      errors.push(
        cleanString(
          result.value.error
            .message,
          1_000
        )
      );
    }
  }

  if (
    errors.length > 0
  ) {
    throw new Error(
      `Could not prune system health history: ${errors.join(
        " | "
      )}`
    );
  }
}