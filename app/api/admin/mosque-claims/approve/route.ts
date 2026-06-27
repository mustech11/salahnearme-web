import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";

type Body = {
  claim_id?: string;
  granted_role?: "owner" | "manager" | "editor";
};

function cleanString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeGrantedRole(value: unknown): "owner" | "manager" | "editor" {
  if (value === "owner" || value === "manager" || value === "editor") {
    return value;
  }
  return "manager";
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
    const grantedRole = normalizeGrantedRole(body.granted_role);

    if (!claimId) {
      return NextResponse.json({ error: "Missing claim_id" }, { status: 400 });
    }

    const { data: claim, error: claimError } = await supabaseAdmin
      .from("mosque_claim_requests")
      .select("*")
      .eq("id", claimId)
      .maybeSingle();

    if (claimError) {
      return NextResponse.json({ error: claimError.message }, { status: 500 });
    }

    if (!claim) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    }

    if (claim.status !== "pending") {
      return NextResponse.json(
        { error: "This claim has already been reviewed." },
        { status: 409 }
      );
    }

    const { error: roleError } = await supabaseAdmin
      .from("mosque_manager_roles")
      .upsert(
        {
          mosque_id: claim.mosque_id,
          user_email: String(claim.email).trim().toLowerCase(),
          role: grantedRole,
          status: "active",
          granted_by: reviewerEmail,
          granted_at: new Date().toISOString(),
        },
        {
          onConflict: "mosque_id,user_email",
        }
      );

    if (roleError) {
      return NextResponse.json({ error: roleError.message }, { status: 500 });
    }

    const { error: updateError } = await supabaseAdmin
      .from("mosque_claim_requests")
      .update({
        status: "approved",
        reviewed_by: reviewerEmail,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", claimId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("approve mosque claim error:", error);
    return NextResponse.json(
      { error: "Could not approve mosque claim" },
      { status: 400 }
    );
  }
}

