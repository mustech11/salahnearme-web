import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_REDIRECT = "/login";

function safeRedirectPath(value: string | null) {
  if (!value) {
    return DEFAULT_REDIRECT;
  }

  const trimmed = value.trim();

  if (!trimmed || !trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return DEFAULT_REDIRECT;
  }

  if (trimmed.startsWith("/api")) {
    return DEFAULT_REDIRECT;
  }

  return trimmed;
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

async function signOutSafely() {
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.warn("logout warning:", error.message);
  }

  return error;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const next = safeRedirectPath(url.searchParams.get("next"));

  await signOutSafely();

  return NextResponse.redirect(new URL(next, url.origin), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const next = safeRedirectPath(url.searchParams.get("next"));

  const error = await signOutSafely();

  if (error) {
    return jsonResponse(
      {
        ok: false,
        error: "Signed out locally, but Supabase returned a warning.",
        warning: error.message,
        redirect_to: next,
      },
      200
    );
  }

  return jsonResponse({
    ok: true,
    message: "Signed out successfully.",
    redirect_to: next,
  });
}