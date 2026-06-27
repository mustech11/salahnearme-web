import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  business_id?: unknown;
  featured?: unknown;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function cleanString(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value.trim()
    )
  );
}

function parseFeatured(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const cleaned = value.trim().toLowerCase();

    if (["true", "1", "yes", "on"].includes(cleaned)) {
      return true;
    }

    if (["false", "0", "no", "off"].includes(cleaned)) {
      return false;
    }
  }

  return null;
}

export async function GET() {
  return jsonResponse({
    ok: true,
    route: "/api/admin/toggle-featured",
    method: "POST",
    body: {
      business_id: "uuid",
      featured: "boolean",
    },
  });
}

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();

    if (!admin.ok) {
      return jsonResponse(
        {
          ok: false,
          error: admin.error,
        },
        admin.status
      );
    }

    const body = (await req.json().catch(() => null)) as Body | null;

    if (!body) {
      return jsonResponse(
        {
          ok: false,
          error: "Missing request body.",
        },
        400
      );
    }

    const businessId = cleanString(body.business_id);

    if (!isUuid(businessId)) {
      return jsonResponse(
        {
          ok: false,
          error: "Missing or invalid business_id.",
        },
        400
      );
    }

    const featured = parseFeatured(body.featured);

    if (featured === null) {
      return jsonResponse(
        {
          ok: false,
          error: "Missing or invalid featured value.",
        },
        400
      );
    }

    const { data, error } = await supabaseAdmin
      .from("businesses")
      .update({
        featured,
        updated_at: new Date().toISOString(),
      })
      .eq("id", businessId)
      .select("id, name, slug, featured, updated_at")
      .single();

    if (error) {
      console.error("toggle featured update error:", error);

      return jsonResponse(
        {
          ok: false,
          error: error.message,
        },
        500
      );
    }

    return jsonResponse({
      ok: true,
      business: data,
      message: featured
        ? "Business marked as featured."
        : "Business removed from featured.",
    });
  } catch (error) {
    console.error("toggle featured route error:", error);

    return jsonResponse(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not toggle featured status.",
      },
      500
    );
  }
}