import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_EVENTS = [
  "pray_near_me_impression",
  "pray_near_me_best_shown",
  "mosque_profile_click",
  "mosque_maps_click",
  "mosque_timetable_click",
] as const;

const MAX_SOURCE_LENGTH = 80;
const MAX_METADATA_KEYS = 25;
const MAX_METADATA_VALUE_LENGTH = 300;
const MAX_USER_AGENT_LENGTH = 500;

const DUPLICATE_WINDOW_SECONDS_BY_EVENT: Record<MosqueEventType, number> = {
  pray_near_me_impression: 20,
  pray_near_me_best_shown: 30,
  mosque_profile_click: 15,
  mosque_maps_click: 15,
  mosque_timetable_click: 15,
};

type MosqueEventType = (typeof ALLOWED_EVENTS)[number];

type Body = {
  mosque_id?: unknown;
  event_type?: unknown;
  source?: unknown;
  metadata?: unknown;

  /**
   * Honeypot field.
   * Real frontend should leave this empty.
   */
  website?: unknown;
};

type SafeMetadata = Record<string, string | number | boolean | null>;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function cleanString(value: unknown, maxLength = 250) {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return null;
  }

  return cleaned.slice(0, maxLength);
}

function isUuid(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim()
  );
}

function isAllowedEvent(value: unknown): value is MosqueEventType {
  return (
    typeof value === "string" &&
    ALLOWED_EVENTS.includes(value as MosqueEventType)
  );
}

function cleanSource(value: unknown) {
  return cleanString(value, MAX_SOURCE_LENGTH) ?? "unknown";
}

function cleanMetadata(value: unknown): SafeMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const input = value as Record<string, unknown>;
  const output: SafeMetadata = {};

  for (const [key, rawValue] of Object.entries(input).slice(
    0,
    MAX_METADATA_KEYS
  )) {
    const safeKey = key
      .replace(/\u0000/g, "")
      .replace(/\s+/g, "_")
      .trim()
      .slice(0, 80);

    if (!safeKey) {
      continue;
    }

    if (typeof rawValue === "string") {
      output[safeKey] = rawValue
        .replace(/\u0000/g, "")
        .trim()
        .slice(0, MAX_METADATA_VALUE_LENGTH);
      continue;
    }

    if (
      typeof rawValue === "number" ||
      typeof rawValue === "boolean" ||
      rawValue === null
    ) {
      output[safeKey] = rawValue;
    }
  }

  return output;
}

function getClientIp(req: Request) {
  const cfIp = req.headers.get("cf-connecting-ip");
  const forwardedFor = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");

  if (cfIp) {
    return cfIp.split(",")[0]?.trim() || null;
  }

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || null;
  }

  if (realIp) {
    return realIp.trim();
  }

  return null;
}

function hasHoneypotValue(body: Body) {
  return Boolean(cleanString(body.website, 200));
}

function getDuplicateSinceIso(eventType: MosqueEventType) {
  const windowSeconds = DUPLICATE_WINDOW_SECONDS_BY_EVENT[eventType] ?? 15;
  const date = new Date();

  date.setSeconds(date.getSeconds() - windowSeconds);

  return date.toISOString();
}

async function mosqueExists(mosqueId: string) {
  const { data, error } = await supabaseAdmin
    .from("mosques")
    .select("id")
    .eq("id", mosqueId)
    .maybeSingle();

  if (error) {
    console.error("mosque track event lookup error:", error);
    return {
      ok: false,
      exists: false,
      error: "Could not verify mosque.",
    };
  }

  return {
    ok: true,
    exists: Boolean(data),
    error: null,
  };
}

