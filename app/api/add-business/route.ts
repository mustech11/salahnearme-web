import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_NAME_LENGTH = 180;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_NOTES_LENGTH = 2000;
const MAX_SHORT_TEXT_LENGTH = 300;
const MAX_URL_LENGTH = 700;

const MIN_NAME_LENGTH = 2;
const MIN_CITY_LENGTH = 2;

const ALLOWED_ADVERTISING_TYPES = new Set([
  "",
  "city_featured",
  "mosque_sponsor",
  "multi_mosque",
  "multi_city",
]);

const COMMON_ALLOWED_CATEGORIES = new Set([
  "halal restaurant",
  "restaurant",
  "halal takeaway",
  "takeaway",
  "halal butcher",
  "butcher",
  "halal grocery",
  "grocery",
  "islamic bookstore",
  "bookstore",
  "muslim clothing",
  "clothing",
  "travel agent",
  "umrah travel",
  "hajj travel",
  "clinic",
  "dental clinic",
  "tuition centre",
  "charity",
  "community service",
  "mosque service",
  "other",
]);

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

type DuplicateCandidate = {
  id: string;
  name: string | null;
  slug: string | null;
  city: string | null;
  postcode: string | null;
  phone: string | null;
  website: string | null;
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

  return value
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function nullable(value: unknown, maxLength = MAX_SHORT_TEXT_LENGTH) {
  const cleaned = clean(value, maxLength);
  return cleaned.length > 0 ? cleaned : null;
}

function cleanBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return ["true", "1", "yes", "on"].includes(value.toLowerCase().trim());
  }

  return false;
}

