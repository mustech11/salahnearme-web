import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  business_id?: unknown;
  business_slug?: unknown;
  business_name?: unknown;
  full_name?: unknown;
  phone?: unknown;
  role?: unknown;
  relationship?: unknown;
  proof?: unknown;
  website_honeypot?: unknown;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function clean(value: unknown, maxLength = 500) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function nullable(value: unknown, maxLength = 500) {
  const cleaned = clean(value, maxLength);

  return cleaned.length > 0 ? cleaned : null;
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value.trim()
    )
  );
}

function normalizePhone(value: unknown) {
  const phone = clean(value, 60);

  if (!phone) {
    return null;
  }

  return phone.replace(/[^\d+()\-\s]/g, "").slice(0, 60);
}

async function findExistingClaim(args: {
  businessId: string;
  userEmail: string;
}) {
  const { data, error } = await supabaseAdmin
    .from("business_claim_requests")
    .select("id, status, created_at")
    .eq("business_id", args.businessId)
    .eq("email", args.userEmail)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function GET() {
  return jsonResponse({
    ok: true,
    route: "/api/claim/business",
    method: "POST",
    body: {
      business_id: "uuid",
      business_slug: "optional",
      business_name: "optional",
      full_name: "required",
      phone: "optional",
      role: "optional",
      relationship: "optional",
      proof: "optional",
      website_honeypot: "optional anti-spam; leave empty",
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

    if (userError || !user?.email) {
      return jsonResponse(
        {
          ok: false,
          error: "Unauthorized.",
        },
        401
      );
    }

    const body = (await req.json().catch(() => null)) as Body | null;

    if (!body) {
      return jsonResponse(
        {
          ok: false,
          error: "Missing request body.",
        },
        400
      );
    }

    if (clean(body.website_honeypot, 100)) {
      return jsonResponse(
        {
          ok: false,
          error: "Submission rejected.",
        },
        400
      );
    }

    const businessId = clean(body.business_id, 80);
    const fullName = clean(body.full_name, 160);

    if (!isUuid(businessId)) {
      return jsonResponse(
        {
          ok: false,
          error: "Missing or invalid business_id.",
        },
        400
      );
    }

    if (!fullName || fullName.length < 2) {
      return jsonResponse(
        {
          ok: false,
          error: "Full name is required.",
        },
        400
      );
    }

    const { data: business, error: businessError } = await supabaseAdmin
      .from("businesses")
      .select("id, name, slug, city, is_claimed")
      .eq("id", businessId)
      .maybeSingle();

    if (businessError) {
      console.error("business claim business lookup error:", businessError);

      return jsonResponse(
        {
          ok: false,
          error: "Could not verify business.",
        },
        500
      );
    }

    if (!business) {
      return jsonResponse(
        {
          ok: false,
          error: "Business not found.",
        },
        404
      );
    }

    const existingClaim = await findExistingClaim({
      businessId,
      userEmail: user.email,
    });

    if (
      existingClaim &&
      ["pending", "reviewing", "approved", "active", "verified"].includes(
        String(existingClaim.status)
      )
    ) {
      return jsonResponse(
        {
          ok: false,
          error: "You already have a claim request for this business.",
          existing_claim: existingClaim,
        },
        409
      );
    }

    const businessSlug =
      nullable(body.business_slug, 220) ?? business.slug ?? null;

    const businessName =
      nullable(body.business_name, 220) ?? business.name ?? null;

    const { data, error } = await supabaseAdmin
      .from("business_claim_requests")
      .insert({
        business_id: businessId,
        business_slug: businessSlug,
        business_name: businessName,
        full_name: fullName,
        email: user.email,
        user_id: user.id,
        phone: normalizePhone(body.phone),
        role: nullable(body.role, 120),
        relationship: nullable(body.relationship, 500),
        proof: nullable(body.proof, 2000),
        status: "pending",
        metadata: {
          source: "business_claim_route",
          business_city: business.city,
          user_agent: req.headers.get("user-agent"),
          ip_hint:
            req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
            req.headers.get("x-real-ip") ??
            null,
        },
      })
      .select(
        "id, business_id, business_slug, business_name, full_name, email, status, created_at"
      )
      .single();

    if (error) {
      console.error("business claim insert error:", error);

      return jsonResponse(
        {
          ok: false,
          error: error.message,
        },
        500
      );
    }

    return jsonResponse(
      {
        ok: true,
        claim: data,
        message: "Business claim submitted for review.",
      },
      201
    );
  } catch (error) {
    console.error("business claim route error:", error);

    return jsonResponse(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not submit business claim.",
      },
      500
    );
  }
}