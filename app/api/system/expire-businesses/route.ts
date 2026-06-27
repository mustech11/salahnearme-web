import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    /*
    ---------------------------------------
    SIMPLE SECURITY TOKEN
    ---------------------------------------
    */

    const authHeader = req.headers.get("authorization");

    if (
      authHeader !== `Bearer ${process.env.CRON_SECRET}`
    ) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    /*
    ---------------------------------------
    EXPIRE BUSINESSES
    ---------------------------------------
    */

    const { error } = await supabaseAdmin.rpc(
      "expire_business_upgrades"
    );

    if (error) {
      console.error("Expire businesses error:", error);

      return NextResponse.json(
        {
          ok: false,
          error: error.message,
        },
        { status: 500 }
      );
    }

    /*
    ---------------------------------------
    SUCCESS
    ---------------------------------------
    */

    return NextResponse.json({
      ok: true,
      message: "Expired businesses processed successfully",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Expire route crash:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Server error",
      },
      { status: 500 }
    );
  }
}

