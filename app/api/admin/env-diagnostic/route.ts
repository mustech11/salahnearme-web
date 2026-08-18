import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const permission = await requireAdmin();

  if (!permission.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: permission.error,
      },
      {
        status: permission.status,
      }
    );
  }

  const projectRef =
    process.env.SUPABASE_PROJECT_REF?.trim() ?? "";

  const managementToken =
    process.env.SUPABASE_MANAGEMENT_ACCESS_TOKEN?.trim() ?? "";

  return NextResponse.json(
    {
      ok: true,

      runtime: {
        vercel: process.env.VERCEL ?? null,
        vercel_env: process.env.VERCEL_ENV ?? null,
        node_env: process.env.NODE_ENV ?? null,
      },

      environment: {
        project_ref_present:
          projectRef.length > 0,

        project_ref_length:
          projectRef.length,

        management_token_present:
          managementToken.length > 0,

        management_token_length:
          managementToken.length,
      },

      checked_at:
        new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control":
          "no-store, no-cache, must-revalidate",
      },
    }
  );
}