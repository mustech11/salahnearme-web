import { NextResponse } from "next/server";

import { EMAIL_FROM, resend } from "@/lib/email";
import { businessClaimRejectedEmail } from "@/lib/emailTemplates";
import { requireAdmin } from "@/lib/requireAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Body = {
  claim_id?: unknown;
  reason?: unknown;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_REASON_LENGTH = 2_000;
const MAX_REQUEST_BODY_BYTES = 12_000;

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
    const reason = cleanString(body.reason, MAX_REASON_LENGTH);

    if (!isUuid(claimId)) {
      return jsonResponse({ ok: false, error: "Missing or invalid claim_id." }, 400);
    }

    const { data: claim, error: claimError } = await admin.supabaseService
      .from("business_claim_requests")
      .select("id,business_name,email,status")
      .eq("id", claimId)
      .maybeSingle();

    if (claimError) {
      console.error("Business claim rejection lookup failed:", {
        claimId,
        code: claimError.code,
        message: claimError.message,
      });

      return jsonResponse({ ok: false, error: "Could not load the business claim." }, 500);
    }

    if (!claim) {
      return jsonResponse({ ok: false, error: "Claim not found." }, 404);
    }

    if (claim.status === "rejected") {
      return jsonResponse({
        ok: true,
        already_rejected: true,
        message: "Claim already rejected.",
        claim_id: claimId,
      });
    }

    if (claim.status === "approved") {
      return jsonResponse(
        {
          ok: false,
          error:
            "This claim has already been approved. Reverse the approval before rejecting it.",
        },
        409
      );
    }

    if (claim.status && claim.status !== "pending") {
      return jsonResponse(
        {
          ok: false,
          error: "Only pending claims can be rejected.",
          current_status: claim.status,
        },
        409
      );
    }

    const now = new Date().toISOString();

    const { data: updatedClaim, error: updateError } =
      await admin.supabaseService
        .from("business_claim_requests")
        .update({
          status: "rejected",
          review_reason: reason,
          reviewed_at: now,
        })
        .eq("id", claimId)
        .eq("status", "pending")
        .select("id,status,review_reason,reviewed_at")
        .maybeSingle();

    if (updateError) {
      console.error("Business claim rejection update failed:", {
        claimId,
        code: updateError.code,
        message: updateError.message,
      });

      return jsonResponse({ ok: false, error: "Could not reject the business claim." }, 500);
    }

    if (!updatedClaim) {
      return jsonResponse(
        {
          ok: false,
          error: "The claim changed during review. Refresh and try again.",
        },
        409
      );
    }

    let emailSent = false;
    const recipient = cleanEmail(claim.email);

    if (recipient) {
      try {
        const template = businessClaimRejectedEmail({
          businessName:
            cleanString(claim.business_name, 180) ?? "your business listing",
          reason,
        });

        await resend.emails.send({
          from: EMAIL_FROM,
          to: recipient,
          subject: template.subject,
          html: template.html,
        });

        emailSent = true;
      } catch (emailError) {
        console.error("Business claim rejection email failed:", emailError);
      }
    }

    return jsonResponse({
      ok: true,
      message: "Business claim rejected successfully.",
      claim_id: claimId,
      email_sent: emailSent,
      claim: updatedClaim,
    });
  } catch (error) {
    console.error("Business claim rejection route failed:", error);

    return jsonResponse(
      { ok: false, error: "Could not reject business claim." },
      500
    );
  }
}