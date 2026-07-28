import { timingSafeEqual } from "crypto";

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 10;

type Body = {
  password?: unknown;
};

const MAX_REQUEST_BODY_BYTES = 4_000;
const MAX_PASSWORD_LENGTH = 500;

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

function cleanString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/\u0000/g, "").trim().slice(0, maxLength);
  return cleaned || null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function secureEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export async function POST(request: NextRequest) {
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
    const suppliedPassword = cleanString(body.password, MAX_PASSWORD_LENGTH);
    const configuredPassword = process.env.ADMIN_AI_PASSWORD;

    if (!configuredPassword) {
      console.error("ADMIN_AI_PASSWORD is not configured.");

      return jsonResponse(
        { ok: false, error: "Admin verification is unavailable." },
        503
      );
    }

    if (
      !suppliedPassword ||
      !secureEqual(suppliedPassword, configuredPassword)
    ) {
      return jsonResponse(
        { ok: false, error: "Unauthorized." },
        401
      );
    }

    return jsonResponse({
      ok: true,
      verified: true,
    });
  } catch (error) {
    console.error("Admin verification route failed:", error);

    return jsonResponse(
      { ok: false, error: "Invalid request." },
      400
    );
  }
}