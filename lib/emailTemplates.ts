function escapeHtml(value: string | null | undefined) {
  const safeValue = value ?? "";

  return safeValue
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatLabel(value: string) {
  return escapeHtml(
    value
      .replace(/_/g, " ")
      .replace(/-/g, " ")
      .replace(/\b\w/g, (m) => m.toUpperCase())
  );
}

function baseEmail(args: {
  title: string;
  preheader: string;
  children: string;
  ctaText?: string;
  ctaUrl?: string;
}) {
  return `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(args.title)}</title>
  </head>

  <body style="margin:0;padding:0;background:#020826;font-family:Arial,Helvetica,sans-serif;color:#ffffff;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      ${escapeHtml(args.preheader)}
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#020826;padding:32px 12px;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:680px;border:1px solid rgba(250,204,21,0.22);border-radius:24px;overflow:hidden;background:#07112f;">
            <tr>
              <td style="padding:28px 32px;background:linear-gradient(135deg,#020826,#101b3f);border-bottom:1px solid rgba(250,204,21,0.18);">
                <div style="font-size:12px;letter-spacing:4px;text-transform:uppercase;color:#facc15;font-weight:700;">
                  SalahNearMe
                </div>

                <h1 style="margin:14px 0 0;font-size:30px;line-height:1.15;color:#ffffff;">
                  ${escapeHtml(args.title)}
                </h1>

                <p style="margin:12px 0 0;color:rgba(255,255,255,0.72);font-size:15px;line-height:1.6;">
                  Find. Pray. Connect.
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:32px;">
                ${args.children}

                ${
                  args.ctaText && args.ctaUrl
                    ? `
                      <div style="margin-top:28px;">
                        <a href="${escapeHtml(args.ctaUrl)}" style="display:inline-block;background:#facc15;color:#020826;text-decoration:none;font-weight:700;border-radius:12px;padding:13px 20px;">
                          ${escapeHtml(args.ctaText)}
                        </a>
                      </div>
                    `
                    : ""
                }
              </td>
            </tr>

            <tr>
              <td style="padding:22px 32px;border-top:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.56);font-size:12px;line-height:1.6;">
                <div>
                  © ${new Date().getFullYear()} SalahNearMe. This is an automated service email.
                </div>
                <div style="margin-top:6px;">
                  You received this because you submitted or manage a business listing on SalahNearMe.
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function paragraph(content: string) {
  return `
    <p style="margin:0 0 16px;color:rgba(255,255,255,0.78);font-size:15px;line-height:1.7;">
      ${content}
    </p>
  `;
}

function infoBox(title: string, body: string, tone: "gold" | "green" | "red" = "gold") {
  const styles = {
    gold: {
      border: "rgba(250,204,21,0.24)",
      bg: "rgba(250,204,21,0.08)",
      title: "#facc15",
    },
    green: {
      border: "rgba(34,197,94,0.25)",
      bg: "rgba(34,197,94,0.08)",
      title: "#86efac",
    },
    red: {
      border: "rgba(248,113,113,0.25)",
      bg: "rgba(248,113,113,0.08)",
      title: "#fca5a5",
    },
  }[tone];

  return `
    <div style="margin:22px 0;padding:18px 20px;border-radius:18px;border:1px solid ${styles.border};background:${styles.bg};">
      <div style="color:${styles.title};font-weight:700;font-size:14px;margin-bottom:8px;">
        ${escapeHtml(title)}
      </div>
      <div style="color:rgba(255,255,255,0.78);font-size:14px;line-height:1.7;">
        ${body}
      </div>
    </div>
  `;
}

export function businessClaimApprovedEmail(args: {
  businessName: string;
  dashboardUrl?: string;
}) {
  const businessName = escapeHtml(args.businessName);

  return {
    subject: `Your business claim was approved | SalahNearMe`,
    html: baseEmail({
      title: "Business claim approved",
      preheader: `Your claim for ${args.businessName} has been approved.`,
      ctaText: args.dashboardUrl ? "Open business dashboard" : undefined,
      ctaUrl: args.dashboardUrl,
      children: `
        ${paragraph(
          `Alhamdulillah — your ownership claim for <strong style="color:#ffffff;">${businessName}</strong> has been approved.`
        )}

        ${infoBox(
          "What has changed",
          `
            <ul style="margin:0;padding-left:18px;">
              <li>Your business is now marked as claimed.</li>
              <li>Your listing is verified.</li>
              <li>Your listing can access future business management features.</li>
              <li>You can improve visibility through featured placements and mosque sponsorships.</li>
            </ul>
          `,
          "green"
        )}

        ${paragraph(
          "Thank you for helping us build a trusted Muslim business directory."
        )}

        ${paragraph("— SalahNearMe Team")}
      `,
    }),
  };
}

export function businessClaimRejectedEmail(args: {
  businessName: string;
  reason?: string | null;
}) {
  const businessName = escapeHtml(args.businessName);
  const reason = args.reason ? escapeHtml(args.reason) : null;

  return {
    subject: `Business claim review update | SalahNearMe`,
    html: baseEmail({
      title: "Business claim review update",
      preheader: `Your claim for ${args.businessName} could not be approved at this time.`,
      children: `
        ${paragraph(
          `Your ownership claim for <strong style="color:#ffffff;">${businessName}</strong> has been reviewed.`
        )}

        ${paragraph(
          "Unfortunately, we could not approve the claim at this time."
        )}

        ${
          reason
            ? infoBox("Review note", reason, "red")
            : ""
        }

        ${infoBox(
          "You may submit again",
          "If you believe this decision was incorrect, please submit another claim with clearer proof, such as a business email, website ownership evidence, company document, utility bill, invoice, or other official proof.",
          "gold"
        )}

        ${paragraph("— SalahNearMe Team")}
      `,
    }),
  };
}

export function campaignActivatedEmail(args: {
  businessName: string;
  tier: string;
  paidUntil: string;
  dashboardUrl?: string;
}) {
  const businessName = escapeHtml(args.businessName);

  return {
    subject: `Your campaign is now active | SalahNearMe`,
    html: baseEmail({
      title: "Campaign active",
      preheader: `${args.businessName} is now active on SalahNearMe.`,
      ctaText: args.dashboardUrl ? "View campaign" : undefined,
      ctaUrl: args.dashboardUrl,
      children: `
        ${paragraph(
          `<strong style="color:#ffffff;">${businessName}</strong> is now active on SalahNearMe.`
        )}

        ${infoBox(
          "Campaign details",
          `
            <div>Tier: <strong style="color:#ffffff;">${formatLabel(args.tier)}</strong></div>
            <div>Paid until: <strong style="color:#ffffff;">${formatDate(args.paidUntil)}</strong></div>
          `,
          "green"
        )}

        ${paragraph(
          "Your business may now appear with enhanced visibility depending on your campaign type, location, rank, and sponsorship settings."
        )}

        ${paragraph("— SalahNearMe Team")}
      `,
    }),
  };
}

export function campaignExpiringEmail(args: {
  businessName: string;
  paidUntil: string;
  renewUrl?: string;
}) {
  const businessName = escapeHtml(args.businessName);

  return {
    subject: `Your campaign is expiring soon | SalahNearMe`,
    html: baseEmail({
      title: "Campaign expiring soon",
      preheader: `Your sponsored placement for ${args.businessName} is due to expire soon.`,
      ctaText: args.renewUrl ? "Renew campaign" : undefined,
      ctaUrl: args.renewUrl,
      children: `
        ${paragraph(
          `Your sponsored placement for <strong style="color:#ffffff;">${businessName}</strong> is due to expire soon.`
        )}

        ${infoBox(
          "Expiry date",
          `Paid until: <strong style="color:#ffffff;">${formatDate(args.paidUntil)}</strong>`,
          "gold"
        )}

        ${paragraph(
          "Please renew to avoid losing your premium placement, featured ranking, or mosque sponsorship visibility."
        )}

        ${paragraph("— SalahNearMe Team")}
      `,
    }),
  };
}

export function paymentFailedEmail(args: {
  businessName: string;
  billingUrl?: string;
}) {
  const businessName = escapeHtml(args.businessName);

  return {
    subject: `Payment issue with your SalahNearMe subscription`,
    html: baseEmail({
      title: "Payment issue detected",
      preheader: `We could not process a payment for ${args.businessName}.`,
      ctaText: args.billingUrl ? "Update payment method" : undefined,
      ctaUrl: args.billingUrl,
      children: `
        ${paragraph(
          `We could not process a recurring payment for <strong style="color:#ffffff;">${businessName}</strong>.`
        )}

        ${infoBox(
          "Action needed",
          "Please update your payment method to keep your featured placement, campaign, or sponsorship active.",
          "red"
        )}

        ${paragraph(
          "If payment is not resolved, your premium placement may be paused or removed automatically."
        )}

        ${paragraph("— SalahNearMe Team")}
      `,
    }),
  };
}

