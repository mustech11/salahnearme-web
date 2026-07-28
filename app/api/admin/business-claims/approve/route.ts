import { NextResponse } from "next/server";

import { EMAIL_FROM, resend } from "@/lib/email";
import { businessClaimApprovedEmail } from "@/lib/emailTemplates";
import { requireAdmin } from "@/lib/requireAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Body = { claim_id?: unknown };

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_REQUEST_BODY_BYTES = 8_000;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function cleanString(value: unknown, maxLength = 320): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/\u0000/g, "").trim().slice(0, maxLength);
  return cleaned || null;
}

function cleanEmail(value: unknown): string | null {
  return cleanString(value, 320)?.toLowerCase() ?? null;
}

function isUuid(value: string | null): value is string {
  return Boolean(value && UUID_REGEX.test(value));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export async function POST(request: Request) {
  const admin = await requireAdmin(request);

  if (!admin.ok) {
    return jsonResponse({ ok: false, error: admin.error }, admin.status);
  }

  try {
    const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";

    if (!contentType.includes("application/json")) {
      return jsonResponse(
        { ok: false, error: "Content-Type must be application/json." },
        415
      );
    }

    const contentLength = Number(request.headers.get("content-length"));

    if (
      Number.isFinite(contentLength) &&
      contentLength > MAX_REQUEST_BODY_BYTES
    ) {
      return jsonResponse({ ok: false, error: "Request body is too large." }, 413);
    }

    const parsed: unknown = await request.json().catch(() => null);

    if (!isPlainObject(parsed)) {
      return jsonResponse({ ok: false, error: "Invalid JSON body." }, 400);
    }

    const body = parsed as Body;
    const claimId = cleanString(body.claim_id, 80);

    if (!isUuid(claimId)) {
      return jsonResponse({ ok: false, error: "Missing or invalid claim_id." }, 400);
    }

    const { data: claim, error: claimError } = await admin.supabaseService
      .from("business_claim_requests")
      .select("id,business_id,business_name,email,status")
      .eq("id", claimId)
      .maybeSingle();

    if (claimError) {
      console.error("Business claim lookup failed:", {
        claimId,
        code: claimError.code,
        message: claimError.message,
      });

      return jsonResponse({ ok: false, error: "Could not load the business claim." }, 500);
    }

    if (!claim) {
      return jsonResponse({ ok: false, error: "Claim not found." }, 404);
    }

    if (claim.status === "approved") {
      return jsonResponse({
        ok: true,
        already_approved: true,
        message: "Claim already approved.",
        claim_id: claimId,
        business_id: claim.business_id ?? null,
      });
    }

    if (claim.status && claim.status !== "pending") {
      return jsonResponse(
        {
          ok: false,
          error: "Only pending claims can be approved.",
          current_status: claim.status,
        },
        409
      );
    }

    const businessId = cleanString(claim.business_id, 80);
    const claimantEmail = cleanEmail(claim.email);

    if (!isUuid(businessId)) {
      return jsonResponse({ ok: false, error: "Claim has no valid business_id." }, 422);
    }

    if (!claimantEmail) {
      return jsonResponse({ ok: false, error: "Claim has no valid email address." }, 422);
    }

    const { data: business, error: businessError } = await admin.supabaseService
      .from("businesses")
      .select("id,name,email")
      .eq("id", businessId)
      .maybeSingle();

    if (businessError) {
      console.error("Claimed business lookup failed:", {
        businessId,
        code: businessError.code,
        message: businessError.message,
      });

      return jsonResponse({ ok: false, error: "Could not load the claimed business." }, 500);
    }

    if (!business) {
      return jsonResponse({ ok: false, error: "Business not found." }, 404);
    }

    const now = new Date().toISOString();

    const { data: updatedBusiness, error: updateBusinessError } =
      await admin.supabaseService
        .from("businesses")
        .update({
          is_claimed: true,
          claimed_by_email: claimantEmail,
          is_verified: true,
          can_advertise: true,
          status: "approved",
          review_status: "approved",
          is_live: true,
          quality_status: "manual_verified",
          reviewed_at: now,
          reviewed_by: "admin",
          updated_at: now,
        })
        .eq("id", businessId)
        .select("id,name")
        .maybeSingle();

    if (updateBusinessError) {
      console.error("Business claim approval update failed:", {
        claimId,
        businessId,
        code: updateBusinessError.code,
        message: updateBusinessError.message,
      });

      return jsonResponse({ ok: false, error: "Could not approve the claimed business." }, 500);
    }

    if (!updatedBusiness) {
      return jsonResponse({ ok: false, error: "Business not found during approval." }, 404);
    }

    let authUserId: string | null = null;

    for (let page = 1; page <= 10 && !authUserId; page += 1) {
      const { data: authUsers, error: authError } =
        await admin.supabaseService.auth.admin.listUsers({ page, perPage: 1000 });

      if (authError) {
        console.error("Business claim auth lookup failed:", authError);
        break;
      }

      const match = authUsers.users.find(
        (user) => cleanEmail(user.email) === claimantEmail
      );

      authUserId = match?.id ?? null;

      if (authUsers.users.length < 1000) break;
    }

    let ownerLinkCreated = false;

    if (authUserId) {
      const { error: linkError } = await admin.supabaseService
        .from("business_users")
        .upsert(
          {
            business_id: businessId,
            user_id: authUserId,
            role: "owner",
          },
          { onConflict: "business_id,user_id" }
        );

      if (linkError) {
        console.error("Business owner-link upsert failed:", {
          claimId,
          businessId,
          authUserId,
          code: linkError.code,
          message: linkError.message,
        });
      } else {
        ownerLinkCreated = true;
      }
    }

    const { data: updatedClaim, error: claimUpdateError } =
      await admin.supabaseService
        .from("business_claim_requests")
        .update({
          status: "approved",
          reviewed_at: now,
        })
        .eq("id", claimId)
        .eq("status", "pending")
        .select("id,status,reviewed_at")
        .maybeSingle();

    if (claimUpdateError) {
      console.error("Business claim status update failed:", {
        claimId,
        businessId,
        code: claimUpdateError.code,
        message: claimUpdateError.message,
      });

      return jsonResponse(
        {
          ok: false,
          error:
            "The business was approved, but the claim status could not be updated.",
          business_updated: true,
          business_id: businessId,
          linked_user_id: authUserId,
        },
        500
      );
    }

    if (!updatedClaim) {
      return jsonResponse(
        {
          ok: false,
          error: "The business was approved, but the claim changed during review.",
          business_updated: true,
          business_id: businessId,
          linked_user_id: authUserId,
        },
        409
      );
    }

    let emailSent = false;

    try {
      const template = businessClaimApprovedEmail({
        businessName:
          cleanString(business.name, 180) ??
          cleanString(claim.business_name, 180) ??
          "Your business",
      });

      await resend.emails.send({
        from: EMAIL_FROM,
        to: claimantEmail,
        subject: template.subject,
        html: template.html,
      });

      emailSent = true;
    } catch (emailError) {
      console.error("Business claim approval email failed:", emailError);
    }

    return jsonResponse({
      ok: true,
      message: "Business claim approved successfully.",
      claim_id: claimId,
      business_id: businessId,
      linked_user_id: authUserId,
      owner_link_created: ownerLinkCreated,
      email_sent: emailSent,
      claim: updatedClaim,
    });
  } catch (error) {
    console.error("Business claim approval route failed:", error);

    return jsonResponse(
      { ok: false, error: "Could not approve business claim." },
      500
    );
  }
}