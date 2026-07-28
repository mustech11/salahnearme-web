import { NextResponse } from "next/server";

import { requireMosqueManager } from "@/lib/mosqueManagerAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type MosqueAnalyticsRow = {
  id: string;
  mosque_id: string;
  event_type: string;
  source: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type Body = {
  mosque_id?: unknown;
  mosqueId?: unknown;
  id?: unknown;
  days?: unknown;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const EVENT_TYPES = [
  "pray_near_me_impression",
  "pray_near_me_best_shown",
  "mosque_profile_click",
  "mosque_maps_click",
  "mosque_timetable_click",
] as const;

const DEFAULT_DAYS = 30;
const MAX_DAYS = 365;
const MAX_ROWS = 5_000;
const MAX_REQUEST_BODY_BYTES = 8_000;

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

function cleanString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.trim();
  return cleaned || null;
}

function isUuid(value: string | null): value is string {
  return Boolean(value && UUID_REGEX.test(value));
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

function isJsonRequest(request: Request): boolean {
  return Boolean(
    request.headers
      .get("content-type")
      ?.toLowerCase()
      .includes("application/json")
  );
}

function cleanDays(value: unknown): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : DEFAULT_DAYS;

  if (!Number.isFinite(parsed)) {
    return DEFAULT_DAYS;
  }

  return Math.min(
    MAX_DAYS,
    Math.max(1, Math.floor(parsed))
  );
}

function getStartDate(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString();
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function safeNumber(value: unknown): number | null {
  return typeof value === "number" &&
    Number.isFinite(value)
    ? value
    : null;
}

function getDateKey(value: string): string | null {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? null
    : date.toISOString().slice(0, 10);
}

function getMosqueId(
  body: Body | null,
  request: Request
): string | null {
  const url = new URL(request.url);

  return (
    cleanString(body?.mosque_id) ??
    cleanString(body?.mosqueId) ??
    cleanString(body?.id) ??
    cleanString(url.searchParams.get("mosque_id")) ??
    cleanString(url.searchParams.get("mosqueId")) ??
    cleanString(url.searchParams.get("id"))
  );
}

function getDays(
  body: Body | null,
  request: Request
): number {
  const url = new URL(request.url);

  return cleanDays(
    body?.days ??
      url.searchParams.get("days")
  );
}

async function readBody(
  request: Request
): Promise<Body | null> {
  const contentLength = Number(
    request.headers.get("content-length")
  );

  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_REQUEST_BODY_BYTES
  ) {
    return null;
  }

  try {
    const value: unknown = await request.json();

    return isPlainObject(value)
      ? (value as Body)
      : null;
  } catch {
    return null;
  }
}

function summariseRows(
  rows: MosqueAnalyticsRow[],
  days: number
) {
  const totalsByEvent: Record<string, number> =
    Object.fromEntries(
      EVENT_TYPES.map((eventType) => [
        eventType,
        0,
      ])
    );

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
    if (
      !EVENT_TYPES.includes(
        row.event_type as
          (typeof EVENT_TYPES)[number]
      )
    ) {
      continue;
    }

    totalsByEvent[row.event_type] =
      (totalsByEvent[row.event_type] ?? 0) + 1;

    const source =
      cleanString(row.source) ?? "unknown";

    sourceCounts.set(
      source,
      (sourceCounts.get(source) ?? 0) + 1
    );

    const dateKey = getDateKey(row.created_at);

    if (!dateKey) {
      continue;
    }

    const daily =
      dailyMap.get(dateKey) ?? {
        date: dateKey,
        impressions: 0,
        best_shown: 0,
        profile_clicks: 0,
        maps_clicks: 0,
        timetable_clicks: 0,
        total_clicks: 0,
      };

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

    dailyMap.set(dateKey, daily);

    const salahScore = safeNumber(
      row.metadata?.salah_score
    );

    if (salahScore !== null) {
      totalSalahScore += salahScore;
      salahScoreCount += 1;
    }
  }

  const impressions =
    totalsByEvent.pray_near_me_impression ?? 0;
  const bestShown =
    totalsByEvent.pray_near_me_best_shown ?? 0;
  const profileClicks =
    totalsByEvent.mosque_profile_click ?? 0;
  const mapsClicks =
    totalsByEvent.mosque_maps_click ?? 0;
  const timetableClicks =
    totalsByEvent.mosque_timetable_click ?? 0;
  const totalClicks =
    profileClicks + mapsClicks + timetableClicks;

  const rate = (value: number) =>
    impressions > 0
      ? round((value / impressions) * 100)
      : 0;

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
      engagement_rate: rate(totalClicks),
      profile_click_rate: rate(profileClicks),
      maps_click_rate: rate(mapsClicks),
      timetable_click_rate: rate(timetableClicks),
      best_shown_rate: rate(bestShown),
    },
    quality: {
      average_salah_score:
        salahScoreCount > 0
          ? round(totalSalahScore / salahScoreCount)
          : null,
    },
    top_sources: Array.from(sourceCounts.entries())
      .map(([source, count]) => ({
        source,
        count,
      }))
      .sort((first, second) =>
        second.count !== first.count
          ? second.count - first.count
          : first.source.localeCompare(second.source)
      ),
    daily_breakdown: Array.from(dailyMap.values()).sort(
      (first, second) =>
        first.date.localeCompare(second.date)
    ),
  };
}

