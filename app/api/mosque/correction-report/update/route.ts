import { NextResponse } from "next/server";

import { requireMosqueManager } from "@/lib/mosqueManagerAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_STATUSES = ["new", "reviewing", "resolved", "rejected"] as const;

type AllowedStatus = (typeof ALLOWED_STATUSES)[number];

type RequestBody = {
  report_id?: unknown;
  mosque_id?: unknown;
  status?: unknown;
  admin_notes?: unknown;
};

function isValidUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

function isAllowedStatus(value: unknown): value is AllowedStatus {
  return (
    typeof value === "string" &&
    ALLOWED_STATUSES.includes(value as AllowedStatus)
  );
}

function cleanOptionalNotes(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, 2000);
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "/api/mosque/correction-report/update",
    method: "POST",
    allowed_statuses: ALLOWED_STATUSES,
    body: {
      report_id: "uuid",
      mosque_id: "uuid",
      status: "reviewing",
      admin_notes: "optional notes",
    },
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as RequestBody;

    if (!isValidUuid(body.report_id)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing or invalid report_id.",
        },
        {
          status: 400,
        }
      );
    }

    if (!isValidUuid(body.mosque_id)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing or invalid mosque_id.",
        },
        {
          status: 400,
        }
      );
    }

    if (!isAllowedStatus(body.status)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing or invalid status.",
          allowed_statuses: ALLOWED_STATUSES,
        },
        {
          status: 400,
        }
      );
    }

    const reportId = body.report_id;
    const mosqueId = body.mosque_id;
    const status = body.status;
    const adminNotes = cleanOptionalNotes(body.admin_notes);

    const permission = await requireMosqueManager(mosqueId);

    if (!permission.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: permission.error,
        },
        {
          status: 403,
        }
      );
    }

    const { data: existingReport, error: existingError } = await supabaseAdmin
      .from("mosque_correction_reports")
      .select("id, mosque_id")
      .eq("id", reportId)
      .eq("mosque_id", mosqueId)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json(
        {
          ok: false,
          error: existingError.message,
        },
        {
          status: 500,
        }
      );
    }

    if (!existingReport) {
      return NextResponse.json(
        {
          ok: false,
          error: "Correction report not found for this mosque.",
        },
        {
          status: 404,
        }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("mosque_correction_reports")
      .update({
        status,
        admin_notes: adminNotes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", reportId)
      .eq("mosque_id", mosqueId)
      .select(
        `
        id,
        mosque_id,
        report_type,
        status,
        admin_notes,
        updated_at
      `
      )
      .single();

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      ok: true,
      report: data,
    });
  } catch (error) {
    console.error("correction report update error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Could not update correction report.",
      },
      {
        status: 500,
      }
    );
  }
}

