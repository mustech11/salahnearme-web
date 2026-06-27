import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  business_id?: string;
  logo_url?: string | null;
  cover_image_url?: string | null;
  gallery_urls?: string[];
};

function cleanString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function cleanStringOrNull(value: unknown) {
  if (value === null) {
    return null;
  }

  return cleanString(value);
}

function cleanGallery(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "/api/business-dashboard/media",
    message: "Business dashboard media API is working. Use POST.",
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as Body | null;

    if (!body) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid JSON body.",
        },
        {
          status: 400,
        }
      );
    }

    const businessId = cleanString(body.business_id);

    if (!businessId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing business_id.",
        },
        {
          status: 400,
        }
      );
    }

    const updates: Record<string, unknown> = {};

    if ("logo_url" in body) {
      updates.logo_url = cleanStringOrNull(body.logo_url);
    }

    if ("cover_image_url" in body) {
      updates.cover_image_url = cleanStringOrNull(body.cover_image_url);
    }

    if ("gallery_urls" in body) {
      updates.gallery_urls = cleanGallery(body.gallery_urls) ?? [];
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "No media fields provided.",
        },
        {
          status: 400,
        }
      );
    }

    const { error } = await supabaseAdmin
      .from("businesses")
      .update(updates)
      .eq("id", businessId);

    if (error) {
      console.error("business-dashboard media Supabase error:", error);

      return NextResponse.json(
        {
          ok: false,
          error: error.message,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      ok: true,
      updates,
    });
  } catch (error) {
    console.error("business-dashboard media route error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Could not update business media.",
      },
      {
        status: 500,
      }
    );
  }
}

