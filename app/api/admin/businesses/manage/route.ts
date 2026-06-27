import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  business_id?: string;
  business_ids?: string[];
  patch?: Record<string, unknown>;
  bulk?: boolean;
  reorder_featured?: boolean;
  ordered_ids?: string[];
};

const allowedFields = new Set([
  "is_live",
  "featured",
  "featured_rank",
  "paid_until",
  "pricing_tier",
  "subscription_type",
  "sponsorship_active",
  "city_sponsor",
  "mosque_sponsor",
  "sponsor_mosque_id",
  "website",
  "phone",
  "maps_url",
  "is_verified",
]);

function cleanString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizePatch(input: Record<string, unknown>) {
  const patch: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (!allowedFields.has(key)) continue;

    if (
      [
        "is_live",
        "featured",
        "sponsorship_active",
        "city_sponsor",
        "mosque_sponsor",
        "is_verified",
      ].includes(key)
    ) {
      patch[key] = Boolean(value);
      continue;
    }

    if (key === "featured_rank") {
      const numberValue = Number(value);
      patch[key] = Number.isFinite(numberValue) ? numberValue : null;
      continue;
    }

    if (key === "paid_until") {
      const dateValue = cleanString(value);
      patch[key] = dateValue ? new Date(dateValue).toISOString() : null;
      continue;
    }

    patch[key] = cleanString(value);
  }

  patch.updated_at = new Date().toISOString();

  return patch;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as Body | null;

    if (!body) {
      return NextResponse.json({ error: "Missing body." }, { status: 400 });
    }

    if (body.reorder_featured) {
      const orderedIds = Array.isArray(body.ordered_ids)
        ? body.ordered_ids.filter(Boolean)
        : [];

      if (!orderedIds.length) {
        return NextResponse.json(
          { error: "Missing ordered_ids." },
          { status: 400 }
        );
      }

      for (let i = 0; i < orderedIds.length; i += 1) {
        const { error } = await supabaseAdmin
          .from("businesses")
          .update({
            featured_rank: i + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", orderedIds[i]);

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
      }

      return NextResponse.json({
        ok: true,
        updated: orderedIds.length,
      });
    }

    const patch = normalizePatch(body.patch ?? {});

    if (Object.keys(patch).length <= 1) {
      return NextResponse.json(
        { error: "No allowed update fields supplied." },
        { status: 400 }
      );
    }

    if (body.bulk) {
      const ids = Array.isArray(body.business_ids)
        ? body.business_ids.filter(Boolean)
        : [];

      if (!ids.length) {
        return NextResponse.json(
          { error: "Missing business_ids." },
          { status: 400 }
        );
      }

      const { error } = await supabaseAdmin
        .from("businesses")
        .update(patch)
        .in("id", ids);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        ok: true,
        updated: ids.length,
      });
    }

    const businessId = cleanString(body.business_id);

    if (!businessId) {
      return NextResponse.json(
        { error: "Missing business_id." },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("businesses")
      .update(patch)
      .eq("id", businessId)
      .select("id,name")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      business: data,
    });
  } catch (error) {
    console.error("admin business manage route error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not update business.",
      },
      { status: 500 }
    );
  }
}

