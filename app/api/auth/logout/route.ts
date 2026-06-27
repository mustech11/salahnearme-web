import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeRedirectPath(value: string | null) {
  if (!value) {
    return "/login";
  }

  if (!value.startsWith("/")) {
    return "/login";
  }

  if (value.startsWith("//")) {
    return "/login";
  }

  return value;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const next = safeRedirectPath(url.searchParams.get("next"));

  const supabase = await supabaseServer();

  await supabase.auth.signOut();

  return NextResponse.redirect(new URL(next, url.origin));
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const next = safeRedirectPath(url.searchParams.get("next"));

  const supabase = await supabaseServer();

  await supabase.auth.signOut();

  return NextResponse.json(
    {
      ok: true,
      redirect_to: next,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}