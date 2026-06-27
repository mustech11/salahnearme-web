import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug") ?? "";

  const { data, error } = await supabase
    .from("mosques")
    .select("id,name,slug,city")
    .eq("slug", slug)
    .maybeSingle();

  return NextResponse.json({ slug, data, error }, { status: 200 });
}