async function handleSummary(
  request: Request,
  body: Body | null
) {
  try {
    const mosqueId = getMosqueId(body, request);

    if (!isUuid(mosqueId)) {
      return jsonResponse(
        {
          ok: false,
          error: "Missing or invalid mosque_id.",
        },
        400
      );
    }

    const permission =
      await requireMosqueManager(mosqueId);

    if (!permission.ok) {
      return jsonResponse(
        {
          ok: false,
          error: permission.error,
        },
        permission.status
      );
    }

    const days = getDays(body, request);
    const startDate = getStartDate(days);
    const endDate = new Date().toISOString();

    const { data: mosque, error: mosqueError } =
      await supabaseAdmin
        .from("mosques")
        .select("id,name,slug,city,area,postcode")
        .eq("id", mosqueId)
        .maybeSingle();

    if (mosqueError) {
      console.error(
        "Mosque analytics mosque lookup failed:",
        {
          mosqueId,
          code: mosqueError.code,
          message: mosqueError.message,
        }
      );

      return jsonResponse(
        {
          ok: false,
          error: "Could not load mosque analytics.",
        },
        500
      );
    }

    if (!mosque) {
      return jsonResponse(
        {
          ok: false,
          error: "Mosque not found.",
        },
        404
      );
    }

    const { data: rows, error } = await supabaseAdmin
      .from("mosque_analytics")
      .select(
        "id,mosque_id,event_type,source,metadata,created_at"
      )
      .eq("mosque_id", mosqueId)
      .in("event_type", [...EVENT_TYPES])
      .gte("created_at", startDate)
      .lte("created_at", endDate)
      .order("created_at", {
        ascending: false,
      })
      .limit(MAX_ROWS);

    if (error) {
      console.error(
        "Mosque analytics summary query failed:",
        {
          mosqueId,
          code: error.code,
          message: error.message,
        }
      );

      return jsonResponse(
        {
          ok: false,
          error: "Could not load mosque analytics.",
        },
        500
      );
    }

    const analyticsRows =
      (rows ?? []) as unknown as MosqueAnalyticsRow[];

    return jsonResponse({
      ok: true,
      mosque,
      period: {
        days,
        start_date: startDate,
        end_date: endDate,
      },
      row_count: analyticsRows.length,
      truncated: analyticsRows.length >= MAX_ROWS,
      summary: summariseRows(
        analyticsRows,
        days
      ),
    });
  } catch (error) {
    console.error(
      "Mosque analytics summary route failed:",
      error
    );

    return jsonResponse(
      {
        ok: false,
        error:
          "Could not load mosque analytics summary.",
      },
      500
    );
  }
}

export async function GET(request: Request) {
  const mosqueId = getMosqueId(null, request);

  if (!mosqueId) {
    return jsonResponse({
      ok: true,
      route: "/api/mosque/analytics-summary",
      methods: ["GET", "POST"],
      query: {
        mosque_id: "required UUID",
        days: "optional integer from 1 to 365",
      },
    });
  }

  return handleSummary(request, null);
}

export async function POST(request: Request) {
  if (!isJsonRequest(request)) {
    return jsonResponse(
      {
        ok: false,
        error: "Content-Type must be application/json.",
      },
      415
    );
  }

  const body = await readBody(request);

  if (!body) {
    return jsonResponse(
      {
        ok: false,
        error: "Invalid JSON body.",
      },
      400
    );
  }

  return handleSummary(request, body);
}