async function isRecentDuplicateEvent({
  mosqueId,
  eventType,
  source,
  ip,
}: {
  mosqueId: string;
  eventType: MosqueEventType;
  source: string;
  ip: string | null;
}) {
  const since = getDuplicateSinceIso(eventType);

  let query = supabaseAdmin
    .from("mosque_analytics")
    .select("id, source, ip, created_at")
    .eq("mosque_id", mosqueId)
    .eq("event_type", eventType)
    .gte("created_at", since)
    .order("created_at", {
      ascending: false,
    })
    .limit(10);

  if (source) {
    query = query.eq("source", source);
  }

  const { data, error } = await query;

  if (error) {
    console.error("mosque duplicate analytics lookup error:", error);
    return false;
  }

  if (!data || data.length === 0) {
    return false;
  }

  if (!ip) {
    return data.length > 0;
  }

  return data.some((event) => event.ip === ip);
}

export async function GET() {
  return jsonResponse({
    ok: true,
    route: "/api/mosque/track-event",
    method: "POST",
    allowed_events: ALLOWED_EVENTS,
    duplicate_window_seconds_by_event: DUPLICATE_WINDOW_SECONDS_BY_EVENT,
    usage: {
      body: {
        mosque_id: "uuid",
        event_type: "mosque_profile_click",
        source: "pray_near_me",
        metadata: {},
        website: "honeypot optional; leave empty",
      },
    },
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as Body | null;

    if (!body) {
      return jsonResponse(
        {
          ok: false,
          error: "Invalid JSON body.",
        },
        400
      );
    }

    /**
     * Honeypot: pretend success but save nothing.
     * This reduces bot feedback.
     */
    if (hasHoneypotValue(body)) {
      return jsonResponse({
        ok: true,
        ignored: true,
      });
    }

    const mosqueId = cleanString(body.mosque_id, 80);
    const source = cleanSource(body.source);

    if (!isUuid(mosqueId)) {
      return jsonResponse(
        {
          ok: false,
          error: "Missing or invalid mosque_id.",
        },
        400
      );
    }

    if (!isAllowedEvent(body.event_type)) {
      return jsonResponse(
        {
          ok: false,
          error: "Invalid event_type.",
          allowed_events: ALLOWED_EVENTS,
        },
        400
      );
    }

    const eventType = body.event_type;
    const metadata = cleanMetadata(body.metadata);
    const ip = getClientIp(req);
    const userAgent =
      req.headers.get("user-agent")?.slice(0, MAX_USER_AGENT_LENGTH) ?? null;

    const mosqueCheck = await mosqueExists(mosqueId);

    if (!mosqueCheck.ok) {
      return jsonResponse(
        {
          ok: false,
          error: mosqueCheck.error,
        },
        500
      );
    }

    if (!mosqueCheck.exists) {
      return jsonResponse(
        {
          ok: false,
          error: "Mosque not found.",
        },
        404
      );
    }

    const duplicate = await isRecentDuplicateEvent({
      mosqueId,
      eventType,
      source,
      ip,
    });

    if (duplicate) {
      return jsonResponse({
        ok: true,
        duplicate_ignored: true,
      });
    }

    const safeMetadata = {
      ...metadata,
      tracked_at: new Date().toISOString(),
      anti_abuse: {
        duplicate_window_seconds:
          DUPLICATE_WINDOW_SECONDS_BY_EVENT[eventType],
      },
    };

    const { data, error } = await supabaseAdmin
      .from("mosque_analytics")
      .insert({
        mosque_id: mosqueId,
        event_type: eventType,
        source,
        metadata: safeMetadata,
        ip,
        user_agent: userAgent,
      })
      .select("id, mosque_id, event_type, source, created_at")
      .single();

    if (error) {
      console.error("mosque track event insert error:", error);

      return jsonResponse(
        {
          ok: false,
          error: "Could not track mosque event.",
        },
        500
      );
    }

    return jsonResponse({
      ok: true,
      event: data,
    });
  } catch (error) {
    console.error("mosque track event route error:", error);

    return jsonResponse(
      {
        ok: false,
        error: "Could not track mosque event.",
      },
      500
    );
  }
}

