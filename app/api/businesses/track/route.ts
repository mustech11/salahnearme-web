import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      business_id,
      event_type,
      page_type,
      city_slug,
      user_fingerprint,
    } = body;

    if (!business_id || !event_type) {
      return NextResponse.json(
        { error: "Missing fields" },
        { status: 400 }
      );
    }

    const forwarded =
      req.headers.get("x-forwarded-for") || "";

    const ip =
      forwarded.split(",")[0]?.trim() || null;

    const userAgent =
      req.headers.get("user-agent") || null;

    const { error } = await supabaseAdmin
      .from("business_analytics")
      .insert({
        business_id,
        event_type,
        page_type,
        city_slug,
        user_fingerprint,
        ip_address: ip,
        user_agent: userAgent,
      });

    if (error) {
      console.error(error);

      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Tracking failed" },
      { status: 500 }
    );
  }
}

