import { createHash } from "crypto";

import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const ALLOWED_EVENTS = [
  "pray_near_me_impression",
  "pray_near_me_best_shown",
  "mosque_profile_click",
  "mosque_maps_click",
  "mosque_timetable_click",
] as const;

type MosqueEventType =
  (typeof ALLOWED_EVENTS)[number];

type Body = {
  mosque_id?: unknown;
  event_type?: unknown;
  source?: unknown;
  metadata?: unknown;
  website?: unknown;
};

type SafeMetadata = Record<
  string,
  string | number | boolean | null
>;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_SOURCE_LENGTH = 80;
const MAX_METADATA_KEYS = 25;
const MAX_METADATA_VALUE_LENGTH = 300;
const MAX_USER_AGENT_LENGTH = 500;
const MAX_REQUEST_BODY_BYTES = 12_000;
const RATE_LIMIT_WINDOW_MINUTES = 10;
const MAX_EVENTS_PER_WINDOW = 120;

const DUPLICATE_WINDOW_SECONDS_BY_EVENT: Record<
  MosqueEventType,
  number
> = {
  pray_near_me_impression: 20,
  pray_near_me_best_shown: 30,
  mosque_profile_click: 15,
  mosque_maps_click: 15,
  mosque_timetable_click: 15,
};

function jsonResponse(
  body: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control":
        "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function cleanString(
  value: unknown,
  maxLength = 250
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

  return cleaned || null;
}

function isUuid(
  value: string | null
): value is string {
  return Boolean(
    value &&
      UUID_REGEX.test(value)
  );
}

function isPlainObject(
  value: unknown
): value is Record<string, unknown> {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value)
  );
}

function isJsonRequest(
  request: Request
): boolean {
  return Boolean(
    request.headers
      .get("content-type")
      ?.toLowerCase()
      .includes("application/json")
  );
}

function isAllowedEvent(
  value: unknown
): value is MosqueEventType {
  return (
    typeof value === "string" &&
    ALLOWED_EVENTS.includes(
      value as MosqueEventType
    )
  );
}

function cleanSource(
  value: unknown
): string {
  return (
    cleanString(
      value,
      MAX_SOURCE_LENGTH
    ) ?? "unknown"
  );
}

function cleanMetadata(
  value: unknown
): SafeMetadata {
  if (!isPlainObject(value)) {
    return {};
  }

  const output: SafeMetadata = {};

  for (const [key, rawValue] of Object.entries(
    value
  ).slice(0, MAX_METADATA_KEYS)) {
    const safeKey = key
      .replace(/\u0000/g, "")
      .replace(/\s+/g, "_")
      .trim()
      .slice(0, 80);

    if (!safeKey) {
      continue;
    }

    if (
      typeof rawValue ===
      "string"
    ) {
      output[safeKey] =
        rawValue
          .replace(
            /\u0000/g,
            ""
          )
          .trim()
          .slice(
            0,
            MAX_METADATA_VALUE_LENGTH
          );

      continue;
    }

    if (
      typeof rawValue ===
        "number" &&
      Number.isFinite(rawValue)
    ) {
      output[safeKey] =
        rawValue;
      continue;
    }

    if (
      typeof rawValue ===
        "boolean" ||
      rawValue === null
    ) {
      output[safeKey] =
        rawValue;
    }
  }

  return output;
}

function getClientIp(
  request: Request
): string | null {
  const cfIp =
    request.headers.get(
      "cf-connecting-ip"
    );

  const forwardedFor =
    request.headers.get(
      "x-forwarded-for"
    );

  const realIp =
    request.headers.get(
      "x-real-ip"
    );

  if (cfIp) {
    return (
      cfIp.split(",")[0]?.trim() ||
      null
    );
  }

  if (forwardedFor) {
    return (
      forwardedFor
        .split(",")[0]
        ?.trim() || null
    );
  }

  return realIp?.trim() || null;
}

