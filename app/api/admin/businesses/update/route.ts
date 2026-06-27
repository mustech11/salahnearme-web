import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Patch = Record<string, unknown>;

const allowedFields = new Set([
  "name",
  "category",
  "address",
  "postcode",
  "city",
  "area",
  "country",
  "phone",
  "website",
  "maps_url",
  "description",

  "is_live",
  "is_verified",
  "is_claimed",
  "can_advertise",

  "featured",
  "featured_rank",

  "pricing_tier",
  "subscription_type",
  "paid_until",

  "sponsorship_active",
  "city_sponsor",
  "mosque_sponsor",
  "sponsor_mosque_id",
  "sponsor_city_id",

  "status",
  "review_status",
  "quality_status",
  "review_notes",
]);

const booleanFields = new Set([
  "is_live",
  "is_verified",
  "is_claimed",
  "can_advertise",
  "featured",
  "sponsorship_active",
  "city_sponsor",
  "mosque_sponsor",
]);

const numberFields = new Set(["featured_rank", "sponsor_city_id"]);

const dateFields = new Set(["paid_until"]);

function cleanString(value: unknown) {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();

  return trimmed.length ? trimmed : null;
}

function normaliseUrl(value: unknown) {
  const cleaned = cleanString(value);

  if (!cleaned) return null;

  if (
    cleaned.startsWith("http://") ||
    cleaned.startsWith("https://")
  ) {
    return cleaned;
  }

  return `https://${cleaned}`;
}

function normalisePatch(body: Patch) {
  const patch: Patch = {};

  for (const [key, value] of Object.entries(body)) {
    if (!allowedFields.has(key)) continue;

    if (booleanFields.has(key)) {
      patch[key] = Boolean(value);
      continue;
    }

    if (numberFields.has(key)) {
      const parsed = Number(value);
      patch[key] = Number.isFinite(parsed) ? parsed : null;
      continue;
    }

    if (dateFields.has(key)) {
      const dateValue = cleanString(value);

      if (!dateValue) {
        patch[key] = null;
        continue;
      }

      const parsedDate = new Date(dateValue);

      patch[key] = Number.isNaN(parsedDate.getTime())
        ? null
        : parsedDate.toISOString();

      continue;
    }

    if (key === "website" || key === "maps_url") {
      patch[key] = normaliseUrl(value);
      continue;
    }

    patch[key] = cleanString(value);
  }

  if (Object.keys(patch).length > 0) {
    patch.updated_at = new Date().toISOString();
  }

  return patch;
}

export async function POST(req: Request) {
  const admin = await requireAdmin(req);

  if (!admin.ok) {
    return NextResponse.json(
      { error: admin.error },
      { status: admin.status }
    );
  }

  const body = (await req.json().catch(() => null)) as Patch | null;

  if (!body) {
    return NextResponse.json(
      { error: "Missing request body." },
      { status: 400 }
    );
  }

  const id = cleanString(body.id);

  if (!id) {
    return NextResponse.json(
      { error: "Missing id." },
      { status: 400 }
    );
  }

  const patch = normalisePatch(body);

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "No valid update fields supplied." },
      { status: 400 }
    );
  }

  const { data, error } = await admin.supabaseService
    .from("businesses")
    .update(patch)
    .eq("id", id)
    .select("id,name,slug")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    business: data,
  });
}

