import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/adminAuth";
import { detectDuplicates } from "@/lib/duplicateDetection";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function GET() {
  const permission = await requireAdmin();

  if (!permission.ok) {
    return jsonResponse(
      {
        ok: false,
        error: permission.error,
      },
      permission.status
    );
  }

  return jsonResponse({
    ok: true,
    route: "/api/admin/duplicates/scan",
    method: "POST",
    message: "Run POST to scan mosque and business duplicates.",
  });
}

export async function POST() {
  try {
    const permission = await requireAdmin();

    if (!permission.ok) {
      return jsonResponse(
        {
          ok: false,
          error: permission.error,
        },
        permission.status
      );
    }

    const [mosquesResult, businessesResult] = await Promise.all([
      supabaseAdmin
        .from("mosques")
        .select("id,name,slug,city,postcode,address")
        .eq("is_active", true)
        .order("name", { ascending: true })
        .limit(5000),

      supabaseAdmin
        .from("businesses")
        .select("id,name,slug,city,postcode,phone,website,address")
        .eq("is_active", true)
        .order("name", { ascending: true })
        .limit(5000),
    ]);

    if (mosquesResult.error) {
      console.error("duplicate scan mosques error:", mosquesResult.error);

      return jsonResponse(
        {
          ok: false,
          error: "Could not load mosques for duplicate scan.",
        },
        500
      );
    }

    if (businessesResult.error) {
      console.error("duplicate scan businesses error:", businessesResult.error);

      return jsonResponse(
        {
          ok: false,
          error: "Could not load businesses for duplicate scan.",
        },
        500
      );
    }

    const mosqueCandidates = detectDuplicates(
      mosquesResult.data ?? [],
      "mosque"
    );

    const businessCandidates = detectDuplicates(
      businessesResult.data ?? [],
      "business"
    );

    const allCandidates = [...mosqueCandidates, ...businessCandidates];

    if (allCandidates.length === 0) {
      return jsonResponse({
        ok: true,
        inserted: 0,
        total_candidates: 0,
      });
    }

    const payload = allCandidates.map((item) => ({
      entity_type: item.entity_type,
      left_id: item.left_id,
      right_id: item.right_id,
      confidence: item.confidence,
      reasons: item.reasons,
      status: "pending",
    }));

    const { error: upsertError } = await supabaseAdmin
      .from("duplicate_review_queue")
      .upsert(payload, {
        onConflict: "entity_type,left_id,right_id",
        ignoreDuplicates: false,
      });

    if (upsertError) {
      console.error("duplicate scan upsert error:", upsertError);

      return jsonResponse(
        {
          ok: false,
          error: "Could not save duplicate scan results.",
        },
        500
      );
    }

    return jsonResponse({
      ok: true,
      inserted: payload.length,
      total_candidates: payload.length,
      mosque_candidates: mosqueCandidates.length,
      business_candidates: businessCandidates.length,
    });
  } catch (error) {
    console.error("duplicate scan route error:", error);

    return jsonResponse(
      {
        ok: false,
        error: "Could not scan for duplicates.",
      },
      500
    );
  }
}

