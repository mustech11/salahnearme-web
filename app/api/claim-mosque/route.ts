import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type ClaimBody = {
  mosque_id: string | number;
  mosque_slug?: string | null;
  mosque_name?: string | null;
  full_name: string;
  email: string;
  phone?: string;
  role?: string;
  relationship: string;
  proof?: string;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as ClaimBody | null;

    if (!body) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const mosque_id = body.mosque_id;
    const mosque_slug = clean(body.mosque_slug);
    const mosque_name = clean(body.mosque_name);
    const full_name = clean(body.full_name);
    const email = clean(body.email);
    const phone = clean(body.phone);
    const role = clean(body.role);
    const relationship = clean(body.relationship);
    const proof = clean(body.proof);

    if (!mosque_id || !full_name || !email || !relationship) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin.from("mosque_claim_requests").insert({
      mosque_id,
      mosque_slug: mosque_slug || null,
      mosque_name: mosque_name || null,
      full_name,
      email,
      phone: phone || null,
      role: role || null,
      relationship,
      proof: proof || null,
      status: "pending",
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("claim mosque route error:", error);
    return NextResponse.json(
      { error: "Could not submit claim request" },
      { status: 500 }
    );
  }
}

