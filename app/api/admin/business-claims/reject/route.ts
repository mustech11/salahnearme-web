import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { resend, EMAIL_FROM } from "@/lib/email";
import { businessClaimRejectedEmail } from "@/lib/emailTemplates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  claim_id?: string;
  reason?: string | null;
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
    const reason = clean(body?.reason);

    if (!claimId) {
      return NextResponse.json(
        { error: "Missing claim_id" },
        { status: 400 }
      );
    }

    const { data: claim, error: claimError } = await admin.supabaseService
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

    if (claim.status === "rejected") {
      return NextResponse.json({
        ok: true,
        message: "Claim already rejected",
      });
    }

    if (claim.status === "approved") {
      return NextResponse.json(
        {
          error:
            "This claim has already been approved. Reverse the approval manually before rejecting it.",
        },
        { status: 409 }
      );
    }

    const nowIso = new Date().toISOString();

    const { error: updateError } = await admin.supabaseService
      .from("business_claim_requests")
      .update({
        status: "rejected",
        review_reason: reason,
        reviewed_at: nowIso,
      })
      .eq("id", claimId);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    if (claim.email) {
      try {
        const template = businessClaimRejectedEmail({
          businessName: claim.business_name ?? "your business listing",
          reason,
        });

        await resend.emails.send({
          from: EMAIL_FROM,
          to: claim.email,
          subject: template.subject,
          html: template.html,
        });
      } catch (emailError) {
        console.error("business claim rejection email error:", emailError);
      }
    }

    return NextResponse.json({
      ok: true,
      claim_id: claimId,
    });
  } catch (error) {
    console.error("reject business claim route error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not reject business claim",
      },
      { status: 500 }
    );
  }
}

