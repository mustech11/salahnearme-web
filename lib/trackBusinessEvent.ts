export type BusinessEventType =
  | "profile_view"
  | "profile_click"
  | "phone_click"
  | "website_click"
  | "maps_click"
  | "sponsor_impression"
  | "sponsor_click";

export type TrackBusinessEventArgs = {
  businessId: string;
  eventType: BusinessEventType;
  source?: string;
  pageType?: string;
  citySlug?: string | null;
  metadata?: Record<string, unknown>;
};

type MetadataValue =
  | string
  | number
  | boolean
  | null
  | MetadataValue[]
  | {
      [key: string]: MetadataValue;
    };

type TrackPayload = {
  business_id: string;
  event_type: BusinessEventType;
  source: string;
  metadata: Record<string, MetadataValue>;
};

const TRACK_EVENT_URL =
  "/api/business/track-event";

const ALLOWED_EVENT_TYPES =
  new Set<BusinessEventType>([
    "profile_view",
    "profile_click",
    "phone_click",
    "website_click",
    "maps_click",
    "sponsor_impression",
    "sponsor_click",
  ]);

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const FINGERPRINT_STORAGE_KEY = "snm_fp";
const SESSION_STORAGE_KEY = "snm_session";

const MAX_TEXT_LENGTH = 1_000;
const MAX_SOURCE_LENGTH = 120;
const MAX_METADATA_DEPTH = 4;
const MAX_METADATA_KEYS = 50;
const MAX_ARRAY_ITEMS = 50;

function cleanText(
  value: string | null | undefined,
  maxLength = MAX_TEXT_LENGTH
): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const cleaned = value
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);

  return cleaned || undefined;
}

function createRandomIdentifier(
  prefix: string
): string {
  try {
    if (
      typeof globalThis.crypto?.randomUUID ===
      "function"
    ) {
      return `${prefix}_${globalThis.crypto.randomUUID()}`;
    }
  } catch {
    // Continue to fallback.
  }

  return `${prefix}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 14)}`;
}

function getStoredIdentifier(
  storage: Storage,
  key: string,
  prefix: string
): string {
  try {
    const existing = storage.getItem(key);

    if (existing) {
      return existing;
    }

    const created =
      createRandomIdentifier(prefix);

    storage.setItem(key, created);

    return created;
  } catch {
    return createRandomIdentifier(prefix);
  }
}

function getFingerprint(): string {
  if (typeof window === "undefined") {
    return "server";
  }

  return getStoredIdentifier(
    window.localStorage,
    FINGERPRINT_STORAGE_KEY,
    "fp"
  );
}

function getSessionIdentifier(): string {
  if (typeof window === "undefined") {
    return "server";
  }

  return getStoredIdentifier(
    window.sessionStorage,
    SESSION_STORAGE_KEY,
    "session"
  );
}

function sanitiseMetadataValue(
  value: unknown,
  depth = 0
): MetadataValue | undefined {
  if (depth > MAX_METADATA_DEPTH) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value)
      ? value
      : undefined;
  }

  if (typeof value === "string") {
    return cleanText(value) ?? "";
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) =>
        sanitiseMetadataValue(item, depth + 1)
      )
      .filter(
        (item): item is MetadataValue =>
          item !== undefined
      );
  }

  if (
    typeof value === "object" &&
    value !== null
  ) {
    const output: Record<
      string,
      MetadataValue
    > = {};

    const entries = Object.entries(
      value as Record<string, unknown>
    ).slice(0, MAX_METADATA_KEYS);

    for (const [rawKey, rawValue] of entries) {
      const key = cleanText(rawKey, 100);

      if (!key) {
        continue;
      }

      const sanitisedValue =
        sanitiseMetadataValue(
          rawValue,
          depth + 1
        );

      if (sanitisedValue !== undefined) {
        output[key] = sanitisedValue;
      }
    }

    return output;
  }

  return undefined;
}

function sanitiseMetadata(
  metadata: Record<string, unknown> | undefined
): Record<string, MetadataValue> {
  if (!metadata) {
    return {};
  }

  const value = sanitiseMetadataValue(metadata);

  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value;
  }

  return {};
}

function getRuntimeMetadata(): Record<
  string,
  MetadataValue
> {
  if (typeof window === "undefined") {
    return {};
  }

  const connection =
    "connection" in navigator
      ? (
          navigator as Navigator & {
            connection?: {
              effectiveType?: string;
              saveData?: boolean;
            };
          }
        ).connection
      : undefined;

  return {
    pathname: window.location.pathname,
    search: window.location.search || null,
    referrer: document.referrer || null,
    page_title: document.title || null,
    viewport_width: window.innerWidth,
    viewport_height: window.innerHeight,
    language: navigator.language || null,
    visibility_state:
      document.visibilityState,
    online: navigator.onLine,
    connection_type:
      connection?.effectiveType ?? null,
    save_data:
      connection?.saveData ?? null,
  };
}

function buildPayload({
  businessId,
  eventType,
  source,
  pageType,
  citySlug,
  metadata,
}: TrackBusinessEventArgs): TrackPayload | null {
  const cleanBusinessId = cleanText(
    businessId,
    80
  );

  if (
    !cleanBusinessId ||
    !UUID_REGEX.test(cleanBusinessId) ||
    !ALLOWED_EVENT_TYPES.has(eventType)
  ) {
    return null;
  }

  const cleanSource =
    cleanText(source, MAX_SOURCE_LENGTH) ??
    "public_business_page";

  const cleanPageType = cleanText(
    pageType,
    MAX_SOURCE_LENGTH
  );

  const cleanCitySlug = cleanText(
    citySlug,
    200
  );

  return {
    business_id: cleanBusinessId,
    event_type: eventType,
    source: cleanSource,
    metadata: {
      ...sanitiseMetadata(metadata),
      ...getRuntimeMetadata(),
      page_type: cleanPageType ?? null,
      city_slug: cleanCitySlug ?? null,
      user_fingerprint: getFingerprint(),
      session_id: getSessionIdentifier(),
      event_timestamp:
        new Date().toISOString(),
    },
  };
}

function sendWithBeacon(
  payload: TrackPayload
): boolean {
  if (
    typeof navigator === "undefined" ||
    typeof navigator.sendBeacon !== "function"
  ) {
    return false;
  }

  try {
    const blob = new Blob(
      [JSON.stringify(payload)],
      {
        type: "application/json",
      }
    );

    return navigator.sendBeacon(
      TRACK_EVENT_URL,
      blob
    );
  } catch {
    return false;
  }
}

async function sendWithFetch(
  payload: TrackPayload
): Promise<boolean> {
  try {
    const response = await fetch(
      TRACK_EVENT_URL,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        cache: "no-store",
        keepalive: true,
        body: JSON.stringify(payload),
      }
    );

    return response.ok;
  } catch {
    return false;
  }
}

export async function trackBusinessEvent(
  args: TrackBusinessEventArgs
): Promise<boolean> {
  const payload = buildPayload(args);

  if (!payload) {
    return false;
  }

  if (sendWithBeacon(payload)) {
    return true;
  }

  return sendWithFetch(payload);
}