import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EnvDiagnostic = {
  present: boolean;
  length: number;
};

function inspectEnv(
  value: string | undefined
): EnvDiagnostic {
  const cleaned =
    typeof value === "string"
      ? value.trim()
      : "";

  return {
    present: cleaned.length > 0,
    length: cleaned.length,
  };
}

export async function GET() {
  const permission =
    await requireAdmin();

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

  return NextResponse.json(
    {
      ok: true,

      runtime: {
        vercel:
          process.env.VERCEL ?? null,

        vercel_env:
          process.env.VERCEL_ENV ??
          null,

        node_env:
          process.env.NODE_ENV ??
          null,
      },

      environment: {
        original_supabase_project_ref:
          inspectEnv(
            process.env
              .SUPABASE_PROJECT_REF
          ),

        test_supabase_project_ref:
          inspectEnv(
            process.env
              .SNM_TEST_PROJECT_REF
          ),

        original_supabase_management_token:
          inspectEnv(
            process.env
              .SUPABASE_MANAGEMENT_ACCESS_TOKEN
          ),

        test_supabase_management_token:
          inspectEnv(
            process.env
              .SNM_TEST_MANAGEMENT_TOKEN
          ),

        supabase_service_role_key:
          inspectEnv(
            process.env
              .SUPABASE_SERVICE_ROLE_KEY
          ),

        openai_api_key:
          inspectEnv(
            process.env
              .OPENAI_API_KEY
          ),

        cron_secret:
          inspectEnv(
            process.env
              .CRON_SECRET
          ),
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