function getFingerprint(
  request: Request
): string | null {
  const ip = getClientIp(request);

  const userAgent =
    request.headers
      .get("user-agent")
      ?.slice(
        0,
        MAX_USER_AGENT_LENGTH
      ) ?? "";

  const language =
    request.headers.get(
      "accept-language"
    ) ?? "";

  const raw = [
    ip ?? "",
    userAgent,
    language,
  ].join("|");

  return raw.replace(/\|/g, "")
    ? createHash("sha256")
        .update(raw)
        .digest("hex")
    : null;
}

function getDuplicateSinceIso(
  eventType: MosqueEventType
): string {
  const seconds =
    DUPLICATE_WINDOW_SECONDS_BY_EVENT[
      eventType
    ];

  return new Date(
    Date.now() -
      seconds * 1000
  ).toISOString();
}

function minutesAgoIso(
  minutes: number
): string {
  return new Date(
    Date.now() -
      minutes * 60 * 1000
  ).toISOString();
}

async function readBody(
  request: Request
): Promise<Body | null> {
  const contentLength = Number(
    request.headers.get(
      "content-length"
    )
  );

  if (
    Number.isFinite(
      contentLength
    ) &&
    contentLength >
      MAX_REQUEST_BODY_BYTES
  ) {
    return null;
  }

  try {
    const value: unknown =
      await request.json();

    return isPlainObject(value)
      ? (value as Body)
      : null;
  } catch {
    return null;
  }
}

async function mosqueExists(
  mosqueId: string
) {
  const {
    data,
    error,
  } = await supabaseAdmin
    .from("mosques")
    .select("id")
    .eq("id", mosqueId)
    .maybeSingle();

  if (error) {
    console.error(
      "Mosque analytics mosque lookup failed:",
      {
        mosqueId,
        code: error.code,
        message: error.message,
      }
    );

    return {
      ok: false,
      exists: false,
    };
  }

  return {
    ok: true,
    exists: Boolean(data),
  };
}

async function isRecentDuplicateEvent({
  mosqueId,
  eventType,
  source,
  fingerprint,
}: {
  mosqueId: string;
  eventType: MosqueEventType;
  source: string;
  fingerprint: string | null;
}) {
  const since =
    getDuplicateSinceIso(
      eventType
    );

  let query = supabaseAdmin
    .from("mosque_analytics")
    .select(
      "id,source,metadata,created_at"
    )
    .eq(
      "mosque_id",
      mosqueId
    )
    .eq(
      "event_type",
      eventType
    )
    .eq("source", source)
    .gte(
      "created_at",
      since
    )
    .order("created_at", {
      ascending: false,
    })
    .limit(10);

  const {
    data,
    error,
  } = await query;

  if (error) {
    console.error(
      "Mosque analytics duplicate check failed:",
      {
        mosqueId,
        eventType,
        code: error.code,
        message: error.message,
      }
    );

    return false;
  }

  if (
    !data ||
    data.length === 0
  ) {
    return false;
  }

  if (!fingerprint) {
    return true;
  }

  return data.some(
    (event) => {
      const metadata =
        isPlainObject(
          event.metadata
        )
          ? event.metadata
          : null;

      return (
        cleanString(
          metadata?.fingerprint,
          64
        ) === fingerprint
      );
    }
  );
}

async function isRateLimited(
  fingerprint: string | null
): Promise<boolean> {
  if (!fingerprint) {
    return false;
  }

  const since =
    minutesAgoIso(
      RATE_LIMIT_WINDOW_MINUTES
    );

  const {
    count,
    error,
  } = await supabaseAdmin
    .from("mosque_analytics")
    .select("*", {
      count: "exact",
      head: true,
    })
    .contains("metadata", {
      fingerprint,
    })
    .gte(
      "created_at",
      since
    );

  if (error) {
    console.error(
      "Mosque analytics rate-limit check failed:",
      {
        code: error.code,
        message: error.message,
      }
    );

    return false;
  }

  return (
    (count ?? 0) >=
    MAX_EVENTS_PER_WINDOW
  );
}

