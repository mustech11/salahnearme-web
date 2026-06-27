import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { password?: string };

    if (!body.password || body.password !== process.env.ADMIN_AI_PASSWORD) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request" },
      { status: 400 }
    );
  }
}

