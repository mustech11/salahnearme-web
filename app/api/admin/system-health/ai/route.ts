import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/adminAuth";
import {
  generateOperationsAssessment,
  type OperationsHistoryItem,
} from "@/lib/ai/operations";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { analyseSystemHealth } from "@/lib/systemHealthIntelligence";
import type { SystemHealthSnapshot } from "@/lib/systemHealthTypes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_HISTORY_LIMIT = 12;
const MAX_HISTORY_LIMIT = 30;

type SnapshotRow = {
  id: string;
  overall_status: string;
  mode: string;
  service_status: unknown;
  metrics: unknown;
  response_time_ms: number | null;
  checked_at: string;
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
    },
  });
}

function getHistoryLimit(
  req: Request
): number {
  try {
    const url =
      new URL(req.url);

    const raw =
      url.searchParams.get(
        "limit"
      );

    if (!raw) {
      return DEFAULT_HISTORY_LIMIT;
    }

    const parsed =
      Number.parseInt(
        raw,
        10
      );

    if (
      !Number.isFinite(parsed)
    ) {
      return DEFAULT_HISTORY_LIMIT;
    }

    return Math.max(
      2,
      Math.min(
        MAX_HISTORY_LIMIT,
        parsed
      )
    );
  } catch {
    return DEFAULT_HISTORY_LIMIT;
  }
}

function getObject(
  value: unknown
): Record<string, unknown> {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as Record<
      string,
      unknown
    >;
  }

  return {};
}

function getArray<T = unknown>(
  value: unknown
): T[] {
  return Array.isArray(value)
    ? (value as T[])
    : [];
}

function toSnapshot(
  row:
    | SnapshotRow
    | null
): SystemHealthSnapshot | null {
  if (!row) {
    return null;
  }

  const metrics =
    getObject(
      row.metrics
    );

  const usage =
    getArray(
      metrics.usage
    );

  const application =
    getArray(
      metrics.application
    );

  const services =
    getArray(
      row.service_status
    );

  return {
    overall_status:
      row.overall_status as SystemHealthSnapshot["overall_status"],

    mode:
      row.mode as SystemHealthSnapshot["mode"],

    services:
      services as SystemHealthSnapshot["services"],

    usage:
      usage as SystemHealthSnapshot["usage"],

    application:
      application as SystemHealthSnapshot["application"],

    response_time_ms:
      typeof row.response_time_ms ===
        "number" &&
      Number.isFinite(
        row.response_time_ms
      )
        ? row.response_time_ms
        : 0,

    checked_at:
      row.checked_at,

    metadata: {
      project_ref_configured:
        Boolean(
          process.env
            .SUPABASE_PROJECT_REF
        ),

      management_api_configured:
        Boolean(
          process.env
            .SUPABASE_MANAGEMENT_ACCESS_TOKEN
        ),

      site_url:
        process.env
          .NEXT_PUBLIC_SITE_URL ??
        process.env
          .NEXT_PUBLIC_APP_URL ??
        null,

      version: 1,
    },
  };
}

function toHistoryItem(
  row: SnapshotRow
): OperationsHistoryItem {
  const metrics =
    getObject(
      row.metrics
    );

  return {
    overall_status:
      row.overall_status,

    response_time_ms:
      row.response_time_ms,

    checked_at:
      row.checked_at,

    services:
      getArray(
        row.service_status
      ) as OperationsHistoryItem["services"],

    usage:
      getArray(
        metrics.usage
      ) as OperationsHistoryItem["usage"],
  };
}

function isSnapshotRow(
  value: unknown
): value is SnapshotRow {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return false;
  }

  const row =
    value as Record<
      string,
      unknown
    >;

  return (
    typeof row.id === "string" &&
    typeof row.overall_status ===
      "string" &&
    typeof row.mode === "string" &&
    typeof row.checked_at ===
      "string" &&
    (
      row.response_time_ms ===
        null ||
      (
        typeof row.response_time_ms ===
          "number" &&
        Number.isFinite(
          row.response_time_ms
        )
      )
    )
  );
}

async function loadSnapshotHistory(
  limit: number
): Promise<SnapshotRow[]> {
  const {
    data,
    error,
  } = await supabaseAdmin
    .from(
      "system_health_snapshots"
    )
    .select(
      "id,overall_status,mode,service_status,metrics,response_time_ms,checked_at"
    )
    .order(
      "checked_at",
      {
        ascending: false,
      }
    )
    .limit(limit);

  if (error) {
    throw new Error(
      `Could not load system health snapshots: ${error.message}`
    );
  }

  if (!Array.isArray(data)) {
    return [];
  }

  return data.filter(
    isSnapshotRow
  );
}
async function runAssessment(
  req: Request
) {
  const permission =
    await requireAdmin();

  if (!permission.ok) {
    return jsonResponse(
      {
        ok: false,
        error:
          permission.error,
      },
      permission.status
    );
  }

  const limit =
    getHistoryLimit(req);

  const rows =
    await loadSnapshotHistory(
      limit
    );

  const latestRow =
    rows[0] ??
    null;

  const snapshot =
    toSnapshot(
      latestRow
    );

  const history =
    rows.map(
      toHistoryItem
    );

  const intelligence =
    analyseSystemHealth(
      snapshot
    );

  const result =
    await generateOperationsAssessment(
      {
        snapshot,
        intelligence,
        history,
      }
    );

  return jsonResponse({
    ok: true,

    latest_snapshot_id:
      latestRow?.id ??
      null,

    history_count:
      history.length,

    generated_at:
      new Date().toISOString(),

    operations:
      result,
  });
}

export async function GET(
  req: Request
) {
  try {
    return await runAssessment(
      req
    );
  } catch (error) {
    console.error(
      "system-health AI GET error:",
      error
    );

    return jsonResponse(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : "Unexpected Operations AI error.",
      },
      500
    );
  }
}

export async function POST(
  req: Request
) {
  try {
    return await runAssessment(
      req
    );
  } catch (error) {
    console.error(
      "system-health AI POST error:",
      error
    );

    return jsonResponse(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : "Unexpected Operations AI error.",
      },
      500
    );
  }
}