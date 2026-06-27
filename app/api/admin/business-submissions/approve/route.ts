import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type ApproveBody = {
  submission_id: string;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function uniqueBusinessSlug(name: string) {
  const fallback = `business-${Date.now()}`;
  const baseSlug = slugify(name) || fallback;

  let slug = baseSlug;
  let counter = 2;

  while (true) {
    const { data, error } = await supabaseAdmin
      .from("businesses")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return slug;

    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as ApproveBody | null;
    const submissionId = clean(body?.submission_id);

    if (!submissionId) {
      return NextResponse.json(
        { error: "Missing submission_id" },
        { status: 400 }
      );
    }

    const { data: submission, error: submissionError } = await supabaseAdmin
      .from("business_submissions")
      .select("*")
      .eq("id", submissionId)
      .maybeSingle();

    if (submissionError) {
      return NextResponse.json(
        { error: submissionError.message },
        { status: 500 }
      );
    }

    if (!submission) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 }
      );
    }

    if (submission.status === "approved") {
      return NextResponse.json({
        ok: true,
        message: "Submission already approved",
      });
    }

    const name = clean(submission.name);

    if (!name) {
      return NextResponse.json(
        { error: "Submission has no business name." },
        { status: 400 }
      );
    }

    const slug = await uniqueBusinessSlug(name);

    const insertPayload = {
      name,
      slug,
      category: clean(submission.category) || null,
      country: clean(submission.country) || null,
      city: clean(submission.city) || null,
      area: clean(submission.area) || null,
      address: clean(submission.address) || null,
      postcode: clean(submission.postcode) || null,
      website: clean(submission.website) || null,
      phone: clean(submission.phone) || null,
      email: clean(submission.email) || null,
      description: clean(submission.description) || null,

      status: "approved",
      review_status: "approved",
      quality_status: "manual_approved",
      is_live: true,

      is_claimed: false,
      can_advertise: true,
      featured: false,
      featured_rank: null,
      pricing_tier: "free",
      subscription_type: "free",
      is_verified: false,
      paid_until: null,
      sponsor_mosque_id: null,
      maps_url: clean(submission.maps_url) || null,

      submitted_by_email: clean(submission.email) || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: "admin",
    };

    const { data: insertedBusiness, error: insertError } = await supabaseAdmin
      .from("businesses")
      .insert(insertPayload)
      .select("id,slug")
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    const { error: updateError } = await supabaseAdmin
      .from("business_submissions")
      .update({
        status: "approved",
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", submissionId);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      business_id: insertedBusiness.id,
      slug: insertedBusiness.slug,
    });
  } catch (error) {
    console.error("approve business submission route error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not approve business submission",
      },
      { status: 500 }
    );
  }
}

