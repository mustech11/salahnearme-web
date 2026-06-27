import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mosque_id = searchParams.get("mosque_id");
  if (!mosque_id) return NextResponse.json({ error: "Missing mosque_id" }, { status: 400 });

  const { data, error } = await supabase
    .from("mosque_friday_info")
    .select("khutbah_language,jumuah_sittings,typical_full_by,notes,updated_at")
    .eq("mosque_id", mosque_id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ item: data ?? null }, { status: 200 });
}