export async function GET() {
  return jsonResponse({
    ok: true,
    route:
      "/api/mosque/track-event",
    method: "POST",
    allowed_events:
      ALLOWED_EVENTS,
    duplicate_window_seconds_by_event:
      DUPLICATE_WINDOW_SECONDS_BY_EVENT,
    limits: {
      rate_limit_window_minutes:
        RATE_LIMIT_WINDOW_MINUTES,
      max_events_per_window:
        MAX_EVENTS_PER_WINDOW,
      max_metadata_keys:
        MAX_METADATA_KEYS,
    },
  });
}

export async function POST(
  request: Request
) {
  try {
    if (!isJsonRequest(request)) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Content-Type must be application/json.",
        },
        415
      );
    }

    const body =
      await readBody(request);

    if (!body) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Invalid JSON body.",
        },
        400
      );
    }

    if (
      cleanString(
        body.website,
        200
      )
    ) {
      return jsonResponse({
        ok: true,
        ignored: true,
      });
    }

    const mosqueId =
      cleanString(
        body.mosque_id,
        80
      );

    if (!isUuid(mosqueId)) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Missing or invalid mosque_id.",
        },
        400
      );
    }

    if (
      !isAllowedEvent(
        body.event_type
      )
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Invalid event_type.",
          allowed_events:
            ALLOWED_EVENTS,
        },
        400
      );
    }

    const eventType =
      body.event_type;

    const source =
      cleanSource(body.source);

    const metadata =
      cleanMetadata(
        body.metadata
      );

    const fingerprint =
      getFingerprint(request);

    const mosqueCheck =
      await mosqueExists(
        mosqueId
      );

    if (!mosqueCheck.ok) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Could not verify mosque.",
        },
        500
      );
    }

    if (
      !mosqueCheck.exists
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Mosque not found.",
        },
        404
      );
    }

    if (
      await isRateLimited(
        fingerprint
      )
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Too many analytics events were submitted recently.",
        },
        429
      );
    }

    const duplicate =
      await isRecentDuplicateEvent({
        mosqueId,
        eventType,
        source,
        fingerprint,
      });

    if (duplicate) {
      return jsonResponse({
        ok: true,
        duplicate_ignored: true,
      });
    }

    const trackedAt =
      new Date().toISOString();

    const safeMetadata = {
      ...metadata,
      tracked_at: trackedAt,
      fingerprint,
      anti_abuse: {
        duplicate_window_seconds:
          DUPLICATE_WINDOW_SECONDS_BY_EVENT[
            eventType
          ],
      },
    };

    const {
      data,
      error,
    } = await supabaseAdmin
      .from(
        "mosque_analytics"
      )
      .insert({
        mosque_id: mosqueId,
        event_type:
          eventType,
        source,
        metadata:
          safeMetadata,
        ip: getClientIp(
          request
        ),
        user_agent:
          request.headers
            .get(
              "user-agent"
            )
            ?.slice(
              0,
              MAX_USER_AGENT_LENGTH
            ) ?? null,
      })
      .select(
        "id,mosque_id,event_type,source,created_at"
      )
      .single();

    if (error) {
      console.error(
        "Mosque analytics insert failed:",
        {
          mosqueId,
          eventType,
          code: error.code,
          message: error.message,
        }
      );

      return jsonResponse(
        {
          ok: false,
          error:
            "Could not track mosque event.",
        },
        500
      );
    }

    return jsonResponse(
      {
        ok: true,
        message:
          "Mosque event tracked successfully.",
        event_id:
          typeof data?.id ===
          "string"
            ? data.id
            : null,
        event: data,
      },
      201
    );
  } catch (error) {
    console.error(
      "Mosque track-event route failed:",
      error
    );

    return jsonResponse(
      {
        ok: false,
        error:
          "Could not track mosque event.",
      },
      500
    );
  }
}