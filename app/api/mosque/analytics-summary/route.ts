import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MosqueAnalyticsRow = {
  id: string;
  mosque_id: string;
  event_type: string;
  source: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type Body = {
  mosque_id?: string;
  mosqueId?: string;
  id?: string;
  days?: number;
};

const EVENT_TYPES = [
  "pray_near_me_impression",
  "pray_near_me_best_shown",
  "mosque_profile_click",
  "mosque_maps_click",
  "mosque_timetable_click",
] as const;

function cleanString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function isUuid(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );
}

function cleanDays(value: unknown) {
  const numberValue =
    typeof value === "string" ? Number(value) : typeof value === "number" ? value : 30;

  if (!Number.isFinite(numberValue)) {
    return 30;
  }

  if (numberValue < 1) {
    return 1;
  }

  if (numberValue > 365) {
    return 365;
  }

  return Math.floor(numberValue);
}

function getStartDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function getDateKey(value: string) {
  return value.slice(0, 10);
}

function safeNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return null;
}

function getMosqueIdFromBodyOrUrl(body: Body | null, req: Request) {
  const url = new URL(req.url);

  return (
    cleanString(body?.mosque_id) ??
    cleanString(body?.mosqueId) ??
    cleanString(body?.id) ??
    cleanString(url.searchParams.get("mosque_id")) ??
    cleanString(url.searchParams.get("mosqueId")) ??
    cleanString(url.searchParams.get("id"))
  );
}

function getDaysFromBodyOrUrl(body: Body | null, req: Request) {
  const url = new URL(req.url);

  return cleanDays(body?.days ?? url.searchParams.get("days"));
}

