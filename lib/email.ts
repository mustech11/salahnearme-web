import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;

if (!resendApiKey) {
  throw new Error("Missing RESEND_API_KEY");
}

export const resend = new Resend(resendApiKey);

export const EMAIL_FROM =
  process.env.EMAIL_FROM ||
  "SalahNearMe <noreply@salahnearme.com>";

