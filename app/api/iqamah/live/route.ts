import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_MOSQUE_IDS = 50;
const LIVE_WINDOW_MINUTES = 90;

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

type LiveItem = {
  status: ReportType | "none";
  total: number;
  confidence: Confidence;
  counts: Record<ReportType, number>;
};

type IqamahReportRow = {
  mosque_id: string | null;
  report_type: string | null;
  created_at: string | null;
};

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
    return null;
  }

  const cleaned = value
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  if (!cleaned) {
    return null;
  }

  return cleaned.slice(0, maxLength);
}

function cleanMosqueIds(value: string | null) {
  if (!value) {
    return [];
  }

  const uniqueIds = new Set<string>();

  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((item) => {
      if (isUuid(item)) {
        uniqueIds.add(item);
      }
    });

  return Array.from(uniqueIds).slice(0, MAX_MOSQUE_IDS);
}

function isAllowedPrayer(value: string | null): value is Prayer {
  return Boolean(
    value && ALLOWED_PRAYERS.includes(value as Prayer)
  );
}

function isAllowedReportType(value: string | null): value is ReportType {
  return Boolean(
    value && ALLOWED_REPORT_TYPES.includes(value as ReportType)
  );
}

function getSinceIso() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - LIVE_WINDOW_MINUTES);
  return date.toISOString();
}

function emptyCounts(): Record<ReportType, number> {
  return {
    started: 0,
    delayed: 0,
    full: 0,
    parking_full: 0,
  };
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

function getStatusFromCounts(
  counts: Record<ReportType, number>,
  total: number
): ReportType | "none" {
  /**
   * Avoid making a strong public status claim from too few reports.
   */
  if (total < 3) {
    return "none";
  }

  const ranked: Array<[ReportType, number]> = [
    ["started", counts.started],
    ["delayed", counts.delayed],
    ["full", counts.full],
    ["parking_full", counts.parking_full],
  ];

  ranked.sort((a, b) => b[1] - a[1]);

  const [topStatus, topCount] = ranked[0];

  if (topCount <= 0) {
    return "none";
  }

  return topStatus;
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

    const mosqueIds = cleanMosqueIds(searchParams.get("mosque_ids"));
    const rawPrayer = cleanText(searchParams.get("prayer"), 30) ?? "isha";

    if (!isAllowedPrayer(rawPrayer)) {
      return jsonResponse(
        {
          ok: false,
          error: "Missing or invalid prayer.",
          allowed_prayers: ALLOWED_PRAYERS,
        },
        400
      );
    }

    if (mosqueIds.length === 0) {
      return jsonResponse({
        ok: true,
        map: {},
        meta: {
          prayer: rawPrayer,
          live_window_minutes: LIVE_WINDOW_MINUTES,
          max_mosque_ids: MAX_MOSQUE_IDS,
        },
      });
    }

    const since = getSinceIso();

    const { data, error } = await supabaseAdmin
      .from("iqamah_reports")
      .select("mosque_id, report_type, created_at")
      .in("mosque_id", mosqueIds)
      .eq("prayer", rawPrayer)
      .gte("created_at", since)
      .order("created_at", {
        ascending: false,
      })
      .limit(500);

    if (error) {
      console.error("iqamah live lookup error:", error);

      return jsonResponse(
        {
          ok: false,
          error: "Could not load live iqamah reports.",
        },
        500
      );
    }

    const countsByMosque = new Map<string, Record<ReportType, number>>();

    for (const row of (data ?? []) as IqamahReportRow[]) {
      const mosqueId = row.mosque_id;

      if (!isUuid(mosqueId)) {
        continue;
      }

      if (!mosqueIds.includes(mosqueId)) {
        continue;
      }

      if (!isAllowedReportType(row.report_type)) {
        continue;
      }

      const current = countsByMosque.get(mosqueId) ?? emptyCounts();

      current[row.report_type] += 1;

      countsByMosque.set(mosqueId, current);
    }

    const map: Record<string, LiveItem> = {};

    for (const mosqueId of mosqueIds) {
      const counts = countsByMosque.get(mosqueId) ?? emptyCounts();

      const total =
        counts.started +
        counts.delayed +
        counts.full +
        counts.parking_full;

      map[mosqueId] = {
        status: getStatusFromCounts(counts, total),
        total,
        confidence: getConfidence(total),
        counts,
      };
    }

    return jsonResponse({
      ok: true,
      map,
      meta: {
        prayer: rawPrayer,
        requested_mosque_count: mosqueIds.length,
        live_window_minutes: LIVE_WINDOW_MINUTES,
        since,
        max_mosque_ids: MAX_MOSQUE_IDS,
        ip_hint: getClientIp(req),
      },
    });
  } catch (error) {
    console.error("iqamah live route error:", error);

    return jsonResponse(
      {
        ok: false,
        error: "Could not load live iqamah status.",
      },
      500
    );
  }
}

