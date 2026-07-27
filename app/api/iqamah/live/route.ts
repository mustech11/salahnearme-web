import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_MOSQUE_IDS = 50;
const MAX_ROWS = 750;
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

type Prayer =
  (typeof ALLOWED_PRAYERS)[number];

type ReportType =
  (typeof ALLOWED_REPORT_TYPES)[number];

type Confidence =
  | "none"
  | "low"
  | "medium"
  | "strong";

type LiveItem = {
  status: ReportType | "none";
  total: number;
  confidence: Confidence;
  counts: Record<
    ReportType,
    number
  >;
  updated_at: string | null;
  minutes_ago: number | null;
};

type IqamahReportRow = {
  mosque_id: string | null;
  report_type: string | null;
  created_at: string | null;
};

function jsonResponse(
  body: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control":
        "no-store, max-age=0",
      "X-Content-Type-Options":
        "nosniff",
    },
  });
}

function isUuid(
  value: string | null | undefined
): value is string {
  if (!value) {
    return false;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim()
  );
}

function cleanText(
  value: string | null,
  maxLength = 80
): string | null {
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

  return cleaned.slice(
    0,
    maxLength
  );
}

function cleanMosqueIds(
  value: string | null
): string[] {
  if (!value) {
    return [];
  }

  const uniqueIds =
    new Set<string>();

  for (const item of value.split(",")) {
    const cleaned = item.trim();

    if (isUuid(cleaned)) {
      uniqueIds.add(cleaned);
    }

    if (
      uniqueIds.size >=
      MAX_MOSQUE_IDS
    ) {
      break;
    }
  }

  return Array.from(uniqueIds);
}

function isAllowedPrayer(
  value: string | null
): value is Prayer {
  return Boolean(
    value &&
      ALLOWED_PRAYERS.includes(
        value as Prayer
      )
  );
}

function isAllowedReportType(
  value: string | null
): value is ReportType {
  return Boolean(
    value &&
      ALLOWED_REPORT_TYPES.includes(
        value as ReportType
      )
  );
}

function getSinceIso(): string {
  return new Date(
    Date.now() -
      LIVE_WINDOW_MINUTES *
        60 *
        1000
  ).toISOString();
}

function emptyCounts(): Record<
  ReportType,
  number
> {
  return {
    started: 0,
    delayed: 0,
    full: 0,
    parking_full: 0,
  };
}

function getConfidence(
  total: number
): Confidence {
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
  counts: Record<
    ReportType,
    number
  >,
  total: number
): ReportType | "none" {
  if (total === 0) {
    return "none";
  }

  const ranked: Array<
    [ReportType, number, number]
  > = [
    [
      "started",
      counts.started,
      4,
    ],
    ["full", counts.full, 3],
    [
      "parking_full",
      counts.parking_full,
      2,
    ],
    [
      "delayed",
      counts.delayed,
      1,
    ],
  ];

  ranked.sort((a, b) => {
    if (b[1] !== a[1]) {
      return b[1] - a[1];
    }

    return b[2] - a[2];
  });

  const [
    topStatus,
    topCount,
  ] = ranked[0];

  if (topCount <= 0) {
    return "none";
  }

  /*
   * One report is useful as a low-confidence
   * signal, but not a strong consensus claim.
   * The confidence field communicates this.
   */
  return topStatus;
}

function getMinutesAgo(
  value: string | null
): number | null {
  if (!value) {
    return null;
  }

  const time = new Date(
    value
  ).getTime();

  if (!Number.isFinite(time)) {
    return null;
  }

  return Math.max(
    0,
    Math.floor(
      (Date.now() - time) /
        60000
    )
  );
}

export async function GET(
  req: Request
) {
  try {
    const { searchParams } =
      new URL(req.url);

    const mosqueIds =
      cleanMosqueIds(
        searchParams.get(
          "mosque_ids"
        )
      );

    const rawPrayer =
      cleanText(
        searchParams.get(
          "prayer"
        ),
        30
      ) ?? "isha";

    if (
      !isAllowedPrayer(
        rawPrayer
      )
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Missing or invalid prayer.",
          allowed_prayers:
            ALLOWED_PRAYERS,
        },
        400
      );
    }

    const since = getSinceIso();

    if (
      mosqueIds.length === 0
    ) {
      return jsonResponse({
        ok: true,
        map: {},
        meta: {
          prayer: rawPrayer,
          requested_mosque_count:
            0,
          live_window_minutes:
            LIVE_WINDOW_MINUTES,
          since,
          max_mosque_ids:
            MAX_MOSQUE_IDS,
        },
      });
    }

    const {
      data,
      error,
    } = await supabaseAdmin
      .from("iqamah_reports")
      .select(
        "mosque_id, report_type, created_at"
      )
      .in(
        "mosque_id",
        mosqueIds
      )
      .eq("prayer", rawPrayer)
      .gte("created_at", since)
      .order("created_at", {
        ascending: false,
      })
      .limit(MAX_ROWS);

    if (error) {
      console.error(
        "Iqamah live lookup failed:",
        {
          code: error.code,
          message: error.message,
        }
      );

      return jsonResponse(
        {
          ok: false,
          error:
            "Could not load live iqamah reports.",
        },
        500
      );
    }

    const countsByMosque =
      new Map<
        string,
        Record<
          ReportType,
          number
        >
      >();

    const latestByMosque =
      new Map<string, string>();

    const rows =
      (data ??
        []) as unknown as IqamahReportRow[];

    for (const row of rows) {
      const mosqueId =
        row.mosque_id;

      if (
        !isUuid(mosqueId) ||
        !mosqueIds.includes(
          mosqueId
        ) ||
        !isAllowedReportType(
          row.report_type
        )
      ) {
        continue;
      }

      const current =
        countsByMosque.get(
          mosqueId
        ) ?? emptyCounts();

      current[row.report_type] +=
        1;

      countsByMosque.set(
        mosqueId,
        current
      );

      if (
        row.created_at &&
        !latestByMosque.has(
          mosqueId
        )
      ) {
        latestByMosque.set(
          mosqueId,
          row.created_at
        );
      }
    }

    const map: Record<
      string,
      LiveItem
    > = {};

    for (const mosqueId of mosqueIds) {
      const counts =
        countsByMosque.get(
          mosqueId
        ) ?? emptyCounts();

      const total =
        counts.started +
        counts.delayed +
        counts.full +
        counts.parking_full;

      const updatedAt =
        latestByMosque.get(
          mosqueId
        ) ?? null;

      map[mosqueId] = {
        status:
          getStatusFromCounts(
            counts,
            total
          ),
        total,
        confidence:
          getConfidence(total),
        counts,
        updated_at: updatedAt,
        minutes_ago:
          getMinutesAgo(
            updatedAt
          ),
      };
    }

    return jsonResponse({
      ok: true,
      map,
      meta: {
        prayer: rawPrayer,
        requested_mosque_count:
          mosqueIds.length,
        live_window_minutes:
          LIVE_WINDOW_MINUTES,
        since,
        max_mosque_ids:
          MAX_MOSQUE_IDS,
      },
    });
  } catch (error) {
    console.error(
      "Iqamah live route failed:",
      error
    );

    return jsonResponse(
      {
        ok: false,
        error:
          "Could not load live iqamah status.",
      },
      500
    );
  }
}