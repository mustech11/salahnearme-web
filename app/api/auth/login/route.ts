import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function cleanString(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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

    const email = cleanString(body.email).toLowerCase();
    const password = cleanString(body.password);

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

    const supabase = await supabaseServer();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      return jsonResponse(
        {
          ok: false,
          error: error?.message ?? "Login failed.",
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