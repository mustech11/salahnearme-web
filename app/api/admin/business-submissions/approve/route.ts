import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/requireAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type ApproveBody = {
  submission_id?: unknown;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_REQUEST_BODY_BYTES = 8_000;
const MAX_SLUG_ATTEMPTS = 200;

function jsonResponse(
  body: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control":
        "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function cleanString(
  value: unknown,
  maxLength = 2_000
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, maxLength);

  return cleaned || null;
}

function isUuid(
  value: string | null
): value is string {
  return Boolean(value && UUID_REGEX.test(value));
}

function isPlainObject(
  value: unknown
): value is Record<string, unknown> {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value)
  );
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

async function uniqueBusinessSlug(
  service: any,
  name: string
): Promise<string> {
  const baseSlug =
    slugify(name) ||
    `business-${Date.now()}`;

  for (
    let attempt = 1;
    attempt <= MAX_SLUG_ATTEMPTS;
    attempt += 1
  ) {
    const slug =
      attempt === 1
        ? baseSlug
        : `${baseSlug}-${attempt}`;

    const { data, error } =
      await service
        .from("businesses")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();

    if (error) {
      throw new Error(
        "Could not validate the business slug."
      );
    }

    if (!data) {
      return slug;
    }
  }

  return `${baseSlug}-${Date.now()}`;
}

export async function POST(
  request: Request
) {
  const admin =
    await requireAdmin(request);

  if (!admin.ok) {
    return jsonResponse(
      {
        ok: false,
        error: admin.error,
      },
      admin.status
    );
  }

  try {
    const contentType =
      request.headers
        .get("content-type")
        ?.toLowerCase() ?? "";

    if (
      !contentType.includes(
        "application/json"
      )
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Content-Type must be application/json.",
        },
        415
      );
    }

    const contentLength = Number(
      request.headers.get(
        "content-length"
      )
    );

    if (
      Number.isFinite(contentLength) &&
      contentLength >
        MAX_REQUEST_BODY_BYTES
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Request body is too large.",
        },
        413
      );
    }

    const parsed: unknown =
      await request
        .json()
        .catch(() => null);

    if (!isPlainObject(parsed)) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Invalid JSON body.",
        },
        400
      );
    }

    const body =
      parsed as ApproveBody;

    const submissionId =
      cleanString(
        body.submission_id,
        80
      );

    if (!isUuid(submissionId)) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Missing or invalid submission_id.",
        },
        400
      );
    }

    const {
      data: submission,
      error: submissionError,
    } = await admin.supabaseService
      .from(
        "business_submissions"
      )
      .select("*")
      .eq("id", submissionId)
      .maybeSingle();

    if (submissionError) {
      console.error(
        "Business submission lookup failed:",
        {
          submissionId,
          code:
            submissionError.code,
          message:
            submissionError.message,
        }
      );

      return jsonResponse(
        {
          ok: false,
          error:
            "Could not load the business submission.",
        },
        500
      );
    }

    if (!submission) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Business submission not found.",
        },
        404
      );
    }

    if (
      submission.status ===
      "approved"
    ) {
      return jsonResponse({
        ok: true,
        already_approved: true,
        message:
          "Submission already approved.",
        business_id:
          submission.business_id ??
          null,
      });
    }

    if (
      submission.status &&
      submission.status !==
        "pending"
    ) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Only pending submissions can be approved.",
          current_status:
            submission.status,
        },
        409
      );
    }

    const name =
      cleanString(
        submission.name,
        180
      );

    if (!name) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Submission has no business name.",
        },
        422
      );
    }

    const slug =
      await uniqueBusinessSlug(
        admin.supabaseService,
        name
      );

    const now =
      new Date().toISOString();

    const insertPayload = {
      name,
      slug,
      category:
        cleanString(
          submission.category,
          120
        ),
      country:
        cleanString(
          submission.country,
          120
        ),
      city:
        cleanString(
          submission.city,
          120
        ),
      area:
        cleanString(
          submission.area,
          120
        ),
      address:
        cleanString(
          submission.address,
          500
        ),
      postcode:
        cleanString(
          submission.postcode,
          40
        ),
      website:
        cleanString(
          submission.website,
          2_048
        ),
      phone:
        cleanString(
          submission.phone,
          80
        ),
      email:
        cleanString(
          submission.email,
          180
        ),
      description:
        cleanString(
          submission.description,
          4_000
        ),
      maps_url:
        cleanString(
          submission.maps_url,
          2_048
        ),
      status: "approved",
      review_status:
        "approved",
      quality_status:
        "manual_approved",
      is_live: true,
      is_claimed: false,
      can_advertise: true,
      featured: false,
      featured_rank: null,
      pricing_tier: "free",
      subscription_type:
        "free",
      is_verified: false,
      paid_until: null,
      sponsor_mosque_id:
        null,
      submitted_by_email:
        cleanString(
          submission.email,
          180
        ),
      reviewed_at: now,
      reviewed_by: "admin",
      updated_at: now,
    };

    const {
      data: insertedBusiness,
      error: insertError,
    } = await admin.supabaseService
      .from("businesses")
      .insert(insertPayload)
      .select("id,slug,name")
      .single();

    if (insertError) {
      console.error(
        "Business submission insert failed:",
        {
          submissionId,
          code:
            insertError.code,
          message:
            insertError.message,
        }
      );

      return jsonResponse(
        {
          ok: false,
          error:
            insertError.code ===
            "23505"
              ? "A matching business already exists."
              : "Could not create the approved business.",
        },
        insertError.code ===
        "23505"
          ? 409
          : 500
      );
    }

    const {
      data: updatedSubmission,
      error: updateError,
    } = await admin.supabaseService
      .from(
        "business_submissions"
      )
      .update({
        status: "approved",
        reviewed_at: now,
        business_id:
          insertedBusiness.id,
      })
      .eq("id", submissionId)
      .eq("status", "pending")
      .select(
        "id,status,business_id,reviewed_at"
      )
      .maybeSingle();

    if (updateError) {
      console.error(
        "Business submission status update failed:",
        {
          submissionId,
          businessId:
            insertedBusiness.id,
          code:
            updateError.code,
          message:
            updateError.message,
        }
      );

      return jsonResponse(
        {
          ok: false,
          error:
            "The business was created, but the submission status could not be updated.",
          business_created:
            true,
          business_id:
            insertedBusiness.id,
          slug:
            insertedBusiness.slug,
        },
        500
      );
    }

    if (!updatedSubmission) {
      return jsonResponse(
        {
          ok: false,
          error:
            "The business was created, but the submission changed during approval.",
          business_created:
            true,
          business_id:
            insertedBusiness.id,
          slug:
            insertedBusiness.slug,
        },
        409
      );
    }

    return jsonResponse(
      {
        ok: true,
        message:
          "Business submission approved successfully.",
        submission:
          updatedSubmission,
        business:
          insertedBusiness,
        business_id:
          insertedBusiness.id,
        slug:
          insertedBusiness.slug,
      },
      201
    );
  } catch (error) {
    console.error(
      "Business submission approval route failed:",
      error
    );

    return jsonResponse(
      {
        ok: false,
        error:
          "Could not approve business submission.",
      },
      500
    );
  }
}