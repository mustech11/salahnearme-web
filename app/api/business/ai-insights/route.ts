import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type AnalyticsEvent = {
  id?: string;
  business_id: string;
  event_type: string | null;
  created_at: string;
};

const EVENT_TYPES = {
  PROFILE_VIEW: "profile_view",
  PROFILE_CLICK: "profile_click",
  PHONE_CLICK: "phone_click",
  WEBSITE_CLICK: "website_click",
  MAPS_CLICK: "maps_click",
  SPONSOR_CLICK: "sponsor_click",
} as const;

function getDateDaysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function countEvent(analytics: AnalyticsEvent[], eventType: string) {
  return analytics.filter((item) => item.event_type === eventType).length;
}

function getPerformanceLabel(conversionRate: number) {
  if (conversionRate >= 70) return "Excellent";
  if (conversionRate >= 40) return "Strong";
  if (conversionRate >= 20) return "Average";
  return "Low";
}

function buildRecommendations({
  profileViews,
  phoneClicks,
  websiteClicks,
  mapsClicks,
  sponsorClicks,
  conversionRate,
}: {
  profileViews: number;
  phoneClicks: number;
  websiteClicks: number;
  mapsClicks: number;
  sponsorClicks: number;
  conversionRate: number;
}) {
  const recommendations: string[] = [];

  if (profileViews === 0) {
    recommendations.push(
      "Your listing is not receiving profile views yet. Improve visibility by using a featured placement or mosque sponsorship."
    );
  }

  if (profileViews > 0 && phoneClicks === 0) {
    recommendations.push(
      "People are viewing your profile, but nobody has clicked the phone number yet. Make sure your phone number is visible and correct."
    );
  }

  if (profileViews > 0 && websiteClicks === 0) {
    recommendations.push(
      "Add or improve your website link so visitors can learn more about the business."
    );
  }

  if (mapsClicks === 0) {
    recommendations.push(
      "Map clicks are low. Check that the business address and map location are accurate."
    );
  }

  if (sponsorClicks === 0) {
    recommendations.push(
      "Consider sponsoring a nearby mosque to improve local community visibility."
    );
  }

  if (conversionRate >= 40) {
    recommendations.push(
      "Your listing is performing well. Keep the profile updated and consider increasing visibility with a higher placement."
    );
  }

  if (recommendations.length === 0) {
    recommendations.push(
      "Your listing has basic engagement. Keep your business profile updated with accurate contact details, images, opening hours, and relevant offers."
    );
  }

  return recommendations;
}

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      route: "/api/business/ai-insights",
      message: "AI insights API is working. Use POST with business_id.",
    },
    {
      status: 200,
    }
  );
}

export async function POST(req: Request) {
  try {
    let body: {
      business_id?: string;
      days?: number;
    };

    try {
      body = await req.json();
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

    const businessId = body.business_id;

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

    const days =
      typeof body.days === "number" && body.days > 0 && body.days <= 365
        ? body.days
        : 30;

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
      console.error("ai-insights Supabase error:", error);

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
    const websiteClicks = countEvent(analytics, EVENT_TYPES.WEBSITE_CLICK);
    const phoneClicks = countEvent(analytics, EVENT_TYPES.PHONE_CLICK);
    const mapsClicks = countEvent(analytics, EVENT_TYPES.MAPS_CLICK);
    const sponsorClicks = countEvent(analytics, EVENT_TYPES.SPONSOR_CLICK);

    const engagementEvents =
      websiteClicks + phoneClicks + mapsClicks + sponsorClicks + profileClicks;

    const engagementScore =
      websiteClicks * 3 +
      phoneClicks * 5 +
      mapsClicks * 2 +
      sponsorClicks * 2 +
      profileClicks;

    const rawConversionRate =
    profileViews > 0
    ? Math.round((engagementEvents / profileViews) * 100)
    : 0;

const conversionRate = Math.min(rawConversionRate, 100);

    const performance = getPerformanceLabel(conversionRate);

    const recommendations = buildRecommendations({
      profileViews,
      phoneClicks,
      websiteClicks,
      mapsClicks,
      sponsorClicks,
      conversionRate,
    });

    return NextResponse.json(
      {
        ok: true,
        insights: {
          business_id: businessId,
          period_days: days,
          profile_views: profileViews,
          profile_clicks: profileClicks,
          website_clicks: websiteClicks,
          phone_clicks: phoneClicks,
          maps_clicks: mapsClicks,
          sponsor_clicks: sponsorClicks,
          engagement_events: engagementEvents,
          engagement_score: engagementScore,
          conversion_rate: conversionRate,
          performance,
          recommendations,
        },
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error("ai-insights route error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "AI insights failed",
      },
      {
        status: 500,
      }
    );
  }
}

