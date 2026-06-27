import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const { claim_id } = await req.json();

    if (!claim_id) {
      return NextResponse.json({ error: "Missing claim_id" }, { status: 400 });
    }

    const { data: claim } = await supabaseAdmin
      .from("mosque_claim_requests")
      .select("*")
      .eq("id", claim_id)
      .single();

    if (!claim) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    }

    // mark mosque as claimed
    await supabaseAdmin
      .from("mosques")
      .update({
        is_claimed: true,
        claimed_by_email: claim.email,
      })
      .eq("id", claim.mosque_id);

    // update claim status
    await supabaseAdmin
      .from("mosque_claim_requests")
      .update({ status: "approved" })
      .eq("id", claim_id);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

