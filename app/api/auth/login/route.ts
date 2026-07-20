import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_EMAIL_LENGTH = 254;
const MAX_PASSWORD_LENGTH = 500;

type LoginBody = {
  email?: unknown;
  password?: unknown;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function cleanString(value: unknown, maxLength = 500) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getRequestMeta(req: Request) {
  return {
    ip_hint:
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      null,
    user_agent: req.headers.get("user-agent"),
  };
}

export async function GET() {
  return jsonResponse({
    ok: true,
    route: "/api/auth/login",
    method: "POST",
    body: {
      email: "user@example.com",
      password: "password",
    },
  });
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") ?? "";

    if (!contentType.toLowerCase().includes("application/json")) {
      return jsonResponse(
        {
          ok: false,
          error: "Content-Type must be application/json.",
        },
        415
      );
    }

    const body = (await req.json().catch(() => null)) as LoginBody | null;

    if (!body) {
      return jsonResponse(
        {
          ok: false,
          error: "Missing request body.",
        },
        400
      );
    }

    const email = cleanString(body.email, MAX_EMAIL_LENGTH).toLowerCase();
    const password = cleanString(body.password, MAX_PASSWORD_LENGTH);

    if (!email || !password) {
      return jsonResponse(
        {
          ok: false,
          error: "Missing email or password.",
        },
        400
      );
    }

    if (!isValidEmail(email)) {
      return jsonResponse(
        {
          ok: false,
          error: "Invalid email address.",
        },
        400
      );
    }

    if (password.length < 6) {
      return jsonResponse(
        {
          ok: false,
          error: "Password is too short.",
        },
        400
      );
    }

    const supabase = await supabaseServer();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      console.warn("login failed:", {
        email,
        ...getRequestMeta(req),
        error: error?.message ?? "No user returned",
      });

      return jsonResponse(
        {
          ok: false,
          error: "Invalid email or password.",
        },
        401
      );
    }

    return jsonResponse({
      ok: true,
      user: {
        id: data.user.id,
        email: data.user.email,
      },
      session: {
        authenticated: Boolean(data.session),
      },
      message: "Signed in successfully.",
    });
  } catch (error) {
    console.error("login route error:", error);

    return jsonResponse(
      {
        ok: false,
        error: "Could not sign in.",
      },
      500
    );
  }
}