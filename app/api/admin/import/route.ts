import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  normalizeMosqueRow,
  normalizeBusinessRow,
  validateMosqueRow,
  validateBusinessRow,
  type ImportSummary,
} from "@/lib/importUtils";
import { detectDuplicates } from "@/lib/duplicateDetection";

export const runtime = "nodejs";

type RequestBody = {
  type: "mosques" | "businesses";
  mode: "dry-run" | "confirm";
  file_name?: string;
  rows: Record<string, unknown>[];
};

async function findExistingMosque(row: ReturnType<typeof normalizeMosqueRow>) {
  if (row.slug) {
    const { data } = await supabaseAdmin
      .from("mosques")
      .select("id")
      .eq("slug", row.slug)
      .maybeSingle();
    if (data) return data;
  }

  if (row.name && row.postcode) {
    const { data } = await supabaseAdmin
      .from("mosques")
      .select("id")
      .eq("name", row.name)
      .eq("postcode", row.postcode)
      .maybeSingle();
    if (data) return data;
  }

  if (row.name && row.city) {
    const { data } = await supabaseAdmin
      .from("mosques")
      .select("id")
      .eq("name", row.name)
      .eq("city", row.city)
      .maybeSingle();
    if (data) return data;
  }

  return null;
}

async function findExistingBusiness(row: ReturnType<typeof normalizeBusinessRow>) {
  if (row.slug) {
    const { data } = await supabaseAdmin
      .from("businesses")
      .select("id")
      .eq("slug", row.slug)
      .maybeSingle();
    if (data) return data;
  }

  if (row.name && row.postcode) {
    const { data } = await supabaseAdmin
      .from("businesses")
      .select("id")
      .eq("name", row.name)
      .eq("postcode", row.postcode)
      .maybeSingle();
    if (data) return data;
  }

  if (row.website) {
    const { data } = await supabaseAdmin
      .from("businesses")
      .select("id")
      .eq("website", row.website)
      .maybeSingle();
    if (data) return data;
  }

  if (row.phone && row.city) {
    const { data } = await supabaseAdmin
      .from("businesses")
      .select("id")
      .eq("phone", row.phone)
      .eq("city", row.city)
      .maybeSingle();
    if (data) return data;
  }

  return null;
}

async function queueDuplicates(type: "mosques" | "businesses") {
  if (type === "mosques") {
    const { data } = await supabaseAdmin
      .from("mosques")
      .select("id,name,slug,city,postcode,address")
      .order("name", { ascending: true });

    const candidates = detectDuplicates(data ?? [], "mosque");

    if (candidates.length > 0) {
      await supabaseAdmin.from("duplicate_review_queue").upsert(
        candidates.map((item) => ({
          entity_type: item.entity_type,
          left_id: item.left_id,
          right_id: item.right_id,
          confidence: item.confidence,
          reasons: item.reasons,
          status: "pending",
        })),
        {
          onConflict: "entity_type,left_id,right_id",
          ignoreDuplicates: false,
        }
      );
    }

    return candidates.length;
  }

  const { data } = await supabaseAdmin
    .from("businesses")
    .select("id,name,slug,city,postcode,phone,website,address")
    .order("name", { ascending: true });

  const candidates = detectDuplicates(data ?? [], "business");

  if (candidates.length > 0) {
    await supabaseAdmin.from("duplicate_review_queue").upsert(
      candidates.map((item) => ({
        entity_type: item.entity_type,
        left_id: item.left_id,
        right_id: item.right_id,
        confidence: item.confidence,
        reasons: item.reasons,
        status: "pending",
      })),
      {
        onConflict: "entity_type,left_id,right_id",
        ignoreDuplicates: false,
      }
    );
  }

  return candidates.length;
}

async function saveImportRun(
  body: RequestBody,
  summary: ImportSummary & { duplicateCandidatesQueued?: number }
) {
  await supabaseAdmin.from("import_runs").insert({
    entity_type: body.type,
    mode: body.mode,
    file_name: body.file_name ?? null,
    total_rows: summary.totalRows,
    valid_rows: summary.validRows,
    invalid_rows: summary.invalidRows,
    insert_count: summary.insertCount,
    update_count: summary.updateCount,
    duplicate_candidates_queued: summary.duplicateCandidatesQueued ?? 0,
    errors: summary.errors,
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestBody;

    if (!body.type || !body.mode || !Array.isArray(body.rows)) {
      return NextResponse.json(
        { error: "Invalid import payload" },
        { status: 400 }
      );
    }

    const summary: ImportSummary & { duplicateCandidatesQueued?: number } = {
      type: body.type,
      totalRows: body.rows.length,
      validRows: 0,
      invalidRows: 0,
      insertCount: 0,
      updateCount: 0,
      duplicateCandidatesQueued: 0,
      errors: [],
      rows: [],
    };

    for (let i = 0; i < body.rows.length; i++) {
      const rawRow = body.rows[i];

      if (body.type === "mosques") {
        const normalized = normalizeMosqueRow(rawRow);
        const result = validateMosqueRow(normalized, i + 2);

        if (!result.valid) {
          summary.invalidRows++;
          summary.errors.push({
            row: result.row,
            message: result.errors.join(", "),
            data: result.data,
          });
          continue;
        }

        const existing = await findExistingMosque(normalized);

        summary.validRows++;
        summary.rows.push({
          ...normalized,
          action: existing ? "update" : "insert",
          existing_id: existing?.id ?? null,
        });

        if (existing) summary.updateCount++;
        else summary.insertCount++;

        if (body.mode === "confirm") {
          if (existing) {
            const { error } = await supabaseAdmin
              .from("mosques")
              .update(normalized)
              .eq("id", existing.id);

            if (error) {
              summary.errors.push({
                row: i + 2,
                message: error.message,
                data: normalized,
              });
            }
          } else {
            const { error } = await supabaseAdmin.from("mosques").insert(normalized);

            if (error) {
              summary.errors.push({
                row: i + 2,
                message: error.message,
                data: normalized,
              });
            }
          }
        }
      } else {
        const normalized = normalizeBusinessRow(rawRow);
        const result = validateBusinessRow(normalized, i + 2);

        if (!result.valid) {
          summary.invalidRows++;
          summary.errors.push({
            row: result.row,
            message: result.errors.join(", "),
            data: result.data,
          });
          continue;
        }

        const existing = await findExistingBusiness(normalized);

        summary.validRows++;
        summary.rows.push({
          ...normalized,
          action: existing ? "update" : "insert",
          existing_id: existing?.id ?? null,
        });

        if (existing) summary.updateCount++;
        else summary.insertCount++;

        if (body.mode === "confirm") {
          if (existing) {
            const { error } = await supabaseAdmin
              .from("businesses")
              .update(normalized)
              .eq("id", existing.id);

            if (error) {
              summary.errors.push({
                row: i + 2,
                message: error.message,
                data: normalized,
              });
            }
          } else {
            const { error } = await supabaseAdmin
              .from("businesses")
              .insert(normalized);

            if (error) {
              summary.errors.push({
                row: i + 2,
                message: error.message,
                data: normalized,
              });
            }
          }
        }
      }
    }

    if (body.mode === "confirm") {
      summary.duplicateCandidatesQueued = await queueDuplicates(body.type);
    }

    await saveImportRun(body, summary);

    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json(
      { error: "Could not process import" },
      { status: 500 }
    );
  }
}

