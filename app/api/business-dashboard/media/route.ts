import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RequestBody = {
  business_id?: unknown;
  logo_url?: unknown;
  cover_image_url?: unknown;
  gallery_urls?: unknown;
};

type BusinessRecord = {
  id: string;
  name: string | null;
  slug: string | null;
  pricing_tier: string | null;
  subscription_type: string | null;
  featured: boolean | null;
  city_sponsor: boolean | null;
  mosque_sponsor: boolean | null;
  sponsorship_active: boolean | null;
};

const MAX_GALLERY_IMAGES = 24;
const MAX_URL_LENGTH = 2048;

const APPROVED_CLAIM_STATUSES = ["approved", "active", "verified"];

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function isUuid(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim()
  );
}

function cleanNullableString(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  return trimmed;
}

function isSafeMediaUrl(value: string) {
  if (value.length > MAX_URL_LENGTH) {
    return false;
  }

  if (value.startsWith("/")) {
    return true;
  }

  try {
    const url = new URL(value);

    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function cleanMediaUrl(value: unknown) {
  const cleaned = cleanNullableString(value);

  if (cleaned === null) {
    return null;
  }

  if (cleaned === undefined) {
    return undefined;
  }

  if (!isSafeMediaUrl(cleaned)) {
    return undefined;
  }

  return cleaned;
}

function cleanGalleryUrls(value: unknown) {
  if (value === null || value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    return undefined;
  }

  const cleaned = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .filter(isSafeMediaUrl);

  return Array.from(new Set(cleaned)).slice(0, MAX_GALLERY_IMAGES);
}

function getMediaLimitForBusiness(business: BusinessRecord) {
  if (business.city_sponsor || business.mosque_sponsor || business.sponsorship_active) {
    return 24;
  }

  if (business.featured || business.pricing_tier === "featured") {
    return 12;
  }

  return 3;
}

async function userCanManageBusiness(userId: string, businessId: string) {
  const { data: claim, error: claimError } = await supabaseAdmin
    .from("business_claims")
    .select("id,status")
    .eq("business_id", businessId)
    .eq("user_id", userId)
    .in("status", APPROVED_CLAIM_STATUSES)
    .maybeSingle();

  if (claimError) {
    console.error("business-dashboard media claim check error:", claimError.message);

    return {
      ok: false,
      allowed: false,
      error: "Could not verify business ownership.",
    };
  }

  if (claim) {
    return {
      ok: true,
      allowed: true,
      error: null,
    };
  }

  return {
    ok: true,
    allowed: false,
    error: null,
  };
}

export async function GET() {
  return jsonResponse({
    ok: true,
    route: "/api/business-dashboard/media",
    message:
      "Business dashboard media API is working. Use POST to update logo_url, cover_image_url, or gallery_urls.",
    accepted_fields: ["business_id", "logo_url", "cover_image_url", "gallery_urls"],
    limits: {
      max_gallery_images: MAX_GALLERY_IMAGES,
      max_url_length: MAX_URL_LENGTH,
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

    if (userError || !user) {
      return jsonResponse(
        {
          ok: false,
          error: "You must be logged in to update business media.",
        },
        401
      );
    }

    const body = (await req.json().catch(() => null)) as RequestBody | null;

    if (!body || typeof body !== "object") {
      return jsonResponse(
        {
          ok: false,
          error: "Invalid JSON body.",
        },
        400
      );
    }

    const rawBusinessId =
      typeof body.business_id === "string" ? body.business_id.trim() : "";

    if (!isUuid(rawBusinessId)) {
      return jsonResponse(
        {
          ok: false,
          error: "Missing or invalid business_id.",
        },
        400
      );
    }

    const businessId = rawBusinessId;

    const { data: business, error: businessError } = await supabaseAdmin
      .from("businesses")
      .select(
        "id,name,slug,pricing_tier,subscription_type,featured,city_sponsor,mosque_sponsor,sponsorship_active"
      )
      .eq("id", businessId)
      .maybeSingle<BusinessRecord>();

    if (businessError) {
      console.error("business-dashboard media business lookup error:", businessError.message);

      return jsonResponse(
        {
          ok: false,
          error: "Could not load business.",
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

    const permission = await userCanManageBusiness(user.id, businessId);

    if (!permission.ok) {
      return jsonResponse(
        {
          ok: false,
          error: permission.error,
        },
        500
      );
    }

    if (!permission.allowed) {
      return jsonResponse(
        {
          ok: false,
          error: "You do not have permission to update media for this business.",
        },
        403
      );
    }

    const updates: Record<string, unknown> = {};
    const warnings: string[] = [];

    if ("logo_url" in body) {
      const logoUrl = cleanMediaUrl(body.logo_url);

      if (logoUrl === undefined) {
        return jsonResponse(
          {
            ok: false,
            error: "Invalid logo_url. Use a valid http, https, or site-relative URL.",
          },
          400
        );
      }

      updates.logo_url = logoUrl;
    }

    if ("cover_image_url" in body) {
      const coverImageUrl = cleanMediaUrl(body.cover_image_url);

      if (coverImageUrl === undefined) {
        return jsonResponse(
          {
            ok: false,
            error:
              "Invalid cover_image_url. Use a valid http, https, or site-relative URL.",
          },
          400
        );
      }

      updates.cover_image_url = coverImageUrl;
    }

    if ("gallery_urls" in body) {
      const galleryUrls = cleanGalleryUrls(body.gallery_urls);

      if (galleryUrls === undefined) {
        return jsonResponse(
          {
            ok: false,
            error: "Invalid gallery_urls. It must be an array of valid URLs.",
          },
          400
        );
      }

      const planLimit = getMediaLimitForBusiness(business);

      if (galleryUrls.length > planLimit) {
        warnings.push(
          `Gallery limited to ${planLimit} image(s) for this business plan.`
        );
      }

      updates.gallery_urls = galleryUrls.slice(0, planLimit);
    }

    if (Object.keys(updates).length === 0) {
      return jsonResponse(
        {
          ok: false,
          error:
            "No media fields provided. Send logo_url, cover_image_url, or gallery_urls.",
        },
        400
      );
    }

    updates.updated_at = new Date().toISOString();

    const { data: updatedBusiness, error: updateError } = await supabaseAdmin
      .from("businesses")
      .update(updates)
      .eq("id", businessId)
      .select("id,name,slug,logo_url,cover_image_url,gallery_urls,updated_at")
      .single();

    if (updateError) {
      console.error("business-dashboard media update error:", updateError.message);

      return jsonResponse(
        {
          ok: false,
          error: "Could not update business media.",
        },
        500
      );
    }

    return jsonResponse({
      ok: true,
      message: "Business media updated successfully.",
      business: updatedBusiness,
      warnings,
    });
  } catch (error) {
    console.error("business-dashboard media route error:", error);

    return jsonResponse(
      {
        ok: false,
        error: "Could not update business media.",
      },
      500
    );
  }
}