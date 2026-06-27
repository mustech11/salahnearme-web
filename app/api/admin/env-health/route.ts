import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/adminAuth";
import { getEnvHealthReport } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function GET() {
  const permission = await requireAdmin();

  if (!permission.ok) {
    return jsonResponse(
      {
        ok: false,
        error: permission.error,
      },
      permission.status
    );
  }

  return jsonResponse({
    ok: true,
    report: getEnvHealthReport(),
  });
}

