import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  business_id?: string;
  logo_url?: string | null;
  cover_image_url?: string | null;
  gallery_urls?: string[] | null;
};

function clean(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as Body | null;

    const businessId = clean(body?.business_id);

    if (!businessId) {
      return NextResponse.json(
        { ok: false, error: "Missing business_id" },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = {};

    if (typeof body?.logo_url === "string") {
      updates.logo_url = body.logo_url;
    }

    if (typeof body?.cover_image_url === "string") {
      updates.cover_image_url = body.cover_image_url;
    }

    if (Array.isArray(body?.gallery_urls)) {
      updates.gallery_urls = body.gallery_urls;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { ok: false, error: "No image fields supplied" },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("businesses")
      .update(updates)
      .eq("id", businessId);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("update-images error:", error);

    return NextResponse.json(
      { ok: false, error: "Could not update business images" },
      { status: 500 }
    );
  }
}

