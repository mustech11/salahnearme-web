import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resend, EMAIL_FROM } from "@/lib/email";
import { campaignExpiringEmail } from "@/lib/emailTemplates";

export const runtime = "nodejs";

export async function POST() {
  try {
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + 7);

    const { data: businesses, error } = await supabaseAdmin
      .from("businesses")
      .select("id,name,email,submitted_by_email,paid_until,featured")
      .eq("featured", true)
      .not("paid_until", "is", null)
      .gte("paid_until", start.toISOString())
      .lte("paid_until", end.toISOString());

    if (error) {
      console.error("DB error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let sent = 0;
    let failed = 0;

    for (const business of businesses ?? []) {
      try {
        const to = business.email || business.submitted_by_email;
        if (!to || !business.paid_until) continue;

        const template = campaignExpiringEmail({
          businessName: business.name ?? "Your business",
          paidUntil: business.paid_until,
        });

        await resend.emails.send({
          from: EMAIL_FROM,
          to,
          subject: template.subject,
          html: template.html,
        });

        sent++;
      } catch (err) {
        console.error("Email failed for business:", business.id, err);
        failed++;
      }
    }

    return NextResponse.json({
      ok: true,
      sent,
      failed,
      total: businesses?.length ?? 0,
    });
  } catch (error) {
    console.error("campaign expiry scan error:", error);

    return NextResponse.json(
      { error: "Could not send expiry reminders" },
      { status: 500 }
    );
  }
}