function isValidEmail(value: string | null) {
  if (!value) {
    return true;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isProbablySpamText(value: string | null) {
  if (!value) {
    return false;
  }

  const lower = value.toLowerCase();

  const suspiciousTerms = [
    "casino",
    "viagra",
    "crypto investment",
    "forex signals",
    "adult dating",
    "loan guaranteed",
  ];

  const urlMatches = lower.match(/https?:\/\//g) ?? [];

  return (
    urlMatches.length > 3 ||
    suspiciousTerms.some((term) => lower.includes(term))
  );
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
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

  const withProtocol =
    raw.startsWith("http://") || raw.startsWith("https://")
      ? raw
      : `https://${raw}`;

  try {
    const url = new URL(withProtocol);

    if (!["http:", "https:"].includes(url.protocol)) {
      return null;
    }

    url.hash = "";

    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function normalisePostcode(value: unknown) {
  const postcode = clean(value, 40)
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return postcode || null;
}

function normalisePhone(value: unknown) {
  const phone = clean(value, 60);

  if (!phone) {
    return null;
  }

  const cleaned = phone.replace(/[^\d+()\-\s]/g, "").slice(0, 50).trim();

  return cleaned || null;
}

function normaliseCountry(value: unknown) {
  const country = nullable(value, 120);

  if (!country) {
    return "United Kingdom";
  }

  const lower = country.toLowerCase();

  if (["uk", "u.k.", "gb", "great britain", "england"].includes(lower)) {
    return "United Kingdom";
  }

  return country;
}

function normaliseCity(value: unknown) {
  const city = nullable(value, 120);

  if (!city) {
    return null;
  }

  return city
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function normaliseCategory(value: unknown) {
  const category = nullable(value, 120);

  if (!category) {
    return "Other";
  }

  return category;
}

function normaliseForSearch(value: string | null) {
  return (value ?? "")
    .toLowerCase()
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");
}

function normaliseWebsiteForCompare(value: string | null) {
  if (!value) {
    return "";
  }

  return value
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "")
    .trim();
}

function getClientIp(req: Request) {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null
  );
}

async function findCityId(city: string | null, country: string | null) {
  if (!city) {
    return null;
  }

  const slug = slugify(city);

  let query = supabaseAdmin
    .from("cities")
    .select("id, name, slug, country")
    .eq("slug", slug)
    .maybeSingle();

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  if (data?.id) {
    return data.id;
  }

  const fallback = await supabaseAdmin
    .from("cities")
    .select("id, name, slug, country")
    .ilike("name", city)
    .limit(1)
    .maybeSingle();

  if (fallback.error) {
    throw new Error(fallback.error.message);
  }

  if (fallback.data?.id) {
    return fallback.data.id;
  }

  if ((country ?? "").toLowerCase() === "united kingdom") {
    const inserted = await supabaseAdmin
      .from("cities")
      .insert({
        name: city,
        slug,
        country: "United Kingdom",
        country_code: "GB",
        is_active: true,
      })
      .select("id")
      .single();

    if (inserted.error) {
      throw new Error(inserted.error.message);
    }

    return inserted.data.id;
  }

  return null;
}

async function createUniqueBusinessSlug(name: string, city: string | null) {
  const base =
    slugify([name, city].filter(Boolean).join(" ")) ||
    `business-${Date.now()}`;

  let slug = base;
  let counter = 2;

  while (counter <= 100) {
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
    .limit(40);

  if (args.city) {
    query = query.ilike("city", args.city);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const incomingWebsite = normaliseWebsiteForCompare(args.website);
  const incomingPhone = args.phone?.replace(/\D/g, "") ?? "";

  for (const business of (data ?? []) as DuplicateCandidate[]) {
    const existingName = normaliseForSearch(business.name);

    const nameLooksSame =
      existingName === normalizedName ||
      existingName.includes(normalizedName) ||
      normalizedName.includes(existingName);

    const postcodeMatches =
      Boolean(args.postcode) &&
      Boolean(business.postcode) &&
      String(business.postcode).toUpperCase() === args.postcode;

    const phoneMatches =
      Boolean(incomingPhone) &&
      Boolean(business.phone) &&
      String(business.phone).replace(/\D/g, "") === incomingPhone;

    const websiteMatches =
      Boolean(incomingWebsite) &&
      Boolean(business.website) &&
      normaliseWebsiteForCompare(String(business.website)) === incomingWebsite;

    if (nameLooksSame && (postcodeMatches || phoneMatches || websiteMatches)) {
      return business;
    }
  }

  return null;
}

async function hasRecentSubmission(args: {
  userId: string;
  email: string;
  ip: string | null;
}) {
  const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from("businesses")
    .select("id")
    .or(`submitted_by_user_id.eq.${args.userId},submitted_by_email.eq.${args.email}`)
    .gte("created_at", since)
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data?.length);
}

export async function GET() {
  return jsonResponse({
    ok: true,
    route: "/api/add-business",
    method: "POST",
    authentication: "required",
    body: {
      name: "required",
      category: "optional",
      country: "optional; defaults to United Kingdom",
      city: "recommended",
      area: "optional",
      address: "optional",
      postcode: "optional",
      website: "optional",
      phone: "optional",
      email: "optional",
      description: "optional",
      advertising_interest: "optional boolean",
      advertising_type:
        "optional: city_featured | mosque_sponsor | multi_mosque | multi_city",
      notes: "optional",
      website_honeypot: "anti-spam; leave empty",
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

    if (userError || !user?.id || !user.email) {
      return jsonResponse(
        {
          ok: false,
          error: "Please sign in before submitting a business.",
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

    const clientIp = getClientIp(req);

    const recentSubmission = await hasRecentSubmission({
      userId: user.id,
      email: user.email,
      ip: clientIp,
    });

    if (recentSubmission) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Please wait a few minutes before submitting another business.",
        },
        429
      );
    }

    const name = clean(body.name, MAX_NAME_LENGTH);

    if (name.length < MIN_NAME_LENGTH) {
      return jsonResponse(
        {
          ok: false,
          error: "Business name is required.",
        },
        400
      );
    }

    const category = normaliseCategory(body.category);
    const categoryForCheck = category.toLowerCase();

    const country = normaliseCountry(body.country);
    const city = normaliseCity(body.city);
    const area = nullable(body.area, 120);
    const address = nullable(body.address, 300);
    const postcode = normalisePostcode(body.postcode);
    const website = normaliseUrl(body.website);
    const phone = normalisePhone(body.phone);
    const email = nullable(body.email, 180);
    const description = nullable(body.description, MAX_DESCRIPTION_LENGTH);
    const notes = nullable(body.notes, MAX_NOTES_LENGTH);

    const advertisingInterest = cleanBoolean(body.advertising_interest);
    const advertisingType = nullable(body.advertising_type, 120) ?? "";

    if (city && city.length < MIN_CITY_LENGTH) {
      return jsonResponse(
        {
          ok: false,
          error: "City name is too short.",
        },
        400
      );
    }

    if (!isValidEmail(email)) {
      return jsonResponse(
        {
          ok: false,
          error: "Invalid business email.",
        },
        400
      );
    }

    if (!ALLOWED_ADVERTISING_TYPES.has(advertisingType)) {
      return jsonResponse(
        {
          ok: false,
          error: "Invalid advertising type.",
        },
        400
      );
    }

    if (isProbablySpamText(description) || isProbablySpamText(notes)) {
      return jsonResponse(
        {
          ok: false,
          error: "Submission rejected.",
        },
        400
      );
    }

    const isCommonCategory = COMMON_ALLOWED_CATEGORIES.has(categoryForCheck);

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

    const cityId = await findCityId(city, country);
    const slug = await createUniqueBusinessSlug(name, city);

    const { data, error } = await supabaseAdmin
      .from("businesses")
      .insert({
        name,
        slug,

        category,
        country,
        city,
        city_id: cityId,
        area,
        address,
        postcode,
        website,
        phone,
        email,
        description,

        advertising_interest: advertisingInterest,
        advertising_type: advertisingType || null,
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
          submitted_at: new Date().toISOString(),
          user_agent: req.headers.get("user-agent"),
          ip_hint: clientIp,
          category_recognised: isCommonCategory,
          city_auto_matched: Boolean(cityId),
          needs_admin_review: true,
        },
      })
      .select("id, slug, name, status, review_status, created_at")
      .single();

    if (error) {
      console.error("add-business insert error:", error);

      return jsonResponse(
        {
          ok: false,
          error: "Could not submit business. Please try again.",
          detail:
            process.env.NODE_ENV === "development" ? error.message : undefined,
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
        message:
          "Business submitted for review. It will not appear publicly until approved.",
      },
      201
    );
  } catch (error) {
    console.error("add-business route error:", error);

    return jsonResponse(
      {
        ok: false,
        error:
          process.env.NODE_ENV === "development" && error instanceof Error
            ? error.message
            : "Could not submit business.",
      },
      500
    );
  }
}