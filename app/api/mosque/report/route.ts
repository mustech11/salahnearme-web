import { createHash } from "crypto";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type ReportType =
  | "iqamah_started"
  | "khutbah_live"
  | "full"
  | "parking_full"
  | "correction"
  | "jumuah_first"
  | "jumuah_second"
  | "jumuah_third";

type Body = {
  mosque_id?: string;
  report_type?: ReportType;
  prayer?: string | null;
  message?: string | null;
};

const DUPLICATE_WINDOW_MINUTES = 10;
const RATE_LIMIT_WINDOW_MINUTES = 30;
const MAX_REPORTS_PER_WINDOW = 8;
const MAX_MESSAGE_LENGTH = 300;

function cleanString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function cleanMessage(value: unknown) {
  const message = cleanString(value);
  if (!message) return null;
  return message.slice(0, MAX_MESSAGE_LENGTH);
}

function isValidReportType(value: unknown): value is ReportType {
  return [
    "iqamah_started",
    "khutbah_live",
    "full",
    "parking_full",
    "correction",
    "jumuah_first",
    "jumuah_second",
    "jumuah_third",
  ].includes(String(value));
}

function isValidPrayer(value: string | null) {
  if (!value) return true;

  return ["fajr", "dhuhr", "asr", "maghrib", "isha", "jumuah"].includes(value);
}

function minutesAgoIso(minutes: number) {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

function sha256(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

async function getFingerprint() {
  const h = await headers();

  const forwardedFor = h.get("x-forwarded-for") ?? "";
  const realIp = h.get("x-real-ip") ?? "";
  const userAgent = h.get("user-agent") ?? "";
  const acceptLanguage = h.get("accept-language") ?? "";

  const raw = [forwardedFor, realIp, userAgent, acceptLanguage]
    .map((v) => v.trim())
    .join("|");

  if (!raw.replace(/\|/g, "")) {
    return null;
  }

  return sha256(raw);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    const mosqueId = cleanString(body.mosque_id);
    const prayer = cleanString(body.prayer);
    const message = cleanMessage(body.message);
    const reportType = body.report_type;

    if (!mosqueId || !isValidReportType(reportType)) {
      return NextResponse.json(
        { error: "Missing or invalid required fields" },
        { status: 400 }
      );
    }

    if (!isValidPrayer(prayer)) {
      return NextResponse.json({ error: "Invalid prayer value" }, { status: 400 });
    }

    const { data: mosque, error: mosqueError } = await supabaseAdmin
      .from("mosques")
      .select("id")
      .eq("id", mosqueId)
      .maybeSingle();

    if (mosqueError) {
      return NextResponse.json({ error: mosqueError.message }, { status: 500 });
    }

    if (!mosque) {
      return NextResponse.json({ error: "Mosque not found" }, { status: 404 });
    }

    const userFingerprint = await getFingerprint();

    if (userFingerprint) {
      const duplicateSince = minutesAgoIso(DUPLICATE_WINDOW_MINUTES);

      const { count: duplicateCount, error: duplicateError } = await supabaseAdmin
        .from("mosque_live_reports")
        .select("*", { count: "exact", head: true })
        .eq("mosque_id", mosqueId)
        .eq("report_type", reportType)
        .eq("user_fingerprint", userFingerprint)
        .gte("created_at", duplicateSince);

      if (duplicateError) {
        return NextResponse.json(
          { error: duplicateError.message },
          { status: 500 }
        );
      }

      if ((duplicateCount ?? 0) > 0) {
        return NextResponse.json(
          {
            error:
              "You already submitted this same report recently. Please wait before sending it again.",
          },
          { status: 429 }
        );
      }

      const rateLimitSince = minutesAgoIso(RATE_LIMIT_WINDOW_MINUTES);

      const { count: recentCount, error: recentError } = await supabaseAdmin
        .from("mosque_live_reports")
        .select("*", { count: "exact", head: true })
        .eq("user_fingerprint", userFingerprint)
        .gte("created_at", rateLimitSince);

      if (recentError) {
        return NextResponse.json(
          { error: recentError.message },
          { status: 500 }
        );
      }

      if ((recentCount ?? 0) >= MAX_REPORTS_PER_WINDOW) {
        return NextResponse.json(
          {
            error:
              "Too many reports sent recently. Please wait a little before sending more.",
          },
          { status: 429 }
        );
      }
    }

    const { error } = await supabaseAdmin.from("mosque_live_reports").insert({
      mosque_id: mosqueId,
      report_type: reportType,
      prayer,
      message,
      user_fingerprint: userFingerprint,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("mosque report error:", error);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

