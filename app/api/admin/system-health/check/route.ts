import { NextResponse } from "next/server";

import { requireAdminForRequest } from "@/lib/requireAdminCompat";
import { applyAlerts } from "@/lib/supabaseAlertEngine";
import {
  collectSystemHealth,
  persistSystemHealthSnapshot,
  pruneSystemHealthHistory,
} from "@/lib/supabaseMonitoring";
import type {
  HealthCheckMode,
} from "@/lib/systemHealthTypes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type RequestBody = {
  mode?: HealthCheckMode;
};

function isMode(
  value: unknown
): value is HealthCheckMode {
  return (
    value ===
      "lightweight" ||
    value ===
      "daily"
  );
}

function getErrorMessage(
  error: unknown
): string {
  return error instanceof Error
    ? error.message
    : "System health check failed.";
}

function isAuthorisationError(
  message: string
): boolean {
  return /admin|authori[sz]|permission|forbidden|unauthenticated|sign in/i.test(
    message
  );
}

export async function POST(
  request: Request
) {
  try {
    await requireAdminForRequest(
      request
    );

    const body =
      (await request
        .json()
        .catch(
          () => ({})
        )) as RequestBody;

    const mode:
      HealthCheckMode =
      isMode(body.mode)
        ? body.mode
        : "lightweight";

    const snapshot =
      await collectSystemHealth(
        mode
      );

    const snapshotId =
      await persistSystemHealthSnapshot(
        snapshot
      );

    const alerts =
      await applyAlerts(
        snapshot,
        snapshotId
      );

    if (
      mode === "daily"
    ) {
      await pruneSystemHealthHistory();
    }

    return NextResponse.json(
      {
        ok: true,
        snapshot_id:
          snapshotId,
        snapshot,
        alerts_created_or_updated:
          alerts.length,
      },
      {
        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "Manual system health check failed:",
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
            ? "You are not authorised to run a system health check."
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
