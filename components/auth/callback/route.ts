import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/dashboard/business";

  if (code) {
    const supabase = await supabaseServer();

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("auth callback exchange error:", error);

      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin)
      );
    }
  }

  return NextResponse.redirect(new URL(next, url.origin));
}