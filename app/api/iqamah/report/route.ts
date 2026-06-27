import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function hashIP(ip: string) {
  const salt = process.env.HASH_SALT ?? "change_me";
  return crypto.createHash("sha256").update(ip + salt).digest("hex");
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const mosque_id = body.mosque_id;
  const prayer = String(body.prayer ?? "").toLowerCase();
  const report_type = String(body.report_type ?? "").toLowerCase();

  const okPrayer = ["fajr","dhuhr","asr","maghrib","isha","jumuah"].includes(prayer);
  const okType = ["started","delayed","full","parking_full"].includes(report_type);

  if (!mosque_id || !okPrayer || !okType) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "0.0.0.0";
  const client_hash = hashIP(ip);

  // soft rate limit per IP (2 per hour)
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("iqamah_reports")
    .select("*", { count: "exact", head: true })
    .eq("mosque_id", mosque_id)
    .eq("client_hash", client_hash)
    .gte("created_at", since);

  if ((count ?? 0) >= 2) {
    return NextResponse.json({ error: "Too many reports. Try later." }, { status: 429 });
  }

  const { error } = await supabase.from("iqamah_reports").insert({
    mosque_id,
    prayer,
    report_type,
    client_hash,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 200 });
}

