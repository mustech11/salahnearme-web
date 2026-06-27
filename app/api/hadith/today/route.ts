import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function dayOfYear(d = new Date()) {
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24)); // 1..366
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  const { count, error: cErr } = await supabase
    .from("hadiths")
    .select("*", { count: "exact", head: true })
    .eq("provider", "hadeethenc");

  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });

  const total = count ?? 0;
  if (total === 0) return NextResponse.json({ item: null }, { status: 200 });

  const offset = dayOfYear(new Date()) % total;

  const { data, error } = await supabase
    .from("hadiths")
    .select("title_en,arabic_text,english_text,grade,source_ref,canonical_url,attribution,external_id")
    .eq("provider", "hadeethenc")
    .order("external_id", { ascending: true })
    .range(offset, offset);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ item: data?.[0] ?? null }, { status: 200 });
}

