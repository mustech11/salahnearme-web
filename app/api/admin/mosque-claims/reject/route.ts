import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";

type Body = {
  claim_id?: string;
};

function cleanString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const reviewerEmail = (user.email ?? "").trim().toLowerCase();

    if (!reviewerEmail) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }

    const body = (await req.json()) as Body;
    const claimId = cleanString(body.claim_id);

    if (!claimId) {
      return NextResponse.json({ error: "Missing claim_id" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("mosque_claim_requests")
      .update({
        status: "rejected",
        reviewed_by: reviewerEmail,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", claimId)
      .eq("status", "pending");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("reject mosque claim error:", error);
    return NextResponse.json(
      { error: "Could not reject mosque claim" },
      { status: 400 }
    );
  }
}

