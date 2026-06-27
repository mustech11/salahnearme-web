import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_NAME_LENGTH = 180;
const MAX_TEXT_LENGTH = 2000;
const MAX_SHORT_TEXT_LENGTH = 300;
const MAX_URL_LENGTH = 700;

type Body = {
  name?: unknown;
  category?: unknown;
  country?: unknown;
  city?: unknown;
  area?: unknown;
  address?: unknown;
  postcode?: unknown;
  website?: unknown;
  phone?: unknown;
  email?: unknown;
  description?: unknown;
  advertising_interest?: unknown;
  advertising_type?: unknown;
  notes?: unknown;
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

function clean(value: unknown, maxLength = MAX_SHORT_TEXT_LENGTH) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function nullable(value: unknown, maxLength = MAX_SHORT_TEXT_LENGTH) {
  const cleaned = clean(value, maxLength);

  return cleaned.length > 0 ? cleaned : null;
}

function isValidEmail(value: string | null) {
  if (!value) {
    return true;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .normalize("NFKD")
    .replace(/&/g, " and ")
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
}

function normaliseUrl(value: unknown) {
  const raw = clean(value, MAX_URL_LENGTH);

  if (!raw) {
    return null;
  }

  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return raw;
  }

  return `https://${raw}`;
}

function normalisePostcode(value: unknown) {
  const postcode = clean(value, 40);

  return postcode ? postcode.toUpperCase() : null;
}

function normalisePhone(value: unknown) {
  const phone = clean(value, 50);

  if (!phone) {
    return null;
  }

  return phone.replace(/[^\d+()\-\s]/g, "").slice(0, 50);
}

function normaliseForSearch(value: string | null) {
  return (value ?? "")
    .toLowerCase()
    .trim()
    .replace(/[āáàäâ]/g, "a")
    .replace(/[ēéèëê]/g, "e")
    .replace(/[īíìïî]/g, "i")
    .replace(/[ōóòöô]/g, "o")
    .replace(/[ūúùüû]/g, "u")
    .replace(/[^a-z0-9]/g, "");
}

async function createUniqueBusinessSlug(name: string, city: string | null) {
  const base =
    slugify([name, city].filter(Boolean).join(" ")) ||
    `business-${Date.now()}`;

  let slug = base;
  let counter = 2;

  while (counter < 100) {
    const { data, error } = await supabaseAdmin
      .from("businesses")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      return slug;
    }

    slug = `${base}-${counter}`;
    counter += 1;
  }

  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

async function findPossibleDuplicate(args: {
  name: string;
  city: string | null;
  postcode: string | null;
  phone: string | null;
  website: string | null;
}) {
  const normalizedName = normaliseForSearch(args.name);

  if (!normalizedName) {
    return null;
  }

  let query = supabaseAdmin
    .from("businesses")
    .select("id, name, slug, city, postcode, phone, website")
    .limit(20);

  if (args.city) {
    query = query.eq("city", args.city);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  for (const business of data ?? []) {
    const existingName = normaliseForSearch(business.name);

    const nameLooksSame =
      existingName === normalizedName ||
      existingName.includes(normalizedName) ||
      normalizedName.includes(existingName);

    const postcodeMatches =
      args.postcode &&
      business.postcode &&
      String(business.postcode).toUpperCase() === args.postcode;

    const phoneMatches =
      args.phone &&
      business.phone &&
      String(business.phone).replace(/\D/g, "") ===
        args.phone.replace(/\D/g, "");

    const websiteMatches =
      args.website &&
      business.website &&
      String(business.website).replace(/^https?:\/\//, "").replace(/\/$/, "") ===
        args.website.replace(/^https?:\/\//, "").replace(/\/$/, "");

    if (nameLooksSame && (postcodeMatches || phoneMatches || websiteMatches)) {
      return business;
    }
  }

  return null;
}

export async function GET() {
  return jsonResponse({
    ok: true,
    route: "/api/add-business",
    method: "POST",
    body: {
      name: "required",
      category: "optional",
      country: "optional",
      city: "optional",
      area: "optional",
      address: "optional",
      postcode: "optional",
      website: "optional",
      phone: "optional",
      email: "optional",
      description: "optional",
      advertising_interest: "optional boolean",
      advertising_type: "optional",
      notes: "optional",
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

    const name = clean(body.name, MAX_NAME_LENGTH);

    if (!name || name.length < 2) {
      return jsonResponse(
        {
          ok: false,
          error: "Business name is required.",
        },
        400
      );
    }

    const category = nullable(body.category, 120);
    const country = nullable(body.country, 120);
    const city = nullable(body.city, 120);
    const area = nullable(body.area, 120);
    const address = nullable(body.address, 300);
    const postcode = normalisePostcode(body.postcode);
    const website = normaliseUrl(body.website);
    const phone = normalisePhone(body.phone);
    const email = nullable(body.email, 180);
    const description = nullable(body.description, MAX_TEXT_LENGTH);
    const advertisingType = nullable(body.advertising_type, 120);
    const notes = nullable(body.notes, MAX_TEXT_LENGTH);

    if (!isValidEmail(email)) {
      return jsonResponse(
        {
          ok: false,
          error: "Invalid business email.",
        },
        400
      );
    }

    const possibleDuplicate = await findPossibleDuplicate({
      name,
      city,
      postcode,
      phone,
      website,
    });

    if (possibleDuplicate) {
      return jsonResponse(
        {
          ok: false,
          error:
            "A similar business already appears to exist. Please contact admin if this is your business.",
          duplicate_hint: {
            id: possibleDuplicate.id,
            name: possibleDuplicate.name,
            slug: possibleDuplicate.slug,
          },
        },
        409
      );
    }

    const slug = await createUniqueBusinessSlug(name, city);

    const { data, error } = await supabaseAdmin
      .from("businesses")
      .insert({
        name,
        slug,

        category,
        country,
        city,
        area,
        address,
        postcode,
        website,
        phone,
        email,
        description,

        advertising_interest: Boolean(body.advertising_interest),
        advertising_type: advertisingType,
        notes,

        submitted_by_email: user.email,
        submitted_by_user_id: user.id,

        status: "pending",
        review_status: "pending",
        quality_status: "user_submitted",
        is_active: true,
        is_live: false,

        can_advertise: false,
        featured: false,
        featured_rank: null,
        pricing_tier: "free",
        subscription_type: "free",
        paid_until: null,
        sponsorship_active: false,
        city_sponsor: false,
        mosque_sponsor: false,
        sponsor_mosque_id: null,
        sponsor_city_id: null,

        is_verified: false,
        is_claimed: false,

        metadata: {
          submitted_from: "add_business_route",
          user_agent: req.headers.get("user-agent"),
          ip_hint:
            req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
            req.headers.get("x-real-ip") ??
            null,
        },
      })
      .select("id, slug, name, status, review_status, created_at")
      .single();

    if (error) {
      console.error("add-business insert error:", error);

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
        business_id: data.id,
        slug: data.slug,
        business: data,
        message: "Business submitted for review.",
      },
      201
    );
  } catch (error) {
    console.error("add-business route error:", error);

    return jsonResponse(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not submit business.",
      },
      500
    );
  }
}