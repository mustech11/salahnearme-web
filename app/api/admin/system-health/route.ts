import { NextResponse } from "next/server";

import type { SupabaseClient } from "@supabase/supabase-js";

import { requireAdminForRequest } from "@/lib/requireAdminCompat";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_HISTORY_LIMIT =
  30;

const MAX_HISTORY_LIMIT =
  365;

const monitoringDb =
  supabaseAdmin as unknown as SupabaseClient;

function getHistoryLimit(
  request: Request
): number {
  const url =
    new URL(
      request.url
    );

  const parsed =
    Number(
      url.searchParams.get(
        "limit"
      )
    );

  if (
    !Number.isFinite(
      parsed
    )
  ) {
    return DEFAULT_HISTORY_LIMIT;
  }

  return Math.min(
    MAX_HISTORY_LIMIT,
    Math.max(
      1,
      Math.trunc(
        parsed
      )
    )
  );
}

function getErrorMessage(
  error: unknown
): string {
  return error instanceof Error
    ? error.message
    : "System health could not be loaded.";
}

function isAuthorisationError(
  message: string
): boolean {
  return /admin|authori[sz]|permission|forbidden|unauthenticated|sign in/i.test(
    message
  );
}

export async function GET(
  request: Request
) {
  try {
    await requireAdminForRequest(
      request
    );

    const limit =
      getHistoryLimit(
        request
      );

    const [
      latestResult,
      historyResult,
      alertsResult,
    ] =
      await Promise.all([
        monitoringDb
          .from(
            "system_health_snapshots"
          )
          .select("*")
          .order(
            "checked_at",
            {
              ascending:
                false,
            }
          )
          .limit(1)
          .maybeSingle(),

        monitoringDb
          .from(
            "system_health_snapshots"
          )
          .select(
            "id,overall_status,mode,response_time_ms,checked_at,service_status,metrics"
          )
          .order(
            "checked_at",
            {
              ascending:
                false,
            }
          )
          .limit(limit),

        monitoringDb
          .from(
            "system_health_alerts"
          )
          .select("*")
          .in(
            "status",
            [
              "active",
              "acknowledged",
            ]
          )
          .order(
            "last_detected_at",
            {
              ascending:
                false,
            }
          )
          .limit(100),
      ]);

    const firstError =
      latestResult.error ??
      historyResult.error ??
      alertsResult.error;

    if (firstError) {
      return NextResponse.json(
        {
          ok: false,
          error:
            firstError.message,
        },
        {
          status: 500,
          headers: {
            "Cache-Control":
              "no-store",
          },
        }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        latest:
          latestResult.data ??
          null,
        history:
          historyResult.data ??
          [],
        alerts:
          alertsResult.data ??
          [],
      },
      {
        headers: {
          "Cache-Control":
            "private, no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error(
      "System health read failed:",
      error
    );

    const message =
      getErrorMessage(
        error
      );

    const authorisationError =
      isAuthorisationError(
        message
      );

    return NextResponse.json(
      {
        ok: false,
        error:
          authorisationError
            ? "You are not authorised to view system health."
            : message,
      },
      {
        status:
          authorisationError
            ? 403
            : 500,
        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  }
}
