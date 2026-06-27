import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_EVENTS = new Set([
  "profile_view",
  "profile_click",
  "phone_click",
  "website_click",
  "maps_click",
  "sponsor_impression",
  "sponsor_click",
]);

type Body = {
  business_id?: string;
  event_type?: string;
  source?: string | null;
  page_type?: string | null;
  city_slug?: string | null;
  user_fingerprint?: string | null;
  metadata?: Record<string, unknown>;
};

function cleanString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function normaliseEventType(eventType: string | null) {
  if (!eventType) {
    return null;
  }

  // Backwards compatibility if old frontend still sends maps_click
  if (eventType === "maps_click") {
    return "maps_click";
  }

  return eventType;
}

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      route: "/api/business/track-event",
      message: "Business tracking API is working. Use POST.",
      allowed_events: Array.from(ALLOWED_EVENTS),
    },
    {
      status: 200,
    }
  );
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as Body | null;

    if (!body) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid JSON body",
        },
        {
          status: 400,
        }
      );
    }

    const businessId = cleanString(body.business_id);
    const rawEventType = cleanString(body.event_type);
    const eventType = normaliseEventType(rawEventType);

    const source = cleanString(body.source);
    const pageType = cleanString(body.page_type);
    const citySlug = cleanString(body.city_slug);
    const userFingerprint = cleanString(body.user_fingerprint);

    if (!businessId || !eventType) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing business_id or event_type",
        },
        {
          status: 400,
        }
      );
    }

    if (!ALLOWED_EVENTS.has(eventType)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid event_type",
          received: eventType,
          allowed_events: Array.from(ALLOWED_EVENTS),
        },
        {
          status: 400,
        }
      );
    }

    const forwardedFor = req.headers.get("x-forwarded-for") || "";
    const ipAddress = forwardedFor.split(",")[0]?.trim() || null;
    const userAgent = req.headers.get("user-agent") || null;

    const { error } = await supabaseAdmin
      .from("business_analytics")
      .insert({
        business_id: businessId,
        event_type: eventType,
        source,
        page_type: pageType,
        city_slug: citySlug,
        user_fingerprint: userFingerprint,
        ip_address: ipAddress,
        user_agent: userAgent,
        metadata: {
          ...(body.metadata ?? {}),
          source,
          page_type: pageType,
          city_slug: citySlug,
          user_fingerprint: userFingerprint,
        },
      });

    if (error) {
      console.error("business track-event Supabase error:", error);

      return NextResponse.json(
        {
          ok: false,
          error: error.message,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        tracked: {
          business_id: businessId,
          event_type: eventType,
          source,
          page_type: pageType,
          city_slug: citySlug,
        },
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error("business track-event route error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Tracking failed",
      },
      {
        status: 500,
      }
    );
  }
}

