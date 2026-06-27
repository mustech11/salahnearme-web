import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { resend, EMAIL_FROM } from "@/lib/email";
import { businessClaimApprovedEmail } from "@/lib/emailTemplates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  claim_id?: string;
};

function clean(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();

  return trimmed.length ? trimmed : null;
}

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin(req);

    if (!admin.ok) {
      return NextResponse.json(
        { error: admin.error },
        { status: admin.status }
      );
    }

    const body = (await req.json().catch(() => null)) as Body | null;

    const claimId = clean(body?.claim_id);

    if (!claimId) {
      return NextResponse.json(
        { error: "Missing claim_id" },
        { status: 400 }
      );
    }

    const { data: claim, error: claimError } =
      await admin.supabaseService
        .from("business_claim_requests")
        .select("*")
        .eq("id", claimId)
        .maybeSingle();

    if (claimError) {
      return NextResponse.json(
        { error: claimError.message },
        { status: 500 }
      );
    }

    if (!claim) {
      return NextResponse.json(
        { error: "Claim not found" },
        { status: 404 }
      );
    }

    if (claim.status === "approved") {
      return NextResponse.json({
        ok: true,
        message: "Claim already approved",
      });
    }

    if (!claim.business_id) {
      return NextResponse.json(
        { error: "Claim has no business_id" },
        { status: 400 }
      );
    }

    const { data: business, error: businessFetchError } =
      await admin.supabaseService
        .from("businesses")
        .select("id,name,email")
        .eq("id", claim.business_id)
        .maybeSingle();

    if (businessFetchError) {
      return NextResponse.json(
        { error: businessFetchError.message },
        { status: 500 }
      );
    }

    if (!business) {
      return NextResponse.json(
        { error: "Business not found" },
        { status: 404 }
      );
    }

    const nowIso = new Date().toISOString();

    /*
    --------------------------------------------------
    UPDATE BUSINESS
    --------------------------------------------------
    */

    const { error: businessError } =
      await admin.supabaseService
        .from("businesses")
        .update({
          is_claimed: true,
          claimed_by_email: claim.email,
          is_verified: true,
          can_advertise: true,
          status: "approved",
          review_status: "approved",
          is_live: true,
          quality_status: "manual_verified",
          reviewed_at: nowIso,
          reviewed_by: "admin",
          updated_at: nowIso,
        })
        .eq("id", claim.business_id);

    if (businessError) {
      return NextResponse.json(
        { error: businessError.message },
        { status: 500 }
      );
    }

    /*
    --------------------------------------------------
    FIND AUTH USER
    --------------------------------------------------
    */

    let authUserId: string | null = null;

    if (claim.email) {
      const { data: authUsers, error: authError } =
        await admin.supabaseService.auth.admin.listUsers();

      if (authError) {
        console.error("auth lookup error:", authError);
      } else {
        const matchedUser = authUsers.users.find(
          (u) =>
            u.email?.toLowerCase().trim() ===
            claim.email.toLowerCase().trim()
        );

        authUserId = matchedUser?.id ?? null;
      }
    }

    /*
    --------------------------------------------------
    CREATE BUSINESS OWNER LINK
    --------------------------------------------------
    */

    if (authUserId) {
      const { error: businessUserError } =
        await admin.supabaseService
          .from("business_users")
          .upsert(
            {
              business_id: claim.business_id,
              user_id: authUserId,
              role: "owner",
            },
            {
              onConflict: "business_id,user_id",
            }
          );

      if (businessUserError) {
        console.error(
          "business_users insert error:",
          businessUserError
        );
      }
    }

    /*
    --------------------------------------------------
    UPDATE CLAIM
    --------------------------------------------------
    */

    const { error: updateClaimError } =
      await admin.supabaseService
        .from("business_claim_requests")
        .update({
          status: "approved",
          reviewed_at: nowIso,
        })
        .eq("id", claimId);

    if (updateClaimError) {
      return NextResponse.json(
        { error: updateClaimError.message },
        { status: 500 }
      );
    }

    /*
    --------------------------------------------------
    EMAIL
    --------------------------------------------------
    */

    if (claim.email) {
      try {
        const template = businessClaimApprovedEmail({
          businessName:
            business.name ??
            claim.business_name ??
            "Your business",
        });

        await resend.emails.send({
          from: EMAIL_FROM,
          to: claim.email,
          subject: template.subject,
          html: template.html,
        });
      } catch (emailError) {
        console.error(
          "business claim approval email error:",
          emailError
        );
      }
    }

    return NextResponse.json({
      ok: true,
      claim_id: claimId,
      business_id: claim.business_id,
      linked_user_id: authUserId,
    });
  } catch (error) {
    console.error(
      "approve business claim route error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not approve business claim",
      },
      { status: 500 }
    );
  }
}

