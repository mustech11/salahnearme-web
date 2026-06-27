import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OpeningHoursItem = {
  day?: string;
  open?: string;
  close?: string;
  closed?: boolean;
};

type OpeningHoursValue = string | OpeningHoursItem | OpeningHoursItem[];

type RequestBody = {
  business_id?: unknown;
  opening_hours?: unknown;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value.trim()
    )
  );
}

function isPlainObject(value: unknown) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isValidOpeningHours(value: unknown): value is OpeningHoursValue {
  if (typeof value === "string") {
    return value.trim().length > 0 && value.trim().length <= 3000;
  }

  if (Array.isArray(value)) {
    return value.length <= 14 && value.every((item) => isPlainObject(item));
  }

  if (isPlainObject(value)) {
    return true;
  }

  return false;
}

export async function GET() {
  return jsonResponse({
    ok: true,
    route: "/api/business-dashboard/opening-hours",
    method: "POST",
    body: {
      business_id: "uuid",
      opening_hours: "string, object, or array",
    },
  });
}

export async function POST(req: Request) {
  try {
    const supabase = await supabaseServer();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return jsonResponse(
        {
          ok: false,
          error: "You must be signed in.",
        },
        401
      );
    }

    const body = (await req.json().catch(() => ({}))) as RequestBody;

    const businessId =
      typeof body.business_id === "string" ? body.business_id.trim() : null;

    if (!isUuid(businessId)) {
      return jsonResponse(
        {
          ok: false,
          error: "Missing or invalid business_id.",
        },
        400
      );
    }

    if (!isValidOpeningHours(body.opening_hours)) {
      return jsonResponse(
        {
          ok: false,
          error: "Missing or invalid opening_hours.",
        },
        400
      );
    }

    const { data: claim, error: claimError } = await supabase
      .from("business_claims")
      .select("id, status")
      .eq("business_id", businessId)
      .eq("user_id", user.id)
      .in("status", ["approved", "active", "verified"])
      .maybeSingle();

    if (claimError) {
      console.error("opening-hours claim lookup error:", claimError);

      return jsonResponse(
        {
          ok: false,
          error: "Could not verify business permission.",
        },
        500
      );
    }

    if (!claim) {
      return jsonResponse(
        {
          ok: false,
          error: "You do not have permission to update this business.",
        },
        403
      );
    }

    const { data, error } = await supabase
      .from("businesses")
      .update({
        opening_hours: body.opening_hours,
        updated_at: new Date().toISOString(),
      })
      .eq("id", businessId)
      .select("id, name, slug, opening_hours, updated_at")
      .single();

    if (error) {
      console.error("opening-hours update error:", error);

      return jsonResponse(
        {
          ok: false,
          error: "Could not update opening hours.",
        },
        500
      );
    }

    return jsonResponse({
      ok: true,
      business: data,
    });
  } catch (error) {
    console.error("opening-hours route error:", error);

    return jsonResponse(
      {
        ok: false,
        error: "Could not update opening hours.",
      },
      500
    );
  }
}