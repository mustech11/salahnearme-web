import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  keep_id?: unknown;
  remove_id?: unknown;
};

type MosqueRecord = Record<string, unknown> & {
  id: string;
  verified_status?: string | null;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value.trim()
    )
  );
}

function prefer<T>(keepValue: T | null | undefined, removeValue: T | null | undefined) {
  return keepValue ?? removeValue ?? null;
}

function buildMergePayload(keep: MosqueRecord, remove: MosqueRecord) {
  return {
    address: prefer(keep.address, remove.address),
    area: prefer(keep.area, remove.area),
    postcode: prefer(keep.postcode, remove.postcode),
    latitude: prefer(keep.latitude, remove.latitude),
    longitude: prefer(keep.longitude, remove.longitude),
    maps_url: prefer(keep.maps_url, remove.maps_url),
    phone: prefer(keep.phone, remove.phone),
    website: prefer(keep.website, remove.website),
    womens_space: prefer(keep.womens_space, remove.womens_space),
    parking: prefer(keep.parking, remove.parking),
    wheelchair_access: prefer(
      keep.wheelchair_access,
      remove.wheelchair_access
    ),
    children_classes: prefer(keep.children_classes, remove.children_classes),
    nikah_service: prefer(keep.nikah_service, remove.nikah_service),
    janazah_service: prefer(keep.janazah_service, remove.janazah_service),
    wudu_facilities: prefer(keep.wudu_facilities, remove.wudu_facilities),
    sisters_entrance: prefer(keep.sisters_entrance, remove.sisters_entrance),
    imam_name: prefer(keep.imam_name, remove.imam_name),
    languages: prefer(keep.languages, remove.languages),
    facilities_notes: prefer(keep.facilities_notes, remove.facilities_notes),
    jumuah_enabled: prefer(keep.jumuah_enabled, remove.jumuah_enabled),
    jumuah_khutbah_1: prefer(keep.jumuah_khutbah_1, remove.jumuah_khutbah_1),
    jumuah_salah_1: prefer(keep.jumuah_salah_1, remove.jumuah_salah_1),
    jumuah_khutbah_2: prefer(keep.jumuah_khutbah_2, remove.jumuah_khutbah_2),
    jumuah_salah_2: prefer(keep.jumuah_salah_2, remove.jumuah_salah_2),
    jumuah_khutbah_3: prefer(keep.jumuah_khutbah_3, remove.jumuah_khutbah_3),
    jumuah_salah_3: prefer(keep.jumuah_salah_3, remove.jumuah_salah_3),
    jumuah_notes: prefer(keep.jumuah_notes, remove.jumuah_notes),
    osm_type: prefer(keep.osm_type, remove.osm_type),
    osm_id: prefer(keep.osm_id, remove.osm_id),
    source:
      keep.verified_status === "verified_from_directory"
        ? keep.source
        : "manual_duplicate_merge",
    updated_at: new Date().toISOString(),
  };
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
    route: "/api/admin/mosque-duplicates/merge",
    method: "POST",
    body: {
      keep_id: "uuid",
      remove_id: "uuid",
    },
  });
}

export async function POST(req: Request) {
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

    const body = (await req.json().catch(() => ({}))) as Body;

    const keepId =
      typeof body.keep_id === "string" ? body.keep_id.trim() : null;

    const removeId =
      typeof body.remove_id === "string" ? body.remove_id.trim() : null;

    if (!isUuid(keepId) || !isUuid(removeId)) {
      return jsonResponse(
        {
          ok: false,
          error: "Missing or invalid keep_id/remove_id.",
        },
        400
      );
    }

    if (keepId === removeId) {
      return jsonResponse(
        {
          ok: false,
          error: "Cannot merge a mosque into itself.",
        },
        400
      );
    }

    const [keepResult, removeResult] = await Promise.all([
      supabaseAdmin.from("mosques").select("*").eq("id", keepId).maybeSingle(),
      supabaseAdmin
        .from("mosques")
        .select("*")
        .eq("id", removeId)
        .maybeSingle(),
    ]);

    if (keepResult.error) {
      console.error("merge keep lookup error:", keepResult.error);

      return jsonResponse(
        {
          ok: false,
          error: "Could not load mosque to keep.",
        },
        500
      );
    }

    if (removeResult.error) {
      console.error("merge remove lookup error:", removeResult.error);

      return jsonResponse(
        {
          ok: false,
          error: "Could not load duplicate mosque.",
        },
        500
      );
    }

    if (!keepResult.data) {
      return jsonResponse(
        {
          ok: false,
          error: "Keep mosque not found.",
        },
        404
      );
    }

    if (!removeResult.data) {
      return jsonResponse(
        {
          ok: false,
          error: "Duplicate mosque not found.",
        },
        404
      );
    }

    const keep = keepResult.data as MosqueRecord;
    const remove = removeResult.data as MosqueRecord;

    const updatePayload = buildMergePayload(keep, remove);

    const { error: updateError } = await supabaseAdmin
      .from("mosques")
      .update(updatePayload)
      .eq("id", keepId);

    if (updateError) {
      console.error("merge update keep mosque error:", updateError);

      return jsonResponse(
        {
          ok: false,
          error: "Could not update keep mosque.",
        },
        500
      );
    }

    await supabaseAdmin
      .from("mosque_live_reports")
      .update({ mosque_id: keepId })
      .eq("mosque_id", removeId);

    await supabaseAdmin
      .from("iqamah_reports")
      .update({ mosque_id: keepId })
      .eq("mosque_id", removeId);

    await supabaseAdmin
      .from("businesses")
      .update({ sponsor_mosque_id: keepId })
      .eq("sponsor_mosque_id", removeId);

    await supabaseAdmin
      .from("mosque_correction_reports")
      .update({ mosque_id: keepId })
      .eq("mosque_id", removeId);

    const { error: deleteError } = await supabaseAdmin
      .from("mosques")
      .delete()
      .eq("id", removeId);

    if (deleteError) {
      console.error("merge delete duplicate mosque error:", deleteError);

      return jsonResponse(
        {
          ok: false,
          error: "Could not delete duplicate mosque.",
        },
        500
      );
    }

    return jsonResponse({
      ok: true,
      keep_id: keepId,
      removed_id: removeId,
    });
  } catch (error) {
    console.error("mosque duplicate merge route error:", error);

    return jsonResponse(
      {
        ok: false,
        error: "Unexpected merge error.",
      },
      500
    );
  }
}

