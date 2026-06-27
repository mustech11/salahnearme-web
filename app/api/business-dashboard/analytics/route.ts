import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AnalyticsRow = {
  event_type: string | null;
  created_at: string;
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

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function countEvent(rows: AnalyticsRow[], eventType: string) {
  return rows.filter((row) => row.event_type === eventType).length;
}

function calculateEngagementRate(profileViews: number, engagementEvents: number) {
  if (profileViews <= 0) {
    return 0;
  }

  return Math.min(Math.round((engagementEvents / profileViews) * 100), 100);
}

export async function GET(req: Request) {
  try {
    const supabase = await supabaseServer();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.error("business dashboard analytics auth error:", userError);

      return NextResponse.json(
        {
          ok: false,
          error: userError.message,
        },
        {
          status: 401,
        }
      );
    }

    if (!user) {
      return NextResponse.json(
        {
          ok: false,
          error: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    const { searchParams } = new URL(req.url);
    const businessId = searchParams.get("business_id")?.trim();

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

    const { data: ownership, error: ownershipError } = await supabase
      .from("business_users")
      .select("business_id")
      .eq("business_id", businessId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (ownershipError) {
      console.error("business dashboard analytics ownership error:", ownershipError);

      return NextResponse.json(
        {
          ok: false,
          error: ownershipError.message,
        },
        {
          status: 500,
        }
      );
    }

    if (!ownership) {
      return NextResponse.json(
        {
          ok: false,
          error: "Forbidden",
        },
        {
          status: 403,
        }
      );
    }

    const windowDays = 30;
    const since = daysAgo(windowDays);

    const { data, error } = await supabase
      .from("business_analytics")
      .select("event_type, created_at")
      .eq("business_id", businessId)
      .gte("created_at", since)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error("business dashboard analytics Supabase error:", error);

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

    const rows = (data ?? []) as AnalyticsRow[];

    const profileViews = countEvent(rows, EVENT_TYPES.PROFILE_VIEW);
    const profileClicks = countEvent(rows, EVENT_TYPES.PROFILE_CLICK);
    const phoneClicks = countEvent(rows, EVENT_TYPES.PHONE_CLICK);
    const websiteClicks = countEvent(rows, EVENT_TYPES.WEBSITE_CLICK);
    const mapsClicks = countEvent(rows, EVENT_TYPES.MAPS_CLICK);
    const sponsorImpressions = countEvent(rows, EVENT_TYPES.SPONSOR_IMPRESSION);
    const sponsorClicks = countEvent(rows, EVENT_TYPES.SPONSOR_CLICK);

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
        business_id: businessId,
        window_days: windowDays,

        counts: {
          profile_view: profileViews,
          profile_click: profileClicks,
          phone_click: phoneClicks,
          website_click: websiteClicks,
          maps_click: mapsClicks,
          sponsor_impression: sponsorImpressions,
          sponsor_click: sponsorClicks,
        },

        analytics: {
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

          // Keep old name temporarily so existing dashboard UI does not break.
          conversion_rate: engagementRate,
        },
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error("business dashboard analytics route error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Could not load analytics.",
      },
      {
        status: 500,
      }
    );
  }
}

