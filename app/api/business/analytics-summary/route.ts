import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AnalyticsEvent = {
  id?: string;
  business_id: string;
  event_type: string | null;
  created_at: string;
};

type RequestBody = {
  business_id?: string;
  days?: number;
};

const EVENT_TYPES = {
  PROFILE_VIEW: "profile_view",
  PROFILE_CLICK: "profile_click",
  PHONE_CLICK: "phone_click",
  WEBSITE_CLICK: "website_click",
  MAPS_CLICK: "maps_click",
  SPONSOR_IMPRESSION: "sponsor_impression",
  SPONSOR_CLICK: "sponsor_click",
} as const;

function getDateDaysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function countEvent(events: AnalyticsEvent[], eventType: string) {
  return events.filter((event) => event.event_type === eventType).length;
}

function getValidDays(days?: number) {
  if (typeof days === "number" && days > 0 && days <= 365) {
    return days;
  }

  return 30;
}

function calculateEngagementRate(profileViews: number, engagementEvents: number) {
  if (profileViews <= 0) {
    return 0;
  }

  return Math.min(Math.round((engagementEvents / profileViews) * 100), 100);
}

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      route: "/api/business/analytics-summary",
      message: "Analytics summary API is working. Use POST with business_id.",
      required_body: {
        business_id: "uuid",
        days: "optional number from 1 to 365",
      },
    },
    {
      status: 200,
    }
  );
}

export async function POST(req: Request) {
  try {
    let body: RequestBody;

    try {
      body = (await req.json()) as RequestBody;
    } catch {
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

    const businessId = body.business_id?.trim();

    if (!businessId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing business_id",
        },
        {
          status: 400,
        }
      );
    }

    const days = getValidDays(body.days);
    const since = getDateDaysAgo(days);

    const { data, error } = await supabaseAdmin
      .from("business_analytics")
      .select("id, business_id, event_type, created_at")
      .eq("business_id", businessId)
      .gte("created_at", since.toISOString())
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error("analytics-summary Supabase error:", error);

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

    const analytics = (data ?? []) as AnalyticsEvent[];

    const profileViews = countEvent(analytics, EVENT_TYPES.PROFILE_VIEW);
    const profileClicks = countEvent(analytics, EVENT_TYPES.PROFILE_CLICK);
    const phoneClicks = countEvent(analytics, EVENT_TYPES.PHONE_CLICK);
    const websiteClicks = countEvent(analytics, EVENT_TYPES.WEBSITE_CLICK);
    const mapsClicks = countEvent(analytics, EVENT_TYPES.MAPS_CLICK);
    const sponsorImpressions = countEvent(
      analytics,
      EVENT_TYPES.SPONSOR_IMPRESSION
    );
    const sponsorClicks = countEvent(analytics, EVENT_TYPES.SPONSOR_CLICK);

    // Active actions only. Sponsor impressions are visibility, not engagement.
    const engagementEvents =
      profileClicks +
      phoneClicks +
      websiteClicks +
      mapsClicks +
      sponsorClicks;

    const totalEngagement =
      profileViews +
      engagementEvents +
      sponsorImpressions;

    const engagementRate = calculateEngagementRate(
      profileViews,
      engagementEvents
    );

    return NextResponse.json(
      {
        ok: true,
        summary: {
          business_id: businessId,
          period_days: days,
          total_events: analytics.length,

          profile_views: profileViews,
          profile_clicks: profileClicks,
          phone_clicks: phoneClicks,
          website_clicks: websiteClicks,
          maps_clicks: mapsClicks,

          sponsor_impressions: sponsorImpressions,
          sponsor_clicks: sponsorClicks,

          engagement_events: engagementEvents,
          total_engagement: totalEngagement,
          engagement_rate: engagementRate,

          // Keep this temporarily so existing frontend does not break.
          conversion_rate: engagementRate,
        },
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error("analytics-summary route error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Analytics summary failed",
      },
      {
        status: 500,
      }
    );
  }
}

