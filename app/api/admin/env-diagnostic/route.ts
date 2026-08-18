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
        supabase_project_ref:
          inspectEnv(
            process.env
              .SUPABASE_PROJECT_REF
          ),

        supabase_management_access_token:
          inspectEnv(
            process.env
              .SUPABASE_MANAGEMENT_ACCESS_TOKEN
          ),

        supabase_service_role_key:
          inspectEnv(
            process.env
              .SUPABASE_SERVICE_ROLE_KEY
          ),

        next_public_supabase_url:
          inspectEnv(
            process.env
              .NEXT_PUBLIC_SUPABASE_URL
          ),

        next_public_supabase_anon_key:
          inspectEnv(
            process.env
              .NEXT_PUBLIC_SUPABASE_ANON_KEY
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