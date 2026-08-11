import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { applyAlerts } from "@/lib/supabaseAlertEngine";
import {
  collectSystemHealth,
  persistSystemHealthSnapshot,
  pruneSystemHealthHistory,
} from "@/lib/supabaseMonitoring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DAILY_MODE = "daily" as const;

/**
 * Prevent accidental duplicate daily checks.
 *
 * Vercel may retry a cron invocation if a previous invocation appears
 * unsuccessful. This window also protects the endpoint against repeated
 * manual requests.
 */
const DUPLICATE_WINDOW_HOURS = 20;

type LatestSnapshotRow = {
  id: string;
  mode: string;
  checked_at: string;
};

type CronResult = {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  snapshot_id?: string;
  overall_status?: string;
  alerts_created_or_updated?: number;
  retention_pruned?: boolean;
  checked_at?: string;
  duration_ms?: number;
  error?: string;
};

function jsonResponse(
  body: CronResult,
  status = 200
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function getBearerToken(request: Request): string {
  const authorization =
    request.headers.get("authorization")?.trim() ?? "";

  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return authorization.slice("bearer ".length).trim();
}

function isAuthorisedCronRequest(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim();

  if (!cronSecret) {
    console.error(
      "System health cron refused: CRON_SECRET is not configured."
    );

    return false;
  }

  const bearerToken = getBearerToken(request);
  const headerSecret =
    request.headers.get("x-cron-secret")?.trim() ?? "";

  return (
    bearerToken === cronSecret ||
    headerSecret === cronSecret
  );
}

function requestForcesRun(request: Request): boolean {
  try {
    const url = new URL(request.url);

    return (
      url.searchParams.get("force") === "1" ||
      url.searchParams.get("force") === "true"
    );
  } catch {
    return false;
  }
}

function getDuplicateCutoff(): string {
  const cutoff = new Date(
    Date.now() -
      DUPLICATE_WINDOW_HOURS * 60 * 60 * 1000
  );

  return cutoff.toISOString();
}

async function getRecentDailySnapshot(): Promise<
  LatestSnapshotRow | null
> {
  const { data, error } = await supabaseAdmin
    .from("system_health_snapshots")
    .select("id,mode,checked_at")
    .eq("mode", DAILY_MODE)
    .gte("checked_at", getDuplicateCutoff())
    .order("checked_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Could not check the latest daily health snapshot: ${error.message}`
    );
  }

  if (!data) {
    return null;
  }

  return {
    id: String(data.id),
    mode: String(data.mode),
    checked_at: String(data.checked_at),
  };
}

async function runDailySystemHealthCheck(
  force: boolean
): Promise<CronResult> {
  const startedAt = Date.now();

  if (!force) {
    const existingSnapshot =
      await getRecentDailySnapshot();

    if (existingSnapshot) {
      return {
        ok: true,
        skipped: true,
        reason:
          "A daily system health check has already completed within the duplicate-protection window.",
        snapshot_id: existingSnapshot.id,
        checked_at: existingSnapshot.checked_at,
        duration_ms: Date.now() - startedAt,
      };
    }
  }

  const snapshot = await collectSystemHealth(DAILY_MODE);

  const snapshotId =
    await persistSystemHealthSnapshot(snapshot);

  /**
   * applyAlerts performs all current incident processing:
   *
   * - service health alerts
   * - quota threshold alerts
   * - latency anomaly detection
   * - existing alert updates
   * - automatic resolution of recovered alerts
   */
  const alerts = await applyAlerts(
    snapshot,
    snapshotId
  );

  /**
   * Keep detailed snapshots according to the retention rules implemented
   * by supabaseMonitoring.ts.
   */
  await pruneSystemHealthHistory();

  return {
    ok: true,
    skipped: false,
    snapshot_id: snapshotId,
    overall_status: snapshot.overall_status,
    alerts_created_or_updated: alerts.length,
    retention_pruned: true,
    checked_at: snapshot.checked_at,
    duration_ms: Date.now() - startedAt,
  };
}

export async function GET(request: Request) {
  try {
    if (!isAuthorisedCronRequest(request)) {
      return jsonResponse(
        {
          ok: false,
          error: "Unauthorised cron request.",
        },
        401
      );
    }

    const force = requestForcesRun(request);

    const result =
      await runDailySystemHealthCheck(force);

    console.info("System health cron completed:", {
      skipped: result.skipped ?? false,
      snapshot_id: result.snapshot_id ?? null,
      overall_status: result.overall_status ?? null,
      alerts_created_or_updated:
        result.alerts_created_or_updated ?? 0,
      duration_ms: result.duration_ms ?? null,
    });

    return jsonResponse(result);
  } catch (error) {
    console.error(
      "System health cron failed:",
      error
    );

    return jsonResponse(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "The daily system health check failed.",
      },
      500
    );
  }
}

/**
 * POST is retained for authenticated local testing and controlled
 * administrative invocation. Vercel Cron itself uses GET.
 */
export async function POST(request: Request) {
  return GET(request);
}