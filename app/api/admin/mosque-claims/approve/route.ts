import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/requireAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ROLES = ["owner", "manager", "editor"] as const;

type GrantedRole = (typeof ROLES)[number];

type Body = {
  claim_id?: unknown;
  granted_role?: unknown;
};

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

function cleanRole(value: unknown): GrantedRole | null {
  return typeof value === "string" && ROLES.includes(value as GrantedRole)
    ? (value as GrantedRole)
    : null;
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
    const grantedRole =
      body.granted_role === undefined
        ? "manager"
        : cleanRole(body.granted_role);

    if (!isUuid(claimId)) {
      return jsonResponse({ ok: false, error: "Missing or invalid claim_id." }, 400);
    }

    if (!grantedRole) {
      return jsonResponse(
        {
          ok: false,
          error: "Invalid granted_role.",
          allowed_roles: ROLES,
        },
        400
      );
    }

    const { data: claim, error: claimError } = await admin.supabaseService
      .from("mosque_claim_requests")
      .select("id,mosque_id,email,status")
      .eq("id", claimId)
      .maybeSingle();

    if (claimError) {
      console.error("Mosque claim lookup failed:", {
        claimId,
        code: claimError.code,
        message: claimError.message,
      });

      return jsonResponse({ ok: false, error: "Could not load the mosque claim." }, 500);
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
        mosque_id: claim.mosque_id ?? null,
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

    const mosqueId = cleanString(claim.mosque_id, 80);
    const claimantEmail = cleanEmail(claim.email);

    if (!isUuid(mosqueId)) {
      return jsonResponse({ ok: false, error: "Claim has no valid mosque_id." }, 422);
    }

    if (!claimantEmail) {
      return jsonResponse({ ok: false, error: "Claim has no valid email address." }, 422);
    }

    const now = new Date().toISOString();
    const reviewer = "admin";

    const { error: roleError } = await admin.supabaseService
      .from("mosque_manager_roles")
      .upsert(
        {
          mosque_id: mosqueId,
          user_email: claimantEmail,
          role: grantedRole,
          status: "active",
          granted_by: reviewer,
          granted_at: now,
        },
        { onConflict: "mosque_id,user_email" }
      );

    if (roleError) {
      console.error("Mosque manager-role upsert failed:", {
        claimId,
        mosqueId,
        code: roleError.code,
        message: roleError.message,
      });

      return jsonResponse({ ok: false, error: "Could not grant mosque-manager access." }, 500);
    }

    const { data: updatedClaim, error: updateError } =
      await admin.supabaseService
        .from("mosque_claim_requests")
        .update({
          status: "approved",
          reviewed_by: reviewer,
          reviewed_at: now,
        })
        .eq("id", claimId)
        .eq("status", "pending")
        .select("id,mosque_id,status,reviewed_by,reviewed_at")
        .maybeSingle();

    if (updateError) {
      console.error("Mosque claim approval update failed:", {
        claimId,
        mosqueId,
        code: updateError.code,
        message: updateError.message,
      });

      return jsonResponse(
        {
          ok: false,
          error:
            "Manager access was granted, but the claim status could not be updated.",
          role_granted: true,
          mosque_id: mosqueId,
        },
        500
      );
    }

    if (!updatedClaim) {
      return jsonResponse(
        {
          ok: false,
          error: "Manager access was granted, but the claim changed during review.",
          role_granted: true,
          mosque_id: mosqueId,
        },
        409
      );
    }

    return jsonResponse({
      ok: true,
      message: "Mosque claim approved successfully.",
      claim_id: claimId,
      mosque_id: mosqueId,
      granted_role: grantedRole,
      claim: updatedClaim,
    });
  } catch (error) {
    console.error("Mosque claim approval route failed:", error);

    return jsonResponse(
      { ok: false, error: "Could not approve mosque claim." },
      500
    );
  }
}