function summariseRows(rows: MosqueAnalyticsRow[], days: number) {
  const totalsByEvent: Record<string, number> = {};

  for (const eventType of EVENT_TYPES) {
    totalsByEvent[eventType] = 0;
  }

  const sourceCounts = new Map<string, number>();
  const dailyMap = new Map<
    string,
    {
      date: string;
      impressions: number;
      best_shown: number;
      profile_clicks: number;
      maps_clicks: number;
      timetable_clicks: number;
      total_clicks: number;
    }
  >();

  let totalSalahScore = 0;
  let salahScoreCount = 0;

  for (const row of rows) {
    totalsByEvent[row.event_type] = (totalsByEvent[row.event_type] ?? 0) + 1;

    const source = row.source || "unknown";
    sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);

    const dateKey = getDateKey(row.created_at);

    if (!dailyMap.has(dateKey)) {
      dailyMap.set(dateKey, {
        date: dateKey,
        impressions: 0,
        best_shown: 0,
        profile_clicks: 0,
        maps_clicks: 0,
        timetable_clicks: 0,
        total_clicks: 0,
      });
    }

    const daily = dailyMap.get(dateKey);

    if (daily) {
      if (row.event_type === "pray_near_me_impression") {
        daily.impressions += 1;
      }

      if (row.event_type === "pray_near_me_best_shown") {
        daily.best_shown += 1;
      }

      if (row.event_type === "mosque_profile_click") {
        daily.profile_clicks += 1;
        daily.total_clicks += 1;
      }

      if (row.event_type === "mosque_maps_click") {
        daily.maps_clicks += 1;
        daily.total_clicks += 1;
      }

      if (row.event_type === "mosque_timetable_click") {
        daily.timetable_clicks += 1;
        daily.total_clicks += 1;
      }
    }

    const salahScore = safeNumber(row.metadata?.salah_score);

    if (salahScore !== null) {
      totalSalahScore += salahScore;
      salahScoreCount += 1;
    }
  }

  const impressions = totalsByEvent.pray_near_me_impression ?? 0;
  const bestShown = totalsByEvent.pray_near_me_best_shown ?? 0;
  const profileClicks = totalsByEvent.mosque_profile_click ?? 0;
  const mapsClicks = totalsByEvent.mosque_maps_click ?? 0;
  const timetableClicks = totalsByEvent.mosque_timetable_click ?? 0;
  const totalClicks = profileClicks + mapsClicks + timetableClicks;

  const engagementRate =
    impressions > 0 ? round((totalClicks / impressions) * 100) : 0;

  const profileClickRate =
    impressions > 0 ? round((profileClicks / impressions) * 100) : 0;

  const mapsClickRate =
    impressions > 0 ? round((mapsClicks / impressions) * 100) : 0;

  const timetableClickRate =
    impressions > 0 ? round((timetableClicks / impressions) * 100) : 0;

  const bestShownRate =
    impressions > 0 ? round((bestShown / impressions) * 100) : 0;

  const averageSalahScore =
    salahScoreCount > 0 ? round(totalSalahScore / salahScoreCount) : null;

  const topSources = Array.from(sourceCounts.entries())
    .map(([source, count]) => ({
      source,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  const dailyBreakdown = Array.from(dailyMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  return {
    days,
    totals: {
      impressions,
      best_shown: bestShown,
      profile_clicks: profileClicks,
      maps_clicks: mapsClicks,
      timetable_clicks: timetableClicks,
      total_clicks: totalClicks,
    },
    rates: {
      engagement_rate: engagementRate,
      profile_click_rate: profileClickRate,
      maps_click_rate: mapsClickRate,
      timetable_click_rate: timetableClickRate,
      best_shown_rate: bestShownRate,
    },
    quality: {
      average_salah_score: averageSalahScore,
    },
    top_sources: topSources,
    daily_breakdown: dailyBreakdown,
  };
}

export async function GET(req: Request) {
  const mosqueId = getMosqueIdFromBodyOrUrl(null, req);

  if (!mosqueId) {
    return NextResponse.json(
      {
        ok: true,
        route: "/api/mosque/analytics-summary",
        usage: {
          method: "POST",
          body: {
            mosque_id: "uuid",
            days: 30,
          },
        },
        quick_test:
          "/api/mosque/analytics-summary?mosque_id=6c989f7e-0fea-4a70-b126-3028e7600152&days=30",
      },
      {
        status: 200,
      }
    );
  }

  return handleSummary(req, null);
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Body | null;

  return handleSummary(req, body);
}

async function handleSummary(req: Request, body: Body | null) {
  try {
    const mosqueId = getMosqueIdFromBodyOrUrl(body, req);
    const days = getDaysFromBodyOrUrl(body, req);
    const startDate = getStartDate(days);

    if (!isUuid(mosqueId)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing or invalid mosque_id.",
          debug: {
            received_body: body,
            extracted_mosque_id: mosqueId,
            expected_example: "6c989f7e-0fea-4a70-b126-3028e7600152",
          },
        },
        {
          status: 400,
        }
      );
    }

    const { data: mosque, error: mosqueError } = await supabaseAdmin
      .from("mosques")
      .select("id, name, slug, city, area, postcode")
      .eq("id", mosqueId)
      .maybeSingle();

    if (mosqueError) {
      console.error("mosque analytics summary mosque lookup error:", mosqueError);

      return NextResponse.json(
        {
          ok: false,
          error: mosqueError.message,
        },
        {
          status: 500,
        }
      );
    }

    if (!mosque) {
      return NextResponse.json(
        {
          ok: false,
          error: "Mosque not found.",
          mosque_id: mosqueId,
        },
        {
          status: 404,
        }
      );
    }

    const { data: rows, error } = await supabaseAdmin
      .from("mosque_analytics")
      .select("id, mosque_id, event_type, source, metadata, created_at")
      .eq("mosque_id", mosqueId)
      .gte("created_at", startDate)
      .order("created_at", {
        ascending: false,
      })
      .limit(5000);

    if (error) {
      console.error("mosque analytics summary query error:", error);

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

    const summary = summariseRows((rows ?? []) as MosqueAnalyticsRow[], days);

    return NextResponse.json(
      {
        ok: true,
        mosque,
        period: {
          days,
          start_date: startDate,
          end_date: new Date().toISOString(),
        },
        summary,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error("mosque analytics summary route error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Could not load mosque analytics summary.",
      },
      {
        status: 500,
      }
    );
  }
}

