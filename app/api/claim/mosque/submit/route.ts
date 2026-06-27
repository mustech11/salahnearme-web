import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type Body = {
  mosque_id?: string;
  full_name?: string;
  email?: string;
  phone?: string | null;
  role?: string | null;
  relationship?: string | null;
  proof?: string | null;
};

function cleanString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function cleanEmail(value: unknown) {
  const email = cleanString(value);
  return email ? email.toLowerCase() : null;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    const mosqueId = cleanString(body.mosque_id);
    const fullName = cleanString(body.full_name);
    const email = cleanEmail(body.email);
    const phone = cleanString(body.phone);
    const role = cleanString(body.role);
    const relationship = cleanString(body.relationship);
    const proof = cleanString(body.proof);

    if (!mosqueId || !fullName || !email) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const { data: mosque, error: mosqueError } = await supabaseAdmin
      .from("mosques")
      .select("id,name")
      .eq("id", mosqueId)
      .maybeSingle();

    if (mosqueError) {
      return NextResponse.json({ error: mosqueError.message }, { status: 500 });
    }

    if (!mosque) {
      return NextResponse.json({ error: "Mosque not found" }, { status: 404 });
    }

    const { data: existingApproved } = await supabaseAdmin
      .from("mosque_manager_roles")
      .select("id")
      .eq("mosque_id", mosqueId)
      .eq("user_email", email)
      .eq("status", "active")
      .maybeSingle();

    if (existingApproved) {
      return NextResponse.json(
        { error: "This email already has mosque access." },
        { status: 409 }
      );
    }

    const { data: existingPending } = await supabaseAdmin
      .from("mosque_claim_requests")
      .select("id")
      .eq("mosque_id", mosqueId)
      .eq("email", email)
      .eq("status", "pending")
      .maybeSingle();

    if (existingPending) {
      return NextResponse.json(
        { error: "A pending claim already exists for this email." },
        { status: 409 }
      );
    }

    const { error: insertError } = await supabaseAdmin
      .from("mosque_claim_requests")
      .insert({
        mosque_id: mosqueId,
        mosque_name: mosque.name,
        full_name: fullName,
        email,
        phone,
        role,
        relationship,
        proof,
        status: "pending",
      });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("mosque claim submit error:", error);
    return NextResponse.json(
      { error: "Could not submit mosque claim" },
      { status: 400 }
    );
  }
}

