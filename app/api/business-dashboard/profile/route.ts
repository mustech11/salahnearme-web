import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  business_id?: string;
  phone?: string | null;
  website?: string | null;
  maps_url?: string | null;
  address?: string | null;
  postcode?: string | null;
  area?: string | null;
  description?: string | null;
};

const allowedFields = [
  "phone",
  "website",
  "maps_url",
  "address",
  "postcode",
  "area",
  "description",
] as const;

function clean(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normaliseUrl(value: unknown) {
  const cleaned = clean(value);

  if (!cleaned) return null;

  if (cleaned.startsWith("http://") || cleaned.startsWith("https://")) {
    return cleaned;
  }

  return `https://${cleaned}`;
}

export async function POST(req: Request) {
  try {
    const supabase = await supabaseServer();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as Body | null;

    if (!body?.business_id) {
      return NextResponse.json(
        { error: "Missing business_id" },
        { status: 400 }
      );
    }

    const { data: ownership, error: ownershipError } = await supabase
      .from("business_users")
      .select("business_id")
      .eq("business_id", body.business_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (ownershipError) {
      return NextResponse.json(
        { error: ownershipError.message },
        { status: 500 }
      );
    }

    if (!ownership) {
      return NextResponse.json(
        { error: "You do not have access to this business." },
        { status: 403 }
      );
    }

    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    for (const field of allowedFields) {
      if (field in body) {
        if (field === "website" || field === "maps_url") {
          update[field] = normaliseUrl(body[field]);
        } else {
          update[field] = clean(body[field]);
        }
      }
    }

    const { data, error } = await supabase
      .from("businesses")
      .update(update)
      .eq("id", body.business_id)
      .select(
        "id,name,slug,phone,website,maps_url,address,postcode,area,description"
      )
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      business: data,
    });
  } catch (error) {
    console.error("business dashboard profile update error:", error);

    return NextResponse.json(
      { error: "Could not update business profile." },
      { status: 500 }
    );
  }
}

