import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const supabase = await supabaseServer();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const businessId = searchParams.get("business_id");

    if (!businessId) {
      return NextResponse.json(
        { error: "Missing business_id" },
        { status: 400 }
      );
    }

    const { data: ownership, error: ownershipError } = await supabase
      .from("business_users")
      .select("business_id")
      .eq("business_id", businessId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (ownershipError) {
      return NextResponse.json(
        { error: ownershipError.message },
        { status: 500 }
      );
    }

    if (!ownership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("business_notifications")
      .select("id,title,body,read,created_at")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      notifications: data ?? [],
    });
  } catch (error) {
    console.error("business dashboard notifications error:", error);

    return NextResponse.json(
      { error: "Could not load notifications." },
      { status: 500 }
    );
  }
}

