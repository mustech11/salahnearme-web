import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  ordered_ids?: string[];
};

function cleanIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((id) => (typeof id === "string" ? id.trim() : ""))
    .filter(Boolean);
}

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin(req);

    if (!admin.ok) {
      return NextResponse.json(
        { error: admin.error },
        { status: admin.status }
      );
    }

    const body = (await req.json().catch(() => null)) as Body | null;

    const orderedIds = cleanIds(body?.ordered_ids);

    if (orderedIds.length === 0) {
      return NextResponse.json(
        { error: "Missing ordered_ids" },
        { status: 400 }
      );
    }

    for (let i = 0; i < orderedIds.length; i++) {
      const businessId = orderedIds[i];

      const { error } = await admin.supabaseService
        .from("businesses")
        .update({
          featured_rank: i + 1,
          featured: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", businessId);

      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      ok: true,
      updated: orderedIds.length,
    });
  } catch (error) {
    console.error("business reorder route error:", error);

    return NextResponse.json(
      { error: "Could not reorder businesses" },
      { status: 500 }
    );
  }
}

