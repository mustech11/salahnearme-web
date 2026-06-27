import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_EVENTS = [
  "profile_view",
  "profile_click",
  "phone_click",
  "website_click",
  "maps_click",
  "sponsor_impression",
  "sponsor_click",
] as const;

type BusinessEventType = (typeof ALLOWED_EVENTS)[number];

const MAX_SOURCE_LENGTH = 80;
const MAX_USER_AGENT_LENGTH = 500;
const MAX_METADATA_KEYS = 25;
const MAX_METADATA_VALUE_LENGTH = 300;

const DUPLICATE_WINDOW_SECONDS_BY_EVENT: Record<BusinessEventType, number> = {
  profile_view: 30,
  profile_click: 15,
  phone_click: 20,
  website_click: 20,
  maps_click: 20,
  sponsor_impression: 30,
  sponsor_click: 20,
};

type Body = {
  business_id?: unknown;
  event_type?: unknown;
  source?: unknown;
  metadata?: unknown;

  /**
   * Honeypot field.
   * Real frontend should leave this empty.
   * Bots often fill hidden form fields.
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

function isAllowedEvent(value: unknown): value is BusinessEventType {
  return (
    typeof value === "string" &&
    ALLOWED_EVENTS.includes(value as BusinessEventType)
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

function getDuplicateSinceIso(eventType: BusinessEventType) {
  const windowSeconds = DUPLICATE_WINDOW_SECONDS_BY_EVENT[eventType] ?? 20;
  const date = new Date();

  date.setSeconds(date.getSeconds() - windowSeconds);

  return date.toISOString();
}

async function businessExists(businessId: string) {
  const { data, error } = await supabaseAdmin
    .from("businesses")
    .select("id")
    .eq("id", businessId)
    .maybeSingle();

  if (error) {
    console.error("business track event lookup error:", error);

    return {
      ok: false,
      exists: false,
      error: "Could not verify business.",
    };
  }

  return {
    ok: true,
    exists: Boolean(data),
    error: null,
  };
}

async function isRecentDuplicateEvent({
  businessId,
  eventType,
  source,
  ip,
}: {
  businessId: string;
  eventType: BusinessEventType;
  source: string;
  ip: string | null;
}) {
  const since = getDuplicateSinceIso(eventType);

  let query = supabaseAdmin
    .from("business_analytics")
    .select("id, source, metadata, created_at")
    .eq("business_id", businessId)
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
    console.error("business duplicate analytics lookup error:", error);
    return false;
  }

  if (!data || data.length === 0) {
    return false;
  }

  if (!ip) {
    return data.length > 0;
  }

  return data.some((event) => {
    const metadata = event.metadata as Record<string, unknown> | null;

    const storedIp =
      typeof metadata?.ip_address === "string"
        ? metadata.ip_address
        : typeof metadata?.ip === "string"
          ? metadata.ip
          : null;

    return storedIp === ip;
  });
}

export async function GET() {
  return jsonResponse({
    ok: true,
    route: "/api/business/track-event",
    method: "POST",
    message: "Business event tracker is working. Use POST.",
    allowed_events: ALLOWED_EVENTS,
    duplicate_window_seconds_by_event: DUPLICATE_WINDOW_SECONDS_BY_EVENT,
    usage: {
      body: {
        business_id: "uuid",
        event_type: "profile_view",
        source: "business_page",
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
     * This reduces useful feedback to spam bots.
     */
    if (hasHoneypotValue(body)) {
      return jsonResponse({
        ok: true,
        ignored: true,
      });
    }

    const businessId = cleanString(body.business_id, 80);
    const source = cleanSource(body.source);

    if (!isUuid(businessId)) {
      return jsonResponse(
        {
          ok: false,
          error: "Missing or invalid business_id.",
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
    const ip = getClientIp(req);
    const userAgent =
      req.headers.get("user-agent")?.slice(0, MAX_USER_AGENT_LENGTH) ?? null;

    const businessCheck = await businessExists(businessId);

    if (!businessCheck.ok) {
      return jsonResponse(
        {
          ok: false,
          error: businessCheck.error,
        },
        500
      );
    }

    if (!businessCheck.exists) {
      return jsonResponse(
        {
          ok: false,
          error: "Business not found.",
        },
        404
      );
    }

    const duplicate = await isRecentDuplicateEvent({
      businessId,
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

    const metadata = {
      ...cleanMetadata(body.metadata),
      ip_address: ip,
      ip,
      user_agent: userAgent,
      tracked_at: new Date().toISOString(),
      anti_abuse: {
        duplicate_window_seconds:
          DUPLICATE_WINDOW_SECONDS_BY_EVENT[eventType],
      },
    };

    const { data, error } = await supabaseAdmin
      .from("business_analytics")
      .insert({
        business_id: businessId,
        event_type: eventType,
        source,
        metadata,
      })
      .select("id, business_id, event_type, source, created_at")
      .single();

    if (error) {
      console.error("business analytics track Supabase error:", error);

      return jsonResponse(
        {
          ok: false,
          error: "Could not track business event.",
        },
        500
      );
    }

    return jsonResponse({
      ok: true,
      event: data,
      tracked: {
        business_id: businessId,
        event_type: eventType,
        source,
      },
    });
  } catch (error) {
    console.error("business analytics track error:", error);

    return jsonResponse(
      {
        ok: false,
        error: "Could not track business event.",
      },
      500
    );
  }
}

