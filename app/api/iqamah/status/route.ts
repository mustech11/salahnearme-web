import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LIVE_WINDOW_MINUTES = 90;
const MAX_REPORT_ROWS = 200;

const ALLOWED_PRAYERS = [
  "fajr",
  "dhuhr",
  "asr",
  "maghrib",
  "isha",
  "jumuah",
] as const;

const ALLOWED_REPORT_TYPES = [
  "started",
  "delayed",
  "full",
  "parking_full",
] as const;

type Prayer = (typeof ALLOWED_PRAYERS)[number];
type ReportType = (typeof ALLOWED_REPORT_TYPES)[number];
type Confidence = "none" | "low" | "medium" | "strong";

type IqamahReportRow = {
  report_type: string | null;
  created_at: string | null;
};

type Counts = Record<ReportType, number>;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function isUuid(value: string | null | undefined): value is string {
  if (!value) {
    return false;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim()
  );
}

function cleanText(value: string | null, maxLength = 80) {
  if (!value) {
    return "";
  }

  return value
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .slice(0, maxLength);
}

function isAllowedPrayer(value: string): value is Prayer {
  return ALLOWED_PRAYERS.includes(value as Prayer);
}

function isAllowedReportType(value: string | null): value is ReportType {
  return Boolean(value && ALLOWED_REPORT_TYPES.includes(value as ReportType));
}

function emptyCounts(): Counts {
  return {
    started: 0,
    delayed: 0,
    full: 0,
    parking_full: 0,
  };
}

function getSinceIso() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - LIVE_WINDOW_MINUTES);
  return date.toISOString();
}

function getConfidence(total: number): Confidence {
  if (total >= 5) {
    return "strong";
  }

  if (total >= 3) {
    return "medium";
  }

  if (total >= 1) {
    return "low";
  }

  return "none";
}

function getCommunityStatus(counts: Counts, total: number) {
  if (total < 3) {
    return "none";
  }

  const pairs: Array<[string, number]> = [
    ["community_suggests_started", counts.started],
    ["community_suggests_delayed", counts.delayed],
    ["community_suggests_full", counts.full],
    ["community_suggests_parking_full", counts.parking_full],
  ];

  pairs.sort((a, b) => b[1] - a[1]);

  const [status, count] = pairs[0];

  if (count <= 0) {
    return "none";
  }

  return status;
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

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const mosqueId = searchParams.get("mosque_id")?.trim() ?? null;
    const prayer = cleanText(searchParams.get("prayer"), 30);

    if (!isUuid(mosqueId)) {
      return jsonResponse(
        {
          ok: false,
          error: "Missing or invalid mosque_id.",
        },
        400
      );
    }

    if (prayer && !isAllowedPrayer(prayer)) {
      return jsonResponse(
        {
          ok: false,
          error: "Invalid prayer.",
          allowed_prayers: ALLOWED_PRAYERS,
        },
        400
      );
    }

    const { data: mosque, error: mosqueError } = await supabaseAdmin
      .from("mosques")
      .select("id")
      .eq("id", mosqueId)
      .maybeSingle();

    if (mosqueError) {
      console.error("iqamah status mosque lookup error:", mosqueError);

      return jsonResponse(
        {
          ok: false,
          error: "Could not verify mosque.",
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

    const since = getSinceIso();

    let query = supabaseAdmin
      .from("iqamah_reports")
      .select("report_type, created_at")
      .eq("mosque_id", mosqueId)
      .gte("created_at", since)
      .order("created_at", {
        ascending: false,
      })
      .limit(MAX_REPORT_ROWS);

    if (prayer) {
      query = query.eq("prayer", prayer);
    }

    const { data, error } = await query;

    if (error) {
      console.error("iqamah status lookup error:", error);

      return jsonResponse(
        {
          ok: false,
          error: "Could not load iqamah status.",
        },
        500
      );
    }

    const counts = emptyCounts();

    for (const row of (data ?? []) as IqamahReportRow[]) {
      if (!isAllowedReportType(row.report_type)) {
        continue;
      }

      counts[row.report_type] += 1;
    }

    const total =
      counts.started + counts.delayed + counts.full + counts.parking_full;

    const confidence = getConfidence(total);
    const status = getCommunityStatus(counts, total);

    return jsonResponse({
      ok: true,
      mosque_id: mosqueId,
      prayer: prayer || null,
      status,
      started: counts.started,
      delayed: counts.delayed,
      full: counts.full,
      parking_full: counts.parking_full,
      total,
      confidence,
      meta: {
        live_window_minutes: LIVE_WINDOW_MINUTES,
        since,
        max_report_rows: MAX_REPORT_ROWS,
        ip_hint: getClientIp(req),
      },
    });
  } catch (error) {
    console.error("iqamah status route error:", error);

    return jsonResponse(
      {
        ok: false,
        error: "Could not load iqamah status.",
      },
      500
    );
  }
}