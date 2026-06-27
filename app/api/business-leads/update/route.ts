import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { lead_id, status } = body;

    if (!lead_id || !status) {
      return NextResponse.json(
        { error: "Missing lead_id or status" },
        { status: 400 }
      );
    }

    const allowed = ["new", "contacted", "won", "lost", "archived"];

    if (!allowed.includes(status)) {
      return NextResponse.json(
        { error: "Invalid status" },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("business_leads")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", lead_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Could not update lead" },
      { status: 500 }
    );
  }
}

